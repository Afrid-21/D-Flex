import React from 'react';
import { Navigation, Battery, Gauge, Target, X, Compass, Route, Cpu, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { RobotInfo } from '../types/warehouse';

interface RobotInfoPanelProps {
  robot: RobotInfo | null;
  onDeselect: () => void;
}

export const RobotInfoPanel: React.FC<RobotInfoPanelProps> = ({ robot, onDeselect }) => {
  if (!robot) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MOVING':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'ARRIVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PAUSED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 70) return 'bg-emerald-500';
    if (level > 30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const progressPercent = robot.path_length && robot.path_length > 0
    ? Math.min(100, Math.round(((robot.path_progress || 0) / robot.path_length) * 100))
    : (robot.status === 'ARRIVED' ? 100 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-mono font-bold text-sm shadow-sm"
            style={{ backgroundColor: robot.color_accent }}
          >
            {robot.robot_id}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm">
                AMR Node {robot.robot_id}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${getStatusBadge(robot.status)}`}>
                {robot.status}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Autonomous Industrial Mobile Platform</div>
          </div>
        </div>

        <button
          onClick={onDeselect}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Deselect AMR"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Battery Bar */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Battery className="h-3.5 w-3.5 text-slate-500" />
            <span>BATTERY CHARGE</span>
          </div>
          <span className="font-bold text-slate-900">{robot.battery.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBatteryColor(robot.battery)}`}
            style={{ width: `${Math.max(5, Math.min(100, robot.battery))}%` }}
          />
        </div>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Position */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 font-bold mb-0.5">
            <Navigation className="h-3 w-3 text-blue-600" />
            <span>POSITION</span>
          </div>
          <div className="font-mono font-bold text-slate-900">
            ({robot.position[0]}, {robot.position[1]})
          </div>
        </div>

        {/* Heading Direction */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 font-bold mb-0.5">
            <Compass className="h-3 w-3 text-indigo-600" />
            <span>HEADING</span>
          </div>
          <div className="font-mono font-bold text-slate-900 flex items-center gap-1">
            <span>{robot.direction}</span>
            <span className="text-[10px] text-slate-500 font-normal">
              ({robot.direction === 'E' ? 'East' : robot.direction === 'W' ? 'West' : robot.direction === 'N' ? 'North' : 'South'})
            </span>
          </div>
        </div>

        {/* Velocity */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 font-bold mb-0.5">
            <Gauge className="h-3 w-3 text-emerald-600" />
            <span>SPEED</span>
          </div>
          <div className="font-mono font-bold text-slate-900">
            {robot.speed.toFixed(1)} m/s
          </div>
        </div>

        {/* Path Remaining */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 font-bold mb-0.5">
            <Route className="h-3 w-3 text-purple-600" />
            <span>REMAINING</span>
          </div>
          <div className="font-mono font-bold text-slate-900">
            {robot.remaining_distance ?? (robot.current_path ? robot.current_path.length : 0)} steps
          </div>
        </div>
      </div>

      {/* Phase 3 A* Path Planning Telemetry */}
      <div className="mt-2.5 rounded-lg border border-blue-100 bg-blue-50/40 p-2.5 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1 text-[10px] font-mono text-blue-900 font-bold">
            <Cpu className="h-3.5 w-3.5 text-blue-600" />
            <span>A* SEARCH TELEMETRY</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
            robot.planning_status === 'PATH_FOUND'
              ? 'bg-emerald-100 text-emerald-800'
              : robot.planning_status === 'NO_PATH'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {robot.planning_status === 'PATH_FOUND' ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
            {robot.planning_status === 'NO_PATH' ? <AlertTriangle className="h-2.5 w-2.5" /> : null}
            {robot.planning_status || 'PATH_FOUND'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-1">
            <span>Route Execution:</span>
            <span className="font-bold text-slate-900">
              {robot.path_progress ?? 0} / {robot.path_length ?? 0} cells ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Solver Stats */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100/80 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Time:</span>
            <span className="font-bold text-slate-900">{robot.planning_time_ms ? `${robot.planning_time_ms.toFixed(2)} ms` : '<0.10 ms'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <Cpu className="h-3 w-3 text-slate-400" />
            <span>Explored:</span>
            <span className="font-bold text-slate-900">{robot.explored_nodes ?? 0} nodes</span>
          </div>
        </div>
      </div>

      {/* Phase 6 Local Agent & P2P Distributed Telemetry */}
      <div className="mt-2.5 rounded-lg border border-purple-100 bg-purple-50/40 p-2.5 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1 text-[10px] font-mono text-purple-900 font-bold">
            <Cpu className="h-3.5 w-3.5 text-purple-600" />
            <span>LOCAL AGENT P2P STATE</span>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {robot.p2p_status || 'CONNECTED'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2">
          <div className="text-slate-600">
            Agent ID: <span className="font-bold text-slate-900">{robot.agent_id || `agent_${robot.robot_id}`}</span>
          </div>
          <div className="text-slate-600">
            Seq No: <span className="font-bold text-slate-900">#{robot.sequence_number ?? 0}</span>
          </div>
          <div className="text-slate-600">
            Tx Sent: <span className="font-bold text-slate-900">{robot.messages_sent ?? 0} msgs</span>
          </div>
          <div className="text-slate-600">
            Rx Received: <span className="font-bold text-slate-900">{robot.messages_received ?? 0} msgs</span>
          </div>
          <div className="text-slate-600 col-span-2">
            Last Heartbeat: <span className="font-bold text-slate-900">{robot.last_heartbeat_ms !== undefined ? `${robot.last_heartbeat_ms.toFixed(0)} ms ago` : 'Active'}</span>
          </div>
        </div>

        {/* Local Neighbor Table View */}
        <div className="border-t border-purple-100/80 pt-1.5">
          <div className="text-[10px] font-mono font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>Known Neighbors ({robot.neighbors?.length || 0}):</span>
            <span className="text-[9px] text-slate-500 font-normal">Decentralized View</span>
          </div>
          {robot.neighbors && robot.neighbors.length > 0 ? (
            <div className="space-y-1">
              {robot.neighbors.map((nb) => (
                <div
                  key={nb.robot_id}
                  className="p-1 rounded bg-white/80 border border-purple-100 text-[10px] font-mono flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-purple-900">{nb.robot_id}</span>
                    <span className="text-slate-500">@ ({nb.position[0]}, {nb.position[1]})</span>
                    <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 font-semibold">{nb.status}</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold">{nb.p2p_status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 italic">No neighbor telemetry received yet.</div>
          )}
        </div>
      </div>

      {/* Target Destination & Task */}
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs">
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 font-bold mb-1">
          <Target className="h-3 w-3 text-rose-600" />
          <span>DESTINATION & MISSION</span>
        </div>
        <div className="font-medium text-slate-800">
          Target: <span className="font-bold text-slate-900">{robot.destination_label || 'None'}</span>
        </div>
        {robot.destination && (
          <div className="text-[10px] font-mono text-slate-500">
            Target Node: [{robot.destination[0]}, {robot.destination[1]}]
          </div>
        )}
        {robot.current_task && (
          <div className="mt-1 text-[10px] text-slate-600 font-sans">
            Task: <span className="font-medium text-slate-800">{robot.current_task}</span>
          </div>
        )}
      </div>
    </div>
  );
};

