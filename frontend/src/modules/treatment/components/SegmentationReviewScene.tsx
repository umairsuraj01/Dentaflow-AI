// SegmentationReviewScene.tsx — Segmentation review with separate gum + teeth meshes.
//
// Professional-grade:
// - Separate gum/teeth meshes with Taubin smoothing (100 iterations)
// - Auto-split: selects tooth → finds geometric valley → cuts automatically

import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EditTool } from './SegmentationToolbar';

interface SegmentationReviewSceneProps {
  geometry: THREE.BufferGeometry;
  faceLabels: number[];
  activeTool: EditTool;
  brushRadius: number;
  selectedTooth: number | null;
  onFacePainted: (faceIndices: number[], newLabel: number) => void;
  onSmoothBoundary: (faceIndices: number[], neighbors: number[][]) => void;
  onToothSelect: (fdi: number | null) => void;
  onAutoSplit: (toothLabel: number, neighbors: number[][], centroids: Float32Array, positions: Float32Array) => void;
}

/**
 * Taubin smoothing — smooths ALL vertices. Alternating shrink/inflate.
 */
function taubinSmooth(geo: THREE.BufferGeometry, iterations: number): void {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const index = geo.getIndex();
  if (!index) return;

  const vertCount = posAttr.count;
  const positions = posAttr.array as Float32Array;
  const lambda = 0.5;
  const mu = -0.53;

  // Build vertex adjacency
  const neighbors: number[][] = Array.from({ length: vertCount }, () => []);
  const idxArr = index.array;

  for (let i = 0; i < idxArr.length; i += 3) {
    const a = idxArr[i], b = idxArr[i + 1], c = idxArr[i + 2];
    if (!neighbors[a].includes(b)) neighbors[a].push(b);
    if (!neighbors[a].includes(c)) neighbors[a].push(c);
    if (!neighbors[b].includes(a)) neighbors[b].push(a);
    if (!neighbors[b].includes(c)) neighbors[b].push(c);
    if (!neighbors[c].includes(a)) neighbors[c].push(a);
    if (!neighbors[c].includes(b)) neighbors[c].push(b);
  }

  const tempPos = new Float32Array(vertCount * 3);

  function applyLaplacian(factor: number) {
    tempPos.set(positions);
    for (let vi = 0; vi < vertCount; vi++) {
      const nbs = neighbors[vi];
      if (nbs.length === 0) continue;

      let avgX = 0, avgY = 0, avgZ = 0;
      for (let j = 0; j < nbs.length; j++) {
        const nb = nbs[j];
        avgX += positions[nb * 3];
        avgY += positions[nb * 3 + 1];
        avgZ += positions[nb * 3 + 2];
      }
      const inv = 1 / nbs.length;
      avgX *= inv; avgY *= inv; avgZ *= inv;

      tempPos[vi * 3]     = positions[vi * 3]     + factor * (avgX - positions[vi * 3]);
      tempPos[vi * 3 + 1] = positions[vi * 3 + 1] + factor * (avgY - positions[vi * 3 + 1]);
      tempPos[vi * 3 + 2] = positions[vi * 3 + 2] + factor * (avgZ - positions[vi * 3 + 2]);
    }
    (positions as Float32Array).set(tempPos);
  }

  for (let iter = 0; iter < iterations; iter++) {
    applyLaplacian(lambda);
    applyLaplacian(mu);
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export function SegmentationReviewScene({
  geometry,
  faceLabels,
  activeTool,
  brushRadius,
  selectedTooth,
  onFacePainted,
  onSmoothBoundary,
  onToothSelect,
  onAutoSplit,
}: SegmentationReviewSceneProps) {
  const controlsRef = useRef<any>(null);
  const isPaintingRef = useRef(false);
  const paintedThisStrokeRef = useRef<Set<number>>(new Set());
  const strokeAffectedRef = useRef<Set<number>>(new Set());
  const { camera } = useThree();

  // Split tool: hover preview
  const [splitHoverTooth, setSplitHoverTooth] = useState<number | null>(null);
  const [splitHoverPoint, setSplitHoverPoint] = useState<THREE.Vector3 | null>(null);

  const isBrush = activeTool === 'gum-brush' || activeTool === 'tooth-brush';
  const needsOrbitDisabled = isBrush;

  // Precompute face centroids
  const faceCentroids = useMemo(() => {
    const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const numFaces = Math.floor(geometry.attributes.position.count / 3);
    const centroids = new Float32Array(numFaces * 3);
    for (let i = 0; i < numFaces; i++) {
      const v0 = i * 9;
      centroids[i * 3]     = (arr[v0] + arr[v0 + 3] + arr[v0 + 6]) / 3;
      centroids[i * 3 + 1] = (arr[v0 + 1] + arr[v0 + 4] + arr[v0 + 7]) / 3;
      centroids[i * 3 + 2] = (arr[v0 + 2] + arr[v0 + 5] + arr[v0 + 8]) / 3;
    }
    return centroids;
  }, [geometry]);

  // Precompute face adjacency
  const faceNeighbors = useMemo(() => {
    const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const numFaces = Math.floor(geometry.attributes.position.count / 3);
    const edgeToFaces = new Map<string, number[]>();

    for (let fi = 0; fi < numFaces; fi++) {
      const base = fi * 9;
      const verts: [number, number, number][] = [];
      for (let v = 0; v < 3; v++) {
        verts.push([
          Math.round(arr[base + v * 3] * 1000) / 1000,
          Math.round(arr[base + v * 3 + 1] * 1000) / 1000,
          Math.round(arr[base + v * 3 + 2] * 1000) / 1000,
        ]);
      }
      for (let i = 0; i < 3; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % 3];
        const [va, vb] = a < b ? [a, b] : [b, a];
        const key = `${va[0]},${va[1]},${va[2]}|${vb[0]},${vb[1]},${vb[2]}`;
        const list = edgeToFaces.get(key);
        if (list) { list.push(fi); } else { edgeToFaces.set(key, [fi]); }
      }
    }

    const neighbors: number[][] = Array.from({ length: numFaces }, () => []);
    for (const faceList of edgeToFaces.values()) {
      if (faceList.length === 2) {
        neighbors[faceList[0]].push(faceList[1]);
        neighbors[faceList[1]].push(faceList[0]);
      }
    }
    return neighbors;
  }, [geometry]);

  // Split geometry into separate gum / teeth / selected-tooth meshes
  const { gumGeo, teethGeo, selectedGeo } = useMemo(() => {
    const srcPos = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const numFaces = Math.floor(geometry.attributes.position.count / 3);

    const gumVerts: number[] = [];
    const teethVerts: number[] = [];
    const selVerts: number[] = [];

    for (let fi = 0; fi < numFaces; fi++) {
      const fdi = faceLabels[fi] ?? 0;
      const base = fi * 9;

      const target = (selectedTooth !== null && fdi === selectedTooth)
        ? selVerts
        : fdi === 0 ? gumVerts : teethVerts;

      for (let k = 0; k < 9; k++) {
        target.push(srcPos[base + k]);
      }
    }

    function makeGeo(verts: number[], smoothIter: number): THREE.BufferGeometry | null {
      if (verts.length === 0) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      try {
        const merged = mergeVertices(g, 0.01);
        merged.computeVertexNormals();
        if (smoothIter > 0) taubinSmooth(merged, smoothIter);
        merged.computeBoundingSphere();
        return merged;
      } catch {
        g.computeVertexNormals();
        return g;
      }
    }

    return {
      gumGeo: makeGeo(gumVerts, 100),    // heavy smoothing on gum
      teethGeo: makeGeo(teethVerts, 5),   // light smoothing on teeth
      selectedGeo: makeGeo(selVerts, 5),
    };
  }, [geometry, faceLabels, selectedTooth]);

  // Split hover preview geometry — highlights the tooth that will be split
  const splitPreviewGeo = useMemo(() => {
    if (activeTool !== 'split' || splitHoverTooth === null || splitHoverTooth === 0) return null;
    const srcPos = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const numFaces = Math.floor(geometry.attributes.position.count / 3);
    const verts: number[] = [];
    for (let fi = 0; fi < numFaces; fi++) {
      if (faceLabels[fi] !== splitHoverTooth) continue;
      const base = fi * 9;
      for (let k = 0; k < 9; k++) verts.push(srcPos[base + k]);
    }
    if (verts.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [activeTool, splitHoverTooth, geometry, faceLabels]);

  // Auto-frame on first render
  useEffect(() => {
    if (!controlsRef.current) return;
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute,
    );
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const cam = camera as THREE.PerspectiveCamera;
    const dist = (maxDim / 2) / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.6;
    controlsRef.current.target.copy(center);
    cam.position.copy(center).add(new THREE.Vector3(0, 0, dist));
    cam.near = 0.1;
    cam.far = dist * 20;
    cam.updateProjectionMatrix();
    controlsRef.current.update();
  }, [geometry, camera]);

  // Toggle orbit controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !needsOrbitDisabled;
    }
  }, [needsOrbitDisabled]);

  // BFS to find nearest tooth label
  const findNearestToothLabel = useCallback((faceIndex: number): number => {
    const visited = new Set<number>([faceIndex]);
    let queue = [faceIndex];
    const labelCounts = new Map<number, number>();

    for (let ring = 0; ring < 20 && queue.length > 0; ring++) {
      const nextQueue: number[] = [];
      for (const fi of queue) {
        for (const nb of faceNeighbors[fi]) {
          if (visited.has(nb)) continue;
          visited.add(nb);
          const lbl = faceLabels[nb];
          if (lbl !== 0) {
            labelCounts.set(lbl, (labelCounts.get(lbl) ?? 0) + 1);
          }
          nextQueue.push(nb);
        }
      }
      queue = nextQueue;
      if (labelCounts.size > 0) {
        let best = 0, bestCount = 0;
        for (const [lbl, count] of labelCounts) {
          if (count > bestCount) { best = lbl; bestCount = count; }
        }
        return best;
      }
    }
    return 0;
  }, [faceLabels, faceNeighbors]);

  const paintAtPoint = useCallback((point: THREE.Vector3, faceIndex: number) => {
    if (!isBrush) return;
    const r2 = brushRadius * brushRadius;
    const numFaces = faceLabels.length;
    const toPaint: number[] = [];

    if (brushRadius <= 0.5) {
      if (!paintedThisStrokeRef.current.has(faceIndex)) {
        toPaint.push(faceIndex);
        paintedThisStrokeRef.current.add(faceIndex);
      }
    } else {
      for (let fi = 0; fi < numFaces; fi++) {
        if (paintedThisStrokeRef.current.has(fi)) continue;
        const cx = faceCentroids[fi * 3];
        const cy = faceCentroids[fi * 3 + 1];
        const cz = faceCentroids[fi * 3 + 2];
        const dx = cx - point.x, dy = cy - point.y, dz = cz - point.z;
        if (dx * dx + dy * dy + dz * dz <= r2) {
          toPaint.push(fi);
          paintedThisStrokeRef.current.add(fi);
        }
      }
    }

    if (toPaint.length > 0) {
      for (const fi of toPaint) strokeAffectedRef.current.add(fi);
      if (activeTool === 'gum-brush') {
        onFacePainted(toPaint, 0);
      } else {
        const label = findNearestToothLabel(faceIndex);
        if (label !== 0) onFacePainted(toPaint, label);
      }
    }
  }, [isBrush, activeTool, brushRadius, faceLabels.length, faceCentroids, findNearestToothLabel, onFacePainted]);

  // Raycaster
  const raycasterRef = useRef(new THREE.Raycaster());
  const fullMeshRef = useRef<THREE.Mesh>(null);

  const getFaceIndexFromEvent = useCallback((e: ThreeEvent<PointerEvent | MouseEvent>): number | null => {
    if (!fullMeshRef.current) return null;
    raycasterRef.current.set(e.ray.origin, e.ray.direction);
    const hits = raycasterRef.current.intersectObject(fullMeshRef.current);
    if (hits.length > 0 && hits[0].faceIndex != null) {
      return hits[0].faceIndex;
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (activeTool === 'select' || activeTool === 'split') return;
    e.stopPropagation();

    if (!isBrush) return;
    const faceIndex = getFaceIndexFromEvent(e);
    isPaintingRef.current = true;
    paintedThisStrokeRef.current = new Set();
    strokeAffectedRef.current = new Set();
    if (controlsRef.current) controlsRef.current.enabled = false;
    if (faceIndex != null) {
      paintAtPoint(e.point, faceIndex);
    }
  }, [activeTool, isBrush, paintAtPoint, getFaceIndexFromEvent]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Split tool: update hover preview
    if (activeTool === 'split') {
      const faceIndex = getFaceIndexFromEvent(e);
      if (faceIndex != null) {
        const fdi = faceLabels[faceIndex] ?? 0;
        setSplitHoverTooth(fdi !== 0 ? fdi : null);
        setSplitHoverPoint(fdi !== 0 ? e.point.clone() : null);
      } else {
        setSplitHoverTooth(null);
        setSplitHoverPoint(null);
      }
      return;
    }

    if (!isBrush || !isPaintingRef.current) return;
    e.stopPropagation();
    const faceIndex = getFaceIndexFromEvent(e);
    if (faceIndex != null) {
      paintAtPoint(e.point, faceIndex);
    }
  }, [activeTool, isBrush, paintAtPoint, getFaceIndexFromEvent, faceLabels]);

  const handlePointerUp = useCallback(() => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;

    if (activeTool === 'gum-brush' && strokeAffectedRef.current.size > 0) {
      const expanded = new Set(strokeAffectedRef.current);
      let frontier = [...expanded];
      for (let ring = 0; ring < 2; ring++) {
        const next: number[] = [];
        for (const fi of frontier) {
          for (const nb of faceNeighbors[fi]) {
            if (!expanded.has(nb)) { expanded.add(nb); next.push(nb); }
          }
        }
        frontier = next;
      }
      onSmoothBoundary([...expanded], faceNeighbors);
    }

    paintedThisStrokeRef.current = new Set();
    strokeAffectedRef.current = new Set();
    if (controlsRef.current && !needsOrbitDisabled) {
      controlsRef.current.enabled = true;
    }
  }, [activeTool, faceNeighbors, onSmoothBoundary, needsOrbitDisabled]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();

    const faceIndex = getFaceIndexFromEvent(e);
    if (faceIndex == null) return;

    const fdi = faceLabels[faceIndex] ?? 0;

    // Split tool: click on a tooth to auto-split it
    if (activeTool === 'split') {
      if (fdi !== 0) {
        const posArr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        onAutoSplit(fdi, faceNeighbors, faceCentroids, posArr);
      }
      return;
    }

    // Select tool
    if (activeTool === 'select') {
      if (fdi === 0) {
        onToothSelect(null);
      } else {
        onToothSelect(selectedTooth === fdi ? null : fdi);
      }
    }
  }, [activeTool, faceLabels, selectedTooth, onToothSelect, onAutoSplit, faceNeighbors, faceCentroids, getFaceIndexFromEvent]);

  const meshEvents = {
    onClick: handleClick,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 6, -3]} intensity={0.8} />
      <directionalLight position={[0, -3, 5]} intensity={0.4} />
      <hemisphereLight args={['#ffffff', '#e8e0d8', 0.5]} />
      <Environment preset="studio" />

      {/* Invisible full mesh for raycasting */}
      <mesh ref={fullMeshRef} geometry={geometry} visible={false} />

      {/* Gum mesh — Taubin-smoothed */}
      {gumGeo && (
        <mesh geometry={gumGeo} castShadow receiveShadow {...meshEvents}>
          <meshPhysicalMaterial
            color="#CC7080"
            roughness={0.35}
            metalness={0.0}
            clearcoat={0.3}
            clearcoatRoughness={0.25}
            flatShading={false}
            side={THREE.DoubleSide}
            envMapIntensity={0.7}
            sheen={0.15}
            sheenColor="#E89098"
          />
        </mesh>
      )}

      {/* Teeth mesh */}
      {teethGeo && (
        <mesh geometry={teethGeo} castShadow receiveShadow {...meshEvents}>
          <meshPhysicalMaterial
            color="#EEECEA"
            roughness={0.25}
            metalness={0.0}
            clearcoat={0.35}
            clearcoatRoughness={0.2}
            flatShading={false}
            side={THREE.DoubleSide}
            envMapIntensity={0.7}
          />
        </mesh>
      )}

      {/* Selected tooth — bright blue */}
      {selectedGeo && (
        <mesh geometry={selectedGeo} castShadow receiveShadow {...meshEvents}>
          <meshPhysicalMaterial
            color="#3388FF"
            roughness={0.35}
            metalness={0.05}
            clearcoat={0.3}
            clearcoatRoughness={0.2}
            flatShading={false}
            side={THREE.DoubleSide}
            envMapIntensity={0.5}
            emissive="#1a44aa"
            emissiveIntensity={0.15}
          />
        </mesh>
      )}

      {/* Split tool: hover preview overlay */}
      {splitPreviewGeo && (
        <mesh geometry={splitPreviewGeo} renderOrder={1}>
          <meshPhysicalMaterial
            color="#FF8800"
            roughness={0.3}
            metalness={0.0}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Split tool: hover tooltip */}
      {splitHoverTooth !== null && splitHoverPoint && (
        <Html position={splitHoverPoint} center distanceFactor={100} style={{ pointerEvents: 'none' }}>
          <div className="rounded-lg bg-black/80 px-3 py-1.5 text-white text-xs font-medium shadow-lg whitespace-nowrap backdrop-blur">
            Click to split tooth #{splitHoverTooth}
          </div>
        </Html>
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={500}
        enablePan
      />
    </>
  );
}
