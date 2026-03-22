# test_staging_engine.py — Unit tests for enhanced staging engine.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.staging_engine import (
    compute_staging_plan,
    MovementTarget,
    StagingPlan,
    StageData,
    MAX_TRANSLATION_PER_STAGE_MM,
    MAX_ROTATION_PER_STAGE_DEG,
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


class TestComputeStagingPlan:
    def test_returns_plan(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert isinstance(plan, StagingPlan)

    def test_stage_count_matches_movement(self):
        data = _make_upper_teeth()
        # 1mm translation at 0.25mm/stage = 4 stages
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.total_stages == 4

    def test_rotation_determines_stages(self):
        data = _make_upper_teeth()
        # 10° rotation at 2°/stage = 5 stages
        targets = [MovementTarget(fdi=11, rot_y=10.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.total_stages == 5

    def test_max_of_translation_rotation(self):
        data = _make_upper_teeth()
        # 1mm/0.25 = 4 stages, 10°/2° = 5 stages → max = 5
        targets = [MovementTarget(fdi=11, pos_x=1.0, rot_y=10.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.total_stages == 5

    def test_multiple_teeth_max_stages(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=1.0),   # 4 stages
            MovementTarget(fdi=21, pos_x=2.0),    # 8 stages
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.total_stages == 8

    def test_includes_initial_stage(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        # stages[0] should be initial (all zeros)
        assert plan.stages[0].stage_index == 0
        assert plan.stages[0].label == "Initial"
        assert plan.stages[0].transforms[11]["pos_x"] == 0.0

    def test_final_stage_reaches_target(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        final = plan.stages[-1].transforms[11]
        assert abs(final["pos_x"] - 1.0) < 0.01

    def test_per_tooth_stages(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=1.0),
            MovementTarget(fdi=21, pos_x=0.5),
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.per_tooth_stages[11] == 4
        assert plan.per_tooth_stages[21] == 2

    def test_do_not_move(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=2.0, do_not_move=True),
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.per_tooth_stages[11] == 0
        # All stages should have zero for this tooth
        for stage in plan.stages:
            assert stage.transforms[11]["pos_x"] == 0.0

    def test_do_not_move_warning(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=2.0, do_not_move=True)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert any("DO_NOT_MOVE" in w for w in plan.warnings)

    def test_max_movement_constraint(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=5.0, max_movement_mm=2.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        final = plan.stages[-1].transforms[11]
        assert abs(final["pos_x"]) <= 2.01

    def test_sensitive_root_halves_speed(self):
        data = _make_upper_teeth()
        targets_normal = [MovementTarget(fdi=11, pos_x=1.0)]
        targets_sensitive = [MovementTarget(fdi=11, pos_x=1.0, sensitive_root=True)]
        plan_normal = compute_staging_plan(data, targets_normal, "upper", validate=False)
        plan_sensitive = compute_staging_plan(data, targets_sensitive, "upper", validate=False)
        assert plan_sensitive.total_stages > plan_normal.total_stages


class TestEasing:
    def test_linear_monotonic(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=2.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False, easing="linear")
        positions = [s.transforms[11]["pos_x"] for s in plan.stages]
        for i in range(1, len(positions)):
            assert positions[i] >= positions[i - 1] - 0.001

    def test_ease_in_out_reaches_target(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=2.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False, easing="ease_in_out")
        final = plan.stages[-1].transforms[11]["pos_x"]
        assert abs(final - 2.0) < 0.01

    def test_ease_in_slower_at_start(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=2.0)]
        plan_linear = compute_staging_plan(data, targets, "upper", validate=False, easing="linear")
        plan_ease = compute_staging_plan(data, targets, "upper", validate=False, easing="ease_in")
        # First non-initial stage: ease_in should be slower
        if len(plan_linear.stages) > 1 and len(plan_ease.stages) > 1:
            lin_first = plan_linear.stages[1].transforms[11]["pos_x"]
            ease_first = plan_ease.stages[1].transforms[11]["pos_x"]
            assert ease_first <= lin_first + 0.001

    def test_ease_out_faster_at_start(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=2.0)]
        plan_linear = compute_staging_plan(data, targets, "upper", validate=False, easing="linear")
        plan_ease = compute_staging_plan(data, targets, "upper", validate=False, easing="ease_out")
        if len(plan_linear.stages) > 1 and len(plan_ease.stages) > 1:
            lin_first = plan_linear.stages[1].transforms[11]["pos_x"]
            ease_first = plan_ease.stages[1].transforms[11]["pos_x"]
            assert ease_first >= lin_first - 0.001


class TestSequencing:
    def test_simultaneous_all_start_at_zero(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=1.0),
            MovementTarget(fdi=26, pos_x=1.0),
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False, sequencing="simultaneous")
        # Both teeth should start moving at stage 1
        stage1 = plan.stages[1].transforms
        assert stage1[11]["pos_x"] > 0
        assert stage1[26]["pos_x"] > 0

    def test_anterior_first_delays_posteriors(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=1.0),   # anterior
            MovementTarget(fdi=26, pos_x=1.0),    # posterior
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False, sequencing="anterior_first")
        # Anterior should start moving at stage 1
        stage1 = plan.stages[1].transforms
        assert stage1[11]["pos_x"] > 0
        # Posterior may still be at 0
        assert stage1[26]["pos_x"] <= stage1[11]["pos_x"] + 0.001

    def test_posterior_first_delays_anteriors(self):
        data = _make_upper_teeth()
        targets = [
            MovementTarget(fdi=11, pos_x=1.0),   # anterior
            MovementTarget(fdi=26, pos_x=1.0),    # posterior
        ]
        plan = compute_staging_plan(data, targets, "upper", validate=False, sequencing="posterior_first")
        stage1 = plan.stages[1].transforms
        assert stage1[26]["pos_x"] > 0
        assert stage1[11]["pos_x"] <= stage1[26]["pos_x"] + 0.001


class TestValidation:
    def test_validation_included(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=True)
        assert plan.validation is not None

    def test_validation_skipped(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=False)
        assert plan.validation is None

    def test_valid_plan_is_feasible(self):
        data = _make_upper_teeth()
        targets = [MovementTarget(fdi=11, pos_x=1.0)]
        plan = compute_staging_plan(data, targets, "upper", validate=True)
        assert plan.validation.is_feasible


@upper_available
class TestRealDataStaging:
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

    def test_staging_from_snap(self, tooth_data):
        from ai.analysis.arch_form_tool import snap_to_arch
        targets_dict = snap_to_arch(tooth_data, "upper")
        targets = [
            MovementTarget(
                fdi=fdi,
                pos_x=t.get("pos_x", 0), pos_z=t.get("pos_z", 0),
            )
            for fdi, t in targets_dict.items()
        ]
        plan = compute_staging_plan(tooth_data, targets, "upper", validate=True)
        assert plan.total_stages >= 1
        assert plan.validation is not None
