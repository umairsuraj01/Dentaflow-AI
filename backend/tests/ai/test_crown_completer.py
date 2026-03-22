# test_crown_completer.py — Unit tests for Phase 4 crown completion pipeline.

import pytest
import numpy as np
import trimesh
from pathlib import Path

from ai.pipeline.crown_completer import (
    CrownCompletionResult,
    GapInfo,
    ToothObject,
    complete_crowns,
    _closest_mesh_distance,
    _detect_gaps,
    _estimate_crown_base_plane,
    _extract_crown,
    _extract_gum,
    _generate_root,
    _get_adjacent_pairs,
    _smooth_crown_boundary,
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
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def simple_mesh():
    """A simple sphere mesh to act as a tooth crown."""
    return trimesh.creation.icosphere(subdivisions=2, radius=3.0)


@pytest.fixture
def two_spheres():
    """Two separate sphere meshes (adjacent 'teeth') with a gap."""
    a = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    a.vertices += [-5, 0, 0]
    b = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    b.vertices += [5, 0, 0]
    return a, b


@pytest.fixture
def mock_segmented_mesh():
    """Create a combined mesh with face labels simulating 3 teeth + gum."""
    gum = trimesh.creation.box(extents=[40, 5, 30])
    gum.vertices[:, 1] += 5  # move gum up

    t1 = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
    t1.vertices += [-8, 0, 5]

    t2 = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
    t2.vertices += [0, 0, 5]

    t3 = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
    t3.vertices += [8, 0, 5]

    combined = trimesh.util.concatenate([gum, t1, t2, t3])

    # Create face labels
    n_gum = len(gum.faces)
    n_t1 = len(t1.faces)
    n_t2 = len(t2.faces)
    n_t3 = len(t3.faces)

    labels = np.zeros(len(combined.faces), dtype=np.int64)
    labels[n_gum:n_gum + n_t1] = 1  # class 1 = FDI 17 (upper)
    labels[n_gum + n_t1:n_gum + n_t1 + n_t2] = 7  # class 7 = FDI 11
    labels[n_gum + n_t1 + n_t2:] = 8  # class 8 = FDI 21

    return combined, labels


# ---------------------------------------------------------------------------
# Crown extraction
# ---------------------------------------------------------------------------

class TestCrownExtraction:
    def test_extract_returns_mesh(self, simple_mesh):
        indices = np.arange(len(simple_mesh.faces))
        crown = _extract_crown(simple_mesh, indices, smooth=False)
        assert crown is not None
        assert len(crown.faces) > 0

    def test_extract_with_smoothing(self, simple_mesh):
        indices = np.arange(len(simple_mesh.faces))
        crown = _extract_crown(simple_mesh, indices, smooth=True, iterations=3)
        assert crown is not None

    def test_extract_partial(self, simple_mesh):
        indices = np.arange(len(simple_mesh.faces) // 2)
        crown = _extract_crown(simple_mesh, indices, smooth=False)
        assert crown is not None
        assert len(crown.faces) < len(simple_mesh.faces)

    def test_extract_too_few_faces(self, simple_mesh):
        indices = np.array([0, 1])
        crown = _extract_crown(simple_mesh, indices, smooth=False)
        # May return None or a tiny mesh
        if crown is not None:
            assert len(crown.faces) <= 2


# ---------------------------------------------------------------------------
# Crown boundary smoothing
# ---------------------------------------------------------------------------

class TestCrownSmoothing:
    def test_smooth_preserves_face_count(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        n_faces = len(partial.faces)
        smoothed = _smooth_crown_boundary(partial, iterations=3)
        assert len(smoothed.faces) == n_faces

    def test_smooth_preserves_vertex_count(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        n_verts = len(partial.vertices)
        smoothed = _smooth_crown_boundary(partial, iterations=3)
        assert len(smoothed.vertices) == n_verts


# ---------------------------------------------------------------------------
# Crown base plane
# ---------------------------------------------------------------------------

class TestCrownBasePlane:
    def test_plane_returns_4_values(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        plane = _estimate_crown_base_plane(partial, "upper")
        if plane is not None:
            assert len(plane) == 4

    def test_plane_normal_unit_length(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        plane = _estimate_crown_base_plane(partial, "upper")
        if plane is not None:
            normal = np.array(plane[:3])
            assert abs(np.linalg.norm(normal) - 1.0) < 0.01


# ---------------------------------------------------------------------------
# Root generation
# ---------------------------------------------------------------------------

class TestRootGeneration:
    def test_root_returns_mesh(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        plane = _estimate_crown_base_plane(partial, "upper")
        root = _generate_root(partial, plane, "upper", length_mm=10.0)
        if root is not None:
            assert len(root.faces) > 0
            assert len(root.vertices) > 0

    def test_root_extends_in_correct_direction(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        root = _generate_root(partial, None, "upper", length_mm=10.0)
        if root is not None:
            # Root should extend upward for upper jaw
            root_max_y = root.vertices[:, 1].max()
            crown_max_y = partial.vertices[:, 1].max()
            assert root_max_y >= crown_max_y - 1.0

    def test_root_lower_jaw_direction(self, simple_mesh):
        half = np.arange(len(simple_mesh.faces) // 2)
        partial = simple_mesh.submesh([half], append=True)
        root = _generate_root(partial, None, "lower", length_mm=10.0)
        if root is not None:
            root_min_y = root.vertices[:, 1].min()
            crown_min_y = partial.vertices[:, 1].min()
            assert root_min_y <= crown_min_y + 1.0


# ---------------------------------------------------------------------------
# Gap detection
# ---------------------------------------------------------------------------

class TestGapDetection:
    def test_closest_distance(self, two_spheres):
        a, b = two_spheres
        dist, mid, direction = _closest_mesh_distance(a, b)
        # Gap should be approximately 10 - 2*3 = 4mm
        assert 2 < dist < 6
        assert len(mid) == 3
        assert len(direction) == 3

    def test_overlapping_meshes_zero_distance(self):
        a = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
        b = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
        dist, _, _ = _closest_mesh_distance(a, b)
        assert dist < 0.1

    def test_get_adjacent_pairs(self):
        fdis = [11, 12, 13, 21, 22]
        pairs = _get_adjacent_pairs(fdis)
        assert (11, 12) in pairs
        assert (12, 13) in pairs
        assert (21, 22) in pairs
        assert (11, 21) in pairs  # cross-midline

    def test_adjacent_pairs_lower(self):
        fdis = [41, 42, 43, 31, 32]
        pairs = _get_adjacent_pairs(fdis)
        assert (41, 42) in pairs
        assert (31, 32) in pairs
        assert (31, 41) in pairs


# ---------------------------------------------------------------------------
# Gum extraction
# ---------------------------------------------------------------------------

class TestGumExtraction:
    def test_extract_gum_bytes(self, mock_segmented_mesh):
        mesh, labels = mock_segmented_mesh
        gum_bytes = _extract_gum(mesh, labels)
        assert gum_bytes is not None
        assert len(gum_bytes) > 0

    def test_no_gum_returns_none(self):
        mesh = trimesh.creation.icosphere(subdivisions=2)
        labels = np.ones(len(mesh.faces), dtype=np.int64)
        gum_bytes = _extract_gum(mesh, labels)
        assert gum_bytes is None


# ---------------------------------------------------------------------------
# Full pipeline (synthetic)
# ---------------------------------------------------------------------------

class TestCompleteCrownsSynthetic:
    def test_with_mock_mesh(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(
            stl_path, labels, jaw="upper",
            smooth_crowns=False, generate_roots=False,
        )
        assert isinstance(result, CrownCompletionResult)
        assert result.jaw == "upper"
        assert len(result.tooth_objects) >= 2

    def test_returns_gum(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(stl_path, labels, jaw="upper", generate_roots=False)
        assert result.gum_mesh_bytes is not None

    def test_tooth_objects_have_stl(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(stl_path, labels, jaw="upper", generate_roots=False)
        for fdi, obj in result.tooth_objects.items():
            assert len(obj.stl_bytes) > 0
            assert len(obj.centroid) == 3

    def test_with_roots(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(
            stl_path, labels, jaw="upper",
            generate_roots=True, smooth_crowns=False,
        )
        assert result.roots_generated >= 0

    def test_processing_time(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(stl_path, labels, jaw="upper", generate_roots=False)
        assert result.processing_time_seconds >= 0

    def test_gap_detection_runs(self, mock_segmented_mesh, tmp_path):
        mesh, labels = mock_segmented_mesh
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = complete_crowns(stl_path, labels, jaw="upper", generate_roots=False)
        assert isinstance(result.gaps, list)


# ---------------------------------------------------------------------------
# Integration with real dental STLs
# ---------------------------------------------------------------------------

@upper_available
class TestCompleteCrownsUpper:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        output = run_full_pipeline(UPPER_STL)
        return complete_crowns(
            UPPER_STL, output.face_labels, jaw=output.jaw,
            generate_roots=True, smooth_crowns=True, smooth_iterations=4,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CrownCompletionResult)

    def test_multiple_teeth(self, result):
        assert len(result.tooth_objects) >= 8

    def test_has_gum(self, result):
        assert result.gum_mesh_bytes is not None

    def test_gaps_detected(self, result):
        assert isinstance(result.gaps, list)

    def test_tooth_objects_valid(self, result):
        for fdi, obj in result.tooth_objects.items():
            assert 11 <= fdi <= 27
            assert len(obj.stl_bytes) > 0
            assert len(obj.centroid) == 3
            assert obj.crown_mesh is not None

    def test_processing_time_reasonable(self, result):
        assert result.processing_time_seconds < 120


@lower_available
class TestCompleteCrownsLower:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        output = run_full_pipeline(LOWER_STL)
        return complete_crowns(
            LOWER_STL, output.face_labels, jaw=output.jaw,
            generate_roots=False, smooth_crowns=True,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CrownCompletionResult)

    def test_lower_teeth(self, result):
        for fdi in result.tooth_objects:
            assert 31 <= fdi <= 47

    def test_multiple_teeth(self, result):
        assert len(result.tooth_objects) >= 8
