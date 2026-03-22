# test_tooth_extractor.py — Unit tests for tooth mesh extraction.

import pytest
import numpy as np
from pathlib import Path

from ai.utils.tooth_extractor import extract_tooth_meshes, ToothMeshData

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"

upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_simple_mesh():
    """Create a simple trimesh mesh for testing."""
    import trimesh
    # Box mesh with known face count
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    return mesh


class TestExtractToothMeshesBasic:
    def test_single_label_all_gum(self):
        mesh = _make_simple_mesh()
        face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        assert 0 in result  # gum segment
        assert len(result) == 1

    def test_two_labels(self):
        mesh = _make_simple_mesh()
        face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
        # Assign half faces to class 1 (tooth)
        half = len(mesh.faces) // 2
        face_labels[:half] = 1
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        assert len(result) == 2
        # FDI 17 is class 1 for upper jaw
        assert 17 in result
        assert 0 in result

    def test_wrong_label_count_raises(self):
        mesh = _make_simple_mesh()
        wrong_labels = np.zeros(5, dtype=np.int64)
        with pytest.raises(ValueError, match="face_labels length"):
            extract_tooth_meshes(mesh, wrong_labels, jaw="upper")

    def test_stl_bytes_not_empty(self):
        mesh = _make_simple_mesh()
        face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        assert len(result[0].stl_bytes) > 0

    def test_centroid_is_list(self):
        mesh = _make_simple_mesh()
        face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        assert isinstance(result[0].centroid, list)
        assert len(result[0].centroid) == 3

    def test_bbox_valid(self):
        mesh = _make_simple_mesh()
        face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        for i in range(3):
            assert result[0].bbox_min[i] <= result[0].bbox_max[i]


class TestExtractWithJaw:
    def test_upper_jaw_fdi_numbers(self):
        mesh = _make_simple_mesh()
        n = len(mesh.faces)
        face_labels = np.zeros(n, dtype=np.int64)
        # Class 5 = FDI 13 for upper
        face_labels[:n // 2] = 5
        result = extract_tooth_meshes(mesh, face_labels, jaw="upper")
        assert 13 in result  # FDI 13

    def test_lower_jaw_fdi_numbers(self):
        mesh = _make_simple_mesh()
        n = len(mesh.faces)
        face_labels = np.zeros(n, dtype=np.int64)
        # Class 5 = FDI 43 for lower
        face_labels[:n // 2] = 5
        result = extract_tooth_meshes(mesh, face_labels, jaw="lower")
        assert 43 in result  # FDI 43


@upper_available
class TestExtractWithRealData:
    """Integration test with real segmentation output."""

    @pytest.fixture(scope="class")
    def segmentation_result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        return run_full_pipeline(UPPER_STL)

    @pytest.fixture(scope="class")
    def extracted(self, segmentation_result):
        from ai.data.mesh_loader import load_mesh
        mesh = load_mesh(UPPER_STL)
        return extract_tooth_meshes(
            mesh,
            segmentation_result.face_labels,
            jaw=segmentation_result.jaw,
        )

    def test_gum_extracted(self, extracted):
        assert 0 in extracted

    def test_teeth_extracted(self, extracted):
        teeth = [k for k in extracted if k != 0]
        assert len(teeth) >= 5

    def test_all_stl_bytes_valid(self, extracted):
        for fdi, td in extracted.items():
            assert len(td.stl_bytes) > 100, f"FDI {fdi} STL too small"

    def test_centroids_are_different(self, extracted):
        """Each tooth should have a distinct centroid."""
        teeth = {k: v for k, v in extracted.items() if k != 0}
        centroids = [tuple(round(c, 1) for c in v.centroid) for v in teeth.values()]
        assert len(set(centroids)) == len(centroids), "Duplicate centroids found"
