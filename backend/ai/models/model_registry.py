# model_registry.py — Track model versions and checkpoints.

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

REGISTRY_DIR = Path(__file__).resolve().parent.parent / "checkpoints"
REGISTRY_FILE = REGISTRY_DIR / "registry.json"


@dataclass
class ModelVersion:
    """Metadata for a registered model checkpoint."""

    version: str
    checkpoint_path: str
    created_at: str
    num_classes: int
    training_samples: int
    best_dice: float
    notes: str = ""


def _load_registry() -> list[dict]:
    """Load registry from disk."""
    if not REGISTRY_FILE.exists():
        return []
    with open(REGISTRY_FILE) as f:
        return json.load(f)


def _save_registry(entries: list[dict]) -> None:
    """Save registry to disk."""
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_FILE, "w") as f:
        json.dump(entries, f, indent=2)


def register_model(version: ModelVersion) -> None:
    """Register a new model version."""
    entries = _load_registry()
    entries.append(asdict(version))
    _save_registry(entries)
    logger.info("Registered model version %s", version.version)


def get_latest_version() -> ModelVersion | None:
    """Get the most recently registered model version."""
    entries = _load_registry()
    if not entries:
        return None
    latest = entries[-1]
    return ModelVersion(**latest)


def list_versions() -> list[ModelVersion]:
    """List all registered model versions."""
    return [ModelVersion(**e) for e in _load_registry()]
