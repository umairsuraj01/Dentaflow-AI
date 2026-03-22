# attachment_planner.py — Orthodontic attachment recommendation engine.
#
# Attachments are small composite shapes bonded to teeth to enable specific
# movements that aligners alone cannot achieve. This module:
#   1. Analyzes planned movements for each tooth
#   2. Recommends attachment type, position, and orientation
#   3. Validates attachment compatibility (no conflicting attachments)
#
# Attachment types:
#   - Rectangular: General translation, extrusion, intrusion
#   - Beveled: Rotation control
#   - Ellipsoid: Tipping prevention
#   - Power ridge: Root torque control
#   - Bite ramp: Overbite correction (anterior teeth)
#   - Precision cut: Elastic hooks for interarch mechanics

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger(__name__)

# Movement thresholds that require attachments (mm or degrees)
TRANSLATION_THRESHOLD_MM = 0.5    # translations > this need attachments
ROTATION_THRESHOLD_DEG = 5.0      # rotations > this need attachments
EXTRUSION_THRESHOLD_MM = 0.3      # extrusion > this needs attachment
INTRUSION_THRESHOLD_MM = 0.5      # intrusion > this needs attachment
TORQUE_THRESHOLD_DEG = 5.0        # root torque > this needs power ridge


@dataclass
class AttachmentSpec:
    """Specification for one attachment on one tooth."""
    fdi: int
    attachment_type: str      # "rectangular", "beveled", "ellipsoid", "power_ridge", "bite_ramp", "precision_cut"
    surface: str              # "buccal", "lingual", "incisal"
    position: str             # "gingival_third", "middle_third", "incisal_third"
    width_mm: float           # attachment width
    height_mm: float          # attachment height
    depth_mm: float           # attachment depth (protrusion)
    orientation_deg: float    # rotation of attachment on tooth surface (0 = vertical)
    reason: str               # why this attachment is recommended
    priority: str             # "required", "recommended", "optional"


@dataclass
class AttachmentPlan:
    """Complete attachment plan for a treatment."""
    jaw: str
    attachments: list[AttachmentSpec]
    total_attachments: int
    teeth_with_attachments: list[int]
    teeth_without_attachments: list[int]
    warnings: list[str] = field(default_factory=list)


def plan_attachments(
    tooth_data: dict[int, dict],
    targets: dict[int, dict],
    jaw: str,
) -> AttachmentPlan:
    """Plan attachments based on tooth data and movement targets.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        targets: {fdi: {"pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"}}
        jaw: "upper" or "lower"

    Returns:
        AttachmentPlan with recommended attachments per tooth.
    """
    from ai.utils.fdi_numbering import get_quadrant

    attachments: list[AttachmentSpec] = []
    warnings: list[str] = []
    teeth_with = []
    teeth_without = []

    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)

    for fdi in sorted(tooth_data.keys()):
        q = get_quadrant(fdi)
        if q not in jaw_quadrants:
            continue

        target = targets.get(fdi)
        if target is None:
            teeth_without.append(fdi)
            continue

        tooth_type = _tooth_type(fdi)
        movement = _analyze_movement(target)
        tooth_attachments = _recommend_attachments(fdi, tooth_type, movement, jaw)

        if tooth_attachments:
            attachments.extend(tooth_attachments)
            teeth_with.append(fdi)
        else:
            teeth_without.append(fdi)

    # Validate: warn about adjacent teeth both having large buccal attachments
    _check_adjacent_conflicts(attachments, warnings)

    logger.info(
        "Attachment plan (%s): %d attachments on %d teeth",
        jaw, len(attachments), len(teeth_with),
    )

    return AttachmentPlan(
        jaw=jaw,
        attachments=attachments,
        total_attachments=len(attachments),
        teeth_with_attachments=teeth_with,
        teeth_without_attachments=teeth_without,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Movement analysis
# ---------------------------------------------------------------------------

@dataclass
class MovementAnalysis:
    """Analyzed movement components for a tooth."""
    total_translation_mm: float
    pos_x: float
    pos_y: float
    pos_z: float
    rot_x: float  # torque (labio-lingual tipping)
    rot_y: float  # rotation (mesiodistal)
    rot_z: float  # tipping (mesial-distal)
    is_extrusion: bool
    is_intrusion: bool
    is_translation: bool
    is_rotation: bool
    is_tipping: bool
    is_torque: bool


def _analyze_movement(target: dict) -> MovementAnalysis:
    """Analyze the type and magnitude of tooth movement."""
    px = target.get("pos_x", 0.0)
    py = target.get("pos_y", 0.0)
    pz = target.get("pos_z", 0.0)
    rx = target.get("rot_x", 0.0)
    ry = target.get("rot_y", 0.0)
    rz = target.get("rot_z", 0.0)

    total_trans = float(np.sqrt(px**2 + py**2 + pz**2))

    return MovementAnalysis(
        total_translation_mm=total_trans,
        pos_x=px,
        pos_y=py,
        pos_z=pz,
        rot_x=rx,
        rot_y=ry,
        rot_z=rz,
        is_extrusion=py > EXTRUSION_THRESHOLD_MM,
        is_intrusion=py < -INTRUSION_THRESHOLD_MM,
        is_translation=total_trans > TRANSLATION_THRESHOLD_MM,
        is_rotation=abs(ry) > ROTATION_THRESHOLD_DEG,
        is_tipping=abs(rz) > ROTATION_THRESHOLD_DEG,
        is_torque=abs(rx) > TORQUE_THRESHOLD_DEG,
    )


# ---------------------------------------------------------------------------
# Attachment recommendation logic
# ---------------------------------------------------------------------------

def _recommend_attachments(
    fdi: int,
    tooth_type: str,
    movement: MovementAnalysis,
    jaw: str,
) -> list[AttachmentSpec]:
    """Recommend attachment(s) for a single tooth based on planned movement."""
    specs: list[AttachmentSpec] = []

    # Extrusion → rectangular attachment on buccal, gingival third
    if movement.is_extrusion:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="rectangular",
            surface="buccal",
            position="gingival_third",
            width_mm=_attachment_width(tooth_type),
            height_mm=2.0,
            depth_mm=1.0,
            orientation_deg=0,
            reason=f"Extrusion {movement.pos_y:.1f}mm requires buccal attachment for retention",
            priority="required",
        ))

    # Intrusion → rectangular attachment on buccal, incisal third
    if movement.is_intrusion:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="rectangular",
            surface="buccal",
            position="incisal_third",
            width_mm=_attachment_width(tooth_type),
            height_mm=2.0,
            depth_mm=1.0,
            orientation_deg=0,
            reason=f"Intrusion {abs(movement.pos_y):.1f}mm requires incisal attachment",
            priority="required",
        ))

    # Rotation → beveled attachment
    if movement.is_rotation:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="beveled",
            surface="buccal",
            position="middle_third",
            width_mm=_attachment_width(tooth_type),
            height_mm=2.5,
            depth_mm=1.0,
            orientation_deg=45 if movement.rot_y > 0 else -45,
            reason=f"Rotation {movement.rot_y:.1f}° requires beveled attachment for couple force",
            priority="required",
        ))

    # Root torque → power ridge (mainly for anteriors)
    if movement.is_torque:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="power_ridge",
            surface="buccal" if jaw == "upper" else "lingual",
            position="gingival_third",
            width_mm=_attachment_width(tooth_type) * 0.8,
            height_mm=1.0,
            depth_mm=0.5,
            orientation_deg=0,
            reason=f"Root torque {movement.rot_x:.1f}° requires power ridge",
            priority="required",
        ))

    # Tipping control → ellipsoid attachment
    if movement.is_tipping:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="ellipsoid",
            surface="buccal",
            position="middle_third",
            width_mm=_attachment_width(tooth_type) * 0.7,
            height_mm=2.0,
            depth_mm=0.8,
            orientation_deg=0,
            reason=f"Tipping {movement.rot_z:.1f}° requires ellipsoid for bodily movement",
            priority="recommended",
        ))

    # Large translation without rotation → rectangular on both sides
    if movement.is_translation and not movement.is_rotation and not specs:
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="rectangular",
            surface="buccal",
            position="middle_third",
            width_mm=_attachment_width(tooth_type),
            height_mm=2.0,
            depth_mm=1.0,
            orientation_deg=0,
            reason=f"Translation {movement.total_translation_mm:.1f}mm requires rectangular attachment",
            priority="recommended",
        ))

    # Anterior deep bite → bite ramp (upper incisors only)
    t_num = fdi % 10
    if jaw == "upper" and t_num in (1, 2) and movement.is_intrusion:
        # Check if there's already an attachment; add bite ramp on lingual
        specs.append(AttachmentSpec(
            fdi=fdi,
            attachment_type="bite_ramp",
            surface="lingual",
            position="incisal_third",
            width_mm=3.0,
            height_mm=2.0,
            depth_mm=1.5,
            orientation_deg=0,
            reason="Anterior bite ramp for overbite correction",
            priority="optional",
        ))

    return specs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tooth_type(fdi: int) -> str:
    """Get tooth type from FDI number."""
    t = fdi % 10
    if t in (1, 2):
        return "incisor"
    elif t == 3:
        return "canine"
    elif t in (4, 5):
        return "premolar"
    else:
        return "molar"


def _attachment_width(tooth_type: str) -> float:
    """Standard attachment width by tooth type (mm)."""
    widths = {
        "incisor": 2.0,
        "canine": 2.5,
        "premolar": 3.0,
        "molar": 4.0,
    }
    return widths.get(tooth_type, 2.5)


def _check_adjacent_conflicts(
    attachments: list[AttachmentSpec],
    warnings: list[str],
) -> None:
    """Check for adjacent teeth with potentially conflicting attachments."""
    from ai.analysis.collision_detection import ADJACENT_PAIRS

    # Build lookup: fdi → list of attachments
    att_by_fdi: dict[int, list[AttachmentSpec]] = {}
    for a in attachments:
        att_by_fdi.setdefault(a.fdi, []).append(a)

    for fdi_a, fdi_b in ADJACENT_PAIRS:
        if fdi_a in att_by_fdi and fdi_b in att_by_fdi:
            a_buccal = any(a.surface == "buccal" for a in att_by_fdi[fdi_a])
            b_buccal = any(a.surface == "buccal" for a in att_by_fdi[fdi_b])
            if a_buccal and b_buccal:
                a_sizes = [a.width_mm for a in att_by_fdi[fdi_a] if a.surface == "buccal"]
                b_sizes = [a.width_mm for a in att_by_fdi[fdi_b] if a.surface == "buccal"]
                if max(a_sizes) + max(b_sizes) > 6.0:
                    warnings.append(
                        f"Adjacent teeth {fdi_a}-{fdi_b}: large buccal attachments "
                        f"may cause aligner fit issues. Consider staggering."
                    )
