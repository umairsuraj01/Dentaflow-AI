// StepContentPanel.tsx — Right panel that renders controls for the active workflow step.

import {
  Brain, Loader2, Play, ChevronFirst, ChevronLast, Eye,
  Activity, Crosshair, Layers, FileText, Wrench, Printer,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getToothName } from '@/modules/viewer/utils/fdi';
import { SegmentationToolbar, type EditTool } from './SegmentationToolbar';
import { ToothTransformPanel } from './ToothTransformPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { StagingOptionsPanel } from './StagingOptionsPanel';
import { ClinicalSummaryPanel } from './ClinicalSummaryPanel';
import { AdvancedToolsPanel } from './AdvancedToolsPanel';
import { ExportPanel } from './ExportPanel';
import type { WorkflowStep } from './WorkflowSidebar';
import type { TreatmentPlan, ToothTransform, SegmentationResult } from '../types/treatment.types';
import type { StagingPlanResult } from '../types/analysis.types';

// Reusable step header
function StepHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 pb-3 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric/10">
          <Icon className="h-4 w-4 text-electric" />
        </div>
        <h2 className="text-base font-bold text-dark-text">{title}</h2>
      </div>
      <p className="text-xs text-gray-500 pl-10">{subtitle}</p>
    </div>
  );
}

// ── Segment Step ──────────────────────────────────────────────────────

interface SegmentStepProps {
  selectedFile: string;
  devFiles: { label: string; path: string }[];
  onFileChange: (path: string) => void;
  isSegmenting: boolean;
  onSegment: () => void;
  segResult: SegmentationResult | null;
  onContinue: () => void;
}

function SegmentStep({
  selectedFile, devFiles, onFileChange, isSegmenting, onSegment, segResult, onContinue,
}: SegmentStepProps) {
  return (
    <>
      <StepHeader
        icon={Brain}
        title="AI Segmentation"
        subtitle="Select a dental scan and run AI to detect individual teeth"
      />

      <Card className="mb-3">
        <CardContent className="pt-4 space-y-4">
          {/* File selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Select Scan File
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedFile}
                onChange={(e) => onFileChange(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric outline-none transition-all"
              >
                {devFiles.map((f) => (
                  <option key={f.path} value={f.path}>{f.label}</option>
                ))}
              </select>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-electric hover:text-electric transition-colors cursor-pointer">
                <Upload className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Run button */}
          <Button
            className="w-full h-11"
            onClick={onSegment}
            disabled={isSegmenting}
          >
            {isSegmenting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running AI Segmentation...</>
            ) : (
              <><Brain className="mr-2 h-4 w-4" />Run AI Segmentation</>
            )}
          </Button>

          {/* How it works */}
          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
            <p className="text-[11px] font-medium text-gray-600">How it works:</p>
            <div className="space-y-1.5">
              {[
                'Loads the STL dental scan file',
                'AI model (MeshSegNet) segments each tooth',
                'You can review and edit the result',
                'Then extract individual teeth for treatment',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-electric/10 text-[9px] font-bold text-electric mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-[11px] text-gray-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result info */}
      {segResult && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">
                Segmentation Complete
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <div className="text-gray-500">Teeth Found</div>
                <div className="text-lg font-bold text-emerald-700">{segResult.teeth_found.length}</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-2.5">
                <div className="text-gray-500">Jaw</div>
                <div className="text-lg font-bold text-blue-700 capitalize">{segResult.jaw}</div>
              </div>
            </div>
            <Button className="w-full" onClick={onContinue}>
              <Eye className="mr-2 h-4 w-4" />
              Review Segmentation
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Review Step ──────────────────────────────────────────────────────

interface ReviewStepProps {
  segResult: SegmentationResult | null;
  activeTool: EditTool;
  brushRadius: number;
  selectedTooth: number | null;
  isExtracting: boolean;
  onToolChange: (tool: EditTool) => void;
  onBrushRadiusChange: (r: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onApproveAndExtract: () => void;
}

function ReviewStep(props: ReviewStepProps) {
  return (
    <>
      <StepHeader
        icon={Eye}
        title="Review & Edit"
        subtitle="Refine the AI segmentation before extracting teeth"
      />
      {props.segResult ? (
        <SegmentationToolbar
          teethCount={props.segResult.teeth_found.length}
          activeTool={props.activeTool}
          brushRadius={props.brushRadius}
          selectedTooth={props.selectedTooth}
          isExtracting={props.isExtracting}
          onToolChange={props.onToolChange}
          onBrushRadiusChange={props.onBrushRadiusChange}
          onUndo={props.onUndo}
          onReset={props.onReset}
          onApproveAndExtract={props.onApproveAndExtract}
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <Eye className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Run segmentation first</p>
        </div>
      )}
    </>
  );
}

// ── Setup (Targets) Step ─────────────────────────────────────────────

interface SetupStepProps {
  teeth: { fdi: number; geometry: any; centroid: [number, number, number] }[];
  selectedTooth: number | null;
  onToothSelect: (fdi: number | null) => void;
  targets: Record<number, ToothTransform>;
  onTargetChange: (t: ToothTransform) => void;
  onTargetReset: (fdi: number) => void;
  plan: TreatmentPlan | null;
  mode: 'target' | 'review';
  setMode: (m: 'target' | 'review') => void;
  totalSteps: number;
  currentStep: number;
  steps: { step_number: number; label?: string | null }[];
  setStep: (s: number) => void;
  perToothStages: Record<number, number>;
  stagingWarnings: string[];
  creatingPlan: boolean;
  staging: boolean;
  onCreatePlan: () => void;
  onRestage: () => void;
}

function SetupStep({
  teeth, selectedTooth, onToothSelect, targets, onTargetChange, onTargetReset,
  plan, mode, setMode, totalSteps, currentStep, steps, setStep,
  perToothStages, stagingWarnings, creatingPlan, staging, onCreatePlan, onRestage,
}: SetupStepProps) {
  const selectedTarget = selectedTooth
    ? targets[selectedTooth] ?? {
        fdi_number: selectedTooth,
        pos_x: 0, pos_y: 0, pos_z: 0,
        rot_x: 0, rot_y: 0, rot_z: 0,
      }
    : null;

  return (
    <>
      <StepHeader
        icon={Crosshair}
        title="Set Targets"
        subtitle="Click teeth in the 3D view and set their final positions"
      />

      {teeth.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <Crosshair className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Extract teeth first</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mode switcher */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setMode('target')}
              className={cn(
                'flex-1 rounded-md py-2 text-xs font-medium transition-colors',
                mode === 'target' ? 'bg-white text-dark-text shadow-sm' : 'text-gray-500',
              )}
            >
              Set Targets
            </button>
            <button
              onClick={() => { if (plan) setMode('review'); }}
              className={cn(
                'flex-1 rounded-md py-2 text-xs font-medium transition-colors',
                mode === 'review' ? 'bg-white text-dark-text shadow-sm' : 'text-gray-500',
                !plan && 'opacity-40 cursor-not-allowed',
              )}
            >
              Review ({totalSteps} stages)
            </button>
          </div>

          {mode === 'target' ? (
            <>
              {/* Info */}
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <strong>Tip:</strong> Use <strong>Dental Analysis</strong> step to run AI analysis
                and <strong>Snap to Arch</strong> for auto-targets.
              </div>

              {/* Tooth grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Teeth ({teeth.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-1.5">
                    {teeth.map((t) => {
                      const isSelected = selectedTooth === t.fdi;
                      const hasTarget = !!targets[t.fdi];
                      return (
                        <button
                          key={t.fdi}
                          onClick={() => onToothSelect(isSelected ? null : t.fdi)}
                          className={cn(
                            'flex h-9 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                            isSelected
                              ? 'bg-electric text-white ring-2 ring-electric/30 ring-offset-1 scale-105'
                              : hasTarget
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                          )}
                          title={getToothName(t.fdi)}
                        >
                          {t.fdi}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Target set
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-electric" /> Selected
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Transform editor */}
              {selectedTooth && selectedTarget && (
                <ToothTransformPanel
                  fdi={selectedTooth}
                  transform={selectedTarget}
                  onChange={onTargetChange}
                  onReset={() => onTargetReset(selectedTooth)}
                />
              )}

              {/* Compute button */}
              <Button
                className="w-full h-10"
                onClick={plan ? onRestage : onCreatePlan}
                disabled={creatingPlan || staging || Object.keys(targets).length === 0}
              >
                {creatingPlan || staging ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Computing stages...</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />
                    {plan ? 'Re-compute Stages' : 'Compute & Create Plan'}
                  </>
                )}
              </Button>

              {Object.keys(targets).length === 0 && (
                <p className="text-center text-[11px] text-gray-400">
                  Select a tooth and adjust its position to set a target
                </p>
              )}
            </>
          ) : (
            <>
              {/* Review mode */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {totalSteps} Stages ({totalSteps * 2} weeks)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setStep(0)} className="text-gray-400 hover:text-gray-600">
                      <ChevronFirst className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                      Stage {Math.round(currentStep)} / {totalSteps}
                    </span>
                    <button onClick={() => setStep(totalSteps)} className="text-gray-400 hover:text-gray-600">
                      <ChevronLast className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {steps.map((step) => (
                      <button
                        key={step.step_number}
                        onClick={() => setStep(step.step_number)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors',
                          Math.round(currentStep) === step.step_number
                            ? 'bg-electric/10 text-electric font-medium'
                            : 'text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        <span>{step.label ?? `Stage ${step.step_number}`}</span>
                        <span className="text-[10px] text-gray-400">
                          {step.step_number === 0 ? 'Initial' : `${step.step_number * 2}wk`}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setMode('target')}
                    className="mt-3 w-full text-center text-xs text-electric hover:underline"
                  >
                    Back to edit targets
                  </button>
                </CardContent>
              </Card>

              {/* Per-tooth stages */}
              {Object.keys(perToothStages).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Per-Tooth Stages</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-1.5">
                      {teeth.map((t) => {
                        const stages = perToothStages[t.fdi] ?? 0;
                        return (
                          <button
                            key={t.fdi}
                            onClick={() => onToothSelect(selectedTooth === t.fdi ? null : t.fdi)}
                            className={cn(
                              'flex h-10 flex-col items-center justify-center rounded-lg transition-all text-xs',
                              selectedTooth === t.fdi
                                ? 'bg-electric/10 ring-2 ring-electric text-electric'
                                : stages > 0
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-400',
                            )}
                            title={`${getToothName(t.fdi)}: ${stages} stages`}
                          >
                            <span className="text-[10px] font-bold">{t.fdi}</span>
                            <span className="text-[8px] opacity-70">{stages}st</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Warnings */}
          {stagingWarnings.length > 0 && (
            <Card>
              <CardContent className="pt-3">
                <div className="space-y-1">
                  {stagingWarnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-600">⚠ {w}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

// ── Main Export ──────────────────────────────────────────────────────

export interface StepContentProps {
  activeStep: WorkflowStep;

  // Segment
  selectedFile: string;
  devFiles: { label: string; path: string }[];
  onFileChange: (path: string) => void;
  isSegmenting: boolean;
  onSegment: () => void;
  segResult: SegmentationResult | null;
  onContinueToReview: () => void;

  // Review
  activeTool: EditTool;
  brushRadius: number;
  selectedTooth: number | null;
  isExtracting: boolean;
  onToolChange: (tool: EditTool) => void;
  onBrushRadiusChange: (r: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onApproveAndExtract: () => void;

  // Analysis
  filePath: string;
  jaw?: string;
  extractionId?: string;
  onSnapTargets: (t: Record<string, { pos_x: number; pos_y: number; pos_z: number }>) => void;

  // Setup
  teeth: { fdi: number; geometry: any; centroid: [number, number, number] }[];
  onToothSelect: (fdi: number | null) => void;
  targets: Record<number, ToothTransform>;
  onTargetChange: (t: ToothTransform) => void;
  onTargetReset: (fdi: number) => void;
  plan: TreatmentPlan | null;
  mode: 'target' | 'review';
  setMode: (m: 'target' | 'review') => void;
  totalSteps: number;
  currentStep: number;
  steps: { step_number: number; label?: string | null }[];
  setStep: (s: number) => void;
  perToothStages: Record<number, number>;
  stagingWarnings: string[];
  creatingPlan: boolean;
  staging: boolean;
  onCreatePlan: () => void;
  onRestage: () => void;

  // Staging
  onStagingComplete: (result: StagingPlanResult) => void;

  // Advanced Tools 3D callbacks
  onTrimmedMesh?: (filePath: string) => void;
  onBaseMesh?: (filePath: string) => void;
  onToothHighlights?: (highlights: Record<number, string>) => void;
  onClearOverlays?: () => void;
}

export function StepContentPanel(props: StepContentProps) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {props.activeStep === 'segment' && (
          <SegmentStep
            selectedFile={props.selectedFile}
            devFiles={props.devFiles}
            onFileChange={props.onFileChange}
            isSegmenting={props.isSegmenting}
            onSegment={props.onSegment}
            segResult={props.segResult}
            onContinue={props.onContinueToReview}
          />
        )}

        {props.activeStep === 'review' && (
          <ReviewStep
            segResult={props.segResult}
            activeTool={props.activeTool}
            brushRadius={props.brushRadius}
            selectedTooth={props.selectedTooth}
            isExtracting={props.isExtracting}
            onToolChange={props.onToolChange}
            onBrushRadiusChange={props.onBrushRadiusChange}
            onUndo={props.onUndo}
            onReset={props.onReset}
            onApproveAndExtract={props.onApproveAndExtract}
          />
        )}

        {props.activeStep === 'analysis' && (
          <>
            <StepHeader
              icon={Activity}
              title="Dental Analysis"
              subtitle="Run AI analysis: space, arch form, Bolton ratio, collisions"
            />
            {props.teeth.length > 0 ? (
              <AnalysisPanel
                filePath={props.filePath}
                jaw={props.jaw}
                extractionId={props.extractionId}
                onSnapTargets={props.onSnapTargets}
              />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <Activity className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Extract teeth first to run analysis</p>
              </div>
            )}
          </>
        )}

        {props.activeStep === 'setup' && (
          <SetupStep
            teeth={props.teeth}
            selectedTooth={props.selectedTooth}
            onToothSelect={props.onToothSelect}
            targets={props.targets}
            onTargetChange={props.onTargetChange}
            onTargetReset={props.onTargetReset}
            plan={props.plan}
            mode={props.mode}
            setMode={props.setMode}
            totalSteps={props.totalSteps}
            currentStep={props.currentStep}
            steps={props.steps}
            setStep={props.setStep}
            perToothStages={props.perToothStages}
            stagingWarnings={props.stagingWarnings}
            creatingPlan={props.creatingPlan}
            staging={props.staging}
            onCreatePlan={props.onCreatePlan}
            onRestage={props.onRestage}
          />
        )}

        {props.activeStep === 'staging' && (
          <>
            <StepHeader
              icon={Layers}
              title="Smart Staging"
              subtitle="Configure easing, sequencing, and movement limits"
            />
            {props.teeth.length > 0 ? (
              <StagingOptionsPanel
                filePath={props.filePath}
                jaw={props.jaw}
                extractionId={props.extractionId}
                teeth={props.teeth}
                targets={props.targets}
                onStagingComplete={props.onStagingComplete}
              />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <Layers className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Extract teeth and set targets first</p>
              </div>
            )}
          </>
        )}

        {props.activeStep === 'summary' && (
          <>
            <StepHeader
              icon={FileText}
              title="Clinical Summary"
              subtitle="Generate a comprehensive treatment report for doctor review"
            />
            {props.teeth.length > 0 ? (
              <ClinicalSummaryPanel
                filePath={props.filePath}
                jaw={props.jaw}
                extractionId={props.extractionId}
                targets={props.targets}
              />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Complete earlier steps first</p>
              </div>
            )}
          </>
        )}

        {props.activeStep === 'advanced' && (
          <>
            <StepHeader
              icon={Wrench}
              title="Advanced Tools"
              subtitle="Cast trim, base generation, movement protocol, gingiva simulation"
            />
            <AdvancedToolsPanel
              filePath={props.filePath}
              jaw={props.jaw}
              extractionId={props.extractionId}
              onTrimmedMesh={props.onTrimmedMesh}
              onBaseMesh={props.onBaseMesh}
              onToothHighlights={props.onToothHighlights}
              onClearOverlays={props.onClearOverlays}
            />
          </>
        )}

        {props.activeStep === 'export' && (
          <>
            <StepHeader
              icon={Printer}
              title="Export & Print"
              subtitle="Validate mesh quality and export for 3D printing"
            />
            <ExportPanel filePath={props.filePath} jaw={props.jaw} />
          </>
        )}
      </div>
    </div>
  );
}
