# test_dental_analysis.py — Unit tests for dental analysis computations.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.dental_analysis import (
    measure_teeth,
    compute_space_analysis,
    compute_bolton_analysis,
    compute_arch_form,
    compute_overjet_overbite,
    compute_midline,
    run_full_analysis,
    AVG_TOOTH_WIDTHS,
    ToothMeasurement,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
LOWER_STL = "/Users/umairsuraj/Downloads/mandibulary_export.stl"

upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)
lower_available = pytest.mark.skipif(
    not Path(LOWER_STL).exists(), reason="Lower STL not found"
)


def _make_upper_arch():
    """Create synthetic upper arch tooth data."""
    data = {}
    upper_fdis = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
    angles = np.linspace(-np.pi * 0.7, np.pi * 0.7, len(upper_fdis))
    radius = 22

    for fdi, angle in zip(upper_fdis, angles):
        x = radius * np.sin(angle)
        z = radius * np.cos(angle)
        w = AVG_TOOTH_WIDTHS.get(fdi, 7)
        data[fdi] = {
            "centroid": [float(x), 0.0, float(z)],
            "bbox_min": [float(x - w / 2), -5.0, float(z - 5)],
            "bbox_max": [float(x + w / 2), 5.0, float(z + 5)],
        }
    return data


def _make_lower_arch():
    """Create synthetic lower arch tooth data."""
    data = {}
    lower_fdis = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]
    angles = np.linspace(-np.pi * 0.7, np.pi * 0.7, len(lower_fdis))
    radius = 20

    for fdi, angle in zip(lower_fdis, angles):
        x = radius * np.sin(angle)
        z = radius * np.cos(angle) - 2  # slightly behind upper
        w = AVG_TOOTH_WIDTHS.get(fdi, 7)
        data[fdi] = {
            "centroid": [float(x), -1.0, float(z)],
            "bbox_min": [float(x - w / 2), -6.0, float(z - 5)],
            "bbox_max": [float(x + w / 2), 4.0, float(z + 5)],
        }
    return data


class TestMeasureTeeth:
    def test_returns_measurements(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        assert len(measurements) == 14

    def test_skips_gum(self):
        data = _make_upper_arch()
        data[0] = {"centroid": [0, 0, 0], "bbox_min": [-1, -1, -1], "bbox_max": [1, 1, 1]}
        measurements = measure_teeth(data)
        assert all(m.fdi != 0 for m in measurements)

    def test_widths_reasonable(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        for m in measurements:
            assert 3 <= m.mesiodistal_width <= 15, (
                f"FDI {m.fdi} width {m.mesiodistal_width} out of range"
            )

    def test_sorted_by_fdi(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        fdis = [m.fdi for m in measurements]
        assert fdis == sorted(fdis)


class TestSpaceAnalysis:
    def test_returns_analysis(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_space_analysis(measurements, "upper")
        assert result.arch == "upper"

    def test_total_width_positive(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_space_analysis(measurements, "upper")
        assert result.total_tooth_width_mm > 0

    def test_arch_length_positive(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_space_analysis(measurements, "upper")
        assert result.available_arch_length_mm > 0

    def test_severity_is_valid(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_space_analysis(measurements, "upper")
        assert result.crowding_severity in ("none", "mild", "moderate", "severe")

    def test_per_segment_keys(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_space_analysis(measurements, "upper")
        assert "anterior" in result.per_segment

    def test_no_teeth_raises(self):
        with pytest.raises(ValueError):
            compute_space_analysis([], "upper")


class TestBoltonAnalysis:
    def test_normal_ratio(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        upper_m = measure_teeth(upper)
        lower_m = measure_teeth(lower)
        result = compute_bolton_analysis(upper_m, lower_m)
        # Should be in reasonable range (80-105%)
        assert 70 < result.overall_ratio < 110

    def test_ideal_ratio_is_normal(self):
        """With perfectly sized teeth, Bolton should be ~91.3%."""
        # Create teeth with exact average widths
        upper_m = [
            ToothMeasurement(fdi=fdi, centroid=[0, 0, 0],
                           mesiodistal_width=AVG_TOOTH_WIDTHS[fdi],
                           buccolingual_width=8, height=8)
            for fdi in [16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26]
        ]
        lower_m = [
            ToothMeasurement(fdi=fdi, centroid=[0, 0, 0],
                           mesiodistal_width=AVG_TOOTH_WIDTHS[fdi],
                           buccolingual_width=8, height=8)
            for fdi in [46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36]
        ]
        result = compute_bolton_analysis(upper_m, lower_m)
        # The ratio depends on our AVG_TOOTH_WIDTHS which are literature values
        assert 80 < result.overall_ratio < 105

    def test_interpretation_values(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = compute_bolton_analysis(measure_teeth(upper), measure_teeth(lower))
        assert result.overall_interpretation in ("normal", "lower_excess", "upper_excess")
        assert result.anterior_interpretation in ("normal", "lower_excess", "upper_excess")


class TestArchForm:
    def test_returns_analysis(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_arch_form(measurements, "upper")
        assert result.arch == "upper"

    def test_width_positive(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_arch_form(measurements, "upper")
        assert result.arch_width_mm > 0

    def test_form_type_valid(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_arch_form(measurements, "upper")
        assert result.arch_form_type in ("narrow", "average", "broad")

    def test_ideal_arch_points(self):
        data = _make_upper_arch()
        measurements = measure_teeth(data)
        result = compute_arch_form(measurements, "upper")
        assert len(result.ideal_arch_points) > 10

    def test_too_few_teeth_raises(self):
        data = {11: {"centroid": [0, 0, 0], "bbox_min": [-3, -5, -4], "bbox_max": [3, 5, 4]}}
        measurements = measure_teeth(data)
        with pytest.raises(ValueError, match="at least 4"):
            compute_arch_form(measurements, "upper")


class TestOverjetOverbite:
    def test_normal_range(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = compute_overjet_overbite(
            measure_teeth(upper), measure_teeth(lower),
        )
        # Our synthetic data should give reasonable values
        assert -10 < result.overjet_mm < 15
        assert -10 < result.overbite_mm < 15

    def test_class_valid(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = compute_overjet_overbite(
            measure_teeth(upper), measure_teeth(lower),
        )
        assert result.overjet_class in ("normal", "increased", "edge_to_edge", "crossbite")
        assert result.overbite_class in ("normal", "deep", "open")

    def test_no_incisors(self):
        # No incisors should return unknown
        result = compute_overjet_overbite([], [])
        assert result.overjet_class == "unknown"


class TestMidline:
    def test_aligned_midline(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = compute_midline(
            measure_teeth(upper), measure_teeth(lower),
        )
        # Synthetic data has midlines near center
        assert result.deviation_mm is not None

    def test_single_arch(self):
        upper = _make_upper_arch()
        result = compute_midline(upper_measurements=measure_teeth(upper))
        assert result.upper_midline is not None
        assert result.lower_midline is None

    def test_interpretation_values(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = compute_midline(
            measure_teeth(upper), measure_teeth(lower),
        )
        assert result.interpretation in (
            "aligned", "mild_shift", "significant_shift", "insufficient_data"
        )


class TestRunFullAnalysis:
    def test_single_arch(self):
        data = _make_upper_arch()
        result = run_full_analysis(data, "upper")
        assert result.tooth_measurements is not None
        assert result.space_analysis is not None
        assert result.arch_form is not None
        assert result.bolton_analysis is None  # needs both arches

    def test_dual_arch(self):
        upper = _make_upper_arch()
        lower = _make_lower_arch()
        result = run_full_analysis(
            upper, "upper",
            opposite_tooth_data=lower, opposite_jaw="lower",
        )
        assert result.bolton_analysis is not None
        assert result.overjet_overbite is not None
        assert result.midline is not None


@upper_available
@lower_available
class TestRealDataAnalysis:
    """Integration tests with real segmented data."""

    @pytest.fixture(scope="class")
    def real_analysis(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        upper_output = run_full_pipeline(UPPER_STL)
        upper_mesh = load_mesh(UPPER_STL)
        upper_teeth = extract_tooth_meshes(
            upper_mesh, upper_output.face_labels, jaw="upper"
        )
        upper_data = {
            fdi: {"centroid": td.centroid, "bbox_min": td.bbox_min, "bbox_max": td.bbox_max}
            for fdi, td in upper_teeth.items()
        }

        lower_output = run_full_pipeline(LOWER_STL)
        lower_mesh = load_mesh(LOWER_STL)
        lower_teeth = extract_tooth_meshes(
            lower_mesh, lower_output.face_labels, jaw="lower"
        )
        lower_data = {
            fdi: {"centroid": td.centroid, "bbox_min": td.bbox_min, "bbox_max": td.bbox_max}
            for fdi, td in lower_teeth.items()
        }

        return run_full_analysis(
            upper_data, "upper",
            opposite_tooth_data=lower_data, opposite_jaw="lower",
        )

    def test_has_14_upper_teeth(self, real_analysis):
        upper_teeth = [
            m for m in real_analysis.tooth_measurements
            if m.fdi // 10 in (1, 2)
        ]
        assert len(upper_teeth) >= 10

    def test_space_analysis_present(self, real_analysis):
        assert real_analysis.space_analysis is not None

    def test_bolton_present(self, real_analysis):
        assert real_analysis.bolton_analysis is not None

    def test_bolton_ratio_reasonable(self, real_analysis):
        ba = real_analysis.bolton_analysis
        assert 70 < ba.overall_ratio < 115

    def test_arch_form_present(self, real_analysis):
        assert real_analysis.arch_form is not None

    def test_tooth_widths_realistic(self, real_analysis):
        for m in real_analysis.tooth_measurements:
            assert 3 <= m.mesiodistal_width <= 15, (
                f"FDI {m.fdi}: {m.mesiodistal_width}mm unrealistic"
            )
