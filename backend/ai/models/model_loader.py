# model_loader.py — Load/cache model from checkpoint.

from __future__ import annotations

import logging
from pathlib import Path
from threading import Lock

from app.constants import AI_NUM_CLASSES

logger = logging.getLogger(__name__)

_model_cache: dict = {}
_lock = Lock()

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "checkpoints" / "meshsegnet_latest.pth"


def load_model(
    checkpoint_path: str | None = None,
    device: str = "cpu",
    num_classes: int = AI_NUM_CLASSES,
):
    """Load MeshSegNet from checkpoint. Returns None if no checkpoint exists."""
    import torch
    from ai.models.meshsegnet import MeshSegNet

    path = Path(checkpoint_path) if checkpoint_path else DEFAULT_MODEL_PATH
    cache_key = f"{path}:{device}"

    with _lock:
        if cache_key in _model_cache:
            logger.debug("Returning cached model for %s", cache_key)
            return _model_cache[cache_key]

    if not path.exists():
        logger.warning("No checkpoint found at %s", path)
        return None

    model = MeshSegNet(num_classes=num_classes)
    checkpoint = torch.load(str(path), map_location=device, weights_only=True)

    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()

    with _lock:
        _model_cache[cache_key] = model

    logger.info("Loaded model from %s on %s", path, device)
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
