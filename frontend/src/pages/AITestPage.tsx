// AITestPage.tsx — Dev test page for AI segmentation pipeline (bypasses Celery/Redis).

import { useState } from 'react';
import { Brain, Loader2, Play, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { FDI_UPPER, FDI_LOWER, AI_CONFIDENCE } from '@/constants/app';

const TEST_FILES = [
  { label: 'Maxillary (upper)', path: '/Users/umairsuraj/Downloads/maxillary_export.stl' },
  { label: 'Mandibular (lower)', path: '/Users/umairsuraj/Downloads/mandibulary_export.stl' },
  { label: 'Dr Hamid Upper Jaw', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-upperjaw.stl" },
  { label: 'Dr Hamid Lower Jaw', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-lowerjaw.stl" },
];

interface SegResult {
  teeth_found: number[];
  total_points: number;
  processing_time: number;
  model_version: string;
  confidence_scores: Record<string, number>;
  restricted_fdi: number[];
  overridden_count: number;
  unique_labels: number;
}

export function AITestPage() {
  const [selectedFile, setSelectedFile] = useState(TEST_FILES[0].path);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SegResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post('/ai/test/segment-local', null, {
        params: { file_path: selectedFile },
      });
      if (res.data.success) {
        setResult(res.data.data);
      } else {
        setError(res.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const getConfColor = (score: number) => {
    if (score >= AI_CONFIDENCE.high) return 'bg-emerald-500 text-white';
    if (score >= AI_CONFIDENCE.medium) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-dark-text">AI Segmentation Test</h1>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">DEV MODE</span>
      </div>

      <p className="text-sm text-gray-500">
        This page runs the AI segmentation pipeline synchronously on local STL files (mock mode).
        No Celery or Redis required.
      </p>

      {/* File selector + Run */}
      <Card>
        <CardHeader><CardTitle>Select STL File</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {TEST_FILES.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelectedFile(f.path)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedFile === f.path
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run AI Segmentation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Segmentation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Teeth Found" value={result.teeth_found.length} />
                <Stat label="Total Points" value={result.total_points.toLocaleString()} />
                <Stat label="Processing Time" value={`${result.processing_time.toFixed(2)}s`} />
                <Stat label="Model Version" value={result.model_version} />
              </div>
            </CardContent>
          </Card>

          {/* Per-tooth confidence grid */}
          <Card>
            <CardHeader><CardTitle>Per-Tooth Confidence</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Upper Arch */}
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">Upper Arch</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {FDI_UPPER.map((fdi) => {
                    const score = result.confidence_scores[String(fdi)];
                    const isFound = result.teeth_found.includes(fdi);
                    return (
                      <ToothCell key={fdi} fdi={fdi} score={score} isFound={isFound} getColor={getConfColor} />
                    );
                  })}
                </div>
              </div>

              {/* Lower Arch */}
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">Lower Arch</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {FDI_LOWER.map((fdi) => {
                    const score = result.confidence_scores[String(fdi)];
                    const isFound = result.teeth_found.includes(fdi);
                    return (
                      <ToothCell key={fdi} fdi={fdi} score={score} isFound={isFound} getColor={getConfColor} />
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 border-t">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded bg-emerald-500" /> High (&ge;90%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded bg-amber-500" /> Medium (70-90%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded bg-red-500" /> Low (&lt;70%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded bg-gray-200" /> Not detected
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Detected teeth list */}
          <Card>
            <CardHeader><CardTitle>Detected Teeth ({result.teeth_found.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.teeth_found.map((fdi) => {
                  const score = result.confidence_scores[String(fdi)];
                  return (
                    <span
                      key={fdi}
                      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${getConfColor(score ?? 0)}`}
                    >
                      {fdi} ({score ? `${(score * 100).toFixed(0)}%` : '?'})
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-dark-text">{value}</p>
    </div>
  );
}

function ToothCell({
  fdi,
  score,
  isFound,
  getColor,
}: {
  fdi: number;
  score: number | undefined;
  isFound: boolean;
  getColor: (s: number) => string;
}) {
  if (!isFound || score === undefined) {
    return (
      <div className="flex h-12 flex-col items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-300">
        <span className="font-medium">{fdi}</span>
        <span>—</span>
      </div>
    );
  }
  return (
    <div
      className={`flex h-12 flex-col items-center justify-center rounded-lg text-[10px] ${getColor(score)}`}
      title={`Tooth ${fdi}: ${(score * 100).toFixed(1)}% confidence`}
    >
      <span className="font-bold">{fdi}</span>
      <span>{(score * 100).toFixed(0)}%</span>
    </div>
  );
}
