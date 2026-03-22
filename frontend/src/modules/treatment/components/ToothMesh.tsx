// ToothMesh.tsx — Individual tooth R3F mesh with realistic dental appearance.

import { useRef, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

// Natural tooth color palette
const TOOTH_BASE = new THREE.Color(0.93, 0.91, 0.87); // ivory white
const TOOTH_SELECTED = new THREE.Color(0.20, 0.55, 1.0); // vivid blue highlight
const TOOTH_DIMMED = new THREE.Color(0.78, 0.76, 0.73); // muted ivory

interface ToothMeshProps {
  fdi: number;
  geometry: THREE.BufferGeometry;
  centroid: [number, number, number];
  archCenter: [number, number, number];
  position: THREE.Vector3;
  rotation: THREE.Euler;
  selected: boolean;
  dimmed: boolean;
  onClick: (fdi: number) => void;
  wireframe?: boolean;
  opacity?: number;
  /** Override color for heatmap/highlight visualization (hex string like "#ef4444") */
  highlightColor?: string;
}

export function ToothMesh({
  fdi,
  geometry,
  centroid: _centroid,
  archCenter: _archCenter,
  position,
  rotation,
  selected,
  dimmed,
  onClick,
  wireframe = false,
  opacity = 1,
  highlightColor,
}: ToothMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    if (selected) return TOOTH_SELECTED.clone();
    if (highlightColor) return new THREE.Color(highlightColor);
    if (dimmed) return TOOTH_DIMMED.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    TOOTH_BASE.getHSL(hsl);
    const shift = ((fdi % 10) - 4) * 0.003;
    return new THREE.Color().setHSL(hsl.h + shift, hsl.s, hsl.l);
  }, [fdi, selected, dimmed, highlightColor]);

  const emissiveColor = useMemo(() => {
    if (selected) return new THREE.Color(0.15, 0.25, 0.5);
    return new THREE.Color(0, 0, 0);
  }, [selected]);

  const worldPos: [number, number, number] = [
    position.x,
    position.y,
    position.z,
  ];

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(fdi);
  };

  return (
    <group position={worldPos} rotation={rotation}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={handleClick}
        renderOrder={1}
      >
        <meshPhysicalMaterial
          color={color}
          emissive={emissiveColor}
          metalness={0.05}
          roughness={0.35}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
          wireframe={wireframe}
          side={THREE.DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          envMapIntensity={1.0}
        />
      </mesh>
    </group>
  );
}
