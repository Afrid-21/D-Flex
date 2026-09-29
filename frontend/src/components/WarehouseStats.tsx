import React from 'react';
import { SimulationState } from '../types/warehouse';
import { Layers, Box, Cpu, Clock, Activity, AlertTriangle } from 'lucide-react';

interface WarehouseStatsProps {
  state: SimulationState | null;
  isConnected: boolean;
}

export const WarehouseStats: React.FC<WarehouseStatsProps> = ({ state, isConnected }) => {
  if (!state) return null;

  const totalCells = state.layout.width * state.layout.height;
  const totalShelves = state.layout.shelves.length;
  const totalStations = state.layout.stations.length + state.layout.charging_docks.length;

  const statusBadge = () => {
    switch (state.status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            RUNNING
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            PAUSED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400 border border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            IDLE
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* Simulation Clock */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Sim Clock</span>
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-bold text-slate-100">
          {state.elapsed_seconds.toFixed(1)}s
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Tick #{state.tick} ({state.tick_rate_hz} Hz)
        </div>
      </div>

      {/* Engine Status */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Engine State</span>
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <div className="mt-1.5">{statusBadge()}</div>
        <div className="mt-1 text-[10px] text-slate-500 font-mono">
          {isConnected ? 'WebSocket Sync: Live' : 'Reconnecting...'}
        </div>
      </div>

      {/* Grid Footprint */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Warehouse Grid</span>
          <Layers className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-bold text-slate-100">
          {state.layout.width} × {state.layout.height}
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          {totalCells} Total Spatial Cells
        </div>
      </div>

      {/* Inventory Racks */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Storage Shelves</span>
          <Box className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-bold text-indigo-300">
          {totalShelves} Racks
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          3 Storage Zones (A/B/C)
        </div>
      </div>

      {/* Logistics Stations */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Stations & Docks</span>
          <Cpu className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-bold text-purple-300">
          {totalStations} Stations
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          3 Inbound • 3 Outbound • 6 Chg
        </div>
      </div>

      {/* Active Obstacles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Dynamic Hazards</span>
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
        </div>
        <div className="mt-1 font-mono text-lg font-bold text-rose-400">
          {state.active_obstacles_count} Blockages
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Interactive Click-to-Add
        </div>
      </div>
    </div>
  );
};
