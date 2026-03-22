# stage_exporter.py — Export transformed tooth meshes per treatment stage.
#
# Takes the original tooth meshes and applies stage transforms to generate
# new STL files showing tooth positions at each stage.
#
# Export formats:
#   - Per-tooth STL at each stage (for individual tooth 3D viewer)
#   - Combined arch STL at each stage (all teeth merged)
#   - Transform matrices for frontend rendering

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ExportedStage:
    """Exported mesh data for one treatment stage."""
    stage_index: int
    label: str
    tooth_stls: dict[int, bytes]     # {fdi: stl_bytes} per tooth
    combined_stl: bytes | None       # all teeth merged
    transforms: dict[int, dict]      # {fdi: {pos_x, pos_y, pos_z, rot_x, rot_y, rot_z}}


@dataclass
class StageExportResult:
    """Complete export of all stages."""
    total_stages: int
    jaw: str
    stages: list[ExportedStage]
    tooth_count: int
    warnings: list[str] = field(default_factory=list)


def export_stages(
    tooth_meshes: dict[int, "ToothMeshData"],
    stages: list[dict[int, dict]],
    jaw: str,
    include_combined: bool = True,
    stage_indices: list[int] | None = None,
) -> StageExportResult:
    """Export transformed tooth STLs for each treatment stage.

    Args:
        tooth_meshes: {fdi: ToothMeshData} from tooth_extractor.
        stages: List of stage dicts {fdi: {"pos_x", "pos_y", "pos_z", ...}}.
        jaw: "upper" or "lower".
        include_combined: Whether to generate combined arch STL per stage.
        stage_indices: If provided, only export these stage indices.

    Returns:
        StageExportResult with per-stage STL data.
    """
    import trimesh

    # Parse original meshes
    original_meshes: dict[int, trimesh.Trimesh] = {}
    for fdi, tooth_data in tooth_meshes.items():
        if fdi == 0:  # skip gum
            continue
        try:
            mesh = trimesh.load(io.BytesIO(tooth_data.stl_bytes), file_type="stl")
            original_meshes[fdi] = mesh
        except Exception as exc:
            logger.warning("Failed to load mesh for FDI %d: %s", fdi, exc)

    warnings: list[str] = []
    exported_stages: list[ExportedStage] = []

    indices_to_export = stage_indices if stage_indices is not None else range(len(stages))

    for stage_idx in indices_to_export:
        if stage_idx >= len(stages):
            warnings.append(f"Stage {stage_idx} out of range (max {len(stages)-1})")
            continue

        transforms = stages[stage_idx]
        label = "Initial" if stage_idx == 0 else f"Stage {stage_idx}"

        tooth_stls: dict[int, bytes] = {}
        combined_meshes = []

        for fdi, mesh in original_meshes.items():
            t = transforms.get(fdi, {})
            transformed = _apply_transform(mesh, t)

            # Export to STL bytes
            buf = io.BytesIO()
            transformed.export(buf, file_type="stl")
            tooth_stls[fdi] = buf.getvalue()

            if include_combined:
                combined_meshes.append(transformed)

        # Combined STL
        combined_stl = None
        if include_combined and combined_meshes:
            combined = trimesh.util.concatenate(combined_meshes)
            buf = io.BytesIO()
            combined.export(buf, file_type="stl")
            combined_stl = buf.getvalue()

        exported_stages.append(ExportedStage(
            stage_index=stage_idx,
            label=label,
            tooth_stls=tooth_stls,
            combined_stl=combined_stl,
            transforms=transforms,
        ))

    logger.info(
        "Stage export (%s): %d stages, %d teeth per stage",
        jaw, len(exported_stages), len(original_meshes),
    )

    return StageExportResult(
        total_stages=len(exported_stages),
        jaw=jaw,
        stages=exported_stages,
        tooth_count=len(original_meshes),
        warnings=warnings,
    )


def compute_transform_matrices(
    stages: list[dict[int, dict]],
) -> list[dict[int, list[list[float]]]]:
    """Compute 4x4 transformation matrices for each stage.

    Returns list of {fdi: 4x4_matrix} per stage, suitable for
    frontend Three.js rendering.
    """
    result = []
    for stage_transforms in stages:
        stage_matrices: dict[int, list[list[float]]] = {}
        for fdi, t in stage_transforms.items():
            matrix = _build_transform_matrix(t)
            stage_matrices[fdi] = matrix.tolist()
        result.append(stage_matrices)
    return result


def export_stage_summary(
    stages: list[dict[int, dict]],
    jaw: str,
) -> dict:
    """Generate a lightweight summary of stage transforms (no STL data).

    Suitable for API responses and frontend consumption.
    """
    summaries = []
    for stage_idx, transforms in enumerate(stages):
        tooth_movements = {}
        for fdi, t in transforms.items():
            total_trans = float(np.sqrt(
                t.get("pos_x", 0)**2 + t.get("pos_y", 0)**2 + t.get("pos_z", 0)**2
            ))
            total_rot = max(
                abs(t.get("rot_x", 0)),
                abs(t.get("rot_y", 0)),
                abs(t.get("rot_z", 0)),
            )
            tooth_movements[fdi] = {
                "translation_mm": round(total_trans, 2),
                "rotation_deg": round(total_rot, 1),
                "transform": t,
            }

        summaries.append({
            "stage_index": stage_idx,
            "label": "Initial" if stage_idx == 0 else f"Stage {stage_idx}",
            "teeth_moving": sum(
                1 for m in tooth_movements.values()
                if m["translation_mm"] > 0.05 or m["rotation_deg"] > 0.1
            ),
            "movements": {str(k): v for k, v in tooth_movements.items()},
        })

    return {
        "jaw": jaw,
        "total_stages": len(stages),
        "stages": summaries,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _apply_transform(mesh: "trimesh.Trimesh", transform: dict) -> "trimesh.Trimesh":
    """Apply translation and rotation to a mesh copy."""
    import trimesh

    transformed = mesh.copy()
    matrix = _build_transform_matrix(transform)
    transformed.apply_transform(matrix)
    return transformed


def _build_transform_matrix(transform: dict) -> np.ndarray:
    """Build a 4x4 transformation matrix from pos/rot values."""
    tx = transform.get("pos_x", 0.0)
    ty = transform.get("pos_y", 0.0)
    tz = transform.get("pos_z", 0.0)
    rx = np.radians(transform.get("rot_x", 0.0))
    ry = np.radians(transform.get("rot_y", 0.0))
    rz = np.radians(transform.get("rot_z", 0.0))

    # Rotation matrices
    cx, sx = np.cos(rx), np.sin(rx)
    cy, sy = np.cos(ry), np.sin(ry)
    cz, sz = np.cos(rz), np.sin(rz)

    # Combined rotation: Rz * Ry * Rx
    R = np.array([
        [cy*cz, sx*sy*cz - cx*sz, cx*sy*cz + sx*sz],
        [cy*sz, sx*sy*sz + cx*cz, cx*sy*sz - sx*cz],
        [-sy,   sx*cy,            cx*cy           ],
    ])

    matrix = np.eye(4)
    matrix[:3, :3] = R
    matrix[:3, 3] = [tx, ty, tz]
    return matrix
