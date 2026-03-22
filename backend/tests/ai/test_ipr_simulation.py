# test_ipr_simulation.py — Unit tests for IPR simulation.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.ipr_simulation import (
    compute_ipr_plan,
    simulate_ipr_effect,
    IPRPlan,
    IPRContact,
    MAX_IPR_PER_CONTACT_MM,
    MAX_TOTAL_IPR_PER_ARCH_MM,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_separated_teeth():
    """Create teeth with clear gaps (no crowding)."""
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 12  # 12mm apart — well separated
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


def _make_crowded_teeth():
    """Create teeth that are crowded (overlapping bboxes)."""
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 4  # 4mm apart — bboxes overlap (width=6mm)
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


class TestComputeIPRPlan:
    def test_returns_plan(self):
        data = _make_separated_teeth()
        plan = compute_ipr_plan(data, "upper")
        assert isinstance(plan, IPRPlan)

    def test_plan_jaw(self):
        data = _make_separated_teeth()
        plan = compute_ipr_plan(data, "upper")
        assert plan.jaw == "upper"

    def test_no_ipr_when_no_crowding_separated(self):
        data = _make_separated_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=0)
        assert plan.total_ipr_mm == 0

    def test_ipr_when_crowded(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=3.0)
        assert plan.total_ipr_mm > 0

    def test_contacts_present(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        assert len(plan.contacts) > 0

    def test_contact_fields(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        for c in plan.contacts:
            assert isinstance(c, IPRContact)
            assert hasattr(c, "fdi_a")
            assert hasattr(c, "fdi_b")
            assert hasattr(c, "current_gap_mm")
            assert hasattr(c, "suggested_ipr_mm")
            assert hasattr(c, "max_safe_ipr_mm")

    def test_ipr_per_contact_within_limit(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=5.0)
        for c in plan.contacts:
            assert c.suggested_ipr_mm <= MAX_IPR_PER_CONTACT_MM + 0.01

    def test_max_safe_ipr_positive(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        for c in plan.contacts:
            assert c.max_safe_ipr_mm > 0

    def test_ipr_sufficient_flag(self):
        data = _make_separated_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=0)
        assert plan.ipr_sufficient is True

    def test_excessive_crowding_not_sufficient(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=50.0)
        # 50mm crowding can't be resolved by IPR alone
        assert plan.ipr_sufficient is False

    def test_warnings_for_excessive_ipr(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=50.0)
        assert len(plan.warnings) > 0

    def test_custom_ipr_override(self):
        data = _make_crowded_teeth()
        custom = {(11, 21): 0.3}
        plan = compute_ipr_plan(data, "upper", crowding_mm=1.0, custom_ipr=custom)
        # Find the 11-21 contact
        found = False
        for c in plan.contacts:
            if {c.fdi_a, c.fdi_b} == {11, 21}:
                assert c.suggested_ipr_mm == 0.3
                found = True
        assert found, "Custom IPR contact 11-21 not found"

    def test_lower_jaw(self):
        data = {}
        for i, fdi in enumerate([47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]):
            x = (i - 7) * 4
            data[fdi] = {
                "centroid": [x, 0, 0],
                "bbox_min": [x - 3, -5, -4],
                "bbox_max": [x + 3, 5, 4],
            }
        plan = compute_ipr_plan(data, "lower", crowding_mm=2.0)
        assert plan.jaw == "lower"
        assert len(plan.contacts) > 0

    def test_ipr_rounded_to_increment(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        for c in plan.contacts:
            if c.suggested_ipr_mm > 0:
                # Should be rounded to 0.1mm
                assert abs(c.suggested_ipr_mm * 10 - round(c.suggested_ipr_mm * 10)) < 0.01


class TestSimulateIPREffect:
    def test_returns_modified_data(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        modified = simulate_ipr_effect(data, plan)
        assert isinstance(modified, dict)
        assert len(modified) == len(data)

    def test_teeth_move_closer(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        modified = simulate_ipr_effect(data, plan)

        # At least some teeth should have moved
        any_moved = False
        for fdi in data:
            orig = np.array(data[fdi]["centroid"])
            new = np.array(modified[fdi]["centroid"])
            if np.linalg.norm(new - orig) > 0.01:
                any_moved = True
                break
        assert any_moved

    def test_no_movement_without_ipr(self):
        data = _make_separated_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=0)
        modified = simulate_ipr_effect(data, plan)

        for fdi in data:
            orig = np.array(data[fdi]["centroid"])
            new = np.array(modified[fdi]["centroid"])
            assert np.linalg.norm(new - orig) < 0.01

    def test_bbox_also_moves(self):
        data = _make_crowded_teeth()
        plan = compute_ipr_plan(data, "upper", crowding_mm=2.0)
        modified = simulate_ipr_effect(data, plan)

        # If centroid moved, bbox should also move
        for fdi in data:
            orig_c = np.array(data[fdi]["centroid"])
            new_c = np.array(modified[fdi]["centroid"])
            if np.linalg.norm(new_c - orig_c) > 0.01:
                orig_bmin = np.array(data[fdi]["bbox_min"])
                new_bmin = np.array(modified[fdi]["bbox_min"])
                assert np.linalg.norm(new_bmin - orig_bmin) > 0.01


@upper_available
class TestRealDataIPR:
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

    def test_ipr_plan_computes(self, tooth_data):
        plan = compute_ipr_plan(tooth_data, "upper", crowding_mm=2.0)
        assert len(plan.contacts) >= 5

    def test_simulate_effect(self, tooth_data):
        plan = compute_ipr_plan(tooth_data, "upper", crowding_mm=2.0)
        modified = simulate_ipr_effect(tooth_data, plan)
        assert len(modified) == len(tooth_data)
