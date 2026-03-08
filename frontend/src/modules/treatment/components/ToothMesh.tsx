// ToothMesh.tsx — Individual tooth R3F mesh with transform and selection.

import { useRef, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { getFdiColor } from '@/modules/viewer/utils/fdi';

interface ToothMeshProps {
  fdi: number;
  geometry: THREE.BufferGeometry;
  centroid: [number, number, number];
  position: THREE.Vector3;
  rotation: THREE.Euler;
  selected: boolean;
  dimmed: boolean;
  onClick: (fdi: number) => void;
  wireframe?: boolean;
  opacity?: number;
}

export function ToothMesh({
  fdi,
  geometry,
  centroid,
  position,
  rotation,
  selected,
  dimmed,
  onClick,
  wireframe = false,
  opacity = 1,
}: ToothMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    const [r, g, b] = getFdiColor(fdi);
    if (selected) {
      return new THREE.Color(
        Math.min(255, r + 50) / 255,
        Math.min(255, g + 50) / 255,
        Math.min(255, b + 50) / 255,
      );
    }
    if (dimmed) {
      return new THREE.Color(
        (r * 0.4 + 80) / 255,
        (g * 0.4 + 80) / 255,
        (b * 0.4 + 80) / 255,
      );
    }
    return new THREE.Color(r / 255, g / 255, b / 255);
  }, [fdi, selected, dimmed]);

  const emissiveColor = useMemo(() => {
    if (selected) return new THREE.Color(0.15, 0.15, 0.3);
    return new THREE.Color(0, 0, 0);
  }, [selected]);

  // World position = centroid + animated offset
  const worldPos: [number, number, number] = [
    centroid[0] + position.x,
    centroid[1] + position.y,
    centroid[2] + position.z,
  ];

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(fdi);
  };

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={worldPos}
      rotation={rotation}
      castShadow
      receiveShadow
      onClick={handleClick}
    >
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor}
        metalness={0.15}
        roughness={0.4}
        wireframe={wireframe}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}
