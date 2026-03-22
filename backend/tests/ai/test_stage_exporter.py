# test_stage_exporter.py — Unit tests for stage export functionality.

import pytest
import numpy as np
from pathlib import Path

from ai.analysis.stage_exporter import (
    export_stages,
    compute_transform_matrices,
    export_stage_summary,
    StageExportResult,
    ExportedStage,
)

UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


class TestComputeTransformMatrices:
    def test_returns_list(self):
        stages = [
            {11: {"pos_x": 0, "pos_y": 0, "pos_z": 0}},
            {11: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0}},
        ]
        result = compute_transform_matrices(stages)
        assert isinstance(result, list)
        assert len(result) == 2

    def test_identity_for_zero_transform(self):
        stages = [{11: {"pos_x": 0, "pos_y": 0, "pos_z": 0}}]
        result = compute_transform_matrices(stages)
        matrix = np.array(result[0][11])
        assert matrix.shape == (4, 4)
        np.testing.assert_allclose(matrix, np.eye(4), atol=1e-10)

    def test_translation_in_matrix(self):
        stages = [{11: {"pos_x": 5.0, "pos_y": 3.0, "pos_z": -2.0}}]
        result = compute_transform_matrices(stages)
        matrix = np.array(result[0][11])
        assert abs(matrix[0, 3] - 5.0) < 0.01
        assert abs(matrix[1, 3] - 3.0) < 0.01
        assert abs(matrix[2, 3] - (-2.0)) < 0.01

    def test_rotation_in_matrix(self):
        stages = [{11: {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_y": 90}}]
        result = compute_transform_matrices(stages)
        matrix = np.array(result[0][11])
        # 90° rotation around Y: R[0,0] ≈ 0, R[0,2] ≈ 1
        assert abs(matrix[0, 0]) < 0.01  # cos(90°) ≈ 0
        assert abs(matrix[0, 2] - 1.0) < 0.01  # sin(90°) ≈ 1

    def test_matrix_is_4x4(self):
        stages = [{11: {"pos_x": 1, "rot_y": 10}}]
        result = compute_transform_matrices(stages)
        matrix = np.array(result[0][11])
        assert matrix.shape == (4, 4)
        assert matrix[3, 3] == 1.0

    def test_multiple_teeth(self):
        stages = [{
            11: {"pos_x": 1},
            21: {"pos_x": -1},
        }]
        result = compute_transform_matrices(stages)
        assert 11 in result[0]
        assert 21 in result[0]


class TestExportStageSummary:
    def test_returns_dict(self):
        stages = [
            {11: {"pos_x": 0, "pos_y": 0, "pos_z": 0}},
            {11: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0}},
        ]
        result = export_stage_summary(stages, "upper")
        assert isinstance(result, dict)

    def test_total_stages(self):
        stages = [{}, {11: {"pos_x": 1.0}}, {11: {"pos_x": 2.0}}]
        result = export_stage_summary(stages, "upper")
        assert result["total_stages"] == 3

    def test_jaw_set(self):
        stages = [{}]
        result = export_stage_summary(stages, "upper")
        assert result["jaw"] == "upper"

    def test_stage_labels(self):
        stages = [{}, {11: {"pos_x": 1.0}}]
        result = export_stage_summary(stages, "upper")
        assert result["stages"][0]["label"] == "Initial"
        assert result["stages"][1]["label"] == "Stage 1"

    def test_teeth_moving_count(self):
        stages = [{
            11: {"pos_x": 0, "pos_y": 0, "pos_z": 0},
            21: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0},
        }]
        result = export_stage_summary(stages, "upper")
        assert result["stages"][0]["teeth_moving"] == 1  # only 21 is moving

    def test_movement_details(self):
        stages = [{11: {"pos_x": 3.0, "pos_y": 4.0, "pos_z": 0}}]
        result = export_stage_summary(stages, "upper")
        movement = result["stages"][0]["movements"]["11"]
        assert movement["translation_mm"] == 5.0  # 3-4-5 triangle


@upper_available
class TestExportStagesRealData:
    @pytest.fixture(scope="class")
    def tooth_meshes(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        output = run_full_pipeline(UPPER_STL)
        mesh = load_mesh(UPPER_STL)
        return extract_tooth_meshes(mesh, output.face_labels, jaw="upper")

    def test_export_single_stage(self, tooth_meshes):
        stages = [{fdi: {"pos_x": 0, "pos_y": 0, "pos_z": 0} for fdi in tooth_meshes if fdi != 0}]
        result = export_stages(tooth_meshes, stages, "upper", include_combined=False)
        assert isinstance(result, StageExportResult)
        assert result.total_stages == 1
        assert result.tooth_count >= 10

    def test_export_with_translation(self, tooth_meshes):
        stages = [
            {fdi: {"pos_x": 0, "pos_y": 0, "pos_z": 0} for fdi in tooth_meshes if fdi != 0},
            {fdi: {"pos_x": 1.0, "pos_y": 0, "pos_z": 0} for fdi in tooth_meshes if fdi != 0},
        ]
        result = export_stages(tooth_meshes, stages, "upper", include_combined=False)
        assert result.total_stages == 2
        # Each stage should have STL data for each tooth
        for stage in result.stages:
            assert len(stage.tooth_stls) >= 10

    def test_stl_bytes_valid(self, tooth_meshes):
        stages = [{fdi: {"pos_x": 0} for fdi in tooth_meshes if fdi != 0}]
        result = export_stages(tooth_meshes, stages, "upper", include_combined=False)
        for fdi, stl_data in result.stages[0].tooth_stls.items():
            assert len(stl_data) > 80  # minimal STL size

    def test_combined_stl(self, tooth_meshes):
        stages = [{fdi: {"pos_x": 0} for fdi in tooth_meshes if fdi != 0}]
        result = export_stages(tooth_meshes, stages, "upper", include_combined=True)
        assert result.stages[0].combined_stl is not None
        assert len(result.stages[0].combined_stl) > 1000

    def test_selective_stage_export(self, tooth_meshes):
        stages = [
            {fdi: {"pos_x": 0} for fdi in tooth_meshes if fdi != 0},
            {fdi: {"pos_x": 0.5} for fdi in tooth_meshes if fdi != 0},
            {fdi: {"pos_x": 1.0} for fdi in tooth_meshes if fdi != 0},
        ]
        # Only export first and last
        result = export_stages(tooth_meshes, stages, "upper", include_combined=False, stage_indices=[0, 2])
        assert result.total_stages == 2
        assert result.stages[0].stage_index == 0
        assert result.stages[1].stage_index == 2
