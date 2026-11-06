import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
from bson import ObjectId
from fastapi import HTTPException, Request
from pymongo.errors import PyMongoError

from backend import main
from backend import analysis_history
from backend.analysis_history import (
    ANALYSIS_INDEXES,
    AnalysisIndexError,
    AnalysisSaveOptions,
    get_analysis_database,
    initialize_analysis_indexes,
    save_inference_result,
)
from backend.farms import get_farms_database
from backend.middleware.auth import AuthenticatedUser, get_current_user

try:
    from test_farms import Database
except ModuleNotFoundError:
    from backend.tests.test_farms import Database


def make_request():
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/recommend/crop",
            "headers": [],
            "query_string": b"",
            "app": main.app,
        }
    )


class AnalysisHistoryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database = Database()
        self.user = AuthenticatedUser(
            id=str(ObjectId()), email="farmer@example.test", display_name="Farmer"
        )
        self.previous_overrides = main.app.dependency_overrides.copy()
        self.previous_unavailable = getattr(
            main.app.state, "analysis_indexes_unavailable", True
        )
        main.app.state.analysis_indexes_unavailable = False
        main.app.dependency_overrides[get_current_user] = lambda: self.user
        main.app.dependency_overrides[get_analysis_database] = (
            lambda: self.database
        )
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
        main.app.state.analysis_indexes_unavailable = self.previous_unavailable

    def add_analysis(
        self,
        *,
        owner=None,
        analysis_type="disease",
        created_at=None,
        field_id=None,
        result=None,
        object_id=None,
    ):
        document = {
            "_id": object_id or ObjectId(),
            "user_id": owner or self.user.id,
            "field_id": field_id,
            "farm_id": None,
            "analysis_type": analysis_type,
            "result": result or {"disease": "Tomato — Early blight", "confidence": 92.4},
            "created_at": created_at or datetime.now(timezone.utc),
        }
        self.database["analyses"].documents.append(document)
        return document

    async def test_unauthenticated_history_requests_return_401(self):
        main.app.dependency_overrides.pop(get_current_user)
        response_list = await self.client.get("/api/v1/analyses")
        response_detail = await self.client.get(
            f"/api/v1/analyses/{ObjectId()}"
        )
        self.assertEqual(
            [response_list.status_code, response_detail.status_code], [401, 401]
        )

    async def test_owner_lists_and_retrieves_private_analysis_snapshots(self):
        own = self.add_analysis()
        self.add_analysis(owner=str(ObjectId()))

        listed = await self.client.get("/api/v1/analyses")
        detail = await self.client.get(f"/api/v1/analyses/{own['_id']}")

        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in listed.json()["items"]], [str(own["_id"])])
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["result"], own["result"])
        self.assertNotIn("user_id", detail.json())

    async def test_cross_owner_detail_is_indistinguishable_from_missing(self):
        other = self.add_analysis(owner=str(ObjectId()))
        cross_owner = await self.client.get(
            f"/api/v1/analyses/{other['_id']}"
        )
        missing = await self.client.get(
            f"/api/v1/analyses/{ObjectId()}"
        )
        self.assertEqual([cross_owner.status_code, missing.status_code], [404, 404])
        self.assertEqual(cross_owner.json(), missing.json())

    async def test_filters_pagination_and_stable_newest_first_order(self):
        timestamp = datetime.now(timezone.utc)
        field_id = ObjectId()
        farm_id = ObjectId()
        first = self.add_analysis(
            analysis_type="disease",
            created_at=timestamp,
            object_id=ObjectId("1" * 24),
            field_id=field_id,
        )
        first["farm_id"] = farm_id
        second = self.add_analysis(
            analysis_type="soil", created_at=timestamp, object_id=ObjectId("2" * 24)
        )
        self.add_analysis(
            owner=str(ObjectId()), analysis_type="soil", created_at=timestamp + timedelta(days=1)
        )

        page = await self.client.get("/api/v1/analyses?limit=1&offset=0")
        next_page = await self.client.get("/api/v1/analyses?limit=1&offset=1")
        filtered = await self.client.get(
            "/api/v1/analyses?analysis_type=soil&limit=10"
        )
        field_filtered = await self.client.get(
            f"/api/v1/analyses?field_id={field_id}"
        )
        farm_filtered = await self.client.get(
            f"/api/v1/analyses?farm_id={farm_id}"
        )

        self.assertEqual([item["id"] for item in page.json()["items"]], [str(second["_id"])])
        self.assertTrue(page.json()["has_more"])
        self.assertEqual([item["id"] for item in next_page.json()["items"]], [str(first["_id"])])
        self.assertEqual(
            [item["analysis_type"] for item in filtered.json()["items"]], ["soil"]
        )
        self.assertEqual(
            [item["id"] for item in field_filtered.json()["items"]],
            [str(first["_id"])],
        )
        self.assertEqual(
            [item["id"] for item in farm_filtered.json()["items"]],
            [str(first["_id"])],
        )

    async def test_invalid_filters_and_object_ids_are_rejected(self):
        responses = [
            await self.client.get("/api/v1/analyses?analysis_type=weather"),
            await self.client.get("/api/v1/analyses?limit=101"),
            await self.client.get("/api/v1/analyses?limit=0"),
            await self.client.get("/api/v1/analyses?offset=-1"),
        ]
        malformed_id = await self.client.get("/api/v1/analyses/not-an-object-id")
        malformed_field = await self.client.get(
            "/api/v1/analyses?field_id=not-an-object-id"
        )
        malformed_farm = await self.client.get(
            "/api/v1/analyses?farm_id=not-an-object-id"
        )
        self.assertEqual([response.status_code for response in responses], [422] * 4)
        self.assertEqual(
            [malformed_id.status_code, malformed_field.status_code, malformed_farm.status_code], 
            [400, 400, 400]
        )

    async def test_server_inference_saves_actual_result_with_session_owner(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "History Farm"})
        ).json()
        field = (
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields",
                json={"name": "North Field"},
            )
        ).json()
        model_result = {
            "recommended_crop": "rice",
            "recommendations": [{"crop": "rice", "probability": 0.8}],
            "model_source": "catboost",
            "score_kind": "model_class_score",
            "tip": "Use local agronomic guidance.",
            "input_warnings": [],
        }

        class CropModel:
            def predict(self, **_):
                return model_result

        previous_model = main.crop_model_obj
        main.crop_model_obj = CropModel()
        try:
            with (
                patch.object(main.cache, "get", new=AsyncMock(return_value=None)),
                patch.object(main.cache, "set", new=AsyncMock()),
                patch.object(
                    analysis_history,
                    "get_current_user",
                    new=AsyncMock(return_value=self.user),
                ),
                patch.object(
                    analysis_history, "get_database", return_value=self.database
                ),
            ):
                response = await self.client.post(
                    f"/api/v1/recommend/crop?save_to_history=true&field_id={field['id']}",
                    json={
                        "N": 90,
                        "P": 42,
                        "K": 43,
                        "temperature": 20,
                        "humidity": 80,
                        "ph": 6.5,
                        "rainfall": 200,
                        "user_id": str(ObjectId()),
                        "result": {"forged": True},
                    },
                )
                public_response = await self.client.post(
                    "/api/v1/recommend/crop",
                    json={
                        "N": 90,
                        "P": 42,
                        "K": 43,
                        "temperature": 20,
                        "humidity": 80,
                        "ph": 6.5,
                        "rainfall": 200,
                    },
                )
        finally:
            main.crop_model_obj = previous_model

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(public_response.status_code, 200, public_response.text)
        self.assertIn("analysis_id", response.json())
        self.assertNotIn("analysis_id", public_response.json())
        self.assertEqual(
            public_response.json(), {**model_result, "cached": False}
        )
        self.assertEqual(response.json()["recommended_crop"], "rice")
        self.assertEqual(len(self.database["analyses"].documents), 1)
        stored = self.database["analyses"].documents[0]
        self.assertEqual(stored["user_id"], self.user.id)
        self.assertEqual(stored["field_id"], ObjectId(field["id"]))
        self.assertEqual(stored["analysis_type"], "crop")
        self.assertEqual(stored["result"]["recommended_crop"], "rice")
        self.assertNotIn("forged", stored["result"])
        model_result["recommended_crop"] = "changed later"
        self.assertEqual(stored["result"]["recommended_crop"], "rice")

    async def test_public_disease_and_soil_inference_responses_remain_compatible(self):
        disease_result = {
            "disease": "Tomato — Early blight",
            "confidence": 92.4,
            "is_healthy": False,
            "treatments": ["Remove infected leaves"],
            "top3": [{"label": "Tomato — Early blight", "confidence": 92.4}],
        }
        soil_result = {
            "soil_type": "Clay soil",
            "confidence": 86.0,
            "confidence_method": "softmax_score",
            "top_predictions": [{"label": "Clay soil", "confidence": 86.0}],
            "water_retention": "Often high",
            "drainage": "Can be slow",
            "fertility": "Varies by sample",
            "suitable_crops": ["Paddy", "Wheat"],
            "tips": ["Avoid working the soil when wet"],
            "all_classes": [{"label": "Clay soil", "confidence": 86.0}],
        }

        class Model:
            def __init__(self, result):
                self.result = result

            def predict(self, _):
                return self.result

        previous_disease, previous_soil = main.disease_model, main.soil_model
        main.disease_model, main.soil_model = Model(disease_result), Model(soil_result)
        try:
            with (
                patch.object(main, "preprocess_image", return_value=(object(), "disease-hash")),
                patch.object(
                    main, "preprocess_soil_image", return_value=(object(), "soil-hash")
                ),
                patch.object(main.cache, "get", new=AsyncMock(return_value=None)),
                patch.object(main.cache, "set", new=AsyncMock()),
            ):
                disease_response = await self.client.post(
                    "/api/v1/analyze/disease",
                    files={"file": ("leaf.jpg", b"leaf", "image/jpeg")},
                )
                soil_response = await self.client.post(
                    "/api/v1/analyze/soil",
                    files={"file": ("soil.jpg", b"soil", "image/jpeg")},
                )
        finally:
            main.disease_model, main.soil_model = previous_disease, previous_soil

        self.assertEqual(disease_response.status_code, 200, disease_response.text)
        self.assertEqual(soil_response.status_code, 200, soil_response.text)
        self.assertEqual(
            disease_response.json(),
            {**disease_result, "cached": False},
        )
        self.assertEqual(
            soil_response.json(),
            {**soil_result, "cached": False},
        )
        self.assertEqual(self.database["analyses"].documents, [])

    async def test_field_association_rejects_cross_owner_or_missing_parent(self):
        other_owner = str(ObjectId())
        field_id = ObjectId()
        self.database["fields"].documents.append(
            {
                "_id": field_id,
                "user_id": other_owner,
                "farm_id": ObjectId(),
            }
        )
        with (
            patch.object(
                analysis_history,
                "get_current_user",
                new=AsyncMock(return_value=self.user),
            ),
            patch.object(
                analysis_history, "get_database", return_value=self.database
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await save_inference_result(
                    make_request(),
                    AnalysisSaveOptions(save_to_history=True, field_id=str(field_id)),
                    "soil",
                    {"soil_type": "Clay soil"},
                )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.database["analyses"].documents, [])

    async def test_field_deletion_preserves_result_and_detaches_association(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Delete Farm"})
        ).json()
        field = (
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields", json={"name": "Delete Field"}
            )
        ).json()
        analysis = self.add_analysis(
            field_id=ObjectId(field["id"]),
            result={"soil_type": "Black Soil", "confidence": 86.2},
        )

        deleted = await self.client.delete(f"/api/v1/fields/{field['id']}")

        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(len(self.database["analyses"].documents), 1)
        self.assertEqual(analysis["result"]["soil_type"], "Black Soil")
        self.assertNotIn("field_id", analysis)
        self.assertNotIn("farm_id", analysis)

    async def test_farm_deletion_preserves_result_and_detaches_association(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Archive Farm"})
        ).json()
        field = (
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields", json={"name": "Archive Field"}
            )
        ).json()
        analysis = self.add_analysis(
            field_id=ObjectId(field["id"]),
            result={"disease": "Tomato — Healthy", "confidence": 99.1},
        )
        analysis["farm_id"] = ObjectId(farm["id"])

        deleted = await self.client.delete(f"/api/v1/farms/{farm['id']}")

        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(len(self.database["analyses"].documents), 1)
        self.assertEqual(analysis["result"]["disease"], "Tomato — Healthy")
        self.assertNotIn("field_id", analysis)
        self.assertNotIn("farm_id", analysis)

    async def test_farm_associated_analyses_appear_in_farm_and_field_history(self):
        """Test that analyses associated with a field are discoverable under that field and its farm."""
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Test Farm"})
        ).json()
        field = (
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields", json={"name": "Test Field"}
            )
        ).json()
        
        # Create an analysis associated with the field
        analysis = self.add_analysis(
            field_id=ObjectId(field["id"]),
            analysis_type="disease",
            result={"disease": "Tomato — Early blight", "confidence": 92.4},
        )
        analysis["farm_id"] = ObjectId(farm["id"])
        
        # Create an unrelated analysis
        self.add_analysis(
            analysis_type="soil",
            result={"soil_type": "Clay soil", "confidence": 86.0},
        )

        # Retrieve global history
        global_list = await self.client.get("/api/v1/analyses")
        self.assertEqual(global_list.status_code, 200)
        self.assertEqual(len(global_list.json()["items"]), 2)

        # Filter by field_id
        field_list = await self.client.get(f"/api/v1/analyses?field_id={field['id']}")
        self.assertEqual(field_list.status_code, 200)
        self.assertEqual(len(field_list.json()["items"]), 1)
        self.assertEqual(field_list.json()["items"][0]["id"], str(analysis["_id"]))

        # Filter by farm_id
        farm_list = await self.client.get(f"/api/v1/analyses?farm_id={farm['id']}")
        self.assertEqual(farm_list.status_code, 200)
        self.assertEqual(len(farm_list.json()["items"]), 1)
        self.assertEqual(farm_list.json()["items"][0]["id"], str(analysis["_id"]))

        # Verify cross-user isolation - other user's farm should not see this analysis
        other_user = AuthenticatedUser(
            id=str(ObjectId()), email="other@example.test", display_name="Other"
        )
        main.app.dependency_overrides[get_current_user] = lambda: other_user
        cross_user_list = await self.client.get(f"/api/v1/analyses?farm_id={farm['id']}")
        self.assertEqual(cross_user_list.status_code, 200)
        self.assertEqual(len(cross_user_list.json()["items"]), 0)
        
        # Restore original user
        main.app.dependency_overrides[get_current_user] = lambda: self.user

    async def test_history_detachment_failures_do_not_delete_farm_or_snapshot(self):
        farm = (
            await self.client.post("/api/v1/farms", json={"name": "Retry Archive"})
        ).json()
        field = (
            await self.client.post(
                f"/api/v1/farms/{farm['id']}/fields", json={"name": "Retry Field"}
            )
        ).json()
        analysis = self.add_analysis(
            field_id=ObjectId(field["id"]),
            result={"disease": "Tomato — Early blight"},
        )
        analysis["farm_id"] = ObjectId(farm["id"])
        self.database["analyses"].failure = PyMongoError("private db failure")

        failed = await self.client.delete(f"/api/v1/farms/{farm['id']}")

        self.assertEqual(failed.status_code, 503)
        self.assertEqual(len(self.database["fields"].documents), 1)
        self.assertEqual(analysis["result"]["disease"], "Tomato — Early blight")
        self.assertTrue(self.database["farms"].documents[0]["deleting"])

        self.database["analyses"].failure = None
        retried = await self.client.delete(f"/api/v1/farms/{farm['id']}")

        self.assertEqual(retried.status_code, 204)
        self.assertEqual(self.database["fields"].documents, [])
        self.assertEqual(self.database["analyses"].documents[0]["result"], analysis["result"])
        self.assertNotIn("field_id", analysis)
        self.assertNotIn("farm_id", analysis)

    async def test_analysis_indexes_are_idempotent_and_fail_on_conflicts(self):
        await initialize_analysis_indexes(self.database)
        before = self.database["analyses"].indexes.copy()
        await initialize_analysis_indexes(self.database)
        self.assertEqual(self.database["analyses"].indexes, before)
        self.assertEqual(len(before), len(ANALYSIS_INDEXES))
        self.assertTrue(
            all(
                self.database["analyses"].unique_indexes[name] is False
                for name, _ in ANALYSIS_INDEXES
            )
        )

        self.database["analyses"].indexes["analyses_user_created_id"] = [
            ("user_id", 1)
        ]
        with self.assertRaises(AnalysisIndexError):
            await initialize_analysis_indexes(self.database)

        self.database["analyses"].indexes["analyses_user_created_id"] = [
            keys for name, keys in ANALYSIS_INDEXES if name == "analyses_user_created_id"
        ][0]
        self.database["analyses"].indexes["conflicting_unique"] = [
            keys for name, keys in ANALYSIS_INDEXES if name == "analyses_user_created_id"
        ][0]
        self.database["analyses"].unique_indexes["conflicting_unique"] = True
        with self.assertRaises(AnalysisIndexError):
            await initialize_analysis_indexes(self.database)

    async def test_analysis_index_database_errors_are_surfaced(self):
        self.database["analyses"].failure = PyMongoError("private db detail")
        with self.assertRaises(AnalysisIndexError) as raised:
            await initialize_analysis_indexes(self.database)
        self.assertNotIn("private db detail", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
