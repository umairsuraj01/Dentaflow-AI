// StagingOptionsPanel.tsx — Enhanced staging options (easing, sequencing, validation).

import { useState } from 'react';
import {
  Loader2, Play, AlertTriangle, CheckCircle, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analysisService } from '../services/analysis.service';
import type {
  StagingPlanResult,
  AttachmentPlan,
} from '../types/analysis.types';
import type { ToothTransform } from '../types/treatment.types';

interface StagingOptionsPanelProps {
  filePath: string;
  jaw?: string;
  extractionId?: string;
  teeth: { fdi: number }[];
  targets: Record<number, ToothTransform>;
  onStagingComplete: (result: StagingPlanResult) => void;
}

export function StagingOptionsPanel({
  filePath,
  jaw,
  extractionId,
  teeth,
  targets,
  onStagingComplete,
}: StagingOptionsPanelProps) {
  const [easing, setEasing] = useState('ease_in_out');
  const [sequencing, setSequencing] = useState('simultaneous');
  const [maxTranslation, setMaxTranslation] = useState(0.25);
  const [maxRotation, setMaxRotation] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StagingPlanResult | null>(null);
  const [attachments, setAttachments] = useState<AttachmentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasTargets = Object.keys(targets).length > 0;

  const buildTargetsDict = (): Record<string, Record<string, number>> => {
    const dict: Record<string, Record<string, number>> = {};
    for (const fdi of teeth.map(t => t.fdi)) {
      const t = targets[fdi];
      dict[String(fdi)] = {
        pos_x: t?.pos_x ?? 0,
        pos_y: t?.pos_y ?? 0,
        pos_z: t?.pos_z ?? 0,
        rot_x: t?.rot_x ?? 0,
        rot_y: t?.rot_y ?? 0,
        rot_z: t?.rot_z ?? 0,
      };
    }
    return dict;
  };

  const computeStaging = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetsDict = buildTargetsDict();

      const [stagingRes, attachmentRes] = await Promise.all([
        analysisService.computeStagingPlan({
          filePath,
          jaw,
          extractionId,
          targets: targetsDict,
          maxTranslation,
          maxRotation,
          easing,
          sequencing,
          validate: true,
        }),
        analysisService.planAttachments(filePath, targetsDict, jaw, extractionId),
      ]);

      setResult(stagingRes);
      setAttachments(attachmentRes);
      onStagingComplete(stagingRes);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Staging Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Smart Staging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Easing */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Easing</label>
            <div className="mt-1 flex gap-1">
              {[
                { value: 'linear', label: 'Linear' },
                { value: 'ease_in_out', label: 'Ease In/Out' },
                { value: 'ease_in', label: 'Ease In' },
                { value: 'ease_out', label: 'Ease Out' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEasing(opt.value)}
                  className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                    easing === opt.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sequencing */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sequencing</label>
            <div className="mt-1 flex gap-1">
              {[
                { value: 'simultaneous', label: 'All' },
                { value: 'anterior_first', label: 'Ant. First' },
                { value: 'posterior_first', label: 'Post. First' },
                { value: 'leveling_first', label: 'Level First' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSequencing(opt.value)}
                  className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                    sequencing === opt.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Movement limits */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500">Translation/stage</label>
              <select
                value={maxTranslation}
                onChange={(e) => setMaxTranslation(Number(e.target.value))}
                className="mt-0.5 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              >
                <option value={0.15}>0.15mm</option>
                <option value={0.2}>0.20mm</option>
                <option value={0.25}>0.25mm</option>
                <option value={0.3}>0.30mm</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500">Rotation/stage</label>
              <select
                value={maxRotation}
                onChange={(e) => setMaxRotation(Number(e.target.value))}
                className="mt-0.5 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              >
                <option value={1.0}>1.0°</option>
                <option value={1.5}>1.5°</option>
                <option value={2.0}>2.0°</option>
                <option value={3.0}>3.0°</option>
              </select>
            </div>
          </div>

          {/* Compute Button */}
          <Button
            size="sm"
            className="w-full"
            onClick={computeStaging}
            disabled={loading || !hasTargets}
          >
            {loading ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Computing...</>
            ) : (
              <><Play className="mr-1 h-3.5 w-3.5" />Compute Smart Stages</>
            )}
          </Button>

          {!hasTargets && (
            <p className="text-[10px] text-gray-400 text-center">
              Set tooth targets first
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Staging Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Staging Result
              <Badge>{result.total_stages} stages</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Duration</span>
              <span className="font-medium">{result.total_stages * 2} weeks</span>
            </div>

            {/* Validation Status */}
            {result.validation && (
              <div className={`rounded px-2 py-1.5 ${
                result.validation.is_feasible ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center gap-1.5">
                  {result.validation.is_feasible ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className={result.validation.is_feasible ? 'text-green-700' : 'text-red-700'}>
                    {result.validation.is_feasible ? 'Feasible' : 'Issues detected'}
                  </span>
                </div>
                {result.validation.stages_with_errors > 0 && (
                  <p className="mt-1 text-[10px] text-red-600">
                    {result.validation.stages_with_errors} stages with errors
                  </p>
                )}
                {result.validation.stages_with_warnings > 0 && (
                  <p className="text-[10px] text-amber-600">
                    {result.validation.stages_with_warnings} stages with warnings
                  </p>
                )}
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-0.5">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-amber-600 text-[10px]">{w}</p>
                ))}
              </div>
            )}

            {/* Per-tooth stages */}
            <div className="mt-1">
              <p className="text-[10px] text-gray-400 mb-1">Per-tooth stages:</p>
              <div className="grid grid-cols-5 gap-0.5">
                {Object.entries(result.per_tooth_stages)
                  .filter(([, count]) => count > 0)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([fdi, count]) => (
                    <div
                      key={fdi}
                      className="flex flex-col items-center rounded bg-gray-50 px-1 py-0.5"
                    >
                      <span className="text-[9px] font-bold text-gray-600">{fdi}</span>
                      <span className="text-[8px] text-gray-400">{count}st</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachment Plan */}
      {attachments && attachments.total_attachments > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Attachments
              <Badge variant="purple">{attachments.total_attachments}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            <p className="text-gray-500">
              {attachments.total_attachments} attachments on{' '}
              {attachments.teeth_with_attachments.length} teeth
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {attachments.attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                  <div>
                    <span className="font-medium">#{a.fdi}</span>
                    <span className="ml-1 text-gray-400">{a.attachment_type}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {a.surface} · {a.reason}
                  </div>
                </div>
              ))}
            </div>
            {attachments.warnings.map((w, i) => (
              <p key={i} className="text-amber-600 text-[10px]">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
