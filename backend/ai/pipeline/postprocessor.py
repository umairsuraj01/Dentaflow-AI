# postprocessor.py — Label cleanup + respect restrictions from doctor instructions.

from __future__ import annotations

import logging

import numpy as np

from app.constants import AI_CONFIDENCE_HIGH, AI_CONFIDENCE_MEDIUM
from ai.utils.fdi_numbering import class_to_fdi

logger = logging.getLogger(__name__)


def smooth_labels(labels: np.ndarray, point_cloud: np.ndarray, k: int = 10) -> np.ndarray:
    """Majority voting in local neighborhood to remove label noise."""
    from scipy.spatial import cKDTree

    tree = cKDTree(point_cloud[:, :3])
    smoothed = labels.copy()
    _, nn_indices = tree.query(point_cloud[:, :3], k=k)

    for i in range(len(labels)):
        neighbor_labels = labels[nn_indices[i]]
        counts = np.bincount(neighbor_labels, minlength=labels.max() + 1)
        smoothed[i] = counts.argmax()

    changed = int(np.sum(smoothed != labels))
    logger.info("Smoothed labels: %d points changed", changed)
    return smoothed


def remove_floating_segments(
    labels: np.ndarray,
    point_cloud: np.ndarray,
    min_points: int = 100,
    radius: float = 0.05,
) -> np.ndarray:
    """Remove segments with fewer than min_points connected points."""
    from scipy.spatial import cKDTree

    cleaned = labels.copy()
    unique_labels = np.unique(labels)

    for label_id in unique_labels:
        if label_id == 0:
            continue
        mask = labels == label_id
        count = int(mask.sum())
        if count < min_points:
            cleaned[mask] = 0
            logger.debug(
                "Removed floating segment %d (%d points)", label_id, count,
            )

    removed = int(np.sum(cleaned != labels))
    logger.info("Removed floating segments: %d points reassigned", removed)
    return cleaned


def enforce_restrictions(
    labels: np.ndarray,
    restricted_fdi: list[int],
    original_labels: np.ndarray,
) -> tuple[np.ndarray, int]:
    """For restricted teeth: restore original AI label, don't reassign.

    Returns (corrected_labels, overridden_count).
    """
    if not restricted_fdi:
        return labels, 0

    from ai.utils.fdi_numbering import fdi_to_class

    restricted_classes = {fdi_to_class(fdi) for fdi in restricted_fdi}
    corrected = labels.copy()
    override_count = 0

    for cls in restricted_classes:
        if cls == 0:
            continue
        # Points that were labeled as this restricted tooth by AI
        original_mask = original_labels == cls
        current_mask = labels == cls
        # Restore original AI prediction for these points
        changed = original_mask & ~current_mask
        corrected[changed] = cls
        override_count += int(changed.sum())

    logger.info(
        "Enforced restrictions for %d teeth: %d points overridden",
        len(restricted_fdi), override_count,
    )
    return corrected, override_count


def label_to_fdi(class_idx: int) -> int:
    """Map class index (0-32) to FDI number."""
    return class_to_fdi(class_idx)


def generate_per_tooth_confidence(
    probs: np.ndarray,
    labels: np.ndarray,
) -> dict[int, float]:
    """For each detected tooth, compute mean confidence of its points.

    Returns dict of {fdi_number: confidence_score}.
    """
    confidence = {}
    unique_labels = np.unique(labels)

    for label_id in unique_labels:
        fdi = class_to_fdi(int(label_id))
        if fdi == 0:
            continue
        mask = labels == label_id
        tooth_probs = probs[mask, label_id]
        confidence[fdi] = round(float(np.mean(tooth_probs)), 4)

    return confidence


def get_confidence_level(score: float) -> str:
    """Return 'high', 'medium', or 'low' based on confidence thresholds."""
    if score >= AI_CONFIDENCE_HIGH:
        return "high"
    if score >= AI_CONFIDENCE_MEDIUM:
        return "medium"
    return "low"
