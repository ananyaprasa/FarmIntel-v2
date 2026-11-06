"""
Weather service for FarmIntel.

Uses the Open-Meteo Forecast API to retrieve hourly and daily weather data
for a latitude/longitude and a selected date.

No API key is required for the basic Open-Meteo endpoint.
"""

from __future__ import annotations

import asyncio
import json
import math
from datetime import date
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


class WeatherServiceError(Exception):
    """Raised when the external weather provider cannot return usable data."""


def _weather_condition(code: int) -> str:
    """Convert Open-Meteo/WMO weather code to a human-readable condition."""
    conditions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return conditions.get(code, "Unknown")


def _fetch_json(url: str) -> dict[str, Any]:
    """Perform a blocking JSON request; called in a worker thread."""
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FarmIntel/1.0",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:
        raise WeatherServiceError(
            f"Weather provider returned HTTP {exc.code}."
        ) from exc
    except URLError as exc:
        raise WeatherServiceError(
            f"Could not reach weather provider: {exc.reason}."
        ) from exc
    except TimeoutError as exc:
        raise WeatherServiceError("Weather provider request timed out.") from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise WeatherServiceError(
            "Weather provider returned invalid JSON."
        ) from exc

    if not isinstance(data, dict):
        raise WeatherServiceError("Weather provider returned an invalid response.")

    if "error" in data and data["error"]:
        raise WeatherServiceError(
            str(data.get("reason") or "Weather provider returned an error.")
        )

    return data


async def get_weather(
    latitude: float,
    longitude: float,
    selected_date: date,
    timezone: str = "auto",
) -> dict[str, Any]:
    """
    Get weather for one selected date.

    The forecast endpoint supports a forecast window rather than arbitrary
    future dates. We request only the selected date so the response stays small.
    """
    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise WeatherServiceError("Latitude must be between -90 and 90.")

    if not math.isfinite(longitude) or not -180 <= longitude <= 180:
        raise WeatherServiceError("Longitude must be between -180 and 180.")

    if timezone != "auto":
        try:
            ZoneInfo(timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise WeatherServiceError("Timezone must be 'auto' or a valid IANA timezone.") from exc

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": (
            "temperature_2m,"
            "apparent_temperature,"
            "relative_humidity_2m,"
            "precipitation_probability,"
            "precipitation,"
            "wind_speed_10m,"
            "weather_code,"
            "is_day"
        ),
        "daily": (
            "weather_code,"
            "temperature_2m_max,"
            "temperature_2m_min,"
            "precipitation_sum,"
            "precipitation_probability_max,"
            "sunrise,"
            "sunset"
        ),
        "start_date": selected_date.isoformat(),
        "end_date": selected_date.isoformat(),
        "timezone": timezone,
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }

    query_url = f"{OPEN_METEO_URL}?{urlencode(params)}"

    data = await asyncio.to_thread(_fetch_json, query_url)

    hourly = data.get("hourly")
    daily = data.get("daily")
    if not isinstance(hourly, dict):
        hourly = {}
    if not isinstance(daily, dict):
        daily = {}

    times = hourly.get("time", [])
    temperatures = hourly.get("temperature_2m", [])
    feels_like = hourly.get("apparent_temperature", [])
    humidity = hourly.get("relative_humidity_2m", [])
    rain_probability = hourly.get("precipitation_probability", [])
    precipitation = hourly.get("precipitation", [])
    wind_speed = hourly.get("wind_speed_10m", [])
    weather_codes = hourly.get("weather_code", [])
    is_day = hourly.get("is_day", [])

    if not isinstance(times, list):
        times = []

    hourly_items = []

    for i, timestamp in enumerate(times):
        if not isinstance(timestamp, str):
            continue
        item: dict[str, Any] = {"time": timestamp}
        numeric_fields = {
            "temperature": temperatures,
            "feels_like": feels_like,
            "humidity": humidity,
            "precipitation_probability": rain_probability,
            "precipitation": precipitation,
            "wind_speed": wind_speed,
        }
        for field, values in numeric_fields.items():
            if isinstance(values, list) and i < len(values):
                try:
                    value = float(values[i])
                except (TypeError, ValueError):
                    continue
                if math.isfinite(value):
                    item[field] = value
        try:
            if isinstance(weather_codes, list) and i < len(weather_codes):
                code = int(weather_codes[i])
                item["weather_code"] = code
                item["condition"] = _weather_condition(code)
        except (TypeError, ValueError):
            pass
        if isinstance(is_day, list) and i < len(is_day):
            item["is_day"] = bool(is_day[i])
        hourly_items.append(item)

    def daily_value(name: str, index: int = 0) -> Any | None:
        values = daily.get(name, [])
        if not isinstance(values, list) or len(values) <= index:
            return None
        return values[index]

    result: dict[str, Any] = {
        "latitude": float(data.get("latitude", latitude)),
        "longitude": float(data.get("longitude", longitude)),
        "date": selected_date.isoformat(),
        "timezone": str(data.get("timezone", timezone)),
        "hourly": hourly_items,
    }
    daily_fields = {
        "temperature_max": ("temperature_2m_max", float),
        "temperature_min": ("temperature_2m_min", float),
        "precipitation_sum": ("precipitation_sum", float),
        "precipitation_probability_max": ("precipitation_probability_max", float),
        "sunrise": ("sunrise", str),
        "sunset": ("sunset", str),
    }
    for output_name, (source_name, converter) in daily_fields.items():
        value = daily_value(source_name)
        if value is None:
            continue
        try:
            converted = converter(value)
        except (TypeError, ValueError):
            continue
        if not isinstance(converted, float) or math.isfinite(converted):
            result[output_name] = converted

    daily_code = daily_value("weather_code")
    if daily_code is not None:
        try:
            code = int(daily_code)
        except (TypeError, ValueError):
            pass
        else:
            result["weather_code"] = code
            result["condition"] = _weather_condition(code)

    return result
