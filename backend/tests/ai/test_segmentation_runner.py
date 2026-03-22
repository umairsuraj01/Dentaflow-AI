# test_segmentation_runner.py — Integration tests for the segmentation pipeline.

import pytest
import numpy as np
from pathlib import Path

from ai.pipeline.segmentation_runner import (
    detect_jaw_type,
    preprocess_mesh,
    run_inference,
    NUM_CLASSES,
    MAX_CELLS,
)

# Test STL files (adjust paths if needed)
UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
LOWER_STL = "/Users/umairsuraj/Downloads/mandibulary_export.stl"

upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)
lower_available = pytest.mark.skipif(
    not Path(LOWER_STL).exists(), reason="Lower STL not found"
)


def _load_vedo(path):
    import vedo
    return vedo.load(path)


@upper_available
class TestDetectJawType:
    def test_upper_jaw_detected(self):
        mesh = _load_vedo(UPPER_STL)
        jaw = detect_jaw_type(mesh)
        assert jaw == "upper"

    @lower_available
    def test_lower_jaw_detected(self):
        mesh = _load_vedo(LOWER_STL)
        jaw = detect_jaw_type(mesh)
        assert jaw == "lower"


@upper_available
class TestPreprocessMesh:
    @pytest.fixture
    def mesh(self):
        mesh = _load_vedo(UPPER_STL)
        if mesh.ncells > MAX_CELLS:
            ratio = MAX_CELLS / mesh.ncells
            mesh = mesh.clone().decimate(fraction=ratio)
        return mesh

    def test_feature_shape(self, mesh):
        X, A_S, A_L = preprocess_mesh(mesh)
        N = mesh.ncells
        assert X.shape == (N, 15), f"Expected ({N}, 15), got {X.shape}"

    def test_adjacency_shapes(self, mesh):
        X, A_S, A_L = preprocess_mesh(mesh)
        N = mesh.ncells
        assert A_S.shape == (N, N)
        assert A_L.shape == (N, N)

    def test_adjacency_row_normalized(self, mesh):
        X, A_S, A_L = preprocess_mesh(mesh)
        # Rows should sum to ~1 (normalized)
        row_sums = A_S.sum(axis=1)
        assert np.allclose(row_sums, 1.0, atol=1e-5)

    def test_features_are_float32(self, mesh):
        X, A_S, A_L = preprocess_mesh(mesh)
        assert X.dtype == np.float32
        assert A_S.dtype == np.float32
        assert A_L.dtype == np.float32

    def test_no_nan_values(self, mesh):
        X, A_S, A_L = preprocess_mesh(mesh)
        assert not np.any(np.isnan(X))
        assert not np.any(np.isnan(A_S))
        assert not np.any(np.isnan(A_L))


@upper_available
class TestRunInferenceUpper:
    @pytest.fixture(scope="class")
    def result(self):
        return run_inference(UPPER_STL)

    def test_returns_three_values(self, result):
        face_labels, face_probs, jaw = result
        assert face_labels is not None
        assert face_probs is not None
        assert jaw is not None

    def test_jaw_is_upper(self, result):
        _, _, jaw = result
        assert jaw == "upper"

    def test_labels_shape_matches_mesh(self, result):
        face_labels, _, _ = result
        mesh = _load_vedo(UPPER_STL)
        assert len(face_labels) == mesh.ncells

    def test_probs_shape(self, result):
        face_labels, face_probs, _ = result
        assert face_probs.shape == (len(face_labels), NUM_CLASSES)

    def test_labels_in_valid_range(self, result):
        face_labels, _, _ = result
        assert face_labels.min() >= 0
        assert face_labels.max() < NUM_CLASSES

    def test_gum_is_majority(self, result):
        face_labels, _, _ = result
        gum_pct = np.sum(face_labels == 0) / len(face_labels)
        assert gum_pct > 0.3, f"Gum is only {gum_pct:.1%} — expected >30%"

    def test_multiple_teeth_detected(self, result):
        face_labels, _, _ = result
        unique = np.unique(face_labels)
        tooth_classes = unique[unique != 0]
        assert len(tooth_classes) >= 5, (
            f"Only {len(tooth_classes)} teeth detected — expected at least 5"
        )

    def test_probs_sum_to_one(self, result):
        _, face_probs, _ = result
        row_sums = face_probs.sum(axis=1)
        assert np.allclose(row_sums, 1.0, atol=1e-3)


@lower_available
class TestRunInferenceLower:
    @pytest.fixture(scope="class")
    def result(self):
        return run_inference(LOWER_STL)

    def test_jaw_is_lower(self, result):
        _, _, jaw = result
        assert jaw == "lower"

    def test_multiple_teeth_detected(self, result):
        face_labels, _, _ = result
        unique = np.unique(face_labels)
        tooth_classes = unique[unique != 0]
        assert len(tooth_classes) >= 5


class TestRunInferenceErrors:
    def test_missing_file_raises(self):
        with pytest.raises(Exception):
            run_inference("/nonexistent/path.stl")

    def test_explicit_jaw_override(self):
        """When jaw is specified, it should be used (not auto-detected)."""
        if not Path(UPPER_STL).exists():
            pytest.skip("Upper STL not found")
        # Force lower jaw on upper mesh — model may produce bad results
        # but the jaw type returned should match what we specified
        face_labels, face_probs, jaw = run_inference(UPPER_STL, jaw="lower")
        assert jaw == "lower"
