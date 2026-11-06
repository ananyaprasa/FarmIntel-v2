"""Image preprocessing pipeline for disease and soil CNN models."""

import io
import hashlib
from PIL import Image
import numpy as np

try:
    import torch
    from torchvision import transforms
    inference_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
    ])
except ImportError:
    torch = None
    inference_transform = None


def preprocess_image(image_bytes: bytes) -> tuple:
    """
    Validate, preprocess and return a (1, 3, 224, 224) float32 tensor/ndarray
    plus a deterministic cache key (SHA-256 of raw bytes).
    Raises ValueError for invalid / non-image data.
    """
    # --- validate ---
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()            # catches truncated files
        img = Image.open(io.BytesIO(image_bytes))  # reopen after verify
    except Exception as exc:
        raise ValueError(f"Invalid image file: {exc}") from exc

    # --- convert to RGB (handles RGBA, palette, grayscale) ---
    img = img.convert("RGB")

    # --- reject suspiciously small images ---
    w, h = img.size
    if w < 64 or h < 64:
        raise ValueError(f"Image too small ({w}×{h}). Minimum 64×64 px required.")

    # --- transform ---
    if torch is not None and inference_transform is not None:
        tensor = inference_transform(img).unsqueeze(0)  # (1, 3, 224, 224)
    else:
        resized = img.resize((224, 224))
        arr = np.array(resized, dtype=np.float32) / 255.0
        tensor = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

    # --- cache key ---
    cache_key = hashlib.sha256(image_bytes).hexdigest()

    return tensor, cache_key


def preprocess_soil_image(image_bytes: bytes) -> tuple:
    """Validate and preprocess a soil photo without changing the disease pipeline."""
    if not image_bytes:
        raise ValueError("The uploaded file is empty. Choose a readable soil image.")

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError(
            "The uploaded file is not a supported or readable image. "
            "Try a JPEG, PNG, or WebP photo."
        ) from exc

    img = img.convert("RGB")
    width, height = img.size
    if width < 64 or height < 64:
        raise ValueError(
            f"Image is too small ({width}×{height}). Minimum 64×64 px required."
        )

    if torch is not None and inference_transform is not None:
        tensor = inference_transform(img).unsqueeze(0)
    else:
        resized = img.resize((224, 224))
        arr = np.array(resized, dtype=np.float32) / 255.0
        tensor = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

    return tensor, hashlib.sha256(image_bytes).hexdigest()


def bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """Return a PIL Image from raw bytes, converted to RGB."""
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")
