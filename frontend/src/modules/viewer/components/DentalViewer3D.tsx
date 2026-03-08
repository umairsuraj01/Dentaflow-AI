// DentalViewer3D.tsx — Professional 3D dental model viewer with segmentation coloring.

import { Suspense, useRef, useState, useEffect, useMemo, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { Canvas, useLoader, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';
import {
  RotateCcw, Box, Camera, Maximize2, Palette,
  Layers, Minus, Plus, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFdiColor, getToothName } from '../utils/fdi';

/* ─── Error Boundary for 3D scene ──────────────────────────────────── */

class ViewerErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[DentalViewer3D] Render error:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-full items-center justify-center bg-navy text-center">
          <div>
            <Box className="mx-auto mb-3 h-12 w-12 text-red-400" />
            <p className="text-sm text-red-300">Failed to load 3D viewer</p>
            <p className="mt-1 text-xs text-gray-500">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="mt-3 rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Types ─────────────────────────────────────────────────────────── */

type JawView = 'both' | 'upper-only' | 'lower-only';

export interface SegmentationData {
  faceLabels: number[];       // per-face FDI numbers (length = total faces)
  teethFound: number[];
  confidenceScores: Record<string, number>;
  restrictedFdi: number[];
  fdiColorMap?: Record<number, number[]>;
  fdiNameMap?: Record<number, string>;
}

interface DentalViewer3DProps {
  fileUrl?: string;
  upperJawUrl?: string;
  lowerJawUrl?: string;
  className?: string;
  segmentation?: SegmentationData;
  selectedTooth?: number | null;
  onToothSelect?: (fdi: number | null, faceIndex: number) => void;
  correctionMode?: boolean;
  correctionLabel?: number | null;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const COLOR_THEMES: Record<string, { upper: string; lower: string; label: string }> = {
  bone:      { upper: '#F5E6D3', lower: '#E8D5C4', label: 'Bone' },
  clinical:  { upper: '#FFFFFF', lower: '#F5F5F5', label: 'Clinical White' },
  gum:       { upper: '#E8A0A0', lower: '#D49090', label: 'Gum Pink' },
  metallic:  { upper: '#C8D0D8', lower: '#B0B8C0', label: 'Metallic' },
};

const MIN_GAP = 0;
const MAX_GAP = 40;

const VIEW_ANGLES: Record<string, [number, number, number]> = {
  Front:  [0, 0, 1],
  Back:   [0, 0, -1],
  Left:   [-1, 0, 0],
  Right:  [1, 0, 0],
  Upper:  [0, 1, 0.01],
  Lower:  [0, -1, 0.01],
};

/* ─── Apply segmentation colors to geometry ────────────────────────── */

function applySegmentationColors(
  geometry: THREE.BufferGeometry,
  faceLabels: number[],
  selectedTooth: number | null,
): THREE.BufferGeometry {
  const posAttr = geometry.attributes.position;
  const numVertices = posAttr.count;
  const colors = new Float32Array(numVertices * 3);
  // STL geometries: 3 vertices per face (non-indexed)
  const numFaces = Math.floor(numVertices / 3);

  for (let faceIdx = 0; faceIdx < numFaces; faceIdx++) {
    const fdi = faceLabels[faceIdx] ?? 0;
    let [r, g, b] = getFdiColor(fdi);

    // Dim non-selected teeth when one is selected
    if (selectedTooth !== null && selectedTooth !== undefined) {
      if (fdi === selectedTooth) {
        // Brighten selected tooth
        r = Math.min(255, r + 40);
        g = Math.min(255, g + 40);
        b = Math.min(255, b + 40);
      } else {
        // Dim others
        r = Math.floor(r * 0.3 + 60);
        g = Math.floor(g * 0.3 + 60);
        b = Math.floor(b * 0.3 + 60);
      }
    }

    const rn = r / 255, gn = g / 255, bn = b / 255;
    for (let v = 0; v < 3; v++) {
      const idx = (faceIdx * 3 + v) * 3;
      colors[idx] = rn;
      colors[idx + 1] = gn;
      colors[idx + 2] = bn;
    }
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/* ─── STL Loader wrapper — always calls useLoader (no conditional hooks) */

// Minimal valid binary STL: 80-byte header + 4-byte zero triangle count = 84 bytes of zeros
const EMPTY_STL = 'data:application/octet-stream;base64,' + 'A'.repeat(112);

function useSTL(url: string | undefined): THREE.BufferGeometry | null {
  // useLoader must always be called (React hooks rules); use a valid empty STL as fallback
  const geo = useLoader(STLLoader, url || EMPTY_STL);
  if (!url) return null;
  return geo;
}

/* ─── DentalScene — loads STLs, centers, renders (with segmentation) ── */

function DentalScene({
  upperUrl, lowerUrl, jawView, jawGap,
  upperColor, lowerColor, wireframe, autoRotate,
  opacity, showGrid, fitKey, viewDirection,
  onViewConsumed, onReady,
  segmentation, selectedTooth, onToothSelect,
  showSegmentation,
}: {
  upperUrl?: string; lowerUrl?: string;
  jawView: JawView; jawGap: number;
  upperColor: string; lowerColor: string;
  wireframe: boolean; autoRotate: boolean;
  opacity: number; showGrid: boolean;
  fitKey: number;
  viewDirection: [number, number, number] | null;
  onViewConsumed: () => void;
  onReady: (tri: number, vert: number) => void;
  segmentation?: SegmentationData;
  selectedTooth?: number | null;
  onToothSelect?: (fdi: number | null, faceIndex: number) => void;
  showSegmentation: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const upperRaw = useSTL(upperUrl);
  const lowerRaw = useSTL(lowerUrl);

  // Center both geometries together
  const { upperGeo, lowerGeo } = useMemo(() => {
    const uGeo = upperRaw?.clone() ?? null;
    const lGeo = lowerRaw?.clone() ?? null;
    if (uGeo) { uGeo.computeVertexNormals(); uGeo.computeBoundingBox(); }
    if (lGeo) { lGeo.computeVertexNormals(); lGeo.computeBoundingBox(); }

    const box = new THREE.Box3();
    let has = false;
    if (uGeo?.boundingBox) { box.copy(uGeo.boundingBox); has = true; }
    if (lGeo?.boundingBox) { has ? box.union(lGeo.boundingBox!) : box.copy(lGeo.boundingBox!); has = true; }

    if (has) {
      const c = box.getCenter(new THREE.Vector3()).negate();
      if (uGeo) uGeo.translate(c.x, c.y, c.z);
      if (lGeo) lGeo.translate(c.x, c.y, c.z);
    }

    return { upperGeo: uGeo, lowerGeo: lGeo };
  }, [upperRaw, lowerRaw]);

  // Apply segmentation colors
  const coloredUpperGeo = useMemo(() => {
    if (!upperGeo || !segmentation || !showSegmentation) return null;
    const geo = upperGeo.clone();
    return applySegmentationColors(geo, segmentation.faceLabels, selectedTooth ?? null);
  }, [upperGeo, segmentation, showSegmentation, selectedTooth]);

  // Stats
  useEffect(() => {
    let tri = 0, vert = 0;
    if (upperGeo && jawView !== 'lower-only') {
      const c = upperGeo.attributes.position.count; tri += c / 3; vert += c;
    }
    if (lowerGeo && jawView !== 'upper-only') {
      const c = lowerGeo.attributes.position.count; tri += c / 3; vert += c;
    }
    onReady(tri, vert);
  }, [upperGeo, lowerGeo, jawView]);

  const showUpper = jawView !== 'lower-only';
  const showLower = jawView !== 'upper-only';
  const upperY = jawGap / 2;
  const lowerY = -jawGap / 2;

  // Camera fit
  const fitCamera = useCallback((dir?: [number, number, number]) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const box = new THREE.Box3();
    let has = false;
    const addGeo = (geo: THREE.BufferGeometry, yOff: number) => {
      const b = new THREE.Box3().setFromBufferAttribute(
        geo.attributes.position as THREE.BufferAttribute,
      );
      b.translate(new THREE.Vector3(0, yOff, 0));
      has ? box.union(b) : (box.copy(b), has = true);
    };
    if (upperGeo && showUpper) addGeo(upperGeo, upperY);
    if (lowerGeo && showLower) addGeo(lowerGeo, lowerY);
    if (!has) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const cam = camera as THREE.PerspectiveCamera;
    const dist = (maxDim / 2) / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.5;

    controls.target.copy(center);
    const d = dir
      ? new THREE.Vector3(...dir).normalize()
      : new THREE.Vector3(0, 0.15, 1).normalize();
    cam.position.copy(center).addScaledVector(d, dist);
    cam.near = 0.1;
    cam.far = dist * 20;
    cam.updateProjectionMatrix();
    controls.update();
  }, [camera, upperGeo, lowerGeo, showUpper, showLower, upperY, lowerY]);

  useEffect(() => {
    fitCamera();
    const id = requestAnimationFrame(() => fitCamera());
    return () => cancelAnimationFrame(id);
  }, [fitCamera, fitKey]);

  useEffect(() => {
    if (!viewDirection) return;
    fitCamera(viewDirection);
    onViewConsumed();
  }, [viewDirection]);

  // Click handler for tooth selection
  const handleMeshClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!segmentation || !showSegmentation || !onToothSelect) return;
    e.stopPropagation();
    const faceIdx = e.faceIndex;
    if (faceIdx !== undefined && faceIdx !== null) {
      const fdi = segmentation.faceLabels[faceIdx] ?? 0;
      onToothSelect(fdi === 0 ? null : fdi, faceIdx);
    }
  }, [segmentation, showSegmentation, onToothSelect]);

  const mat = {
    metalness: 0.15,
    roughness: 0.4,
    wireframe,
    side: THREE.DoubleSide as THREE.Side,
    transparent: opacity < 1,
    opacity,
    envMapIntensity: 0.8,
  };

  const useColors = showSegmentation && coloredUpperGeo;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 6, -4]} intensity={0.6} />
      <directionalLight position={[0, -4, 3]} intensity={0.3} />
      <hemisphereLight args={['#f0f0ff', '#d0d0e0', 0.5]} />
      <Environment preset="studio" />

      {upperGeo && showUpper && (
        <mesh
          geometry={useColors ? coloredUpperGeo! : upperGeo}
          position={[0, upperY, 0]}
          castShadow
          receiveShadow
          onClick={handleMeshClick}
        >
          {useColors ? (
            <meshStandardMaterial vertexColors {...mat} />
          ) : (
            <meshStandardMaterial color={upperColor} {...mat} />
          )}
        </mesh>
      )}
      {lowerGeo && showLower && (
        <mesh geometry={lowerGeo} position={[0, lowerY, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={lowerColor} {...mat} />
        </mesh>
      )}

      {showGrid && (
        <gridHelper args={[200, 40, '#334155', '#1e293b']} position={[0, -45, 0]} />
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={2}
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={500}
        enablePan
      />
    </>
  );
}

/* ─── View Cube ─────────────────────────────────────────────────────── */

function ViewCube({ onSelect }: { onSelect: (dir: [number, number, number]) => void }) {
  return (
    <div className="absolute bottom-20 right-3 flex flex-col items-center gap-0.5">
      <button
        onClick={() => onSelect(VIEW_ANGLES.Upper)}
        className="rounded px-2 py-0.5 text-[10px] font-medium text-white/50 hover:bg-white/10 hover:text-white"
      >Upper</button>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onSelect(VIEW_ANGLES.Left)}
          className="rounded px-1 py-2 text-[10px] font-medium text-white/50 hover:bg-white/10 hover:text-white"
          style={{ writingMode: 'vertical-rl' }}
        >Left</button>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onSelect(VIEW_ANGLES.Front)}
            className="rounded bg-white/15 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/25"
          >Front</button>
          <button
            onClick={() => onSelect(VIEW_ANGLES.Back)}
            className="rounded bg-white/10 px-3 py-1 text-[10px] font-medium text-white/50 ring-1 ring-white/15 hover:bg-white/20"
          >Back</button>
        </div>
        <button
          onClick={() => onSelect(VIEW_ANGLES.Right)}
          className="rounded px-1 py-2 text-[10px] font-medium text-white/50 hover:bg-white/10 hover:text-white"
          style={{ writingMode: 'vertical-rl' }}
        >Right</button>
      </div>
      <button
        onClick={() => onSelect(VIEW_ANGLES.Lower)}
        className="rounded px-2 py-0.5 text-[10px] font-medium text-white/50 hover:bg-white/10 hover:text-white"
      >Lower</button>
    </div>
  );
}

/* ─── Layers Panel ──────────────────────────────────────────────────── */

function LayersPanel({
  showGrid, onGridToggle,
  wireframe, onWireframeToggle,
  opacity, onOpacityChange,
  showSegmentation, onSegmentationToggle,
  hasSegmentation,
}: {
  showGrid: boolean; onGridToggle: () => void;
  wireframe: boolean; onWireframeToggle: () => void;
  opacity: number; onOpacityChange: (v: number) => void;
  showSegmentation: boolean; onSegmentationToggle: () => void;
  hasSegmentation: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute left-3 top-3">
      <button
        onClick={() => setOpen(!open)}
        title="Layers"
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium backdrop-blur transition-colors',
          open ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/20' : 'bg-black/40 text-white/80 backdrop-blur hover:bg-black/50',
        )}
      >
        <Layers className="h-4 w-4" />
        Layers
      </button>
      {open && (
        <div className="mt-1 w-52 rounded-lg bg-black/70 p-3 shadow-xl ring-1 ring-white/10 backdrop-blur">
          {hasSegmentation && (
            <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-white/80">
              <input type="checkbox" checked={showSegmentation} onChange={onSegmentationToggle} className="accent-blue-500" />
              <Brain className="h-3.5 w-3.5 text-blue-400" />
              AI Segmentation
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-white/80">
            <input type="checkbox" checked={showGrid} onChange={onGridToggle} className="accent-electric" />
            Grid
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-white/80">
            <input type="checkbox" checked={wireframe} onChange={onWireframeToggle} className="accent-electric" />
            Wireframe
          </label>
          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Opacity</span>
              <span>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range" min={0.2} max={1} step={0.05} value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-electric"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tooth Info Panel — shows when a tooth is selected ──────────────── */

function ToothInfoPanel({
  fdi, segmentation, onClose, onReassign,
}: {
  fdi: number;
  segmentation: SegmentationData;
  onClose: () => void;
  onReassign?: (newFdi: number) => void;
}) {
  const name = segmentation.fdiNameMap?.[fdi] ?? getToothName(fdi);
  const conf = segmentation.confidenceScores[String(fdi)];
  const isRestricted = segmentation.restrictedFdi.includes(fdi);
  const [r, g, b] = getFdiColor(fdi);

  return (
    <div className="absolute bottom-4 left-4 z-10 w-64 rounded-lg bg-black/85 p-3 text-white shadow-xl backdrop-blur ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-sm"
            style={{ backgroundColor: `rgb(${r},${g},${b})` }}
          />
          <span className="text-sm font-semibold">{name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white"
        >
          x
        </button>
      </div>
      <div className="mt-2 space-y-1 text-xs text-white/70">
        {conf !== undefined && (
          <div className="flex justify-between">
            <span>Confidence</span>
            <span className={`font-medium ${conf >= 0.9 ? 'text-emerald-400' : conf >= 0.7 ? 'text-amber-400' : 'text-red-400'}`}>
              {(conf * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {isRestricted && (
          <div className="rounded bg-red-500/20 px-2 py-1 text-red-300">
            Restricted — Do not move
          </div>
        )}
        <div className="flex justify-between">
          <span>FDI Number</span>
          <span className="font-mono">{fdi}</span>
        </div>
      </div>
      {onReassign && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-[10px] text-white/40 mb-1">Reassign to:</p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {segmentation.teethFound.filter(t => t !== fdi).map(t => {
              const [cr, cg, cb] = getFdiColor(t);
              return (
                <button
                  key={t}
                  onClick={() => onReassign(t)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium hover:opacity-80"
                  style={{ backgroundColor: `rgb(${cr},${cg},${cb})` }}
                  title={getToothName(t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Toolbar Button ─────────────────────────────────────────────────── */

function ToolBtn({
  icon: Icon, label, active = false, onClick,
}: {
  icon: React.ElementType; label: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} title={label}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-electric text-white shadow-md'
          : 'bg-black/40 text-white/70 backdrop-blur hover:bg-black/60 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
        {label}
      </span>
    </button>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export function DentalViewer3D({
  fileUrl, upperJawUrl, lowerJawUrl, className,
  segmentation, selectedTooth: externalSelectedTooth,
  onToothSelect, correctionMode,
}: DentalViewer3DProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [colorTheme, setColorTheme] = useState('bone');
  const [jawView, setJawView] = useState<JawView>('both');
  const [jawGap, setJawGap] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [viewDir, setViewDir] = useState<[number, number, number] | null>(null);
  const [stats, setStats] = useState({ triangles: 0, vertices: 0 });
  const [showColors, setShowColors] = useState(false);
  const [showSegmentation, setShowSegmentation] = useState(!!segmentation);
  const [internalSelectedTooth, setInternalSelectedTooth] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedTooth = externalSelectedTooth ?? internalSelectedTooth;

  // Auto-enable segmentation view when data arrives
  useEffect(() => {
    if (segmentation) setShowSegmentation(true);
  }, [segmentation]);

  const hasUpper = !!(upperJawUrl || fileUrl);
  const hasLower = !!lowerJawUrl;
  const isMultiJaw = hasUpper && hasLower;
  const upperUrl = upperJawUrl || fileUrl;
  const lowerUrl = lowerJawUrl;
  const theme = COLOR_THEMES[colorTheme] || COLOR_THEMES.bone;

  const handleScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'dental-scan.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleToothSelect = useCallback((fdi: number | null, faceIndex: number) => {
    setInternalSelectedTooth(fdi);
    onToothSelect?.(fdi, faceIndex);
  }, [onToothSelect]);

  if (!upperUrl && !lowerUrl) {
    return (
      <div className={cn('flex items-center justify-center rounded-xl bg-gradient-to-b from-navy to-slate-800', className)} style={{ height: 600 }}>
        <div className="text-center">
          <Box className="mx-auto mb-3 h-16 w-16 text-gray-500" />
          <p className="text-sm text-gray-400">No 3D scan file loaded</p>
          <p className="text-xs text-gray-500">Upload an STL file to view</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl', className)}
      style={{ height: 600, background: 'linear-gradient(180deg, #0F172A 0%, #1e293b 100%)' }}
    >
      <ViewerErrorBoundary>
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 0, 120], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        shadows
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <Suspense fallback={null}>
          <DentalScene
            upperUrl={upperUrl}
            lowerUrl={lowerUrl}
            jawView={jawView}
            jawGap={jawGap}
            upperColor={theme.upper}
            lowerColor={theme.lower}
            wireframe={wireframe}
            autoRotate={autoRotate}
            opacity={opacity}
            showGrid={showGrid}
            fitKey={fitKey}
            viewDirection={viewDir}
            onViewConsumed={() => setViewDir(null)}
            onReady={(tri, vert) => setStats({ triangles: tri, vertices: vert })}
            segmentation={segmentation}
            selectedTooth={selectedTooth}
            onToothSelect={handleToothSelect}
            showSegmentation={showSegmentation}
          />
        </Suspense>
      </Canvas>
      </ViewerErrorBoundary>

      {/* Layers Panel */}
      <LayersPanel
        showGrid={showGrid}
        onGridToggle={() => setShowGrid(!showGrid)}
        wireframe={wireframe}
        onWireframeToggle={() => setWireframe(!wireframe)}
        opacity={opacity}
        onOpacityChange={setOpacity}
        showSegmentation={showSegmentation}
        onSegmentationToggle={() => setShowSegmentation(!showSegmentation)}
        hasSegmentation={!!segmentation}
      />

      {/* Right Toolbar */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <ToolBtn icon={RotateCcw} label="Auto Rotate" active={autoRotate} onClick={() => setAutoRotate(!autoRotate)} />
        <ToolBtn icon={Camera} label="Screenshot" onClick={handleScreenshot} />
        <ToolBtn icon={Maximize2} label="Fit to View" onClick={() => setFitKey((k) => k + 1)} />
        <div className="relative">
          <ToolBtn icon={Palette} label="Color Theme" active={showColors} onClick={() => setShowColors(!showColors)} />
          {showColors && (
            <div className="absolute right-full mr-2 top-0 w-36 rounded-lg bg-black/70 p-2 shadow-xl ring-1 ring-white/10 backdrop-blur">
              {Object.entries(COLOR_THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => { setColorTheme(key); setShowColors(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                    colorTheme === key ? 'bg-electric/20 font-semibold text-electric' : 'text-white/70 hover:bg-white/10',
                  )}
                >
                  <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: t.upper }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Cube */}
      <ViewCube onSelect={setViewDir} />

      {/* Jaw switcher (multi-jaw) */}
      {isMultiJaw && (
        <div className="absolute right-32 top-4 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-1 py-1 backdrop-blur ring-1 ring-white/10">
            {(['both', 'upper-only', 'lower-only'] as JawView[]).map((v) => {
              const labels: Record<JawView, string> = { 'both': 'Both', 'upper-only': 'Upper', 'lower-only': 'Lower' };
              return (
                <button
                  key={v}
                  onClick={() => setJawView(v)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    jawView === v ? 'bg-electric text-white shadow-sm' : 'text-white/60 hover:text-white',
                  )}
                >{labels[v]}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Jaw gap slider */}
      {isMultiJaw && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/50 px-4 py-2 backdrop-blur ring-1 ring-white/10">
          <button title="Close jaws" onClick={() => setJawGap(MIN_GAP)} className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
            <Minus className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">Jaw Gap</span>
            <input type="range" min={MIN_GAP} max={MAX_GAP} step={1} value={jawGap}
              onChange={(e) => setJawGap(Number(e.target.value))}
              className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-electric"
              title={`${jawGap}mm`}
            />
            <span className="w-8 text-right text-[10px] font-mono text-white/50">{jawGap}mm</span>
          </div>
          <button title="Open jaws wide" onClick={() => setJawGap(MAX_GAP)} className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Tooth info panel (when a tooth is selected) */}
      {selectedTooth && segmentation && showSegmentation && (
        <ToothInfoPanel
          fdi={selectedTooth}
          segmentation={segmentation}
          onClose={() => setInternalSelectedTooth(null)}
          onReassign={correctionMode ? (newFdi) => {
            // In correction mode, allow label reassignment
            onToothSelect?.(newFdi, -1);
          } : undefined}
        />
      )}

      {/* Stats */}
      {stats.triangles > 0 && (
        <div className="absolute bottom-4 left-3 text-[10px] text-white/40">
          {segmentation && showSegmentation && (
            <span className="mr-2 text-blue-400">{segmentation.teethFound.length} teeth</span>
          )}
          {stats.triangles.toLocaleString()} tri / {stats.vertices.toLocaleString()} vert
        </div>
      )}

    </div>
  );
}
