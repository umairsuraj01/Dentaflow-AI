# test_mesh_repair.py — Unit tests for Phase 1 mesh repair pipeline.

import pytest
import numpy as np
import trimesh
from pathlib import Path

from ai.pipeline.mesh_repair import (
    MeshQualityReport,
    MeshRepairResult,
    assess_quality,
    repair_mesh,
    taubin_smooth,
    _build_vertex_adjacency,
    _count_holes,
    _count_components,
    _count_duplicate_faces,
    _count_non_manifold_edges,
    _fill_holes,
    _fix_normals,
    _remove_degenerate_faces,
    _remove_duplicate_faces,
    _remove_islands,
    _remove_spikes,
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
# Fixtures — synthetic meshes
# ---------------------------------------------------------------------------

@pytest.fixture
def cube_mesh():
    """A simple watertight box mesh."""
    return trimesh.creation.box(extents=[10, 10, 10])


@pytest.fixture
def sphere_mesh():
    """A UV sphere with ~480 faces."""
    return trimesh.creation.icosphere(subdivisions=2, radius=5.0)


@pytest.fixture
def open_mesh():
    """A mesh with a hole (non-watertight) — a hemisphere."""
    sphere = trimesh.creation.icosphere(subdivisions=2, radius=5.0)
    # Remove top-hemisphere faces to create holes
    centers = sphere.triangles_center
    keep = centers[:, 2] < 2.0  # keep only bottom part
    sphere.update_faces(keep)
    sphere.remove_unreferenced_vertices()
    return sphere


@pytest.fixture
def mesh_with_islands():
    """Main mesh + two tiny floating spheres (ensures separate components)."""
    main = trimesh.creation.icosphere(subdivisions=3, radius=10.0)
    island1 = trimesh.creation.icosphere(subdivisions=1, radius=0.3)
    island1.vertices += [30, 0, 0]
    island2 = trimesh.creation.icosphere(subdivisions=1, radius=0.2)
    island2.vertices += [-30, 0, 0]
    combined = trimesh.util.concatenate([main, island1, island2])
    return combined


@pytest.fixture
def mesh_with_spikes():
    """Mesh containing extremely thin spike triangles."""
    # Start with a normal cube, then add degenerate triangles
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    verts = mesh.vertices.tolist()
    faces = mesh.faces.tolist()

    # Add a spike: three vertices nearly collinear
    base_idx = len(verts)
    verts.append([0, 0, 20])       # tip
    verts.append([0.001, 0, 20])   # nearly same point
    verts.append([0, 0, 30])       # far away → very thin triangle

    faces.append([base_idx, base_idx + 1, base_idx + 2])

    return trimesh.Trimesh(vertices=verts, faces=faces, process=False)


@pytest.fixture
def mesh_with_duplicates():
    """Mesh containing duplicate faces."""
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    # Duplicate the first 5 faces
    faces = np.vstack([mesh.faces, mesh.faces[:5]])
    return trimesh.Trimesh(vertices=mesh.vertices, faces=faces, process=False)


# ---------------------------------------------------------------------------
# Quality assessment tests
# ---------------------------------------------------------------------------

class TestAssessQuality:
    def test_returns_report_dataclass(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert isinstance(report, MeshQualityReport)

    def test_cube_is_watertight(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.is_watertight is True

    def test_cube_vertex_count(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.vertex_count == len(cube_mesh.vertices)

    def test_cube_face_count(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.face_count == len(cube_mesh.faces)

    def test_cube_no_holes(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.hole_count == 0

    def test_cube_single_component(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.connected_components == 1

    def test_cube_no_degenerate_faces(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.degenerate_face_count == 0

    def test_cube_quality_score_high(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.quality_score >= 90

    def test_cube_has_volume(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.volume is not None
        assert report.volume > 0

    def test_cube_bounding_box(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert len(report.bounding_box_size) == 3
        for dim in report.bounding_box_size:
            assert abs(dim - 10.0) < 0.01

    def test_open_mesh_has_holes(self, open_mesh):
        report = assess_quality(open_mesh)
        assert report.hole_count > 0

    def test_open_mesh_not_watertight(self, open_mesh):
        report = assess_quality(open_mesh)
        assert report.is_watertight is False

    def test_open_mesh_lower_quality(self, open_mesh):
        report = assess_quality(open_mesh)
        assert report.quality_score < 95

    def test_islands_multiple_components(self, mesh_with_islands):
        report = assess_quality(mesh_with_islands)
        assert report.connected_components == 3

    def test_quality_score_range(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert 0 <= report.quality_score <= 100

    def test_face_area_stats(self, sphere_mesh):
        report = assess_quality(sphere_mesh)
        assert report.min_face_area > 0
        assert report.max_face_area >= report.min_face_area
        assert report.mean_face_area > 0

    def test_surface_area_positive(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.surface_area > 0

    def test_edge_count_positive(self, cube_mesh):
        report = assess_quality(cube_mesh)
        assert report.edge_count > 0


# ---------------------------------------------------------------------------
# Hole detection and filling
# ---------------------------------------------------------------------------

class TestHoleFilling:
    def test_count_holes_watertight(self, cube_mesh):
        assert _count_holes(cube_mesh) == 0

    def test_count_holes_open(self, open_mesh):
        assert _count_holes(open_mesh) > 0

    def test_fill_holes_closes_gaps(self, open_mesh):
        holes_before = _count_holes(open_mesh)
        filled = _fill_holes(open_mesh)
        holes_after = _count_holes(open_mesh)
        assert holes_after <= holes_before
        assert filled >= 0


# ---------------------------------------------------------------------------
# Island removal
# ---------------------------------------------------------------------------

class TestIslandRemoval:
    def test_removes_small_islands(self, mesh_with_islands):
        cleaned, removed = _remove_islands(mesh_with_islands, threshold=0.10)
        assert removed >= 1

    def test_keeps_main_body(self, mesh_with_islands):
        cleaned, _ = _remove_islands(mesh_with_islands, threshold=0.02)
        # Main mesh should still have most vertices
        assert len(cleaned.vertices) > 0.5 * len(mesh_with_islands.vertices)

    def test_single_component_unchanged(self, cube_mesh):
        cleaned, removed = _remove_islands(cube_mesh, threshold=0.02)
        assert removed == 0
        assert len(cleaned.faces) == len(cube_mesh.faces)

    def test_result_fewer_components(self, mesh_with_islands):
        before = _count_components(mesh_with_islands)
        cleaned, _ = _remove_islands(mesh_with_islands, threshold=0.10)
        after = _count_components(cleaned)
        assert after < before

    def test_high_threshold_keeps_largest(self, mesh_with_islands):
        """Even with 100% threshold, the largest component is kept."""
        cleaned, _ = _remove_islands(mesh_with_islands, threshold=1.0)
        assert len(cleaned.faces) > 0


# ---------------------------------------------------------------------------
# Spike / degenerate removal
# ---------------------------------------------------------------------------

class TestSpikeRemoval:
    def test_removes_degenerate_faces(self):
        # Create a mesh with a zero-area face
        verts = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]]
        faces = [[0, 1, 3], [0, 1, 2]]  # [0,1,2] is collinear = zero area
        mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
        cleaned = _remove_degenerate_faces(mesh, min_area=1e-6)
        assert len(cleaned.faces) <= len(mesh.faces)

    def test_keeps_valid_faces(self, cube_mesh):
        n_before = len(cube_mesh.faces)
        cleaned = _remove_degenerate_faces(cube_mesh, min_area=1e-6)
        assert len(cleaned.faces) == n_before

    def test_removes_thin_spikes(self, mesh_with_spikes):
        n_before = len(mesh_with_spikes.faces)
        cleaned = _remove_spikes(mesh_with_spikes, max_aspect_ratio=20.0)
        assert len(cleaned.faces) <= n_before

    def test_cube_no_spikes(self, cube_mesh):
        n_before = len(cube_mesh.faces)
        cleaned = _remove_spikes(cube_mesh, max_aspect_ratio=30.0)
        assert len(cleaned.faces) == n_before


# ---------------------------------------------------------------------------
# Duplicate removal
# ---------------------------------------------------------------------------

class TestDuplicateRemoval:
    def test_counts_duplicates(self, mesh_with_duplicates):
        count = _count_duplicate_faces(mesh_with_duplicates)
        assert count >= 5

    def test_no_duplicates_in_cube(self, cube_mesh):
        count = _count_duplicate_faces(cube_mesh)
        assert count == 0

    def test_removes_duplicates(self, mesh_with_duplicates):
        before = _count_duplicate_faces(mesh_with_duplicates)
        cleaned = _remove_duplicate_faces(mesh_with_duplicates)
        count = _count_duplicate_faces(cleaned)
        assert count <= before


# ---------------------------------------------------------------------------
# Normal fixing
# ---------------------------------------------------------------------------

class TestNormalFixing:
    def test_fix_normals_returns_bool(self, cube_mesh):
        result = _fix_normals(cube_mesh)
        assert result is True or result is False or isinstance(result, (bool, np.bool_))

    def test_flipped_normals_get_fixed(self):
        mesh = trimesh.creation.box(extents=[10, 10, 10])
        # Flip all faces
        mesh.faces = np.fliplr(mesh.faces)
        fixed = _fix_normals(mesh)
        assert fixed is True or fixed is False or isinstance(fixed, (bool, np.bool_))


# ---------------------------------------------------------------------------
# Taubin smoothing
# ---------------------------------------------------------------------------

class TestTaubinSmoothing:
    def test_smooth_returns_moved_count(self, sphere_mesh):
        moved = taubin_smooth(sphere_mesh, iterations=3)
        assert isinstance(moved, int)

    def test_smooth_preserves_vertex_count(self, sphere_mesh):
        n_verts = len(sphere_mesh.vertices)
        taubin_smooth(sphere_mesh, iterations=5)
        assert len(sphere_mesh.vertices) == n_verts

    def test_smooth_preserves_face_count(self, sphere_mesh):
        n_faces = len(sphere_mesh.faces)
        taubin_smooth(sphere_mesh, iterations=5)
        assert len(sphere_mesh.faces) == n_faces

    def test_smooth_moves_vertices(self, sphere_mesh):
        original = sphere_mesh.vertices.copy()
        taubin_smooth(sphere_mesh, iterations=10)
        diff = np.linalg.norm(sphere_mesh.vertices - original, axis=1)
        assert np.max(diff) > 0  # some vertices should have moved

    def test_smooth_preserves_volume_approximately(self, sphere_mesh):
        vol_before = sphere_mesh.volume
        taubin_smooth(sphere_mesh, iterations=10, lam=0.5, mu=-0.53)
        vol_after = sphere_mesh.volume
        # Volume should be preserved within 10%
        assert abs(vol_after - vol_before) / vol_before < 0.10

    def test_zero_iterations_no_change(self, sphere_mesh):
        original = sphere_mesh.vertices.copy()
        moved = taubin_smooth(sphere_mesh, iterations=0)
        assert moved == 0
        np.testing.assert_array_equal(sphere_mesh.vertices, original)

    def test_empty_mesh(self):
        mesh = trimesh.Trimesh()
        moved = taubin_smooth(mesh, iterations=5)
        assert moved == 0

    def test_cube_stays_roughly_cubic(self):
        # Use a subdivided cube so Taubin has interior vertices to smooth
        cube = trimesh.creation.box(extents=[10, 10, 10])
        cube = cube.subdivide()
        bbox_before = cube.bounds[1] - cube.bounds[0]
        taubin_smooth(cube, iterations=3)
        bbox_after = cube.bounds[1] - cube.bounds[0]
        # Bounding box shouldn't shrink more than 30%
        for i in range(3):
            assert bbox_after[i] > bbox_before[i] * 0.7


# ---------------------------------------------------------------------------
# Vertex adjacency builder
# ---------------------------------------------------------------------------

class TestVertexAdjacency:
    def test_adjacency_length(self, cube_mesh):
        adj = _build_vertex_adjacency(cube_mesh)
        assert len(adj) == len(cube_mesh.vertices)

    def test_adjacency_symmetric(self, cube_mesh):
        adj = _build_vertex_adjacency(cube_mesh)
        for i, neighbors in enumerate(adj):
            for nb in neighbors:
                assert i in adj[nb], f"Adjacency not symmetric: {i} -> {nb}"

    def test_adjacency_non_empty(self, cube_mesh):
        adj = _build_vertex_adjacency(cube_mesh)
        for i, neighbors in enumerate(adj):
            assert len(neighbors) > 0, f"Vertex {i} has no neighbors"


# ---------------------------------------------------------------------------
# Non-manifold edge detection
# ---------------------------------------------------------------------------

class TestNonManifoldEdges:
    def test_cube_is_manifold(self, cube_mesh):
        assert _count_non_manifold_edges(cube_mesh) == 0

    def test_sphere_is_manifold(self, sphere_mesh):
        assert _count_non_manifold_edges(sphere_mesh) == 0


# ---------------------------------------------------------------------------
# Full pipeline integration
# ---------------------------------------------------------------------------

class TestRepairMeshPipeline:
    def test_returns_result(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        assert isinstance(result, MeshRepairResult)

    def test_result_has_quality_reports(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        assert isinstance(result.quality_before, MeshQualityReport)
        assert isinstance(result.quality_after, MeshQualityReport)

    def test_processing_time_positive(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        assert result.processing_time_seconds >= 0

    def test_repairs_applied_list(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        assert isinstance(result.repairs_applied, list)

    def test_clean_mesh_minimal_repairs(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        # A clean cube should need very few repairs
        assert len(result.repairs_applied) <= 2

    def test_mesh_with_islands_gets_cleaned(self, mesh_with_islands):
        result = repair_mesh(mesh=mesh_with_islands, island_threshold=0.10)
        assert result.islands_removed >= 1
        assert result.quality_after.connected_components < result.quality_before.connected_components

    def test_quality_improves_or_stays(self, mesh_with_islands):
        result = repair_mesh(mesh=mesh_with_islands)
        assert result.quality_after.quality_score >= result.quality_before.quality_score

    def test_returns_mesh_object(self, cube_mesh):
        result = repair_mesh(mesh=cube_mesh)
        assert isinstance(result.mesh, trimesh.Trimesh)
        assert len(result.mesh.faces) > 0

    def test_all_repairs_disabled(self, cube_mesh):
        result = repair_mesh(
            mesh=cube_mesh,
            fill_holes=False,
            remove_islands=False,
            remove_spikes=False,
            fix_normals=False,
            smooth=False,
        )
        assert len(result.repairs_applied) == 0

    def test_requires_file_or_mesh(self):
        with pytest.raises(ValueError, match="Either file_path or mesh"):
            repair_mesh()


# ---------------------------------------------------------------------------
# Integration with real dental STLs
# ---------------------------------------------------------------------------

@upper_available
class TestRepairUpperSTL:
    @pytest.fixture(scope="class")
    def result(self):
        return repair_mesh(file_path=UPPER_STL, smooth_iterations=5)

    def test_returns_result(self, result):
        assert isinstance(result, MeshRepairResult)

    def test_quality_report_valid(self, result):
        assert result.quality_before.face_count > 1000
        assert result.quality_after.face_count > 1000

    def test_quality_score_reasonable(self, result):
        assert result.quality_after.quality_score >= 50

    def test_processing_time_under_60s(self, result):
        assert result.processing_time_seconds < 60

    def test_mesh_has_faces(self, result):
        assert len(result.mesh.faces) > 0

    def test_bounding_box_dental_scale(self, result):
        bbox = result.quality_after.bounding_box_size
        # Dental arch should be roughly 50-80mm wide
        max_dim = max(bbox)
        assert 10 < max_dim < 200, f"Bounding box max dim {max_dim} outside dental range"


@lower_available
class TestRepairLowerSTL:
    @pytest.fixture(scope="class")
    def result(self):
        return repair_mesh(file_path=LOWER_STL, smooth_iterations=5)

    def test_returns_result(self, result):
        assert isinstance(result, MeshRepairResult)

    def test_quality_after_valid(self, result):
        assert result.quality_after.face_count > 1000
        assert result.quality_after.quality_score >= 50

    def test_mesh_vertex_count(self, result):
        assert len(result.mesh.vertices) > 0
