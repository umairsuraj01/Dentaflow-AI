# segmentation_runner.py — Model inference wrapper + mock mode.

from __future__ import annotations

import logging
import os
import time

import numpy as np

from app.constants import AI_NUM_CLASSES, AI_POINT_CLOUD_SIZE
from ai.utils.fdi_numbering import FDI_ALL, fdi_to_class

logger = logging.getLogger(__name__)


def run_inference(
    point_cloud: np.ndarray,
    checkpoint_path: str | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Run segmentation inference on a point cloud.

    If AI_MOCK_MODE is enabled or no model exists, falls back to mock.

    Args:
        point_cloud: (N, 7) float32 array
        checkpoint_path: optional path to model weights

    Returns:
        (labels (N,), probabilities (N, C))
    """
    mock_mode = os.getenv("AI_MOCK_MODE", "true").lower() == "true"

    if mock_mode:
        logger.info("Running in MOCK mode — returning plausible labels")
        return mock_inference(point_cloud)

    from ai.models.model_loader import load_model, get_device
    model = load_model(checkpoint_path, device=get_device())
    if model is None:
        logger.warning("No trained model found — falling back to mock")
        return mock_inference(point_cloud)

    start = time.time()
    labels, probs = model.inference_with_probs(point_cloud)
    elapsed = time.time() - start
    logger.info("Inference completed in %.2fs", elapsed)
    return labels, probs


def mock_inference(point_cloud: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Generate plausible mock segmentation labels.

    Divides the point cloud spatially into tooth-like segments,
    simulating a realistic segmentation result.
    """
    n_points = point_cloud.shape[0]
    n_classes = AI_NUM_CLASSES
    labels = np.zeros(n_points, dtype=np.int64)
    probs = np.zeros((n_points, n_classes), dtype=np.float32)

    xyz = point_cloud[:, :3]

    # Determine upper vs lower by Y coordinate (median split)
    y_median = np.median(xyz[:, 1])
    is_upper = xyz[:, 1] > y_median

    # Split left/right by X coordinate
    x_median = np.median(xyz[:, 0])
    is_left = xyz[:, 0] < x_median

    # Assign 8 teeth per quadrant based on angular position from center
    for quadrant_mask, fdi_range in [
        (is_upper & ~is_left, list(range(11, 19))),  # Upper right
        (is_upper & is_left, list(range(21, 29))),    # Upper left
        (~is_upper & is_left, list(range(31, 39))),   # Lower left
        (~is_upper & ~is_left, list(range(41, 49))),  # Lower right
    ]:
        indices = np.where(quadrant_mask)[0]
        if len(indices) == 0:
            continue
        quad_xyz = xyz[indices]
        center = quad_xyz.mean(axis=0)
        # Compute angle from center for tooth assignment
        dx = quad_xyz[:, 0] - center[0]
        dz = quad_xyz[:, 2] - center[2]
        angles = np.arctan2(dz, dx)
        # Discretize angles into 8 bins
        bins = np.digitize(angles, np.linspace(angles.min(), angles.max(), 9)) - 1
        bins = np.clip(bins, 0, 7)

        for bin_idx in range(8):
            fdi = fdi_range[bin_idx]
            class_idx = fdi_to_class(fdi)
            bin_mask = bins == bin_idx
            point_indices = indices[bin_mask]
            labels[point_indices] = class_idx
            # Set high confidence for mock
            conf = np.random.uniform(0.75, 0.98)
            probs[point_indices, class_idx] = conf
            remaining = (1.0 - conf) / max(n_classes - 1, 1)
            probs[point_indices] = remaining
            probs[point_indices, class_idx] = conf

    # Assign background to any unassigned points
    bg_mask = labels == 0
    probs[bg_mask, 0] = 0.95
    probs[bg_mask, 1:] = 0.05 / (n_classes - 1)

    logger.info(
        "Mock inference: %d points, %d unique labels",
        n_points, len(np.unique(labels)),
    )
    return labels, probs
