// SegmentationStats.tsx — Displays per-tooth confidence and segmentation metrics.

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AI_CONFIDENCE } from '@/constants/app';
import { FDI_UPPER, FDI_LOWER } from '@/constants/app';
import type { SegmentationResult } from '../types/segmentation.types';

interface SegmentationStatsProps {
  segmentation: SegmentationResult;
}

export function SegmentationStats({ segmentation }: SegmentationStatsProps) {
  const confidence = useMemo(
    () => JSON.parse(segmentation.confidence_json) as Record<string, number>,
    [segmentation.confidence_json],
  );

  const teethFound = useMemo(
    () => JSON.parse(segmentation.teeth_found_json) as number[],
    [segmentation.teeth_found_json],
  );

  const restricted = useMemo(
    () => JSON.parse(segmentation.restricted_teeth_json) as number[],
    [segmentation.restricted_teeth_json],
  );

  const avgConfidence = useMemo(() => {
    const vals = Object.values(confidence);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [confidence]);

  const getConfColor = (score: number) => {
    if (score >= AI_CONFIDENCE.high) return 'bg-emerald-500';
    if (score >= AI_CONFIDENCE.medium) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Segmentation Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Teeth Detected</p>
              <p className="text-lg font-bold text-dark-text">{teethFound.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg. Confidence</p>
              <p className="text-lg font-bold text-dark-text">{(avgConfidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Points</p>
              <p className="text-lg font-bold text-dark-text">{segmentation.total_points.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Processing Time</p>
              <p className="text-lg font-bold text-dark-text">{segmentation.processing_time_seconds.toFixed(1)}s</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Model Version</p>
              <p className="font-medium text-dark-text">{segmentation.model_version}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Overridden Points</p>
              <p className="font-medium text-dark-text">{segmentation.overridden_points_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-tooth confidence */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Per-Tooth Confidence</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Upper Arch */}
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Upper Arch</p>
              <div className="grid grid-cols-8 gap-1">
                {FDI_UPPER.map((fdi) => {
                  const score = confidence[String(fdi)];
                  const isFound = teethFound.includes(fdi);
                  const isRestricted = restricted.includes(fdi);
                  return (
                    <ToothChip
                      key={fdi}
                      fdi={fdi}
                      score={score}
                      isFound={isFound}
                      isRestricted={isRestricted}
                      getConfColor={getConfColor}
                    />
                  );
                })}
              </div>
            </div>

            {/* Lower Arch */}
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Lower Arch</p>
              <div className="grid grid-cols-8 gap-1">
                {FDI_LOWER.map((fdi) => {
                  const score = confidence[String(fdi)];
                  const isFound = teethFound.includes(fdi);
                  const isRestricted = restricted.includes(fdi);
                  return (
                    <ToothChip
                      key={fdi}
                      fdi={fdi}
                      score={score}
                      isFound={isFound}
                      isRestricted={isRestricted}
                      getConfColor={getConfColor}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> High (&ge;90%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Medium (70-90%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Low (&lt;70%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full border border-red-400 bg-transparent" /> Restricted
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToothChip({
  fdi,
  score,
  isFound,
  isRestricted,
  getConfColor,
}: {
  fdi: number;
  score: number | undefined;
  isFound: boolean;
  isRestricted: boolean;
  getConfColor: (s: number) => string;
}) {
  if (!isFound) {
    return (
      <div className="flex h-8 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-300">
        {fdi}
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-8 items-center justify-center rounded text-[10px] font-medium text-white ${
        score !== undefined ? getConfColor(score) : 'bg-gray-400'
      } ${isRestricted ? 'ring-2 ring-red-400' : ''}`}
      title={`Tooth ${fdi}: ${score !== undefined ? `${(score * 100).toFixed(0)}%` : 'N/A'}${isRestricted ? ' (Restricted)' : ''}`}
    >
      {fdi}
    </div>
  );
}
