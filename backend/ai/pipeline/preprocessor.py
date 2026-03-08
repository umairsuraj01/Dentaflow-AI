# preprocessor.py — 10-step mesh preprocessing pipeline.

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from app.constants import (
    AI_POINT_CLOUD_SIZE,
    InstructionSeverity,
    ToothInstructionType,
)
from ai.data.mesh_loader import load_mesh
from ai.data.normalizer import center_mesh, scale_to_unit_sphere
from ai.data.point_sampler import sample_surface_points
from ai.utils.mesh_utils import (
    compute_vertex_curvature,
    barycentric_interpolate,
    fill_holes,
    fix_normals,
    remove_duplicate_faces,
    remove_small_components,
)

logger = logging.getLogger(__name__)

# Instruction types that make a tooth "restricted" for AI
RESTRICTED_INSTRUCTION_TYPES = frozenset({
    ToothInstructionType.CROWN_DO_NOT_MOVE.value,
    ToothInstructionType.IMPLANT.value,
    ToothInstructionType.BRIDGE_ANCHOR.value,
    ToothInstructionType.EXTRACTION_PLANNED.value,
})


@dataclass
class ProcessedMeshResult:
    """Result of the 10-step preprocessing pipeline."""

    point_cloud: np.ndarray          # (N, 7) — XYZ + normals + curvature
    restricted_fdi: list[int]        # FDI numbers to restrict in postprocessing
    metadata: dict = field(default_factory=dict)


def process_mesh_with_instructions(
    file_path: str,
    instructions: dict[int, list[dict]] | None = None,
    n_points: int = AI_POINT_CLOUD_SIZE,
) -> ProcessedMeshResult:
    """Run all 10 preprocessing steps in order.

    Args:
        file_path: Path to STL/OBJ/PLY file
        instructions: Dict keyed by FDI number → list of instruction dicts
        n_points: Number of points to sample
    """
    instructions = instructions or {}

    # Step 1: Load mesh
    mesh = load_mesh(file_path)

    # Step 2: Validate mesh
    mesh = _validate_mesh(mesh)

    # Step 3: Center mesh
    mesh = center_mesh(mesh)

    # Step 4: Scale to unit sphere
    mesh = scale_to_unit_sphere(mesh)

    # Step 5: Remove small components
    mesh = remove_small_components(mesh, threshold=0.01)

    # Step 6: Compute normals
    mesh = _ensure_normals(mesh)

    # Step 7: Compute curvature
    curvature = compute_vertex_curvature(mesh)

    # Step 8: Sample surface points
    points, face_indices, bary_coords = sample_surface_points(mesh, n_points)

    # Step 9: Compute point features
    point_cloud = _compute_point_features(
        mesh, points, face_indices, bary_coords, curvature,
    )

    # Step 10: Attach instruction metadata
    restricted_fdi = get_restricted_fdi_numbers(instructions)

    metadata = {
        "original_vertices": len(mesh.vertices),
        "original_faces": len(mesh.faces),
        "sampled_points": n_points,
        "restricted_fdi": restricted_fdi,
        "instruction_count": sum(len(v) for v in instructions.values()),
    }

    logger.info(
        "Preprocessing complete: %d points, %d restricted teeth",
        n_points, len(restricted_fdi),
    )

    return ProcessedMeshResult(
        point_cloud=point_cloud,
        restricted_fdi=restricted_fdi,
        metadata=metadata,
    )


def get_restricted_fdi_numbers(
    instructions: dict[int, list[dict]],
) -> list[int]:
    """Return FDI numbers where severity == MUST_RESPECT
    AND instruction_type is in the restricted set.
    """
    restricted = set()
    for fdi, inst_list in instructions.items():
        for inst in inst_list:
            severity = inst.get("severity", "")
            inst_type = inst.get("instruction_type", "")
            if (
                severity == InstructionSeverity.MUST_RESPECT.value
                and inst_type in RESTRICTED_INSTRUCTION_TYPES
            ):
                restricted.add(fdi)
    return sorted(restricted)


def _validate_mesh(mesh):
    """Step 2: validate and repair mesh."""
    mesh = fill_holes(mesh)
    mesh = remove_duplicate_faces(mesh)
    mesh = fix_normals(mesh)
    logger.debug("Mesh validated: watertight=%s", mesh.is_watertight)
    return mesh


def _ensure_normals(mesh):
    """Step 6: compute vertex normals if missing."""
    if mesh.vertex_normals is None or len(mesh.vertex_normals) == 0:
        mesh.fix_normals()
    return mesh


def _compute_point_features(
    mesh, points, face_indices, bary_coords, curvature,
) -> np.ndarray:
    """Step 9: Build (N, 7) feature array — XYZ + normals + curvature."""
    # Interpolate normals at sampled points
    normals = barycentric_interpolate(
        mesh, face_indices, bary_coords, mesh.vertex_normals,
    )
    # Normalize the interpolated normals
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms < 1e-8, 1.0, norms)
    normals = normals / norms

    # Interpolate curvature at sampled points
    curv = barycentric_interpolate(
        mesh, face_indices, bary_coords, curvature,
    )
    if curv.ndim == 1:
        curv = curv[:, np.newaxis]

    # Concatenate: XYZ (3) + normals (3) + curvature (1) = 7
    features = np.concatenate([points, normals, curv], axis=1).astype(np.float32)
    return features
