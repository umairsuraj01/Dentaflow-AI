# dental_analysis.py — Clinical dental measurements and diagnostics.
#
# Computes standard orthodontic analyses from segmented tooth data:
#   - Space analysis (crowding / spacing)
#   - Bolton analysis (tooth-size discrepancy)
#   - Arch form analysis (comparison to ideal curves)
#   - Overjet / overbite (requires both arches)
#   - Midline assessment
#
# All measurements are in millimeters (mm) and degrees.
# Input: extracted tooth data with centroids and bounding boxes.

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ai.utils.fdi_numbering import get_quadrant

logger = logging.getLogger(__name__)

# Average mesiodistal widths (mm) from dental literature (Caucasian norms)
# Used as fallback when measured widths seem unreasonable.
AVG_TOOTH_WIDTHS = {
    # Upper teeth (FDI 11-17)
    11: 8.5, 12: 6.5, 13: 7.5, 14: 7.0, 15: 6.5, 16: 10.0, 17: 9.0, 18: 8.5,
    21: 8.5, 22: 6.5, 23: 7.5, 24: 7.0, 25: 6.5, 26: 10.0, 27: 9.0, 28: 8.5,
    # Lower teeth (FDI 31-47)
    31: 5.5, 32: 6.0, 33: 7.0, 34: 7.0, 35: 7.0, 36: 11.0, 37: 10.5, 38: 10.0,
    41: 5.5, 42: 6.0, 43: 7.0, 44: 7.0, 45: 7.0, 46: 11.0, 47: 10.5, 48: 10.0,
}


@dataclass
class ToothMeasurement:
    """Measurements for a single tooth."""
    fdi: int
    centroid: list[float]
    mesiodistal_width: float   # mm — measured from bounding box
    buccolingual_width: float  # mm — measured from bounding box
    height: float              # mm — crown height from bounding box


@dataclass
class SpaceAnalysis:
    """Space analysis result for one arch."""
    arch: str                         # "upper" or "lower"
    total_tooth_width_mm: float       # sum of all mesiodistal widths
    available_arch_length_mm: float   # perimeter of the arch curve
    discrepancy_mm: float             # negative = crowding, positive = spacing
    crowding_severity: str            # "none", "mild", "moderate", "severe"
    per_segment: dict[str, float]     # {"anterior": ..., "right_posterior": ..., ...}


@dataclass
class BoltonAnalysis:
    """Bolton tooth-size analysis (requires both arches)."""
    overall_ratio: float         # lower 12 / upper 12 × 100 (ideal: 91.3%)
    anterior_ratio: float        # lower 6 / upper 6 × 100 (ideal: 77.2%)
    overall_excess_mm: float     # mm of excess (+ = lower excess, - = upper excess)
    anterior_excess_mm: float
    overall_interpretation: str  # "normal", "lower_excess", "upper_excess"
    anterior_interpretation: str


@dataclass
class ArchFormAnalysis:
    """Arch form comparison to ideal curves."""
    arch: str
    arch_width_mm: float              # inter-molar distance
    arch_depth_mm: float              # incisor to molar line
    arch_form_type: str               # "narrow", "average", "broad"
    tooth_positions: dict[int, list[float]]  # {fdi: [x, z]} projected to occlusal plane
    ideal_arch_points: list[list[float]]     # ideal arch curve points


@dataclass
class OverjetOverbite:
    """Overjet and overbite measurements (requires both arches)."""
    overjet_mm: float       # horizontal distance: upper incisors ahead of lower
    overbite_mm: float      # vertical overlap of upper over lower incisors
    overjet_class: str      # "normal" (2-4mm), "increased", "edge_to_edge", "crossbite"
    overbite_class: str     # "normal" (2-4mm), "deep", "open"


@dataclass
class MidlineAssessment:
    """Dental midline analysis."""
    upper_midline: list[float] | None   # [x, y, z] midpoint of 11-21 gap
    lower_midline: list[float] | None   # [x, y, z] midpoint of 31-41 gap
    deviation_mm: float | None          # lateral distance between midlines
    interpretation: str                 # "aligned", "mild_shift", "significant_shift"


@dataclass
class DentalAnalysisResult:
    """Complete dental analysis output."""
    tooth_measurements: list[ToothMeasurement]
    space_analysis: SpaceAnalysis | None = None
    bolton_analysis: BoltonAnalysis | None = None
    arch_form: ArchFormAnalysis | None = None
    overjet_overbite: OverjetOverbite | None = None
    midline: MidlineAssessment | None = None


def measure_teeth(
    tooth_data: dict[int, dict],
) -> list[ToothMeasurement]:
    """Measure each tooth using inter-centroid distances and average widths.

    Bounding box measurements are unreliable for segmented meshes because
    the segmentation boundaries include some surrounding gum. Instead, we:
    1. Use average mesiodistal widths from dental literature as baseline.
    2. Scale them using the ratio of measured inter-centroid distances to
       expected inter-centroid distances (sum of adjacent half-widths).
    3. Measure height from the bounding box Y extent (most reliable axis).

    Args:
        tooth_data: {fdi: {"centroid": [x,y,z], "bbox_min": [x,y,z], "bbox_max": [x,y,z]}}

    Returns:
        List of ToothMeasurement for each tooth (excluding gum).
    """
    teeth_list = [(fdi, data) for fdi, data in tooth_data.items() if fdi != 0]
    teeth_list.sort(key=lambda t: _arch_order(t[0]))

    if not teeth_list:
        return []

    # Compute scaling factor from actual vs expected inter-centroid distances
    scale = _compute_width_scale(teeth_list)

    measurements = []
    for fdi, data in teeth_list:
        bbox_min = np.array(data["bbox_min"])
        bbox_max = np.array(data["bbox_max"])
        extent = bbox_max - bbox_min

        height = float(extent[1])  # Y extent is reliable

        # Use literature average, scaled by the arch-specific factor
        avg_md = AVG_TOOTH_WIDTHS.get(fdi, 7.0)
        md_width = avg_md * scale

        # Buccolingual: use the smaller of X/Z extents as a rough estimate
        bl_width = min(float(extent[0]), float(extent[2]))
        # Clamp to reasonable range
        bl_width = max(4.0, min(bl_width, 15.0))

        measurements.append(ToothMeasurement(
            fdi=fdi,
            centroid=data["centroid"],
            mesiodistal_width=round(md_width, 2),
            buccolingual_width=round(bl_width, 2),
            height=round(height, 2),
        ))

    measurements.sort(key=lambda m: m.fdi)
    return measurements


def _compute_width_scale(teeth_list: list[tuple[int, dict]]) -> float:
    """Compute a scaling factor for average tooth widths based on real arch.

    Compares the actual arch perimeter (sum of inter-centroid distances)
    to the expected inter-centroid perimeter (sum of half-widths of adjacent
    pairs, which approximates the expected centroid-to-centroid distance).
    """
    if len(teeth_list) < 2:
        return 1.0

    # Actual inter-centroid perimeter (XZ plane distance through centroids)
    # Using XZ plane avoids Y-axis noise from different crown heights
    actual_perimeter = 0.0
    for i in range(len(teeth_list) - 1):
        c1 = np.array(teeth_list[i][1]["centroid"])
        c2 = np.array(teeth_list[i + 1][1]["centroid"])
        # Use XZ distance only (arch plane)
        diff_xz = np.array([c2[0] - c1[0], c2[2] - c1[2]])
        actual_perimeter += float(np.linalg.norm(diff_xz))

    # Expected inter-centroid distances: distance between adjacent centroids
    # is approximately (w1 + w2) / 2 when teeth are in ideal contact
    expected_perimeter = 0.0
    for i in range(len(teeth_list) - 1):
        fdi1 = teeth_list[i][0]
        fdi2 = teeth_list[i + 1][0]
        w1 = AVG_TOOTH_WIDTHS.get(fdi1, 7.0)
        w2 = AVG_TOOTH_WIDTHS.get(fdi2, 7.0)
        expected_perimeter += (w1 + w2) / 2

    if expected_perimeter < 1e-8:
        return 1.0

    scale = actual_perimeter / expected_perimeter
    # Clamp to reasonable range (0.8-1.2x of average)
    return max(0.8, min(scale, 1.2))


def compute_space_analysis(
    measurements: list[ToothMeasurement],
    jaw: str,
) -> SpaceAnalysis:
    """Compute space analysis (crowding/spacing) for one arch.

    Space discrepancy = available arch length - total tooth width.
    Negative = crowding, positive = spacing.
    """
    teeth = [m for m in measurements if _is_jaw(m.fdi, jaw)]
    if not teeth:
        raise ValueError(f"No teeth found for {jaw} jaw")

    total_width = sum(m.mesiodistal_width for m in teeth)

    # Compute available arch length.
    # The arch perimeter through centroids approximates the space available
    # PLUS half a tooth width at each end (the centroid path starts at the
    # center of the first tooth and ends at the center of the last).
    sorted_teeth = sorted(teeth, key=lambda t: _arch_order(t.fdi))
    centroids_xz = [[m.centroid[0], m.centroid[2]] for m in sorted_teeth]
    centroid_path = _compute_arch_perimeter(centroids_xz)

    # Add half-widths at the two endpoints to get full available length
    first_half = sorted_teeth[0].mesiodistal_width / 2 if sorted_teeth else 0
    last_half = sorted_teeth[-1].mesiodistal_width / 2 if sorted_teeth else 0
    arch_length = centroid_path + first_half + last_half

    discrepancy = arch_length - total_width

    # Severity classification
    if discrepancy >= -1:
        severity = "none"
    elif discrepancy >= -4:
        severity = "mild"
    elif discrepancy >= -8:
        severity = "moderate"
    else:
        severity = "severe"

    # Per-segment analysis
    anterior_fdis = _get_anterior_fdis(jaw)
    right_post_fdis = _get_right_posterior_fdis(jaw)
    left_post_fdis = _get_left_posterior_fdis(jaw)

    per_segment = {}
    for name, fdis in [("anterior", anterior_fdis),
                        ("right_posterior", right_post_fdis),
                        ("left_posterior", left_post_fdis)]:
        seg_teeth = [m for m in teeth if m.fdi in fdis]
        if seg_teeth:
            seg_width = sum(m.mesiodistal_width for m in seg_teeth)
            seg_centroids = [[m.centroid[0], m.centroid[2]]
                            for m in sorted(seg_teeth, key=lambda t: _arch_order(t.fdi))]
            seg_length = _compute_arch_perimeter(seg_centroids)
            per_segment[name] = round(seg_length - seg_width, 2)

    logger.info(
        "Space analysis (%s): total_width=%.1fmm, arch_length=%.1fmm, "
        "discrepancy=%.1fmm (%s)",
        jaw, total_width, arch_length, discrepancy, severity,
    )

    return SpaceAnalysis(
        arch=jaw,
        total_tooth_width_mm=round(total_width, 2),
        available_arch_length_mm=round(arch_length, 2),
        discrepancy_mm=round(discrepancy, 2),
        crowding_severity=severity,
        per_segment=per_segment,
    )


def compute_bolton_analysis(
    upper_measurements: list[ToothMeasurement],
    lower_measurements: list[ToothMeasurement],
) -> BoltonAnalysis:
    """Compute Bolton tooth-size discrepancy analysis.

    Bolton Overall Ratio: sum of lower 12 / sum of upper 12 × 100
    Ideal overall: 91.3% ± 1.91
    Bolton Anterior Ratio: sum of lower 6 / sum of upper 6 × 100
    Ideal anterior: 77.2% ± 1.65
    """
    # Upper and lower 12: canine to canine + premolars + first molar on each side
    # Actually Bolton uses all 12 teeth per arch (second molar to second molar = 6+6=12 per side)
    # Bolton Overall: first molar to first molar (12 teeth)
    # Bolton Anterior: canine to canine (6 teeth)

    upper_12_fdis = {16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26}
    lower_12_fdis = {46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36}
    upper_6_fdis = {13, 12, 11, 21, 22, 23}
    lower_6_fdis = {43, 42, 41, 31, 32, 33}

    upper_map = {m.fdi: m.mesiodistal_width for m in upper_measurements}
    lower_map = {m.fdi: m.mesiodistal_width for m in lower_measurements}

    upper_12_sum = sum(upper_map.get(f, AVG_TOOTH_WIDTHS.get(f, 7.0)) for f in upper_12_fdis)
    lower_12_sum = sum(lower_map.get(f, AVG_TOOTH_WIDTHS.get(f, 7.0)) for f in lower_12_fdis)
    upper_6_sum = sum(upper_map.get(f, AVG_TOOTH_WIDTHS.get(f, 7.0)) for f in upper_6_fdis)
    lower_6_sum = sum(lower_map.get(f, AVG_TOOTH_WIDTHS.get(f, 7.0)) for f in lower_6_fdis)

    overall_ratio = (lower_12_sum / upper_12_sum * 100) if upper_12_sum > 0 else 0
    anterior_ratio = (lower_6_sum / upper_6_sum * 100) if upper_6_sum > 0 else 0

    # Excess calculations
    ideal_lower_12 = upper_12_sum * 0.913
    ideal_lower_6 = upper_6_sum * 0.772
    overall_excess = lower_12_sum - ideal_lower_12
    anterior_excess = lower_6_sum - ideal_lower_6

    # Interpretation
    if abs(overall_ratio - 91.3) <= 1.91:
        overall_interp = "normal"
    elif overall_ratio > 91.3:
        overall_interp = "lower_excess"
    else:
        overall_interp = "upper_excess"

    if abs(anterior_ratio - 77.2) <= 1.65:
        anterior_interp = "normal"
    elif anterior_ratio > 77.2:
        anterior_interp = "lower_excess"
    else:
        anterior_interp = "upper_excess"

    logger.info(
        "Bolton analysis: overall=%.1f%% (%s), anterior=%.1f%% (%s)",
        overall_ratio, overall_interp, anterior_ratio, anterior_interp,
    )

    return BoltonAnalysis(
        overall_ratio=round(overall_ratio, 2),
        anterior_ratio=round(anterior_ratio, 2),
        overall_excess_mm=round(overall_excess, 2),
        anterior_excess_mm=round(anterior_excess, 2),
        overall_interpretation=overall_interp,
        anterior_interpretation=anterior_interp,
    )


def compute_arch_form(
    measurements: list[ToothMeasurement],
    jaw: str,
) -> ArchFormAnalysis:
    """Analyze arch form: width, depth, and comparison to ideal.

    Projects tooth positions onto the occlusal (XZ) plane and fits
    an ideal parabolic arch form.
    """
    teeth = [m for m in measurements if _is_jaw(m.fdi, jaw)]
    teeth.sort(key=lambda t: _arch_order(t.fdi))

    if len(teeth) < 4:
        raise ValueError(f"Need at least 4 teeth for arch form, got {len(teeth)}")

    # Project to XZ plane
    positions = {m.fdi: [m.centroid[0], m.centroid[2]] for m in teeth}

    # Arch width: distance between right and left first molars
    right_molar_fdi = 16 if jaw == "upper" else 46
    left_molar_fdi = 26 if jaw == "upper" else 36
    right_molar = positions.get(right_molar_fdi)
    left_molar = positions.get(left_molar_fdi)

    if right_molar and left_molar:
        arch_width = float(np.linalg.norm(
            np.array(right_molar) - np.array(left_molar)
        ))
    else:
        # Fallback: use most lateral teeth
        xs = [p[0] for p in positions.values()]
        arch_width = max(xs) - min(xs)

    # Arch depth: distance from midpoint of incisors to molar line
    right_incisor_fdi = 11 if jaw == "upper" else 41
    left_incisor_fdi = 21 if jaw == "upper" else 31
    ri = positions.get(right_incisor_fdi)
    li = positions.get(left_incisor_fdi)

    if ri and li and right_molar and left_molar:
        incisor_midpoint = np.array([(ri[0] + li[0]) / 2, (ri[1] + li[1]) / 2])
        molar_midpoint = np.array([
            (right_molar[0] + left_molar[0]) / 2,
            (right_molar[1] + left_molar[1]) / 2,
        ])
        arch_depth = float(np.linalg.norm(incisor_midpoint - molar_midpoint))
    else:
        zs = [p[1] for p in positions.values()]
        arch_depth = max(zs) - min(zs)

    # Classify arch form
    if arch_width < 32:
        form_type = "narrow"
    elif arch_width > 40:
        form_type = "broad"
    else:
        form_type = "average"

    # Generate ideal arch (parabolic approximation)
    ideal_points = _generate_ideal_arch(arch_width, arch_depth, n_points=50)

    logger.info(
        "Arch form (%s): width=%.1fmm, depth=%.1fmm, type=%s",
        jaw, arch_width, arch_depth, form_type,
    )

    return ArchFormAnalysis(
        arch=jaw,
        arch_width_mm=round(arch_width, 2),
        arch_depth_mm=round(arch_depth, 2),
        arch_form_type=form_type,
        tooth_positions=positions,
        ideal_arch_points=ideal_points,
    )


def compute_overjet_overbite(
    upper_measurements: list[ToothMeasurement],
    lower_measurements: list[ToothMeasurement],
) -> OverjetOverbite:
    """Compute overjet and overbite from upper and lower incisor positions.

    Overjet: horizontal distance (Z axis) between upper and lower central incisors.
    Overbite: vertical overlap (Y axis) of upper over lower incisors.
    """
    upper_incisors = {m.fdi: m for m in upper_measurements if m.fdi in (11, 21)}
    lower_incisors = {m.fdi: m for m in lower_measurements if m.fdi in (31, 41)}

    if not upper_incisors or not lower_incisors:
        return OverjetOverbite(
            overjet_mm=0, overbite_mm=0,
            overjet_class="unknown", overbite_class="unknown",
        )

    # Average position of upper and lower incisors
    upper_avg = np.mean([m.centroid for m in upper_incisors.values()], axis=0)
    lower_avg = np.mean([m.centroid for m in lower_incisors.values()], axis=0)

    # Overjet = Z distance (anterior-posterior)
    overjet = float(upper_avg[2] - lower_avg[2])

    # Overbite = Y distance (vertical overlap)
    # For upper jaw, incisal edge is at min Y; for lower, at max Y
    upper_edge_y = np.mean([m.centroid[1] - m.height / 2 for m in upper_incisors.values()])
    lower_edge_y = np.mean([m.centroid[1] + m.height / 2 for m in lower_incisors.values()])
    overbite = float(lower_edge_y - upper_edge_y)

    # Classification
    if overjet < 0:
        oj_class = "crossbite"
    elif overjet < 1:
        oj_class = "edge_to_edge"
    elif overjet <= 4:
        oj_class = "normal"
    else:
        oj_class = "increased"

    if overbite < 0:
        ob_class = "open"
    elif overbite <= 4:
        ob_class = "normal"
    else:
        ob_class = "deep"

    logger.info(
        "Overjet: %.1fmm (%s), Overbite: %.1fmm (%s)",
        overjet, oj_class, overbite, ob_class,
    )

    return OverjetOverbite(
        overjet_mm=round(overjet, 2),
        overbite_mm=round(overbite, 2),
        overjet_class=oj_class,
        overbite_class=ob_class,
    )


def compute_midline(
    upper_measurements: list[ToothMeasurement] | None = None,
    lower_measurements: list[ToothMeasurement] | None = None,
) -> MidlineAssessment:
    """Assess dental midline alignment.

    The midline is the point between the two central incisors.
    Checks if upper and lower midlines are aligned laterally (X axis).
    """
    upper_midline = None
    lower_midline = None

    if upper_measurements:
        u11 = next((m for m in upper_measurements if m.fdi == 11), None)
        u21 = next((m for m in upper_measurements if m.fdi == 21), None)
        if u11 and u21:
            upper_midline = [
                (u11.centroid[0] + u21.centroid[0]) / 2,
                (u11.centroid[1] + u21.centroid[1]) / 2,
                (u11.centroid[2] + u21.centroid[2]) / 2,
            ]

    if lower_measurements:
        l41 = next((m for m in lower_measurements if m.fdi == 41), None)
        l31 = next((m for m in lower_measurements if m.fdi == 31), None)
        if l41 and l31:
            lower_midline = [
                (l41.centroid[0] + l31.centroid[0]) / 2,
                (l41.centroid[1] + l31.centroid[1]) / 2,
                (l41.centroid[2] + l31.centroid[2]) / 2,
            ]

    deviation = None
    if upper_midline and lower_midline:
        deviation = abs(upper_midline[0] - lower_midline[0])

    if deviation is None:
        interp = "insufficient_data"
    elif deviation < 1.0:
        interp = "aligned"
    elif deviation < 2.0:
        interp = "mild_shift"
    else:
        interp = "significant_shift"

    logger.info("Midline: deviation=%.1fmm, %s",
                deviation if deviation else 0, interp)

    return MidlineAssessment(
        upper_midline=[round(v, 2) for v in upper_midline] if upper_midline else None,
        lower_midline=[round(v, 2) for v in lower_midline] if lower_midline else None,
        deviation_mm=round(deviation, 2) if deviation is not None else None,
        interpretation=interp,
    )


def run_full_analysis(
    tooth_data: dict[int, dict],
    jaw: str,
    opposite_tooth_data: dict[int, dict] | None = None,
    opposite_jaw: str | None = None,
) -> DentalAnalysisResult:
    """Run all available dental analyses.

    Args:
        tooth_data: Primary arch {fdi: {"centroid": [...], "bbox_min": [...], "bbox_max": [...]}}
        jaw: "upper" or "lower"
        opposite_tooth_data: Optional opposite arch data for Bolton/overjet analysis.
        opposite_jaw: Jaw type of opposite arch.
    """
    measurements = measure_teeth(tooth_data)
    result = DentalAnalysisResult(tooth_measurements=measurements)

    # Space analysis
    try:
        result.space_analysis = compute_space_analysis(measurements, jaw)
    except Exception as e:
        logger.warning("Space analysis failed: %s", e)

    # Arch form
    try:
        result.arch_form = compute_arch_form(measurements, jaw)
    except Exception as e:
        logger.warning("Arch form analysis failed: %s", e)

    # Bolton, overjet/overbite, midline (require both arches)
    if opposite_tooth_data and opposite_jaw:
        opp_measurements = measure_teeth(opposite_tooth_data)

        if jaw == "upper":
            upper_m, lower_m = measurements, opp_measurements
        else:
            upper_m, lower_m = opp_measurements, measurements

        try:
            result.bolton_analysis = compute_bolton_analysis(upper_m, lower_m)
        except Exception as e:
            logger.warning("Bolton analysis failed: %s", e)

        try:
            result.overjet_overbite = compute_overjet_overbite(upper_m, lower_m)
        except Exception as e:
            logger.warning("Overjet/overbite analysis failed: %s", e)

        try:
            result.midline = compute_midline(upper_m, lower_m)
        except Exception as e:
            logger.warning("Midline analysis failed: %s", e)
    else:
        # Single-arch midline
        if jaw == "upper":
            result.midline = compute_midline(upper_measurements=measurements)
        else:
            result.midline = compute_midline(lower_measurements=measurements)

    return result


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _is_jaw(fdi: int, jaw: str) -> bool:
    """Check if an FDI number belongs to the given jaw."""
    q = get_quadrant(fdi)
    if jaw == "upper":
        return q in (1, 2)
    return q in (3, 4)


def _arch_order(fdi: int) -> float:
    """Return a sort key that orders teeth from right to left along the arch."""
    q = get_quadrant(fdi)
    t = fdi % 10
    if q in (1, 4):  # right side: 7,6,5,4,3,2,1 → sort descending
        return -t
    else:  # left side: 1,2,3,4,5,6,7 → sort ascending
        return t


def _get_anterior_fdis(jaw: str) -> set[int]:
    if jaw == "upper":
        return {13, 12, 11, 21, 22, 23}
    return {43, 42, 41, 31, 32, 33}


def _get_right_posterior_fdis(jaw: str) -> set[int]:
    if jaw == "upper":
        return {14, 15, 16, 17}
    return {44, 45, 46, 47}


def _get_left_posterior_fdis(jaw: str) -> set[int]:
    if jaw == "upper":
        return {24, 25, 26, 27}
    return {34, 35, 36, 37}


def _compute_arch_tangents(centroids_xz: list[np.ndarray]) -> list[np.ndarray]:
    """Compute the arch tangent direction at each tooth position.

    Uses finite differences on the ordered tooth centroids projected to XZ.
    Returns a list of 2D unit vectors.
    """
    n = len(centroids_xz)
    tangents = []
    for i in range(n):
        if n == 1:
            tangents.append(np.array([1.0, 0.0]))
        elif i == 0:
            t = centroids_xz[1] - centroids_xz[0]
        elif i == n - 1:
            t = centroids_xz[-1] - centroids_xz[-2]
        else:
            t = centroids_xz[i + 1] - centroids_xz[i - 1]
        norm = np.linalg.norm(t)
        if norm < 1e-8:
            tangents.append(np.array([1.0, 0.0]))
        else:
            tangents.append(t / norm)
    return tangents


def _compute_arch_perimeter(points_2d: list[list[float]]) -> float:
    """Compute the total path length through 2D points in order."""
    if len(points_2d) < 2:
        return 0
    pts = np.array(points_2d)
    diffs = np.diff(pts, axis=0)
    return float(np.sum(np.sqrt(np.sum(diffs**2, axis=1))))


def _generate_ideal_arch(width: float, depth: float, n_points: int = 50) -> list[list[float]]:
    """Generate ideal parabolic arch form points.

    The arch is a parabola: z = a * x^2 + depth
    where a is chosen so that z = 0 at x = ±width/2.
    """
    half_w = width / 2
    if half_w < 1e-8:
        return []

    a = -depth / (half_w ** 2)
    xs = np.linspace(-half_w, half_w, n_points)
    zs = a * xs**2 + depth

    return [[round(float(x), 2), round(float(z), 2)] for x, z in zip(xs, zs)]
