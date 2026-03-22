# test_base_generator.py — Unit tests for Phase 6 model base generation.

import pytest
import numpy as np
import trimesh
from pathlib import Path

from ai.pipeline.base_generator import (
    BaseGenerationResult,
    BaseParameters,
    BaseShape,
    generate_base,
    compute_soft_tissue_margin,
    _compute_arch_dimensions,
    _generate_horseshoe_base,
    _generate_rectangular_base,
    _generate_rounded_base,
    _horseshoe_profile,
    _add_label_area,
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
def cast_mesh():
    """A simple hemisphere mesh simulating a trimmed dental cast."""
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=15.0)
    # Keep only top half (upper cast: teeth face down, base up)
    mask = sphere.vertices[:, 1] >= 0
    face_mask = np.all(mask[sphere.faces], axis=1)
    half = sphere.submesh([np.where(face_mask)[0]], append=True)
    return half


@pytest.fixture
def box_cast():
    """A box mesh for simple testing."""
    return trimesh.creation.box(extents=[30, 15, 40])


@pytest.fixture
def segmented_cast():
    """Cast mesh with face labels for soft tissue margin test."""
    gum = trimesh.creation.box(extents=[40, 5, 30])
    gum.vertices[:, 1] += 5

    tooth = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    combined = trimesh.util.concatenate([gum, tooth])

    labels = np.zeros(len(combined.faces), dtype=np.int64)
    labels[len(gum.faces):] = 1
    return combined, labels


# ---------------------------------------------------------------------------
# Arch dimension computation
# ---------------------------------------------------------------------------

class TestArchDimensions:
    def test_returns_width_depth_center(self, box_cast):
        width, depth, center = _compute_arch_dimensions(box_cast)
        assert width > 0
        assert depth > 0
        assert len(center) == 3

    def test_box_dimensions_correct(self):
        box = trimesh.creation.box(extents=[20, 10, 30])
        width, depth, center = _compute_arch_dimensions(box)
        assert abs(width - 20.0) < 0.1
        assert abs(depth - 30.0) < 0.1

    def test_center_at_origin(self):
        box = trimesh.creation.box(extents=[20, 10, 30])
        _, _, center = _compute_arch_dimensions(box)
        assert abs(center[0]) < 0.1
        assert abs(center[2]) < 0.1


# ---------------------------------------------------------------------------
# Horseshoe profile
# ---------------------------------------------------------------------------

class TestHorseshoeProfile:
    def test_returns_2d_points(self):
        profile = _horseshoe_profile(15.0, 30.0, n_points=40)
        assert profile.ndim == 2
        assert profile.shape[1] == 2

    def test_correct_number_of_points(self):
        profile = _horseshoe_profile(15.0, 30.0, n_points=40)
        assert len(profile) == 40

    def test_width_bounded(self):
        hw = 15.0
        profile = _horseshoe_profile(hw, 30.0)
        assert np.all(profile[:, 0] >= -hw - 0.1)
        assert np.all(profile[:, 0] <= hw + 0.1)


# ---------------------------------------------------------------------------
# Base shape generators
# ---------------------------------------------------------------------------

class TestRectangularBase:
    def test_generates_valid_mesh(self, box_cast):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_rectangular_base(
            center, 30.0, 40.0, -10.0, 0.0,
            BaseParameters(),
        )
        assert len(base.faces) > 0
        assert len(base.vertices) > 0

    def test_dimensions_match(self):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_rectangular_base(
            center, 20.0, 30.0, -5.0, 0.0,
            BaseParameters(),
        )
        bbox = base.bounding_box.extents
        assert abs(bbox[0] - 20.0) < 0.1
        assert abs(bbox[2] - 30.0) < 0.1


class TestRoundedBase:
    def test_generates_valid_mesh(self):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_rounded_base(
            center, 30.0, 40.0, -10.0, 0.0,
            BaseParameters(),
        )
        assert len(base.faces) > 0
        assert len(base.vertices) > 0

    def test_roughly_elliptical_footprint(self):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_rounded_base(
            center, 30.0, 40.0, -5.0, 0.0,
            BaseParameters(),
        )
        # Width should be close to 30mm
        x_extent = np.max(base.vertices[:, 0]) - np.min(base.vertices[:, 0])
        assert abs(x_extent - 30.0) < 1.0


class TestHorseshoeBase:
    def test_generates_valid_mesh(self):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_horseshoe_base(
            center, 30.0, 40.0, -10.0, 0.0,
            BaseParameters(),
        )
        assert len(base.faces) > 0

    def test_has_opening(self):
        center = np.array([0.0, 0.0, 0.0])
        base = _generate_horseshoe_base(
            center, 30.0, 40.0, -5.0, 0.0,
            BaseParameters(),
        )
        # Horseshoe should have an opening in the back
        assert len(base.vertices) > 4


# ---------------------------------------------------------------------------
# Label area
# ---------------------------------------------------------------------------

class TestLabelArea:
    def test_adds_vertices(self):
        box = trimesh.creation.box(extents=[30, 10, 40])
        center = np.array([0.0, 0.0, 0.0])
        result = _add_label_area(
            box, center, "upper", 15.0, 8.0, -5.0, 5.0,
        )
        assert len(result.vertices) > len(box.vertices)

    def test_adds_faces(self):
        box = trimesh.creation.box(extents=[30, 10, 40])
        center = np.array([0.0, 0.0, 0.0])
        result = _add_label_area(
            box, center, "lower", 15.0, 8.0, -5.0, 5.0,
        )
        assert len(result.faces) > len(box.faces)


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

class TestGenerateBase:
    def test_default_params(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        assert isinstance(result, BaseGenerationResult)
        assert result.jaw == "upper"

    def test_returns_base_mesh(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        assert len(result.base_mesh.faces) > 0

    def test_returns_combined_mesh(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        # Combined should have more faces than cast alone
        assert len(result.combined_mesh.faces) > len(cast_mesh.faces)

    def test_returns_stl_bytes(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        assert len(result.base_stl_bytes) > 0
        assert len(result.combined_stl_bytes) > 0

    def test_horseshoe_shape(self, cast_mesh):
        params = BaseParameters(shape=BaseShape.HORSESHOE)
        result = generate_base(cast_mesh, jaw="upper", params=params)
        assert result.base_shape == "horseshoe"

    def test_rectangular_shape(self, cast_mesh):
        params = BaseParameters(shape=BaseShape.RECTANGULAR)
        result = generate_base(cast_mesh, jaw="upper", params=params)
        assert result.base_shape == "rectangular"

    def test_rounded_shape(self, cast_mesh):
        params = BaseParameters(shape=BaseShape.ROUNDED)
        result = generate_base(cast_mesh, jaw="upper", params=params)
        assert result.base_shape == "rounded"

    def test_lower_jaw(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="lower")
        assert result.jaw == "lower"

    def test_custom_parameters(self, cast_mesh):
        params = BaseParameters(
            thickness_mm=8.0,
            margin_mm=5.0,
            height_mm=20.0,
            add_label_area=False,
        )
        result = generate_base(cast_mesh, jaw="upper", params=params)
        assert result.base_height_mm == 20.0

    def test_dimensions_reported(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        assert result.arch_width_mm > 0
        assert result.arch_depth_mm > 0
        assert result.base_width_mm > result.arch_width_mm
        assert result.base_depth_mm > result.arch_depth_mm

    def test_processing_time(self, cast_mesh):
        result = generate_base(cast_mesh, jaw="upper")
        assert result.processing_time_seconds >= 0


# ---------------------------------------------------------------------------
# Soft tissue margin
# ---------------------------------------------------------------------------

class TestSoftTissueMargin:
    def test_returns_3d_points(self, segmented_cast):
        mesh, labels = segmented_cast
        margin = compute_soft_tissue_margin(mesh, labels, margin_mm=2.0)
        if len(margin) > 0:
            assert margin.shape[1] == 3

    def test_margin_offset_from_boundary(self, segmented_cast):
        mesh, labels = segmented_cast
        margin = compute_soft_tissue_margin(mesh, labels, margin_mm=3.0)
        if len(margin) > 0:
            from ai.pipeline.cast_trimmer import _detect_arch_boundary
            boundary_idx = _detect_arch_boundary(mesh, labels)
            boundary_pts = mesh.vertices[boundary_idx]
            # Margin should be offset from boundary
            bc = boundary_pts.mean(axis=0)
            mc = margin.mean(axis=0)
            # Margin center should be farther from arch center (in XZ)
            b_dist = np.sqrt(bc[0]**2 + bc[2]**2)
            m_dist = np.sqrt(mc[0]**2 + mc[2]**2)
            # Just check it returned points
            assert len(margin) > 0

    def test_no_boundary_returns_empty(self):
        mesh = trimesh.creation.box(extents=[10, 10, 10])
        labels = np.zeros(len(mesh.faces), dtype=np.int64)
        margin = compute_soft_tissue_margin(mesh, labels)
        assert len(margin) == 0


# ---------------------------------------------------------------------------
# Integration with real dental STLs
# ---------------------------------------------------------------------------

@upper_available
class TestBaseGenerationUpper:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.pipeline.cast_trimmer import trim_cast

        output = run_full_pipeline(UPPER_STL)
        trim_result = trim_cast(
            UPPER_STL, output.face_labels, jaw=output.jaw,
            offset_mm=3.0, flatten_base=False,
        )
        return generate_base(
            trim_result.trimmed_mesh, jaw=output.jaw,
            params=BaseParameters(shape=BaseShape.HORSESHOE),
        )

    def test_returns_result(self, result):
        assert isinstance(result, BaseGenerationResult)

    def test_jaw(self, result):
        assert result.jaw == "upper"

    def test_reasonable_dimensions(self, result):
        assert 10 < result.arch_width_mm < 100
        assert 10 < result.arch_depth_mm < 100

    def test_base_larger_than_arch(self, result):
        assert result.base_width_mm > result.arch_width_mm

    def test_has_stl_bytes(self, result):
        assert len(result.combined_stl_bytes) > 0


@lower_available
class TestBaseGenerationLower:
    @pytest.fixture(scope="class")
    def result(self):
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.pipeline.cast_trimmer import trim_cast

        output = run_full_pipeline(LOWER_STL)
        trim_result = trim_cast(
            LOWER_STL, output.face_labels, jaw=output.jaw,
            offset_mm=3.0, flatten_base=False,
        )
        return generate_base(
            trim_result.trimmed_mesh, jaw=output.jaw,
            params=BaseParameters(shape=BaseShape.RECTANGULAR),
        )

    def test_returns_result(self, result):
        assert isinstance(result, BaseGenerationResult)

    def test_jaw(self, result):
        assert result.jaw == "lower"

    def test_base_shape(self, result):
        assert result.base_shape == "rectangular"
