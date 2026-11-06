"""Ownership-scoped farm and field management endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, field_validator
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

try:
    from database import MongoDBError, get_database
    from middleware.auth import AuthenticatedUser, get_current_user
except ImportError:
    from backend.database import MongoDBError, get_database
    from backend.middleware.auth import AuthenticatedUser, get_current_user


router = APIRouter(tags=["farms"])

FARM_INDEX_NAME = "farms_user_created_at"
FIELD_INDEX_NAME = "fields_user_farm_created_at"
_UNAVAILABLE_DETAIL = "Farm service is temporarily unavailable."


class FarmIndexError(RuntimeError):
    """Farm and field indexes could not be initialized."""


async def initialize_farm_indexes(database: AsyncDatabase) -> None:
    """Create the deterministic owner-scoped indexes required by farm APIs."""
    try:
        indexes = (
            (
                database["farms"],
                [("user_id", ASCENDING), ("created_at", DESCENDING)],
                FARM_INDEX_NAME,
            ),
            (
                database["fields"],
                [
                    ("user_id", ASCENDING),
                    ("farm_id", ASCENDING),
                    ("created_at", DESCENDING),
                ],
                FIELD_INDEX_NAME,
            ),
        )
        for collection, keys, name in indexes:
            existing = await collection.index_information()
            named_index = existing.get(name)
            if named_index is not None:
                if (
                    named_index.get("key") != keys
                    or named_index.get("unique", False)
                ):
                    raise FarmIndexError(
                        f"Index {name} has a conflicting definition."
                    )
                continue
            if any(
                index.get("key") == keys and not index.get("unique", False)
                for index in existing.values()
            ):
                continue
            await collection.create_index(keys, name=name, unique=False)
    except PyMongoError:
        raise FarmIndexError(
            "Farm and field indexes could not be initialized."
        ) from None


class FarmCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2_000)
    location: str | None = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _required_name(value)

    @field_validator("description", "location")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class FarmUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2_000)
    location: str | None = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("name cannot be null.")
        return _required_name(value)

    @field_validator("description", "location")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class FieldCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    area: FiniteFloat | None = Field(default=None, gt=0)
    area_unit: Literal["acre", "hectare", "m²"] | None = None
    crop_type: str | None = Field(default=None, max_length=120)
    soil_type: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _required_name(value)

    @field_validator("crop_type", "soil_type")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class FieldUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    area: FiniteFloat | None = Field(default=None, gt=0)
    area_unit: Literal["acre", "hectare", "m²"] | None = None
    crop_type: str | None = Field(default=None, max_length=120)
    soil_type: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("name cannot be null.")
        return _required_name(value)

    @field_validator("crop_type", "soil_type")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class FarmResponse(BaseModel):
    id: str
    name: str
    description: str | None
    location: str | None
    created_at: datetime
    updated_at: datetime


class FieldResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    area: float | None
    area_unit: Literal["acre", "hectare", "m²"] | None
    crop_type: str | None
    soil_type: str | None
    created_at: datetime
    updated_at: datetime


def _required_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise ValueError("name must not be blank.")
    return name


def _object_id(value: str, resource: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {resource} ID.",
        ) from None


def _service_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=_UNAVAILABLE_DETAIL,
    )


def get_farms_database(request: Request) -> AsyncDatabase:
    if getattr(request.app.state, "farm_indexes_unavailable", False):
        raise _service_unavailable()
    try:
        return get_database(request)
    except MongoDBError:
        raise _service_unavailable() from None


def _farm_response(document: dict) -> FarmResponse:
    return FarmResponse(
        id=str(document["_id"]),
        name=document["name"],
        description=document.get("description"),
        location=document.get("location"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


def _field_response(document: dict) -> FieldResponse:
    return FieldResponse(
        id=str(document["_id"]),
        farm_id=str(document["farm_id"]),
        name=document["name"],
        area=document.get("area"),
        area_unit=document.get("area_unit"),
        crop_type=document.get("crop_type"),
        soil_type=document.get("soil_type"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


async def _find_owned_farm(
    database: AsyncDatabase, farm_id: ObjectId, user_id: str
) -> dict:
    farm = await database["farms"].find_one(
        {
            "_id": farm_id,
            "user_id": user_id,
            "deleting": {"$ne": True},
        }
    )
    if farm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found."
        )
    return farm


async def _find_owned_field(
    database: AsyncDatabase, field_id: ObjectId, user_id: str
) -> dict:
    field = await database["fields"].find_one(
        {"_id": field_id, "user_id": user_id}
    )
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Field not found."
        )
    parent = await database["farms"].find_one(
        {
            "_id": field["farm_id"],
            "user_id": user_id,
            "deleting": {"$ne": True},
        }
    )
    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Field not found."
        )
    return field


def _require_updates(updates: dict) -> None:
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one editable field must be supplied.",
        )


@router.get("/api/v1/farms", response_model=list[FarmResponse])
async def list_farms(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> list[FarmResponse]:
    try:
        cursor = database["farms"].find(
            {"user_id": user.id, "deleting": {"$ne": True}}
        ).sort([("created_at", DESCENDING), ("_id", DESCENDING)])
        documents = await cursor.to_list(length=None)
    except PyMongoError:
        raise _service_unavailable() from None
    return [_farm_response(document) for document in documents]


@router.post(
    "/api/v1/farms",
    response_model=FarmResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_farm(
    payload: FarmCreate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FarmResponse:
    now = datetime.now(timezone.utc)
    document = {
        "user_id": user.id,
        "name": payload.name,
        "description": payload.description,
        "location": payload.location,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await database["farms"].insert_one(document)
    except PyMongoError:
        raise _service_unavailable() from None
    return _farm_response({"_id": result.inserted_id, **document})


@router.get("/api/v1/farms/{farm_id}", response_model=FarmResponse)
async def get_farm(
    farm_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FarmResponse:
    object_id = _object_id(farm_id, "farm")
    try:
        return _farm_response(await _find_owned_farm(database, object_id, user.id))
    except PyMongoError:
        raise _service_unavailable() from None


@router.patch("/api/v1/farms/{farm_id}", response_model=FarmResponse)
async def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FarmResponse:
    object_id = _object_id(farm_id, "farm")
    updates = payload.model_dump(exclude_unset=True)
    _require_updates(updates)
    updates["updated_at"] = datetime.now(timezone.utc)
    try:
        document = await database["farms"].find_one_and_update(
            {
                "_id": object_id,
                "user_id": user.id,
                "deleting": {"$ne": True},
            },
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise _service_unavailable() from None
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found."
        )
    return _farm_response(document)


@router.delete(
    "/api/v1/farms/{farm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description=(
        "Marks the farm as deleting to block new fields, then deletes its owned "
        "fields before the farm. A retry safely completes an interrupted deletion."
    ),
)
async def delete_farm(
    farm_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> Response:
    object_id = _object_id(farm_id, "farm")
    try:
        result = await database["farms"].update_one(
            {"_id": object_id, "user_id": user.id},
            {
                "$set": {
                    "deleting": True,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        if result.matched_count != 1:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )
        await database["analyses"].update_many(
            {"user_id": user.id, "farm_id": object_id},
            {"$unset": {"field_id": "", "farm_id": ""}},
        )
        await database["fields"].delete_many(
            {"user_id": user.id, "farm_id": object_id}
        )
        await database["analyses"].update_many(
            {"user_id": user.id, "farm_id": object_id},
            {"$unset": {"field_id": "", "farm_id": ""}},
        )
        result = await database["farms"].delete_one(
            {"_id": object_id, "user_id": user.id, "deleting": True}
        )
    except PyMongoError:
        raise _service_unavailable() from None
    if result.deleted_count != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found."
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/api/v1/farms/{farm_id}/fields", response_model=list[FieldResponse]
)
async def list_fields(
    farm_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> list[FieldResponse]:
    object_id = _object_id(farm_id, "farm")
    try:
        await _find_owned_farm(database, object_id, user.id)
        cursor = database["fields"].find(
            {"user_id": user.id, "farm_id": object_id}
        ).sort([("created_at", DESCENDING), ("_id", DESCENDING)])
        documents = await cursor.to_list(length=None)
    except PyMongoError:
        raise _service_unavailable() from None
    return [_field_response(document) for document in documents]


@router.post(
    "/api/v1/farms/{farm_id}/fields",
    response_model=FieldResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_field(
    farm_id: str,
    payload: FieldCreate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FieldResponse:
    object_id = _object_id(farm_id, "farm")
    now = datetime.now(timezone.utc)
    document = {
        "user_id": user.id,
        "farm_id": object_id,
        "name": payload.name,
        "area": payload.area,
        "area_unit": payload.area_unit,
        "crop_type": payload.crop_type,
        "soil_type": payload.soil_type,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await _find_owned_farm(database, object_id, user.id)
        result = await database["fields"].insert_one(document)
        parent = await database["farms"].find_one(
            {
                "_id": object_id,
                "user_id": user.id,
                "deleting": {"$ne": True},
            }
        )
        if parent is None:
            await database["fields"].delete_one(
                {
                    "_id": result.inserted_id,
                    "user_id": user.id,
                    "farm_id": object_id,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )
    except PyMongoError:
        raise _service_unavailable() from None
    return _field_response({"_id": result.inserted_id, **document})


@router.get("/api/v1/fields/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FieldResponse:
    object_id = _object_id(field_id, "field")
    try:
        return _field_response(await _find_owned_field(database, object_id, user.id))
    except PyMongoError:
        raise _service_unavailable() from None


@router.patch("/api/v1/fields/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: str,
    payload: FieldUpdate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> FieldResponse:
    object_id = _object_id(field_id, "field")
    updates = payload.model_dump(exclude_unset=True)
    _require_updates(updates)
    updates["updated_at"] = datetime.now(timezone.utc)
    try:
        field = await _find_owned_field(database, object_id, user.id)
        document = await database["fields"].find_one_and_update(
            {
                "_id": object_id,
                "user_id": user.id,
                "farm_id": field["farm_id"],
            },
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise _service_unavailable() from None
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Field not found."
        )
    return _field_response(document)


@router.delete(
    "/api/v1/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_field(
    field_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    database: Annotated[AsyncDatabase, Depends(get_farms_database)],
) -> Response:
    object_id = _object_id(field_id, "field")
    try:
        await database["analyses"].update_many(
            {"user_id": user.id, "field_id": object_id},
            {"$unset": {"field_id": "", "farm_id": ""}},
        )
        field = await _find_owned_field(database, object_id, user.id)
        result = await database["fields"].delete_one(
            {
                "_id": object_id,
                "user_id": user.id,
                "farm_id": field["farm_id"],
            }
        )
        await database["analyses"].update_many(
            {"user_id": user.id, "field_id": object_id},
            {"$unset": {"field_id": "", "farm_id": ""}},
        )
    except PyMongoError:
        raise _service_unavailable() from None
    if result.deleted_count != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Field not found."
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
