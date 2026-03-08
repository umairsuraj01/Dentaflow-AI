// TimelinePlayer.tsx — Treatment step timeline with play/pause and scrubber.

import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
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
  stepLabels = [],
}: TimelinePlayerProps) {
  if (totalSteps === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-full bg-black/60 px-5 py-2.5 backdrop-blur ring-1 ring-white/10">
      {/* Skip to start */}
      <button
        onClick={() => onStepChange(0)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        title="Go to start"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>

      {/* Play/Pause */}
      <button
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-electric text-white shadow-md hover:bg-electric/90"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      {/* Skip to end */}
      <button
        onClick={() => onStepChange(totalSteps)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        title="Go to end"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      {/* Scrubber */}
      <div className="flex flex-1 flex-col items-center gap-0.5">
        <input
          type="range"
          min={0}
          max={totalSteps}
          step={0.01}
          value={currentStep}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="h-1.5 w-48 cursor-pointer appearance-none rounded-full bg-white/20 accent-electric"
        />
        {/* Step tick marks */}
        <div className="flex w-48 justify-between px-0.5">
          {Array.from({ length: totalSteps + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => onStepChange(i)}
              className={cn(
                'text-[8px] font-medium transition-colors',
                Math.round(currentStep) === i
                  ? 'text-electric'
                  : 'text-white/40 hover:text-white/70',
              )}
              title={stepLabels[i] ?? `Step ${i}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      <span className="min-w-[60px] text-center text-xs font-mono text-white/60">
        Step {Math.round(currentStep)}/{totalSteps}
      </span>

      {/* Speed control */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              speed === s
                ? 'bg-electric/20 text-electric'
                : 'text-white/40 hover:text-white/70',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
