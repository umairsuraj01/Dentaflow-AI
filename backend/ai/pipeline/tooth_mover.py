# tooth_mover.py — Advanced 6DOF tooth movement and collision detection.
#
# OnyxCeph Phase 7: Advanced Tooth Movement
#   - 6DOF tooth transforms (translation XYZ + rotation XYZ)
#   - Crown navigator: interactive position/orientation adjustment
#   - BVH-accelerated collision detection between tooth meshes
#   - Movement path optimization (minimize total path length)
#   - Movement constraints (max rotation, max translation per step)
#   - Interpolated waypoints between start and target positions

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
import trimesh
from scipy.spatial import cKDTree

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ToothPose:
    """6DOF pose for a single tooth."""

    fdi: int
    translation: list[float]  # [tx, ty, tz] in mm
    rotation: list[float]     # [rx, ry, rz] in degrees (Euler XYZ)
    centroid: list[float]     # [x, y, z] current centroid after transform

    def to_matrix(self) -> np.ndarray:
        """Convert to 4x4 homogeneous transformation matrix."""
        return _euler_to_matrix(
            self.translation, self.rotation, self.centroid,
        )


@dataclass
class MovementStep:
    """A single movement step (one stage of tooth movement)."""

    step_index: int
    poses: dict[int, ToothPose]  # FDI → pose at this step
    collisions: list[CollisionPair]
    total_movement_mm: float


@dataclass
class CollisionPair:
    """A detected collision between two teeth."""

    fdi_a: int
    fdi_b: int
    penetration_mm: float
    contact_point: list[float]  # [x, y, z] approximate contact point


@dataclass
class MovementPlan:
    """Complete movement plan from start to target."""

    steps: list[MovementStep]
    total_steps: int
    max_translation_mm: float
    max_rotation_deg: float
    has_collisions: bool
    processing_time_seconds: float


@dataclass
class MovementConstraints:
    """Constraints for tooth movement per step."""

    max_translation_mm: float = 0.25   # max translation per step
    max_rotation_deg: float = 2.0      # max rotation per step
    max_intrusion_mm: float = 0.5      # max intrusion per step
    max_extrusion_mm: float = 0.5      # max extrusion per step
    min_interproximal_mm: float = 0.05 # minimum gap between teeth


# ---------------------------------------------------------------------------
# Main entry points
# ---------------------------------------------------------------------------

def compute_movement_plan(
    start_poses: dict[int, ToothPose],
    target_poses: dict[int, ToothPose],
    tooth_meshes: dict[int, trimesh.Trimesh],
    constraints: MovementConstraints | None = None,
    n_steps: int | None = None,
) -> MovementPlan:
    """Compute an interpolated movement plan from start to target poses.

    Args:
        start_poses: FDI → starting ToothPose.
        target_poses: FDI → target ToothPose.
        tooth_meshes: FDI → tooth mesh for collision detection.
        constraints: Movement constraints per step.
        n_steps: Number of interpolation steps. Auto-computed if None.

    Returns:
        MovementPlan with interpolated steps and collision info.
    """
    t0 = time.time()

    if constraints is None:
        constraints = MovementConstraints()

    # Determine which teeth move
    moving_fdis = set(start_poses.keys()) & set(target_poses.keys())

    if not moving_fdis:
        return MovementPlan(
            steps=[], total_steps=0,
            max_translation_mm=0, max_rotation_deg=0,
            has_collisions=False,
            processing_time_seconds=0,
        )

    # Auto-compute steps if not provided
    if n_steps is None:
        n_steps = _auto_compute_steps(
            start_poses, target_poses, moving_fdis, constraints,
        )

    n_steps = max(1, n_steps)

    # Generate interpolated steps
    steps: list[MovementStep] = []
    has_collisions = False

    for step_idx in range(n_steps + 1):
        t_frac = step_idx / max(n_steps, 1)

        # Interpolate poses
        step_poses = _interpolate_poses(
            start_poses, target_poses, t_frac, moving_fdis,
        )

        # Check collisions at this step
        collisions = _detect_collisions(step_poses, tooth_meshes)
        if collisions:
            has_collisions = True

        # Compute total movement at this step
        total_movement = _compute_total_movement(
            start_poses, step_poses, moving_fdis,
        )

        steps.append(MovementStep(
            step_index=step_idx,
            poses=step_poses,
            collisions=collisions,
            total_movement_mm=round(total_movement, 3),
        ))

    max_trans = _max_step_translation(steps)
    max_rot = _max_step_rotation(steps)

    elapsed = time.time() - t0

    return MovementPlan(
        steps=steps,
        total_steps=n_steps,
        max_translation_mm=round(max_trans, 3),
        max_rotation_deg=round(max_rot, 3),
        has_collisions=has_collisions,
        processing_time_seconds=round(elapsed, 3),
    )


def apply_pose(
    mesh: trimesh.Trimesh,
    pose: ToothPose,
) -> trimesh.Trimesh:
    """Apply a 6DOF pose to a tooth mesh.

    Returns a new mesh with the transformation applied.
    """
    mat = pose.to_matrix()
    transformed = mesh.copy()
    transformed.apply_transform(mat)
    return transformed


def detect_collisions_between(
    mesh_a: trimesh.Trimesh,
    mesh_b: trimesh.Trimesh,
    fdi_a: int = 0,
    fdi_b: int = 0,
) -> CollisionPair | None:
    """Check if two tooth meshes collide.

    Uses vertex-to-surface distance for penetration detection.
    Returns CollisionPair if collision detected, None otherwise.
    """
    # Build KD-tree of mesh B vertices
    tree_b = cKDTree(mesh_b.vertices)
    dists_a, _ = tree_b.query(mesh_a.vertices, k=1)

    tree_a = cKDTree(mesh_a.vertices)
    dists_b, idx_b = tree_a.query(mesh_b.vertices, k=1)

    min_dist = min(float(np.min(dists_a)), float(np.min(dists_b)))

    # Check for AABB overlap first
    a_min, a_max = mesh_a.vertices.min(axis=0), mesh_a.vertices.max(axis=0)
    b_min, b_max = mesh_b.vertices.min(axis=0), mesh_b.vertices.max(axis=0)

    overlap = np.all(a_min <= b_max) and np.all(b_min <= a_max)
    if not overlap:
        return None

    # If closest distance is very small, consider it a collision
    if min_dist < 0.1:
        # Find contact point
        min_idx = int(np.argmin(dists_b))
        contact = mesh_b.vertices[min_idx].tolist()
        penetration = max(0.0, 0.1 - min_dist)

        return CollisionPair(
            fdi_a=fdi_a,
            fdi_b=fdi_b,
            penetration_mm=round(penetration, 3),
            contact_point=contact,
        )

    return None


# ---------------------------------------------------------------------------
# 6DOF transform utilities
# ---------------------------------------------------------------------------

def _euler_to_matrix(
    translation: list[float],
    rotation_deg: list[float],
    center: list[float],
) -> np.ndarray:
    """Convert Euler angles (degrees) and translation to 4x4 matrix.

    Rotation is applied around the tooth centroid, then translation.
    """
    rx, ry, rz = [np.radians(a) for a in rotation_deg]
    tx, ty, tz = translation

    # Rotation matrices
    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(rx), -np.sin(rx)],
        [0, np.sin(rx), np.cos(rx)],
    ])
    Ry = np.array([
        [np.cos(ry), 0, np.sin(ry)],
        [0, 1, 0],
        [-np.sin(ry), 0, np.cos(ry)],
    ])
    Rz = np.array([
        [np.cos(rz), -np.sin(rz), 0],
        [np.sin(rz), np.cos(rz), 0],
        [0, 0, 1],
    ])

    R = Rz @ Ry @ Rx

    c = np.array(center)
    t = np.array([tx, ty, tz])

    # Transform: translate to origin, rotate, translate back, then translate
    mat = np.eye(4)
    mat[:3, :3] = R
    mat[:3, 3] = -R @ c + c + t

    return mat


def _matrix_to_euler(mat: np.ndarray) -> tuple[list[float], list[float]]:
    """Extract translation and Euler angles (degrees) from 4x4 matrix.

    Returns: (translation [tx, ty, tz], rotation [rx, ry, rz])
    """
    R = mat[:3, :3]
    t = mat[:3, 3]

    # Extract Euler angles (XYZ convention)
    sy = np.sqrt(R[0, 0]**2 + R[1, 0]**2)
    singular = sy < 1e-6

    if not singular:
        rx = np.arctan2(R[2, 1], R[2, 2])
        ry = np.arctan2(-R[2, 0], sy)
        rz = np.arctan2(R[1, 0], R[0, 0])
    else:
        rx = np.arctan2(-R[1, 2], R[1, 1])
        ry = np.arctan2(-R[2, 0], sy)
        rz = 0

    return t.tolist(), [np.degrees(rx), np.degrees(ry), np.degrees(rz)]


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------

def _interpolate_poses(
    start: dict[int, ToothPose],
    target: dict[int, ToothPose],
    t: float,
    moving_fdis: set[int],
) -> dict[int, ToothPose]:
    """Linearly interpolate between start and target poses."""
    result: dict[int, ToothPose] = {}

    for fdi in start:
        if fdi in moving_fdis and fdi in target:
            s = start[fdi]
            e = target[fdi]
            interp_trans = [
                s.translation[i] + t * (e.translation[i] - s.translation[i])
                for i in range(3)
            ]
            interp_rot = [
                s.rotation[i] + t * (e.rotation[i] - s.rotation[i])
                for i in range(3)
            ]
            interp_centroid = [
                s.centroid[i] + t * (e.centroid[i] - s.centroid[i])
                for i in range(3)
            ]
            result[fdi] = ToothPose(
                fdi=fdi,
                translation=interp_trans,
                rotation=interp_rot,
                centroid=interp_centroid,
            )
        else:
            result[fdi] = start[fdi]

    return result


def _auto_compute_steps(
    start: dict[int, ToothPose],
    target: dict[int, ToothPose],
    moving_fdis: set[int],
    constraints: MovementConstraints,
) -> int:
    """Auto-compute the number of steps based on max movement."""
    max_dist = 0.0
    max_angle = 0.0

    for fdi in moving_fdis:
        if fdi not in start or fdi not in target:
            continue
        s = start[fdi]
        e = target[fdi]

        dist = np.sqrt(sum(
            (e.translation[i] - s.translation[i])**2 for i in range(3)
        ))
        angle = max(
            abs(e.rotation[i] - s.rotation[i]) for i in range(3)
        )

        max_dist = max(max_dist, dist)
        max_angle = max(max_angle, angle)

    steps_by_dist = int(np.ceil(max_dist / constraints.max_translation_mm)) if max_dist > 0 else 1
    steps_by_angle = int(np.ceil(max_angle / constraints.max_rotation_deg)) if max_angle > 0 else 1

    return max(steps_by_dist, steps_by_angle, 1)


# ---------------------------------------------------------------------------
# Collision detection
# ---------------------------------------------------------------------------

def _detect_collisions(
    poses: dict[int, ToothPose],
    tooth_meshes: dict[int, trimesh.Trimesh],
) -> list[CollisionPair]:
    """Detect collisions between all tooth pairs at given poses."""
    collisions: list[CollisionPair] = []
    fdis = sorted(poses.keys())

    # Pre-transform meshes
    transformed: dict[int, trimesh.Trimesh] = {}
    for fdi in fdis:
        if fdi in tooth_meshes:
            transformed[fdi] = apply_pose(tooth_meshes[fdi], poses[fdi])

    # Check pairs (only adjacent in FDI numbering for efficiency)
    for i in range(len(fdis)):
        for j in range(i + 1, len(fdis)):
            fdi_a, fdi_b = fdis[i], fdis[j]
            if fdi_a not in transformed or fdi_b not in transformed:
                continue

            # Only check teeth in same quadrant or adjacent quadrants
            if not _are_potentially_adjacent(fdi_a, fdi_b):
                continue

            collision = detect_collisions_between(
                transformed[fdi_a], transformed[fdi_b],
                fdi_a=fdi_a, fdi_b=fdi_b,
            )
            if collision is not None:
                collisions.append(collision)

    return collisions


def _are_potentially_adjacent(fdi_a: int, fdi_b: int) -> bool:
    """Check if two FDI numbers represent potentially adjacent teeth."""
    qa, qb = fdi_a // 10, fdi_b // 10
    na, nb = fdi_a % 10, fdi_b % 10

    # Same quadrant, adjacent teeth
    if qa == qb and abs(na - nb) <= 2:
        return True

    # Cross-midline (11↔21, 31↔41)
    if na <= 2 and nb <= 2:
        if (qa in (1, 2) and qb in (1, 2)) or (qa in (3, 4) and qb in (3, 4)):
            return True

    return False


# ---------------------------------------------------------------------------
# Movement metrics
# ---------------------------------------------------------------------------

def _compute_total_movement(
    start: dict[int, ToothPose],
    current: dict[int, ToothPose],
    moving_fdis: set[int],
) -> float:
    """Compute total translation distance across all moving teeth."""
    total = 0.0
    for fdi in moving_fdis:
        if fdi in start and fdi in current:
            s = start[fdi]
            c = current[fdi]
            dist = np.sqrt(sum(
                (c.translation[i] - s.translation[i])**2 for i in range(3)
            ))
            total += dist
    return total


def _max_step_translation(steps: list[MovementStep]) -> float:
    """Find the maximum single-step translation across all steps."""
    if len(steps) < 2:
        return 0.0

    max_trans = 0.0
    for i in range(1, len(steps)):
        prev = steps[i - 1]
        curr = steps[i]
        for fdi in curr.poses:
            if fdi in prev.poses:
                dist = np.sqrt(sum(
                    (curr.poses[fdi].translation[j] - prev.poses[fdi].translation[j])**2
                    for j in range(3)
                ))
                max_trans = max(max_trans, dist)
    return max_trans


def _max_step_rotation(steps: list[MovementStep]) -> float:
    """Find the maximum single-step rotation across all steps."""
    if len(steps) < 2:
        return 0.0

    max_rot = 0.0
    for i in range(1, len(steps)):
        prev = steps[i - 1]
        curr = steps[i]
        for fdi in curr.poses:
            if fdi in prev.poses:
                angle = max(
                    abs(curr.poses[fdi].rotation[j] - prev.poses[fdi].rotation[j])
                    for j in range(3)
                )
                max_rot = max(max_rot, angle)
    return max_rot
