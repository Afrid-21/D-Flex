import React from 'react';
import { ReroutingMetrics, RobotInfo, RerouteEvent, RerouteReason } from '../types/warehouse';

interface ReroutePanelProps {
  rerouting?: ReroutingMetrics;
  robots: RobotInfo[];
  onTriggerScenarioA: () => void;
  onTriggerScenarioB: () => void;
  onTriggerScenarioC: () => void;
}

export const ReroutePanel: React.FC<ReroutePanelProps> = ({
  rerouting,
  robots,
  onTriggerScenarioA,
  onTriggerScenarioB,
  onTriggerScenarioC,
}) => {
  const totalReroutes = rerouting?.total_reroutes || 0;
  const successfulReroutes = rerouting?.successful_reroutes || 0;
  const failedReroutes = rerouting?.failed_reroutes || 0;
  const avgTime = rerouting?.avg_computation_time_ms || 0;
  const avgAdded = rerouting?.avg_added_path_length || 0;
  const recentEvents = rerouting?.recent_events || [];

  const successRate = totalReroutes > 0 ? ((successfulReroutes / totalReroutes) * 100).toFixed(1) : '100.0';

  const getReasonBadge = (reason: RerouteReason | string) => {
    switch (reason) {
      case 'DYNAMIC_OBSTACLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            DYNAMIC OBSTACLE
          </span>
        );
      case 'RESERVATION_CONFLICT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            RESERVATION CLASH
          </span>
        );
      case 'PEER_POSITION_CONFLICT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            PEER PROXIMITY
          </span>
        );
      case 'TRAJECTORY_SHIFT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            TRAJECTORY SHIFT
          </span>
        );
      case 'DEADLOCK_RECOVERY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            DEADLOCK AVOID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
            {reason}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
            Dynamic Rerouting Engine
          </h3>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-medium">
            A* Replanning + Versioned P2P Mesh
          </span>
        </div>

        {/* Demo Trigger Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onTriggerScenarioA}
            className="px-2.5 py-1 text-xs font-medium bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors"
            title="Spawns dynamic obstacle in R1 path -> A* replans alternative route"
          >
            Scenario A: Blocked Route
          </button>
          <button
            onClick={onTriggerScenarioB}
            className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded transition-colors"
            title="Injects reservation invalidation -> R2 replans without collision"
          >
            Scenario B: Reservation Clash
          </button>
          <button
            onClick={onTriggerScenarioC}
            className="px-2.5 py-1 text-xs font-medium bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
            title="Completely blocks path with no route -> transitions to SAFE_WAIT"
          >
            Scenario C: No Route (Safe Wait)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50/50 border-b border-slate-200">
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Reroutes
          </div>
          <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            {totalReroutes}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Success Rate
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
            {successRate}%
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Failed / Safe-Wait
          </div>
          <div className={`text-xl font-bold font-mono mt-0.5 ${failedReroutes > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {failedReroutes}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Avg Compute Time
          </div>
          <div className="text-xl font-bold font-mono text-cyan-600 mt-0.5">
            {avgTime.toFixed(2)} ms
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Avg Added Length
          </div>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">
            {avgAdded >= 0 ? `+${avgAdded.toFixed(1)}` : avgAdded.toFixed(1)} cells
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Reroute Events + Per-Robot Route Versions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Recent Events Table */}
        <div className="lg:col-span-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Dynamic Replanning Event History</span>
            <span className="text-[11px] font-normal text-slate-500">
              Monotonic Route Versioning ($v_1 \rightarrow v_2$)
            </span>
          </h4>

          {recentEvents.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded p-6 text-center text-xs text-slate-500 bg-slate-50/50">
              No reroute events recorded yet. AMRs following initial baseline routes.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Robot</th>
                    <th className="py-2 px-3">Reason</th>
                    <th className="py-2 px-3">Version</th>
                    <th className="py-2 px-3">Path $\Delta$</th>
                    <th className="py-2 px-3">Compute</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {recentEvents.map((evt: RerouteEvent) => (
                    <tr key={evt.event_id} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-800">{evt.robot_id}</td>
                      <td className="py-1.5 px-3">{getReasonBadge(evt.reason)}</td>
                      <td className="py-1.5 px-3 text-indigo-600 font-semibold">v{evt.route_version}</td>
                      <td className="py-1.5 px-3 text-slate-700">
                        {evt.old_path_length} &rarr; {evt.new_path_length} ({evt.new_path_length - evt.old_path_length >= 0 ? `+${evt.new_path_length - evt.old_path_length}` : `${evt.new_path_length - evt.old_path_length}`})
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">{evt.computation_time_ms.toFixed(2)}ms</td>
                      <td className="py-1.5 px-3">
                        {evt.success ? (
                          <span className="text-emerald-700 font-bold text-[11px]">&check; Success</span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[11px]">&cross; Safe Wait</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Per-Robot Reroute State & Version */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            AMR Trajectory & Version State
          </h4>
          <div className="space-y-2">
            {robots.map((r: RobotInfo) => (
              <div
                key={r.robot_id}
                className="bg-white p-2.5 rounded border border-slate-200 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: r.color_accent || '#2563eb' }}
                    />
                    <span className="font-bold font-mono text-slate-800">{r.robot_id}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                      v{r.route_version || 1}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      r.status === 'REROUTING'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : r.status === 'SAFE_WAIT'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between font-mono">
                  <span>Waypoints: {r.current_path?.length || 0}</span>
                  {r.last_reroute_reason && (
                    <span className="text-slate-500 text-[10px] truncate max-w-[130px]" title={r.last_reroute_reason}>
                      {r.last_reroute_reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
