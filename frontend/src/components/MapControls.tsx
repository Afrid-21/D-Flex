import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ShieldAlert,
  Trash2,
  Plus,
  Minus,
  Grid,
  Tag,
  Construction,
  AlertTriangle,
} from 'lucide-react';
import { SimulationStatus } from '../types/warehouse';

interface MapControlsProps {
  status: SimulationStatus;
  speedMultiplier: number;
  activeObstaclesCount: number;
  activeObstacleBrush: boolean;
  showGrid: boolean;
  showLabels: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleBrush: () => void;
  onClearObstacles: () => void;
  onTriggerBlockAisle?: () => void;
  onTriggerConflictDemo?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView?: () => void;
  onToggleGrid: () => void;
  onToggleLabels: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  status,
  speedMultiplier,
  activeObstaclesCount,
  activeObstacleBrush,
  showGrid,
  showLabels,
  onStart,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
  onToggleBrush,
  onClearObstacles,
  onTriggerBlockAisle,
  onTriggerConflictDemo,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onToggleLabels,
}) => {
  const isRunning = status === 'running';
  const speedOptions = [0.5, 1.0, 2.0, 5.0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm select-none">
      {/* 1. Playback Engine Controls */}
      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-700 active:scale-95 cursor-pointer"
            title="Pause Simulation Engine"
          >
            <Pause className="h-3.5 w-3.5 fill-white" />
            <span>PAUSE</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 cursor-pointer"
            title="Start Simulation Engine"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            <span>START</span>
          </button>
        )}

        <button
          onClick={onStep}
          disabled={isRunning}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm cursor-pointer"
          title="Advance single tick (100ms)"
        >
          <StepForward className="h-3.5 w-3.5 text-slate-600" />
          <span className="hidden sm:inline">STEP</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-700 transition-all hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-95 shadow-sm cursor-pointer"
          title="Reset Simulation Clock & Obstacles"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
          <span className="hidden sm:inline">RESET</span>
        </button>
      </div>

      {/* 2. Speed Preset Chips */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <span className="text-[10px] font-mono text-slate-500 px-1 font-bold">WARP</span>
        {speedOptions.map((spd) => (
          <button
            key={spd}
            onClick={() => onSpeedChange(spd)}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-all cursor-pointer ${
              speedMultiplier === spd
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {spd}x
          </button>
        ))}
      </div>

      {/* 3. Scenario Tool & Demo Triggers (Block Aisle, Conflict, Brush) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase hidden md:inline">
          SCENARIO TOOL:
        </span>

        {/* DEMO: BLOCK AISLE BUTTON */}
        {onTriggerBlockAisle && (
          <button
            onClick={onTriggerBlockAisle}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1.5 font-mono text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            title="Demo: Place obstacle on R1 active aisle path -> Trigger dynamic rerouting"
          >
            <Construction className="h-3.5 w-3.5 text-amber-600" />
            <span>DEMO: BLOCK AISLE</span>
          </button>
        )}

        {/* Conflict Demo Button */}
        {onTriggerConflictDemo && (
          <button
            onClick={onTriggerConflictDemo}
            className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 px-2 py-1.5 font-mono text-xs font-medium transition-all shadow-sm cursor-pointer"
            title="Demo: Set up intersection trajectory crossing conflict"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden xl:inline">Conflict Demo</span>
          </button>
        )}

        {/* Interactive Brush Toggle */}
        <button
          onClick={onToggleBrush}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold transition-all shadow-sm cursor-pointer ${
            activeObstacleBrush
              ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
          title="Toggle obstacle placement brush (Click map to place/remove)"
        >
          <ShieldAlert className={`h-3.5 w-3.5 ${activeObstacleBrush ? 'text-rose-600' : 'text-slate-600'}`} />
          <span>{activeObstacleBrush ? 'CLICK TO BLOCK' : 'PLACE HAZARD'}</span>
        </button>

        {activeObstaclesCount > 0 && (
          <button
            onClick={onClearObstacles}
            className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 font-mono text-xs font-bold text-rose-700 hover:bg-rose-100 shadow-sm cursor-pointer"
            title="Clear all dynamic obstacles"
          >
            <Trash2 className="h-3 w-3" />
            <span>CLEAR ({activeObstaclesCount})</span>
          </button>
        )}
      </div>

      {/* 4. Clean Zoom (+ / -) & Canvas Toggles */}
      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
        <button
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-all cursor-pointer active:scale-95"
          title="Zoom In (+)"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-all cursor-pointer active:scale-95"
          title="Zoom Out (-)"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onToggleGrid}
          className={`rounded p-1.5 transition-all cursor-pointer ${
            showGrid ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Toggle Grid Lines"
        >
          <Grid className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onToggleLabels}
          className={`rounded p-1.5 transition-all cursor-pointer ${
            showLabels ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Toggle Cell Labels"
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
