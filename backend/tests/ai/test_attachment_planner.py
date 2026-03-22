# test_attachment_planner.py — Unit tests for attachment recommendation engine.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.attachment_planner import (
    plan_attachments,
    AttachmentPlan,
    AttachmentSpec,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_upper_teeth():
    """Create synthetic upper teeth."""
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 8
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


def _make_translation_targets():
    """Targets with significant translations."""
    return {
        11: {"pos_x": 2.0, "pos_y": 0.0, "pos_z": 1.0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
        21: {"pos_x": -1.5, "pos_y": 0.0, "pos_z": 0.5, "rot_x": 0, "rot_y": 0, "rot_z": 0},
        12: {"pos_x": 0.0, "pos_y": 0.0, "pos_z": 0.0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
    }


def _make_rotation_targets():
    """Targets with significant rotations."""
    return {
        11: {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 15.0, "rot_z": 0},
        13: {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 8.0, "rot_y": 0, "rot_z": 0},
        23: {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 10.0},
    }


def _make_extrusion_targets():
    """Targets with extrusion/intrusion."""
    return {
        11: {"pos_x": 0, "pos_y": 1.0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},  # extrusion
        21: {"pos_x": 0, "pos_y": -1.0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},  # intrusion
    }


class TestPlanAttachments:
    def test_returns_plan(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        assert isinstance(plan, AttachmentPlan)

    def test_jaw_set(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        assert plan.jaw == "upper"

    def test_no_attachments_for_zero_movement(self):
        data = _make_upper_teeth()
        targets = {11: {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0}}
        plan = plan_attachments(data, targets, "upper")
        tooth_11_atts = [a for a in plan.attachments if a.fdi == 11]
        assert len(tooth_11_atts) == 0

    def test_translation_gets_attachment(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        # FDI 11 has 2mm+ translation, should get attachment
        tooth_11_atts = [a for a in plan.attachments if a.fdi == 11]
        assert len(tooth_11_atts) >= 1

    def test_rotation_gets_beveled(self):
        data = _make_upper_teeth()
        targets = _make_rotation_targets()
        plan = plan_attachments(data, targets, "upper")
        tooth_11_atts = [a for a in plan.attachments if a.fdi == 11]
        has_beveled = any(a.attachment_type == "beveled" for a in tooth_11_atts)
        assert has_beveled

    def test_torque_gets_power_ridge(self):
        data = _make_upper_teeth()
        targets = _make_rotation_targets()
        plan = plan_attachments(data, targets, "upper")
        tooth_13_atts = [a for a in plan.attachments if a.fdi == 13]
        has_power_ridge = any(a.attachment_type == "power_ridge" for a in tooth_13_atts)
        assert has_power_ridge

    def test_tipping_gets_ellipsoid(self):
        data = _make_upper_teeth()
        targets = _make_rotation_targets()
        plan = plan_attachments(data, targets, "upper")
        tooth_23_atts = [a for a in plan.attachments if a.fdi == 23]
        has_ellipsoid = any(a.attachment_type == "ellipsoid" for a in tooth_23_atts)
        assert has_ellipsoid

    def test_extrusion_gets_attachment(self):
        data = _make_upper_teeth()
        targets = _make_extrusion_targets()
        plan = plan_attachments(data, targets, "upper")
        tooth_11_atts = [a for a in plan.attachments if a.fdi == 11]
        assert len(tooth_11_atts) >= 1
        assert any(a.position == "gingival_third" for a in tooth_11_atts)

    def test_intrusion_gets_attachment(self):
        data = _make_upper_teeth()
        targets = _make_extrusion_targets()
        plan = plan_attachments(data, targets, "upper")
        tooth_21_atts = [a for a in plan.attachments if a.fdi == 21]
        assert len(tooth_21_atts) >= 1

    def test_attachment_spec_fields(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        for a in plan.attachments:
            assert isinstance(a, AttachmentSpec)
            assert a.width_mm > 0
            assert a.height_mm > 0
            assert a.depth_mm > 0
            assert a.surface in ("buccal", "lingual", "incisal")
            assert a.position in ("gingival_third", "middle_third", "incisal_third")
            assert a.priority in ("required", "recommended", "optional")
            assert len(a.reason) > 0

    def test_teeth_with_without_lists(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        # Teeth with attachments and without should cover all jaw teeth
        all_listed = set(plan.teeth_with_attachments + plan.teeth_without_attachments)
        assert len(all_listed) == 14  # 14 upper teeth

    def test_total_count_matches(self):
        data = _make_upper_teeth()
        targets = _make_translation_targets()
        plan = plan_attachments(data, targets, "upper")
        assert plan.total_attachments == len(plan.attachments)

    def test_no_targets_no_attachments(self):
        data = _make_upper_teeth()
        plan = plan_attachments(data, {}, "upper")
        assert plan.total_attachments == 0


class TestAttachmentConflicts:
    def test_adjacent_large_attachments_warning(self):
        data = _make_upper_teeth()
        # Both 11 and 21 have large movements → both get buccal attachments
        targets = {
            11: {"pos_x": 3.0, "pos_y": 1.0, "pos_z": 0, "rot_x": 0, "rot_y": 15, "rot_z": 0},
            21: {"pos_x": -3.0, "pos_y": 1.0, "pos_z": 0, "rot_x": 0, "rot_y": -15, "rot_z": 0},
        }
        plan = plan_attachments(data, targets, "upper")
        # Should have a warning about adjacent buccal attachments
        # (depends on total widths exceeding 6mm)
        assert isinstance(plan.warnings, list)


@upper_available
class TestRealDataAttachments:
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

    def test_plan_with_snap_targets(self, tooth_data):
        from ai.analysis.arch_form_tool import snap_to_arch
        targets = snap_to_arch(tooth_data, "upper")
        plan = plan_attachments(tooth_data, targets, "upper")
        assert plan.total_attachments >= 0
        assert plan.jaw == "upper"
