# test_fdi_numbering.py — Unit tests for FDI numbering utilities.

import pytest
from ai.utils.fdi_numbering import (
    UPPER_CLASS_TO_FDI,
    LOWER_CLASS_TO_FDI,
    UPPER_FDI_TO_CLASS,
    LOWER_FDI_TO_CLASS,
    class_to_fdi,
    fdi_to_class,
    is_valid_fdi,
    get_quadrant,
    get_tooth_name,
)


class TestClassToFDI:
    """Test class_to_fdi mapping for upper and lower jaws."""

    def test_upper_gum_is_zero(self):
        assert class_to_fdi(0, jaw="upper") == 0

    def test_lower_gum_is_zero(self):
        assert class_to_fdi(0, jaw="lower") == 0

    def test_upper_class_1_is_fdi_17(self):
        assert class_to_fdi(1, jaw="upper") == 17

    def test_upper_class_7_is_fdi_11(self):
        assert class_to_fdi(7, jaw="upper") == 11

    def test_upper_class_8_is_fdi_21(self):
        assert class_to_fdi(8, jaw="upper") == 21

    def test_upper_class_14_is_fdi_27(self):
        assert class_to_fdi(14, jaw="upper") == 27

    def test_lower_class_1_is_fdi_47(self):
        assert class_to_fdi(1, jaw="lower") == 47

    def test_lower_class_7_is_fdi_41(self):
        assert class_to_fdi(7, jaw="lower") == 41

    def test_lower_class_8_is_fdi_31(self):
        assert class_to_fdi(8, jaw="lower") == 31

    def test_lower_class_14_is_fdi_37(self):
        assert class_to_fdi(14, jaw="lower") == 37

    def test_all_upper_classes_mapped(self):
        """Every class 1-14 maps to a valid FDI number for upper jaw."""
        for c in range(1, 15):
            fdi = class_to_fdi(c, jaw="upper")
            assert fdi != 0, f"Class {c} mapped to 0 (gum)"
            assert is_valid_fdi(fdi), f"Class {c} -> invalid FDI {fdi}"

    def test_all_lower_classes_mapped(self):
        """Every class 1-14 maps to a valid FDI number for lower jaw."""
        for c in range(1, 15):
            fdi = class_to_fdi(c, jaw="lower")
            assert fdi != 0
            assert is_valid_fdi(fdi)

    def test_upper_teeth_in_quadrants_1_2(self):
        """Upper jaw teeth should be in quadrants 1 and 2."""
        for c in range(1, 15):
            fdi = class_to_fdi(c, jaw="upper")
            q = get_quadrant(fdi)
            assert q in (1, 2), f"Class {c} -> FDI {fdi} in quadrant {q}"

    def test_lower_teeth_in_quadrants_3_4(self):
        """Lower jaw teeth should be in quadrants 3 and 4."""
        for c in range(1, 15):
            fdi = class_to_fdi(c, jaw="lower")
            q = get_quadrant(fdi)
            assert q in (3, 4), f"Class {c} -> FDI {fdi} in quadrant {q}"

    def test_invalid_class_returns_zero(self):
        assert class_to_fdi(99, jaw="upper") == 0
        assert class_to_fdi(-1, jaw="lower") == 0


class TestFDIToClass:
    """Test reverse mapping FDI -> class index."""

    def test_round_trip_upper(self):
        for c in range(0, 15):
            fdi = class_to_fdi(c, jaw="upper")
            back = fdi_to_class(fdi, jaw="upper")
            assert back == c, f"Round trip failed: {c} -> {fdi} -> {back}"

    def test_round_trip_lower(self):
        for c in range(0, 15):
            fdi = class_to_fdi(c, jaw="lower")
            back = fdi_to_class(fdi, jaw="lower")
            assert back == c

    def test_invalid_fdi_returns_zero(self):
        assert fdi_to_class(99, jaw="upper") == 0


class TestIsValidFDI:
    def test_valid_upper_teeth(self):
        for fdi in [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28]:
            assert is_valid_fdi(fdi), f"FDI {fdi} should be valid"

    def test_valid_lower_teeth(self):
        for fdi in [31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48]:
            assert is_valid_fdi(fdi), f"FDI {fdi} should be valid"

    def test_invalid_numbers(self):
        assert not is_valid_fdi(0)
        assert not is_valid_fdi(10)
        assert not is_valid_fdi(19)
        assert not is_valid_fdi(50)


class TestGetToothName:
    def test_upper_right_central_incisor(self):
        name = get_tooth_name(11)
        assert "Central Incisor" in name
        assert "UR" in name

    def test_lower_left_first_molar(self):
        name = get_tooth_name(36)
        assert "First Molar" in name
        assert "LL" in name


class TestMappingConsistency:
    def test_upper_14_unique_teeth(self):
        """Upper jaw should produce 14 unique FDI numbers (no duplicates)."""
        fdis = [class_to_fdi(c, "upper") for c in range(1, 15)]
        assert len(set(fdis)) == 14

    def test_lower_14_unique_teeth(self):
        fdis = [class_to_fdi(c, "lower") for c in range(1, 15)]
        assert len(set(fdis)) == 14

    def test_no_overlap_between_jaws(self):
        """Upper and lower FDI sets should not overlap."""
        upper = {class_to_fdi(c, "upper") for c in range(1, 15)}
        lower = {class_to_fdi(c, "lower") for c in range(1, 15)}
        assert upper.isdisjoint(lower)
