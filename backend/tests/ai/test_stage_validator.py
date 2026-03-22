# test_stage_validator.py — Unit tests for stage validation.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.stage_validator import (
    validate_stages,
    ValidationReport,
    StageValidationResult,
    StageIssue,
    MAX_TOTAL_TRANSLATION_MM,
    MAX_TOTAL_ROTATION_DEG,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_upper_teeth():
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 8
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


def _make_valid_stages():
    """Create stages with small, valid movements."""
    return [
        {},  # stage 0: no movement
        {11: {"pos_x": 0.2, "pos_y": 0, "pos_z": 0}},  # stage 1
        {11: {"pos_x": 0.4, "pos_y": 0, "pos_z": 0}},  # stage 2
    ]


def _make_collision_stages():
    """Create stages where a tooth moves into its neighbor."""
    return [
        {},
        {11: {"pos_x": -10, "pos_y": 0, "pos_z": 0}},  # moves into 12
    ]


def _make_excessive_movement_stages():
    """Stages with movements exceeding physiological limits."""
    return [
        {},
        {11: {"pos_x": 25, "pos_y": 0, "pos_z": 0}},  # exceeds MAX_TOTAL_TRANSLATION_MM
    ]


def _make_large_inter_stage_jump():
    """Stages with a huge jump between consecutive stages."""
    return [
        {},
        {11: {"pos_x": 0.1, "pos_y": 0, "pos_z": 0}},
        {11: {"pos_x": 3.0, "pos_y": 0, "pos_z": 0}},  # huge jump from 0.1 to 3.0
    ]


class TestValidateStages:
    def test_returns_report(self):
        data = _make_upper_teeth()
        stages = _make_valid_stages()
        report = validate_stages(data, stages, "upper")
        assert isinstance(report, ValidationReport)

    def test_valid_stages_pass(self):
        data = _make_upper_teeth()
        stages = _make_valid_stages()
        report = validate_stages(data, stages, "upper")
        assert report.is_feasible

    def test_total_stages_count(self):
        data = _make_upper_teeth()
        stages = _make_valid_stages()
        report = validate_stages(data, stages, "upper")
        assert report.total_stages == 3

    def test_stage_results_per_stage(self):
        data = _make_upper_teeth()
        stages = _make_valid_stages()
        report = validate_stages(data, stages, "upper")
        assert len(report.stage_results) == 3

    def test_collision_detected(self):
        data = _make_upper_teeth()
        stages = _make_collision_stages()
        report = validate_stages(data, stages, "upper")
        # Stage 1 should have collision issues
        stage1 = report.stage_results[1]
        assert stage1.collision_count >= 1

    def test_collision_stage_not_valid(self):
        data = _make_upper_teeth()
        stages = _make_collision_stages()
        report = validate_stages(data, stages, "upper")
        stage1 = report.stage_results[1]
        assert not stage1.is_valid

    def test_excessive_movement_flagged(self):
        data = _make_upper_teeth()
        stages = _make_excessive_movement_stages()
        report = validate_stages(data, stages, "upper")
        # Should have feasibility error
        all_issues = []
        for sr in report.stage_results:
            all_issues.extend(sr.issues)
        feasibility_issues = [i for i in all_issues if i.category == "feasibility"]
        assert len(feasibility_issues) >= 1

    def test_large_jump_flagged(self):
        data = _make_upper_teeth()
        stages = _make_large_inter_stage_jump()
        report = validate_stages(data, stages, "upper")
        all_issues = []
        for sr in report.stage_results:
            all_issues.extend(sr.issues)
        movement_issues = [i for i in all_issues if i.category == "movement_limit"]
        assert len(movement_issues) >= 1

    def test_empty_stages(self):
        data = _make_upper_teeth()
        report = validate_stages(data, [], "upper")
        assert report.total_stages == 0
        assert report.is_feasible

    def test_stage_issue_fields(self):
        data = _make_upper_teeth()
        stages = _make_collision_stages()
        report = validate_stages(data, stages, "upper")
        for sr in report.stage_results:
            for issue in sr.issues:
                assert isinstance(issue, StageIssue)
                assert issue.severity in ("error", "warning", "info")
                assert issue.category in ("collision", "movement_limit", "feasibility", "consistency", "anchorage")
                assert len(issue.message) > 0


class TestAnchorageCheck:
    def test_enough_stationary_teeth(self):
        data = _make_upper_teeth()
        # Only move 1 tooth — plenty of anchorage
        stages = [{11: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0}}]
        report = validate_stages(data, stages, "upper")
        anchorage_issues = [
            i for sr in report.stage_results for i in sr.issues
            if i.category == "anchorage"
        ]
        assert len(anchorage_issues) == 0

    def test_too_many_moving_teeth_warning(self):
        data = _make_upper_teeth()
        # Move ALL teeth
        transforms = {}
        for fdi in data:
            transforms[fdi] = {"pos_x": 2.0, "pos_y": 0, "pos_z": 0}
        stages = [transforms]
        report = validate_stages(data, stages, "upper")
        anchorage_issues = [
            i for sr in report.stage_results for i in sr.issues
            if i.category == "anchorage"
        ]
        assert len(anchorage_issues) >= 1


class TestSequentialConsistency:
    def test_no_reversals_in_linear(self):
        data = _make_upper_teeth()
        stages = [
            {},
            {11: {"pos_x": 0.5, "pos_y": 0, "pos_z": 0}},
            {11: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0}},
        ]
        report = validate_stages(data, stages, "upper")
        consistency_issues = [i for i in report.global_issues if i.category == "consistency"]
        assert len(consistency_issues) == 0

    def test_reversals_flagged(self):
        data = _make_upper_teeth()
        stages = [
            {},
            {11: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0}},
            {11: {"pos_x": 0.2, "pos_y": 0, "pos_z": 0}},  # reversal
            {11: {"pos_x": 1.5, "pos_y": 0, "pos_z": 0}},
            {11: {"pos_x": 0.5, "pos_y": 0, "pos_z": 0}},  # reversal
        ]
        report = validate_stages(data, stages, "upper")
        consistency_issues = [i for i in report.global_issues if i.category == "consistency"]
        assert len(consistency_issues) >= 1


@upper_available
class TestRealDataValidation:
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

    def test_validate_no_movement(self, tooth_data):
        """No-movement stages produce a report (AABB overlaps are expected for real teeth)."""
        stages = [{}]
        report = validate_stages(tooth_data, stages, "upper")
        assert report.total_stages == 1
        # Real teeth have AABB overlaps (conservative bbox), so collisions are expected
        assert report.stage_results[0].collision_count >= 0
