// AnalysisPanel.tsx — Displays dental analysis results (space, arch form, etc.)

import { useState } from 'react';
import { Loader2, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analysisService } from '../services/analysis.service';
import type {
  AnalysisResult,
  CollisionReport,
  IPRPlan,
  SnapToArchResult,
} from '../types/analysis.types';

/** Safe toFixed that handles null/undefined */
function fmt(val: number | null | undefined, digits = 1): string {
  if (val == null || isNaN(val)) return '—';
  return val.toFixed(digits);
}

interface AnalysisPanelProps {
  filePath: string;
  jaw?: string;
  extractionId?: string;
  onSnapTargets?: (targets: Record<string, { pos_x: number; pos_y: number; pos_z: number }>) => void;
}

export function AnalysisPanel({ filePath, jaw, extractionId, onSnapTargets }: AnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [collisions, setCollisions] = useState<CollisionReport | null>(null);
  const [ipr, setIPR] = useState<IPRPlan | null>(null);
  const [snapResult, setSnapResult] = useState<SnapToArchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archType, setArchType] = useState('parabolic');

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // Run analysis first, collisions separately (they both trigger segmentation)
      const analysisRes = await analysisService.analyze(filePath, jaw, extractionId);
      setAnalysis(analysisRes);

      // Collisions (may fail independently)
      try {
        const collisionRes = await analysisService.checkCollisions(filePath, jaw, undefined, extractionId);
        setCollisions(collisionRes);
      } catch {
        // Non-critical — continue without collision data
      }

      // Auto-compute IPR if crowding detected
      if (analysisRes?.space_analysis && analysisRes.space_analysis.discrepancy_mm < -0.5) {
        try {
          const iprRes = await analysisService.computeIPR(filePath, jaw, undefined, extractionId);
          setIPR(iprRes);
        } catch {
          // Non-critical
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const runSnapToArch = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analysisService.snapToArch(filePath, jaw, archType, undefined, undefined, extractionId);
      setSnapResult(result);
    } catch (err: any) {
      setError(err?.message || 'Snap-to-arch failed');
    } finally {
      setLoading(false);
    }
  };

  const applySnapTargets = () => {
    if (!snapResult?.targets || !onSnapTargets) return;
    onSnapTargets(snapResult.targets);
  };

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Dental Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            Run AI-powered analysis: space, arch form, collisions, IPR.
          </p>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <Button size="sm" className="w-full" onClick={runAnalysis} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Analyzing...</>
            ) : (
              <><Activity className="mr-1 h-3.5 w-3.5" />Run Analysis</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const space = analysis.space_analysis;

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600 rounded bg-red-50 px-3 py-2">{error}</p>}

      {/* Re-run button */}
      <Button size="sm" variant="outline" className="w-full" onClick={runAnalysis} disabled={loading}>
        {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1 h-3.5 w-3.5" />}
        {loading ? 'Analyzing...' : 'Re-run Analysis'}
      </Button>

      {/* Space Analysis */}
      {space && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Space Analysis
              {(() => {
                const sev = String(space.crowding_severity ?? space.severity ?? 'unknown');
                return (
                  <Badge variant={
                    sev === 'none' || sev === 'normal' ? 'green' :
                    sev === 'mild' ? 'default' :
                    sev === 'moderate' ? 'orange' : 'red'
                  }>
                    {sev}
                  </Badge>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Tooth width</span>
              <span className="font-medium">{fmt(space.total_tooth_width_mm)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Arch length</span>
              <span className="font-medium">{fmt(space.available_arch_length_mm ?? space.arch_length_mm)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Discrepancy</span>
              <span className={`font-medium ${(space.discrepancy_mm ?? 0) < -1 ? 'text-amber-600' : (space.discrepancy_mm ?? 0) > 1 ? 'text-blue-600' : 'text-green-600'}`}>
                {(space.discrepancy_mm ?? 0) > 0 ? '+' : ''}{fmt(space.discrepancy_mm)}mm
              </span>
            </div>
            {(space.discrepancy_mm ?? 0) < -1 && (
              <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
                Crowding: {fmt(Math.abs(space.discrepancy_mm ?? 0))}mm — IPR or expansion needed
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Arch Form */}
      {analysis.arch_form && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Arch Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium capitalize">{analysis.arch_form.arch_form_type ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Width</span>
              <span className="font-medium">{fmt(analysis.arch_form.arch_width_mm)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Depth</span>
              <span className="font-medium">{fmt(analysis.arch_form.arch_depth_mm)}mm</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collisions */}
      {collisions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5">
              {(collisions.collision_count ?? 0) > 0 ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              )}
              Collisions
              {(collisions.collision_count ?? 0) > 0 && (
                <Badge variant="orange">{collisions.collision_count}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            {(collisions.collision_count ?? 0) === 0 ? (
              <p className="text-green-600">No collisions detected</p>
            ) : (
              <div className="space-y-1">
                <p className="text-amber-600">
                  {collisions.collision_count} overlaps (max {fmt(collisions.max_overlap_mm)}mm)
                </p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {(collisions.collisions ?? []).slice(0, 10).map((c, i) => (
                    <div key={i} className="flex justify-between text-gray-500">
                      <span>#{c.fdi_a} — #{c.fdi_b}</span>
                      <span>{fmt(c.overlap_mm)}mm</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* IPR Plan */}
      {ipr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              IPR Plan
              <Badge variant={ipr.ipr_sufficient ? 'green' : 'red'}>
                {fmt(ipr.total_ipr_mm)}mm
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Crowding</span>
              <span className="font-medium">{fmt(ipr.crowding_mm)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total IPR</span>
              <span className="font-medium">{fmt(ipr.total_ipr_mm)}mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sufficient?</span>
              <span className={ipr.ipr_sufficient ? 'text-green-600' : 'text-red-600'}>
                {ipr.ipr_sufficient ? 'Yes' : 'No'}
              </span>
            </div>
            {(ipr.contacts ?? []).filter(c => (c.suggested_ipr_mm ?? 0) > 0).length > 0 && (
              <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                {(ipr.contacts ?? [])
                  .filter(c => (c.suggested_ipr_mm ?? 0) > 0)
                  .map((c, i) => (
                    <div key={i} className="flex justify-between text-gray-500">
                      <span>#{c.fdi_a}—#{c.fdi_b}</span>
                      <span className="font-medium">{fmt(c.suggested_ipr_mm, 2)}mm</span>
                    </div>
                  ))}
              </div>
            )}
            {(ipr.warnings ?? []).map((w, i) => (
              <p key={i} className="text-amber-600">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Snap to Arch Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Snap to Arch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-1">
            {['parabolic', 'brader', 'catenary'].map((type) => (
              <button
                key={type}
                onClick={() => setArchType(type)}
                className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                  archType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="flex-1" onClick={runSnapToArch} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Compute'}
            </Button>
            {snapResult && onSnapTargets && (
              <Button size="sm" variant="outline" className="flex-1" onClick={applySnapTargets}>
                Apply Targets
              </Button>
            )}
          </div>
          {snapResult && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Fit error: {fmt(snapResult.fit_error_mm, 2)}mm</p>
              <p>Total movement: {fmt(snapResult.total_movement_mm)}mm</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
