# model_loader.py — Load/cache pretrained MeshSegNet models.
#
# Two separate models: upper jaw (maxillary) and lower jaw (mandibular).
# Weights from: https://github.com/Tai-Hsien/MeshSegNet

from __future__ import annotations

import logging
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

_model_cache: dict = {}
_lock = Lock()

CHECKPOINTS_DIR = Path(__file__).resolve().parent.parent / "checkpoints"
UPPER_CHECKPOINT = CHECKPOINTS_DIR / "MeshSegNet_Max_15_classes_72samples_lr1e-2_best.zip"
LOWER_CHECKPOINT = CHECKPOINTS_DIR / "MeshSegNet_Man_15_classes_72samples_lr1e-2_best.zip"


def load_model(jaw: str = "upper", device: str = "cpu"):
    """Load pretrained MeshSegNet for upper or lower jaw.

    Args:
        jaw: "upper" or "lower".
        device: "cpu", "cuda", or "mps".

    Returns:
        MeshSegNet model in eval mode, or None if checkpoint missing.
    """
    import torch
    from ai.models.meshsegnet import MeshSegNet

    ckpt_path = UPPER_CHECKPOINT if jaw == "upper" else LOWER_CHECKPOINT
    cache_key = f"{jaw}:{device}"

    with _lock:
        if cache_key in _model_cache:
            return _model_cache[cache_key]

    if not ckpt_path.exists():
        logger.warning("No checkpoint found at %s", ckpt_path)
        return None

    logger.info("Loading MeshSegNet (%s jaw) from %s ...", jaw, ckpt_path.name)
    model = MeshSegNet(num_classes=15, num_channels=15)

    # Load weights (zip format from original MeshSegNet repo)
    checkpoint = torch.load(str(ckpt_path), map_location=device, weights_only=False)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    with _lock:
        _model_cache[cache_key] = model

    logger.info("MeshSegNet (%s) loaded on %s", jaw, device)
    return model


def clear_cache() -> None:
    """Clear the model cache."""
    with _lock:
        _model_cache.clear()
    logger.info("Model cache cleared")


def get_device() -> str:
    """Return best available device: cuda > mps > cpu."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"
