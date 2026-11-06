import pickle
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from backend.main import CropInput
from backend.models import crop_model
from backend.models.crop_model import CentroidCropModel, CropModel


class FakeEstimator:
    def predict(self, features):
        return np.array([[1]])

    def predict_proba(self, features):
        return np.array([[0.2, 0.7, 0.1]])


class FakeLabelEncoder:
    classes_ = np.array(["apple", "maize", "rice"])

    def inverse_transform(self, indices):
        return self.classes_[np.asarray(indices)]


class DuplicateLabelEncoder:
    classes_ = np.array(["maize", "maize", "maize"])

    def inverse_transform(self, indices):
        return self.classes_[np.asarray(indices)]


def valid_payload():
    return {
        "N": 42,
        "P": 50,
        "K": 43,
        "temperature": 26,
        "humidity": 70,
        "ph": 6.5,
        "rainfall": 120,
    }


class CropInputTests(unittest.TestCase):
    def test_accepts_values_at_configured_boundaries(self):
        payload = valid_payload()
        payload.update(
            N=0,
            P=145,
            K=205,
            temperature=8,
            humidity=100,
            ph=3.5,
            rainfall=300,
        )
        self.assertEqual(CropInput.model_validate(payload).N, 0)

    def test_rejects_missing_nonnumeric_nonfinite_and_out_of_range_values(self):
        missing = valid_payload()
        del missing["N"]
        with self.assertRaises(ValueError):
            CropInput.model_validate(missing)

        for invalid in (None, "not-a-number", float("nan"), float("inf"), float("-inf")):
            with self.subTest(value=invalid):
                payload = valid_payload()
                payload["ph"] = invalid
                with self.assertRaises(ValueError):
                    CropInput.model_validate(payload)

        for field, value in (("ph", 10.1), ("N", 140.1)):
            with self.subTest(field=field):
                payload = valid_payload()
                payload[field] = value
                with self.assertRaises(ValueError):
                    CropInput.model_validate(payload)

    def test_accepts_optional_ui_language_without_changing_crop_labels(self):
        self.assertEqual(CropInput.model_validate({**valid_payload(), "language": "hi"}).language, "hi")


class CropModelTests(unittest.TestCase):
    def test_fallback_preserves_normalized_centroid_order_and_legacy_fields(self):
        model = CropModel("missing-model.pkl", "missing-encoder.pkl")
        model.load()
        rice_center = crop_model.CROP_CENTROIDS["rice"]
        result = model.predict(*rice_center[:3], *rice_center[3:])

        self.assertEqual(result["recommended_crop"], "rice")
        self.assertEqual(result["recommendations"][0]["crop"], "rice")
        self.assertEqual(len(result["recommendations"]), 5)
        self.assertEqual(result["model_source"], "centroid_fallback")
        self.assertEqual(result["score_kind"], "profile_similarity_share")
        for field in ("recommended_crop", "tip", "recommendations", "input_warnings"):
            self.assertIn(field, result)

    def test_rejects_nonfinite_direct_model_inputs(self):
        model = CropModel("unused", "unused")
        model.model = CentroidCropModel()
        with self.assertRaisesRegex(ValueError, "finite"):
            model.predict(42, 50, 43, 26, 70, float("nan"), 120)

    def test_unloaded_model_fails_explicitly(self):
        with self.assertRaisesRegex(RuntimeError, "not loaded"):
            CropModel("unused", "unused").predict(42, 50, 43, 26, 70, 6.5, 120)

    def test_fallback_similarity_matches_existing_feature_normalization(self):
        features = np.array([[42, 50, 43, 26, 70, 6.5, 120]], dtype=np.float32)
        model = CentroidCropModel()
        _, ranked_scores = model.predict(features)
        stds = np.asarray(crop_model.FEATURE_STDS, dtype=np.float32)
        scores = {
            crop: 1.0             / (
                1.0
                + np.sqrt(
                    np.sum(
                        (
                            (features[0] - np.asarray(center, dtype=np.float32))
                            / stds
                        )
                        ** 2
                    )
                )
            )
            for crop, center in crop_model.CROP_CENTROIDS.items()
        }
        total = sum(scores.values())
        expected_ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:5]

        self.assertEqual(
            [crop for crop, _ in ranked_scores],
            [crop for crop, _ in expected_ranked],
        )
        for (crop, result_score), (expected_crop, score) in zip(
            ranked_scores, expected_ranked
        ):
            self.assertEqual(crop, expected_crop)
            self.assertAlmostEqual(result_score, round(score / total * 100, 2))

    def test_catboost_model_artifacts_load_and_decode_labels(self):
        encoder = FakeLabelEncoder()
        with tempfile.TemporaryDirectory() as directory:
            model_path = Path(directory) / "crop.pkl"
            encoder_path = Path(directory) / "encoder.pkl"
            model_path.write_bytes(pickle.dumps(FakeEstimator()))
            encoder_path.write_bytes(pickle.dumps(encoder))

            model = CropModel(str(model_path), str(encoder_path))
            model.load()
            result = model.predict(42, 50, 43, 26, 70, 6.5, 120)

        self.assertEqual(result["recommended_crop"], "maize")
        self.assertEqual(result["recommendations"][0]["crop"], "maize")
        self.assertEqual(result["model_source"], "catboost")
        self.assertEqual(result["score_kind"], "model_class_score")

    def test_removes_duplicate_model_labels_without_reordering(self):
        model = CropModel("unused", "unused")
        model.model = FakeEstimator()
        model.label_encoder = DuplicateLabelEncoder()
        result = model.predict(42, 50, 43, 26, 70, 6.5, 120)

        self.assertEqual(
            [item["crop"] for item in result["recommendations"]],
            ["maize"],
        )

    def test_corrupt_artifacts_select_the_existing_centroid_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            model_path = Path(directory) / "crop.pkl"
            encoder_path = Path(directory) / "encoder.pkl"
            model_path.write_text("not a pickle", encoding="utf-8")
            encoder_path.write_text("not a pickle", encoding="utf-8")

            model = CropModel(str(model_path), str(encoder_path))
            model.load()

        self.assertIsInstance(model.model, CentroidCropModel)

    def test_missing_fallback_profiles_fail_explicitly(self):
        with patch.dict(crop_model.CROP_CENTROIDS, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "No crop profiles"):
                CentroidCropModel().predict(np.zeros((1, 7), dtype=np.float32))


if __name__ == "__main__":
    unittest.main()
