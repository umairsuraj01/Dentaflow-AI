# arch_form_tool.py — Arch form fitting and snap-to-arch tool.
#
# Fits teeth to standard arch forms:
#   - Parabolic (most common in orthodontics)
#   - Brader curve (based on natural tooth distribution)
#   - Catenary curve (natural chain curve)
#   - Custom (user-defined width/depth)
#
# The snap-to-arch function computes the required translation for each
# tooth to move it onto the ideal arch curve, which gives the doctor
# a starting point for the virtual setup.

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize_scalar

logger = logging.getLogger(__name__)


@dataclass
class ArchFitResult:
    """Result of fitting teeth to an arch form."""
    arch_type: str                            # "parabolic", "brader", "catenary", "custom"
    jaw: str                                  # "upper" or "lower"
    arch_width_mm: float                      # fitted arch inter-molar width
    arch_depth_mm: float                      # fitted arch depth
    ideal_positions: dict[int, list[float]]   # {fdi: [x, z]} ideal position on arch
    required_movements: dict[int, dict]       # {fdi: {"dx": mm, "dz": mm, "total": mm}}
    total_movement_mm: float                  # sum of all movements
    fit_error_mm: float                       # RMS error of current positions to arch


def fit_arch_form(
    tooth_data: dict[int, dict],
    jaw: str,
    arch_type: str = "parabolic",
    custom_width: float | None = None,
    custom_depth: float | None = None,
) -> ArchFitResult:
    """Fit teeth to an ideal arch form and compute required movements.

    Args:
        tooth_data: {fdi: {"centroid": [x,y,z], ...}}
        jaw: "upper" or "lower"
        arch_type: "parabolic", "brader", "catenary"
        custom_width: Override arch width (mm)
        custom_depth: Override arch depth (mm)

    Returns:
        ArchFitResult with ideal positions and required movements per tooth.
    """
    from ai.utils.fdi_numbering import get_quadrant

    # Collect tooth positions (XZ plane)
    teeth = {}
    for fdi, data in tooth_data.items():
        if fdi == 0:
            continue
        q = get_quadrant(fdi)
        if (jaw == "upper" and q in (1, 2)) or (jaw == "lower" and q in (3, 4)):
            teeth[fdi] = np.array([data["centroid"][0], data["centroid"][2]])

    if len(teeth) < 4:
        raise ValueError(f"Need at least 4 teeth, got {len(teeth)}")

    # Determine arch dimensions from current teeth.
    # Use the most lateral teeth (molars) for width, not all teeth,
    # to avoid crowded anterior teeth from skewing the center.
    positions = np.array(list(teeth.values()))
    fdi_list = list(teeth.keys())

    # Find molars for width reference (most reliable landmarks)
    molar_fdis = [f for f in fdi_list if f % 10 >= 6]
    if len(molar_fdis) >= 2:
        molar_positions = np.array([teeth[f] for f in molar_fdis])
        current_width = float(molar_positions[:, 0].max() - molar_positions[:, 0].min())
        # Arch center from molars (more stable than mean of all teeth)
        arch_center_x = float((molar_positions[:, 0].max() + molar_positions[:, 0].min()) / 2)
    else:
        current_width = float(positions[:, 0].max() - positions[:, 0].min())
        arch_center_x = float((positions[:, 0].max() + positions[:, 0].min()) / 2)

    current_depth = float(positions[:, 1].max() - positions[:, 1].min())

    width = custom_width or current_width
    depth = custom_depth or current_depth

    arch_front_z = float(positions[:, 1].max())  # most anterior point

    # Generate ideal arch curve function
    arch_fn = _get_arch_function(arch_type, width, depth)

    # For each tooth, find the closest point on the ideal arch
    ideal_positions: dict[int, list[float]] = {}
    required_movements: dict[int, dict] = {}
    total_movement = 0.0
    errors = []

    for fdi, pos in teeth.items():
        # Normalize position relative to arch center
        rel_x = pos[0] - arch_center_x

        # Find the closest point on the arch curve
        ideal_x, ideal_z_rel = _closest_point_on_arch(
            rel_x, pos[1] - arch_front_z + depth, arch_fn, width,
        )
        ideal_z = ideal_z_rel + arch_front_z - depth

        ideal_pos = [round(ideal_x + arch_center_x, 2), round(ideal_z, 2)]
        ideal_positions[fdi] = ideal_pos

        dx = ideal_pos[0] - pos[0]
        dz = ideal_pos[1] - pos[1]
        total = float(np.sqrt(dx**2 + dz**2))

        # Clamp individual movements to clinically reasonable range (max 5mm)
        MAX_SINGLE_MOVEMENT_MM = 5.0
        if total > MAX_SINGLE_MOVEMENT_MM:
            scale_factor = MAX_SINGLE_MOVEMENT_MM / total
            dx *= scale_factor
            dz *= scale_factor
            total = MAX_SINGLE_MOVEMENT_MM

        required_movements[fdi] = {
            "dx": round(dx, 2),
            "dz": round(dz, 2),
            "total_mm": round(total, 2),
        }
        total_movement += total
        errors.append(total)

    fit_error = float(np.sqrt(np.mean(np.array(errors)**2)))

    logger.info(
        "Arch fit (%s, %s): width=%.1fmm, depth=%.1fmm, "
        "RMS error=%.2fmm, total movement=%.1fmm",
        jaw, arch_type, width, depth, fit_error, total_movement,
    )

    return ArchFitResult(
        arch_type=arch_type,
        jaw=jaw,
        arch_width_mm=round(width, 2),
        arch_depth_mm=round(depth, 2),
        ideal_positions=ideal_positions,
        required_movements=required_movements,
        total_movement_mm=round(total_movement, 2),
        fit_error_mm=round(fit_error, 2),
    )


def snap_to_arch(
    tooth_data: dict[int, dict],
    jaw: str,
    arch_type: str = "parabolic",
    custom_width: float | None = None,
    custom_depth: float | None = None,
) -> dict[int, dict]:
    """Compute target transforms to snap teeth onto the ideal arch.

    Returns dict of {fdi: {"pos_x": dx, "pos_y": 0, "pos_z": dz}} that can
    be used directly as treatment plan targets.
    """
    fit = fit_arch_form(tooth_data, jaw, arch_type, custom_width, custom_depth)

    targets = {}
    for fdi, movement in fit.required_movements.items():
        if movement["total_mm"] > 0.1:  # skip negligible movements
            targets[fdi] = {
                "pos_x": movement["dx"],
                "pos_y": 0.0,
                "pos_z": movement["dz"],
                "rot_x": 0.0,
                "rot_y": 0.0,
                "rot_z": 0.0,
            }

    return targets


def generate_arch_curve_points(
    arch_type: str,
    width: float,
    depth: float,
    n_points: int = 100,
) -> list[list[float]]:
    """Generate XZ points along an ideal arch curve for visualization."""
    arch_fn = _get_arch_function(arch_type, width, depth)
    half_w = width / 2
    xs = np.linspace(-half_w, half_w, n_points)

    points = []
    for x in xs:
        z = arch_fn(x)
        points.append([round(float(x), 2), round(float(z), 2)])

    return points


# ---------------------------------------------------------------------------
# Arch curve functions
# ---------------------------------------------------------------------------

def _get_arch_function(arch_type: str, width: float, depth: float):
    """Return a function f(x) → z for the given arch type."""
    half_w = width / 2

    if arch_type == "parabolic":
        # z = -a*x^2 + depth, where z=0 at x=±half_w
        a = depth / (half_w ** 2) if half_w > 0 else 0
        return lambda x: -a * x**2 + depth

    elif arch_type == "catenary":
        # z = a * cosh(x/a) normalized to width/depth
        # Find 'a' such that a*cosh(half_w/a) - a = depth
        a = _fit_catenary_param(half_w, depth)
        return lambda x, _a=a: _a * (np.cosh(x / _a) - 1)

    elif arch_type == "brader":
        # Brader: elliptical arch — z = depth * sqrt(1 - (x/half_w)^2)
        return lambda x: depth * np.sqrt(max(0, 1 - (x / half_w)**2)) if half_w > 0 else 0

    else:
        # Default to parabolic
        a = depth / (half_w ** 2) if half_w > 0 else 0
        return lambda x: -a * x**2 + depth


def _fit_catenary_param(half_width: float, depth: float) -> float:
    """Find catenary parameter 'a' for given width and depth."""
    if half_width <= 0 or depth <= 0:
        return 1.0

    def objective(a):
        if a <= 0:
            return 1e10
        return (a * (np.cosh(half_width / a) - 1) - depth) ** 2

    result = minimize_scalar(objective, bounds=(0.1, 100), method='bounded')
    return max(0.1, result.x)


def _closest_point_on_arch(
    x: float,
    z: float,
    arch_fn,
    width: float,
) -> tuple[float, float]:
    """Find the closest point on the arch curve to the given (x, z) position.

    Returns (ideal_x, ideal_z) on the curve.
    """
    half_w = width / 2

    # Simple approach: evaluate curve at the current x position
    # and also search nearby for the true closest point
    def dist_sq(t):
        cx = t
        cz = arch_fn(t)
        return (cx - x)**2 + (cz - z)**2

    # Search in the range [-half_w, half_w]
    result = minimize_scalar(dist_sq, bounds=(-half_w, half_w), method='bounded')
    ideal_x = float(result.x)
    ideal_z = float(arch_fn(ideal_x))

    return ideal_x, ideal_z
