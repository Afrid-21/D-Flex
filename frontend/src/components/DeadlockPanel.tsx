import React from 'react';
import { DeadlockSummary, RobotInfo, DeadlockCycle, DeadlockDependency } from '../types/warehouse';

interface DeadlockPanelProps {
  deadlocks?: DeadlockSummary;
  robots: RobotInfo[];
  onTrigger2RobotDemo: () => void;
  onTrigger3RobotDemo: () => void;
  onResolveDeadlock: () => void;
}

export const DeadlockPanel: React.FC<DeadlockPanelProps> = ({
  deadlocks,
  robots,
  onTrigger2RobotDemo,
  onTrigger3RobotDemo,
  onResolveDeadlock,
}) => {
  const activeCycles = deadlocks?.active_cycles || [];
  const activeDependencies = deadlocks?.active_dependencies || [];
  const totalDeadlocks = deadlocks?.total_deadlocks || 0;
  const recoveredCount = deadlocks?.recovered_count || 0;
  const hasActiveCycles = activeCycles.length > 0;

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'CYCLE_DETECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-1.5" />
            CYCLE DETECTED
          </span>
        );
      case 'RECOVERY_PROPOSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            RECOVERY PROPOSED
          </span>
        );
      case 'RECOVERY_ACCEPTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
            RECOVERY ACCEPTED
          </span>
        );
      case 'RECOVERED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            RECOVERED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {state}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
            Distributed Deadlock Monitor (WFG)
          </h3>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-medium">
            Tarjan / DFS Cycle Detection
          </span>
        </div>

        {/* Demo Trigger Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTrigger2RobotDemo}
            className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
            title="Sets up head-on mutual blocking between R1 and R2"
          >
            2-Robot Deadlock Demo
          </button>
          <button
            onClick={onTrigger3RobotDemo}
            className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded transition-colors"
            title="Sets up 3-way circular crossing deadlock (R1 -> R2 -> R3 -> R1)"
          >
            3-Robot Deadlock Demo
          </button>
          <button
            onClick={onResolveDeadlock}
            disabled={!hasActiveCycles}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
              hasActiveCycles
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Execute P2P Recovery
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50/50 border-b border-slate-200">
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Deadlocks
          </div>
          <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            {totalDeadlocks}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Cycles
          </div>
          <div className={`text-xl font-bold font-mono mt-0.5 ${hasActiveCycles ? 'text-rose-600' : 'text-slate-800'}`}>
            {activeCycles.length}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            WFG Dependencies
          </div>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">
            {activeDependencies.length}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Recovered Cycles
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
            {recoveredCount}
          </div>
        </div>
      </div>

      {/* Main Grid: Active Cycles + WFG Edge Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Active Cycles Section */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Detected Deadlock Cycles</span>
            <span className="text-[11px] font-normal text-slate-500">
              Autonomous Mesh Resolution
            </span>
          </h4>

          {activeCycles.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded p-6 text-center text-xs text-slate-500 bg-slate-50/50">
              No circular deadlocks detected. All AMR trajectories acyclic and collision-free.
            </div>
          ) : (
            <div className="space-y-3">
              {activeCycles.map((cycle: DeadlockCycle) => (
                <div
                  key={cycle.cycle_id}
                  className="border border-rose-200 bg-rose-50/40 rounded-lg p-3 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-rose-900">
                        {cycle.cycle_id}
                      </span>
                      {getStateBadge(cycle.state)}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      Tick #{cycle.detected_at_tick}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-700">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-slate-500 font-semibold">Cycle Chain:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-200 text-rose-700 font-bold">
                        {cycle.robots_in_cycle.join(' → ')} → {cycle.robots_in_cycle[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-semibold">Yielding Agent:</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        {cycle.yielding_robot}
                      </span>
                      <span className="text-slate-500">
                        (Action: <strong className="text-slate-700 font-mono">+{cycle.shift_ticks}t {cycle.recovery_action || 'TIME_SHIFT'}</strong>)
                      </span>
                    </div>

                    {cycle.resolution && (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium">
                        Resolution: {cycle.resolution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wait-For Graph (WFG) Dependencies */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Wait-For Graph (WFG) Active Edges</span>
            <span className="font-mono text-[11px] text-slate-500">
              Edge: A (Waiting) → B (Blocking)
            </span>
          </h4>

          {activeDependencies.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded p-6 text-center text-xs text-slate-500 bg-slate-50/50">
              WFG is empty. No blocked resource dependencies currently registered.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Waiting</th>
                    <th className="py-2 px-3">Blocking</th>
                    <th className="py-2 px-3">Resource</th>
                    <th className="py-2 px-3">Window</th>
                    <th className="py-2 px-3">Tick</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {activeDependencies.map((dep: DeadlockDependency, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-indigo-700">{dep.waiting_robot}</td>
                      <td className="py-1.5 px-3 font-bold text-rose-700">{dep.blocking_robot}</td>
                      <td className="py-1.5 px-3 text-slate-700">
                        {dep.cell ? `(${dep.cell[0]},${dep.cell[1]})` : 'EDGE'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        [{dep.time_window[0]}-{dep.time_window[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">#{dep.detected_at_tick}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Per-Robot Deadlock Health Cards */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Decentralized Agent Deadlock Health
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {robots.map((r: RobotInfo) => (
            <div
              key={r.robot_id}
              className="bg-white p-2.5 rounded border border-slate-200 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: r.color_accent || '#2563eb' }}
                />
                <span className="font-bold font-mono text-slate-800">{r.robot_id}</span>
                {r.is_yielding && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold border border-amber-200">
                    YIELDING
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px]">
                {getStateBadge(r.deadlock_state || 'NO_DEADLOCK')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
