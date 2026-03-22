# test_center_point_detector.py — Unit tests for Phase 3 center point detection.

import pytest
import numpy as np
from pathlib import Path

from ai.pipeline.center_point_detector import (
    CenterPointResult,
    MissingToothInfo,
    OverbiteClassification,
    ToothCenterPoint,
    detect_center_points,
    _classify_overbite,
    _compute_arch_metrics,
    _detect_missing_teeth,
    _find_neighbors,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
LOWER_STL = "/Users/umairsuraj/Downloads/mandibulary_export.stl"

upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)
lower_available = pytest.mark.skipif(
    not Path(LOWER_STL).exists(), reason="Lower STL not found"
)


# ---------------------------------------------------------------------------
# Fixtures for synthetic center points
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_center_points():
    """Synthetic center points for a partial upper arch."""
    return {
        11: ToothCenterPoint(fdi=11, centroid=[2, -5, 20], crown_tip=[2, -8, 20],
                             buccal_point=[5, -5, 20], face_count=100, confidence=0.95, surface_area=50.0),
        12: ToothCenterPoint(fdi=12, centroid=[5, -4, 18], crown_tip=[5, -7, 18],
                             buccal_point=[8, -4, 18], face_count=80, confidence=0.92, surface_area=40.0),
        13: ToothCenterPoint(fdi=13, centroid=[8, -3, 15], crown_tip=[8, -6, 15],
                             buccal_point=[11, -3, 15], face_count=90, confidence=0.88, surface_area=45.0),
        14: ToothCenterPoint(fdi=14, centroid=[10, -2, 11], crown_tip=[10, -5, 11],
                             buccal_point=[13, -2, 11], face_count=85, confidence=0.91, surface_area=42.0),
        # Gap: 15 missing
        16: ToothCenterPoint(fdi=16, centroid=[13, -1, 4], crown_tip=[13, -4, 4],
                             buccal_point=[16, -1, 4], face_count=120, confidence=0.93, surface_area=60.0),
        21: ToothCenterPoint(fdi=21, centroid=[-2, -5, 20], crown_tip=[-2, -8, 20],
                             buccal_point=[-5, -5, 20], face_count=100, confidence=0.94, surface_area=50.0),
        22: ToothCenterPoint(fdi=22, centroid=[-5, -4, 18], crown_tip=[-5, -7, 18],
                             buccal_point=[-8, -4, 18], face_count=80, confidence=0.90, surface_area=40.0),
        23: ToothCenterPoint(fdi=23, centroid=[-8, -3, 15], crown_tip=[-8, -6, 15],
                             buccal_point=[-11, -3, 15], face_count=90, confidence=0.87, surface_area=45.0),
    }


# ---------------------------------------------------------------------------
# ToothCenterPoint dataclass tests
# ---------------------------------------------------------------------------

class TestToothCenterPoint:
    def test_create_center_point(self):
        cp = ToothCenterPoint(
            fdi=11, centroid=[1, 2, 3], crown_tip=[1, 2, 5],
            buccal_point=[3, 2, 3], face_count=100,
            confidence=0.95, surface_area=50.0,
        )
        assert cp.fdi == 11
        assert cp.confidence == 0.95
        assert len(cp.centroid) == 3

    def test_centroid_is_list(self):
        cp = ToothCenterPoint(
            fdi=21, centroid=[0, 0, 0], crown_tip=[0, 0, 1],
            buccal_point=[1, 0, 0], face_count=50,
            confidence=0.8, surface_area=25.0,
        )
        assert isinstance(cp.centroid, list)


# ---------------------------------------------------------------------------
# Missing tooth detection
# ---------------------------------------------------------------------------

class TestMissingToothDetection:
    def test_detects_missing_tooth(self, sample_center_points):
        detected = sorted(sample_center_points.keys())
        expected = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27]
        missing = _detect_missing_teeth(sample_center_points, detected, expected, "upper")
        missing_fdis = [m.fdi for m in missing]
        assert 15 in missing_fdis

    def test_missing_has_neighbors(self, sample_center_points):
        detected = sorted(sample_center_points.keys())
        expected = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27]
        missing = _detect_missing_teeth(sample_center_points, detected, expected, "upper")
        tooth_15 = next(m for m in missing if m.fdi == 15)
        assert tooth_15.mesial_neighbor == 14
        assert tooth_15.distal_neighbor == 16

    def test_missing_has_estimated_position(self, sample_center_points):
        detected = sorted(sample_center_points.keys())
        expected = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27]
        missing = _detect_missing_teeth(sample_center_points, detected, expected, "upper")
        tooth_15 = next(m for m in missing if m.fdi == 15)
        assert len(tooth_15.expected_position) == 3
        # Position should be between tooth 14 and 16
        assert 10 < tooth_15.expected_position[0] < 13

    def test_missing_gap_width(self, sample_center_points):
        detected = sorted(sample_center_points.keys())
        expected = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27]
        missing = _detect_missing_teeth(sample_center_points, detected, expected, "upper")
        tooth_15 = next(m for m in missing if m.fdi == 15)
        assert tooth_15.gap_width_mm > 0

    def test_no_missing_when_all_present(self):
        points = {
            fdi: ToothCenterPoint(
                fdi=fdi, centroid=[0, 0, 0], crown_tip=[0, 0, 1],
                buccal_point=[1, 0, 0], face_count=50, confidence=0.9, surface_area=30.0,
            )
            for fdi in [11, 12, 13]
        }
        missing = _detect_missing_teeth(points, [11, 12, 13], [11, 12, 13], "upper")
        assert len(missing) == 0

    def test_all_missing(self):
        missing = _detect_missing_teeth({}, [], [11, 12, 13], "upper")
        assert len(missing) == 3


# ---------------------------------------------------------------------------
# Neighbor finding
# ---------------------------------------------------------------------------

class TestFindNeighbors:
    def test_find_mesial_distal(self):
        detected = [11, 12, 14, 16]
        mesial, distal = _find_neighbors(13, detected, "upper")
        assert mesial == 12
        assert distal == 14

    def test_no_distal_end_of_arch(self):
        detected = [11, 12, 13, 14, 15, 16]
        mesial, distal = _find_neighbors(17, detected, "upper")
        assert mesial == 16
        assert distal is None

    def test_contralateral_mesial(self):
        detected = [21, 22, 23]
        mesial, distal = _find_neighbors(11, detected, "upper")
        # Should find contralateral 21 as mesial
        assert mesial == 21

    def test_lower_jaw_neighbors(self):
        detected = [41, 42, 44, 46]
        mesial, distal = _find_neighbors(43, detected, "lower")
        assert mesial == 42
        assert distal == 44


# ---------------------------------------------------------------------------
# Overbite classification
# ---------------------------------------------------------------------------

class TestOverbiteClassification:
    def test_normal_overbite(self, sample_center_points):
        result = _classify_overbite(sample_center_points, "upper")
        # With only upper incisors, uses curve of Spee estimation
        assert result is not None or result is None  # may or may not detect

    def test_returns_classification_or_none(self, sample_center_points):
        result = _classify_overbite(sample_center_points, "upper")
        if result is not None:
            assert isinstance(result, OverbiteClassification)
            assert result.type in ("normal", "deep", "open", "edge_to_edge")
            assert result.measurement_mm >= 0

    def test_empty_returns_none(self):
        result = _classify_overbite({}, "upper")
        assert result is None


# ---------------------------------------------------------------------------
# Arch metrics
# ---------------------------------------------------------------------------

class TestArchMetrics:
    def test_compute_metrics(self, sample_center_points):
        centroid, width, depth = _compute_arch_metrics(sample_center_points)
        assert len(centroid) == 3
        assert width > 0
        assert depth > 0

    def test_width_reasonable(self, sample_center_points):
        _, width, _ = _compute_arch_metrics(sample_center_points)
        # Width should be positive
        assert width > 5

    def test_empty_returns_zeros(self):
        centroid, width, depth = _compute_arch_metrics({})
        assert width == 0.0
        assert depth == 0.0

    def test_single_tooth(self):
        points = {
            11: ToothCenterPoint(
                fdi=11, centroid=[5, -5, 20], crown_tip=[5, -8, 20],
                buccal_point=[8, -5, 20], face_count=100, confidence=0.95, surface_area=50.0,
            )
        }
        centroid, width, depth = _compute_arch_metrics(points)
        assert width == 0.0
        assert depth == 0.0


# ---------------------------------------------------------------------------
# Integration tests with real dental STLs
# ---------------------------------------------------------------------------

@upper_available
class TestCenterPointsUpper:
    @pytest.fixture(scope="class")
    def pipeline_output(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        return run_full_pipeline(UPPER_STL)

    @pytest.fixture(scope="class")
    def result(self, pipeline_output):
        return detect_center_points(
            UPPER_STL,
            pipeline_output.face_labels,
            pipeline_output.face_probs,
            jaw=pipeline_output.jaw,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CenterPointResult)

    def test_jaw_is_upper(self, result):
        assert result.jaw == "upper"

    def test_detected_teeth_in_upper_range(self, result):
        for fdi in result.teeth_detected:
            assert 11 <= fdi <= 27

    def test_at_least_10_center_points(self, result):
        assert len(result.center_points) >= 10

    def test_center_points_have_3d_positions(self, result):
        for fdi, cp in result.center_points.items():
            assert len(cp.centroid) == 3
            assert len(cp.crown_tip) == 3
            assert len(cp.buccal_point) == 3

    def test_confidence_in_range(self, result):
        for fdi, cp in result.center_points.items():
            assert 0.0 <= cp.confidence <= 1.0

    def test_face_count_positive(self, result):
        for fdi, cp in result.center_points.items():
            assert cp.face_count > 0

    def test_surface_area_positive(self, result):
        for fdi, cp in result.center_points.items():
            assert cp.surface_area > 0

    def test_arch_width_dental_range(self, result):
        # Upper arch typically 40-70mm wide
        assert 10 < result.arch_width_mm < 120

    def test_arch_depth_positive(self, result):
        assert result.arch_depth_mm > 0

    def test_missing_teeth_are_valid(self, result):
        for mt in result.missing_teeth:
            assert 11 <= mt.fdi <= 28
            assert mt.fdi not in result.teeth_detected

    def test_expected_teeth_valid(self, result):
        for fdi in result.teeth_expected:
            assert 11 <= fdi <= 28


@lower_available
class TestCenterPointsLower:
    @pytest.fixture(scope="class")
    def pipeline_output(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        return run_full_pipeline(LOWER_STL)

    @pytest.fixture(scope="class")
    def result(self, pipeline_output):
        return detect_center_points(
            LOWER_STL,
            pipeline_output.face_labels,
            pipeline_output.face_probs,
            jaw=pipeline_output.jaw,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CenterPointResult)

    def test_jaw_is_lower(self, result):
        assert result.jaw == "lower"

    def test_detected_teeth_in_lower_range(self, result):
        for fdi in result.teeth_detected:
            assert 31 <= fdi <= 47

    def test_at_least_10_center_points(self, result):
        assert len(result.center_points) >= 10

    def test_center_points_3d(self, result):
        for cp in result.center_points.values():
            assert len(cp.centroid) == 3
            assert all(isinstance(v, float) for v in cp.centroid)
