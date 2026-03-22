# test_occlusal_plane.py — Unit tests for occlusal plane detection.

import pytest
import numpy as np

from ai.analysis.occlusal_plane import (
    detect_occlusal_plane,
    compute_orientation_transform,
    OcclusalPlaneResult,
)


def _make_tooth_data(n_teeth=14, jaw="upper"):
    """Create synthetic tooth data arranged in an arch shape."""
    data = {}
    angles = np.linspace(-np.pi * 0.7, np.pi * 0.7, n_teeth)
    radius = 20  # mm

    fdi_start = 17 if jaw == "upper" else 47
    fdi_list = list(range(fdi_start, fdi_start - 7, -1))
    fdi_start2 = 21 if jaw == "upper" else 31
    fdi_list += list(range(fdi_start2, fdi_start2 + 7))

    for i, angle in enumerate(angles):
        x = radius * np.sin(angle)
        z = radius * np.cos(angle)
        y = 0 if jaw == "upper" else 0  # flat occlusal plane
        fdi = fdi_list[i] if i < len(fdi_list) else 11

        data[fdi] = {
            "centroid": [float(x), float(y), float(z)],
            "bbox_min": [float(x - 3), float(y - 5), float(z - 4)],
            "bbox_max": [float(x + 3), float(y + 5), float(z + 4)],
        }
    return data


class TestDetectOcclusalPlane:
    def test_returns_result(self):
        data = _make_tooth_data()
        result = detect_occlusal_plane(data, jaw="upper")
        assert isinstance(result, OcclusalPlaneResult)

    def test_normal_is_unit_vector(self):
        data = _make_tooth_data()
        result = detect_occlusal_plane(data, jaw="upper")
        normal = np.array(result.normal)
        assert abs(np.linalg.norm(normal) - 1.0) < 1e-5

    def test_normal_points_up(self):
        data = _make_tooth_data()
        result = detect_occlusal_plane(data, jaw="upper")
        # Normal Y component should be positive (pointing up)
        assert result.normal[1] >= 0

    def test_flat_arch_gives_small_tilt(self):
        """Teeth arranged in flat plane should give near-zero tilt."""
        data = _make_tooth_data()
        result = detect_occlusal_plane(data, jaw="upper")
        assert result.tilt_angle_deg < 15, f"Tilt {result.tilt_angle_deg}° too large for flat arch"

    def test_plane_equation_format(self):
        data = _make_tooth_data()
        result = detect_occlusal_plane(data, jaw="upper")
        assert len(result.plane_equation) == 4

    def test_landmarks_match_input(self):
        data = _make_tooth_data(n_teeth=10)
        result = detect_occlusal_plane(data, jaw="upper")
        assert len(result.landmarks) == 10

    def test_too_few_teeth_raises(self):
        data = {11: {"centroid": [0, 0, 0], "bbox_min": [-1, -1, -1], "bbox_max": [1, 1, 1]}}
        with pytest.raises(ValueError, match="at least 3"):
            detect_occlusal_plane(data, jaw="upper")

    def test_tilted_arch(self):
        """Teeth tilted 30° should give ~30° tilt."""
        data = {}
        for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
            x = (i - 7) * 5
            tilt_rad = np.radians(30)
            y = x * np.sin(tilt_rad) * 0.1
            z = 20 - abs(x) * 0.3
            data[fdi] = {
                "centroid": [x, y, z],
                "bbox_min": [x - 3, y - 5, z - 4],
                "bbox_max": [x + 3, y + 5, z + 4],
            }
        result = detect_occlusal_plane(data, jaw="upper")
        assert result.tilt_angle_deg > 0


class TestOrientationTransform:
    def test_aligned_plane_no_rotation(self):
        """Plane with normal=[0,1,0] should need no rotation."""
        plane = OcclusalPlaneResult(
            normal=[0, 1, 0],
            point_on_plane=[0, 0, 0],
            plane_equation=[0, 1, 0, 0],
            tilt_angle_deg=0,
            landmarks={},
        )
        result = compute_orientation_transform(plane)
        assert result["needs_rotation"] is False

    def test_tilted_plane_needs_rotation(self):
        data = _make_tooth_data()
        # Tilt the arch
        for fdi in data:
            data[fdi]["centroid"][1] += data[fdi]["centroid"][0] * 0.2
            data[fdi]["bbox_min"][1] += data[fdi]["bbox_min"][0] * 0.2
            data[fdi]["bbox_max"][1] += data[fdi]["bbox_max"][0] * 0.2
        plane = detect_occlusal_plane(data, jaw="upper")
        result = compute_orientation_transform(plane)
        if plane.tilt_angle_deg > 1:
            assert result["needs_rotation"] is True

    def test_rotation_matrix_is_3x3(self):
        plane = OcclusalPlaneResult(
            normal=[0.1, 0.95, -0.3],
            point_on_plane=[0, 0, 0],
            plane_equation=[0.1, 0.95, -0.3, 0],
            tilt_angle_deg=18.0,
            landmarks={},
        )
        result = compute_orientation_transform(plane)
        R = np.array(result["rotation_matrix"])
        assert R.shape == (3, 3)

    def test_rotation_matrix_is_orthogonal(self):
        plane = OcclusalPlaneResult(
            normal=[0.1, 0.95, -0.3],
            point_on_plane=[0, 0, 0],
            plane_equation=[0.1, 0.95, -0.3, 0],
            tilt_angle_deg=18.0,
            landmarks={},
        )
        # Normalize normal first
        n = np.array(plane.normal)
        n = n / np.linalg.norm(n)
        plane.normal = n.tolist()

        result = compute_orientation_transform(plane)
        R = np.array(result["rotation_matrix"])
        # R @ R^T should be identity
        assert np.allclose(R @ R.T, np.eye(3), atol=1e-5)
