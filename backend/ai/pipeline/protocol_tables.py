# protocol_tables.py — Protocol tables and occlusogram generation.
#
# OnyxCeph Phase 8: Protocol Tables & Occlusogram
#   - Movement protocol table (per-tooth displacement vectors)
#   - Distance protocol table (interproximal, overjet, overbite)
#   - Occlusogram: occlusal contact heat map between upper/lower arches
#   - Space analysis summary
#   - Treatment progress tracking per stage

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
class ToothMovementRecord:
    """Movement record for a single tooth."""

    fdi: int
    translation_mm: list[float]    # [tx, ty, tz]
    rotation_deg: list[float]      # [rx, ry, rz]
    total_displacement_mm: float   # magnitude of translation
    total_rotation_deg: float      # magnitude of rotation
    movement_type: str             # "bodily", "tipping", "rotation", "intrusion", etc.


@dataclass
class MovementProtocol:
    """Per-stage movement protocol table."""

    stage: int
    records: list[ToothMovementRecord]
    total_teeth_moving: int
    max_displacement_mm: float
    max_rotation_deg: float


@dataclass
class DistanceRecord:
    """Distance measurement between two teeth or landmarks."""

    fdi_a: int
    fdi_b: int
    distance_mm: float
    measurement_type: str  # "interproximal", "overjet", "overbite", "gap"


@dataclass
class DistanceProtocol:
    """Distance protocol table for an arch."""

    records: list[DistanceRecord]
    min_interproximal_mm: float
    max_interproximal_mm: float
    mean_interproximal_mm: float
    overjet_mm: float | None
    overbite_mm: float | None


@dataclass
class OcclusalContact:
    """A single occlusal contact point."""

    upper_fdi: int
    lower_fdi: int
    distance_mm: float         # vertical distance (0 = contact)
    contact_point: list[float] # [x, y, z]
    intensity: float           # 0-1 (1 = tight contact)


@dataclass
class Occlusogram:
    """Occlusal contact heat map between upper and lower arches."""

    contacts: list[OcclusalContact]
    total_contacts: int
    mean_distance_mm: float
    tight_contacts: int        # distance < 0.5mm
    open_contacts: int         # distance > 2mm
    contact_area_mm2: float


@dataclass
class SpaceAnalysisSummary:
    """Summary of arch space analysis."""

    arch_perimeter_mm: float
    tooth_material_mm: float   # sum of mesiodistal widths
    space_available_mm: float  # arch_perimeter - tooth_material
    crowding_mm: float         # negative space = crowding
    spacing_mm: float          # positive space = spacing
    bolton_ratio: float | None # anterior ratio


# ---------------------------------------------------------------------------
# Movement Protocol
# ---------------------------------------------------------------------------

def generate_movement_protocol(
    start_poses: dict[int, list[float]],   # FDI → [x, y, z] start centroids
    target_poses: dict[int, list[float]],  # FDI → [x, y, z] target centroids
    start_rotations: dict[int, list[float]] | None = None,
    target_rotations: dict[int, list[float]] | None = None,
    stage: int = 1,
) -> MovementProtocol:
    """Generate a movement protocol table for a treatment stage.

    Args:
        start_poses: FDI → [x, y, z] centroid at stage start.
        target_poses: FDI → [x, y, z] centroid at stage end.
        start_rotations: FDI → [rx, ry, rz] rotation at stage start.
        target_rotations: FDI → [rx, ry, rz] rotation at stage end.
        stage: Stage number.

    Returns:
        MovementProtocol with per-tooth movement records.
    """
    records: list[ToothMovementRecord] = []
    moving_fdis = set(start_poses.keys()) & set(target_poses.keys())

    for fdi in sorted(moving_fdis):
        s = np.array(start_poses[fdi])
        t = np.array(target_poses[fdi])
        delta = t - s
        displacement = float(np.linalg.norm(delta))

        # Rotation delta
        if start_rotations and target_rotations and fdi in start_rotations and fdi in target_rotations:
            sr = np.array(start_rotations[fdi])
            tr = np.array(target_rotations[fdi])
            rot_delta = (tr - sr).tolist()
            total_rot = float(np.linalg.norm(tr - sr))
        else:
            rot_delta = [0.0, 0.0, 0.0]
            total_rot = 0.0

        # Classify movement type
        move_type = _classify_movement(delta, rot_delta)

        records.append(ToothMovementRecord(
            fdi=fdi,
            translation_mm=delta.tolist(),
            rotation_deg=rot_delta,
            total_displacement_mm=round(displacement, 3),
            total_rotation_deg=round(total_rot, 3),
            movement_type=move_type,
        ))

    moving_records = [r for r in records if r.total_displacement_mm > 0.01 or r.total_rotation_deg > 0.01]

    return MovementProtocol(
        stage=stage,
        records=records,
        total_teeth_moving=len(moving_records),
        max_displacement_mm=round(max((r.total_displacement_mm for r in records), default=0), 3),
        max_rotation_deg=round(max((r.total_rotation_deg for r in records), default=0), 3),
    )


def _classify_movement(
    translation: np.ndarray,
    rotation: list[float],
) -> str:
    """Classify the dominant type of tooth movement."""
    tx, ty, tz = translation
    rx, ry, rz = rotation

    abs_trans = np.abs(translation)
    abs_rot = np.abs(rotation)

    # Check if primarily rotational
    if max(abs_rot) > 1.0 and np.linalg.norm(translation) < 0.1:
        if abs(ry) > abs(rx) and abs(ry) > abs(rz):
            return "rotation"
        elif abs(rx) > abs(rz):
            return "torque"
        else:
            return "tipping"

    # Check if primarily translational
    if abs(ty) > abs(tx) and abs(ty) > abs(tz):
        if ty > 0:
            return "extrusion"
        else:
            return "intrusion"

    if abs(tx) > abs(tz):
        return "bodily"

    if abs(tz) > 0.1:
        return "bodily"

    if np.linalg.norm(translation) < 0.01 and max(abs_rot) < 0.01:
        return "none"

    return "bodily"


# ---------------------------------------------------------------------------
# Distance Protocol
# ---------------------------------------------------------------------------

def generate_distance_protocol(
    tooth_centroids: dict[int, list[float]],
    tooth_meshes: dict[int, trimesh.Trimesh] | None = None,
    jaw: str = "upper",
) -> DistanceProtocol:
    """Generate a distance protocol table.

    Measures interproximal distances between adjacent teeth.
    """
    records: list[DistanceRecord] = []
    fdis = sorted(tooth_centroids.keys())

    for i in range(len(fdis)):
        for j in range(i + 1, len(fdis)):
            fdi_a, fdi_b = fdis[i], fdis[j]

            # Only measure adjacent teeth
            if not _are_adjacent_fdi(fdi_a, fdi_b):
                continue

            if tooth_meshes and fdi_a in tooth_meshes and fdi_b in tooth_meshes:
                # Precise: closest point between meshes
                dist = _mesh_distance(tooth_meshes[fdi_a], tooth_meshes[fdi_b])
            else:
                # Approximate: centroid distance
                ca = np.array(tooth_centroids[fdi_a])
                cb = np.array(tooth_centroids[fdi_b])
                dist = float(np.linalg.norm(ca - cb))

            records.append(DistanceRecord(
                fdi_a=fdi_a,
                fdi_b=fdi_b,
                distance_mm=round(dist, 3),
                measurement_type="interproximal",
            ))

    interprox_dists = [r.distance_mm for r in records if r.measurement_type == "interproximal"]

    return DistanceProtocol(
        records=records,
        min_interproximal_mm=round(min(interprox_dists), 3) if interprox_dists else 0.0,
        max_interproximal_mm=round(max(interprox_dists), 3) if interprox_dists else 0.0,
        mean_interproximal_mm=round(float(np.mean(interprox_dists)), 3) if interprox_dists else 0.0,
        overjet_mm=None,
        overbite_mm=None,
    )


def _are_adjacent_fdi(fdi_a: int, fdi_b: int) -> bool:
    """Check if two FDI numbers represent adjacent teeth."""
    qa, qb = fdi_a // 10, fdi_b // 10
    na, nb = fdi_a % 10, fdi_b % 10

    if qa == qb:
        return abs(na - nb) == 1

    # Cross-midline: 11↔21, 31↔41
    if na == 1 and nb == 1:
        if (qa == 1 and qb == 2) or (qa == 2 and qb == 1):
            return True
        if (qa == 3 and qb == 4) or (qa == 4 and qb == 3):
            return True

    return False


def _mesh_distance(a: trimesh.Trimesh, b: trimesh.Trimesh) -> float:
    """Compute minimum distance between two meshes."""
    tree = cKDTree(b.vertices)
    dists, _ = tree.query(a.vertices, k=1)
    return float(np.min(dists))


# ---------------------------------------------------------------------------
# Occlusogram
# ---------------------------------------------------------------------------

def generate_occlusogram(
    upper_meshes: dict[int, trimesh.Trimesh],
    lower_meshes: dict[int, trimesh.Trimesh],
    contact_threshold_mm: float = 2.0,
) -> Occlusogram:
    """Generate an occlusogram (occlusal contact heat map).

    Finds contact points between upper and lower teeth.

    Args:
        upper_meshes: FDI → upper tooth mesh.
        lower_meshes: FDI → lower tooth mesh.
        contact_threshold_mm: Maximum distance to consider as contact.

    Returns:
        Occlusogram with contact points and statistics.
    """
    contacts: list[OcclusalContact] = []

    for upper_fdi, u_mesh in upper_meshes.items():
        for lower_fdi, l_mesh in lower_meshes.items():
            # Only check opposing teeth (same tooth number, different arch)
            u_num = upper_fdi % 10
            l_num = lower_fdi % 10
            if abs(u_num - l_num) > 1:
                continue

            # Find close points between upper and lower
            tree = cKDTree(l_mesh.vertices)
            dists, indices = tree.query(u_mesh.vertices, k=1)

            # Find points within threshold
            close_mask = dists < contact_threshold_mm
            if not np.any(close_mask):
                continue

            close_dists = dists[close_mask]
            close_upper_pts = u_mesh.vertices[close_mask]

            # Sample representative contacts (not every vertex)
            n_contacts = min(5, len(close_dists))
            sample_idx = np.argsort(close_dists)[:n_contacts]

            for idx in sample_idx:
                dist = float(close_dists[idx])
                intensity = max(0.0, 1.0 - dist / contact_threshold_mm)
                contact_pt = close_upper_pts[idx].tolist()

                contacts.append(OcclusalContact(
                    upper_fdi=upper_fdi,
                    lower_fdi=lower_fdi,
                    distance_mm=round(dist, 3),
                    contact_point=contact_pt,
                    intensity=round(intensity, 3),
                ))

    tight = sum(1 for c in contacts if c.distance_mm < 0.5)
    open_c = sum(1 for c in contacts if c.distance_mm > 2.0)
    mean_dist = float(np.mean([c.distance_mm for c in contacts])) if contacts else 0.0

    # Approximate contact area
    contact_area = _estimate_contact_area(contacts)

    return Occlusogram(
        contacts=contacts,
        total_contacts=len(contacts),
        mean_distance_mm=round(mean_dist, 3),
        tight_contacts=tight,
        open_contacts=open_c,
        contact_area_mm2=round(contact_area, 2),
    )


def _estimate_contact_area(contacts: list[OcclusalContact]) -> float:
    """Rough estimate of total contact area from contact points."""
    if not contacts:
        return 0.0
    # Each tight contact represents approximately 0.5mm² of area
    return sum(c.intensity * 0.5 for c in contacts)


# ---------------------------------------------------------------------------
# Space analysis summary
# ---------------------------------------------------------------------------

def generate_space_analysis(
    tooth_centroids: dict[int, list[float]],
    tooth_widths_mm: dict[int, float],
    jaw: str = "upper",
    bolton_ratio: float | None = None,
) -> SpaceAnalysisSummary:
    """Generate a space analysis summary for an arch.

    Args:
        tooth_centroids: FDI → [x, y, z] centroid positions.
        tooth_widths_mm: FDI → mesiodistal width in mm.
        jaw: "upper" or "lower".
        bolton_ratio: Pre-computed Bolton ratio, or None.

    Returns:
        SpaceAnalysisSummary with crowding/spacing analysis.
    """
    if not tooth_centroids:
        return SpaceAnalysisSummary(
            arch_perimeter_mm=0, tooth_material_mm=0,
            space_available_mm=0, crowding_mm=0, spacing_mm=0,
            bolton_ratio=None,
        )

    # Compute arch perimeter from centroid chain
    fdis = sorted(tooth_centroids.keys())
    perimeter = 0.0
    for i in range(len(fdis) - 1):
        ca = np.array(tooth_centroids[fdis[i]])
        cb = np.array(tooth_centroids[fdis[i + 1]])
        perimeter += float(np.linalg.norm(ca - cb))

    # Total tooth material
    tooth_material = sum(tooth_widths_mm.get(fdi, 0) for fdi in fdis)

    space = perimeter - tooth_material
    crowding = max(0, -space)
    spacing = max(0, space)

    return SpaceAnalysisSummary(
        arch_perimeter_mm=round(perimeter, 2),
        tooth_material_mm=round(tooth_material, 2),
        space_available_mm=round(space, 2),
        crowding_mm=round(crowding, 2),
        spacing_mm=round(spacing, 2),
        bolton_ratio=bolton_ratio,
    )
