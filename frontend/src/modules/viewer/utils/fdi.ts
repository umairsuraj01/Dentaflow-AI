// fdi.ts — FDI tooth numbering utilities for the 3D viewer.

export const FDI_COLORS: Record<number, [number, number, number]> = {
  0: [80, 80, 80],
  11: [255, 99, 71], 12: [255, 165, 0], 13: [255, 215, 0], 14: [50, 205, 50],
  15: [0, 191, 255], 16: [138, 43, 226], 17: [255, 20, 147], 18: [0, 255, 127],
  21: [255, 140, 0], 22: [30, 144, 255], 23: [255, 105, 180], 24: [0, 250, 154],
  25: [220, 20, 60], 26: [255, 69, 0], 27: [127, 255, 0], 28: [64, 224, 208],
  31: [186, 85, 211], 32: [255, 228, 181], 33: [100, 149, 237], 34: [244, 164, 96],
  35: [173, 216, 230], 36: [250, 128, 114], 37: [144, 238, 144], 38: [221, 160, 221],
  41: [176, 224, 230], 42: [255, 182, 193], 43: [135, 206, 250], 44: [152, 251, 152],
  45: [255, 160, 122], 46: [175, 238, 238], 47: [238, 130, 238], 48: [240, 230, 140],
};

export const QUADRANT_NAMES: Record<number, string> = {
  1: 'UR', 2: 'UL', 3: 'LL', 4: 'LR',
};

export const TOOTH_NAMES: Record<number, string> = {
  1: 'Central Incisor', 2: 'Lateral Incisor', 3: 'Canine',
  4: 'First Premolar', 5: 'Second Premolar', 6: 'First Molar',
  7: 'Second Molar', 8: 'Third Molar',
};

export function getToothName(fdi: number): string {
  if (fdi === 0) return 'Background';
  const q = Math.floor(fdi / 10);
  const t = fdi % 10;
  return `${QUADRANT_NAMES[q] ?? '?'} ${TOOTH_NAMES[t] ?? 'Unknown'} (${fdi})`;
}

export function getFdiColor(fdi: number): [number, number, number] {
  return FDI_COLORS[fdi] ?? [80, 80, 80];
}

export function getFdiColorHex(fdi: number): string {
  const [r, g, b] = getFdiColor(fdi);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
