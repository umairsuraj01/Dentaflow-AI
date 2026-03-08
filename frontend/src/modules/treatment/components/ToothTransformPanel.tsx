// ToothTransformPanel.tsx — Sidebar panel for editing a tooth's position/rotation.

import { RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getToothName, getFdiColor } from '@/modules/viewer/utils/fdi';
import type { ToothTransform } from '../types/treatment.types';

interface ToothTransformPanelProps {
  fdi: number;
  transform: ToothTransform;
  onChange: (updated: ToothTransform) => void;
  onReset: () => void;
  restricted?: boolean;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-dark-text">{value.toFixed(1)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-electric"
      />
    </div>
  );
}

export function ToothTransformPanel({
  fdi,
  transform,
  onChange,
  onReset,
  restricted = false,
}: ToothTransformPanelProps) {
  const [r, g, b] = getFdiColor(fdi);
  const name = getToothName(fdi);

  const update = (field: keyof ToothTransform, value: number) => {
    onChange({ ...transform, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded-sm"
              style={{ backgroundColor: `rgb(${r},${g},${b})` }}
            />
            {name}
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-dark-text"
            title="Reset to initial position"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {restricted && (
          <div className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-600">
            This tooth is marked as restricted — do not move.
          </div>
        )}

        {/* Translation */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Translation
          </p>
          <div className="space-y-2">
            <SliderRow
              label="X (Mesial/Distal)"
              value={transform.pos_x}
              min={-5}
              max={5}
              step={0.1}
              unit="mm"
              onChange={(v) => update('pos_x', v)}
            />
            <SliderRow
              label="Y (Vertical)"
              value={transform.pos_y}
              min={-5}
              max={5}
              step={0.1}
              unit="mm"
              onChange={(v) => update('pos_y', v)}
            />
            <SliderRow
              label="Z (Buccal/Lingual)"
              value={transform.pos_z}
              min={-5}
              max={5}
              step={0.1}
              unit="mm"
              onChange={(v) => update('pos_z', v)}
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Rotation
          </p>
          <div className="space-y-2">
            <SliderRow
              label="Torque"
              value={transform.rot_x}
              min={-30}
              max={30}
              step={0.5}
              unit="°"
              onChange={(v) => update('rot_x', v)}
            />
            <SliderRow
              label="Rotation"
              value={transform.rot_y}
              min={-30}
              max={30}
              step={0.5}
              unit="°"
              onChange={(v) => update('rot_y', v)}
            />
            <SliderRow
              label="Angulation"
              value={transform.rot_z}
              min={-30}
              max={30}
              step={0.5}
              unit="°"
              onChange={(v) => update('rot_z', v)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
