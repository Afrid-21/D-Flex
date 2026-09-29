import React from 'react';
import { Play, Pause, RotateCcw, StepForward, ShieldAlert, Trash2 } from 'lucide-react';
import { SimulationStatus } from '../types/warehouse';

interface ControlPanelProps {
  status: SimulationStatus;
  speedMultiplier: number;
  activeObstaclesCount: number;
  activeObstacleBrush: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleBrush: () => void;
  onClearObstacles: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  speedMultiplier,
  activeObstaclesCount,
  activeObstacleBrush,
  onStart,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
  onToggleBrush,
  onClearObstacles,
}) => {
  const isRunning = status === 'running';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
      {/* Primary Simulation Playback Controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:bg-amber-500 active:scale-95"
            title="Pause Simulation"
          >
            <Pause className="h-4 w-4" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:bg-emerald-500 active:scale-95"
            title="Start Simulation"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Start</span>
          </button>
        )}

        <button
          onClick={onStep}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Single Step Tick"
        >
          <StepForward className="h-4 w-4" />
          <span>Step</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 active:scale-95"
          title="Reset Clock & Obstacles"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset</span>
        </button>
      </div>

      {/* Speed Slider Control */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5">
        <span className="text-xs font-medium text-slate-400">Speed:</span>
        <input
          type="range"
          min="0.5"
          max="5.0"
          step="0.5"
          value={speedMultiplier}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-cyan-500"
        />
        <span className="w-10 font-mono text-xs font-bold text-cyan-400">
          {speedMultiplier.toFixed(1)}x
        </span>
      </div>

      {/* Obstacle Brush & Reset Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleBrush}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            activeObstacleBrush
              ? 'border-red-500 bg-red-950/70 text-red-300 shadow-lg shadow-red-950/50'
              : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Click cells on map to place/remove dynamic obstacles"
        >
          <ShieldAlert className={`h-4 w-4 ${activeObstacleBrush ? 'text-red-400' : 'text-slate-400'}`} />
          <span>{activeObstacleBrush ? 'Brush Active (Click Map)' : 'Obstacle Tool'}</span>
        </button>

        {activeObstaclesCount > 0 && (
          <button
            onClick={onClearObstacles}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-900/40"
            title="Clear all dynamic obstacles"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear ({activeObstaclesCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
