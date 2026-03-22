# occlusal_plane.py — Detect the occlusal (biting) plane and orient the model.
#
# The occlusal plane is the imaginary surface where upper and lower teeth meet.
# We fit a plane to the incisal edges / cusp tips of the teeth (topmost points
# of each tooth crown in the Y direction).
#
# Uses: PCA / least-squares plane fitting on tooth landmark points.

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class OcclusalPlaneResult:
    """Result of occlusal plane detection."""

    normal: list[float]           # [nx, ny, nz] plane normal (points "up" from teeth)
    point_on_plane: list[float]   # [x, y, z] centroid of fitted points
    plane_equation: list[float]   # [a, b, c, d] where ax + by + cz + d = 0
    tilt_angle_deg: float         # tilt from horizontal XZ plane
    landmarks: dict[int, list[float]]  # {fdi: [x,y,z]} landmark points used


def detect_occlusal_plane(
    tooth_data: dict[int, dict],
    jaw: str = "upper",
) -> OcclusalPlaneResult:
    """Detect the occlusal plane from extracted tooth data.

    Args:
        tooth_data: Dict of {fdi: {"centroid": [x,y,z], "bbox_min": [...], "bbox_max": [...]}}
        jaw: "upper" or "lower" — determines which extreme of the bbox to use.

    Returns:
        OcclusalPlaneResult with plane normal, equation, and tilt angle.
    """
    # Collect occlusal landmarks: for upper jaw, the lowest point (min Y) of
    # each tooth is the cusp tip; for lower jaw, the highest point (max Y).
    landmarks: dict[int, list[float]] = {}

    for fdi, data in tooth_data.items():
        if fdi == 0:
            continue  # skip gum
        centroid = np.array(data["centroid"])
        bbox_min = np.array(data["bbox_min"])
        bbox_max = np.array(data["bbox_max"])

        # The occlusal (biting) surface: for upper jaw teeth hang down (use
        # bbox_min Y as cusp tip), for lower jaw teeth point up (use bbox_max Y).
        if jaw == "upper":
            landmark = [centroid[0], bbox_min[1], centroid[2]]
        else:
            landmark = [centroid[0], bbox_max[1], centroid[2]]

        landmarks[fdi] = landmark

    if len(landmarks) < 3:
        raise ValueError(
            f"Need at least 3 teeth to fit occlusal plane, got {len(landmarks)}"
        )

    # Fit plane using SVD (least-squares)
    points = np.array(list(landmarks.values()))
    centroid = points.mean(axis=0)
    centered = points - centroid

    # SVD: the normal is the singular vector with smallest singular value
    _, _, Vt = np.linalg.svd(centered)
    normal = Vt[-1]  # last row = direction of least variance = plane normal

    # Ensure normal points "up" (positive Y for consistent orientation)
    if normal[1] < 0:
        normal = -normal

    # Plane equation: a*x + b*y + c*z + d = 0
    d = -np.dot(normal, centroid)
    plane_eq = [float(normal[0]), float(normal[1]), float(normal[2]), float(d)]

    # Tilt angle: angle between plane normal and Y axis (vertical)
    y_axis = np.array([0, 1, 0])
    cos_angle = np.clip(np.dot(normal, y_axis), -1, 1)
    tilt_deg = float(np.degrees(np.arccos(cos_angle)))

    logger.info(
        "Occlusal plane detected: tilt=%.1f°, normal=[%.3f, %.3f, %.3f], %d landmarks",
        tilt_deg, normal[0], normal[1], normal[2], len(landmarks),
    )

    return OcclusalPlaneResult(
        normal=normal.tolist(),
        point_on_plane=centroid.tolist(),
        plane_equation=plane_eq,
        tilt_angle_deg=round(tilt_deg, 2),
        landmarks={k: [round(v, 3) for v in vs] for k, vs in landmarks.items()},
    )


def compute_orientation_transform(
    plane_result: OcclusalPlaneResult,
) -> dict:
    """Compute the rotation matrix to align the occlusal plane with the XZ plane.

    Returns a dict with rotation_matrix (3x3) and euler_angles (degrees).
    """
    normal = np.array(plane_result.normal)
    target = np.array([0, 1, 0])  # Y-up

    # Rotation axis = cross product of current normal and target
    axis = np.cross(normal, target)
    axis_len = np.linalg.norm(axis)

    if axis_len < 1e-8:
        # Already aligned
        return {
            "rotation_matrix": np.eye(3).tolist(),
            "euler_angles_deg": [0.0, 0.0, 0.0],
            "needs_rotation": False,
        }

    axis = axis / axis_len
    angle = np.arccos(np.clip(np.dot(normal, target), -1, 1))

    # Rodrigues' rotation formula
    K = np.array([
        [0, -axis[2], axis[1]],
        [axis[2], 0, -axis[0]],
        [-axis[1], axis[0], 0],
    ])
    R = np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)

    # Extract approximate Euler angles (XYZ convention)
    euler_x = np.degrees(np.arctan2(R[2, 1], R[2, 2]))
    euler_y = np.degrees(np.arctan2(-R[2, 0], np.sqrt(R[2, 1]**2 + R[2, 2]**2)))
    euler_z = np.degrees(np.arctan2(R[1, 0], R[0, 0]))

    return {
        "rotation_matrix": R.tolist(),
        "euler_angles_deg": [round(euler_x, 2), round(euler_y, 2), round(euler_z, 2)],
        "needs_rotation": True,
    }
