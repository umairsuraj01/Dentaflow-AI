# ipr_simulation.py — Interproximal Reduction (IPR) simulation.
#
# IPR is the controlled removal of enamel between adjacent teeth to create
# space for alignment. Typical amounts: 0.1-0.5mm per contact.
#
# This module:
#   1. Detects which contacts are tight (need IPR)
#   2. Suggests IPR amounts based on crowding analysis
#   3. Simulates the effect of IPR on spacing
#   4. Validates IPR doesn't exceed safe limits

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ai.analysis.collision_detection import (
    ADJACENT_PAIRS,
    compute_interproximal_distances,
)

logger = logging.getLogger(__name__)

# Clinical IPR limits
MAX_IPR_PER_CONTACT_MM = 0.5   # maximum safe reduction per contact
MIN_IPR_INCREMENT_MM = 0.1     # minimum practical increment
MAX_TOTAL_IPR_PER_ARCH_MM = 8.0  # maximum total IPR per arch (safety limit)

# Enamel thickness limits (approximate, per tooth surface)
ENAMEL_THICKNESS_MM = {
    "incisor": 1.2,
    "canine": 1.5,
    "premolar": 1.3,
    "molar": 1.5,
}


@dataclass
class IPRContact:
    """IPR specification for one interproximal contact."""
    fdi_a: int
    fdi_b: int
    current_gap_mm: float        # positive = gap, negative = overlap
    suggested_ipr_mm: float      # suggested reduction amount
    max_safe_ipr_mm: float       # maximum safe amount for this contact
    contact_type: str            # "tight", "overlap", "normal", "spaced"


@dataclass
class IPRPlan:
    """Complete IPR plan for an arch."""
    jaw: str
    contacts: list[IPRContact]
    total_ipr_mm: float                # sum of all suggested IPR
    total_space_gained_mm: float       # total space gained (IPR + existing gaps)
    crowding_mm: float                 # from space analysis
    ipr_sufficient: bool               # can IPR alone resolve crowding?
    warnings: list[str] = field(default_factory=list)


def compute_ipr_plan(
    tooth_data: dict[int, dict],
    jaw: str,
    crowding_mm: float = 0.0,
    custom_ipr: dict[tuple[int, int], float] | None = None,
) -> IPRPlan:
    """Compute an IPR plan for one arch.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        jaw: "upper" or "lower"
        crowding_mm: Amount of crowding from space analysis (positive = crowding).
        custom_ipr: Optional manual overrides {(fdi_a, fdi_b): amount_mm}.

    Returns:
        IPRPlan with suggested amounts per contact.
    """
    from ai.utils.fdi_numbering import get_quadrant

    # Get interproximal distances for this jaw
    all_distances = compute_interproximal_distances(tooth_data)
    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)

    jaw_contacts = []
    for d in all_distances:
        q_a = get_quadrant(d["fdi_a"])
        q_b = get_quadrant(d["fdi_b"])
        if q_a in jaw_quadrants and q_b in jaw_quadrants:
            jaw_contacts.append(d)

    # Build IPR contacts
    contacts: list[IPRContact] = []
    total_ipr = 0.0
    warnings: list[str] = []

    # Distribute IPR across tight contacts
    tight_contacts = [c for c in jaw_contacts if c["distance_mm"] < 0.5]
    n_tight = len(tight_contacts) if tight_contacts else 1

    # If there's crowding, distribute it across contacts
    ipr_per_contact = 0.0
    if crowding_mm > 0 and tight_contacts:
        ipr_per_contact = min(
            crowding_mm / n_tight,
            MAX_IPR_PER_CONTACT_MM,
        )

    for cd in jaw_contacts:
        fdi_a, fdi_b = cd["fdi_a"], cd["fdi_b"]
        gap = cd["distance_mm"]

        # Maximum safe IPR for this contact
        max_safe = _max_safe_ipr(fdi_a, fdi_b)

        # Check for custom override
        if custom_ipr:
            key = (min(fdi_a, fdi_b), max(fdi_a, fdi_b))
            if key in custom_ipr:
                suggested = min(custom_ipr[key], max_safe)
                contacts.append(IPRContact(
                    fdi_a=fdi_a, fdi_b=fdi_b,
                    current_gap_mm=round(gap, 2),
                    suggested_ipr_mm=round(suggested, 2),
                    max_safe_ipr_mm=round(max_safe, 2),
                    contact_type=cd["contact_type"],
                ))
                total_ipr += suggested
                continue

        # Auto-suggest IPR based on contact tightness and crowding.
        # Note: overlap (gap < 0) from bbox-based detection includes
        # segmentation noise so we don't use abs(gap) directly.
        # Instead, distribute the crowding evenly across tight contacts.
        if gap < 0.5 and crowding_mm > 0:
            # Tight or overlapping contact — apply proportional IPR
            suggested = min(ipr_per_contact, max_safe)
        elif gap < 0:
            # Overlapping but no crowding reported — suggest minimal IPR
            suggested = min(0.2, max_safe)
        else:
            suggested = 0.0

        # Round to nearest 0.1mm (clinical standard)
        suggested = round(suggested / MIN_IPR_INCREMENT_MM) * MIN_IPR_INCREMENT_MM

        if suggested > 0:
            total_ipr += suggested

        contact_type = cd["contact_type"]
        if gap < -0.5:
            contact_type = "overlap"
        elif gap < 0.1:
            contact_type = "tight"

        contacts.append(IPRContact(
            fdi_a=fdi_a, fdi_b=fdi_b,
            current_gap_mm=round(gap, 2),
            suggested_ipr_mm=round(suggested, 2),
            max_safe_ipr_mm=round(max_safe, 2),
            contact_type=contact_type,
        ))

    # Check safety limits
    if total_ipr > MAX_TOTAL_IPR_PER_ARCH_MM:
        warnings.append(
            f"Total IPR ({total_ipr:.1f}mm) exceeds safety limit "
            f"({MAX_TOTAL_IPR_PER_ARCH_MM}mm). Consider extraction instead."
        )

    # Check if IPR is sufficient for crowding
    total_space = total_ipr + sum(
        max(0, c.current_gap_mm) for c in contacts
    )
    ipr_sufficient = total_space >= crowding_mm if crowding_mm > 0 else True

    if not ipr_sufficient:
        deficit = crowding_mm - total_space
        warnings.append(
            f"IPR alone insufficient: {deficit:.1f}mm additional space needed. "
            f"Consider extraction or arch expansion."
        )

    logger.info(
        "IPR plan (%s): %d contacts, total IPR=%.1fmm, crowding=%.1fmm, sufficient=%s",
        jaw, len(contacts), total_ipr, crowding_mm, ipr_sufficient,
    )

    return IPRPlan(
        jaw=jaw,
        contacts=contacts,
        total_ipr_mm=round(total_ipr, 2),
        total_space_gained_mm=round(total_space, 2),
        crowding_mm=round(crowding_mm, 2),
        ipr_sufficient=ipr_sufficient,
        warnings=warnings,
    )


def simulate_ipr_effect(
    tooth_data: dict[int, dict],
    ipr_plan: IPRPlan,
) -> dict[int, dict]:
    """Simulate the effect of IPR on tooth positions.

    Returns modified tooth_data with teeth shifted to close IPR gaps.
    This is a simplified simulation — teeth on each side shift toward
    the midline to utilize the IPR space.
    """
    modified = {}
    for fdi, data in tooth_data.items():
        modified[fdi] = {
            "centroid": list(data["centroid"]),
            "bbox_min": list(data["bbox_min"]),
            "bbox_max": list(data["bbox_max"]),
        }

    # Apply IPR: for each contact with IPR, shift the more lateral tooth
    # slightly toward the other tooth
    for contact in ipr_plan.contacts:
        if contact.suggested_ipr_mm <= 0:
            continue

        fdi_a, fdi_b = contact.fdi_a, contact.fdi_b
        if fdi_a not in modified or fdi_b not in modified:
            continue

        # Each tooth gets half the IPR movement
        half_ipr = contact.suggested_ipr_mm / 2

        ca = np.array(modified[fdi_a]["centroid"])
        cb = np.array(modified[fdi_b]["centroid"])

        # Direction from a to b
        direction = cb - ca
        dist = np.linalg.norm(direction)
        if dist < 1e-8:
            continue
        direction = direction / dist

        # Move each tooth toward the other by half the IPR amount
        for fdi, sign in [(fdi_a, 1), (fdi_b, -1)]:
            offset = direction * half_ipr * sign
            modified[fdi]["centroid"] = (
                np.array(modified[fdi]["centroid"]) + offset
            ).tolist()
            modified[fdi]["bbox_min"] = (
                np.array(modified[fdi]["bbox_min"]) + offset
            ).tolist()
            modified[fdi]["bbox_max"] = (
                np.array(modified[fdi]["bbox_max"]) + offset
            ).tolist()

    return modified


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


def _max_safe_ipr(fdi_a: int, fdi_b: int) -> float:
    """Compute maximum safe IPR for a contact based on enamel thickness."""
    type_a = _tooth_type(fdi_a)
    type_b = _tooth_type(fdi_b)

    # IPR removes enamel from both teeth (half from each side)
    # Safe limit is ~50% of the thinner enamel
    min_enamel = min(
        ENAMEL_THICKNESS_MM.get(type_a, 1.0),
        ENAMEL_THICKNESS_MM.get(type_b, 1.0),
    )
    return min(min_enamel * 0.5, MAX_IPR_PER_CONTACT_MM)
