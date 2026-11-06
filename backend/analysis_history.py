"""Authenticated, immutable snapshots of server-generated AI analyses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field, JsonValue
from pymongo import ASCENDING, DESCENDING
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

try:
    from database import MongoDBError, get_database
    from middleware.auth import AuthenticatedUser, get_current_user
except ImportError:
    from backend.database import MongoDBError, get_database
    from backend.middleware.auth import AuthenticatedUser, get_current_user


AnalysisType = Literal["disease", "soil", "crop"]
ANALYSIS_INDEXES = (
    (
        "analyses_user_created_id",
        [("user_id", ASCENDING), ("created_at", DESCENDING), ("_id", DESCENDING)],
    ),
    (
        "analyses_user_field_created_id",
        [
            ("user_id", ASCENDING),
            ("field_id", ASCENDING),
            ("created_at", DESCENDING),
            ("_id", DESCENDING),
        ],
    ),
)
_UNAVAILABLE_DETAIL = "Analysis history is temporarily unavailable."
_NOT_FOUND_DETAIL = "Analysis not found."


class AnalysisIndexError(RuntimeError):
    """Analysis history indexes could not be initialized."""


class AnalysisSaveOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    save_to_history: bool = False
    field_id: str | None = None


class AnalysisListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    analysis_type: AnalysisType | None = None
    field_id: str | None = None
    farm_id: str | None = None


class AnalysisResponse(BaseModel):
    id: str
    field_id: str | None
    analysis_type: AnalysisType
    result: dict[str, JsonValue]
    created_at: datetime


class AnalysisPage(BaseModel):
    items: list[AnalysisResponse]
    limit: int
    offset: int
    has_more: bool


router = APIRouter(tags=["analysis history"])


async def initialize_analysis_indexes(database: AsyncDatabase) -> None:
    """Create deterministic, non-unique indexes for history list queries."""
    try:
        collection = database["analyses"]
        existing = await collection.index_information()
        for name, keys in ANALYSIS_INDEXES:
            matching_key_indexes = [
                index for index in existing.values() if index.get("key") == keys
            ]
            if any(index.get("unique", False) for index in matching_key_indexes):
                raise AnalysisIndexError(
                    f"Index keys for {name} conflict with a unique index."
                )
            named_index = existing.get(name)
            if named_index is not None:
                if named_index.get("key") != keys or named_index.get("unique", False):
                    raise AnalysisIndexError(
                        f"Index {name} has a conflicting definition."
                    )
                continue
            if matching_key_indexes:
                continue
            await collection.create_index(keys, name=name, unique=False)
    except PyMongoError:
        raise AnalysisIndexError(
            "Analysis history indexes could not be initialized."
        ) from None


def get_analysis_database(request: Request) -> AsyncDatabase:
    if getattr(request.app.state, "analysis_indexes_unavailable", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UNAVAILABLE_DETAIL,
        )
    try:
        return get_database(request)
    except MongoDBError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UNAVAILABLE_DETAIL,
        ) from None


def parse_object_id(value: str, resource: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {resource} ID.",
        ) from None


async def save_inference_result(
    request: Request,
    options: AnalysisSaveOptions,
    analysis_type: AnalysisType,
    result: dict,
) -> str | None:
    """Persist only a result already produced by a trusted inference endpoint."""
    if not options.save_to_history:
        if options.field_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="field_id requires save_to_history=true.",
            )
        return None

    user = await get_current_user(request)
    database = get_analysis_database(request)
    field_object_id = (
        parse_object_id(options.field_id, "field")
        if options.field_id is not None
        else None
    )
    farm_object_id = None
    try:
        if field_object_id is not None:
            field = await database["fields"].find_one(
                {"_id": field_object_id, "user_id": user.id}
            )
            if field is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Field not found.",
                )
            farm = await database["farms"].find_one(
                {
                    "_id": field["farm_id"],
                    "user_id": user.id,
                    "deleting": {"$ne": True},
                }
            )
            if farm is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Field not found.",
                )
            farm_object_id = field["farm_id"]

        document = {
            "user_id": user.id,
            "field_id": field_object_id,
            "farm_id": farm_object_id,
            "analysis_type": analysis_type,
            "result": jsonable_encoder(result),
            "created_at": datetime.now(timezone.utc),
        }
        inserted = await database["analyses"].insert_one(document)
        if field_object_id is not None:
            field_still_owned = await database["fields"].find_one(
                {"_id": field_object_id, "user_id": user.id}
            )
            if (
                field_still_owned is None
                or field_still_owned.get("farm_id") != farm_object_id
            ):
                await database["analyses"].update_one(
                    {"_id": inserted.inserted_id, "user_id": user.id},
                    {"$unset": {"field_id": "", "farm_id": ""}},
                )
            else:
                active_farm = await database["farms"].find_one(
                    {
                        "_id": field_still_owned["farm_id"],
                        "user_id": user.id,
                        "deleting": {"$ne": True},
                    }
                )
                if active_farm is None:
                    await database["analyses"].update_one(
                        {"_id": inserted.inserted_id, "user_id": user.id},
                        {"$unset": {"field_id": "", "farm_id": ""}},
                    )
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UNAVAILABLE_DETAIL,
        ) from None
    return str(inserted.inserted_id)


def analysis_response(document: dict) -> AnalysisResponse:
    return AnalysisResponse(
        id=str(document["_id"]),
        field_id=str(document["field_id"]) if document.get("field_id") else None,
        analysis_type=document["analysis_type"],
        result=document["result"],
        created_at=document["created_at"],
    )


@router.get("/api/v1/analyses", response_model=AnalysisPage)
async def list_analyses(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_analysis_database)],
    query: Annotated[AnalysisListQuery, Depends()],
) -> AnalysisPage:
    filters: dict = {"user_id": user.id}
    if query.analysis_type is not None:
        filters["analysis_type"] = query.analysis_type
    if query.field_id is not None:
        filters["field_id"] = parse_object_id(query.field_id, "field")
    if query.farm_id is not None:
        filters["farm_id"] = parse_object_id(query.farm_id, "farm")

    try:
        cursor = (
            database["analyses"]
            .find(filters)
            .sort([("created_at", DESCENDING), ("_id", DESCENDING)])
            .skip(query.offset)
            .limit(query.limit + 1)
        )
        documents = await cursor.to_list(length=query.limit + 1)
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UNAVAILABLE_DETAIL,
        ) from None
    has_more = len(documents) > query.limit
    return AnalysisPage(
        items=[analysis_response(item) for item in documents[: query.limit]],
        limit=query.limit,
        offset=query.offset,
        has_more=has_more,
    )


@router.get("/api/v1/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_analysis_database)],
) -> AnalysisResponse:
    object_id = parse_object_id(analysis_id, "analysis")
    try:
        document = await database["analyses"].find_one(
            {"_id": object_id, "user_id": user.id}
        )
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UNAVAILABLE_DETAIL,
        ) from None
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND_DETAIL
        )
    return analysis_response(document)
