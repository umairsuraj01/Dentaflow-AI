# test_treatment_summary.py — Unit tests for clinical summary generation.

import pytest
from pathlib import Path

from ai.analysis.treatment_summary import (
    generate_clinical_summary,
    summary_to_text,
    ClinicalSummary,
    SummarySection,
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


def _make_analysis():
    return {
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
    }


class TestGenerateSummary:
    def test_returns_summary(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        assert isinstance(summary, ClinicalSummary)

    def test_title_contains_jaw(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        assert "Maxillary" in summary.title

    def test_lower_jaw_title(self):
        data = {}
        for i, fdi in enumerate([47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]):
            x = (i - 7) * 8
            data[fdi] = {"centroid": [x, 0, 0], "bbox_min": [x - 3, -5, -4], "bbox_max": [x + 3, 5, 4]}
        summary = generate_clinical_summary(data, "lower")
        assert "Mandibular" in summary.title

    def test_has_sections(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        assert len(summary.sections) >= 1

    def test_tooth_inventory_section(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        headings = [s.heading for s in summary.sections]
        assert "Tooth Inventory" in headings

    def test_space_analysis_section(self):
        data = _make_upper_teeth()
        analysis = _make_analysis()
        summary = generate_clinical_summary(data, "upper", analysis_results=analysis)
        headings = [s.heading for s in summary.sections]
        assert "Space Analysis" in headings

    def test_arch_form_section(self):
        data = _make_upper_teeth()
        analysis = _make_analysis()
        summary = generate_clinical_summary(data, "upper", analysis_results=analysis)
        headings = [s.heading for s in summary.sections]
        assert "Arch Form" in headings

    def test_treatment_goals_present(self):
        data = _make_upper_teeth()
        analysis = _make_analysis()
        summary = generate_clinical_summary(data, "upper", analysis_results=analysis)
        assert len(summary.treatment_goals) >= 1

    def test_estimated_duration(self):
        data = _make_upper_teeth()
        staging = {"total_stages": 10, "warnings": []}
        summary = generate_clinical_summary(data, "upper", staging_plan=staging)
        assert "weeks" in summary.estimated_duration

    def test_complexity_valid(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        assert "Simple" in summary.complexity or "Moderate" in summary.complexity or "Complex" in summary.complexity

    def test_overall_assessment(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        assert len(summary.overall_assessment) > 0


class TestSummaryToText:
    def test_returns_string(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        text = summary_to_text(summary)
        assert isinstance(text, str)

    def test_contains_title(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        text = summary_to_text(summary)
        assert "Maxillary" in text

    def test_contains_sections(self):
        data = _make_upper_teeth()
        analysis = _make_analysis()
        summary = generate_clinical_summary(data, "upper", analysis_results=analysis)
        text = summary_to_text(summary)
        assert "Tooth Inventory" in text
        assert "Space Analysis" in text

    def test_contains_goals(self):
        data = _make_upper_teeth()
        analysis = _make_analysis()
        summary = generate_clinical_summary(data, "upper", analysis_results=analysis)
        text = summary_to_text(summary)
        assert "Treatment Goals" in text

    def test_contains_complexity(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        text = summary_to_text(summary)
        assert "Complexity" in text


class TestSectionContent:
    def test_section_has_heading(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        for section in summary.sections:
            assert isinstance(section, SummarySection)
            assert len(section.heading) > 0

    def test_section_has_content(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        for section in summary.sections:
            assert len(section.content) > 0

    def test_section_has_findings(self):
        data = _make_upper_teeth()
        summary = generate_clinical_summary(data, "upper")
        for section in summary.sections:
            assert isinstance(section.findings, list)


@upper_available
class TestRealDataSummary:
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

    def test_real_data_summary(self, tooth_data):
        from ai.analysis.dental_analysis import run_full_analysis
        from dataclasses import asdict

        analysis = run_full_analysis(tooth_data, jaw="upper")
        analysis_dict = {
            "space_analysis": asdict(analysis.space_analysis) if analysis.space_analysis else None,
            "arch_form": {"arch_form_type": "parabolic", "arch_width_mm": 40, "arch_depth_mm": 25}
            if analysis.arch_form else None,
        }
        summary = generate_clinical_summary(tooth_data, "upper", analysis_results=analysis_dict)
        assert len(summary.sections) >= 2
        text = summary_to_text(summary)
        assert len(text) > 100
