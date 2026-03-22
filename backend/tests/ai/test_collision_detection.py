# test_collision_detection.py — Unit tests for collision detection.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.collision_detection import (
    detect_collisions_bbox,
    detect_collisions_per_stage,
    compute_interproximal_distances,
    ADJACENT_PAIRS,
    CollisionReport,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_separated_teeth():
    """Create teeth with clear gaps between them (no collisions)."""
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 12  # 12mm apart — well separated
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


def _make_overlapping_teeth():
    """Create teeth that overlap (collisions expected)."""
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 4  # 4mm apart — bboxes overlap (width=6mm)
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


class TestDetectCollisionsBBox:
    def test_no_collisions_separated(self):
        data = _make_separated_teeth()
        report = detect_collisions_bbox(data)
        assert report.collision_count == 0

    def test_detects_overlaps(self):
        data = _make_overlapping_teeth()
        report = detect_collisions_bbox(data)
        assert report.collision_count > 0

    def test_returns_report(self):
        data = _make_separated_teeth()
        report = detect_collisions_bbox(data)
        assert isinstance(report, CollisionReport)
        assert report.total_pairs_checked > 0

    def test_max_overlap_zero_when_separated(self):
        data = _make_separated_teeth()
        report = detect_collisions_bbox(data)
        assert report.max_overlap_mm == 0

    def test_overlap_amount_positive(self):
        data = _make_overlapping_teeth()
        report = detect_collisions_bbox(data)
        assert report.max_overlap_mm > 0

    def test_with_transforms(self):
        data = _make_separated_teeth()
        # Move tooth 11 to overlap with 12
        transforms = {11: {"pos_x": -10, "pos_y": 0, "pos_z": 0}}
        report = detect_collisions_bbox(data, transforms)
        # At least the 11-12 pair should collide
        colliding = [c for c in report.collisions if c.colliding]
        assert len(colliding) >= 1

    def test_margin_makes_near_teeth_collide(self):
        data = _make_separated_teeth()
        # With a large enough margin, separated teeth trigger
        report = detect_collisions_bbox(data, margin_mm=10)
        assert len(report.collisions) > 0


class TestCollisionsPerStage:
    def test_returns_list(self):
        data = _make_separated_teeth()
        stages = [
            {},  # stage 0: no transforms
            {11: {"pos_x": -10, "pos_y": 0, "pos_z": 0}},  # stage 1
        ]
        reports = detect_collisions_per_stage(data, stages)
        assert len(reports) == 2

    def test_later_stage_has_collision(self):
        data = _make_separated_teeth()
        stages = [
            {},
            {11: {"pos_x": -10, "pos_y": 0, "pos_z": 0}},
        ]
        reports = detect_collisions_per_stage(data, stages)
        assert reports[0].collision_count == 0
        assert reports[1].collision_count >= 1


class TestInterproximalDistances:
    def test_returns_distances(self):
        data = _make_separated_teeth()
        distances = compute_interproximal_distances(data)
        assert len(distances) > 0

    def test_separated_teeth_positive_gap(self):
        data = _make_separated_teeth()
        distances = compute_interproximal_distances(data)
        for d in distances:
            assert d["distance_mm"] > 0, f"FDI {d['fdi_a']}-{d['fdi_b']} should have positive gap"

    def test_overlapping_teeth_negative_gap(self):
        data = _make_overlapping_teeth()
        distances = compute_interproximal_distances(data)
        has_negative = any(d["distance_mm"] < 0 for d in distances)
        assert has_negative

    def test_contact_type_valid(self):
        data = _make_separated_teeth()
        distances = compute_interproximal_distances(data)
        valid_types = {"spaced", "light_contact", "tight_contact", "overlap"}
        for d in distances:
            assert d["contact_type"] in valid_types


@upper_available
class TestRealDataCollisions:
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

    def test_detects_all_adjacent_pairs(self, tooth_data):
        report = detect_collisions_bbox(tooth_data)
        assert report.total_pairs_checked >= 10

    def test_distances_computed(self, tooth_data):
        distances = compute_interproximal_distances(tooth_data)
        assert len(distances) >= 10
