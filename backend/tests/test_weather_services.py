import asyncio
import unittest
from datetime import date
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException

from backend import main as backend_main
from backend.models.crop_model import CROP_CENTROIDS
from backend.services import weather_service
from backend.services.weather_crop_service import recommend_weather_crops


def sample_weather():
    return {
        "date": "2026-10-12",
        "timezone": "Asia/Kolkata",
        "hourly": [
            {"temperature": 20.0, "humidity": 80.0},
            {"temperature": 22.0, "humidity": 84.0},
        ],
    }


class WeatherCropRecommendationTests(unittest.TestCase):
    def test_ranks_unique_profiles_by_temperature_and_humidity_similarity(self):
        result = recommend_weather_crops(sample_weather())

        self.assertEqual(result["status"], "available")
        self.assertEqual(result["forecast_date"], "2026-10-12")
        self.assertEqual(result["timezone"], "Asia/Kolkata")
        self.assertEqual(result["forecast_averages"], {
            "temperature_c": 21.0,
            "humidity_pct": 82.0,
        })
        self.assertEqual(len(result["suggestions"]), 5)
        self.assertEqual(
            len({item["crop"].casefold() for item in result["suggestions"]}), 5
        )
        self.assertEqual(result["suggestions"][0]["crop"], "pomegranate")
        self.assertEqual(
            result["suggestions"][0]["comparisons"][0]["unit"], "°C"
        )
        self.assertEqual(
            result["suggestions"][0]["comparisons"][1]["unit"], "%"
        )
        self.assertEqual(result["score_kind"], "stored_crop_profile_similarity")
        self.assertEqual(
            result["excluded_variables"],
            ["precipitation: the training data's rainfall period is undocumented"],
        )
        self.assertIn("soil_note", result)
        self.assertNotIn("N", result)
        self.assertNotIn("P", result)
        self.assertNotIn("K", result)
        self.assertNotIn("ph", result)

    def test_missing_or_nonfinite_weather_inputs_return_no_fabricated_results(self):
        for weather in (
            {"date": "2026-10-12", "timezone": "UTC", "hourly": []},
            {
                **sample_weather(),
                "hourly": [{"temperature": 22}],
            },
            {
                **sample_weather(),
                "hourly": [{"temperature": float("nan"), "humidity": 75}],
            },
        ):
            with self.subTest(weather=weather):
                result = recommend_weather_crops(weather)
                self.assertEqual(result["status"], "insufficient_data")
                self.assertEqual(result["suggestions"], [])
                self.assertTrue(result["missing_variables"])

    def test_empty_profiles_produce_insufficient_data(self):
        with patch("backend.services.weather_crop_service.CROP_CENTROIDS", {}):
            result = recommend_weather_crops(sample_weather())

        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["suggestions"], [])
        self.assertIn("No stored crop profiles", result["message"])

    def test_nearest_stored_profile_is_ranked_first(self):
        rice_profile = CROP_CENTROIDS["rice"]
        weather = {
            "date": "2026-10-12",
            "timezone": "Asia/Kolkata",
            "hourly": [
                {"temperature": rice_profile[3], "humidity": rice_profile[4]}
            ],
        }

        result = recommend_weather_crops(weather)
        self.assertEqual(result["suggestions"][0]["crop"], "rice")
        self.assertEqual(result["suggestions"][0]["score"], 100.0)


class WeatherServiceTests(unittest.TestCase):
    def test_validates_coordinates_and_timezone(self):
        async def run_invalid():
            with self.assertRaisesRegex(weather_service.WeatherServiceError, "Latitude"):
                await weather_service.get_weather(
                    float("nan"), 0, date(2026, 10, 12)
                )
            with self.assertRaisesRegex(weather_service.WeatherServiceError, "Longitude"):
                await weather_service.get_weather(
                    0, 181, date(2026, 10, 12)
                )
            with self.assertRaisesRegex(weather_service.WeatherServiceError, "Timezone"):
                await weather_service.get_weather(
                    0, 0, date(2026, 10, 12), "Not/A_Timezone"
                )

        asyncio.run(run_invalid())

    def test_request_uses_selected_date_timezone_and_explicit_units(self):
        provider_payload = {
            "latitude": 21.0,
            "longitude": 81.0,
            "timezone": "Asia/Kolkata",
            "hourly": {"time": [], "temperature_2m": [], "relative_humidity_2m": []},
            "daily": {
                "temperature_2m_max": [30],
                "temperature_2m_min": [20],
                "precipitation_sum": [5],
                "precipitation_probability_max": [70],
                "sunrise": ["2026-10-12T06:00"],
                "sunset": ["2026-10-12T18:00"],
                "weather_code": [61],
            },
        }

        with patch.object(weather_service, "_fetch_json", return_value=provider_payload) as fetch:
            result = asyncio.run(
                weather_service.get_weather(
                    21, 81, date(2026, 10, 12), "Asia/Kolkata"
                )
            )

        params = parse_qs(urlparse(fetch.call_args.args[0]).query)
        self.assertEqual(params["start_date"], ["2026-10-12"])
        self.assertEqual(params["end_date"], ["2026-10-12"])
        self.assertEqual(params["timezone"], ["Asia/Kolkata"])
        self.assertEqual(params["temperature_unit"], ["celsius"])
        self.assertEqual(params["wind_speed_unit"], ["kmh"])
        self.assertEqual(params["precipitation_unit"], ["mm"])
        self.assertEqual(result["date"], "2026-10-12")
        self.assertEqual(result["timezone"], "Asia/Kolkata")

    def test_missing_provider_values_are_omitted_not_fabricated(self):
        provider_payload = {
            "latitude": 21,
            "longitude": 81,
            "timezone": "Asia/Kolkata",
            "hourly": {
                "time": ["2026-10-12T00:00"],
                "temperature_2m": [25],
                "relative_humidity_2m": [None],
            },
            "daily": {
                "temperature_2m_max": [None],
                "weather_code": [0],
            },
        }
        with patch.object(weather_service, "_fetch_json", return_value=provider_payload):
            result = asyncio.run(
                weather_service.get_weather(21, 81, date(2026, 10, 12))
            )

        self.assertNotIn("temperature_max", result)
        self.assertNotIn("temperature_min", result)
        self.assertIn("temperature", result["hourly"][0])
        self.assertNotIn("humidity", result["hourly"][0])

    def test_provider_rate_limit_is_reported_as_weather_service_error(self):
        error = HTTPError(
            "https://api.open-meteo.com/v1/forecast",
            429,
            "Too Many Requests",
            None,
            None,
        )
        with patch.object(weather_service, "urlopen", side_effect=error):
            with self.assertRaisesRegex(
                weather_service.WeatherServiceError, "HTTP 429"
            ):
                weather_service._fetch_json("https://api.open-meteo.com/v1/forecast")

    def test_weather_endpoint_adds_recommendations_without_removing_legacy_fields(self):
        async def cache_miss(_key):
            return None

        async def cache_set(_key, _value, ttl):
            self.assertEqual(ttl, 300)

        provider_result = {
            "date": "2026-10-12",
            "timezone": "Asia/Kolkata",
            "latitude": 21.0,
            "longitude": 81.0,
            "hourly": sample_weather()["hourly"],
            "condition": "Clear sky",
        }
        with (
            patch.object(backend_main.cache, "get", side_effect=cache_miss),
            patch.object(backend_main.cache, "set", side_effect=cache_set),
            patch.object(backend_main, "get_weather", return_value=provider_result),
        ):
            result = asyncio.run(
                backend_main.weather_forecast(
                    21, 81, date(2026, 10, 12), "Asia/Kolkata"
                )
            )

        self.assertEqual(result["condition"], "Clear sky")
        self.assertEqual(result["date"], "2026-10-12")
        self.assertEqual(
            result["crop_recommendations"]["status"], "available"
        )

    def test_weather_endpoint_translates_provider_errors_to_502(self):
        async def cache_miss(_key):
            return None

        with (
            patch.object(backend_main.cache, "get", side_effect=cache_miss),
            patch.object(
                backend_main,
                "get_weather",
                side_effect=weather_service.WeatherServiceError("HTTP 429"),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(
                    backend_main.weather_forecast(
                        21, 81, date(2026, 10, 12), "auto"
                    )
                )

        self.assertEqual(raised.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
