import asyncio
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import httpx
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError

from backend import main
from backend.farms import (
    FIELD_INDEX_NAME,
    FARM_INDEX_NAME,
    FarmIndexError,
    get_farms_database,
    initialize_farm_indexes,
)
from backend.middleware.auth import AuthenticatedUser, get_current_user


AUTH_ENV = {
    "GOOGLE_CLIENT_ID": "test-client-id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "test-google-client-secret",
    "GOOGLE_REDIRECT_URI": (
        "https://api.example.test/api/v1/auth/google/callback"
    ),
    "FRONTEND_ORIGIN": "https://app.example.test",
    "CORS_ORIGINS": "https://app.example.test",
    "JWT_SECRET_KEY": "a" * 64,
    "JWT_ALGORITHM": "HS256",
    "JWT_EXPIRE_MINUTES": "30",
}


class Cursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, keys):
        for key, direction in reversed(keys):
            self.documents.sort(
                key=lambda document: document[key],
                reverse=direction == DESCENDING,
            )
        return self

    def skip(self, count):
        self.documents = self.documents[count:]
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length=None):
        return self.documents if length is None else self.documents[:length]


class Collection:
    def __init__(self):
        self.documents = []
        self.indexes = {}
        self.unique_indexes = {}
        self.failure = None
        self.delete_failure = False
        self.partial_delete_failure = False

    @staticmethod
    def _matches(document, query):
        for key, expected in query.items():
            actual = document.get(key)
            if isinstance(expected, dict):
                if "$ne" in expected and actual == expected["$ne"]:
                    return False
                if "$in" in expected and actual not in expected["$in"]:
                    return False
            elif actual != expected:
                return False
        return True

    def _check_failure(self):
        if self.failure is not None:
            raise self.failure

    async def index_information(self):
        return {
            name: {
                "key": keys,
                "unique": self.unique_indexes.get(name, False),
            }
            for name, keys in self.indexes.items()
        }

    async def create_index(self, keys, name, unique=False):
        self._check_failure()
        self.indexes[name] = keys
        self.unique_indexes[name] = unique
        return name

    def find(self, query):
        self._check_failure()
        return Cursor(
            document
            for document in self.documents
            if self._matches(document, query)
        )

    async def find_one(self, query):
        self._check_failure()
        return next(
            (
                document.copy()
                for document in self.documents
                if self._matches(document, query)
            ),
            None,
        )

    async def insert_one(self, document):
        self._check_failure()
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return type("InsertResult", (), {"inserted_id": stored["_id"]})()

    async def find_one_and_update(self, query, update, return_document=None):
        self._check_failure()
        for document in self.documents:
            if self._matches(document, query):
                document.update(update["$set"])
                return document.copy()
        return None

    async def update_one(self, query, update):
        self._check_failure()
        for document in self.documents:
            if self._matches(document, query):
                document.update(update["$set"])
                for key in update.get("$unset", {}):
                    document.pop(key, None)
                return type("UpdateResult", (), {"matched_count": 1})()
        return type("UpdateResult", (), {"matched_count": 0})()

    async def update_many(self, query, update):
        self._check_failure()
        matches = 0
        for document in self.documents:
            if self._matches(document, query):
                document.update(update.get("$set", {}))
                for key in update.get("$unset", {}):
                    document.pop(key, None)
                matches += 1
        return type("UpdateResult", (), {"matched_count": matches})()

    async def delete_many(self, query):
        self._check_failure()
        matches = [
            document
            for document in self.documents
            if self._matches(document, query)
        ]
        if self.partial_delete_failure:
            self.partial_delete_failure = False
            if matches:
                self.documents.remove(matches[0])
            raise PyMongoError("private database detail")
        self.documents = [
            document for document in self.documents if document not in matches
        ]
        return type("DeleteResult", (), {"deleted_count": len(matches)})()

    async def delete_one(self, query):
        self._check_failure()
        if self.delete_failure:
            raise PyMongoError("private database detail")
        for index, document in enumerate(self.documents):
            if self._matches(document, query):
                del self.documents[index]
                return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()


class Database:
    def __init__(self):
        self.collections = {
            "farms": Collection(),
            "fields": Collection(),
            "analyses": Collection(),
            "users": Collection(),
        }

    def __getitem__(self, name):
        return self.collections[name]


class FarmApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database = Database()
        self.user = AuthenticatedUser(
            id=str(ObjectId()), email="farmer@example.test", display_name="Farmer"
        )
        self.previous_overrides = main.app.dependency_overrides.copy()
        main.app.dependency_overrides[get_current_user] = lambda: self.user
        main.app.dependency_overrides[get_farms_database] = (
            lambda: self.database
        )
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app),
            base_url="http://test",
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(self.previous_overrides)

    async def test_unauthenticated_farm_and_field_requests_return_401(self):
        main.app.dependency_overrides.pop(get_current_user)
        farm_id = str(ObjectId())
        field_id = str(ObjectId())
        with patch.dict(os.environ, AUTH_ENV, clear=True):
            responses = [
                await self.client.get("/api/v1/farms"),
                await self.client.post(
                    "/api/v1/farms", json={"name": "North Farm"}
                ),
                await self.client.get(
                    f"/api/v1/farms/{farm_id}/fields"
                ),
                await self.client.get(f"/api/v1/fields/{field_id}"),
            ]
        self.assertEqual([response.status_code for response in responses], [401] * 4)

    async def test_owner_crud_forgery_and_cross_user_isolation(self):
        farm_response = await self.client.post(
            "/api/v1/farms",
            json={
                "name": "  North Farm ",
                "description": "Mixed crops",
                "location": "Northern valley",
            },
        )
        self.assertEqual(farm_response.status_code, 201)
        farm = farm_response.json()
        farm_id = farm["id"]
        stored_farm = self.database["farms"].documents[0]
        self.assertEqual(stored_farm["user_id"], self.user.id)
        self.assertEqual(farm["name"], "North Farm")
        self.assertNotIn("user_id", farm)

        field_response = await self.client.post(
            f"/api/v1/farms/{farm_id}/fields",
            json={
                "name": "  East Plot ",
                "area": 2.5,
                "area_unit": "acre",
                "crop_type": "maize",
                "soil_type": "loam",
            },
        )
        self.assertEqual(field_response.status_code, 201)
        field = field_response.json()
        field_id = field["id"]
        self.assertEqual(
            self.database["fields"].documents[0]["user_id"], self.user.id
        )

        updated_field = await self.client.patch(
            f"/api/v1/fields/{field_id}", json={"crop_type": "beans"}
        )
        self.assertEqual(updated_field.status_code, 200)
        self.assertEqual(updated_field.json()["area"], 2.5)
        self.assertEqual(updated_field.json()["name"], "East Plot")
        self.assertEqual(updated_field.json()["crop_type"], "beans")

        updated_farm = await self.client.patch(
            f"/api/v1/farms/{farm_id}", json={"description": "Updated"}
        )
        self.assertEqual(updated_farm.status_code, 200)
        self.assertEqual(updated_farm.json()["location"], "Northern valley")
        self.assertEqual(updated_farm.json()["description"], "Updated")

        farm_list = await self.client.get("/api/v1/farms")
        field_list = await self.client.get(
            f"/api/v1/farms/{farm_id}/fields"
        )
        self.assertEqual([item["id"] for item in farm_list.json()], [farm_id])
        self.assertEqual([item["id"] for item in field_list.json()], [field_id])
        self.assertEqual(
            (await self.client.get(f"/api/v1/farms/{farm_id}")).status_code,
            200,
        )
        self.assertEqual(
            (await self.client.get(f"/api/v1/fields/{field_id}")).status_code,
            200,
        )

        forged = await self.client.post(
            "/api/v1/farms",
            json={"name": "Forged", "user_id": str(ObjectId())},
        )
        self.assertEqual(forged.status_code, 422)
        attempted_move = await self.client.patch(
            f"/api/v1/fields/{field_id}", json={"farm_id": str(ObjectId())}
        )
        self.assertEqual(attempted_move.status_code, 422)
        forged_owner = await self.client.patch(
            f"/api/v1/farms/{farm_id}",
            json={"user_id": str(ObjectId())},
        )
        self.assertEqual(forged_owner.status_code, 422)

        cascade_field_response = await self.client.post(
            f"/api/v1/farms/{farm_id}/fields",
            json={"name": "South Plot"},
        )
        self.assertEqual(cascade_field_response.status_code, 201)

        other_user = AuthenticatedUser(
            id=str(ObjectId()), email="other@example.test", display_name="Other"
        )
        self.user = other_user
        other_farm_response = await self.client.post(
            "/api/v1/farms", json={"name": "Other Farm"}
        )
        other_farm_id = other_farm_response.json()["id"]
        other_field_response = await self.client.post(
            f"/api/v1/farms/{other_farm_id}/fields",
            json={"name": "Other Field"},
        )
        other_field_id = other_field_response.json()["id"]
        self.user = AuthenticatedUser(
            id=stored_farm["user_id"],
            email="farmer@example.test",
            display_name="Farmer",
        )

        self.assertEqual(
            (await self.client.get("/api/v1/farms")).json()[0]["id"], farm_id
        )
        self.assertEqual(
            (
                await self.client.get(
                    f"/api/v1/farms/{other_farm_id}"
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.patch(
                    f"/api/v1/farms/{other_farm_id}",
                    json={"name": "Changed"},
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.delete(
                    f"/api/v1/farms/{other_farm_id}"
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.get(
                    f"/api/v1/farms/{other_farm_id}/fields"
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.post(
                    f"/api/v1/farms/{other_farm_id}/fields",
                    json={"name": "Not allowed"},
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (await self.client.get(f"/api/v1/fields/{other_field_id}")).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.patch(
                    f"/api/v1/fields/{other_field_id}",
                    json={"name": "Changed"},
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.delete(
                    f"/api/v1/fields/{other_field_id}"
                )
            ).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.delete(
                    f"/api/v1/fields/{other_field_id}"
                )
            ).status_code,
            404,
        )

        self.user = AuthenticatedUser(
            id=stored_farm["user_id"],
            email="farmer@example.test",
            display_name="Farmer",
        )
        self.assertEqual(
            (
                await self.client.delete(f"/api/v1/fields/{field_id}")
            ).status_code,
            204,
        )
        self.assertEqual(
            (await self.client.get(f"/api/v1/fields/{field_id}")).status_code,
            404,
        )
        self.assertEqual(
            (
                await self.client.delete(f"/api/v1/farms/{farm_id}")
            ).status_code,
            204,
        )
        self.assertFalse(
            any(
                item["farm_id"] == ObjectId(farm_id)
                for item in self.database["fields"].documents
            )
        )
        self.assertTrue(
            any(
                item["farm_id"] == ObjectId(other_farm_id)
                for item in self.database["fields"].documents
            )
        )

    async def test_farm_delete_failure_returns_unavailable_and_is_retryable(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Retry Farm"})
        ).json()
        await self.client.post(
            f"/api/v1/farms/{farm['id']}/fields",
            json={"name": "Retry Field"},
        )
        self.database["farms"].delete_failure = True

        failed = await self.client.delete(f"/api/v1/farms/{farm['id']}")

        self.assertEqual(failed.status_code, 503)
        self.assertNotIn("private database detail", failed.text)
        self.assertEqual(self.database["fields"].documents, [])
        self.assertTrue(self.database["farms"].documents[0]["deleting"])

        self.database["farms"].delete_failure = False
        completed = await self.client.delete(f"/api/v1/farms/{farm['id']}")
        self.assertEqual(completed.status_code, 204)
        self.assertEqual(self.database["fields"].documents, [])

    async def test_farm_delete_cleanup_failure_and_partial_cleanup_are_retryable(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Retry Farm"})
        ).json()
        for name in ("First Field", "Second Field"):
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields", json={"name": name}
            )

        fields = self.database["fields"]
        fields.failure = PyMongoError("private database detail")
        first_attempt = await self.client.delete(f"/api/v1/farms/{farm['id']}")
        self.assertEqual(first_attempt.status_code, 503)
        self.assertTrue(self.database["farms"].documents[0]["deleting"])
        self.assertEqual(len(fields.documents), 2)

        fields.failure = None
        fields.partial_delete_failure = True
        partial_attempt = await self.client.delete(
            f"/api/v1/farms/{farm['id']}"
        )
        self.assertEqual(partial_attempt.status_code, 503)
        self.assertEqual(len(fields.documents), 1)
        self.assertEqual(len(self.database["farms"].documents), 1)

        completed = await self.client.delete(f"/api/v1/farms/{farm['id']}")
        self.assertEqual(completed.status_code, 204)
        self.assertEqual(fields.documents, [])
        self.assertEqual(self.database["farms"].documents, [])

    async def test_concurrent_farm_deletes_do_not_report_two_successes(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Concurrent"})
        ).json()
        await self.client.post(
            f"/api/v1/farms/{farm['id']}/fields", json={"name": "Field"}
        )

        fields = self.database["fields"]
        delete_many = fields.delete_many
        both_deletes_started = asyncio.Event()
        calls = 0

        async def wait_for_both_deletes(query):
            nonlocal calls
            calls += 1
            if calls == 2:
                both_deletes_started.set()
            await asyncio.wait_for(both_deletes_started.wait(), timeout=2)
            return await delete_many(query)

        fields.delete_many = wait_for_both_deletes
        results = await asyncio.gather(
            self.client.delete(f"/api/v1/farms/{farm['id']}"),
            self.client.delete(f"/api/v1/farms/{farm['id']}"),
        )

        self.assertEqual(
            sorted(response.status_code for response in results), [204, 404]
        )
        self.assertEqual(fields.documents, [])
        self.assertEqual(self.database["farms"].documents, [])

    async def test_field_creation_racing_farm_delete_is_compensated(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Race Farm"})
        ).json()
        fields = self.database["fields"]
        insert_field = fields.insert_one
        insert_started = asyncio.Event()
        allow_insert = asyncio.Event()

        async def delayed_insert(document):
            insert_started.set()
            await asyncio.wait_for(allow_insert.wait(), timeout=2)
            return await insert_field(document)

        fields.insert_one = delayed_insert
        creating = asyncio.create_task(
            self.client.post(
                f"/api/v1/farms/{farm['id']}/fields",
                json={"name": "Racing Field"},
            )
        )
        await asyncio.wait_for(insert_started.wait(), timeout=2)
        deleted = await self.client.delete(f"/api/v1/farms/{farm['id']}")
        allow_insert.set()
        created = await creating

        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(created.status_code, 404)
        self.assertEqual(fields.documents, [])

    async def test_field_compensation_failure_leaves_inaccessible_orphan(self):
        farm = (
            await self.client.post(
                "/api/v1/farms", json={"name": "Compensation Race Farm"}
            )
        ).json()

        fields = self.database["fields"]
        insert_field = fields.insert_one
        insert_started = asyncio.Event()
        allow_insert = asyncio.Event()

        async def delayed_insert(document):
            insert_started.set()
            await asyncio.wait_for(allow_insert.wait(), timeout=2)
            return await insert_field(document)

        async def fail_compensating_delete(query):
            raise PyMongoError("private compensation failure")

        fields.insert_one = delayed_insert
        fields.delete_one = fail_compensating_delete

        creating = asyncio.create_task(
            self.client.post(
                f"/api/v1/farms/{farm['id']}/fields",
                json={"name": "Orphaned Field"},
            )
        )
        await asyncio.wait_for(insert_started.wait(), timeout=2)

        deleted = await self.client.delete(f"/api/v1/farms/{farm['id']}")
        self.assertEqual(deleted.status_code, 204)

        allow_insert.set()
        created = await creating

        self.assertEqual(created.status_code, 503)
        self.assertNotIn("private compensation failure", created.text)
        self.assertEqual(len(fields.documents), 1)
        field_id = str(fields.documents[0]["_id"])

        responses = [
            await self.client.get(f"/api/v1/farms/{farm['id']}/fields"),
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields",
                json={"name": "Another Field"},
            ),
            await self.client.get(f"/api/v1/fields/{field_id}"),
            await self.client.patch(
                f"/api/v1/fields/{field_id}", json={"name": "Changed"}
            ),
            await self.client.delete(f"/api/v1/fields/{field_id}"),
        ]
        self.assertEqual([response.status_code for response in responses], [404] * 5)

    async def test_invalid_values_and_malformed_object_ids_are_rejected(self):
        for payload in (
            {"name": "   "},
            {"name": ""},
            {"name": 4},
        ):
            response = await self.client.post("/api/v1/farms", json=payload)
            self.assertEqual(response.status_code, 422)

        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Test Farm"})
        ).json()
        farm_id = farm["id"]
        for payload in (
            {"name": "   "},
            {"name": "Field", "area": 0},
            {"name": "Field", "area": -1},
            {"name": "Field", "area": "NaN"},
            {"name": "Field", "area_unit": "square mile"},
            {"name": "Field", "user_id": str(ObjectId())},
        ):
            response = await self.client.post(
                f"/api/v1/farms/{farm_id}/fields", json=payload
            )
            self.assertEqual(response.status_code, 422)

        for path in (
            "/api/v1/farms/not-an-object-id",
            "/api/v1/farms/not-an-object-id/fields",
            "/api/v1/fields/not-an-object-id",
        ):
            response = await self.client.get(path)
            self.assertEqual(response.status_code, 400)

    async def test_database_failures_are_sanitized(self):
        self.database["farms"].failure = PyMongoError(
            "sensitive database detail"
        )
        response = await self.client.get("/api/v1/farms")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("sensitive database detail", response.text)

    async def test_field_create_rejects_forged_owner_and_owned_field_checks_parent(self):
        response = await self.client.post(
            "/api/v1/farms",
            json={"name": "Test Farm", "user_id": str(ObjectId())},
        )
        self.assertEqual(response.status_code, 422)

        foreign_farm_id = ObjectId()
        self.database["farms"].documents.append(
            {
                "_id": foreign_farm_id,
                "user_id": str(ObjectId()),
                "name": "Foreign",
                "description": None,
                "location": None,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        creation = await self.client.post(
            f"/api/v1/farms/{foreign_farm_id}/fields",
            json={"name": "Blocked"},
        )
        self.assertEqual(creation.status_code, 404)


class FarmIndexTests(unittest.IsolatedAsyncioTestCase):
    async def test_index_creation_is_deterministic_and_idempotent(self):
        database = Database()

        await initialize_farm_indexes(database)
        await initialize_farm_indexes(database)

        self.assertEqual(
            database["farms"].indexes,
            {
                "farms_user_created_at": [
                    ("user_id", ASCENDING),
                    ("created_at", DESCENDING),
                ]
            },
        )
        self.assertEqual(
            database["fields"].indexes,
            {
                "fields_user_farm_created_at": [
                    ("user_id", ASCENDING),
                    ("farm_id", ASCENDING),
                    ("created_at", DESCENDING),
                ]
            },
        )
        self.assertFalse(any(database["farms"].unique_indexes.values()))
        self.assertFalse(any(database["fields"].unique_indexes.values()))

    async def test_existing_matching_indexes_are_reused(self):
        database = Database()
        farm_keys = [("user_id", ASCENDING), ("created_at", DESCENDING)]
        field_keys = [
            ("user_id", ASCENDING),
            ("farm_id", ASCENDING),
            ("created_at", DESCENDING),
        ]
        database["farms"].indexes["existing_farm_index"] = farm_keys
        database["fields"].indexes["existing_field_index"] = field_keys

        await initialize_farm_indexes(database)

        self.assertEqual(database["farms"].indexes, {"existing_farm_index": farm_keys})
        self.assertEqual(
            database["fields"].indexes, {"existing_field_index": field_keys}
        )

    async def test_conflicting_named_indexes_fail_initialization(self):
        database = Database()
        database["farms"].indexes[FARM_INDEX_NAME] = [
            ("created_at", DESCENDING),
            ("user_id", ASCENDING),
        ]

        with self.assertRaises(FarmIndexError):
            await initialize_farm_indexes(database)

    async def test_unique_named_index_is_not_reused(self):
        database = Database()
        database["farms"].indexes[FARM_INDEX_NAME] = [
            ("user_id", ASCENDING),
            ("created_at", DESCENDING),
        ]
        database["farms"].unique_indexes[FARM_INDEX_NAME] = True

        with self.assertRaises(FarmIndexError):
            await initialize_farm_indexes(database)

    async def test_index_creation_errors_are_reported(self):
        database = Database()
        database["fields"].failure = PyMongoError("private index detail")

        with self.assertRaises(FarmIndexError) as raised:
            await initialize_farm_indexes(database)

        self.assertNotIn("private index detail", str(raised.exception))
        self.assertIn(FARM_INDEX_NAME, database["farms"].indexes)
        self.assertNotIn(FIELD_INDEX_NAME, database["fields"].indexes)


if __name__ == "__main__":
    unittest.main()
