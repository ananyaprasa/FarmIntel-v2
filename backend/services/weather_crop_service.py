"""Weather-only comparisons with stored crop-model profile values.

The derivation of the stored centroids is undocumented, and they are not
verified agronomic requirements. This service compares forecast averages with
only their temperature and humidity values and never calls the soil model.
"""

from __future__ import annotations

import math
from typing import Any

try:
    from models.crop_model import CROP_CENTROIDS, FEATURE_STDS
except ImportError:
    from backend.models.crop_model import CROP_CENTROIDS, FEATURE_STDS


WEATHER_PROFILE_FIELDS = (
    ("temperature", 3, FEATURE_STDS[3], "°C"),
    ("humidity", 4, FEATURE_STDS[4], "%"),
)


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _hourly_means(hourly: Any) -> dict[str, float]:
    if not isinstance(hourly, list):
        return {}

    samples: dict[str, list[float]] = {name: [] for name, *_ in WEATHER_PROFILE_FIELDS}
    for item in hourly:
        if not isinstance(item, dict):
            continue
        for name, *_ in WEATHER_PROFILE_FIELDS:
            value = _finite_number(item.get(name))
            if value is not None:
                samples[name].append(value)

    return {
        name: sum(values) / len(values)
        for name, values in samples.items()
        if values
    }


def recommend_weather_crops(weather: dict[str, Any]) -> dict[str, Any]:
    """Rank crops by closeness to stored temperature/humidity data profiles."""
    means = _hourly_means(weather.get("hourly"))
    profiles_available = bool(CROP_CENTROIDS)
    missing = [
        name for name, *_ in WEATHER_PROFILE_FIELDS if name not in means
    ]
    result: dict[str, Any] = {
        "status": "insufficient_data" if missing or not profiles_available else "available",
        "method": "stored_crop_profile_similarity",
        "forecast_date": weather.get("date"),
        "timezone": weather.get("timezone"),
        "score_kind": "stored_crop_profile_similarity",
        "score_note": (
            "A comparison with stored crop-model centroid values whose derivation "
            "is undocumented; not verified crop requirements, an agronomic "
            "suitability rating, or a probability of crop success."
        ),
        "soil_note": (
            "Soil nutrients, pH, and other field conditions are not included; "
            "use Crop Suggestion for a separate soil-and-climate model result."
        ),
        "missing_variables": missing,
        "excluded_variables": [
            "precipitation: the training data's rainfall period is undocumented"
        ],
        "forecast_averages": {
            "temperature_c": round(means["temperature"], 2)
            if "temperature" in means
            else None,
            "humidity_pct": round(means["humidity"], 2)
            if "humidity" in means
            else None,
        },
        "suggestions": [],
    }

    if missing or not profiles_available:
        result["message"] = (
            "Temperature and humidity forecast data are required to compare "
            "the available crop profiles."
            if missing
            else "No stored crop profiles are available for comparison."
        )
        return result

    ranked: list[dict[str, Any]] = []
    for crop, profile in CROP_CENTROIDS.items():
        squared_distance = 0.0
        comparisons = []
        for name, index, standard_deviation, unit in WEATHER_PROFILE_FIELDS:
            forecast_value = means[name]
            profile_value = float(profile[index])
            delta = forecast_value - profile_value
            normalized_delta = delta / standard_deviation
            squared_distance += normalized_delta**2
            comparisons.append(
                {
                    "factor": name,
                    "forecast_average": round(forecast_value, 2),
                    "profile_average": round(profile_value, 2),
                    "difference": round(delta, 2),
                    "unit": unit,
                }
            )

        score = 100.0 / (1.0 + math.sqrt(squared_distance))
        ranked.append(
            {
                "crop": crop,
                "score": round(score, 2),
                "comparisons": comparisons,
            }
        )

    ranked.sort(key=lambda item: (-item["score"], item["crop"]))
    result["suggestions"] = ranked[:5]
    return result
