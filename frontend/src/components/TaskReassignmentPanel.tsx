import React from 'react';
import {
  TaskReassignmentMetrics,
  TaskReassignReason,
  TaskReassignmentEvent,
} from '../types/warehouse';
import {
  ShieldAlert,
  BatteryWarning,
  Hourglass,
  Route,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  Zap,
} from 'lucide-react';

interface TaskReassignmentPanelProps {
  metrics?: TaskReassignmentMetrics;
  onTriggerScenarioA?: () => void;
  onTriggerScenarioB?: () => void;
  onTriggerScenarioC?: () => void;
}

export const TaskReassignmentPanel: React.FC<TaskReassignmentPanelProps> = ({
  metrics,
  onTriggerScenarioA,
  onTriggerScenarioB,
  onTriggerScenarioC,
}) => {
  const formatReason = (reason: TaskReassignReason) => {
    switch (reason) {
      case 'BATTERY_CRITICAL':
        return { label: 'Battery Critical (<20%)', icon: BatteryWarning, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'PROLONGED_SAFE_WAIT':
        return { label: 'Safe Wait (≥15 ticks)', icon: Hourglass, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'ROUTE_UNAVAILABLE':
        return { label: 'Route Unavailable', icon: Route, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      case 'DEADLOCK_UNRESOLVED':
        return { label: 'Deadlock Unresolved', icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'ROBOT_OFFLINE':
        return { label: 'Robot Offline', icon: ShieldAlert, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
      default:
        return { label: reason, icon: Zap, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-wide flex items-center gap-2">
              Dynamic Task Reassignment
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Decentralized P2P
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Autonomous task migration upon health degradation with 0 task loss guarantee
            </p>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-xs text-slate-400 font-medium">Reassignments</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {metrics?.total_reassignments_triggered ?? 0}
          </div>
          <span className="text-[10px] text-slate-500">Triggered events</span>
        </div>

        <div className="bg-slate-950/60 border border-emerald-900/40 rounded-lg p-3">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Successful
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {metrics?.successful_reassignments ?? 0}
          </div>
          <span className="text-[10px] text-emerald-500/80">0 Task Loss</span>
        </div>

        <div className="bg-slate-950/60 border border-amber-900/40 rounded-lg p-3">
          <span className="text-xs text-amber-400 font-medium">Pending/Queued</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {metrics?.pending_reassignments ?? 0}
          </div>
          <span className="text-[10px] text-amber-500/80">Safe Queueing</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-xs text-slate-400 font-medium">Failed/Lost</span>
          <div className="text-2xl font-bold text-slate-400 mt-1">
            {metrics?.failed_reassignments ?? 0}
          </div>
          <span className="text-[10px] text-slate-500">0 Invariant</span>
        </div>
      </div>

      {/* Demonstration Scenarios */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Interactive Reassignment Scenarios
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={onTriggerScenarioA}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <BatteryWarning className="w-3.5 h-3.5" /> Scenario A
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-amber-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Battery Drop (R1→R2)</span>
            <span className="text-[10px] text-slate-400 mt-1">
              R1 drops to 14% &lt; 20% mid-route; R2 takes over at handoff.
            </span>
          </button>

          <button
            onClick={onTriggerScenarioB}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Hourglass className="w-3.5 h-3.5" /> Scenario B
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-purple-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Safe Wait Blockage (R1→R3)</span>
            <span className="text-[10px] text-slate-400 mt-1">
              R1 stuck in SAFE_WAIT for 15 ticks; peer R3 takes over.
            </span>
          </button>

          <button
            onClick={onTriggerScenarioC}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Scenario C
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Zero Eligible Fallback</span>
            <span className="text-[10px] text-slate-400 mt-1">
              All candidate peers low battery; task queued with 0 loss.
            </span>
          </button>
        </div>
      </div>

      {/* Live Reassignment History Ledger */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-400" /> Reassignment Ledger
          </span>
          <span className="text-[10px] text-slate-400">
            {metrics?.recent_events?.length ?? 0} events recorded
          </span>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Tick</th>
                <th className="py-2 px-3">Task (Ver)</th>
                <th className="py-2 px-3">Transfer</th>
                <th className="py-2 px-3">Trigger Reason</th>
                <th className="py-2 px-3">Cost</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {!metrics?.recent_events || metrics.recent_events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500 font-sans text-xs">
                    No task reassignments triggered yet. Trigger a scenario above to observe live P2P migration.
                  </td>
                </tr>
              ) : (
                metrics.recent_events.map((evt: TaskReassignmentEvent) => {
                  const reasonInfo = formatReason(evt.reason);
                  const ReasonIcon = reasonInfo.icon;
                  return (
                    <tr key={evt.event_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400">t={evt.timestamp_tick}</td>
                      <td className="py-2 px-3 font-semibold text-slate-200">
                        {evt.task_id}{' '}
                        <span className="text-[10px] text-indigo-400 font-normal">
                          v{evt.task_version}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-amber-400">{evt.original_robot}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        {evt.reassigned_robot ? (
                          <span className="text-emerald-400 font-bold">{evt.reassigned_robot}</span>
                        ) : (
                          <span className="text-slate-400 italic">Queue</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${reasonInfo.color}`}
                        >
                          <ReasonIcon className="w-2.5 h-2.5" />
                          {reasonInfo.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {evt.winning_bid_cost !== null && evt.winning_bid_cost !== undefined
                          ? evt.winning_bid_cost.toFixed(1)
                          : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {evt.status === 'REASSIGNED' ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            REASSIGNED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            QUEUED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
