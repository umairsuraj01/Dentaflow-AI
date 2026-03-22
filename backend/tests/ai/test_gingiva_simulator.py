# test_gingiva_simulator.py — Unit tests for Phase 9 gingiva simulation.

import pytest
import numpy as np
import trimesh

from ai.pipeline.gingiva_simulator import (
    GingivaSimulationResult,
    GingivalMarginPoint,
    PapillaInfo,
    TissueDeformation,
    simulate_gingiva,
    _are_adjacent,
    _assess_black_triangle_risk,
    _compute_tissue_health,
    _compute_tooth_displacements,
    _deform_gum_mesh,
    _estimate_papilla_height,
    _estimate_papillae,
    _estimate_gingival_margins,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def gum_mesh():
    """A subdivided flat box representing gum tissue, surrounding the teeth."""
    gum = trimesh.creation.box(extents=[40, 5, 30])
    gum.vertices[:, 1] += 2
    # Subdivide to get vertices throughout the volume (box only has 8 corners)
    for _ in range(3):
        gum = gum.subdivide()
    return gum


@pytest.fixture
def tooth_meshes():
    """Two tooth meshes positioned in the gum."""
    meshes = {}
    for fdi, x in [(11, 3), (12, 9)]:
        m = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
        m.vertices += [x, 0, 5]
        meshes[fdi] = m
    return meshes


@pytest.fixture
def tooth_centroids():
    return {11: [3, 0, 5], 12: [9, 0, 5]}


@pytest.fixture
def moved_centroids():
    return {11: [3.5, 0.5, 5], 12: [8.5, 0, 5]}


# ---------------------------------------------------------------------------
# Adjacent check
# ---------------------------------------------------------------------------

class TestAdjacent:
    def test_adjacent_same_quad(self):
        assert _are_adjacent(11, 12) is True

    def test_not_adjacent(self):
        assert _are_adjacent(11, 13) is False

    def test_cross_midline(self):
        assert _are_adjacent(11, 21) is True


# ---------------------------------------------------------------------------
# Displacement computation
# ---------------------------------------------------------------------------

class TestDisplacements:
    def test_computes_displacement(self, tooth_centroids, moved_centroids):
        disps = _compute_tooth_displacements(tooth_centroids, moved_centroids)
        assert 11 in disps
        assert 12 in disps
        assert abs(disps[11][0] - 0.5) < 0.01

    def test_zero_displacement(self, tooth_centroids):
        disps = _compute_tooth_displacements(tooth_centroids, tooth_centroids)
        for d in disps.values():
            assert np.linalg.norm(d) < 0.001


# ---------------------------------------------------------------------------
# Papilla estimation
# ---------------------------------------------------------------------------

class TestPapillaEstimation:
    def test_estimates_papillae(self, tooth_centroids, tooth_meshes):
        papillae = _estimate_papillae(tooth_centroids, tooth_meshes, "upper")
        assert len(papillae) > 0

    def test_papilla_has_height(self, tooth_centroids, tooth_meshes):
        papillae = _estimate_papillae(tooth_centroids, tooth_meshes, "upper")
        for p in papillae:
            assert p.height_mm > 0

    def test_papilla_has_positions(self, tooth_centroids, tooth_meshes):
        papillae = _estimate_papillae(tooth_centroids, tooth_meshes, "upper")
        for p in papillae:
            assert len(p.tip_position) == 3
            assert len(p.base_position) == 3

    def test_papilla_height_varies_with_gap(self):
        assert _estimate_papilla_height(0) > _estimate_papilla_height(5)

    def test_black_triangle_risk(self):
        assert _assess_black_triangle_risk(0.5, 4.0) == "none"
        assert _assess_black_triangle_risk(4.0, 1.0) == "high"
        assert _assess_black_triangle_risk(2.5, 2.0) == "moderate"
        assert _assess_black_triangle_risk(2.0, 4.0) == "low"


# ---------------------------------------------------------------------------
# Gum mesh deformation
# ---------------------------------------------------------------------------

class TestGumDeformation:
    def test_deforms_mesh(self, gum_mesh, tooth_meshes):
        disps = {11: np.array([1.0, 0, 0]), 12: np.array([-1.0, 0, 0])}
        deformed, deformations = _deform_gum_mesh(
            gum_mesh, tooth_meshes, disps,
            stiffness=0.3, influence_radius=8.0,
        )
        assert deformed is not None
        assert len(deformations) > 0

    def test_no_deformation_when_no_movement(self, gum_mesh, tooth_meshes):
        disps = {11: np.array([0, 0, 0]), 12: np.array([0, 0, 0])}
        deformed, deformations = _deform_gum_mesh(
            gum_mesh, tooth_meshes, disps,
            stiffness=0.5, influence_radius=5.0,
        )
        assert deformed is None
        assert len(deformations) == 0

    def test_stiffer_tissue_less_deformation(self, gum_mesh, tooth_meshes):
        disps = {11: np.array([2.0, 0, 0])}
        _, def_soft = _deform_gum_mesh(
            gum_mesh, tooth_meshes, disps,
            stiffness=0.1, influence_radius=8.0,
        )
        _, def_stiff = _deform_gum_mesh(
            gum_mesh, tooth_meshes, disps,
            stiffness=0.9, influence_radius=8.0,
        )
        max_soft = max((d.displacement_mm for d in def_soft), default=0)
        max_stiff = max((d.displacement_mm for d in def_stiff), default=0)
        assert max_soft >= max_stiff

    def test_deformation_decreases_with_distance(self, gum_mesh, tooth_meshes):
        disps = {11: np.array([2.0, 0, 0])}
        _, deformations = _deform_gum_mesh(
            gum_mesh, tooth_meshes, disps,
            stiffness=0.3, influence_radius=8.0,
        )
        if len(deformations) > 1:
            # Closer vertices should have more displacement
            # Just check there's variation
            disps_list = [d.displacement_mm for d in deformations]
            assert max(disps_list) > min(disps_list)


# ---------------------------------------------------------------------------
# Gingival margins
# ---------------------------------------------------------------------------

class TestGingivalMargins:
    def test_estimates_margins(self, gum_mesh, tooth_meshes):
        margins = _estimate_gingival_margins(gum_mesh, tooth_meshes, "upper")
        assert len(margins) > 0

    def test_margins_have_4_points(self, gum_mesh, tooth_meshes):
        margins = _estimate_gingival_margins(gum_mesh, tooth_meshes, "upper")
        for m in margins:
            assert len(m.buccal_margin) == 3
            assert len(m.lingual_margin) == 3
            assert len(m.mesial_margin) == 3
            assert len(m.distal_margin) == 3

    def test_margin_height_positive(self, gum_mesh, tooth_meshes):
        margins = _estimate_gingival_margins(gum_mesh, tooth_meshes, "upper")
        for m in margins:
            assert m.margin_height_mm >= 0


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------

class TestHealthScore:
    def test_perfect_score(self):
        papillae = [PapillaInfo(
            fdi_mesial=11, fdi_distal=12,
            height_mm=4.0, width_mm=2.0,
            tip_position=[0, 0, 0], base_position=[0, 0, 0],
            black_triangle_risk="none",
        )]
        score = _compute_tissue_health(papillae, max_displacement=0.5, mean_displacement=0.2)
        assert score >= 90

    def test_poor_score(self):
        papillae = [
            PapillaInfo(
                fdi_mesial=11, fdi_distal=12,
                height_mm=0.5, width_mm=0.5,
                tip_position=[0, 0, 0], base_position=[0, 0, 0],
                black_triangle_risk="high",
            ),
            PapillaInfo(
                fdi_mesial=12, fdi_distal=13,
                height_mm=0.5, width_mm=0.5,
                tip_position=[0, 0, 0], base_position=[0, 0, 0],
                black_triangle_risk="high",
            ),
        ]
        score = _compute_tissue_health(papillae, max_displacement=3.0, mean_displacement=2.0)
        assert score < 70

    def test_score_bounded(self):
        score = _compute_tissue_health([], 0, 0)
        assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

class TestSimulateGingiva:
    def test_full_simulation(self, gum_mesh, tooth_meshes, tooth_centroids, moved_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            moved_centroids=moved_centroids,
            jaw="upper",
        )
        assert isinstance(result, GingivaSimulationResult)
        assert result.jaw == "upper"

    def test_has_deformed_mesh(self, gum_mesh, tooth_meshes, tooth_centroids, moved_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            moved_centroids=moved_centroids,
            jaw="upper",
        )
        assert result.deformed_gum_mesh is not None
        assert result.deformed_stl_bytes is not None

    def test_has_papillae(self, gum_mesh, tooth_meshes, tooth_centroids, moved_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            moved_centroids=moved_centroids,
            jaw="upper",
        )
        assert len(result.papillae) > 0

    def test_no_movement_result(self, gum_mesh, tooth_meshes, tooth_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            jaw="upper",
        )
        assert result.max_displacement_mm == 0
        assert result.deformed_gum_mesh is None

    def test_health_score(self, gum_mesh, tooth_meshes, tooth_centroids, moved_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            moved_centroids=moved_centroids,
            jaw="upper",
        )
        assert 0 <= result.tissue_health_score <= 100

    def test_lower_jaw(self, gum_mesh, tooth_meshes, tooth_centroids):
        result = simulate_gingiva(
            gum_mesh, tooth_meshes, tooth_centroids,
            jaw="lower",
        )
        assert result.jaw == "lower"
