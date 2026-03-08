// ToothCorrection.tsx — UI for technicians to submit corrections to AI segmentation.

import { useState } from 'react';
import { CheckCircle2, Clock, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Correction, CorrectionRequest, SegmentationResult } from '../types/segmentation.types';

interface ToothCorrectionProps {
  segmentation: SegmentationResult;
  corrections: Correction[];
  onSubmit: (data: CorrectionRequest) => Promise<unknown>;
  isSubmitting?: boolean;
}

const CORRECTION_TYPES = [
  { value: 'LABEL_FIX', label: 'Label Fix', desc: 'Incorrect tooth label' },
  { value: 'BOUNDARY_FIX', label: 'Boundary Fix', desc: 'Imprecise boundary between teeth' },
  { value: 'MISSING_TOOTH', label: 'Missing Tooth', desc: 'AI missed a tooth' },
  { value: 'EXTRA_SEGMENT', label: 'Extra Segment', desc: 'AI detected a non-existent tooth' },
];

export function ToothCorrection({
  segmentation,
  corrections,
  onSubmit,
  isSubmitting,
}: ToothCorrectionProps) {
  const [correctionType, setCorrectionType] = useState('LABEL_FIX');
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [startTime] = useState(Date.now());

  const handleSubmit = async () => {
    const timeTaken = (Date.now() - startTime) / 1000;
    await onSubmit({
      segmentation_result_id: segmentation.id,
      original_segmentation_json: segmentation.labels_json,
      corrected_segmentation_json: JSON.stringify({ notes, correction_type: correctionType }),
      correction_type: correctionType,
      confidence_score: confidence,
      time_taken_seconds: Math.round(timeTaken),
    });
    setNotes('');
    setConfidence(3);
  };

  return (
    <div className="space-y-4">
      {/* Submit correction form */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Submit Correction</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Correction type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Correction Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CORRECTION_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setCorrectionType(ct.value)}
                  className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                    correctionType === ct.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{ct.label}</p>
                  <p className="text-[10px] text-gray-400">{ct.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Confidence slider */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Your Confidence (1-5): <span className="font-bold">{confidence}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the correction..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Submit Correction
          </Button>
        </CardContent>
      </Card>

      {/* Correction history */}
      {corrections.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Correction History ({corrections.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {corrections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 p-2 text-xs"
                >
                  <CheckCircle2 className={`h-4 w-4 ${c.used_for_training ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <p className="font-medium">{c.correction_type.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>{c.time_taken_seconds.toFixed(0)}s</span>
                      <span>Conf: {c.confidence_score}/5</span>
                    </div>
                  </div>
                  {c.used_for_training && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                      Trained
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
