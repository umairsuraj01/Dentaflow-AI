// TreatmentViewer.tsx — Main treatment planning page with 3D viewer + timeline + editor.

import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft, Play, Loader2, Plus, Trash2, Save,
  Layers, Brain,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/auth';
import { useCaseDetail } from '@/modules/cases/hooks/useCaseDetail';
import { getToothName, getFdiColor } from '@/modules/viewer/utils/fdi';
import { useToothMeshes } from '../hooks/useToothMeshes';
import { useAnimation } from '../hooks/useAnimation';
import { ToothMesh } from './ToothMesh';
import { TimelinePlayer } from './TimelinePlayer';
import { ToothTransformPanel } from './ToothTransformPanel';
import { treatmentService } from '../services/treatment.service';
import type { TreatmentPlan, ToothTransform, StepTransformUpdate } from '../types/treatment.types';

// Local STL files for dev testing
const DEV_FILES = [
  { label: 'Maxillary (upper)', path: '/Users/umairsuraj/Downloads/maxillary_export.stl' },
  { label: 'Mandibular (lower)', path: '/Users/umairsuraj/Downloads/mandibulary_export.stl' },
  { label: 'Dr Hamid Upper', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-upperjaw.stl" },
  { label: 'Dr Hamid Lower', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-lowerjaw.stl" },
];

/* ─── 3D Scene ─────────────────────────────────────────────────────── */

function TreatmentScene({
  teeth,
  gumGeometry,
  selectedTooth,
  onToothSelect,
  interpolatedTransforms,
  wireframe,
  opacity,
  showGum,
}: {
  teeth: { fdi: number; geometry: THREE.BufferGeometry; centroid: [number, number, number] }[];
  gumGeometry: THREE.BufferGeometry | null;
  selectedTooth: number | null;
  onToothSelect: (fdi: number | null) => void;
  interpolatedTransforms: { fdi_number: number; position: THREE.Vector3; rotation: THREE.Euler }[];
  wireframe: boolean;
  opacity: number;
  showGum: boolean;
}) {
  const controlsRef = useRef<any>(null);

  // Fit camera on first load
  useEffect(() => {
    if (teeth.length === 0 || !controlsRef.current) return;
    const box = new THREE.Box3();
    teeth.forEach((t) => {
      const b = new THREE.Box3().setFromBufferAttribute(
        t.geometry.attributes.position as THREE.BufferAttribute,
      );
      b.translate(new THREE.Vector3(...t.centroid));
      box.union(b);
    });
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const cam = controlsRef.current.object as THREE.PerspectiveCamera;
    const dist = (maxDim / 2) / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.5;
    controlsRef.current.target.copy(center);
    const dir = new THREE.Vector3(0, 0.15, 1).normalize();
    cam.position.copy(center).addScaledVector(dir, dist);
    cam.near = 0.1;
    cam.far = dist * 20;
    cam.updateProjectionMatrix();
    controlsRef.current.update();
  }, [teeth]);

  const getTransform = (fdi: number) =>
    interpolatedTransforms.find((t) => t.fdi_number === fdi);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 6, -4]} intensity={0.6} />
      <directionalLight position={[0, -4, 3]} intensity={0.3} />
      <hemisphereLight args={['#f0f0ff', '#d0d0e0', 0.5]} />
      <Environment preset="studio" />

      {/* Gum mesh */}
      {showGum && gumGeometry && (
        <mesh
          geometry={gumGeometry}
          onClick={(e) => { e.stopPropagation(); onToothSelect(null); }}
        >
          <meshStandardMaterial
            color="#E8A0A0"
            metalness={0.05}
            roughness={0.6}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Individual teeth */}
      {teeth.map((tooth) => {
        const transform = getTransform(tooth.fdi);
        return (
          <ToothMesh
            key={tooth.fdi}
            fdi={tooth.fdi}
            geometry={tooth.geometry}
            centroid={tooth.centroid}
            position={transform?.position ?? new THREE.Vector3()}
            rotation={transform?.rotation ?? new THREE.Euler()}
            selected={selectedTooth === tooth.fdi}
            dimmed={selectedTooth !== null && selectedTooth !== tooth.fdi}
            onClick={(fdi) => onToothSelect(selectedTooth === fdi ? null : fdi)}
            wireframe={wireframe}
            opacity={opacity}
          />
        );
      })}

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
  const { user } = useAuthStore();
  const { caseData, isLoading: caseLoading } = useCaseDetail(caseId);

  const [selectedFile, setSelectedFile] = useState(DEV_FILES[0].path);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [showGum, setShowGum] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Treatment plan state
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [editingStep, setEditingStep] = useState<number>(0);
  const [localTransforms, setLocalTransforms] = useState<Record<number, ToothTransform>>({});
  const [saving, setSaving] = useState(false);

  const isTechnician = user?.role === 'TECHNICIAN' || user?.role === 'SUPER_ADMIN';

  // Tooth mesh extraction
  const { teeth, gumGeometry, isExtracting, isLoading: meshesLoading, extract, extractionId } =
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

  // Extract teeth from file
  const handleExtract = useCallback(async () => {
    setError(null);
    setPlan(null);
    setSelectedTooth(null);
    await extract(selectedFile);
  }, [selectedFile, extract]);

  // Create a new plan with initial step (step 0 = identity transforms)
  const handleCreatePlan = useCallback(async () => {
    if (!caseId || !extractionId) return;
    try {
      const newPlan = await treatmentService.createPlan({
        case_id: caseId,
        name: 'Treatment Plan A',
        extraction_id: extractionId,
      });
      // Add step 0 (initial positions — all zeros)
      const step0Transforms = teethFdi.map((fdi) => ({
        fdi_number: fdi,
        pos_x: 0, pos_y: 0, pos_z: 0,
        rot_x: 0, rot_y: 0, rot_z: 0,
      }));
      await treatmentService.addStep(newPlan.id, { step_number: 0, label: 'Initial', transforms: step0Transforms } as any);
      // Reload plan
      const loaded = await treatmentService.getPlan(newPlan.id);
      setPlan(loaded);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }, [caseId, extractionId, teethFdi]);

  // Add a new step (copies transforms from previous step)
  const handleAddStep = useCallback(async () => {
    if (!plan) return;
    const nextNum = totalSteps + 1;
    const prevStep = steps.find((s) => s.step_number === totalSteps);
    const transforms = prevStep
      ? prevStep.transforms.map((t) => ({
          fdi_number: t.fdi_number,
          pos_x: t.pos_x, pos_y: t.pos_y, pos_z: t.pos_z,
          rot_x: t.rot_x, rot_y: t.rot_y, rot_z: t.rot_z,
        }))
      : teethFdi.map((fdi) => ({
          fdi_number: fdi,
          pos_x: 0, pos_y: 0, pos_z: 0,
          rot_x: 0, rot_y: 0, rot_z: 0,
        }));
    try {
      await treatmentService.addStep(plan.id, {
        step_number: nextNum,
        label: `Stage ${nextNum}`,
        transforms,
      } as any);
      const loaded = await treatmentService.getPlan(plan.id);
      setPlan(loaded);
      setEditingStep(nextNum);
      setStep(nextNum);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }, [plan, totalSteps, steps, teethFdi, setStep]);

  // Update local transform for a tooth (live preview)
  const handleTransformChange = useCallback((updated: ToothTransform) => {
    setLocalTransforms((prev) => ({ ...prev, [updated.fdi_number]: updated }));
  }, []);

  // Save current step transforms to backend
  const handleSaveStep = useCallback(async () => {
    if (!plan || Object.keys(localTransforms).length === 0) return;
    setSaving(true);
    try {
      const step = steps.find((s) => s.step_number === editingStep);
      if (!step) return;
      const transforms: StepTransformUpdate[] = step.transforms.map((t) => {
        const local = localTransforms[t.fdi_number];
        return local ?? {
          fdi_number: t.fdi_number,
          pos_x: t.pos_x, pos_y: t.pos_y, pos_z: t.pos_z,
          rot_x: t.rot_x, rot_y: t.rot_y, rot_z: t.rot_z,
        };
      });
      await treatmentService.updateStepTransforms(plan.id, editingStep, transforms);
      const loaded = await treatmentService.getPlan(plan.id);
      setPlan(loaded);
      setLocalTransforms({});
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }, [plan, localTransforms, editingStep, steps]);

  // Get transform for selected tooth at current editing step
  const selectedToothTransform = useMemo(() => {
    if (!selectedTooth) return null;
    const local = localTransforms[selectedTooth];
    if (local) return local;
    const step = steps.find((s) => s.step_number === editingStep);
    const t = step?.transforms.find((t) => t.fdi_number === selectedTooth);
    return t ?? {
      fdi_number: selectedTooth,
      pos_x: 0, pos_y: 0, pos_z: 0,
      rot_x: 0, rot_y: 0, rot_z: 0,
    };
  }, [selectedTooth, localTransforms, steps, editingStep]);

  if (caseLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={caseId ? `/cases/${caseId}` : '/cases'}
            className="text-gray-400 hover:text-dark-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-dark-text">
            Treatment Planning{caseData ? ` — ${caseData.case_number}` : ''}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
          >
            {DEV_FILES.map((f) => (
              <option key={f.path} value={f.path}>{f.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleExtract}
            disabled={isExtracting || meshesLoading}
          >
            {isExtracting ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Extracting...</>
            ) : meshesLoading ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Loading meshes...</>
            ) : (
              <><Brain className="mr-1 h-3.5 w-3.5" />Extract Teeth</>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 3D Viewer */}
        <div className="relative flex-1 overflow-hidden rounded-xl"
          style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1e293b 100%)' }}
        >
          {teeth.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Brain className="mx-auto mb-3 h-16 w-16 text-gray-500" />
                <p className="text-sm text-gray-400">
                  Select a scan file and click <strong>Extract Teeth</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Individual teeth will be separated for treatment planning
                </p>
              </div>
            </div>
          ) : (
            <Canvas
              camera={{ position: [0, 0, 120], fov: 45 }}
              gl={{
                preserveDrawingBuffer: true,
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
              }}
              shadows
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <Suspense fallback={null}>
                <TreatmentScene
                  teeth={teeth}
                  gumGeometry={gumGeometry}
                  selectedTooth={selectedTooth}
                  onToothSelect={setSelectedTooth}
                  interpolatedTransforms={interpolatedTransforms}
                  wireframe={wireframe}
                  opacity={opacity}
                  showGum={showGum}
                />
              </Suspense>
            </Canvas>
          )}

          {/* Layers toggle */}
          {teeth.length > 0 && (
            <div className="absolute left-3 top-3 space-y-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                <input
                  type="checkbox"
                  checked={showGum}
                  onChange={() => setShowGum(!showGum)}
                  className="accent-electric"
                />
                Gum Tissue
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                <input
                  type="checkbox"
                  checked={wireframe}
                  onChange={() => setWireframe(!wireframe)}
                  className="accent-electric"
                />
                Wireframe
              </label>
            </div>
          )}

          {/* Stats */}
          {teeth.length > 0 && (
            <div className="absolute bottom-14 left-3 text-[10px] text-white/40">
              {teeth.length} teeth extracted
            </div>
          )}

          {/* Timeline at bottom */}
          {teeth.length > 0 && totalSteps > 0 && (
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

        {/* Side panel */}
        <div className="w-80 flex-shrink-0 space-y-3 overflow-y-auto">
          {/* Plan management */}
          {teeth.length > 0 && !plan && (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="mb-3 text-sm text-gray-500">
                  Teeth extracted. Create a treatment plan to define movement steps.
                </p>
                <Button size="sm" onClick={handleCreatePlan}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create Treatment Plan
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Steps list */}
          {plan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Steps ({plan.total_steps})</span>
                  {isTechnician && (
                    <button
                      onClick={handleAddStep}
                      className="flex items-center gap-1 text-xs text-electric hover:text-electric/80"
                    >
                      <Plus className="h-3 w-3" />
                      Add Step
                    </button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {steps.map((step) => (
                    <button
                      key={step.step_number}
                      onClick={() => {
                        setEditingStep(step.step_number);
                        setStep(step.step_number);
                        setLocalTransforms({});
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors',
                        editingStep === step.step_number
                          ? 'bg-electric/10 text-electric'
                          : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      <span className="font-medium">
                        {step.label ?? `Step ${step.step_number}`}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {step.transforms.length} teeth
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tooth list */}
          {teeth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Teeth ({teeth.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-1">
                  {teeth.map((t) => {
                    const [r, g, b] = getFdiColor(t.fdi);
                    const isSelected = selectedTooth === t.fdi;
                    return (
                      <button
                        key={t.fdi}
                        onClick={() => setSelectedTooth(isSelected ? null : t.fdi)}
                        className={cn(
                          'flex h-8 items-center justify-center rounded text-[10px] font-bold text-white transition-all',
                          isSelected && 'ring-2 ring-blue-400 ring-offset-1 scale-110',
                        )}
                        style={{ backgroundColor: `rgb(${r},${g},${b})` }}
                        title={getToothName(t.fdi)}
                      >
                        {t.fdi}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transform editor */}
          {isTechnician && plan && selectedTooth && selectedToothTransform && (
            <>
              <ToothTransformPanel
                fdi={selectedTooth}
                transform={selectedToothTransform}
                onChange={handleTransformChange}
                onReset={() => {
                  setLocalTransforms((prev) => {
                    const next = { ...prev };
                    delete next[selectedTooth];
                    return next;
                  });
                }}
              />
              {Object.keys(localTransforms).length > 0 && (
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleSaveStep}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="mr-1 h-3.5 w-3.5" />Save Step Changes</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
