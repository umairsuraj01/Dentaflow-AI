# gingiva_simulator.py — Gingiva (soft tissue) simulation for treatment planning.
#
# OnyxCeph Phase 9: Gingiva Simulation
#   - Simplified FEM soft tissue deformation model
#   - Papilla height estimation between adjacent teeth
#   - Gingival margin prediction after tooth movement
#   - Tissue thickness estimation
#   - Black triangle risk assessment

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import trimesh
from scipy.spatial import cKDTree

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PapillaInfo:
    """Interdental papilla information."""

    fdi_mesial: int
    fdi_distal: int
    height_mm: float          # papilla height from gingival margin
    width_mm: float           # papilla width at base
    tip_position: list[float] # [x, y, z] papilla tip
    base_position: list[float]
    black_triangle_risk: str  # "none", "low", "moderate", "high"


@dataclass
class GingivalMarginPoint:
    """Gingival margin point for a single tooth."""

    fdi: int
    buccal_margin: list[float]   # [x, y, z]
    lingual_margin: list[float]  # [x, y, z]
    mesial_margin: list[float]   # [x, y, z]
    distal_margin: list[float]   # [x, y, z]
    margin_height_mm: float      # distance from CEJ to margin


@dataclass
class TissueDeformation:
    """Soft tissue deformation result for a vertex region."""

    vertex_index: int
    original_position: list[float]
    deformed_position: list[float]
    displacement_mm: float
    strain: float  # local strain estimate


@dataclass
class GingivaSimulationResult:
    """Complete gingiva simulation output."""

    deformed_gum_mesh: trimesh.Trimesh | None
    deformed_stl_bytes: bytes | None
    papillae: list[PapillaInfo]
    gingival_margins: list[GingivalMarginPoint]
    deformations: list[TissueDeformation]
    max_displacement_mm: float
    mean_displacement_mm: float
    black_triangle_count: int
    tissue_health_score: float  # 0-100
    jaw: str


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def simulate_gingiva(
    gum_mesh: trimesh.Trimesh,
    tooth_meshes: dict[int, trimesh.Trimesh],
    tooth_centroids: dict[int, list[float]],
    moved_centroids: dict[int, list[float]] | None = None,
    jaw: str = "upper",
    tissue_stiffness: float = 0.5,
    influence_radius_mm: float = 5.0,
) -> GingivaSimulationResult:
    """Simulate gingiva deformation after tooth movement.

    Args:
        gum_mesh: Original gum tissue mesh.
        tooth_meshes: FDI → tooth mesh (after movement).
        tooth_centroids: FDI → [x, y, z] original centroid.
        moved_centroids: FDI → [x, y, z] centroid after movement. None = no movement.
        jaw: "upper" or "lower".
        tissue_stiffness: 0-1, higher = stiffer tissue (less deformation).
        influence_radius_mm: Radius of tooth influence on tissue.

    Returns:
        GingivaSimulationResult with deformed mesh and analysis.
    """
    # Step 1: Compute tooth displacements
    displacements = _compute_tooth_displacements(
        tooth_centroids, moved_centroids or tooth_centroids,
    )

    # Step 2: Deform gum mesh
    deformed_mesh, deformations = _deform_gum_mesh(
        gum_mesh, tooth_meshes, displacements,
        tissue_stiffness, influence_radius_mm,
    )

    # Step 3: Estimate papillae
    papillae = _estimate_papillae(
        tooth_centroids if moved_centroids is None else moved_centroids,
        tooth_meshes, jaw,
    )

    # Step 4: Estimate gingival margins
    margins = _estimate_gingival_margins(
        deformed_mesh or gum_mesh, tooth_meshes, jaw,
    )

    # Step 5: Compute statistics
    disps = [d.displacement_mm for d in deformations]
    max_disp = max(disps) if disps else 0.0
    mean_disp = float(np.mean(disps)) if disps else 0.0
    bt_count = sum(1 for p in papillae if p.black_triangle_risk in ("moderate", "high"))

    health_score = _compute_tissue_health(papillae, max_disp, mean_disp)

    # Export
    stl_bytes = None
    if deformed_mesh is not None:
        stl_bytes = deformed_mesh.export(file_type="stl")

    return GingivaSimulationResult(
        deformed_gum_mesh=deformed_mesh,
        deformed_stl_bytes=stl_bytes,
        papillae=papillae,
        gingival_margins=margins,
        deformations=deformations,
        max_displacement_mm=round(max_disp, 3),
        mean_displacement_mm=round(mean_disp, 3),
        black_triangle_count=bt_count,
        tissue_health_score=round(health_score, 1),
        jaw=jaw,
    )


# ---------------------------------------------------------------------------
# Displacement computation
# ---------------------------------------------------------------------------

def _compute_tooth_displacements(
    original: dict[int, list[float]],
    moved: dict[int, list[float]],
) -> dict[int, np.ndarray]:
    """Compute per-tooth displacement vectors."""
    displacements: dict[int, np.ndarray] = {}
    for fdi in original:
        if fdi in moved:
            o = np.array(original[fdi])
            m = np.array(moved[fdi])
            displacements[fdi] = m - o
    return displacements


# ---------------------------------------------------------------------------
# Gum mesh deformation (simplified elastic model)
# ---------------------------------------------------------------------------

def _deform_gum_mesh(
    gum_mesh: trimesh.Trimesh,
    tooth_meshes: dict[int, trimesh.Trimesh],
    displacements: dict[int, np.ndarray],
    stiffness: float,
    influence_radius: float,
) -> tuple[trimesh.Trimesh | None, list[TissueDeformation]]:
    """Deform gum mesh based on tooth movements.

    Uses a distance-weighted radial basis function to propagate
    tooth displacements to nearby gum vertices.
    """
    if not displacements or gum_mesh is None:
        return None, []

    # Check if any teeth actually moved
    max_disp = max(float(np.linalg.norm(d)) for d in displacements.values())
    if max_disp < 0.001:
        return None, []

    vertices = gum_mesh.vertices.copy()
    deformations: list[TissueDeformation] = []

    # For each tooth that moved, deform nearby gum vertices
    for fdi, disp in displacements.items():
        disp_mag = float(np.linalg.norm(disp))
        if disp_mag < 0.001:
            continue

        if fdi not in tooth_meshes:
            continue

        # Find center of the tooth
        tooth_center = tooth_meshes[fdi].centroid

        # Compute distances from gum vertices to tooth center
        dists = np.linalg.norm(vertices - tooth_center, axis=1)

        # Apply displacement with distance falloff
        within_radius = dists < influence_radius
        if not np.any(within_radius):
            continue

        for idx in np.where(within_radius)[0]:
            d = dists[idx]
            # Gaussian falloff: more displacement closer to tooth
            weight = np.exp(-0.5 * (d / (influence_radius / 3))**2)
            # Stiffness reduces displacement
            effective_disp = disp * weight * (1.0 - stiffness)

            original_pos = vertices[idx].copy()
            vertices[idx] += effective_disp
            displacement_mm = float(np.linalg.norm(effective_disp))

            if displacement_mm > 0.001:
                strain = displacement_mm / max(d, 0.1)
                deformations.append(TissueDeformation(
                    vertex_index=int(idx),
                    original_position=original_pos.tolist(),
                    deformed_position=vertices[idx].tolist(),
                    displacement_mm=round(displacement_mm, 4),
                    strain=round(strain, 4),
                ))

    deformed = trimesh.Trimesh(
        vertices=vertices,
        faces=gum_mesh.faces.copy(),
        process=False,
    )

    return deformed, deformations


# ---------------------------------------------------------------------------
# Papilla estimation
# ---------------------------------------------------------------------------

def _estimate_papillae(
    tooth_centroids: dict[int, list[float]],
    tooth_meshes: dict[int, trimesh.Trimesh],
    jaw: str,
) -> list[PapillaInfo]:
    """Estimate interdental papilla dimensions between adjacent teeth."""
    papillae: list[PapillaInfo] = []
    fdis = sorted(tooth_centroids.keys())

    for i in range(len(fdis)):
        for j in range(i + 1, len(fdis)):
            fdi_a, fdi_b = fdis[i], fdis[j]
            if not _are_adjacent(fdi_a, fdi_b):
                continue

            ca = np.array(tooth_centroids[fdi_a])
            cb = np.array(tooth_centroids[fdi_b])

            # Interproximal distance
            inter_dist = float(np.linalg.norm(ca - cb))

            # Papilla dimensions (empirical estimates)
            if fdi_a in tooth_meshes and fdi_b in tooth_meshes:
                tree_b = cKDTree(tooth_meshes[fdi_b].vertices)
                dists, _ = tree_b.query(tooth_meshes[fdi_a].vertices, k=1)
                gap = float(np.min(dists))
            else:
                gap = inter_dist - 5.0  # rough estimate

            # Papilla height: Tarnow rule — height depends on bone crest distance
            # Simplified: based on interproximal gap
            papilla_height = _estimate_papilla_height(gap)
            papilla_width = max(0.5, gap * 0.8)

            # Papilla tip position: midpoint between teeth, slightly toward teeth
            midpoint = ((ca + cb) / 2).tolist()
            base = midpoint.copy()
            if jaw == "upper":
                midpoint[1] -= papilla_height / 2
            else:
                midpoint[1] += papilla_height / 2

            # Black triangle risk
            bt_risk = _assess_black_triangle_risk(gap, papilla_height)

            papillae.append(PapillaInfo(
                fdi_mesial=min(fdi_a, fdi_b),
                fdi_distal=max(fdi_a, fdi_b),
                height_mm=round(papilla_height, 2),
                width_mm=round(papilla_width, 2),
                tip_position=midpoint,
                base_position=base,
                black_triangle_risk=bt_risk,
            ))

    return papillae


def _estimate_papilla_height(gap_mm: float) -> float:
    """Estimate papilla height from interproximal gap (Tarnow rule).

    Tarnow et al. 1992:
    - ≤5mm bone crest to contact: papilla present ~100%
    - 6mm: ~56%
    - ≥7mm: ~27%
    """
    if gap_mm <= 0:
        return 4.5  # teeth touching, full papilla
    elif gap_mm < 1.0:
        return 4.0
    elif gap_mm < 2.0:
        return 3.0
    elif gap_mm < 3.0:
        return 2.0
    elif gap_mm < 5.0:
        return 1.0
    else:
        return 0.5  # large gap, minimal papilla


def _assess_black_triangle_risk(gap_mm: float, papilla_height_mm: float) -> str:
    """Assess risk of black triangle formation."""
    if gap_mm > 3.0 and papilla_height_mm < 2.0:
        return "high"
    elif gap_mm > 2.0 and papilla_height_mm < 3.0:
        return "moderate"
    elif gap_mm > 1.5:
        return "low"
    return "none"


def _are_adjacent(fdi_a: int, fdi_b: int) -> bool:
    """Check if two FDI numbers represent adjacent teeth."""
    qa, qb = fdi_a // 10, fdi_b // 10
    na, nb = fdi_a % 10, fdi_b % 10

    if qa == qb:
        return abs(na - nb) == 1
    if na == 1 and nb == 1:
        if (qa in (1, 2) and qb in (1, 2)) or (qa in (3, 4) and qb in (3, 4)):
            return True
    return False


# ---------------------------------------------------------------------------
# Gingival margin estimation
# ---------------------------------------------------------------------------

def _estimate_gingival_margins(
    gum_mesh: trimesh.Trimesh,
    tooth_meshes: dict[int, trimesh.Trimesh],
    jaw: str,
) -> list[GingivalMarginPoint]:
    """Estimate gingival margin positions around each tooth."""
    margins: list[GingivalMarginPoint] = []

    gum_tree = cKDTree(gum_mesh.vertices)

    for fdi, tooth in tooth_meshes.items():
        center = tooth.centroid
        bbox_min = tooth.vertices.min(axis=0)
        bbox_max = tooth.vertices.max(axis=0)

        # Find gum vertices close to this tooth
        tooth_radius = float(np.linalg.norm(bbox_max - bbox_min)) / 2
        indices = gum_tree.query_ball_point(center, tooth_radius * 1.5)

        if not indices:
            continue

        nearby_gum = gum_mesh.vertices[indices]

        # Buccal: max |X| direction from center
        buccal_dir = np.sign(center[0]) if abs(center[0]) > 0.1 else 1.0
        buccal_idx = np.argmax(nearby_gum[:, 0] * buccal_dir)
        buccal = nearby_gum[buccal_idx].tolist()

        # Lingual: opposite of buccal
        lingual_idx = np.argmin(nearby_gum[:, 0] * buccal_dir)
        lingual = nearby_gum[lingual_idx].tolist()

        # Mesial/Distal: along Z axis
        mesial_idx = np.argmax(nearby_gum[:, 2])
        mesial = nearby_gum[mesial_idx].tolist()
        distal_idx = np.argmin(nearby_gum[:, 2])
        distal = nearby_gum[distal_idx].tolist()

        # Margin height: distance from tooth base to margin
        if jaw == "upper":
            margin_height = float(center[1] - bbox_min[1])
        else:
            margin_height = float(bbox_max[1] - center[1])

        margins.append(GingivalMarginPoint(
            fdi=fdi,
            buccal_margin=buccal,
            lingual_margin=lingual,
            mesial_margin=mesial,
            distal_margin=distal,
            margin_height_mm=round(margin_height, 2),
        ))

    return margins


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------

def _compute_tissue_health(
    papillae: list[PapillaInfo],
    max_displacement: float,
    mean_displacement: float,
) -> float:
    """Compute a tissue health score (0-100).

    Higher is better. Penalizes:
    - Black triangle risk
    - Large tissue deformations
    - Missing papillae
    """
    score = 100.0

    # Penalize black triangles
    for p in papillae:
        if p.black_triangle_risk == "high":
            score -= 15
        elif p.black_triangle_risk == "moderate":
            score -= 8
        elif p.black_triangle_risk == "low":
            score -= 3

    # Penalize large displacements
    if max_displacement > 2.0:
        score -= 10
    elif max_displacement > 1.0:
        score -= 5

    if mean_displacement > 1.0:
        score -= 5

    return max(0.0, min(100.0, score))
