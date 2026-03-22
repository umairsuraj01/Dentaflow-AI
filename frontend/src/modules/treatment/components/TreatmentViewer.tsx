// TreatmentViewer.tsx — Main treatment planning page with guided wizard layout.

import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { ArrowLeft, Brain } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useCaseDetail } from '@/modules/cases/hooks/useCaseDetail';
import { useToothMeshes } from '../hooks/useToothMeshes';
import { useAnimation } from '../hooks/useAnimation';
import { ToothMesh } from './ToothMesh';
import { TimelinePlayer } from './TimelinePlayer';
import { SegmentationReviewScene } from './SegmentationReviewScene';
import { WorkflowSidebar, type WorkflowStep } from './WorkflowSidebar';
import { StepContentPanel } from './StepContentPanel';
import type { EditTool } from './SegmentationToolbar';
import { treatmentService } from '../services/treatment.service';
import type { TreatmentPlan, ToothTransform, SegmentationResult } from '../types/treatment.types';
import type { StagingPlanResult } from '../types/analysis.types';

// Local STL files for dev testing
const DEV_FILES = [
  { label: 'Maxillary (upper)', path: '/Users/umairsuraj/Downloads/maxillary_export.stl' },
  { label: 'Mandibular (lower)', path: '/Users/umairsuraj/Downloads/mandibulary_export.stl' },
  { label: 'Dr Hamid Upper', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-upperjaw.stl" },
  { label: 'Dr Hamid Lower', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-lowerjaw.stl" },
];

// Camera view presets
const VIEW_PRESETS: Record<string, { dir: [number, number, number]; up: [number, number, number] }> = {
  Front:  { dir: [0, 0, 1],    up: [0, 1, 0] },
  Back:   { dir: [0, 0, -1],   up: [0, 1, 0] },
  Upper:  { dir: [0, 1, 0.15], up: [0, 0, -1] },
  Lower:  { dir: [0, -1, 0.15], up: [0, 0, 1] },
  Right:  { dir: [1, 0, 0],    up: [0, 1, 0] },
  Left:   { dir: [-1, 0, 0],   up: [0, 1, 0] },
};

/* ─── Camera Controller ───────────────────────────────────────────── */

function CameraController({
  teeth,
  controlsRef,
  viewPreset,
  onViewApplied,
}: {
  teeth: { geometry: THREE.BufferGeometry }[];
  controlsRef: React.MutableRefObject<any>;
  viewPreset: string | null;
  onViewApplied: () => void;
}) {
  const { camera } = useThree();
  const sceneBox = useRef(new THREE.Box3());
  const sceneCenter = useRef(new THREE.Vector3());
  const sceneDist = useRef(100);

  useEffect(() => {
    if (teeth.length === 0) return;
    const box = new THREE.Box3();
    teeth.forEach((t) => {
      const b = new THREE.Box3().setFromBufferAttribute(
        t.geometry.attributes.position as THREE.BufferAttribute,
      );
      box.union(b);
    });
    sceneBox.current = box;
    sceneCenter.current = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const cam = camera as THREE.PerspectiveCamera;
    sceneDist.current = (maxDim / 2) / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.6;
    applyView('Front');
  }, [teeth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewPreset) return;
    applyView(viewPreset);
    onViewApplied();
  }, [viewPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyView(name: string) {
    const preset = VIEW_PRESETS[name];
    if (!preset || !controlsRef.current) return;
    const cam = camera as THREE.PerspectiveCamera;
    const dir = new THREE.Vector3(...preset.dir).normalize();
    controlsRef.current.target.copy(sceneCenter.current);
    cam.position.copy(sceneCenter.current).addScaledVector(dir, sceneDist.current);
    cam.up.set(...preset.up);
    cam.near = 0.1;
    cam.far = sceneDist.current * 20;
    cam.updateProjectionMatrix();
    controlsRef.current.update();
  }

  return null;
}

/* ─── 3D Scene ─────────────────────────────────────────────────────── */

function TreatmentScene({
  teeth,
  gumGeometry,
  selectedTooth,
  onToothSelect,
  interpolatedTransforms,
  wireframe,
  showGum,
  viewPreset,
  onViewApplied,
  overlayGeometry,
  overlayType,
  toothHighlights,
}: {
  teeth: { fdi: number; geometry: THREE.BufferGeometry; centroid: [number, number, number] }[];
  gumGeometry: THREE.BufferGeometry | null;
  selectedTooth: number | null;
  onToothSelect: (fdi: number | null) => void;
  interpolatedTransforms: { fdi_number: number; position: THREE.Vector3; rotation: THREE.Euler }[];
  wireframe: boolean;
  showGum: boolean;
  viewPreset: string | null;
  onViewApplied: () => void;
  overlayGeometry: THREE.BufferGeometry | null;
  overlayType: 'trim' | 'base' | null;
  toothHighlights: Record<number, string>;
}) {
  const controlsRef = useRef<any>(null);
  const hasHighlights = Object.keys(toothHighlights).length > 0;

  const archCenter = useMemo<[number, number, number]>(() => {
    if (teeth.length === 0) return [0, 0, 0];
    let sx = 0, sy = 0, sz = 0;
    for (const t of teeth) {
      sx += t.centroid[0]; sy += t.centroid[1]; sz += t.centroid[2];
    }
    return [sx / teeth.length, sy / teeth.length, sz / teeth.length];
  }, [teeth]);

  const getTransform = (fdi: number) =>
    interpolatedTransforms.find((t) => t.fdi_number === fdi);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 8, 5]} intensity={1.0} castShadow />
      <directionalLight position={[-4, 6, -3]} intensity={0.7} />
      <directionalLight position={[0, -3, 5]} intensity={0.4} />
      <directionalLight position={[0, 3, -5]} intensity={0.3} />
      <hemisphereLight args={['#ffffff', '#e8e0d8', 0.6]} />
      <Environment preset="studio" />

      {showGum && gumGeometry && (
        <mesh
          geometry={gumGeometry}
          onClick={(e) => { e.stopPropagation(); onToothSelect(null); }}
          renderOrder={0}
        >
          <meshPhysicalMaterial
            color="#D4878F"
            metalness={0.02}
            roughness={0.55}
            clearcoat={0.12}
            clearcoatRoughness={0.4}
            side={THREE.DoubleSide}
            envMapIntensity={0.4}
          />
        </mesh>
      )}

      {teeth.map((tooth) => {
        const transform = getTransform(tooth.fdi);
        return (
          <ToothMesh
            key={tooth.fdi}
            fdi={tooth.fdi}
            geometry={tooth.geometry}
            centroid={tooth.centroid}
            archCenter={archCenter}
            position={transform?.position ?? new THREE.Vector3()}
            rotation={transform?.rotation ?? new THREE.Euler()}
            selected={selectedTooth === tooth.fdi}
            dimmed={!hasHighlights && selectedTooth !== null && selectedTooth !== tooth.fdi}
            onClick={(fdi) => onToothSelect(selectedTooth === fdi ? null : fdi)}
            wireframe={wireframe}
            highlightColor={toothHighlights[tooth.fdi]}
          />
        );
      })}

      {/* Overlay mesh from advanced tools (trimmed cast, base, etc.) */}
      {overlayGeometry && (
        <mesh geometry={overlayGeometry} renderOrder={0}>
          <meshPhysicalMaterial
            color={overlayType === 'base' ? '#b8a88a' : '#D4878F'}
            metalness={0.02}
            roughness={0.5}
            clearcoat={0.1}
            side={THREE.DoubleSide}
            transparent
            opacity={0.7}
            envMapIntensity={0.4}
          />
        </mesh>
      )}

      <CameraController
        teeth={teeth}
        controlsRef={controlsRef}
        viewPreset={viewPreset}
        onViewApplied={onViewApplied}
      />

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

/* ─── Main Component ────────────────────────────────────────────────── */

export function TreatmentViewer() {
  const { id: caseId } = useParams<{ id: string }>();
  const { caseData, isLoading: caseLoading } = useCaseDetail(caseId);

  const [selectedFile, setSelectedFile] = useState(DEV_FILES[0].path);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [showGum, setShowGum] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewPreset, setViewPreset] = useState<string | null>(null);

  // Workflow step
  const [activeStep, setActiveStep] = useState<WorkflowStep>('segment');
  const [completedSteps, setCompletedSteps] = useState<Set<WorkflowStep>>(new Set());

  // Segmentation state
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segResult, setSegResult] = useState<SegmentationResult | null>(null);
  const [fullArchGeometry, setFullArchGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [faceLabels, setFaceLabels] = useState<number[]>([]);
  const undoStackRef = useRef<{ indices: number[]; oldLabels: number[] }[]>([]);
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [brushRadius, setBrushRadius] = useState(1.5);
  const [isExtractingFromLabels, setIsExtractingFromLabels] = useState(false);

  // Treatment plan state
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [targets, setTargets] = useState<Record<number, ToothTransform>>({});
  const [mode, setMode] = useState<'target' | 'review'>('target');
  const [staging, setStaging] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [stagingWarnings, setStagingWarnings] = useState<string[]>([]);
  const [perToothStages, setPerToothStages] = useState<Record<number, number>>({});
  const [, setSmartStagingResult] = useState<StagingPlanResult | null>(null);

  // Advanced tools overlay state
  const [overlayGeometry, setOverlayGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [overlayType, setOverlayType] = useState<'trim' | 'base' | null>(null);
  const [toothHighlights, setToothHighlights] = useState<Record<number, string>>({});

  // Tooth mesh extraction
  const { teeth, gumGeometry, isExtracting: _isExtracting, isLoading: _meshesLoading, extract, extractionId } =
    useToothMeshes();

  const teethFdi = useMemo(() => teeth.map((t) => t.fdi), [teeth]);

  // Animation
  const steps = plan?.steps ?? [];
  const {
    currentStep, isPlaying, speed,
    play, pause, toggle, setStep, setSpeed,
    interpolatedTransforms,
  } = useAnimation(steps, teethFdi);

  const totalSteps = steps.length > 0 ? Math.max(...steps.map((s) => s.step_number)) : 0;

  // Live preview transforms
  const targetInterpolated = useMemo(() => {
    if (mode !== 'target') return [];
    return teethFdi.map((fdi) => {
      const t = targets[fdi];
      return {
        fdi_number: fdi,
        position: new THREE.Vector3(t?.pos_x ?? 0, t?.pos_y ?? 0, t?.pos_z ?? 0),
        rotation: new THREE.Euler(
          (t?.rot_x ?? 0) * Math.PI / 180,
          (t?.rot_y ?? 0) * Math.PI / 180,
          (t?.rot_z ?? 0) * Math.PI / 180,
        ),
      };
    });
  }, [mode, targets, teethFdi]);

  const activeTransforms = mode === 'target' ? targetInterpolated : interpolatedTransforms;

  // Compute unlocked steps based on progress
  const unlockedSteps = useMemo(() => {
    const unlocked = new Set<WorkflowStep>(['segment']);

    if (segResult) {
      unlocked.add('review');
    }
    if (teeth.length > 0) {
      unlocked.add('analysis');
      unlocked.add('setup');
      unlocked.add('staging');
      unlocked.add('summary');
      unlocked.add('advanced');
      unlocked.add('export');
    }
    // Advanced & Export are always accessible for exploration
    unlocked.add('advanced');
    unlocked.add('export');

    return unlocked;
  }, [segResult, teeth]);

  // Mark step completed helper
  const markCompleted = useCallback((step: WorkflowStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleSegment = useCallback(async () => {
    setError(null);
    setIsSegmenting(true);
    setPlan(null);
    setSelectedTooth(null);
    setTargets({});
    setMode('target');
    try {
      const result = await treatmentService.segmentMesh(selectedFile);
      setSegResult(result);
      setFaceLabels([...result.face_labels]);
      undoStackRef.current = [];

      const buffer = await treatmentService.fetchSTLBuffer(selectedFile);
      const loader = new STLLoader();
      const geo = loader.parse(buffer);
      geo.computeVertexNormals();
      setFullArchGeometry(geo);

      markCompleted('segment');
      setActiveStep('review');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Segmentation failed');
    } finally {
      setIsSegmenting(false);
    }
  }, [selectedFile, markCompleted]);

  const handleContinueToReview = useCallback(() => {
    setActiveStep('review');
  }, []);

  const handleApproveAndExtract = useCallback(async () => {
    if (!segResult) return;
    setIsExtractingFromLabels(true);
    setError(null);
    try {
      await treatmentService.extractTeethFromLabels(
        selectedFile,
        faceLabels,
        segResult.jaw,
      );
      await extract(selectedFile);
      markCompleted('review');
      setActiveStep('analysis');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Extraction failed');
    } finally {
      setIsExtractingFromLabels(false);
    }
  }, [segResult, selectedFile, faceLabels, extract, markCompleted]);

  // Brush handlers
  const handleFacePainted = useCallback((indices: number[], newLabel: number) => {
    setFaceLabels((prev) => {
      const oldLabels = indices.map((i) => prev[i]);
      undoStackRef.current.push({ indices, oldLabels });
      const next = [...prev];
      for (const i of indices) next[i] = newLabel;
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const last = stack.pop()!;
    setFaceLabels((prev) => {
      const next = [...prev];
      for (let i = 0; i < last.indices.length; i++) {
        next[last.indices[i]] = last.oldLabels[i];
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (segResult) {
      setFaceLabels([...segResult.face_labels]);
      undoStackRef.current = [];
    }
  }, [segResult]);

  const handleAutoSplit = useCallback((toothLabel: number, neighbors: number[][], centroids: Float32Array, positions: Float32Array) => {
    setFaceLabels((prev) => {
      const toothFaces: number[] = [];
      for (let fi = 0; fi < prev.length; fi++) {
        if (prev[fi] === toothLabel) toothFaces.push(fi);
      }
      if (toothFaces.length < 20) return prev;
      const toothSet = new Set(toothFaces);

      const faceNormals = new Float32Array(prev.length * 3);
      for (const fi of toothFaces) {
        const b = fi * 9;
        const e1x = positions[b + 3] - positions[b], e1y = positions[b + 4] - positions[b + 1], e1z = positions[b + 5] - positions[b + 2];
        const e2x = positions[b + 6] - positions[b], e2y = positions[b + 7] - positions[b + 1], e2z = positions[b + 8] - positions[b + 2];
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }
        faceNormals[fi * 3] = nx; faceNormals[fi * 3 + 1] = ny; faceNormals[fi * 3 + 2] = nz;
      }

      const curvature = new Float32Array(prev.length);
      for (const fi of toothFaces) {
        let maxAngle = 0;
        const nx1 = faceNormals[fi * 3], ny1 = faceNormals[fi * 3 + 1], nz1 = faceNormals[fi * 3 + 2];
        for (const nb of neighbors[fi]) {
          if (!toothSet.has(nb)) continue;
          const nx2 = faceNormals[nb * 3], ny2 = faceNormals[nb * 3 + 1], nz2 = faceNormals[nb * 3 + 2];
          const angle = 1 - (nx1 * nx2 + ny1 * ny2 + nz1 * nz2);
          if (angle > maxAngle) maxAngle = angle;
        }
        curvature[fi] = maxAngle;
      }

      type SplitResult = { cutFaces: number[]; lobe1: number[]; lobe2: number[]; score: number };
      const candidates: SplitResult[] = [];

      function partitionFromSeeds(seed1: number, seed2: number): SplitResult | null {
        const lobe = new Map<number, 1 | 2>();
        lobe.set(seed1, 1); lobe.set(seed2, 2);
        let q1 = [seed1], q2 = [seed2];
        while (q1.length > 0 || q2.length > 0) {
          const n1: number[] = [];
          for (const fi of q1) {
            for (const nb of neighbors[fi]) {
              if (toothSet.has(nb) && !lobe.has(nb)) { lobe.set(nb, 1); n1.push(nb); }
            }
          }
          q1 = n1;
          const n2: number[] = [];
          for (const fi of q2) {
            for (const nb of neighbors[fi]) {
              if (toothSet.has(nb) && !lobe.has(nb)) { lobe.set(nb, 2); n2.push(nb); }
            }
          }
          q2 = n2;
        }
        const cut: number[] = [];
        for (const fi of toothFaces) {
          const myL = lobe.get(fi);
          for (const nb of neighbors[fi]) {
            if (toothSet.has(nb) && lobe.get(nb) !== myL) { cut.push(fi); break; }
          }
        }
        const cutSet = new Set(cut);
        for (const fi of cut) {
          for (const nb of neighbors[fi]) { if (toothSet.has(nb)) cutSet.add(nb); }
        }
        const l1: number[] = [], l2: number[] = [];
        for (const fi of toothFaces) {
          if (cutSet.has(fi)) continue;
          if (lobe.get(fi) === 1) l1.push(fi); else l2.push(fi);
        }
        if (l1.length < 5 || l2.length < 5) return null;
        const ratio = Math.min(l1.length, l2.length) / Math.max(l1.length, l2.length);
        return { cutFaces: [...cutSet], lobe1: l1, lobe2: l2, score: ratio };
      }

      // Strategy A: Farthest-point sampling
      {
        let cx = 0, cy = 0, cz = 0;
        for (const fi of toothFaces) {
          cx += centroids[fi * 3]; cy += centroids[fi * 3 + 1]; cz += centroids[fi * 3 + 2];
        }
        cx /= toothFaces.length; cy /= toothFaces.length; cz /= toothFaces.length;
        let maxD = 0, s1 = toothFaces[0];
        for (const fi of toothFaces) {
          const dx = centroids[fi * 3] - cx, dy = centroids[fi * 3 + 1] - cy, dz = centroids[fi * 3 + 2] - cz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d > maxD) { maxD = d; s1 = fi; }
        }
        maxD = 0; let s2 = toothFaces[0];
        for (const fi of toothFaces) {
          const dx = centroids[fi * 3] - centroids[s1 * 3];
          const dy = centroids[fi * 3 + 1] - centroids[s1 * 3 + 1];
          const dz = centroids[fi * 3 + 2] - centroids[s1 * 3 + 2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d > maxD) { maxD = d; s2 = fi; }
        }
        const r = partitionFromSeeds(s1, s2);
        if (r) candidates.push(r);
      }

      // Strategy B: Curvature-based
      {
        let maxCurv = 0, maxCurvFi = toothFaces[0];
        for (const fi of toothFaces) {
          if (curvature[fi] > maxCurv) { maxCurv = curvature[fi]; maxCurvFi = fi; }
        }
        const visited = new Set<number>([maxCurvFi]);
        let frontier = [maxCurvFi];
        const lowCurvSeeds: number[] = [];
        const curvThreshold = maxCurv * 0.3;
        for (let ring = 0; ring < 30 && lowCurvSeeds.length < 2; ring++) {
          const nextFrontier: number[] = [];
          for (const fi of frontier) {
            for (const nb of neighbors[fi]) {
              if (!toothSet.has(nb) || visited.has(nb)) continue;
              visited.add(nb);
              nextFrontier.push(nb);
              if (curvature[nb] < curvThreshold && lowCurvSeeds.length < 2) {
                if (lowCurvSeeds.length === 0) {
                  lowCurvSeeds.push(nb);
                } else {
                  const dx = centroids[nb * 3] - centroids[lowCurvSeeds[0] * 3];
                  const dy = centroids[nb * 3 + 1] - centroids[lowCurvSeeds[0] * 3 + 1];
                  const dz = centroids[nb * 3 + 2] - centroids[lowCurvSeeds[0] * 3 + 2];
                  if (Math.sqrt(dx * dx + dy * dy + dz * dz) > 1.0) lowCurvSeeds.push(nb);
                }
              }
            }
          }
          frontier = nextFrontier;
        }
        if (lowCurvSeeds.length === 2) {
          const r = partitionFromSeeds(lowCurvSeeds[0], lowCurvSeeds[1]);
          if (r) candidates.push(r);
        }
      }

      // Strategy C: PCA axis splitting
      {
        let cx = 0, cy = 0, cz = 0;
        for (const fi of toothFaces) {
          cx += centroids[fi * 3]; cy += centroids[fi * 3 + 1]; cz += centroids[fi * 3 + 2];
        }
        cx /= toothFaces.length; cy /= toothFaces.length; cz /= toothFaces.length;
        const axes = [
          [1, 0, 0], [0, 1, 0], [0, 0, 1],
          [1, 1, 0], [1, 0, 1], [0, 1, 1],
          [1, -1, 0], [1, 0, -1], [0, 1, -1],
        ];
        for (const axis of axes) {
          const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
          const nax = axis[0] / len, nay = axis[1] / len, naz = axis[2] / len;
          const projections: { fi: number; proj: number }[] = [];
          for (const fi of toothFaces) {
            const dx = centroids[fi * 3] - cx, dy = centroids[fi * 3 + 1] - cy, dz = centroids[fi * 3 + 2] - cz;
            projections.push({ fi, proj: dx * nax + dy * nay + dz * naz });
          }
          projections.sort((a, b) => a.proj - b.proj);
          const s1 = projections[Math.floor(projections.length * 0.1)].fi;
          const s2 = projections[Math.floor(projections.length * 0.9)].fi;
          const r = partitionFromSeeds(s1, s2);
          if (r) candidates.push(r);
        }
      }

      if (candidates.length === 0) return prev;
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (best.score < 0.15) return prev;

      let maxLabel = 0;
      for (const lbl of prev) if (lbl > maxLabel) maxLabel = lbl;
      const newLabel = maxLabel + 1;
      const allChanged = [...best.cutFaces, ...best.lobe2];
      const allOldLabels = allChanged.map((i) => prev[i]);
      undoStackRef.current.push({ indices: allChanged, oldLabels: allOldLabels });
      const next = [...prev];
      for (const fi of best.cutFaces) next[fi] = 0;
      for (const fi of best.lobe2) next[fi] = newLabel;
      return next;
    });
  }, []);

  const handleSmoothBoundary = useCallback((affectedFaces: number[], neighbors: number[][]) => {
    setFaceLabels((prev) => {
      const next = [...prev];
      const affected = new Set(affectedFaces);
      const changedIndices: number[] = [];
      const changedOld: number[] = [];
      for (let pass = 0; pass < 2; pass++) {
        for (const fi of affected) {
          const nbs = neighbors[fi];
          if (!nbs || nbs.length === 0) continue;
          const current = next[fi];
          const isBoundary = nbs.some((nb) => next[nb] !== current);
          if (!isBoundary) continue;
          const counts = new Map<number, number>();
          counts.set(current, 1);
          for (const nb of nbs) {
            const lbl = next[nb];
            counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
          }
          let best = current, bestCount = 0;
          for (const [lbl, count] of counts) {
            if (count > bestCount) { best = lbl; bestCount = count; }
          }
          if (best !== current) {
            if (pass === 0) { changedIndices.push(fi); changedOld.push(prev[fi]); }
            next[fi] = best;
          }
        }
      }
      if (changedIndices.length > 0) {
        undoStackRef.current.push({ indices: changedIndices, oldLabels: changedOld });
      }
      return next;
    });
  }, []);

  const handleCreatePlan = useCallback(async () => {
    if (!caseId || !extractionId || teethFdi.length === 0) return;
    setCreatingPlan(true);
    setError(null);
    try {
      const newPlan = await treatmentService.createPlan({
        case_id: caseId,
        name: 'Treatment Plan A',
        extraction_id: extractionId,
      });
      const targetList = teethFdi.map((fdi) => {
        const t = targets[fdi];
        return {
          fdi_number: fdi,
          pos_x: t?.pos_x ?? 0, pos_y: t?.pos_y ?? 0, pos_z: t?.pos_z ?? 0,
          rot_x: t?.rot_x ?? 0, rot_y: t?.rot_y ?? 0, rot_z: t?.rot_z ?? 0,
        };
      });
      const stageResult = await treatmentService.autoStage({
        plan_id: newPlan.id,
        targets: targetList,
      });
      setStagingWarnings(stageResult.warnings);
      setPerToothStages(stageResult.per_tooth_stages);
      const loaded = await treatmentService.getPlan(newPlan.id);
      setPlan(loaded);
      setMode('review');
      setStep(0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setCreatingPlan(false);
    }
  }, [caseId, extractionId, teethFdi, targets, setStep]);

  const handleRestage = useCallback(async () => {
    if (!plan) return;
    setStaging(true);
    setError(null);
    try {
      const targetList = teethFdi.map((fdi) => {
        const t = targets[fdi];
        return {
          fdi_number: fdi,
          pos_x: t?.pos_x ?? 0, pos_y: t?.pos_y ?? 0, pos_z: t?.pos_z ?? 0,
          rot_x: t?.rot_x ?? 0, rot_y: t?.rot_y ?? 0, rot_z: t?.rot_z ?? 0,
        };
      });
      const stageResult = await treatmentService.autoStage({
        plan_id: plan.id,
        targets: targetList,
      });
      setStagingWarnings(stageResult.warnings);
      setPerToothStages(stageResult.per_tooth_stages);
      const loaded = await treatmentService.getPlan(plan.id);
      setPlan(loaded);
      setMode('review');
      setStep(0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setStaging(false);
    }
  }, [plan, teethFdi, targets, setStep]);

  const handleTargetChange = useCallback((updated: ToothTransform) => {
    setTargets((prev) => ({ ...prev, [updated.fdi_number]: updated }));
  }, []);

  const handleSnapTargets = useCallback((snapTargets: Record<string, { pos_x: number; pos_y: number; pos_z: number }>) => {
    setTargets((prev) => {
      const next = { ...prev };
      for (const [fdiStr, t] of Object.entries(snapTargets)) {
        const fdi = Number(fdiStr);
        const existing = next[fdi];
        next[fdi] = {
          fdi_number: fdi,
          pos_x: t.pos_x, pos_y: t.pos_y, pos_z: t.pos_z,
          rot_x: existing?.rot_x ?? 0, rot_y: existing?.rot_y ?? 0, rot_z: existing?.rot_z ?? 0,
        };
      }
      return next;
    });
    setActiveStep('setup');
  }, []);

  const handleSmartStagingComplete = useCallback((result: StagingPlanResult) => {
    setSmartStagingResult(result);
    const pts: Record<number, number> = {};
    for (const [fdi, count] of Object.entries(result.per_tooth_stages)) {
      pts[Number(fdi)] = count;
    }
    setPerToothStages(pts);
    setStagingWarnings(result.warnings);
  }, []);

  // Advanced tools: load an STL from a server file path into the 3D overlay
  const loadOverlaySTL = useCallback(async (serverPath: string, type: 'trim' | 'base') => {
    try {
      const res = await treatmentService.fetchSTLBuffer(serverPath);
      const loader = new STLLoader();
      const geo = loader.parse(res);
      geo.computeVertexNormals();
      setOverlayGeometry(geo);
      setOverlayType(type);
    } catch (err) {
      console.error('Failed to load overlay STL:', err);
    }
  }, []);

  const handleTrimmedMesh = useCallback((serverPath: string) => {
    loadOverlaySTL(serverPath, 'trim');
  }, [loadOverlaySTL]);

  const handleBaseMesh = useCallback((serverPath: string) => {
    loadOverlaySTL(serverPath, 'base');
  }, [loadOverlaySTL]);

  const handleToothHighlights = useCallback((highlights: Record<number, string>) => {
    setToothHighlights(highlights);
  }, []);

  const handleClearOverlays = useCallback(() => {
    setOverlayGeometry(null);
    setOverlayType(null);
    setToothHighlights({});
  }, []);

  // Determine which 3D view to show
  const showSegReview = activeStep === 'review' && fullArchGeometry;
  const showTeethView = teeth.length > 0 && !showSegReview;
  const showEmpty = !showSegReview && !showTeethView;

  if (caseLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left: Workflow Steps */}
      <WorkflowSidebar
        activeStep={activeStep}
        completedSteps={completedSteps}
        unlockedSteps={unlockedSteps}
        onStepClick={setActiveStep}
      />

      {/* Center: 3D Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mini header */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Link
              to={caseId ? `/cases/${caseId}` : '/cases'}
              className="text-gray-400 hover:text-dark-text transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold text-dark-text">
              {caseData ? caseData.case_number : 'Treatment Planner'}
            </h1>
          </div>
        </div>

        {/* 3D viewport */}
        <div className="flex-1 relative" style={{ background: 'linear-gradient(180deg, #e8ecf1 0%, #d1d5db 100%)' }}>
          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600 shadow-lg">
              {error}
              <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          )}

          {showEmpty && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/80 shadow-sm">
                  <Brain className="h-10 w-10 text-gray-300" />
                </div>
                <p className="text-base font-medium text-gray-500 mb-1">No 3D model loaded</p>
                <p className="text-xs text-gray-400">
                  Select a scan file in Step 1 and run AI Segmentation to get started
                </p>
              </div>
            </div>
          )}

          {showSegReview && fullArchGeometry && (
            <Canvas
              camera={{ position: [0, 0, 120], fov: 40 }}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              style={{
                width: '100%', height: '100%', display: 'block',
                cursor: activeTool === 'select' ? 'default' : activeTool === 'split' ? 'crosshair' : 'cell',
              }}
            >
              <color attach="background" args={['#dce0e6']} />
              <Suspense fallback={null}>
                <SegmentationReviewScene
                  geometry={fullArchGeometry}
                  faceLabels={faceLabels}
                  activeTool={activeTool}
                  brushRadius={brushRadius}
                  selectedTooth={selectedTooth}
                  onFacePainted={handleFacePainted}
                  onSmoothBoundary={handleSmoothBoundary}
                  onToothSelect={setSelectedTooth}
                  onAutoSplit={handleAutoSplit}
                />
              </Suspense>
            </Canvas>
          )}

          {showTeethView && (
            <Canvas
              camera={{ position: [0, 0, 120], fov: 40 }}
              gl={{
                preserveDrawingBuffer: true,
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.3,
              }}
              shadows
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <color attach="background" args={['#dce0e6']} />
              <Suspense fallback={null}>
                <TreatmentScene
                  teeth={teeth}
                  gumGeometry={gumGeometry}
                  selectedTooth={selectedTooth}
                  onToothSelect={setSelectedTooth}
                  interpolatedTransforms={activeTransforms}
                  wireframe={wireframe}
                  showGum={showGum}
                  viewPreset={viewPreset}
                  onViewApplied={() => setViewPreset(null)}
                  overlayGeometry={overlayGeometry}
                  overlayType={overlayType}
                  toothHighlights={toothHighlights}
                />
              </Suspense>
            </Canvas>
          )}

          {/* Layers overlay */}
          {showTeethView && (
            <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 p-3 shadow-lg backdrop-blur text-xs space-y-2 min-w-[130px]">
              <div className="font-semibold text-gray-700 text-[11px]">Layers</div>
              <label className="flex cursor-pointer items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={showGum}
                  onChange={() => setShowGum(!showGum)}
                  className="accent-rose-400 h-3.5 w-3.5"
                />
                Gum Tissue
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={wireframe}
                  onChange={() => setWireframe(!wireframe)}
                  className="accent-blue-500 h-3.5 w-3.5"
                />
                Wireframe
              </label>
            </div>
          )}

          {/* View angles */}
          {showTeethView && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 rounded-lg bg-white/95 shadow-lg backdrop-blur overflow-hidden">
              {Object.keys(VIEW_PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => setViewPreset(name)}
                  className="px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Tooth count */}
          {showTeethView && (
            <div className="absolute top-3 left-3 text-[10px] text-gray-500 bg-white/60 rounded px-2 py-1 backdrop-blur">
              {teeth.length} teeth
            </div>
          )}

          {/* Timeline */}
          {showTeethView && totalSteps > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <TimelinePlayer
                currentStep={currentStep}
                totalSteps={totalSteps}
                isPlaying={isPlaying}
                speed={speed}
                onPlay={play}
                onPause={pause}
                onToggle={toggle}
                onStepChange={setStep}
                onSpeedChange={setSpeed}
                stepLabels={steps.map((s) => s.label)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Step Content Panel */}
      <StepContentPanel
        activeStep={activeStep}
        // Segment
        selectedFile={selectedFile}
        devFiles={DEV_FILES}
        onFileChange={setSelectedFile}
        isSegmenting={isSegmenting}
        onSegment={handleSegment}
        segResult={segResult}
        onContinueToReview={handleContinueToReview}
        // Review
        activeTool={activeTool}
        brushRadius={brushRadius}
        selectedTooth={selectedTooth}
        isExtracting={isExtractingFromLabels}
        onToolChange={setActiveTool}
        onBrushRadiusChange={setBrushRadius}
        onUndo={handleUndo}
        onReset={handleReset}
        onApproveAndExtract={handleApproveAndExtract}
        // Analysis
        filePath={selectedFile}
        jaw={segResult?.jaw}
        extractionId={extractionId ?? undefined}
        onSnapTargets={handleSnapTargets}
        // Setup
        teeth={teeth}
        onToothSelect={(fdi) => setSelectedTooth(fdi)}
        targets={targets}
        onTargetChange={handleTargetChange}
        onTargetReset={(fdi) => {
          setTargets((prev) => {
            const next = { ...prev };
            delete next[fdi];
            return next;
          });
        }}
        plan={plan}
        mode={mode}
        setMode={setMode}
        totalSteps={totalSteps}
        currentStep={currentStep}
        steps={steps}
        setStep={setStep}
        perToothStages={perToothStages}
        stagingWarnings={stagingWarnings}
        creatingPlan={creatingPlan}
        staging={staging}
        onCreatePlan={handleCreatePlan}
        onRestage={handleRestage}
        // Staging
        onStagingComplete={handleSmartStagingComplete}
        // Advanced Tools 3D
        onTrimmedMesh={handleTrimmedMesh}
        onBaseMesh={handleBaseMesh}
        onToothHighlights={handleToothHighlights}
        onClearOverlays={handleClearOverlays}
      />
    </div>
  );
}
