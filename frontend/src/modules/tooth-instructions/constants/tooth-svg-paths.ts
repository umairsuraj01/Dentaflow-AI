// tooth-svg-paths.ts — Anatomically realistic SVG tooth paths for dental chart.
// Each tooth has crown + root paths drawn to match dental anatomy illustrations.
// Drawn in local coordinates, scaled and positioned by the chart renderer.
// Upper teeth: root on top, crown at bottom. Flip vertically for lower teeth.

export interface ToothSVGData {
  crown: string;    // Crown path (the visible white part)
  root: string;     // Root path(s) (the embedded part)
  w: number;        // Width of the viewBox
  h: number;        // Height of the viewBox
  crownH: number;   // Height of crown portion (for color split)
}

// All paths drawn with root at TOP, crown at BOTTOM (upper tooth orientation)
// For lower teeth, the renderer flips vertically

export const TOOTH_SVG: Record<string, ToothSVGData> = {
  // Central Incisor — narrow, shovel-shaped crown, single tapered root
  central: {
    w: 22, h: 58, crownH: 22,
    crown: 'M3,36 C1,34 0,30 1,26 C2,22 4,20 6,19 L16,19 C18,20 20,22 21,26 C22,30 21,34 19,36 C17,38 14,39 11,39 C8,39 5,38 3,36 Z',
    root: 'M7,19 C7,19 6,14 6,10 C6,6 8,2 10,0 C10,0 11,0 12,0 C14,2 16,6 16,10 C16,14 15,19 15,19',
  },
  // Lateral Incisor — slightly smaller/rounder than central
  lateral: {
    w: 20, h: 54, crownH: 20,
    crown: 'M3,34 C1,32 0,28 1,25 C2,21 4,19 5,18 L15,18 C16,19 18,21 19,25 C20,28 19,32 17,34 C15,36 13,37 10,37 C7,37 5,36 3,34 Z',
    root: 'M6,18 C6,18 5,13 6,8 C7,4 8,1 10,0 C12,1 13,4 14,8 C15,13 14,18 14,18',
  },
  // Canine — pointed crown tip, long single root
  canine: {
    w: 22, h: 64, crownH: 24,
    crown: 'M2,40 C1,37 0,34 1,30 C2,26 4,23 7,21 L11,18 L15,21 C18,23 20,26 21,30 C22,34 21,37 20,40 C18,42 15,43 11,43 C7,43 4,42 2,40 Z',
    root: 'M7,21 C7,21 6,15 6,10 C6,5 8,2 10,0 L11,0 L12,0 C14,2 16,5 16,10 C16,15 15,21 15,21',
  },
  // First Premolar — two cusps, bifurcated root
  premolar1: {
    w: 22, h: 56, crownH: 20,
    crown: 'M1,36 C0,33 0,30 1,27 C2,24 3,22 5,20 L8,18 L11,17 L14,18 L17,20 C19,22 20,24 21,27 C22,30 22,33 21,36 C19,38 16,39 11,39 C6,39 3,38 1,36 Z',
    root: 'M5,20 C5,20 4,14 4,9 C4,5 5,2 7,0 L8,0 M14,0 L15,0 C17,2 18,5 18,9 C18,14 17,20 17,20',
  },
  // Second Premolar — two cusps, single root
  premolar2: {
    w: 22, h: 54, crownH: 20,
    crown: 'M1,34 C0,31 0,28 1,25 C2,22 3,20 5,19 L8,17 L11,16 L14,17 L17,19 C19,20 20,22 21,25 C22,28 22,31 21,34 C19,36 16,37 11,37 C6,37 3,36 1,34 Z',
    root: 'M7,19 C7,19 6,13 7,8 C8,4 9,1 11,0 C13,1 14,4 15,8 C16,13 15,19 15,19',
  },
  // First Molar — large crown with 4 cusps, 3 roots (2 buccal + 1 palatal)
  molar1: {
    w: 30, h: 56, crownH: 22,
    crown: 'M1,34 C0,30 0,27 1,24 C2,21 4,19 6,18 L10,16 L15,15 L20,16 L24,18 C26,19 28,21 29,24 C30,27 30,30 29,34 C27,37 23,38 15,38 C7,38 3,37 1,34 Z',
    root: 'M5,18 C5,18 3,12 3,7 C3,3 4,1 6,0 M13,15 C13,15 13,10 14,5 C14,2 15,0 15,0 M25,18 C25,18 27,12 27,7 C27,3 26,1 24,0',
  },
  // Second Molar — similar to first but slightly smaller
  molar2: {
    w: 28, h: 52, crownH: 20,
    crown: 'M1,32 C0,28 0,25 1,22 C2,19 4,17 6,16 L9,14 L14,13 L19,14 L22,16 C24,17 26,19 27,22 C28,25 28,28 27,32 C25,35 21,36 14,36 C7,36 3,35 1,32 Z',
    root: 'M5,16 C5,16 3,10 4,6 C5,2 6,0 7,0 M13,13 C13,13 13,8 14,4 C14,1 14,0 14,0 M23,16 C23,16 25,10 24,6 C23,2 22,0 21,0',
  },
  // Third Molar (Wisdom) — smaller, variable shape, shorter roots
  molar3: {
    w: 24, h: 46, crownH: 18,
    crown: 'M2,28 C1,25 0,22 1,20 C2,17 3,15 5,14 L8,12 L12,11 L16,12 L19,14 C21,15 22,17 23,20 C24,22 23,25 22,28 C20,30 17,31 12,31 C7,31 4,30 2,28 Z',
    root: 'M6,14 C6,14 5,9 6,5 C7,2 8,0 9,0 M12,11 C12,11 12,7 12,3 C12,1 12,0 12,0 M18,14 C18,14 19,9 18,5 C17,2 16,0 15,0',
  },
};

// Map FDI tooth unit (1-8) to tooth type
export function getToothSVGType(fdi: number): string {
  const unit = fdi % 10;
  const map: Record<number, string> = {
    1: 'central', 2: 'lateral', 3: 'canine', 4: 'premolar1',
    5: 'premolar2', 6: 'molar1', 7: 'molar2', 8: 'molar3',
  };
  return map[unit] || 'central';
}
