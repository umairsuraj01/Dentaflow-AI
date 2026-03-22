// FdiLabels3D.tsx — Floating FDI number labels on teeth in the 3D scene.
//
// Uses drei's Html to project 3D positions to screen-space labels.
// Each label shows the FDI number and is colored by the tooth color.

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getFdiColorHex } from '../utils/fdi';
import type { SegmentationData } from './DentalViewer3D';

interface FdiLabels3DProps {
  geometry: THREE.BufferGeometry;
  segmentation: SegmentationData;
  hiddenObjects: Set<number>;
  selectedTooth: number | null;
  yOffset?: number;  // vertical offset for jaw gap
}

export function FdiLabels3D({
  geometry,
  segmentation,
  hiddenObjects,
  selectedTooth,
  yOffset = 0,
}: FdiLabels3DProps) {
  // Compute centroid of each tooth's faces
  const labels = useMemo(() => {
    const posAttr = geometry.attributes.position;
    if (!posAttr) return [];

    // Accumulate centroid per FDI number
    const accum: Record<number, { x: number; y: number; z: number; count: number }> = {};

    const numFaces = Math.floor(posAttr.count / 3);
    for (let fi = 0; fi < numFaces; fi++) {
      const fdi = segmentation.faceLabels[fi] ?? 0;
      if (fdi === 0) continue; // skip gum
      if (!segmentation.teethFound.includes(fdi)) continue;

      if (!accum[fdi]) {
        accum[fdi] = { x: 0, y: 0, z: 0, count: 0 };
      }

      // Average the 3 vertices of this face
      for (let v = 0; v < 3; v++) {
        const idx = fi * 3 + v;
        accum[fdi].x += posAttr.getX(idx);
        accum[fdi].y += posAttr.getY(idx);
        accum[fdi].z += posAttr.getZ(idx);
      }
      accum[fdi].count += 3;
    }

    return Object.entries(accum)
      .filter(([, data]) => data.count > 0)
      .map(([fdiStr, data]) => {
        const fdi = Number(fdiStr);
        return {
          fdi,
          position: new THREE.Vector3(
            data.x / data.count,
            data.y / data.count + yOffset,
            data.z / data.count,
          ),
        };
      });
  }, [geometry, segmentation, yOffset]);

  return (
    <>
      {labels.map(({ fdi, position }) => {
        if (hiddenObjects.has(fdi)) return null;

        const isSelected = selectedTooth === fdi;
        const color = getFdiColorHex(fdi);

        return (
          <Html
            key={fdi}
            position={position}
            center
            distanceFactor={120}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className={`
                flex items-center justify-center rounded-full
                text-[10px] font-bold shadow-lg
                transition-transform
                ${isSelected ? 'scale-125 ring-2 ring-white' : ''}
              `}
              style={{
                backgroundColor: color,
                color: '#fff',
                width: isSelected ? 28 : 22,
                height: isSelected ? 28 : 22,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                opacity: selectedTooth !== null && !isSelected ? 0.4 : 0.9,
              }}
            >
              {fdi}
            </div>
          </Html>
        );
      })}
    </>
  );
}
