// MeshQualityCard.tsx — Display mesh quality report with before/after comparison.

import { CheckCircle2, XCircle, AlertTriangle, Shield, Wrench, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { MeshRepairResponse } from '@/modules/viewer/services/segmentation.service';

interface MeshQualityCardProps {
  repairResult: MeshRepairResponse | null;
  isRepairing: boolean;
  onRepair: () => void;
}

export function MeshQualityCard({ repairResult, isRepairing, onRepair }: MeshQualityCardProps) {
  if (!repairResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-blue-500" />
            Mesh Quality & Repair
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            Run automatic mesh repair to fix holes, remove artifacts, smooth surfaces,
            and ensure the scan is ready for AI segmentation.
          </p>
          <Button size="sm" onClick={onRepair} disabled={isRepairing} className="w-full">
            {isRepairing ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Repairing Mesh...</>
            ) : (
              <><Wrench className="mr-1.5 h-3.5 w-3.5" />Repair & Assess Quality</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { quality_before: before, quality_after: after } = repairResult;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-green-500" />
          Mesh Quality Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quality score */}
        <div className="flex items-center gap-3">
          <ScoreBadge score={after.score} />
          <div className="flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-dark-text">{after.score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
              {before.score < after.score && (
                <span className="text-[10px] font-medium text-green-600">
                  (+{(after.score - before.score).toFixed(1)} from repair)
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              {after.score >= 90 ? 'Excellent — ready for AI' :
               after.score >= 70 ? 'Good — minor issues' :
               after.score >= 50 ? 'Fair — may affect results' :
               'Poor — consider rescanning'}
            </p>
          </div>
        </div>

        {/* Repairs applied */}
        {repairResult.repairs_applied.length > 0 && (
          <div className="rounded-lg bg-green-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-green-700 mb-1">
              Repairs Applied ({repairResult.processing_time.toFixed(2)}s)
            </p>
            <ul className="space-y-0.5">
              {repairResult.repairs_applied.map((r, i) => (
                <li key={i} className="text-[10px] text-green-600 flex items-start gap-1">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {repairResult.repairs_applied.length === 0 && (
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <p className="text-[10px] text-blue-600">
              No repairs needed — mesh is already in good condition.
            </p>
          </div>
        )}

        {/* Quality metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          <QualityMetric
            label="Watertight"
            value={after.is_watertight}
            before={before.is_watertight}
          />
          <QualityMetric
            label="Manifold"
            value={after.is_manifold}
            before={before.is_manifold}
          />
          <MetricNumber
            label="Vertices"
            value={after.vertex_count.toLocaleString()}
          />
          <MetricNumber
            label="Faces"
            value={after.face_count.toLocaleString()}
          />
          <MetricNumber
            label="Holes"
            value={String(after.hole_count)}
            before={String(before.hole_count)}
            improved={after.hole_count < before.hole_count}
          />
          <MetricNumber
            label="Components"
            value={String(after.components)}
            before={String(before.components)}
            improved={after.components < before.components}
          />
          <MetricNumber
            label="Degenerate Faces"
            value={String(after.degenerate_faces)}
            before={String(before.degenerate_faces)}
            improved={after.degenerate_faces < before.degenerate_faces}
          />
          <MetricNumber
            label="Non-manifold Edges"
            value={String(after.non_manifold_edges)}
            before={String(before.non_manifold_edges)}
            improved={after.non_manifold_edges < before.non_manifold_edges}
          />
        </div>

        {/* Bounding box */}
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-[10px] font-medium text-gray-500 mb-0.5">Bounding Box (mm)</p>
          <p className="text-xs font-mono text-gray-700">
            {after.bounding_box.map(d => d.toFixed(1)).join(' × ')}
          </p>
          {after.surface_area > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Surface: {after.surface_area.toFixed(1)} mm²
              {after.volume != null && ` · Volume: ${after.volume.toFixed(1)} mm³`}
            </p>
          )}
        </div>

        {/* Re-repair button */}
        <Button
          size="sm"
          variant="outline"
          onClick={onRepair}
          disabled={isRepairing}
          className="w-full"
        >
          {isRepairing ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Re-repairing...</>
          ) : (
            <><Wrench className="mr-1.5 h-3.5 w-3.5" />Re-run Repair</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-100 text-green-700' :
                score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                score >= 50 ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700';
  const Icon = score >= 90 ? CheckCircle2 :
               score >= 70 ? AlertTriangle :
               XCircle;
  return (
    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function QualityMetric({ label, value, before }: {
  label: string;
  value: boolean;
  before: boolean;
}) {
  const fixed = !before && value;
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-1.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <div className="flex items-center gap-1">
        {value ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        )}
        <span className={cn('text-xs font-medium', value ? 'text-green-700' : 'text-red-500')}>
          {value ? 'Yes' : 'No'}
        </span>
        {fixed && (
          <span className="text-[9px] text-green-500 font-medium">Fixed!</span>
        )}
      </div>
    </div>
  );
}

function MetricNumber({ label, value, before, improved }: {
  label: string;
  value: string;
  before?: string;
  improved?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-1.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-semibold text-dark-text">{value}</span>
        {before && improved && (
          <span className="text-[9px] text-green-500">was {before}</span>
        )}
      </div>
    </div>
  );
}
