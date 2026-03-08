// Viewer3DTestPage.tsx — Test page for 3D viewer with real dental STL files.

import { useState } from 'react';
import { DentalViewer3D } from '@/modules/viewer';
import { cn } from '@/lib/utils';

type ViewMode = 'dr-hamid' | 'maxillary-mandibular' | 'single-upper' | 'single-lower';

const VIEW_MODES: { key: ViewMode; label: string; upper?: string; lower?: string; single?: string }[] = [
  {
    key: 'dr-hamid',
    label: "Dr Hamid's Case (Both Jaws)",
    upper: '/samples/dr-hamid-upperjaw.stl',
    lower: '/samples/dr-hamid-lowerjaw.stl',
  },
  {
    key: 'maxillary-mandibular',
    label: 'Maxillary + Mandibular',
    upper: '/samples/maxillary_export.stl',
    lower: '/samples/mandibulary_export.stl',
  },
  {
    key: 'single-upper',
    label: 'Single: Upper Jaw',
    single: '/samples/dr-hamid-upperjaw.stl',
  },
  {
    key: 'single-lower',
    label: 'Single: Lower Jaw',
    single: '/samples/dr-hamid-lowerjaw.stl',
  },
];

export function Viewer3DTestPage() {
  const [activeMode, setActiveMode] = useState<ViewMode>('dr-hamid');
  const current = VIEW_MODES.find((m) => m.key === activeMode)!;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-dark-text">3D Viewer Test</h1>
      <p className="mb-4 text-sm text-gray-500">
        Select a model set below. Use the jaw mode bar at the bottom to toggle views.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEW_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMode(m.key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeMode === m.key
                ? 'bg-electric text-white'
                : 'bg-soft-gray text-gray-600 hover:bg-gray-200',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <DentalViewer3D
        key={activeMode}
        fileUrl={current.single}
        upperJawUrl={current.upper}
        lowerJawUrl={current.lower}
      />
    </div>
  );
}
