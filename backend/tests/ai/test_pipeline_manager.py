# test_pipeline_manager.py — Integration tests for the full pipeline.

import pytest
import numpy as np
from pathlib import Path

from ai.pipeline.pipeline_manager import run_full_pipeline, SegmentationOutput

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
LOWER_STL = "/Users/umairsuraj/Downloads/mandibulary_export.stl"

upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)
lower_available = pytest.mark.skipif(
    not Path(LOWER_STL).exists(), reason="Lower STL not found"
)


@upper_available
class TestPipelineUpper:
    @pytest.fixture(scope="class")
    def output(self):
        return run_full_pipeline(UPPER_STL)

    def test_returns_segmentation_output(self, output):
        assert isinstance(output, SegmentationOutput)

    def test_jaw_detected_as_upper(self, output):
        assert output.jaw == "upper"

    def test_teeth_found_are_fdi_numbers(self, output):
        for fdi in output.teeth_found:
            assert 11 <= fdi <= 27, f"FDI {fdi} not in upper jaw range"

    def test_at_least_10_teeth(self, output):
        assert len(output.teeth_found) >= 10

    def test_confidence_scores_present(self, output):
        assert len(output.confidence_scores) == len(output.teeth_found)

    def test_confidence_in_valid_range(self, output):
        for fdi, score in output.confidence_scores.items():
            assert 0 <= score <= 1.0, f"FDI {fdi} confidence {score} out of range"

    def test_face_labels_shape(self, output):
        assert len(output.face_labels) == output.total_faces

    def test_face_probs_shape(self, output):
        assert output.face_probs.shape == (output.total_faces, 15)

    def test_processing_time_reasonable(self, output):
        assert output.processing_time_seconds < 60, "Pipeline took too long"

    def test_model_version(self, output):
        assert output.model_version == "meshsegnet_v1"


@lower_available
class TestPipelineLower:
    @pytest.fixture(scope="class")
    def output(self):
        return run_full_pipeline(LOWER_STL)

    def test_jaw_detected_as_lower(self, output):
        assert output.jaw == "lower"

    def test_teeth_found_in_lower_range(self, output):
        for fdi in output.teeth_found:
            assert 31 <= fdi <= 47, f"FDI {fdi} not in lower jaw range"

    def test_at_least_10_teeth(self, output):
        assert len(output.teeth_found) >= 10


@upper_available
class TestPipelineWithExplicitJaw:
    def test_explicit_upper_jaw(self):
        output = run_full_pipeline(UPPER_STL, jaw="upper")
        assert output.jaw == "upper"


class TestPipelineErrors:
    def test_missing_file(self):
        with pytest.raises(Exception):
            run_full_pipeline("/nonexistent/file.stl")
