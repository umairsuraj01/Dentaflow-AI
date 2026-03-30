// numbering.ts — Tooth numbering system conversions (FDI, Universal, Palmer).
// Internal storage always uses FDI. This module provides display-only conversion.

export type NumberingSystem = 'FDI' | 'UNIVERSAL' | 'PALMER';

/**
 * FDI → Universal mapping.
 * FDI: Quadrant (1-4) + Tooth (1-8)
 *   Q1 = Upper Right (18→11), Q2 = Upper Left (21→28)
 *   Q3 = Lower Left (38→31), Q4 = Lower Right (41→48)
 * Universal: 1-16 upper (right→left), 17-32 lower (left→right)
 */
const FDI_TO_UNIVERSAL: Record<number, number> = {
  // Upper right: FDI 18-11 → Universal 1-8
  18: 1, 17: 2, 16: 3, 15: 4, 14: 5, 13: 6, 12: 7, 11: 8,
  // Upper left: FDI 21-28 → Universal 9-16
  21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
  // Lower left: FDI 38-31 → Universal 17-24
  38: 17, 37: 18, 36: 19, 35: 20, 34: 21, 33: 22, 32: 23, 31: 24,
  // Lower right: FDI 41-48 → Universal 25-32
  41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
};

/**
 * FDI → Palmer notation.
 * Palmer uses quadrant symbols + tooth number (1-8):
 *   ┘ = Upper Right, └ = Upper Left
 *   ┐ = Lower Right, ┌ = Lower Left
 */
function toPalmer(fdi: number): string {
  const quadrant = Math.floor(fdi / 10);
  const tooth = fdi % 10;
  const symbols: Record<number, string> = {
    1: `${tooth}┘`,  // Upper Right
    2: `└${tooth}`,  // Upper Left
    3: `┌${tooth}`,  // Lower Left
    4: `${tooth}┐`,  // Lower Right
  };
  return symbols[quadrant] || String(fdi);
}

/**
 * Get display label for a tooth in the specified numbering system.
 */
export function getToothLabel(fdi: number, system: NumberingSystem): string {
  switch (system) {
    case 'FDI':
      return String(fdi);
    case 'UNIVERSAL':
      return String(FDI_TO_UNIVERSAL[fdi] ?? fdi);
    case 'PALMER':
      return toPalmer(fdi);
    default:
      return String(fdi);
  }
}

/**
 * Get all three labels for a tooltip.
 */
export function getAllLabels(fdi: number): { fdi: string; universal: string; palmer: string } {
  return {
    fdi: String(fdi),
    universal: String(FDI_TO_UNIVERSAL[fdi] ?? fdi),
    palmer: toPalmer(fdi),
  };
}

export const NUMBERING_SYSTEMS: { value: NumberingSystem; label: string; desc: string }[] = [
  { value: 'FDI', label: 'FDI', desc: 'International (11-48)' },
  { value: 'UNIVERSAL', label: 'Universal', desc: 'US Standard (1-32)' },
  { value: 'PALMER', label: 'Palmer', desc: 'Quadrant (┘└┐┌ 1-8)' },
];
