// SegmentationOverlay.tsx — Shows AI segmentation status and controls on the 3D viewer.

import { Activity, AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SegmentationJobStatus, SegmentationResult } from '../types/segmentation.types';
import type { AIStagingState } from '../types/segmentation.types';

interface SegmentationOverlayProps {
  segmentation: SegmentationResult | undefined;
  jobStatus: SegmentationJobStatus | undefined;
  isProcessing: boolean;
  onTrigger: () => void;
  onReprocess: () => void;
  isTriggering: boolean;
  isReprocessing: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  PENDING: 'Queued...',
  DOWNLOADING: 'Downloading file...',
  PREPROCESSING: 'Preprocessing mesh...',
  RUNNING_AI: 'Running AI segmentation...',
  POSTPROCESSING: 'Post-processing results...',
  SAVING: 'Saving results...',
  SUCCESS: 'Complete',
  FAILED: 'Failed',
};

const STAGE_ORDER: AIStagingState[] = [
  'PENDING', 'DOWNLOADING', 'PREPROCESSING', 'RUNNING_AI', 'POSTPROCESSING', 'SAVING', 'SUCCESS',
];

export function SegmentationOverlay({
  segmentation,
  jobStatus,
  isProcessing: _isProcessing,
  onTrigger,
  onReprocess,
  isTriggering,
  isReprocessing,
}: SegmentationOverlayProps) {
  const state = jobStatus?.state as AIStagingState | undefined;
  const isActive = state && !['SUCCESS', 'FAILED', 'NONE'].includes(state);
  const isFailed = state === 'FAILED';

  // If segmentation exists and no active job, show result summary
  if (segmentation && !isActive) {
    const teethFound = JSON.parse(segmentation.teeth_found_json) as number[];
    const confidence = JSON.parse(segmentation.confidence_json) as Record<string, number>;
    const avgConf = Object.values(confidence);
    const meanConf = avgConf.length ? avgConf.reduce((a, b) => a + b, 0) / avgConf.length : 0;

    return (
      <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg bg-black/80 p-3 text-white backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium">AI Segmentation Complete</span>
        </div>
        <div className="space-y-1 text-xs text-gray-300">
          <p>{teethFound.length} teeth detected</p>
          <p>Avg. confidence: {(meanConf * 100).toFixed(1)}%</p>
          <p>Processing time: {segmentation.processing_time_seconds.toFixed(1)}s</p>
          <p>Model: {segmentation.model_version}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full border-gray-600 text-xs text-gray-300 hover:bg-gray-700"
          onClick={onReprocess}
          disabled={isReprocessing}
        >
          {isReprocessing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          Reprocess
        </Button>
      </div>
    );
  }

  // If actively processing, show progress
  if (isActive && state) {
    const currentIdx = STAGE_ORDER.indexOf(state);
    const progress = Math.round(((currentIdx + 1) / STAGE_ORDER.length) * 100);

    return (
      <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg bg-black/80 p-3 text-white backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <span className="text-sm font-medium">AI Processing</span>
        </div>
        <p className="mb-2 text-xs text-gray-300">{STAGE_LABELS[state] ?? state}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-gray-400">{progress}%</p>
      </div>
    );
  }

  // If failed, show error
  if (isFailed) {
    return (
      <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg bg-black/80 p-3 text-white backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium">Processing Failed</span>
        </div>
        {jobStatus?.error && (
          <p className="mb-2 text-xs text-red-300">{jobStatus.error}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full border-gray-600 text-xs text-gray-300 hover:bg-gray-700"
          onClick={onTrigger}
          disabled={isTriggering}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  // No segmentation yet — show trigger button
  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg bg-black/80 p-3 text-white backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium">AI Segmentation</span>
      </div>
      <p className="mb-2 text-xs text-gray-400">
        Run AI to detect and label individual teeth in this scan.
      </p>
      <Button
        size="sm"
        className="w-full bg-blue-600 text-xs hover:bg-blue-700"
        onClick={onTrigger}
        disabled={isTriggering}
      >
        {isTriggering ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
        Run Segmentation
      </Button>
    </div>
  );
}
