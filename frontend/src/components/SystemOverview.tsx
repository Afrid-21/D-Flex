import React from 'react';
import { Layers, Box, Cpu, Zap, AlertTriangle, Activity, Bot } from 'lucide-react';
import { SimulationState, RobotInfo } from '../types/warehouse';

interface SystemOverviewProps {
  state: SimulationState | null;
  selectedRobotId: string | null;
  onSelectRobot: (robotId: string | null) => void;
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({
  state,
  selectedRobotId,
  onSelectRobot,
}) => {
  if (!state) return null;

  const totalCells = state.layout.width * state.layout.height;
  const totalShelves = state.layout.shelves.length;
  const totalStations = state.layout.stations.length;
  const totalDocks = state.layout.charging_docks.length;
  const totalLogisticsNodes = totalStations + totalDocks;
  const robots = state.robots || [];
  const fleetSummary = state.fleet_summary;

  const metrics = [
    {
      label: 'FLEET HEALTH',
      value: fleetSummary?.health_status ?? 'HEALTHY',
      sub: `${fleetSummary?.available_robots ?? robots.length}/${fleetSummary?.total_robots ?? robots.length} vehicles available`,
      icon: <Bot className="h-4 w-4 text-blue-600" />,
      accent: 'border-blue-200 bg-blue-50/70',
    },
    {
      label: 'WAREHOUSE GRID',
      value: `${state.layout.width} × ${state.layout.height}`,
      sub: `${totalCells} Spatial Cells`,
      icon: <Layers className="h-4 w-4 text-blue-600" />,
      accent: 'border-slate-200 bg-slate-50/70',
    },
    {
      label: 'STORAGE RACKS',
      value: `${totalShelves}`,
      sub: 'Zones A (40), B (40), C (30)',
      icon: <Box className="h-4 w-4 text-slate-700" />,
      accent: 'border-slate-200 bg-slate-50/70',
    },
    {
      label: 'LOGISTICS STATIONS',
      value: `${totalLogisticsNodes}`,
      sub: '3 Inbound • 3 Outbound',
      icon: <Cpu className="h-4 w-4 text-emerald-600" />,
      accent: 'border-slate-200 bg-slate-50/70',
    },
    {
      label: 'CHARGING DOCKS',
      value: `${totalDocks}`,
      sub: 'Inductive High-Speed',
      icon: <Zap className="h-4 w-4 text-purple-600" />,
      accent: 'border-slate-200 bg-slate-50/70',
    },
    {
      label: 'UTILIZATION',
      value: `${Math.round(fleetSummary?.utilization_pct ?? 0)}%`,
      sub: 'Fleet task load',
      icon: <Activity className="h-4 w-4 text-emerald-600" />,
      accent: 'border-emerald-200 bg-emerald-50/70',
    },
    {
      label: 'ACTIVE HAZARDS',
      value: `${state.active_obstacles_count}`,
      sub: state.active_obstacles_count > 0 ? 'Dynamic Obstruction' : 'Corridors Clear',
      icon: <AlertTriangle className={`h-4 w-4 ${state.active_obstacles_count > 0 ? 'text-rose-600' : 'text-slate-400'}`} />,
      accent: state.active_obstacles_count > 0 ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50/70',
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm select-none">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            System Topology
          </h2>
        </div>
        <span className="font-mono text-[10px] text-slate-500 font-medium">
          Tick #{state.tick}
        </span>
      </div>

      {/* Metric Cards */}
      <div className="flex flex-col gap-2">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between rounded-lg border p-2.5 transition-all ${m.accent}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
                {m.icon}
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-700 font-mono tracking-tight">
                  {m.label}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">{m.sub}</div>
              </div>
            </div>
            <div className="font-mono text-sm font-bold text-slate-900">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* AMR Fleet Quick List */}
      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mb-2">
          <div className="flex items-center gap-1.5 font-bold">
            <Bot className="h-3.5 w-3.5 text-blue-600" />
            <span>AMR FLEET ROSTER (3)</span>
          </div>
          <span className="text-slate-400 font-medium">Click to select</span>
        </div>

        <div className="space-y-1.5">
          {robots.map((r: RobotInfo) => {
            const isSelected = r.robot_id === selectedRobotId;
            return (
              <button
                key={r.robot_id}
                onClick={() => onSelectRobot(isSelected ? null : r.robot_id)}
                className={`w-full flex items-center justify-between rounded-md border p-1.5 text-left text-xs transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/80 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-white font-mono font-bold text-[10px]"
                    style={{ backgroundColor: r.color_accent }}
                  >
                    {r.robot_id}
                  </span>
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-[11px] leading-tight">
                      AMR {r.robot_id}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate max-w-[110px]">
                      {r.destination_label}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-[10px] text-slate-800">
                    {r.battery.toFixed(0)}%
                  </div>
                  <div
                    className={`text-[9px] font-mono font-bold ${
                      r.status === 'MOVING'
                        ? 'text-blue-700'
                        : r.status === 'ARRIVED'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {r.status}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
