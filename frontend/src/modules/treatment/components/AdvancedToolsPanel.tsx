// AdvancedToolsPanel.tsx — Phase 5-9 advanced tools, wired to backend + 3D viewer.

import { useState } from 'react';
import {
  Loader2, Scissors, Box, Move3D, Heart, Grid3X3,
  CheckCircle2, Eye, EyeOff, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { analysisService } from '../services/analysis.service';
import type {
  CastTrimResult,
  BaseGenerationResult,
  MovementProtocolResult,
  DistanceProtocolResult,
  SpaceAnalysisSummary,
  GingivaSimResult,
} from '../types/analysis.types';

/** Movement magnitude → color for 3D highlighting */
function movementColor(mm: number): string {
  if (mm < 0.5) return '#4ade80';   // green — minimal
  if (mm < 1.5) return '#facc15';   // yellow — moderate
  if (mm < 3.0) return '#fb923c';   // orange — significant
  return '#ef4444';                  // red — large
}

function riskColor(risk: string): string {
  if (risk === 'high') return '#ef4444';
  if (risk === 'moderate') return '#fb923c';
  return '#4ade80';
}

interface Props {
  filePath: string;
  jaw?: string;
  extractionId?: string;
  /** Called when Cast Trim produces a trimmed STL path — TreatmentViewer should load & display it */
  onTrimmedMesh?: (filePath: string) => void;
  /** Called when Base Generation produces a base STL path */
  onBaseMesh?: (filePath: string) => void;
  /** Called with per-tooth highlight colors {fdi: "#hex"} for movement/gingiva visualization */
  onToothHighlights?: (highlights: Record<number, string>) => void;
  /** Called to clear any overlays */
  onClearOverlays?: () => void;
}

export function AdvancedToolsPanel({
  filePath, jaw, extractionId,
  onTrimmedMesh: _onTrimmedMesh, onBaseMesh: _onBaseMesh, onToothHighlights, onClearOverlays,
}: Props) {
  const [activeSection, setActiveSection] = useState<
    'trim' | 'base' | 'movement' | 'distances' | 'gingiva'
  >('trim');

  const [error, setError] = useState<string | null>(null);

  // Cast Trim
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimResult, setTrimResult] = useState<CastTrimResult | null>(null);
  const [trimOffset, setTrimOffset] = useState(2.0);
  const [flattenBase, setFlattenBase] = useState(true);
  const [_trimApplied, setTrimApplied] = useState(false);

  // Base Generation
  const [isGeneratingBase, setIsGeneratingBase] = useState(false);
  const [baseResult, setBaseResult] = useState<BaseGenerationResult | null>(null);
  const [baseShape, setBaseShape] = useState('horseshoe');
  const [baseHeight, setBaseHeight] = useState(15.0);
  const [baseThickness, setBaseThickness] = useState(5.0);
  const [_baseApplied, setBaseApplied] = useState(false);

  // Movement Protocol
  const [isLoadingMovement, setIsLoadingMovement] = useState(false);
  const [movementResult, setMovementResult] = useState<MovementProtocolResult | null>(null);
  const [movementHighlighted, setMovementHighlighted] = useState(false);

  // Distance Protocol
  const [isLoadingDistances, setIsLoadingDistances] = useState(false);
  const [distanceResult, setDistanceResult] = useState<DistanceProtocolResult | null>(null);
  const [spaceResult, setSpaceResult] = useState<SpaceAnalysisSummary | null>(null);

  // Gingiva Simulation
  const [isSimulatingGingiva, setIsSimulatingGingiva] = useState(false);
  const [gingivaResult, setGingivaResult] = useState<GingivaSimResult | null>(null);
  const [tissueStiffness, setTissueStiffness] = useState(0.5);
  const [gingivaHighlighted, setGingivaHighlighted] = useState(false);

  // ── Handlers ──

  const handleTrimCast = async () => {
    setIsTrimming(true);
    setError(null);
    setTrimApplied(false);
    try {
      const result = await analysisService.trimCast({
        filePath, jaw, extractionId, offsetMm: trimOffset, flattenBase,
      });
      setTrimResult(result);
      setTrimApplied(true);
    } catch (err: any) {
      setError(err.message || 'Cast trimming failed');
    } finally {
      setIsTrimming(false);
    }
  };

  const handleGenerateBase = async () => {
    setIsGeneratingBase(true);
    setError(null);
    setBaseApplied(false);
    try {
      const result = await analysisService.generateBase({
        filePath, jaw, extractionId, baseShape,
        baseHeightMm: baseHeight, baseThicknessMm: baseThickness,
      });
      setBaseResult(result);
      setBaseApplied(true);
    } catch (err: any) {
      setError(err.message || 'Base generation failed');
    } finally {
      setIsGeneratingBase(false);
    }
  };

  const handleLoadMovement = async () => {
    setIsLoadingMovement(true);
    setError(null);
    try {
      const result = await analysisService.getMovementProtocol(filePath, {}, jaw, extractionId);
      setMovementResult(result);
      // Auto-highlight teeth by movement magnitude
      if (result.records && onToothHighlights) {
        const highlights: Record<number, string> = {};
        for (const r of result.records) {
          highlights[r.fdi] = movementColor(r.total_displacement_mm);
        }
        onToothHighlights(highlights);
        setMovementHighlighted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Movement protocol failed');
    } finally {
      setIsLoadingMovement(false);
    }
  };

  const handleLoadDistances = async () => {
    setIsLoadingDistances(true);
    setError(null);
    try {
      const [distances, space] = await Promise.all([
        analysisService.getDistanceProtocol(filePath, jaw, extractionId),
        analysisService.getSpaceAnalysis(filePath, jaw, extractionId),
      ]);
      setDistanceResult(distances);
      setSpaceResult(space);
    } catch (err: any) {
      setError(err.message || 'Distance analysis failed');
    } finally {
      setIsLoadingDistances(false);
    }
  };

  const handleSimulateGingiva = async () => {
    setIsSimulatingGingiva(true);
    setError(null);
    try {
      const result = await analysisService.simulateGingiva({
        filePath, jaw, extractionId, tissueStiffness,
      });
      setGingivaResult(result);
      // Highlight teeth by papillae risk
      if (result.papillae && onToothHighlights) {
        const highlights: Record<number, string> = {};
        for (const p of result.papillae) {
          const color = riskColor(p.black_triangle_risk);
          highlights[p.fdi_mesial] = color;
          highlights[p.fdi_distal] = color;
        }
        onToothHighlights(highlights);
        setGingivaHighlighted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Gingiva simulation failed');
    } finally {
      setIsSimulatingGingiva(false);
    }
  };

  const clearHighlights = () => {
    onClearOverlays?.();
    setMovementHighlighted(false);
    setGingivaHighlighted(false);
    setTrimApplied(false);
    setBaseApplied(false);
  };

  const sections = [
    { key: 'trim' as const, icon: Scissors, label: 'Trim' },
    { key: 'base' as const, icon: Box, label: 'Base' },
    { key: 'movement' as const, icon: Move3D, label: 'Move' },
    { key: 'distances' as const, icon: Grid3X3, label: 'Space' },
    { key: 'gingiva' as const, icon: Heart, label: 'Gum' },
  ];

  const hasAnyOverlay = movementHighlighted || gingivaHighlighted;

  return (
    <div className="space-y-3">
      {/* Tab nav */}
      <div className="flex gap-0.5 rounded-xl bg-gray-100 p-1">
        {sections.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-all',
              activeSection === key
                ? 'bg-white text-electric shadow-sm'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Active overlay indicator */}
      {hasAnyOverlay && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
          <span className="text-[10px] font-medium text-blue-700 flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {movementHighlighted ? 'Movement heatmap' :
             'Gingiva risk map'} active
          </span>
          <button
            onClick={clearHighlights}
            className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
          >
            <EyeOff className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">x</button>
        </div>
      )}

      {/* ── Cast Trim ── */}
      {activeSection === 'trim' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-electric" />
              Cast Trim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Remove excess material below the gum line. Result applies to 3D view.
            </p>

            <div>
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Trim offset</span>
                <span className="font-mono font-medium text-electric">{trimOffset.toFixed(1)}mm</span>
              </label>
              <input
                type="range" min={0.5} max={5} step={0.5}
                value={trimOffset}
                onChange={(e) => setTrimOffset(Number(e.target.value))}
                className="w-full h-1.5 accent-electric"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox" checked={flattenBase}
                onChange={() => setFlattenBase(!flattenBase)}
                className="accent-electric h-3.5 w-3.5 rounded"
              />
              Flatten base for articulator
            </label>

            <Button className="w-full" onClick={handleTrimCast} disabled={isTrimming}>
              {isTrimming ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Trimming...</>
              ) : (
                <><Scissors className="mr-2 h-4 w-4" />Trim Cast</>
              )}
            </Button>

            {trimResult && (
              <div className="rounded-lg p-3 space-y-1.5 bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Trim Complete
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                  <span>Removed</span>
                  <span className="font-medium text-right">{trimResult.faces_removed.toLocaleString()} faces</span>
                  <span>Kept</span>
                  <span className="font-medium text-right">{trimResult.faces_kept.toLocaleString()} faces</span>
                  <span>Time</span>
                  <span className="font-medium text-right">{trimResult.processing_time.toFixed(1)}s</span>
                </div>
                {trimResult.trimmed_file_path && (
                  <Button
                    size="sm" variant="outline" className="w-full mt-2"
                    onClick={() => {
                      window.open(`/api/v1/ai/serve-file?path=${encodeURIComponent(trimResult.trimmed_file_path)}`, '_blank');
                    }}
                  >
                    <Download className="mr-1 h-3 w-3" /> Download Trimmed STL
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Base Generation ── */}
      {activeSection === 'base' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Box className="h-4 w-4 text-electric" />
              Model Base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Generate a printable base. Result appears in 3D view.
            </p>

            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Shape</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['horseshoe', 'rectangular', 'rounded'].map((shape) => (
                  <button
                    key={shape}
                    onClick={() => setBaseShape(shape)}
                    className={cn(
                      'rounded-lg border py-2.5 text-[10px] font-medium transition-all capitalize',
                      baseShape === shape
                        ? 'border-electric bg-electric/5 text-electric shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-electric/50',
                    )}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Height</span>
                <span className="font-mono font-medium text-electric">{baseHeight.toFixed(0)}mm</span>
              </label>
              <input
                type="range" min={5} max={25} step={1}
                value={baseHeight}
                onChange={(e) => setBaseHeight(Number(e.target.value))}
                className="w-full h-1.5 accent-electric"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Thickness</span>
                <span className="font-mono font-medium text-electric">{baseThickness.toFixed(0)}mm</span>
              </label>
              <input
                type="range" min={2} max={10} step={1}
                value={baseThickness}
                onChange={(e) => setBaseThickness(Number(e.target.value))}
                className="w-full h-1.5 accent-electric"
              />
            </div>

            <Button className="w-full" onClick={handleGenerateBase} disabled={isGeneratingBase}>
              {isGeneratingBase ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Box className="mr-2 h-4 w-4" />Generate Base</>
              )}
            </Button>

            {baseResult && (
              <div className="rounded-lg p-3 space-y-1.5 bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Base Generated
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                  <span>Shape</span>
                  <span className="font-medium text-right capitalize">{baseResult.base_shape}</span>
                  <span>Size</span>
                  <span className="font-medium text-right">{baseResult.base_width_mm.toFixed(1)} x {baseResult.base_depth_mm.toFixed(1)}mm</span>
                  <span>Time</span>
                  <span className="font-medium text-right">{baseResult.processing_time.toFixed(1)}s</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {baseResult.base_file_path && (
                    <Button
                      size="sm" variant="outline" className="flex-1"
                      onClick={() => {
                        window.open(`/api/v1/ai/serve-file?path=${encodeURIComponent(baseResult.base_file_path!)}`, '_blank');
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" /> Base STL
                    </Button>
                  )}
                  {baseResult.combined_file_path && (
                    <Button
                      size="sm" variant="outline" className="flex-1"
                      onClick={() => {
                        window.open(`/api/v1/ai/serve-file?path=${encodeURIComponent(baseResult.combined_file_path!)}`, '_blank');
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" /> Combined STL
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Movement Protocol ── */}
      {activeSection === 'movement' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Move3D className="h-4 w-4 text-electric" />
              Movement Protocol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Analyze per-tooth movement. Teeth are color-coded in 3D by magnitude.
            </p>

            <Button className="w-full" onClick={handleLoadMovement} disabled={isLoadingMovement}>
              {isLoadingMovement ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Computing...</>
              ) : (
                <><Move3D className="mr-2 h-4 w-4" />Analyze Movement</>
              )}
            </Button>

            {movementResult && (
              <div className="space-y-2">
                {/* Legend */}
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#4ade80' }} /> &lt;0.5mm</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#facc15' }} /> 0.5-1.5</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#fb923c' }} /> 1.5-3</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} /> &gt;3mm</span>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <div className="text-gray-400">Moving</div>
                    <div className="font-bold text-gray-700">{movementResult.total_teeth_moving}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <div className="text-gray-400">Max Disp.</div>
                    <div className="font-bold text-gray-700">{movementResult.max_displacement_mm.toFixed(1)}mm</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <div className="text-gray-400">Max Rot.</div>
                    <div className="font-bold text-gray-700">{movementResult.max_rotation_deg.toFixed(0)}&deg;</div>
                  </div>
                </div>

                {/* Table */}
                {movementResult.records && movementResult.records.length > 0 && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden max-h-44 overflow-y-auto">
                    <table className="w-full text-[10px]">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-500">Tooth</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-500">Disp.</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-500">Rot.</th>
                          <th className="px-2 py-1.5 text-center font-medium text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {movementResult.records.map((r: any) => (
                          <tr key={r.fdi} className="hover:bg-gray-50">
                            <td className="px-2 py-1">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full" style={{ background: movementColor(r.total_displacement_mm) }} />
                                <span className="font-medium">{r.fdi}</span>
                              </span>
                            </td>
                            <td className="px-2 py-1 text-right font-mono">{r.total_displacement_mm.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right font-mono">{r.total_rotation_deg.toFixed(1)}&deg;</td>
                            <td className="px-2 py-1 text-center">
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] capitalize">
                                {r.movement_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {movementHighlighted && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Colors applied to 3D teeth
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Space Analysis / Distance Protocol ── */}
      {activeSection === 'distances' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Grid3X3 className="h-4 w-4 text-electric" />
              Space Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Arch perimeter, crowding, and interproximal distances.
            </p>

            <Button className="w-full" onClick={handleLoadDistances} disabled={isLoadingDistances}>
              {isLoadingDistances ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
              ) : (
                <><Grid3X3 className="mr-2 h-4 w-4" />Run Analysis</>
              )}
            </Button>

            {spaceResult && (
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <div className="text-blue-400 text-[9px]">Arch Length</div>
                  <div className="font-bold text-blue-700">{spaceResult.arch_perimeter_mm.toFixed(1)}mm</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <div className="text-blue-400 text-[9px]">Tooth Material</div>
                  <div className="font-bold text-blue-700">{spaceResult.tooth_material_mm.toFixed(1)}mm</div>
                </div>
                <div className={cn('rounded-lg p-2.5', spaceResult.crowding_mm > 0 ? 'bg-red-50' : 'bg-emerald-50')}>
                  <div className={cn('text-[9px]', spaceResult.crowding_mm > 0 ? 'text-red-400' : 'text-emerald-400')}>Crowding</div>
                  <div className={cn('font-bold', spaceResult.crowding_mm > 0 ? 'text-red-700' : 'text-emerald-700')}>
                    {spaceResult.crowding_mm.toFixed(1)}mm
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <div className="text-gray-400 text-[9px]">Spacing</div>
                  <div className="font-bold text-gray-700">{spaceResult.spacing_mm.toFixed(1)}mm</div>
                </div>
              </div>
            )}

            {distanceResult && distanceResult.records && distanceResult.records.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Min: {distanceResult.min_interproximal_mm.toFixed(2)}</span>
                  <span>Mean: {distanceResult.mean_interproximal_mm.toFixed(2)}</span>
                  <span>Max: {distanceResult.max_interproximal_mm.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden max-h-36 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-500">Pair</th>
                        <th className="px-2 py-1 text-right font-medium text-gray-500">Dist</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-500">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {distanceResult.records.map((r: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-2 py-1">{r.fdi_a}—{r.fdi_b}</td>
                          <td className={cn('px-2 py-1 text-right font-mono',
                            r.distance_mm < 0 ? 'text-red-600 font-medium' : ''
                          )}>
                            {r.distance_mm.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 capitalize text-gray-400">{r.measurement_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Gingiva Simulation ── */}
      {activeSection === 'gingiva' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-rose-400" />
              Gingiva Simulation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Predict soft tissue changes. Teeth are color-coded by black triangle risk.
            </p>

            <div>
              <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Tissue stiffness</span>
                <span className="font-mono font-medium text-rose-500">{tissueStiffness.toFixed(1)}</span>
              </label>
              <input
                type="range" min={0.1} max={0.9} step={0.1}
                value={tissueStiffness}
                onChange={(e) => setTissueStiffness(Number(e.target.value))}
                className="w-full h-1.5 accent-rose-400"
              />
              <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                <span>Soft</span><span>Stiff</span>
              </div>
            </div>

            <Button className="w-full bg-rose-500 hover:bg-rose-600" onClick={handleSimulateGingiva} disabled={isSimulatingGingiva}>
              {isSimulatingGingiva ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulating...</>
              ) : (
                <><Heart className="mr-2 h-4 w-4" />Simulate</>
              )}
            </Button>

            {gingivaResult && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="rounded-lg bg-rose-50 p-2.5">
                    <div className="text-rose-400 text-[9px]">Health Score</div>
                    <div className="font-bold text-rose-700">{gingivaResult.tissue_health_score}/100</div>
                  </div>
                  <div className={cn('rounded-lg p-2.5',
                    gingivaResult.black_triangle_count > 0 ? 'bg-red-50' : 'bg-emerald-50'
                  )}>
                    <div className={cn('text-[9px]',
                      gingivaResult.black_triangle_count > 0 ? 'text-red-400' : 'text-emerald-400'
                    )}>Black Triangles</div>
                    <div className={cn('font-bold',
                      gingivaResult.black_triangle_count > 0 ? 'text-red-700' : 'text-emerald-700'
                    )}>
                      {gingivaResult.black_triangle_count}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <div className="text-gray-400 text-[9px]">Max Disp.</div>
                    <div className="font-bold text-gray-700">{gingivaResult.max_displacement_mm.toFixed(2)}mm</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <div className="text-gray-400 text-[9px]">Mean Disp.</div>
                    <div className="font-bold text-gray-700">{gingivaResult.mean_displacement_mm.toFixed(2)}mm</div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Low</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> Moderate</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> High</span>
                </div>

                {gingivaResult.papillae && gingivaResult.papillae.length > 0 && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden max-h-32 overflow-y-auto">
                    <table className="w-full text-[10px]">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-500">Between</th>
                          <th className="px-2 py-1 text-right font-medium text-gray-500">Height</th>
                          <th className="px-2 py-1 text-center font-medium text-gray-500">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {gingivaResult.papillae.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-2 py-1">{p.fdi_mesial}—{p.fdi_distal}</td>
                            <td className="px-2 py-1 text-right font-mono">{p.height_mm.toFixed(1)}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={cn(
                                'inline-block h-2 w-2 rounded-full',
                              )} style={{ background: riskColor(p.black_triangle_risk) }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {gingivaHighlighted && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Risk colors applied to 3D teeth
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
