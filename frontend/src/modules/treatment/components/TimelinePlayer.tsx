// TimelinePlayer.tsx — ArchForm-style treatment stage timeline with play controls.

import { Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelinePlayerProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onStepChange: (step: number) => void;
  onSpeedChange: (speed: number) => void;
  stepLabels?: (string | null)[];
}

const SPEEDS = [0.5, 1, 1.5, 2];

export function TimelinePlayer({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  onToggle,
  onStepChange,
  onSpeedChange,
}: TimelinePlayerProps) {
  if (totalSteps === 0) return null;

  const rounded = Math.round(currentStep);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onStepChange(0)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Go to start"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onStepChange(Math.max(0, rounded - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Previous stage"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white shadow-md hover:bg-blue-600 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onStepChange(Math.min(totalSteps, rounded + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Next stage"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onStepChange(totalSteps)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Go to end"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stage markers (ArchForm style) */}
      <div className="rounded-xl bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
        <div className="flex items-end gap-0.5">
          {Array.from({ length: totalSteps + 1 }, (_, i) => {
            const isActive = rounded === i;
            const isPast = i < rounded;
            return (
              <button
                key={i}
                onClick={() => onStepChange(i)}
                className="flex flex-col items-center gap-0.5 group"
                title={`Stage ${i}`}
              >
                {/* Marker bar */}
                <div
                  className={cn(
                    'w-1.5 rounded-full transition-all',
                    isActive
                      ? 'h-6 bg-blue-500'
                      : isPast
                        ? 'h-4 bg-blue-300 group-hover:bg-blue-400'
                        : 'h-4 bg-gray-300 group-hover:bg-gray-400',
                  )}
                />
                {/* Number label (show every 5th and first/last) */}
                {(i === 0 || i === totalSteps || i % 5 === 0) && (
                  <span
                    className={cn(
                      'text-[9px] font-medium',
                      isActive ? 'text-blue-600' : 'text-gray-400',
                    )}
                  >
                    {i}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 backdrop-blur">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              speed === s
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
