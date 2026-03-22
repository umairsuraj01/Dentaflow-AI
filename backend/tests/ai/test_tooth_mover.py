# test_tooth_mover.py — Unit tests for Phase 7 advanced tooth movement.

import pytest
import numpy as np
import trimesh

from ai.pipeline.tooth_mover import (
    CollisionPair,
    MovementConstraints,
    MovementPlan,
    MovementStep,
    ToothPose,
    apply_pose,
    compute_movement_plan,
    detect_collisions_between,
    _are_potentially_adjacent,
    _auto_compute_steps,
    _compute_total_movement,
    _euler_to_matrix,
    _interpolate_poses,
    _matrix_to_euler,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tooth_mesh():
    """A small sphere representing a tooth."""
    return trimesh.creation.icosphere(subdivisions=2, radius=3.0)


@pytest.fixture
def two_teeth():
    """Two tooth meshes separated by a gap."""
    a = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    a.vertices += [-5, 0, 0]
    b = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    b.vertices += [5, 0, 0]
    return a, b


@pytest.fixture
def start_poses():
    """Starting poses for 3 teeth."""
    return {
        11: ToothPose(fdi=11, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[2, -5, 20]),
        12: ToothPose(fdi=12, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[5, -4, 18]),
        21: ToothPose(fdi=21, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[-2, -5, 20]),
    }


@pytest.fixture
def target_poses():
    """Target poses with some movement."""
    return {
        11: ToothPose(fdi=11, translation=[1.0, 0.5, 0], rotation=[5, 0, 0], centroid=[3, -4.5, 20]),
        12: ToothPose(fdi=12, translation=[0.5, 0, -0.5], rotation=[0, 3, 0], centroid=[5.5, -4, 17.5]),
        21: ToothPose(fdi=21, translation=[-1.0, 0.5, 0], rotation=[-5, 0, 0], centroid=[-3, -4.5, 20]),
    }


@pytest.fixture
def tooth_meshes():
    """Meshes for the 3 test teeth."""
    meshes = {}
    for fdi, offset in [(11, [2, -5, 20]), (12, [5, -4, 18]), (21, [-2, -5, 20])]:
        m = trimesh.creation.icosphere(subdivisions=1, radius=2.0)
        m.vertices += offset
        meshes[fdi] = m
    return meshes


# ---------------------------------------------------------------------------
# 6DOF Transform
# ---------------------------------------------------------------------------

class TestEulerToMatrix:
    def test_identity_transform(self):
        mat = _euler_to_matrix([0, 0, 0], [0, 0, 0], [0, 0, 0])
        assert np.allclose(mat, np.eye(4), atol=1e-10)

    def test_translation_only(self):
        mat = _euler_to_matrix([1, 2, 3], [0, 0, 0], [0, 0, 0])
        assert abs(mat[0, 3] - 1.0) < 1e-6
        assert abs(mat[1, 3] - 2.0) < 1e-6
        assert abs(mat[2, 3] - 3.0) < 1e-6

    def test_rotation_90_z(self):
        mat = _euler_to_matrix([0, 0, 0], [0, 0, 90], [0, 0, 0])
        # [1,0,0] should map to [0,1,0]
        point = np.array([1, 0, 0, 1])
        result = mat @ point
        assert abs(result[0]) < 0.01
        assert abs(result[1] - 1.0) < 0.01

    def test_is_4x4(self):
        mat = _euler_to_matrix([1, 2, 3], [10, 20, 30], [5, 5, 5])
        assert mat.shape == (4, 4)
        assert abs(mat[3, 3] - 1.0) < 1e-10

    def test_roundtrip(self):
        trans = [1.5, -2.0, 3.0]
        rot = [10.0, -20.0, 30.0]
        center = [0, 0, 0]
        mat = _euler_to_matrix(trans, rot, center)
        trans2, rot2 = _matrix_to_euler(mat)
        assert abs(trans2[0] - trans[0]) < 0.1
        assert abs(trans2[1] - trans[1]) < 0.1
        assert abs(trans2[2] - trans[2]) < 0.1


# ---------------------------------------------------------------------------
# ToothPose
# ---------------------------------------------------------------------------

class TestToothPose:
    def test_create_pose(self):
        pose = ToothPose(fdi=11, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[5, 5, 5])
        assert pose.fdi == 11

    def test_to_matrix(self):
        pose = ToothPose(fdi=11, translation=[1, 0, 0], rotation=[0, 0, 0], centroid=[0, 0, 0])
        mat = pose.to_matrix()
        assert mat.shape == (4, 4)


# ---------------------------------------------------------------------------
# Apply pose to mesh
# ---------------------------------------------------------------------------

class TestApplyPose:
    def test_identity_pose(self, tooth_mesh):
        pose = ToothPose(fdi=11, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[0, 0, 0])
        result = apply_pose(tooth_mesh, pose)
        assert np.allclose(result.vertices, tooth_mesh.vertices, atol=1e-6)

    def test_translation_shifts_centroid(self, tooth_mesh):
        pose = ToothPose(fdi=11, translation=[10, 0, 0], rotation=[0, 0, 0], centroid=[0, 0, 0])
        result = apply_pose(tooth_mesh, pose)
        shift = result.centroid - tooth_mesh.centroid
        assert abs(shift[0] - 10.0) < 0.1

    def test_preserves_face_count(self, tooth_mesh):
        pose = ToothPose(fdi=11, translation=[1, 2, 3], rotation=[10, 20, 30], centroid=[0, 0, 0])
        result = apply_pose(tooth_mesh, pose)
        assert len(result.faces) == len(tooth_mesh.faces)


# ---------------------------------------------------------------------------
# Collision detection
# ---------------------------------------------------------------------------

class TestCollisionDetection:
    def test_no_collision_when_apart(self, two_teeth):
        a, b = two_teeth
        result = detect_collisions_between(a, b, fdi_a=11, fdi_b=12)
        assert result is None

    def test_collision_when_overlapping(self):
        a = trimesh.creation.icosphere(subdivisions=3, radius=3.0)
        b = trimesh.creation.icosphere(subdivisions=3, radius=3.0)
        b.vertices += [5.9, 0, 0]  # overlap: distance=5.9, sum of radii=6
        result = detect_collisions_between(a, b, fdi_a=11, fdi_b=12)
        assert result is not None
        assert isinstance(result, CollisionPair)
        assert result.penetration_mm >= 0

    def test_collision_has_contact_point(self):
        a = trimesh.creation.icosphere(subdivisions=3, radius=3.0)
        b = trimesh.creation.icosphere(subdivisions=3, radius=3.0)
        b.vertices += [5.9, 0, 0]
        result = detect_collisions_between(a, b, fdi_a=11, fdi_b=12)
        assert result is not None
        assert len(result.contact_point) == 3


# ---------------------------------------------------------------------------
# Adjacent teeth check
# ---------------------------------------------------------------------------

class TestAdjacentCheck:
    def test_same_quadrant_adjacent(self):
        assert _are_potentially_adjacent(11, 12) is True
        assert _are_potentially_adjacent(11, 13) is True

    def test_same_quadrant_far(self):
        assert _are_potentially_adjacent(11, 17) is False

    def test_cross_midline(self):
        assert _are_potentially_adjacent(11, 21) is True
        assert _are_potentially_adjacent(31, 41) is True

    def test_different_arches(self):
        # 11 (upper) vs 41 (lower) - not adjacent in this check
        assert _are_potentially_adjacent(11, 41) is False


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------

class TestInterpolation:
    def test_t0_equals_start(self, start_poses, target_poses):
        moving = {11, 12, 21}
        result = _interpolate_poses(start_poses, target_poses, 0.0, moving)
        for fdi in moving:
            assert result[fdi].translation == start_poses[fdi].translation

    def test_t1_equals_target(self, start_poses, target_poses):
        moving = {11, 12, 21}
        result = _interpolate_poses(start_poses, target_poses, 1.0, moving)
        for fdi in moving:
            for i in range(3):
                assert abs(result[fdi].translation[i] - target_poses[fdi].translation[i]) < 1e-6

    def test_t05_is_midpoint(self, start_poses, target_poses):
        moving = {11}
        result = _interpolate_poses(start_poses, target_poses, 0.5, moving)
        expected_tx = (0 + 1.0) / 2
        assert abs(result[11].translation[0] - expected_tx) < 1e-6

    def test_non_moving_teeth_unchanged(self, start_poses, target_poses):
        moving = {11}  # only tooth 11 moves
        result = _interpolate_poses(start_poses, target_poses, 0.5, moving)
        # Tooth 12 and 21 should stay at start
        assert result[12].translation == start_poses[12].translation
        assert result[21].translation == start_poses[21].translation


# ---------------------------------------------------------------------------
# Auto step computation
# ---------------------------------------------------------------------------

class TestAutoSteps:
    def test_computes_positive_steps(self, start_poses, target_poses):
        constraints = MovementConstraints()
        steps = _auto_compute_steps(
            start_poses, target_poses, {11, 12, 21}, constraints,
        )
        assert steps >= 1

    def test_more_movement_more_steps(self):
        start = {
            11: ToothPose(fdi=11, translation=[0, 0, 0], rotation=[0, 0, 0], centroid=[0, 0, 0]),
        }
        small_target = {
            11: ToothPose(fdi=11, translation=[0.5, 0, 0], rotation=[0, 0, 0], centroid=[0.5, 0, 0]),
        }
        big_target = {
            11: ToothPose(fdi=11, translation=[5, 0, 0], rotation=[0, 0, 0], centroid=[5, 0, 0]),
        }
        constraints = MovementConstraints(max_translation_mm=0.25)
        small_steps = _auto_compute_steps(start, small_target, {11}, constraints)
        big_steps = _auto_compute_steps(start, big_target, {11}, constraints)
        assert big_steps > small_steps


# ---------------------------------------------------------------------------
# Total movement
# ---------------------------------------------------------------------------

class TestTotalMovement:
    def test_zero_for_no_movement(self, start_poses):
        total = _compute_total_movement(start_poses, start_poses, {11, 12, 21})
        assert total == 0.0

    def test_positive_for_movement(self, start_poses, target_poses):
        total = _compute_total_movement(start_poses, target_poses, {11, 12, 21})
        assert total > 0


# ---------------------------------------------------------------------------
# Full movement plan
# ---------------------------------------------------------------------------

class TestMovementPlan:
    def test_basic_plan(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes,
            n_steps=5,
        )
        assert isinstance(plan, MovementPlan)
        assert plan.total_steps == 5
        assert len(plan.steps) == 6  # 0..5

    def test_plan_starts_at_start(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes,
            n_steps=3,
        )
        first_step = plan.steps[0]
        for fdi in start_poses:
            assert first_step.poses[fdi].translation == start_poses[fdi].translation

    def test_plan_ends_at_target(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes,
            n_steps=3,
        )
        last_step = plan.steps[-1]
        for fdi in target_poses:
            for i in range(3):
                assert abs(last_step.poses[fdi].translation[i] -
                          target_poses[fdi].translation[i]) < 1e-6

    def test_auto_steps(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes,
        )
        assert plan.total_steps >= 1

    def test_empty_plan_no_movement(self, tooth_meshes):
        plan = compute_movement_plan({}, {}, tooth_meshes)
        assert plan.total_steps == 0
        assert len(plan.steps) == 0

    def test_processing_time(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes, n_steps=3,
        )
        assert plan.processing_time_seconds >= 0

    def test_movement_increases_monotonically(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes, n_steps=5,
        )
        for i in range(1, len(plan.steps)):
            assert plan.steps[i].total_movement_mm >= plan.steps[i - 1].total_movement_mm - 0.001

    def test_collision_detection_runs(self, start_poses, target_poses, tooth_meshes):
        plan = compute_movement_plan(
            start_poses, target_poses, tooth_meshes, n_steps=3,
        )
        # Collision flag should be boolean
        assert isinstance(plan.has_collisions, bool)
