import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException, Request
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from backend import main
from backend.analysis_history import AnalysisIndexError
from backend.database import MongoDBError, MongoDatabase, get_database
from backend.farms import FarmIndexError, get_farms_database


def make_request(path="/api/v1/health"):
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [],
            "query_string": b"",
            "app": main.app,
        }
    )


class MongoDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_route_aliases_preserve_response_contract(self):
        health_routes = {
            route.path: route.endpoint
            for route in main.app.routes
            if hasattr(route, "path")
        }
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        main.app.state.mongo_database = MongoDatabase(client, "farmintel")
        main.app.state.mongo_error = None

        for path in ("/health", "/api/v1/health"):
            with self.subTest(path=path):
                self.assertIs(health_routes[path], main.health_check)
                response = await health_routes[path](make_request(path))
                self.assertEqual(response["status"], "healthy")
                self.assertEqual(response["application_status"], "running")
                self.assertEqual(
                    response["mongodb"],
                    {"status": "connected", "error": None},
                )
                self.assertEqual(response["version"], "1.0.0")
                self.assertIn("models_loaded", response)
                self.assertIn("models_status", response)
                self.assertIn("redis_connected", response)
                self.assertNotIn("debug_openai_key", response)
                self.assertNotIn("debug_openai_base_url", response)

    def test_requires_uri_and_database_name(self):
        for settings, expected_message in (
            ({"MONGODB_DATABASE": "farmintel"}, "MONGODB_URI is required."),
            ({"MONGODB_URI": "mongodb://localhost"}, "MONGODB_DATABASE is required."),
        ):
            with self.subTest(settings=settings):
                with self.assertRaises(MongoDBError) as raised:
                    MongoDatabase.from_env(settings)
                self.assertEqual(raised.exception.code, "not_configured")
                self.assertEqual(str(raised.exception), expected_message)

    def test_invalid_uri_error_does_not_expose_uri(self):
        for invalid_uri in ("not-a-mongodb-uri", "mongodb://"):
            with self.subTest(invalid_uri=invalid_uri):
                with self.assertRaises(MongoDBError) as raised:
                    MongoDatabase.from_env(
                        {
                            "MONGODB_URI": invalid_uri,
                            "MONGODB_DATABASE": "farmintel",
                        }
                    )

                self.assertEqual(raised.exception.code, "invalid_configuration")
                self.assertNotIn(invalid_uri, str(raised.exception))

    async def test_selects_configured_database_and_pings(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        client.get_database.return_value.name = "farmintel"

        with patch("backend.database.AsyncMongoClient", return_value=client) as factory:
            database = MongoDatabase.from_env(
                {
                    "MONGODB_URI": "mongodb://example.test",
                    "MONGODB_DATABASE": "farmintel",
                }
            )

        self.assertEqual(database.database.name, "farmintel")
        factory.assert_called_once()
        self.assertEqual(
            factory.call_args.kwargs,
            {
                "serverSelectionTimeoutMS": 5000,
                "connectTimeoutMS": 5000,
                "socketTimeoutMS": 5000,
                "timeoutMS": 5000,
            },
        )
        await database.ping()
        client.admin.command.assert_awaited_once_with("ping")

    async def test_ping_sanitizes_network_and_authentication_failures(self):
        for failure, code, message in (
            (
                ServerSelectionTimeoutError("redacted-marker: network unavailable"),
                "server_selection_timeout",
                "Atlas network access",
            ),
            (
                OperationFailure("redacted-marker rejected", code=18),
                "authentication_failed",
                "authentication failed",
            ),
        ):
            with self.subTest(code=code):
                client = MagicMock()
                client.admin.command = AsyncMock(side_effect=failure)
                database = MongoDatabase(client, "farmintel")

                with self.assertRaises(MongoDBError) as raised:
                    await database.ping()

                self.assertEqual(raised.exception.code, code)
                self.assertIn(message, str(raised.exception))
                self.assertNotIn("redacted-marker", str(raised.exception))

    async def test_close_closes_async_client(self):
        client = MagicMock()
        client.close = AsyncMock()
        database = MongoDatabase(client, "farmintel")

        await database.close()

        client.close.assert_awaited_once()

    async def test_fastapi_database_dependency_returns_selected_database(self):
        client = MagicMock()
        database = MongoDatabase(client, "farmintel")
        main.app.state.mongo_database = database

        self.assertIs(get_database(make_request()), database.database)

    async def test_health_reports_live_ping_and_sanitized_failure(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        database = MongoDatabase(client, "farmintel")
        main.app.state.mongo_database = database
        main.app.state.mongo_error = None

        healthy = await main.health_check(make_request())
        self.assertEqual(healthy["status"], "healthy")
        self.assertEqual(healthy["application_status"], "running")
        self.assertEqual(
            healthy["mongodb"], {"status": "connected", "error": None}
        )
        self.assertEqual(healthy["version"], "1.0.0")
        self.assertIn("models_loaded", healthy)
        self.assertIn("models_status", healthy)
        self.assertIn("redis_connected", healthy)
        self.assertNotIn("debug_openai_key", healthy)
        self.assertNotIn("debug_openai_base_url", healthy)

        client.admin.command.side_effect = ServerSelectionTimeoutError(
            "redacted-marker"
        )
        disconnected = await main.health_check(make_request())
        self.assertEqual(disconnected["status"], "healthy")
        self.assertEqual(disconnected["application_status"], "running")
        self.assertEqual(
            disconnected["mongodb"]["status"], "disconnected"
        )
        self.assertEqual(
            disconnected["mongodb"]["error"]["code"],
            "server_selection_timeout",
        )
        self.assertNotIn("redacted-marker", str(disconnected))
        self.assertNotIn("debug_openai_key", disconnected)
        self.assertNotIn("debug_openai_base_url", disconnected)

    async def test_health_reports_missing_configuration(self):
        main.app.state.mongo_database = None
        main.app.state.mongo_error = MongoDBError(
            "not_configured", "MONGODB_URI is required."
        )

        health = await main.health_check(make_request())

        self.assertEqual(health["application_status"], "running")
        self.assertEqual(health["mongodb"]["status"], "not_configured")
        self.assertEqual(
            health["mongodb"]["error"]["message"], "MONGODB_URI is required."
        )

    async def test_application_lifespan_closes_mongodb_client(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        client.close = AsyncMock()
        client.get_database.return_value.name = "farmintel"
        database = MongoDatabase(client, "farmintel")

        class Model:
            model = object()

            def load(self):
                return None

        model = Model()
        with (
            patch.object(main.MongoDatabase, "from_env", return_value=database),
            patch.object(main, "WebSearchService"),
            patch.object(main, "DiseaseModel", return_value=model),
            patch.object(main, "SoilModel", return_value=model),
            patch.object(main, "CropModel", return_value=model),
            patch.object(main, "RAGService"),
            patch.object(main, "_get_llm_api_key", return_value=""),
            patch.object(main.cache, "connect", new=AsyncMock()),
            patch.object(main.cache, "close", new=AsyncMock()),
            patch.object(main, "initialize_farm_indexes", new=AsyncMock()),
            patch.object(main, "initialize_analysis_indexes", new=AsyncMock()),
        ):
            async with main.lifespan(main.app):
                self.assertIs(main.app.state.mongo_database, database)
                self.assertEqual(
                    main.app.state.mongo_database.database.name, "farmintel"
                )

        client.close.assert_awaited_once()

    async def test_index_failure_keeps_farm_endpoints_unavailable(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        client.close = AsyncMock()
        client.get_database.return_value.name = "farmintel"
        database = MongoDatabase(client, "farmintel")

        class Model:
            model = object()

            def load(self):
                return None

        model = Model()
        with (
            patch.object(main.MongoDatabase, "from_env", return_value=database),
            patch.object(main, "WebSearchService"),
            patch.object(main, "DiseaseModel", return_value=model),
            patch.object(main, "SoilModel", return_value=model),
            patch.object(main, "CropModel", return_value=model),
            patch.object(main, "RAGService"),
            patch.object(main, "_get_llm_api_key", return_value=""),
            patch.object(main.cache, "connect", new=AsyncMock()),
            patch.object(main.cache, "close", new=AsyncMock()),
            patch.object(
                main,
                "initialize_farm_indexes",
                new=AsyncMock(side_effect=FarmIndexError("index failure")),
            ),
            patch.object(main, "initialize_analysis_indexes", new=AsyncMock()),
        ):
            async with main.lifespan(main.app):
                self.assertTrue(main.app.state.farm_indexes_unavailable)
                self.assertIsNone(main.app.state.mongo_error)
                with self.assertRaises(HTTPException) as raised:
                    get_farms_database(make_request())
                self.assertEqual(raised.exception.status_code, 503)

    async def test_analysis_index_failure_disables_history_only(self):
        client = MagicMock()
        client.admin.command = AsyncMock(return_value={"ok": 1})
        client.close = AsyncMock()
        client.get_database.return_value.name = "farmintel"
        database = MongoDatabase(client, "farmintel")

        class Model:
            model = object()

            def load(self):
                return None

        model = Model()
        with (
            patch.object(main.MongoDatabase, "from_env", return_value=database),
            patch.object(main, "WebSearchService"),
            patch.object(main, "DiseaseModel", return_value=model),
            patch.object(main, "SoilModel", return_value=model),
            patch.object(main, "CropModel", return_value=model),
            patch.object(main, "RAGService"),
            patch.object(main, "_get_llm_api_key", return_value=""),
            patch.object(main.cache, "connect", new=AsyncMock()),
            patch.object(main.cache, "close", new=AsyncMock()),
            patch.object(main, "initialize_farm_indexes", new=AsyncMock()),
            patch.object(
                main,
                "initialize_analysis_indexes",
                new=AsyncMock(side_effect=AnalysisIndexError("index failure")),
            ),
        ):
            async with main.lifespan(main.app):
                self.assertFalse(main.app.state.farm_indexes_unavailable)
                self.assertTrue(main.app.state.analysis_indexes_unavailable)

        client.close.assert_awaited_once()

    async def test_application_lifespan_stays_available_without_mongodb_config(self):
        class Model:
            model = object()

            def load(self):
                return None

        missing_config = MongoDBError("not_configured", "MONGODB_URI is required.")
        model = Model()
        with (
            patch.object(
                main.MongoDatabase, "from_env", side_effect=missing_config
            ),
            patch.object(main, "WebSearchService"),
            patch.object(main, "DiseaseModel", return_value=model),
            patch.object(main, "SoilModel", return_value=model),
            patch.object(main, "CropModel", return_value=model),
            patch.object(main, "RAGService"),
            patch.object(main, "_get_llm_api_key", return_value=""),
            patch.object(main.cache, "connect", new=AsyncMock()),
            patch.object(main.cache, "close", new=AsyncMock()),
        ):
            async with main.lifespan(main.app):
                self.assertIsNone(main.app.state.mongo_database)
                self.assertEqual(main.app.state.mongo_error.code, "not_configured")
                health = await main.health_check(make_request())

        self.assertEqual(health["application_status"], "running")
        self.assertEqual(health["mongodb"]["status"], "not_configured")


if __name__ == "__main__":
    unittest.main()
