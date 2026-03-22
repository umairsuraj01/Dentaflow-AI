# test_print_exporter.py — Unit tests for Phase 10 print-ready export.

import pytest
import zipfile
import io
import numpy as np
import trimesh

from ai.pipeline.print_exporter import (
    BatchExportResult,
    ExportedFile,
    ExportFormat,
    PrintOrientation,
    PrintValidation,
    SupportEstimate,
    batch_export,
    estimate_supports,
    export_mesh,
    validate_for_printing,
    _apply_orientation,
    _check_manifold,
    _compute_face_areas,
    _estimate_volume,
    _estimate_wall_thickness,
    _face_centroids,
    _recommend_orientation,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def watertight_mesh():
    """A watertight sphere mesh."""
    return trimesh.creation.icosphere(subdivisions=3, radius=10.0)


@pytest.fixture
def box_mesh():
    """A simple box mesh."""
    return trimesh.creation.box(extents=[20, 15, 30])


@pytest.fixture
def non_watertight_mesh():
    """A mesh with a hole (hemisphere)."""
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=10.0)
    mask = sphere.vertices[:, 1] >= 0
    face_mask = np.all(mask[sphere.faces], axis=1)
    half = sphere.submesh([np.where(face_mask)[0]], append=True)
    return half


@pytest.fixture
def multiple_meshes():
    """Multiple named meshes for batch export."""
    return {
        "tooth_11": trimesh.creation.icosphere(subdivisions=2, radius=3.0),
        "tooth_12": trimesh.creation.icosphere(subdivisions=2, radius=2.8),
        "tooth_21": trimesh.creation.icosphere(subdivisions=2, radius=3.0),
        "gum": trimesh.creation.box(extents=[30, 5, 20]),
    }


# ---------------------------------------------------------------------------
# Print Validation
# ---------------------------------------------------------------------------

class TestPrintValidation:
    def test_watertight_passes(self, watertight_mesh):
        result = validate_for_printing(watertight_mesh)
        assert isinstance(result, PrintValidation)
        assert result.is_watertight is True
        assert result.is_printable is True

    def test_non_watertight_detected(self, non_watertight_mesh):
        result = validate_for_printing(non_watertight_mesh)
        assert result.is_watertight is False
        assert "watertight" in result.issues[0].lower()

    def test_volume_positive(self, watertight_mesh):
        result = validate_for_printing(watertight_mesh)
        assert result.volume_mm3 > 0

    def test_surface_area_positive(self, watertight_mesh):
        result = validate_for_printing(watertight_mesh)
        assert result.surface_area_mm2 > 0

    def test_bounding_box(self, box_mesh):
        result = validate_for_printing(box_mesh)
        assert len(result.bounding_box_mm) == 3
        assert abs(result.bounding_box_mm[0] - 20.0) < 0.1
        assert abs(result.bounding_box_mm[1] - 15.0) < 0.1

    def test_face_count(self, watertight_mesh):
        result = validate_for_printing(watertight_mesh)
        assert result.face_count == len(watertight_mesh.faces)

    def test_vertex_count(self, watertight_mesh):
        result = validate_for_printing(watertight_mesh)
        assert result.vertex_count == len(watertight_mesh.vertices)

    def test_issues_list(self, non_watertight_mesh):
        result = validate_for_printing(non_watertight_mesh)
        assert isinstance(result.issues, list)
        assert len(result.issues) > 0


# ---------------------------------------------------------------------------
# Manifold check
# ---------------------------------------------------------------------------

class TestManifoldCheck:
    def test_sphere_is_manifold(self, watertight_mesh):
        assert _check_manifold(watertight_mesh) is True

    def test_box_is_manifold(self, box_mesh):
        assert _check_manifold(box_mesh) is True


# ---------------------------------------------------------------------------
# Face area computation
# ---------------------------------------------------------------------------

class TestFaceAreas:
    def test_areas_positive(self, watertight_mesh):
        areas = _compute_face_areas(watertight_mesh)
        assert np.all(areas >= 0)
        assert len(areas) == len(watertight_mesh.faces)

    def test_total_area_matches(self, box_mesh):
        areas = _compute_face_areas(box_mesh)
        total = float(np.sum(areas))
        # Box 20x15x30: area = 2*(20*15 + 20*30 + 15*30) = 2*(300+600+450) = 2700
        assert abs(total - 2700) < 1.0


# ---------------------------------------------------------------------------
# Face centroids
# ---------------------------------------------------------------------------

class TestFaceCentroids:
    def test_centroid_dimensions(self, watertight_mesh):
        centroids = _face_centroids(watertight_mesh)
        assert centroids.shape == (len(watertight_mesh.faces), 3)


# ---------------------------------------------------------------------------
# Volume estimation
# ---------------------------------------------------------------------------

class TestVolumeEstimation:
    def test_non_watertight_volume(self, non_watertight_mesh):
        vol = _estimate_volume(non_watertight_mesh)
        assert vol > 0


# ---------------------------------------------------------------------------
# Wall thickness
# ---------------------------------------------------------------------------

class TestWallThickness:
    def test_sphere_thickness(self, watertight_mesh):
        thickness = _estimate_wall_thickness(watertight_mesh)
        assert thickness > 0

    def test_small_mesh(self):
        small = trimesh.Trimesh(
            vertices=[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
            faces=[[0, 1, 2]],
        )
        thickness = _estimate_wall_thickness(small)
        assert thickness == 0.0


# ---------------------------------------------------------------------------
# Support estimation
# ---------------------------------------------------------------------------

class TestSupportEstimation:
    def test_returns_estimate(self, watertight_mesh):
        result = estimate_supports(watertight_mesh)
        assert isinstance(result, SupportEstimate)

    def test_overhang_count(self, watertight_mesh):
        result = estimate_supports(watertight_mesh)
        assert result.overhang_face_count >= 0
        assert result.overhang_area_mm2 >= 0

    def test_percentage_bounded(self, watertight_mesh):
        result = estimate_supports(watertight_mesh)
        assert 0 <= result.support_percentage <= 100

    def test_recommended_orientation(self, watertight_mesh):
        result = estimate_supports(watertight_mesh)
        assert result.recommended_orientation in ("occlusal_up", "occlusal_down", "tilted")

    def test_different_orientations(self, box_mesh):
        up = estimate_supports(box_mesh, orientation=PrintOrientation.OCCLUSAL_UP)
        down = estimate_supports(box_mesh, orientation=PrintOrientation.OCCLUSAL_DOWN)
        # Both should return valid results
        assert up.overhang_face_count >= 0
        assert down.overhang_face_count >= 0


# ---------------------------------------------------------------------------
# Orientation
# ---------------------------------------------------------------------------

class TestOrientation:
    def test_occlusal_up_no_change(self, box_mesh):
        oriented = _apply_orientation(box_mesh, PrintOrientation.OCCLUSAL_UP)
        assert np.allclose(oriented.vertices, box_mesh.vertices)

    def test_occlusal_down_flips(self, box_mesh):
        oriented = _apply_orientation(box_mesh, PrintOrientation.OCCLUSAL_DOWN)
        # Y coordinates should be negated
        assert not np.allclose(oriented.vertices[:, 1], box_mesh.vertices[:, 1])

    def test_tilted_changes_vertices(self, box_mesh):
        oriented = _apply_orientation(box_mesh, PrintOrientation.TILTED)
        assert not np.allclose(oriented.vertices, box_mesh.vertices)


# ---------------------------------------------------------------------------
# Export single mesh
# ---------------------------------------------------------------------------

class TestExportMesh:
    def test_export_stl(self, watertight_mesh):
        result = export_mesh(watertight_mesh, "test_mesh", ExportFormat.STL)
        assert isinstance(result, ExportedFile)
        assert result.filename == "test_mesh.stl"
        assert result.format == "stl"
        assert len(result.data) > 0
        assert result.file_size_bytes > 0

    def test_export_obj(self, watertight_mesh):
        result = export_mesh(watertight_mesh, "test_mesh", ExportFormat.OBJ)
        assert result.filename == "test_mesh.obj"
        assert len(result.data) > 0

    def test_export_ply(self, watertight_mesh):
        result = export_mesh(watertight_mesh, "test_mesh", ExportFormat.PLY)
        assert result.filename == "test_mesh.ply"
        assert len(result.data) > 0

    def test_face_count_correct(self, watertight_mesh):
        result = export_mesh(watertight_mesh, "test", ExportFormat.STL)
        assert result.mesh_face_count == len(watertight_mesh.faces)


# ---------------------------------------------------------------------------
# Batch export
# ---------------------------------------------------------------------------

class TestBatchExport:
    def test_exports_all_meshes(self, multiple_meshes):
        result = batch_export(multiple_meshes, ExportFormat.STL)
        assert isinstance(result, BatchExportResult)
        assert result.total_files == 4

    def test_creates_zip(self, multiple_meshes):
        result = batch_export(multiple_meshes, create_zip=True)
        assert result.zip_data is not None
        assert len(result.zip_data) > 0

    def test_zip_contains_all_files(self, multiple_meshes):
        result = batch_export(multiple_meshes, create_zip=True)
        zf = zipfile.ZipFile(io.BytesIO(result.zip_data))
        assert len(zf.namelist()) == 4

    def test_validation_runs(self, multiple_meshes):
        result = batch_export(multiple_meshes, validate=True)
        assert len(result.validation_results) == 4

    def test_no_validation(self, multiple_meshes):
        result = batch_export(multiple_meshes, validate=False)
        assert len(result.validation_results) == 0

    def test_total_size(self, multiple_meshes):
        result = batch_export(multiple_meshes)
        assert result.total_size_bytes > 0
        assert result.total_size_bytes == sum(f.file_size_bytes for f in result.files)

    def test_processing_time(self, multiple_meshes):
        result = batch_export(multiple_meshes)
        assert result.processing_time_seconds >= 0

    def test_obj_format(self, multiple_meshes):
        result = batch_export(multiple_meshes, format=ExportFormat.OBJ)
        for f in result.files:
            assert f.filename.endswith(".obj")

    def test_empty_batch(self):
        result = batch_export({})
        assert result.total_files == 0
        assert result.zip_data is None


# ---------------------------------------------------------------------------
# Recommend orientation
# ---------------------------------------------------------------------------

class TestRecommendOrientation:
    def test_returns_valid_orientation(self, watertight_mesh):
        orient = _recommend_orientation(watertight_mesh)
        assert orient in ("occlusal_up", "occlusal_down", "tilted")
