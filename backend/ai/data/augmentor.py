# augmentor.py — Training data augmentation for dental meshes.

from __future__ import annotations

import numpy as np


def random_rotation(points: np.ndarray, max_angle: float = 15.0) -> np.ndarray:
    """Apply random rotation around Y axis (up)."""
    angle = np.random.uniform(-max_angle, max_angle) * np.pi / 180
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    rot = np.array([
        [cos_a, 0, sin_a],
        [0, 1, 0],
        [-sin_a, 0, cos_a],
    ], dtype=np.float32)
    xyz = points[:, :3] @ rot.T
    result = points.copy()
    result[:, :3] = xyz
    if points.shape[1] > 3:
        result[:, 3:6] = points[:, 3:6] @ rot.T
    return result


def random_scale(points: np.ndarray, low: float = 0.9, high: float = 1.1) -> np.ndarray:
    """Apply random uniform scaling."""
    s = np.random.uniform(low, high)
    result = points.copy()
    result[:, :3] *= s
    return result


def random_jitter(points: np.ndarray, sigma: float = 0.001) -> np.ndarray:
    """Add Gaussian noise to point positions."""
    result = points.copy()
    noise = np.random.normal(0, sigma, size=result[:, :3].shape)
    result[:, :3] += noise.astype(np.float32)
    return result


def random_shift(points: np.ndarray, max_shift: float = 0.02) -> np.ndarray:
    """Apply random translation."""
    result = points.copy()
    shift = np.random.uniform(-max_shift, max_shift, size=3).astype(np.float32)
    result[:, :3] += shift
    return result


def augment_point_cloud(
    points: np.ndarray,
    rotation: bool = True,
    scale: bool = True,
    jitter: bool = True,
    shift: bool = True,
) -> np.ndarray:
    """Apply all enabled augmentations to a point cloud."""
    if rotation:
        points = random_rotation(points)
    if scale:
        points = random_scale(points)
    if jitter:
        points = random_jitter(points)
    if shift:
        points = random_shift(points)
    return points
