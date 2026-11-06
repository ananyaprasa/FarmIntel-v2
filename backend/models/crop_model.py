"""
Crop recommendation model wrapper (CatBoost + LabelEncoder + Centroid Fallback).

Input features (7):  N, P, K, temperature, humidity, ph, rainfall
These match the standard Kaggle crop-recommendation dataset.
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Feature order must match training
FEATURE_NAMES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

# Feature validation ranges (soft-warn, not hard-reject)
FEATURE_RANGES = {
    "N":           (0,   200),
    "P":           (0,   200),
    "K":           (0,   200),
    "temperature": (0,    50),
    "humidity":    (0,   100),
    "ph":          (0,    14),
    "rainfall":    (0,  3000),
}

# Stored numeric profiles used by the existing centroid fallback.
CROP_CENTROIDS: dict[str, list[float]] = {
    "rice":        [79.9,  47.6,  39.9, 23.7, 82.3, 6.4, 236.2],
    "maize":       [77.8,  48.4,  19.8, 22.4, 65.1, 6.2,  84.8],
    "chickpea":    [40.1,  67.8,  79.9, 18.9, 16.9, 7.3,  80.1],
    "kidneybeans": [20.8,  67.5,  20.1, 20.1, 21.6, 5.7, 105.9],
    "pigeonpeas":  [20.7,  67.7,  20.3, 27.7, 48.1, 5.8, 149.4],
    "mothbeans":   [21.4,  48.0,  20.2, 28.2, 53.2, 6.8,  51.2],
    "mungbean":    [20.9,  47.3,  19.9, 28.5, 85.5, 6.7,  48.4],
    "blackgram":   [40.0,  67.5,  19.2, 29.9, 65.1, 7.1,  67.8],
    "lentil":      [18.8,  68.4,  19.4, 24.5, 64.8, 6.9,  45.7],
    "pomegranate": [18.8,  18.8,  40.2, 21.8, 90.1, 6.4, 107.5],
    "banana":      [100.2, 82.0,  50.1, 27.4, 80.4, 6.0, 104.6],
    "mango":       [20.1,  27.2,  29.9, 31.2, 50.2, 5.8,  94.7],
    "grapes":      [23.2, 132.5, 200.1, 23.8, 81.9, 6.0,  69.6],
    "watermelon":  [99.4,  17.0,  50.2, 25.5, 85.2, 6.5,  50.8],
    "muskmelon":   [100.3, 17.7,  50.1, 28.6, 92.3, 6.4,  24.7],
    "apple":       [20.8, 134.2, 199.9, 22.6, 92.3, 5.9, 112.7],
    "orange":      [19.6,  15.7,  10.0, 22.8, 92.1, 7.0, 110.5],
    "papaya":      [49.8,  59.1,  50.0, 33.7, 92.4, 6.7, 142.6],
    "coconut":     [21.9,  16.9,  30.6, 27.4, 94.8, 6.0, 175.7],
    "cotton":      [117.8, 46.2,  19.6, 23.9, 79.8, 6.9,  80.4],
    "jute":        [78.4,  46.8,  39.9, 24.9, 79.6, 6.7, 174.3],
    "coffee":      [101.2, 28.7,  29.9, 25.5, 57.7, 6.8, 158.1],
}

FEATURE_STDS = [36.9, 33.0, 50.6, 5.0, 22.3, 0.77, 54.6]

# Human-readable growing tips per crop
CROP_TIPS: dict[str, str] = {
    "rice":         "Requires flooded or waterlogged soil. Plant in warm, humid conditions.",
    "maize":        "Needs well-drained loamy soil and moderate rainfall.",
    "chickpea":     "Thrives in cool, dry climates. Avoid waterlogging.",
    "kidneybeans":  "Prefers well-drained soil and moderate temperature.",
    "pigeonpeas":   "Drought-tolerant. Suitable for semi-arid regions.",
    "mothbeans":    "Very drought-resistant, ideal for arid zones.",
    "mungbean":     "Short-duration crop, tolerates heat and drought.",
    "blackgram":    "Grows well in warm, humid conditions with good drainage.",
    "lentil":       "Cool-season crop, tolerates frost, needs dry conditions at harvest.",
    "pomegranate":  "Drought-tolerant, prefers dry climate with hot summers.",
    "banana":       "Requires rich, well-drained soil and high humidity.",
    "mango":        "Thrives in tropical/subtropical climate with a dry season.",
    "grapes":       "Prefers well-drained, loamy-sandy soil with good sunlight.",
    "watermelon":   "Needs sandy loam, warm temperatures, and low humidity.",
    "muskmelon":    "Prefers warm, dry climate and well-drained sandy loam.",
    "apple":        "Requires cold winters for dormancy and well-drained loamy soil.",
    "orange":       "Subtropical fruit, requires warm temperatures and moderate rainfall.",
    "papaya":       "Grows in tropical climates, needs well-drained soil.",
    "coconut":      "Thrives near coastal areas with high humidity.",
    "cotton":       "Requires warm temperatures, moderate rainfall, and deep soil.",
    "jute":         "Needs warm, humid climate and alluvial or loamy soil.",
    "coffee":       "Prefers shaded, humid highlands with well-drained soil.",
}


class CentroidCropModel:
    def predict(self, features: np.ndarray):
        vec = features[0]
        stds = np.array(FEATURE_STDS, dtype=np.float32)
        scores = {}
        for crop, center in CROP_CENTROIDS.items():
            c_arr = np.array(center, dtype=np.float32)
            dist = np.sqrt(np.sum(((vec - c_arr) / stds) ** 2))
            scores[crop] = float(1.0 / (1.0 + dist))

        if not scores:
            raise RuntimeError("No crop profiles are configured for fallback recommendations.")

        total = sum(scores.values())
        sorted_crops = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_crop = sorted_crops[0][0]
        return top_crop, [(c, round((s / total) * 100, 2)) for c, s in sorted_crops[:5]]


class CropModel:
    def __init__(self, model_path: str, label_encoder_path: str):
        self.model_path         = Path(model_path)
        self.label_encoder_path = Path(label_encoder_path)
        self.model          = None
        self.label_encoder  = None

    def load(self):
        try:
            if self.model_path.exists() and self.label_encoder_path.exists():
                logger.info("Loading crop model from %s …", self.model_path)
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                with open(self.label_encoder_path, "rb") as f:
                    self.label_encoder = pickle.load(f)
                logger.info("Crop model ready. Classes: %s", list(self.label_encoder.classes_))
                return
        except Exception as e:
            logger.warning("CatBoost model load failed (%s). Falling back to Centroid Crop Model.", e)

        logger.info("Using Centroid Crop Model for lightweight inference.")
        self.model = CentroidCropModel()
        self.label_encoder = None

    def predict(self, n: float, p: float, k: float,
                temperature: float, humidity: float,
                ph: float, rainfall: float) -> dict:
        if self.model is None:
            raise RuntimeError("Crop model not loaded. Call load() first.")

        values = [n, p, k, temperature, humidity, ph, rainfall]
        if not np.isfinite(values).all():
            raise ValueError("Crop inputs must all be finite numbers.")

        features = np.array([values], dtype=np.float32)

        warnings = []
        vals = dict(zip(FEATURE_NAMES, values))
        for feat, (lo, hi) in FEATURE_RANGES.items():
            v = vals[feat]
            if not (lo <= v <= hi):
                warnings.append(f"{feat}={v} is outside typical range [{lo}, {hi}]")

        if isinstance(self.model, CentroidCropModel):
            crop_name, recs = self.model.predict(features)
            recommendations = [{"crop": c, "probability": prob} for c, prob in recs]
            model_source = "centroid_fallback"
            score_kind = "profile_similarity_share"
        elif self.label_encoder is not None:
            pred_encoded = self.model.predict(features)
            pred_val     = int(np.asarray(pred_encoded).ravel()[0])
            crop_name    = self.label_encoder.inverse_transform([pred_val])[0]

            recommendations = []
            if hasattr(self.model, "predict_proba"):
                proba = self.model.predict_proba(features)[0]
                top_n = min(5, len(proba))
                top_idx  = np.argsort(proba)[::-1][:top_n]
                top_prob = proba[top_idx]
                classes  = self.label_encoder.inverse_transform(top_idx)
                recommendations = [
                    {"crop": c, "probability": round(float(p) * 100, 2)}
                    for c, p in zip(classes, top_prob)
                ]
            else:
                recommendations = [{"crop": crop_name, "probability": 100.0}]
            model_source = "catboost"
            score_kind = "model_class_score"
        else:
            raise RuntimeError(
                "Crop model has no usable label encoder; reload it to activate the fallback."
            )

        unique_recommendations = []
        seen_crops = set()
        for recommendation in recommendations:
            canonical_crop = str(recommendation["crop"]).strip()
            crop_key = canonical_crop.casefold()
            if canonical_crop and crop_key not in seen_crops:
                seen_crops.add(crop_key)
                unique_recommendations.append(
                    {**recommendation, "crop": canonical_crop}
                )
            if len(unique_recommendations) == 5:
                break

        if not unique_recommendations:
            raise RuntimeError("Crop model returned no usable recommendations.")

        return {
            "recommended_crop": crop_name,
            "tip":              CROP_TIPS.get(crop_name.lower(), "Consult your local agricultural extension officer."),
            "recommendations":  unique_recommendations,
            "input_warnings":   warnings,
            "model_source":     model_source,
            "score_kind":       score_kind,
        }
