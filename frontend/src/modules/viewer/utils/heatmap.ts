// heatmap.ts — Confidence-based heat map coloring for segmented meshes.
//
// Provides an alternative to the default FDI color scheme, where each face
// is colored by its per-tooth confidence score using a green-yellow-red gradient.

import * as THREE from 'three';
import type { SegmentationData } from '../components/DentalViewer3D';

export type ColorMode = 'fdi' | 'confidence' | 'label-class';

/**
 * Apply confidence heat map colors to a geometry.
 *
 * Green (>= 90% confidence) → Yellow (70%) → Red (< 50%).
 * Gum faces are colored neutral gray.
 */
export function applyConfidenceHeatMap(
  geometry: THREE.BufferGeometry,
  segmentation: SegmentationData,
): THREE.BufferGeometry {
  const posAttr = geometry.attributes.position;
  const numVertices = posAttr.count;
  const colors = new Float32Array(numVertices * 3);
  const numFaces = Math.floor(numVertices / 3);

  for (let fi = 0; fi < numFaces; fi++) {
    const fdi = segmentation.faceLabels[fi] ?? 0;

    let r: number, g: number, b: number;

    if (fdi === 0) {
      // Gum: neutral gray
      r = 0.55; g = 0.50; b = 0.52;
    } else {
      const conf = segmentation.confidenceScores[String(fdi)] ?? 0.5;
      [r, g, b] = confidenceToRGB(conf);
    }

    for (let v = 0; v < 3; v++) {
      const idx = (fi * 3 + v) * 3;
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Apply label-class colors: each unique tooth label gets a distinct hue,
 * regardless of FDI mapping. Useful for viewing raw segmentation classes.
 */
export function applyLabelClassColors(
  geometry: THREE.BufferGeometry,
  faceLabels: number[],
): THREE.BufferGeometry {
  const posAttr = geometry.attributes.position;
  const numVertices = posAttr.count;
  const colors = new Float32Array(numVertices * 3);
  const numFaces = Math.floor(numVertices / 3);

  // Assign evenly-spaced hues to each unique label
  const uniqueLabels = [...new Set(faceLabels)].sort((a, b) => a - b);
  const labelColors = new Map<number, [number, number, number]>();

  uniqueLabels.forEach((label, idx) => {
    if (label === 0) {
      labelColors.set(0, [0.55, 0.50, 0.52]); // gum gray
    } else {
      const hue = (idx / uniqueLabels.length) * 360;
      labelColors.set(label, hslToRgb(hue, 0.7, 0.55));
    }
  });

  for (let fi = 0; fi < numFaces; fi++) {
    const label = faceLabels[fi] ?? 0;
    const [r, g, b] = labelColors.get(label) ?? [0.5, 0.5, 0.5];

    for (let v = 0; v < 3; v++) {
      const idx = (fi * 3 + v) * 3;
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Map confidence value (0-1) to RGB using green-yellow-red gradient.
 */
function confidenceToRGB(confidence: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, confidence));

  if (c >= 0.9) {
    // Green: high confidence
    return [0.2, 0.8, 0.3];
  } else if (c >= 0.7) {
    // Green → Yellow blend
    const t = (c - 0.7) / 0.2;
    return [
      0.2 + (1.0 - 0.2) * (1 - t), // r: yellow→green
      0.8,                            // g: stays high
      0.3 * t,                        // b: fades
    ];
  } else if (c >= 0.5) {
    // Yellow → Orange blend
    const t = (c - 0.5) / 0.2;
    return [
      1.0,
      0.4 + 0.4 * t,
      0.1,
    ];
  } else {
    // Red: low confidence
    const t = c / 0.5;
    return [
      0.6 + 0.4 * t,
      0.1 + 0.3 * t,
      0.1,
    ];
  }
}

/**
 * HSL to RGB conversion (h in degrees, s and l in 0-1).
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }

  return [r + m, g + m, b + m];
}
