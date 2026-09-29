import React from 'react';
import { Bot, CheckCircle2, Battery, ShieldCheck, Activity, Wifi, Play } from 'lucide-react';
import { SimulationState } from '../types/warehouse';

interface OperationsBarProps {
  state: SimulationState | null;
  isConnected: boolean;
}

export const OperationsBar: React.FC<OperationsBarProps> = ({ state, isConnected }) => {
  const robots = state?.robots || [];
  const totalRobots = robots.length;
  const activeCount = robots.filter((r) => r.status === 'MOVING').length;
  const arrivedCount = robots.filter((r) => r.status === 'ARRIVED').length;
  const avgBattery =
    robots.length > 0
      ? (robots.reduce((acc, r) => acc + r.battery, 0) / robots.length).toFixed(1)
      : '100.0';

  const kpis = [
    {
      label: 'AMR FLEET',
      val: `${totalRobots} AMRs`,
      sub: 'R1, R2, R3 Active',
      icon: <Bot className="h-3.5 w-3.5 text-blue-600" />,
      valClass: 'text-blue-700 font-bold',
    },
    {
      label: 'MOVING (ACTIVE)',
      val: `${activeCount}`,
      sub: activeCount > 0 ? 'Traversing Waypoints' : 'Fleet Standing By',
      icon: <Play className={`h-3.5 w-3.5 ${activeCount > 0 ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />,
      valClass: activeCount > 0 ? 'text-blue-700 font-bold' : 'text-slate-800',
    },
    {
      label: 'ARRIVED DESTINATION',
      val: `${arrivedCount} / ${totalRobots}`,
      sub: arrivedCount === totalRobots && totalRobots > 0 ? 'All Missions Complete' : 'En Route',
      icon: <CheckCircle2 className={`h-3.5 w-3.5 ${arrivedCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />,
      valClass: arrivedCount > 0 ? 'text-emerald-700 font-bold' : 'text-slate-800',
    },
    {
      label: 'AVG FLEET BATTERY',
      val: `${avgBattery}%`,
      sub: 'Discharge 0.05%/tick',
      icon: <Battery className="h-3.5 w-3.5 text-emerald-600" />,
      valClass: parseFloat(avgBattery) > 50 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold',
    },
    {
      label: 'ACTIVE HAZARDS',
      val: `${state?.active_obstacles_count || 0}`,
      sub: state?.active_obstacles_count ? 'Corridors Blocked' : '0 Blockages',
      icon: <Activity className={`h-3.5 w-3.5 ${state?.active_obstacles_count ? 'text-rose-600' : 'text-slate-500'}`} />,
      valClass: state?.active_obstacles_count ? 'text-rose-700 font-bold' : 'text-slate-800',
    },
    {
      label: 'CONFLICTS (TIME-SPACE)',
      val: `${state?.conflicts?.total_conflicts || 0}`,
      sub: state?.conflicts?.total_conflicts
        ? `${state.conflicts.vertex_conflicts} Vtx, ${state.conflicts.edge_conflicts} Edg`
        : 'Paths Clear',
      icon: <ShieldCheck className={`h-3.5 w-3.5 ${state?.conflicts?.total_conflicts ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`} />,
      valClass: state?.conflicts?.total_conflicts ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold',
    },
    {
      label: 'NETWORK MESH',
      val: isConnected ? 'HEALTHY' : 'OFFLINE',
      sub: isConnected ? '10 Hz Telemetry' : 'Lost Signal',
      icon: <Wifi className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-600' : 'text-rose-600'}`} />,
      valClass: isConnected ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm select-none">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((k, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5"
          >
            <div className="rounded-md border border-slate-200 bg-white p-1.5 shrink-0 shadow-sm">
              {k.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-500 font-bold tracking-tight truncate">
                  {k.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-xs font-bold ${k.valClass || 'text-slate-900'}`}>
                  {k.val}
                </span>
                <span className="text-[9px] text-slate-500 truncate hidden xl:inline">
                  {k.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
