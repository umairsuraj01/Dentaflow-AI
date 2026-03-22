# fdi_numbering.py — FDI tooth numbering helpers.
#
# MeshSegNet uses 15 classes per jaw:
#   Class 0 = gum/background
#   Classes 1-14 = teeth from right 2nd molar to left 2nd molar
#
# For upper jaw: 17,16,15,14,13,12,11,21,22,23,24,25,26,27
# For lower jaw: 47,46,45,44,43,42,41,31,32,33,34,35,36,37

from __future__ import annotations

# FDI universal numbering: quadrant (1-4) + tooth (1-8)
FDI_UPPER_RIGHT = list(range(11, 19))  # 11-18
FDI_UPPER_LEFT = list(range(21, 29))   # 21-28
FDI_LOWER_LEFT = list(range(31, 39))   # 31-38
FDI_LOWER_RIGHT = list(range(41, 49))  # 41-48

FDI_ALL = FDI_UPPER_RIGHT + FDI_UPPER_LEFT + FDI_LOWER_LEFT + FDI_LOWER_RIGHT
FDI_UPPER = FDI_UPPER_RIGHT + FDI_UPPER_LEFT
FDI_LOWER = FDI_LOWER_LEFT + FDI_LOWER_RIGHT

# MeshSegNet 15-class mapping per jaw (class 0 = gum)
# Order: right 2nd molar → right central incisor → left central incisor → left 2nd molar
UPPER_CLASS_TO_FDI = {
    0: 0,   # gum
    1: 17, 2: 16, 3: 15, 4: 14, 5: 13, 6: 12, 7: 11,
    8: 21, 9: 22, 10: 23, 11: 24, 12: 25, 13: 26, 14: 27,
}

LOWER_CLASS_TO_FDI = {
    0: 0,   # gum
    1: 47, 2: 46, 3: 45, 4: 44, 5: 43, 6: 42, 7: 41,
    8: 31, 9: 32, 10: 33, 11: 34, 12: 35, 13: 36, 14: 37,
}

UPPER_FDI_TO_CLASS = {v: k for k, v in UPPER_CLASS_TO_FDI.items()}
LOWER_FDI_TO_CLASS = {v: k for k, v in LOWER_CLASS_TO_FDI.items()}

# Legacy 33-class mapping (for backward compat if needed)
_CLASS_TO_FDI_33 = {0: 0}
for idx, fdi in enumerate(sorted(FDI_ALL), start=1):
    _CLASS_TO_FDI_33[idx] = fdi
_FDI_TO_CLASS_33 = {v: k for k, v in _CLASS_TO_FDI_33.items()}


def class_to_fdi(class_idx: int, jaw: str = "upper") -> int:
    """Convert model class index (0-14) to FDI number.

    Args:
        class_idx: Model output class (0 = gum, 1-14 = teeth).
        jaw: "upper" or "lower".

    Returns:
        FDI number (0 for gum).
    """
    mapping = UPPER_CLASS_TO_FDI if jaw == "upper" else LOWER_CLASS_TO_FDI
    return mapping.get(class_idx, 0)


def fdi_to_class(fdi_number: int, jaw: str = "upper") -> int:
    """Convert FDI number to model class index."""
    mapping = UPPER_FDI_TO_CLASS if jaw == "upper" else LOWER_FDI_TO_CLASS
    return mapping.get(fdi_number, 0)


def is_valid_fdi(fdi_number: int) -> bool:
    """Check if an FDI number is valid (11-48, valid teeth)."""
    return fdi_number in FDI_ALL


def get_quadrant(fdi_number: int) -> int:
    """Return quadrant number (1-4) for an FDI tooth number."""
    return fdi_number // 10


def get_tooth_name(fdi_number: int) -> str:
    """Return human-readable name for FDI number."""
    names = {
        1: "Central Incisor", 2: "Lateral Incisor",
        3: "Canine", 4: "First Premolar",
        5: "Second Premolar", 6: "First Molar",
        7: "Second Molar", 8: "Third Molar",
    }
    quadrant_names = {1: "UR", 2: "UL", 3: "LL", 4: "LR"}
    q = get_quadrant(fdi_number)
    t = fdi_number % 10
    prefix = quadrant_names.get(q, "?")
    name = names.get(t, "Unknown")
    return f"{prefix} {name} ({fdi_number})"


def get_tooth_color(fdi_number: int) -> tuple[int, int, int]:
    """Return an RGB color (0-255 range) for a given FDI tooth number.

    Uses the same color palette as the frontend FDI_COLORS for consistency.
    Gum (0) gets gray, teeth get distinct colors matching the viewer.
    """
    # Match the frontend FDI_COLORS exactly (from viewer/utils/fdi.ts)
    _COLORS: dict[int, tuple[int, int, int]] = {
        0:  (80, 80, 80),
        11: (255, 99, 71),   12: (255, 165, 0),   13: (255, 215, 0),   14: (50, 205, 50),
        15: (0, 191, 255),   16: (138, 43, 226),   17: (255, 20, 147),  18: (0, 255, 127),
        21: (30, 144, 255),  22: (255, 105, 180),  23: (0, 206, 209),   24: (255, 140, 0),
        25: (124, 252, 0),   26: (218, 112, 214),  27: (64, 224, 208),  28: (255, 69, 0),
        31: (173, 216, 230), 32: (144, 238, 144),  33: (255, 182, 193), 34: (240, 230, 140),
        35: (176, 196, 222), 36: (221, 160, 221),  37: (152, 251, 152), 38: (250, 128, 114),
        41: (135, 206, 250), 42: (119, 221, 119),  43: (255, 160, 122), 44: (186, 85, 211),
        45: (102, 205, 170), 46: (244, 164, 96),   47: (147, 112, 219), 48: (60, 179, 113),
    }
    return _COLORS.get(fdi_number, (80, 80, 80))
