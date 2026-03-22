# test_treatment_report.py — Unit tests for treatment report generation.

import pytest
from pathlib import Path

from ai.analysis.treatment_report import (
    generate_treatment_report,
    report_to_dict,
    TreatmentReport,
)


UPPER_STL = "/Users/umairsuraj/Downloads/maxillary_export.stl"
upper_available = pytest.mark.skipif(
    not Path(UPPER_STL).exists(), reason="Upper STL not found"
)


def _make_upper_teeth():
    data = {}
    for i, fdi in enumerate([17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]):
        x = (i - 7) * 8
        data[fdi] = {
            "centroid": [x, 0, 0],
            "bbox_min": [x - 3, -5, -4],
            "bbox_max": [x + 3, 5, 4],
        }
    return data


def _make_analysis_results():
    return {
        "tooth_measurements": [
            {"fdi": 11, "mesiodistal_width_mm": 8.5},
            {"fdi": 21, "mesiodistal_width_mm": 8.5},
        ],
        "space_analysis": {
            "total_tooth_width_mm": 96.0,
            "arch_length_mm": 100.0,
            "discrepancy_mm": -2.5,
            "severity": "mild",
        },
        "arch_form": {
            "arch_form_type": "parabolic",
            "arch_width_mm": 40.0,
            "arch_depth_mm": 25.0,
        },
        "bolton_analysis": {
            "overall_ratio": 91.3,
            "overall_interpretation": "Normal",
            "anterior_interpretation": "Normal",
        },
        "overjet_overbite": {
            "overjet_mm": 3.0,
            "overbite_mm": 2.5,
        },
        "midline": {
            "deviation_mm": 0.5,
        },
    }


def _make_staging_dict():
    return {
        "total_stages": 8,
        "per_tooth_stages": {"11": 4, "21": 8},
        "stages": [
            {"stage_index": 0, "label": "Initial", "transforms": {
                "11": {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
                "21": {"pos_x": 0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
            }},
            {"stage_index": 8, "label": "Stage 8", "transforms": {
                "11": {"pos_x": 1.0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
                "21": {"pos_x": -2.0, "pos_y": 0, "pos_z": 0, "rot_x": 0, "rot_y": 0, "rot_z": 0},
            }},
        ],
        "warnings": [],
        "validation": {"is_feasible": True, "stages_with_errors": 0},
    }


def _make_attachment_dict():
    return {
        "total_attachments": 3,
        "teeth_with_attachments": [11, 21, 13],
        "attachments": [
            {"fdi": 11, "attachment_type": "rectangular", "surface": "buccal",
             "position": "middle_third", "width_mm": 2.0, "height_mm": 2.0,
             "depth_mm": 1.0, "orientation_deg": 0, "reason": "Translation",
             "priority": "recommended"},
        ],
        "warnings": [],
    }


def _make_ipr_dict():
    return {
        "total_ipr_mm": 1.5,
        "ipr_sufficient": True,
        "contacts": [
            {"fdi_a": 11, "fdi_b": 21, "suggested_ipr_mm": 0.3},
        ],
        "warnings": [],
    }


class TestGenerateReport:
    def test_returns_report(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert isinstance(report, TreatmentReport)

    def test_report_id_generated(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert report.report_id.startswith("RPT-")

    def test_custom_report_id(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper", report_id="CUSTOM-001")
        assert report.report_id == "CUSTOM-001"

    def test_jaw_set(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert report.jaw == "upper"

    def test_teeth_count(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert report.teeth_count == 14

    def test_tooth_summaries_count(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert len(report.tooth_summaries) == 14

    def test_with_analysis(self):
        data = _make_upper_teeth()
        analysis = _make_analysis_results()
        report = generate_treatment_report(data, "upper", analysis_results=analysis)
        assert report.analysis.space_analysis is not None
        assert report.analysis.bolton_analysis is not None

    def test_with_staging(self):
        data = _make_upper_teeth()
        staging = _make_staging_dict()
        report = generate_treatment_report(data, "upper", staging_plan=staging)
        assert report.staging is not None
        assert report.staging.total_stages == 8

    def test_with_attachments(self):
        data = _make_upper_teeth()
        attachments = _make_attachment_dict()
        report = generate_treatment_report(data, "upper", attachment_plan=attachments)
        assert report.attachment_count == 3

    def test_with_ipr(self):
        data = _make_upper_teeth()
        ipr = _make_ipr_dict()
        report = generate_treatment_report(data, "upper", ipr_plan=ipr)
        assert report.ipr_total_mm == 1.5

    def test_recommendations_present(self):
        data = _make_upper_teeth()
        analysis = _make_analysis_results()
        report = generate_treatment_report(data, "upper", analysis_results=analysis)
        assert len(report.recommendations) >= 1

    def test_difficulty_rating_valid(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert report.difficulty_rating in ("simple", "moderate", "complex")


class TestDifficultyRating:
    def test_simple_case(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        assert report.difficulty_rating == "simple"

    def test_complex_case(self):
        data = _make_upper_teeth()
        staging = {"total_stages": 40, "per_tooth_stages": {}, "stages": [], "warnings": []}
        attachments = {"total_attachments": 12, "attachments": [], "warnings": []}
        ipr = {"total_ipr_mm": 5.0, "contacts": [], "warnings": []}
        report = generate_treatment_report(
            data, "upper",
            staging_plan=staging,
            attachment_plan=attachments,
            ipr_plan=ipr,
        )
        assert report.difficulty_rating == "complex"


class TestReportToDict:
    def test_serializable(self):
        import json
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        d = report_to_dict(report)
        # Should be JSON-serializable
        json_str = json.dumps(d)
        assert len(json_str) > 0

    def test_contains_all_fields(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(data, "upper")
        d = report_to_dict(report)
        assert "report_id" in d
        assert "jaw" in d
        assert "teeth_count" in d
        assert "tooth_summaries" in d
        assert "analysis" in d
        assert "recommendations" in d
        assert "difficulty_rating" in d


class TestFullReport:
    def test_all_sections(self):
        data = _make_upper_teeth()
        report = generate_treatment_report(
            data, "upper",
            analysis_results=_make_analysis_results(),
            staging_plan=_make_staging_dict(),
            attachment_plan=_make_attachment_dict(),
            ipr_plan=_make_ipr_dict(),
        )
        assert report.teeth_count == 14
        assert report.staging is not None
        assert report.attachment_count > 0
        assert report.ipr_total_mm > 0
        assert len(report.recommendations) >= 1
        assert report.generated_at is not None


@upper_available
class TestRealDataReport:
    @pytest.fixture(scope="class")
    def tooth_data(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        output = run_full_pipeline(UPPER_STL)
        mesh = load_mesh(UPPER_STL)
        teeth = extract_tooth_meshes(mesh, output.face_labels, jaw="upper")
        return {
            fdi: {"centroid": td.centroid, "bbox_min": td.bbox_min, "bbox_max": td.bbox_max}
            for fdi, td in teeth.items()
        }

    def test_real_data_report(self, tooth_data):
        from ai.analysis.dental_analysis import run_full_analysis
        from dataclasses import asdict

        analysis = run_full_analysis(tooth_data, jaw="upper")
        analysis_dict = {
            "tooth_measurements": [asdict(m) for m in analysis.tooth_measurements],
            "space_analysis": asdict(analysis.space_analysis) if analysis.space_analysis else None,
        }
        report = generate_treatment_report(
            tooth_data, "upper", analysis_results=analysis_dict,
        )
        assert report.teeth_count >= 10
        assert len(report.recommendations) >= 1
