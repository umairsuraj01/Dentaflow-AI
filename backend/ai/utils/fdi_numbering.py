# fdi_numbering.py — FDI tooth numbering helpers.

from app.constants import AI_NUM_CLASSES

# FDI universal numbering: quadrant (1-4) + tooth (1-8)
# Upper right: 11-18, Upper left: 21-28
# Lower left: 31-38, Lower right: 41-48

FDI_UPPER_RIGHT = list(range(11, 19))  # 11-18
FDI_UPPER_LEFT = list(range(21, 29))   # 21-28
FDI_LOWER_LEFT = list(range(31, 39))   # 31-38
FDI_LOWER_RIGHT = list(range(41, 49))  # 41-48

FDI_ALL = FDI_UPPER_RIGHT + FDI_UPPER_LEFT + FDI_LOWER_LEFT + FDI_LOWER_RIGHT
FDI_UPPER = FDI_UPPER_RIGHT + FDI_UPPER_LEFT
FDI_LOWER = FDI_LOWER_LEFT + FDI_LOWER_RIGHT

# Class index 0 = background, 1-32 = teeth (sorted FDI order)
_CLASS_TO_FDI = {0: 0}  # 0 = background
for idx, fdi in enumerate(sorted(FDI_ALL), start=1):
    _CLASS_TO_FDI[idx] = fdi

_FDI_TO_CLASS = {v: k for k, v in _CLASS_TO_FDI.items()}


def class_to_fdi(class_idx: int) -> int:
    """Convert model class index (0-32) to FDI number. 0 = background."""
    return _CLASS_TO_FDI.get(class_idx, 0)


def fdi_to_class(fdi_number: int) -> int:
    """Convert FDI number to model class index. 0 = background."""
    return _FDI_TO_CLASS.get(fdi_number, 0)


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
    """Return a unique RGB color for a tooth. Background = dark gray."""
    if fdi_number == 0:
        return (80, 80, 80)
    palette = [
        (255, 99, 71), (255, 165, 0), (255, 215, 0), (50, 205, 50),
        (0, 191, 255), (138, 43, 226), (255, 20, 147), (0, 255, 127),
        (255, 140, 0), (30, 144, 255), (255, 105, 180), (0, 250, 154),
        (220, 20, 60), (255, 69, 0), (127, 255, 0), (64, 224, 208),
        (186, 85, 211), (255, 228, 181), (100, 149, 237), (244, 164, 96),
        (173, 216, 230), (250, 128, 114), (144, 238, 144), (221, 160, 221),
        (176, 224, 230), (255, 182, 193), (135, 206, 250), (152, 251, 152),
        (255, 160, 122), (175, 238, 238), (238, 130, 238), (240, 230, 140),
    ]
    idx = fdi_to_class(fdi_number) - 1
    return palette[idx % len(palette)]
