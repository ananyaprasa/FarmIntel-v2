"""MongoDB Atlas client lifecycle and FastAPI database dependency."""

from __future__ import annotations

import os
from collections.abc import Mapping

from fastapi import Request
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import (
    ConfigurationError,
    InvalidURI,
    OperationFailure,
    PyMongoError,
    ServerSelectionTimeoutError,
)

_TIMEOUT_MS = 5_000


class MongoDBError(RuntimeError):
    """A sanitized MongoDB configuration or connectivity failure."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class MongoDatabase:
    """Own one reusable async PyMongo client and its configured database."""

    def __init__(self, client: AsyncMongoClient, database_name: str) -> None:
        self._client = client
        self._database: AsyncDatabase = client.get_database(database_name)

    @classmethod
    def from_env(
        cls, environ: Mapping[str, str] | None = None
    ) -> MongoDatabase:
        settings = os.environ if environ is None else environ
        uri = (settings.get("MONGODB_URI") or "").strip()
        database_name = (settings.get("MONGODB_DATABASE") or "").strip()

        if not uri:
            raise MongoDBError("not_configured", "MONGODB_URI is required.")
        if not database_name:
            raise MongoDBError(
                "not_configured", "MONGODB_DATABASE is required."
            )
        if not uri.lower().startswith(("mongodb://", "mongodb+srv://")):
            raise MongoDBError(
                "invalid_configuration",
                "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string.",
            )

        try:
            client = AsyncMongoClient(
                uri,
                serverSelectionTimeoutMS=_TIMEOUT_MS,
                connectTimeoutMS=_TIMEOUT_MS,
                socketTimeoutMS=_TIMEOUT_MS,
                timeoutMS=_TIMEOUT_MS,
            )
            return cls(client, database_name)
        except (InvalidURI, ConfigurationError):
            raise MongoDBError(
                "invalid_configuration", "MONGODB_URI is invalid."
            ) from None

    @property
    def database(self) -> AsyncDatabase:
        return self._database

    async def ping(self) -> None:
        """Verify a live server connection without writing data."""
        try:
            await self._client.admin.command("ping")
        except OperationFailure as exc:
            if exc.code == 18:
                raise MongoDBError(
                    "authentication_failed",
                    "MongoDB authentication failed; check the configured database user.",
                ) from None
            raise MongoDBError(
                "connection_failed", "MongoDB rejected the connectivity check."
            ) from None
        except ServerSelectionTimeoutError:
            raise MongoDBError(
                "server_selection_timeout",
                "MongoDB did not respond before the server selection timeout; "
                "check Atlas network access, DNS, and TLS settings.",
            ) from None
        except PyMongoError:
            raise MongoDBError(
                "connection_failed",
                "MongoDB connection failed; check network, DNS, and TLS settings.",
            ) from None

    async def close(self) -> None:
        await self._client.close()


def get_database(request: Request) -> AsyncDatabase:
    """Return the application database for use by FastAPI services."""
    mongo_database: MongoDatabase | None = getattr(
        request.app.state, "mongo_database", None
    )
    if mongo_database is None:
        error: MongoDBError | None = getattr(
            request.app.state, "mongo_error", None
        )
        if error is not None:
            raise MongoDBError(error.code, str(error)) from None
        raise MongoDBError(
            "not_configured", "MongoDB is not available in this application."
        )
    return mongo_database.database
