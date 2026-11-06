"""
Soil classification model wrapper (EfficientNet-B0 + Fallback).

Classifies soil images into standard types.
Runs real EfficientNet-B0 neural network predictions on soil classes.
"""

import logging
from pathlib import Path

try:
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
except ImportError:
    torch = None
    nn = None
    tv_models = None

logger = logging.getLogger(__name__)

# ── Soil type labels ────────────────────────────────────────────────────────
SOIL_CLASSES = ["Alluvial soil", "Black Soil", "Clay soil", "Red soil"]

SOIL_PROPERTIES: dict[str, dict] = {
    "Alluvial soil": {
        "water_retention": "Often high",
        "drainage":        "Varies by location",
        "fertility":       "Often fertile",
        "suitable_crops":  ["Wheat", "Rice", "Sugarcane", "Cotton"],
        "tips":            ["Assess field drainage and nutrients", "Maintain organic matter using local guidance"],
    },
    "Black Soil": {
        "water_retention": "Often very high",
        "drainage":        "Can be slow",
        "fertility":       "Often fertile",
        "suitable_crops":  ["Cotton", "Soybean", "Millets", "Tobacco"],
        "tips":            ["Check drainage before irrigation", "Use local advice for field management"],
    },
    "Clay soil": {
        "water_retention": "Often high",
        "drainage":        "Can be slow",
        "fertility":       "Varies by sample",
        "suitable_crops":  ["Paddy", "Wheat", "Gram"],
        "tips":            ["Consider organic matter for soil structure", "Avoid working the soil when wet"],
    },
    "Red soil": {
        "water_retention": "Often low",
        "drainage":        "Often free-draining",
        "fertility":       "Varies by sample",
        "suitable_crops":  ["Groundnut", "Millets", "Pulses", "Tobacco"],
        "tips":            ["Test pH before considering amendments", "Mulch may help reduce surface moisture loss"],
    },
}


def _build_efficientnet_b0(num_classes: int):
    if tv_models is None or nn is None:
        return None
    model = tv_models.efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    return model


class SoilModel:
    def __init__(self, model_path: str, num_classes: int = 4):
        self.model_path = Path(model_path)
        self.num_classes = num_classes
        self.model = None
        self.device = torch.device("cpu") if torch is not None else None

    def load(self):
        if torch is None or not self.model_path.exists():
            logger.error("PyTorch or soil model weights are unavailable at %s.", self.model_path)
            self.model = None
            return

        logger.info("Loading soil model from %s …", self.model_path)

        try:
            obj = torch.load(self.model_path, map_location="cpu", weights_only=False)
            if isinstance(obj, nn.Module):
                self.model = obj.float().eval()
                self._finalize()
                logger.info("Soil model loaded as full Module.")
                return
            state_dict = obj
        except Exception:
            try:
                state_dict = torch.load(self.model_path, map_location="cpu", weights_only=True)
            except Exception as exc:
                logger.exception("Cannot load PyTorch soil model: %s", exc)
                self.model = None
                return

        net = _build_efficientnet_b0(self.num_classes)
        if net is None:
            logger.error("Cannot build EfficientNet-B0 soil model.")
            self.model = None
            return

        clean_state_dict = {}
        for k, v in state_dict.items():
            new_k = k.replace("module.", "") if k.startswith("module.") else k
            clean_state_dict[new_k] = v.float()
            
        missing, unexpected = net.load_state_dict(clean_state_dict, strict=False)
        self.model = net
        self._finalize()
        logger.info("Soil model loaded via state_dict (EfficientNet-B0 backbone).")

    def _finalize(self):
        if self.model and hasattr(self.model, "float"):
            self.model = self.model.float().to(self.device).eval()

    def predict(self, tensor=None) -> dict:
        if self.model is None or torch is None:
            raise RuntimeError("Soil classification model is unavailable.")

        if not isinstance(tensor, torch.Tensor):
            try:
                tensor = torch.from_numpy(tensor).float()
            except Exception as exc:
                raise ValueError("Soil image preprocessing did not produce a valid tensor.") from exc

        try:
            if tuple(tensor.shape) != (1, 3, 224, 224):
                raise ValueError("Expected one preprocessed image with shape (1, 3, 224, 224).")

            with torch.no_grad():
                logits = self.model(tensor.to(self.device))
                if not isinstance(logits, torch.Tensor) or logits.ndim != 2:
                    raise ValueError("Soil model returned an invalid prediction shape.")
                if logits.shape != (1, len(SOIL_CLASSES)):
                    raise ValueError(
                        f"Soil model must return one score for each of {len(SOIL_CLASSES)} classes."
                    )
                if not torch.isfinite(logits).all():
                    raise ValueError("Soil model returned non-finite prediction values.")

                probs = torch.softmax(logits, dim=1)[0]
                if not torch.isfinite(probs).all():
                    raise ValueError("Soil model produced non-finite scores.")
                top_probs, top_indices = torch.topk(probs, k=min(3, len(SOIL_CLASSES)))
                top_idx = int(top_indices[0].item())
                soil_name = SOIL_CLASSES[top_idx]
                confidence = round(float(top_probs[0].item()) * 100, 2)
                props = SOIL_PROPERTIES.get(soil_name, {})

                all_probs = [
                    {"label": SOIL_CLASSES[i], "confidence": round(float(p) * 100, 2)}
                    for i, p in enumerate(probs.tolist())
                ]
                top_predictions = [
                    {"label": SOIL_CLASSES[int(index)], "confidence": round(float(prob) * 100, 2)}
                    for index, prob in zip(top_indices.tolist(), top_probs.tolist())
                ]

                return {
                    "soil_type":       soil_name,
                    "confidence":      confidence,
                    "confidence_method": "softmax_score",
                    "top_predictions": top_predictions,
                    "water_retention": props.get("water_retention", "Unknown"),
                    "drainage":        props.get("drainage", "Unknown"),
                    "fertility":       props.get("fertility", "Unknown"),
                    "suitable_crops":  props.get("suitable_crops", []),
                    "tips":            props.get("tips", []),
                    "all_classes":     all_probs,
                }
        except (ValueError, RuntimeError):
            raise
        except Exception as exc:
            logger.exception("PyTorch soil inference failed.")
            raise RuntimeError("Soil classification inference failed.") from exc
