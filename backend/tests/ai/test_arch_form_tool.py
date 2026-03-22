# test_arch_form_tool.py — Unit tests for arch form fitting and snap-to-arch.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.arch_form_tool import (
    fit_arch_form,
    snap_to_arch,
    generate_arch_curve_points,
    ArchFitResult,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_arch_teeth(jaw="upper"):
    """Create synthetic teeth on a parabolic arch."""
    data = {}
    fdis = ([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
            if jaw == "upper" else
            [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37])
    angles = np.linspace(-np.pi * 0.7, np.pi * 0.7, len(fdis))
    radius = 22

    for fdi, angle in zip(fdis, angles):
        x = radius * np.sin(angle)
        z = radius * np.cos(angle)
        data[fdi] = {
            "centroid": [float(x), 0.0, float(z)],
            "bbox_min": [float(x - 3), -5.0, float(z - 4)],
            "bbox_max": [float(x + 3), 5.0, float(z + 4)],
        }
    return data


class TestFitArchForm:
    def test_returns_result(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        assert isinstance(result, ArchFitResult)

    def test_parabolic(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper", arch_type="parabolic")
        assert result.arch_type == "parabolic"

    def test_brader(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper", arch_type="brader")
        assert result.arch_type == "brader"

    def test_catenary(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper", arch_type="catenary")
        assert result.arch_type == "catenary"

    def test_width_positive(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        assert result.arch_width_mm > 0

    def test_depth_positive(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        assert result.arch_depth_mm > 0

    def test_ideal_positions_for_each_tooth(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        assert len(result.ideal_positions) == 14

    def test_movements_for_each_tooth(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        assert len(result.required_movements) == 14

    def test_fit_error_reasonable(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper")
        # Synthetic data on a circle won't perfectly match a parabola
        assert result.fit_error_mm < 20

    def test_custom_width(self):
        data = _make_arch_teeth()
        result = fit_arch_form(data, "upper", custom_width=35.0)
        assert result.arch_width_mm == 35.0

    def test_too_few_teeth_raises(self):
        data = {11: {"centroid": [0, 0, 0], "bbox_min": [-3, -5, -4], "bbox_max": [3, 5, 4]}}
        with pytest.raises(ValueError, match="at least 4"):
            fit_arch_form(data, "upper")

    def test_lower_jaw(self):
        data = _make_arch_teeth(jaw="lower")
        result = fit_arch_form(data, "lower")
        assert result.jaw == "lower"
        assert len(result.ideal_positions) == 14


class TestSnapToArch:
    def test_returns_targets(self):
        data = _make_arch_teeth()
        targets = snap_to_arch(data, "upper")
        assert isinstance(targets, dict)

    def test_targets_have_pos_keys(self):
        data = _make_arch_teeth()
        targets = snap_to_arch(data, "upper")
        for fdi, t in targets.items():
            assert "pos_x" in t
            assert "pos_z" in t

    def test_skip_negligible_movements(self):
        """Teeth already on the arch shouldn't get targets."""
        data = _make_arch_teeth()
        targets = snap_to_arch(data, "upper")
        for fdi, t in targets.items():
            total = np.sqrt(t["pos_x"]**2 + t["pos_z"]**2)
            assert total > 0.1  # only teeth that actually need movement


class TestGenerateArchCurve:
    def test_parabolic_curve(self):
        points = generate_arch_curve_points("parabolic", 40, 25, n_points=50)
        assert len(points) == 50

    def test_catenary_curve(self):
        points = generate_arch_curve_points("catenary", 40, 25)
        assert len(points) > 10

    def test_brader_curve(self):
        points = generate_arch_curve_points("brader", 40, 25)
        assert len(points) > 10

    def test_points_are_2d(self):
        points = generate_arch_curve_points("parabolic", 40, 25)
        for p in points:
            assert len(p) == 2

    def test_symmetric(self):
        """Arch should be symmetric about x=0."""
        points = generate_arch_curve_points("parabolic", 40, 25, n_points=101)
        mid = len(points) // 2
        # Center point should have x ≈ 0
        assert abs(points[mid][0]) < 0.5


@upper_available
class TestRealDataArchFit:
    @pytest.fixture(scope="class")
    def tooth_data(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        output = run_full_pipeline(UPPER_STL)
        mesh = load_mesh(UPPER_STL)
        teeth = extract_tooth_meshes(mesh, output.face_labels, jaw="upper")
        return {
            fdi: {"centroid": td.centroid, "bbox_min": td.bbox_min, "bbox_max": td.bbox_max}
            for fdi, td in teeth.items()
        }

    def test_fit_all_arch_types(self, tooth_data):
        for arch_type in ["parabolic", "brader", "catenary"]:
            result = fit_arch_form(tooth_data, "upper", arch_type=arch_type)
            assert result.arch_width_mm > 20
            assert result.arch_depth_mm > 10

    def test_snap_produces_targets(self, tooth_data):
        targets = snap_to_arch(tooth_data, "upper")
        assert len(targets) >= 1
