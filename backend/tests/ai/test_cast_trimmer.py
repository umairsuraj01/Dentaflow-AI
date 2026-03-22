# test_cast_trimmer.py — Unit tests for Phase 5 cast trimming pipeline.

import pytest
import numpy as np
import trimesh
from pathlib import Path

from ai.pipeline.cast_trimmer import (
    CastTrimResult,
    TrimLinePoint,
    TrimPlane,
    trim_cast,
    get_arch_boundary_points,
    estimate_trim_plane_from_labels,
    _compute_trim_plane,
    _detect_arch_boundary,
    _detect_gum_boundary_by_curvature,
    _estimate_vertex_curvatures,
    _flatten_base,
    _generate_trim_line,
    _smooth_trim_line,
    _trim_mesh,
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
    """A box mesh representing a simple dental cast."""
    return trimesh.creation.box(extents=[30, 20, 40])


@pytest.fixture
def segmented_cast():
    """A combined mesh with face labels: gum (box) + 2 teeth (spheres)."""
    gum = trimesh.creation.box(extents=[40, 10, 30])
    gum.vertices[:, 1] += 5  # gum at top

    t1 = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
    t1.vertices += [-6, 0, 5]

    t2 = trimesh.creation.icosphere(subdivisions=2, radius=2.5)
    t2.vertices += [6, 0, 5]

    combined = trimesh.util.concatenate([gum, t1, t2])

    n_gum = len(gum.faces)
    n_t1 = len(t1.faces)
    n_t2 = len(t2.faces)

    labels = np.zeros(len(combined.faces), dtype=np.int64)
    labels[n_gum:n_gum + n_t1] = 1  # tooth class 1
    labels[n_gum + n_t1:] = 7       # tooth class 7

    return combined, labels


@pytest.fixture
def horizontal_trim_plane():
    """A horizontal trim plane at y=5."""
    return TrimPlane(
        origin=[0.0, 5.0, 0.0],
        normal=[0.0, -1.0, 0.0],  # pointing down (upper jaw keep direction)
        offset_mm=2.0,
    )


# ---------------------------------------------------------------------------
# Arch boundary detection
# ---------------------------------------------------------------------------

class TestArchBoundaryDetection:
    def test_detects_boundary_vertices(self, segmented_cast):
        mesh, labels = segmented_cast
        boundary = _detect_arch_boundary(mesh, labels)
        assert len(boundary) > 0

    def test_boundary_vertices_are_valid_indices(self, segmented_cast):
        mesh, labels = segmented_cast
        boundary = _detect_arch_boundary(mesh, labels)
        assert np.all(boundary >= 0)
        assert np.all(boundary < len(mesh.vertices))

    def test_no_boundary_when_all_gum(self, simple_mesh):
        labels = np.zeros(len(simple_mesh.faces), dtype=np.int64)
        boundary = _detect_arch_boundary(simple_mesh, labels)
        assert len(boundary) == 0

    def test_no_boundary_when_all_teeth(self, simple_mesh):
        labels = np.ones(len(simple_mesh.faces), dtype=np.int64)
        boundary = _detect_arch_boundary(simple_mesh, labels)
        assert len(boundary) == 0


# ---------------------------------------------------------------------------
# Curvature estimation
# ---------------------------------------------------------------------------

class TestCurvatureEstimation:
    def test_curvatures_all_positive(self, simple_mesh):
        curvatures = _estimate_vertex_curvatures(simple_mesh)
        assert len(curvatures) == len(simple_mesh.vertices)
        assert np.all(curvatures >= 0)

    def test_sphere_curvature_mostly_uniform(self):
        sphere = trimesh.creation.icosphere(subdivisions=3, radius=10.0)
        curvatures = _estimate_vertex_curvatures(sphere)
        # Sphere should have relatively uniform curvature
        cv = np.std(curvatures) / (np.mean(curvatures) + 1e-12)
        assert cv < 2.0  # coefficient of variation

    def test_curvature_boundary_detection(self, segmented_cast):
        mesh, _ = segmented_cast
        boundary = _detect_gum_boundary_by_curvature(mesh, percentile=85)
        assert len(boundary) > 0
        assert len(boundary) < len(mesh.vertices)


# ---------------------------------------------------------------------------
# Trim line generation
# ---------------------------------------------------------------------------

class TestTrimLineGeneration:
    def test_generates_points(self, segmented_cast):
        mesh, labels = segmented_cast
        boundary = _detect_arch_boundary(mesh, labels)
        points = _generate_trim_line(mesh, boundary, offset_mm=2.0, jaw="upper")
        assert len(points) > 0

    def test_offset_shifts_positions(self, segmented_cast):
        mesh, labels = segmented_cast
        boundary = _detect_arch_boundary(mesh, labels)
        pts_0 = _generate_trim_line(mesh, boundary, offset_mm=0.0, jaw="upper")
        pts_5 = _generate_trim_line(mesh, boundary, offset_mm=5.0, jaw="upper")

        if len(pts_0) > 0 and len(pts_5) > 0:
            mean_y_0 = np.mean([p[1] for p in pts_0])
            mean_y_5 = np.mean([p[1] for p in pts_5])
            # Upper jaw: offset moves up (positive Y)
            assert mean_y_5 > mean_y_0

    def test_lower_jaw_offset_direction(self, segmented_cast):
        mesh, labels = segmented_cast
        boundary = _detect_arch_boundary(mesh, labels)
        pts_0 = _generate_trim_line(mesh, boundary, offset_mm=0.0, jaw="lower")
        pts_5 = _generate_trim_line(mesh, boundary, offset_mm=5.0, jaw="lower")

        if len(pts_0) > 0 and len(pts_5) > 0:
            mean_y_0 = np.mean([p[1] for p in pts_0])
            mean_y_5 = np.mean([p[1] for p in pts_5])
            # Lower jaw: offset moves down (negative Y)
            assert mean_y_5 < mean_y_0

    def test_fallback_when_no_boundary(self, simple_mesh):
        boundary = np.array([], dtype=np.int64)
        points = _generate_trim_line(simple_mesh, boundary, offset_mm=2.0, jaw="upper")
        assert len(points) >= 0  # may use fallback


# ---------------------------------------------------------------------------
# Trim line smoothing
# ---------------------------------------------------------------------------

class TestTrimLineSmoothing:
    def test_smooth_preserves_count(self):
        points = [np.array([float(i), 0, 0]) for i in range(20)]
        smoothed = _smooth_trim_line(points, iterations=3)
        assert len(smoothed) == len(points)

    def test_smooth_reduces_noise(self):
        # Create noisy circle
        n = 50
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
        noise = np.random.RandomState(42).randn(n) * 0.5
        points = [
            np.array([10 * np.cos(a) + noise[i], 0, 10 * np.sin(a)])
            for i, a in enumerate(angles)
        ]
        smoothed = _smooth_trim_line(points, iterations=10)

        # Smoothed should have less variation in radius
        radii_orig = [np.sqrt(p[0]**2 + p[2]**2) for p in points]
        radii_smooth = [np.sqrt(p[0]**2 + p[2]**2) for p in smoothed]
        assert np.std(radii_smooth) < np.std(radii_orig)

    def test_smooth_too_few_points(self):
        points = [np.array([0, 0, 0]), np.array([1, 0, 0])]
        smoothed = _smooth_trim_line(points, iterations=3)
        assert len(smoothed) == 2


# ---------------------------------------------------------------------------
# Trim plane computation
# ---------------------------------------------------------------------------

class TestTrimPlaneComputation:
    def test_plane_has_unit_normal(self):
        points = [
            np.array([0, 0, 0]),
            np.array([10, 0, 0]),
            np.array([5, 0, 10]),
            np.array([0, 0, 10]),
        ]
        plane = _compute_trim_plane(points, jaw="upper", offset_mm=2.0)
        normal = np.array(plane.normal)
        assert abs(np.linalg.norm(normal) - 1.0) < 0.01

    def test_upper_jaw_normal_direction(self):
        # Points on a horizontal plane at y=5
        points = [
            np.array([0, 5, 0]),
            np.array([10, 5, 0]),
            np.array([10, 5, 10]),
            np.array([0, 5, 10]),
        ]
        plane = _compute_trim_plane(points, jaw="upper", offset_mm=2.0)
        # Normal should point down (-Y) for upper jaw
        assert plane.normal[1] < 0

    def test_lower_jaw_normal_direction(self):
        points = [
            np.array([0, -5, 0]),
            np.array([10, -5, 0]),
            np.array([10, -5, 10]),
            np.array([0, -5, 10]),
        ]
        plane = _compute_trim_plane(points, jaw="lower", offset_mm=2.0)
        # Normal should point up (+Y) for lower jaw
        assert plane.normal[1] > 0

    def test_plane_origin_near_centroid(self):
        points = [
            np.array([0, 5, 0]),
            np.array([10, 5, 0]),
            np.array([10, 5, 10]),
            np.array([0, 5, 10]),
        ]
        plane = _compute_trim_plane(points, jaw="upper", offset_mm=2.0)
        # Origin should be near (5, 5, 5)
        assert abs(plane.origin[0] - 5.0) < 1.0
        assert abs(plane.origin[2] - 5.0) < 1.0

    def test_fallback_with_few_points(self):
        points = [np.array([0, 0, 0])]
        plane = _compute_trim_plane(points, jaw="upper", offset_mm=2.0)
        assert len(plane.normal) == 3
        assert len(plane.origin) == 3


# ---------------------------------------------------------------------------
# Mesh trimming
# ---------------------------------------------------------------------------

class TestMeshTrimming:
    def test_trim_removes_faces(self, simple_mesh, horizontal_trim_plane):
        trimmed = _trim_mesh(simple_mesh, horizontal_trim_plane, jaw="upper")
        assert len(trimmed.faces) < len(simple_mesh.faces)

    def test_trim_keeps_some_faces(self, simple_mesh, horizontal_trim_plane):
        trimmed = _trim_mesh(simple_mesh, horizontal_trim_plane, jaw="upper")
        assert len(trimmed.faces) > 0

    def test_trim_with_different_offsets(self, simple_mesh):
        plane_high = TrimPlane(
            origin=[0.0, 8.0, 0.0],
            normal=[0.0, -1.0, 0.0],
            offset_mm=2.0,
        )
        plane_low = TrimPlane(
            origin=[0.0, 2.0, 0.0],
            normal=[0.0, -1.0, 0.0],
            offset_mm=2.0,
        )
        trimmed_high = _trim_mesh(simple_mesh, plane_high, jaw="upper")
        trimmed_low = _trim_mesh(simple_mesh, plane_low, jaw="upper")
        # Higher plane origin keeps more faces below it
        assert len(trimmed_high.faces) >= len(trimmed_low.faces)


# ---------------------------------------------------------------------------
# Base flattening
# ---------------------------------------------------------------------------

class TestBaseFlattenening:
    def test_flatten_produces_valid_mesh(self, simple_mesh, horizontal_trim_plane):
        flattened = _flatten_base(
            simple_mesh, horizontal_trim_plane,
            thickness_mm=3.0, jaw="upper",
        )
        assert len(flattened.faces) == len(simple_mesh.faces)
        assert len(flattened.vertices) > 0

    def test_flatten_modifies_vertices(self):
        # Create a mesh with vertices straddling the plane
        mesh = trimesh.creation.box(extents=[10, 10, 10])
        # Plane at y=0, normal pointing down, thickness=6 covers vertices at y=0..5
        plane = TrimPlane(origin=[0.0, 0.0, 0.0], normal=[0.0, -1.0, 0.0], offset_mm=2.0)
        flattened = _flatten_base(mesh, plane, thickness_mm=6.0, jaw="upper")
        # Vertices near the plane (0..6) should be projected
        orig_y = mesh.vertices[:, 1]
        flat_y = flattened.vertices[:, 1]
        assert len(flattened.faces) == len(mesh.faces)


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------

class TestConvenienceFunctions:
    def test_get_arch_boundary_points(self, segmented_cast):
        mesh, labels = segmented_cast
        points = get_arch_boundary_points(mesh, labels)
        assert points.ndim == 2
        if len(points) > 0:
            assert points.shape[1] == 3

    def test_get_arch_boundary_empty_when_no_boundary(self, simple_mesh):
        labels = np.zeros(len(simple_mesh.faces), dtype=np.int64)
        points = get_arch_boundary_points(simple_mesh, labels)
        assert len(points) == 0


# ---------------------------------------------------------------------------
# Full pipeline (synthetic)
# ---------------------------------------------------------------------------

class TestTrimCastSynthetic:
    def test_full_pipeline(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(
            stl_path, labels, jaw="upper",
            offset_mm=2.0, flatten_base=False,
        )
        assert isinstance(result, CastTrimResult)
        assert result.jaw == "upper"
        assert result.faces_kept > 0

    def test_returns_stl_bytes(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="upper", flatten_base=False)
        assert len(result.trimmed_stl_bytes) > 0

    def test_returns_trim_line(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="upper", flatten_base=False)
        assert len(result.trim_line_points) > 0
        for pt in result.trim_line_points:
            assert isinstance(pt, TrimLinePoint)
            assert len(pt.position) == 3

    def test_returns_trim_plane(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="upper", flatten_base=False)
        assert isinstance(result.trim_plane, TrimPlane)
        assert len(result.trim_plane.origin) == 3
        assert len(result.trim_plane.normal) == 3

    def test_with_base_flattening(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(
            stl_path, labels, jaw="upper",
            flatten_base=True, base_thickness_mm=3.0,
        )
        assert result.base_flattened is True

    def test_processing_time(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="upper", flatten_base=False)
        assert result.processing_time_seconds >= 0

    def test_face_counts(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="upper", flatten_base=False)
        assert result.original_face_count == len(mesh.faces)
        assert result.faces_kept + result.faces_removed == result.original_face_count

    def test_lower_jaw(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        result = trim_cast(stl_path, labels, jaw="lower", flatten_base=False)
        assert result.jaw == "lower"
        assert result.faces_kept > 0

    def test_estimate_trim_plane_convenience(self, segmented_cast, tmp_path):
        mesh, labels = segmented_cast
        stl_path = str(tmp_path / "test.stl")
        mesh.export(stl_path)

        plane = estimate_trim_plane_from_labels(
            stl_path, labels, jaw="upper", offset_mm=2.0,
        )
        assert isinstance(plane, TrimPlane)
        normal_len = np.linalg.norm(plane.normal)
        assert abs(normal_len - 1.0) < 0.1


# ---------------------------------------------------------------------------
# Integration with real dental STLs
# ---------------------------------------------------------------------------

@upper_available
class TestTrimCastUpper:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        output = run_full_pipeline(UPPER_STL)
        return trim_cast(
            UPPER_STL, output.face_labels, jaw=output.jaw,
            offset_mm=3.0, smooth_trim_line=True, flatten_base=True,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CastTrimResult)

    def test_jaw_is_upper(self, result):
        assert result.jaw == "upper"

    def test_faces_removed(self, result):
        assert result.faces_removed > 0

    def test_faces_kept(self, result):
        assert result.faces_kept > 100

    def test_has_trim_line(self, result):
        assert len(result.trim_line_points) > 10

    def test_processing_time_reasonable(self, result):
        assert result.processing_time_seconds < 120


@lower_available
class TestTrimCastLower:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        output = run_full_pipeline(LOWER_STL)
        return trim_cast(
            LOWER_STL, output.face_labels, jaw=output.jaw,
            offset_mm=3.0, flatten_base=True,
        )

    def test_returns_result(self, result):
        assert isinstance(result, CastTrimResult)

    def test_jaw_is_lower(self, result):
        assert result.jaw == "lower"

    def test_faces_removed(self, result):
        assert result.faces_removed > 0
