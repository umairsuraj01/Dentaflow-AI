# test_protocol_tables.py — Unit tests for Phase 8 protocol tables & occlusogram.

import pytest
import numpy as np
import trimesh

from ai.pipeline.protocol_tables import (
    DistanceProtocol,
    DistanceRecord,
    MovementProtocol,
    Occlusogram,
    OcclusalContact,
    SpaceAnalysisSummary,
    ToothMovementRecord,
    generate_distance_protocol,
    generate_movement_protocol,
    generate_occlusogram,
    generate_space_analysis,
    _are_adjacent_fdi,
    _classify_movement,
    _mesh_distance,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def start_centroids():
    return {
        11: [2, -5, 20],
        12: [5, -4, 18],
        13: [8, -3, 15],
        21: [-2, -5, 20],
        22: [-5, -4, 18],
    }


@pytest.fixture
def target_centroids():
    return {
        11: [2.5, -5, 20],
        12: [5.3, -4, 17.5],
        13: [8, -3, 15],   # no movement
        21: [-2.5, -5, 20],
        22: [-5.3, -4, 17.5],
    }


@pytest.fixture
def tooth_meshes():
    meshes = {}
    offsets = {11: [2, -5, 20], 12: [5, -4, 18], 13: [8, -3, 15],
               21: [-2, -5, 20], 22: [-5, -4, 18]}
    for fdi, off in offsets.items():
        m = trimesh.creation.icosphere(subdivisions=1, radius=2.0)
        m.vertices += off
        meshes[fdi] = m
    return meshes


@pytest.fixture
def upper_meshes():
    meshes = {}
    for fdi, x in [(11, 2), (12, 5), (21, -2), (22, -5)]:
        m = trimesh.creation.icosphere(subdivisions=1, radius=2.5)
        m.vertices += [x, -5, 20]
        meshes[fdi] = m
    return meshes


@pytest.fixture
def lower_meshes():
    meshes = {}
    for fdi, x in [(41, 2), (42, 5), (31, -2), (32, -5)]:
        m = trimesh.creation.icosphere(subdivisions=1, radius=2.5)
        m.vertices += [x, -10, 20]  # below upper
        meshes[fdi] = m
    return meshes


# ---------------------------------------------------------------------------
# Movement classification
# ---------------------------------------------------------------------------

class TestMovementClassification:
    def test_bodily(self):
        assert _classify_movement(np.array([1.0, 0, 0]), [0, 0, 0]) == "bodily"

    def test_intrusion(self):
        assert _classify_movement(np.array([0, -1.0, 0]), [0, 0, 0]) == "intrusion"

    def test_extrusion(self):
        assert _classify_movement(np.array([0, 1.0, 0]), [0, 0, 0]) == "extrusion"

    def test_rotation(self):
        assert _classify_movement(np.array([0, 0, 0]), [0, 15, 0]) == "rotation"

    def test_tipping(self):
        assert _classify_movement(np.array([0, 0, 0]), [0, 0, 10]) == "tipping"

    def test_no_movement(self):
        assert _classify_movement(np.array([0, 0, 0]), [0, 0, 0]) == "none"


# ---------------------------------------------------------------------------
# Adjacent FDI check
# ---------------------------------------------------------------------------

class TestAdjacentFDI:
    def test_adjacent_same_quad(self):
        assert _are_adjacent_fdi(11, 12) is True
        assert _are_adjacent_fdi(12, 13) is True

    def test_not_adjacent_same_quad(self):
        assert _are_adjacent_fdi(11, 13) is False

    def test_cross_midline(self):
        assert _are_adjacent_fdi(11, 21) is True
        assert _are_adjacent_fdi(31, 41) is True

    def test_not_adjacent_different_arches(self):
        assert _are_adjacent_fdi(11, 41) is False

    def test_not_adjacent_far(self):
        assert _are_adjacent_fdi(11, 17) is False


# ---------------------------------------------------------------------------
# Movement Protocol
# ---------------------------------------------------------------------------

class TestMovementProtocol:
    def test_generates_records(self, start_centroids, target_centroids):
        protocol = generate_movement_protocol(
            start_centroids, target_centroids, stage=1,
        )
        assert isinstance(protocol, MovementProtocol)
        assert len(protocol.records) == 5

    def test_stage_number(self, start_centroids, target_centroids):
        protocol = generate_movement_protocol(
            start_centroids, target_centroids, stage=3,
        )
        assert protocol.stage == 3

    def test_no_movement_tooth(self, start_centroids, target_centroids):
        protocol = generate_movement_protocol(
            start_centroids, target_centroids, stage=1,
        )
        tooth_13 = next(r for r in protocol.records if r.fdi == 13)
        assert tooth_13.total_displacement_mm < 0.01

    def test_moving_teeth_counted(self, start_centroids, target_centroids):
        protocol = generate_movement_protocol(
            start_centroids, target_centroids, stage=1,
        )
        assert protocol.total_teeth_moving >= 4  # 11, 12, 21, 22 move

    def test_displacement_positive(self, start_centroids, target_centroids):
        protocol = generate_movement_protocol(
            start_centroids, target_centroids, stage=1,
        )
        tooth_11 = next(r for r in protocol.records if r.fdi == 11)
        assert tooth_11.total_displacement_mm > 0

    def test_with_rotations(self, start_centroids, target_centroids):
        start_rot = {fdi: [0, 0, 0] for fdi in start_centroids}
        target_rot = {fdi: [0, 0, 0] for fdi in target_centroids}
        target_rot[11] = [5, 0, 0]

        protocol = generate_movement_protocol(
            start_centroids, target_centroids,
            start_rotations=start_rot, target_rotations=target_rot,
            stage=1,
        )
        tooth_11 = next(r for r in protocol.records if r.fdi == 11)
        assert tooth_11.total_rotation_deg > 0

    def test_empty_input(self):
        protocol = generate_movement_protocol({}, {}, stage=1)
        assert len(protocol.records) == 0
        assert protocol.total_teeth_moving == 0


# ---------------------------------------------------------------------------
# Distance Protocol
# ---------------------------------------------------------------------------

class TestDistanceProtocol:
    def test_generates_records(self, start_centroids):
        protocol = generate_distance_protocol(
            start_centroids, jaw="upper",
        )
        assert isinstance(protocol, DistanceProtocol)
        assert len(protocol.records) > 0

    def test_only_adjacent_pairs(self, start_centroids):
        protocol = generate_distance_protocol(start_centroids, jaw="upper")
        for r in protocol.records:
            assert _are_adjacent_fdi(r.fdi_a, r.fdi_b)

    def test_distances_positive(self, start_centroids):
        protocol = generate_distance_protocol(start_centroids, jaw="upper")
        for r in protocol.records:
            assert r.distance_mm > 0

    def test_with_meshes(self, start_centroids, tooth_meshes):
        protocol = generate_distance_protocol(
            start_centroids, tooth_meshes=tooth_meshes, jaw="upper",
        )
        assert len(protocol.records) > 0

    def test_statistics(self, start_centroids):
        protocol = generate_distance_protocol(start_centroids, jaw="upper")
        assert protocol.min_interproximal_mm > 0
        assert protocol.max_interproximal_mm >= protocol.min_interproximal_mm
        assert protocol.mean_interproximal_mm > 0

    def test_empty_input(self):
        protocol = generate_distance_protocol({}, jaw="upper")
        assert len(protocol.records) == 0


# ---------------------------------------------------------------------------
# Occlusogram
# ---------------------------------------------------------------------------

class TestOcclusogram:
    def test_generates_contacts(self, upper_meshes, lower_meshes):
        result = generate_occlusogram(upper_meshes, lower_meshes)
        assert isinstance(result, Occlusogram)

    def test_contacts_have_positions(self, upper_meshes, lower_meshes):
        result = generate_occlusogram(upper_meshes, lower_meshes, contact_threshold_mm=10)
        for c in result.contacts:
            assert len(c.contact_point) == 3

    def test_intensity_range(self, upper_meshes, lower_meshes):
        result = generate_occlusogram(upper_meshes, lower_meshes, contact_threshold_mm=10)
        for c in result.contacts:
            assert 0.0 <= c.intensity <= 1.0

    def test_tight_contacts_counted(self):
        # Create overlapping teeth
        upper = {11: trimesh.creation.icosphere(subdivisions=2, radius=3)}
        upper[11].vertices += [0, 0, 0]
        lower = {41: trimesh.creation.icosphere(subdivisions=2, radius=3)}
        lower[41].vertices += [0, -0.3, 0]

        result = generate_occlusogram(upper, lower, contact_threshold_mm=2.0)
        assert result.tight_contacts > 0

    def test_empty_meshes(self):
        result = generate_occlusogram({}, {})
        assert result.total_contacts == 0
        assert result.mean_distance_mm == 0

    def test_no_opposing_teeth(self):
        upper = {17: trimesh.creation.icosphere(subdivisions=1, radius=2)}
        upper[17].vertices += [15, 0, 0]
        lower = {31: trimesh.creation.icosphere(subdivisions=1, radius=2)}
        lower[31].vertices += [-15, -5, 0]

        result = generate_occlusogram(upper, lower, contact_threshold_mm=2.0)
        # FDI 17 and 31 don't oppose each other (7 vs 1)
        assert result.total_contacts == 0


# ---------------------------------------------------------------------------
# Space Analysis
# ---------------------------------------------------------------------------

class TestSpaceAnalysis:
    def test_generates_summary(self, start_centroids):
        widths = {11: 8.5, 12: 6.5, 13: 7.5, 21: 8.5, 22: 6.5}
        result = generate_space_analysis(
            start_centroids, widths, jaw="upper",
        )
        assert isinstance(result, SpaceAnalysisSummary)

    def test_perimeter_positive(self, start_centroids):
        widths = {fdi: 7.0 for fdi in start_centroids}
        result = generate_space_analysis(start_centroids, widths)
        assert result.arch_perimeter_mm > 0

    def test_tooth_material_sum(self):
        centroids = {11: [0, 0, 0], 12: [8, 0, 0]}
        widths = {11: 8.5, 12: 6.5}
        result = generate_space_analysis(centroids, widths)
        assert abs(result.tooth_material_mm - 15.0) < 0.01

    def test_crowding_detected(self):
        # Teeth wider than arch
        centroids = {11: [0, 0, 0], 12: [5, 0, 0]}  # 5mm apart
        widths = {11: 8.5, 12: 6.5}  # 15mm total material
        result = generate_space_analysis(centroids, widths)
        assert result.crowding_mm > 0
        assert result.spacing_mm == 0

    def test_spacing_detected(self):
        # Teeth narrower than arch
        centroids = {11: [0, 0, 0], 12: [20, 0, 0]}  # 20mm apart
        widths = {11: 5.0, 12: 5.0}  # 10mm total material
        result = generate_space_analysis(centroids, widths)
        assert result.spacing_mm > 0
        assert result.crowding_mm == 0

    def test_bolton_ratio_passthrough(self):
        centroids = {11: [0, 0, 0]}
        widths = {11: 8.5}
        result = generate_space_analysis(centroids, widths, bolton_ratio=0.78)
        assert result.bolton_ratio == 0.78

    def test_empty_input(self):
        result = generate_space_analysis({}, {})
        assert result.arch_perimeter_mm == 0
        assert result.tooth_material_mm == 0
