import React, { useState } from 'react';
import {
  TaskAllocationMetrics,
  WarehouseTask,
  RobotInfo,
  TaskPriority,
  TaskStatus,
  TaskEligibilityStatus,
  TaskBid,
} from '../types/warehouse';

interface TaskAllocationPanelProps {
  taskAllocation?: TaskAllocationMetrics;
  tasks?: WarehouseTask[];
  robots: RobotInfo[];
  onTriggerScenarioA: () => void;
  onTriggerScenarioB: () => void;
  onTriggerScenarioC: () => void;
  onTriggerScenarioD: () => void;
  onTriggerScenarioE: () => void;
  onResetTasks: () => void;
}

export const TaskAllocationPanel: React.FC<TaskAllocationPanelProps> = ({
  taskAllocation,
  tasks = [],
  robots = [],
  onTriggerScenarioA,
  onTriggerScenarioB,
  onTriggerScenarioC,
  onTriggerScenarioD,
  onTriggerScenarioE,
  onResetTasks,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const totalAnnounced = taskAllocation?.total_tasks_announced || tasks.length;
  const totalAllocated = taskAllocation?.total_tasks_allocated || tasks.filter((t) => ['ALLOCATED', 'EXECUTING', 'COMPLETED'].includes(t.status)).length;
  const totalCompleted = taskAllocation?.total_tasks_completed || tasks.filter((t) => t.status === 'COMPLETED').length;
  const avgWinningBid = taskAllocation?.average_winning_bid || 0;
  const avgBidsPerTask = taskAllocation?.average_bids_per_task || 0;

  const selectedTask = tasks.find((t) => t.task_id === selectedTaskId) || tasks[0] || null;

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">HIGH</span>;
      case 'NORMAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">NORMAL</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{priority}</span>;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">&check; COMPLETED</span>;
      case 'EXECUTING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">&rArr; EXECUTING</span>;
      case 'ALLOCATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">ALLOCATED</span>;
      case 'BIDDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">BIDDING</span>;
      case 'ANNOUNCED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800 border border-cyan-300">ANNOUNCED</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getEligibilityBadge = (elig: TaskEligibilityStatus, isValid: boolean) => {
    if (elig === 'ELIGIBLE' && isValid) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">ELIGIBLE</span>;
    }
    switch (elig) {
      case 'INELIGIBLE_LOW_BATTERY':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">LOW BATTERY (&lt;20%)</span>;
      case 'INELIGIBLE_BUSY':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">BUSY</span>;
      case 'INELIGIBLE_NO_SAFE_ROUTE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">NO SAFE ROUTE</span>;
      case 'INELIGIBLE_PAYLOAD_CAPACITY':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">PAYLOAD OVERLOAD</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">{elig}</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
            Distributed Dynamic Task Allocation
          </h3>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono font-medium border border-indigo-200">
            P2P Auction & Multi-Criteria Bidding
          </span>
        </div>

        {/* Demo Scenario Triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onTriggerScenarioA}
            className="px-2.5 py-1 text-xs font-medium bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors"
            title="Standard bidding for T01 (R1 closest to PK-01 wins)"
          >
            Scenario A: Normal
          </button>
          <button
            onClick={onTriggerScenarioB}
            className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded transition-colors"
            title="R1 battery set to 18% -> rejected; R2 awarded T01"
          >
            Scenario B: Low Battery
          </button>
          <button
            onClick={onTriggerScenarioC}
            className="px-2.5 py-1 text-xs font-medium bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
            title="PK-01 blocked -> R1 ineligible due to no safe route"
          >
            Scenario C: Blocked Route
          </button>
          <button
            onClick={onTriggerScenarioD}
            className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded transition-colors"
            title="R1 and R2 equidistant -> Tie-breaker selects R1"
          >
            Scenario D: Tie-Breaker
          </button>
          <button
            onClick={onTriggerScenarioE}
            className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
            title="Announces 6 tasks across R1, R2, R3 fleet"
          >
            Scenario E: 6-Task Batch
          </button>
          <button
            onClick={onResetTasks}
            className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
            title="Reset default tasks"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50/50 border-b border-slate-200">
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Tasks Announced
          </div>
          <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
            {totalAnnounced}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Tasks Allocated
          </div>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">
            {totalAllocated}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Tasks Completed
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
            {totalCompleted}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Avg Winning Cost
          </div>
          <div className="text-xl font-bold font-mono text-cyan-600 mt-0.5">
            {avgWinningBid > 0 ? avgWinningBid.toFixed(1) : '—'}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Avg Bids / Task
          </div>
          <div className="text-xl font-bold font-mono text-purple-600 mt-0.5">
            {avgBidsPerTask > 0 ? avgBidsPerTask.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      {/* Main Grid: Task Queue / Table + Live Bidding Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* Task List Table (7 cols) */}
        <div className="lg:col-span-7">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Decentralized Task Ledger</span>
            <span className="text-[11px] font-normal text-slate-500 font-mono">
              {tasks.length} tasks registered
            </span>
          </h4>

          {tasks.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded p-6 text-center text-xs text-slate-500 bg-slate-50/50">
              No tasks currently announced. Use Scenario buttons above to generate task bidding.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Task</th>
                    <th className="py-2 px-2">Route</th>
                    <th className="py-2 px-2">Priority</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Assigned</th>
                    <th className="py-2 px-2">Win Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {tasks.map((t) => {
                    const isSelected = selectedTask?.task_id === t.task_id;
                    return (
                      <tr
                        key={t.task_id}
                        onClick={() => setSelectedTaskId(t.task_id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/80 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-800">{t.task_id}</div>
                          <div className="text-[10px] text-slate-500">{t.task_name}</div>
                        </td>
                        <td className="py-2 px-2 text-[11px]">
                          <span className="text-indigo-600 font-bold">{t.pickup_label}</span>
                          <span className="text-slate-400 mx-1">&rarr;</span>
                          <span className="text-emerald-600 font-bold">{t.destination_label}</span>
                        </td>
                        <td className="py-2 px-2">{getPriorityBadge(t.priority)}</td>
                        <td className="py-2 px-2">{getStatusBadge(t.status)}</td>
                        <td className="py-2 px-2 font-bold text-indigo-700">
                          {t.assigned_robot ? (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    robots.find((r) => r.robot_id === t.assigned_robot)?.color_accent || '#2563eb',
                                }}
                              />
                              {t.assigned_robot}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-slate-700">
                          {t.winning_bid_cost !== null && t.winning_bid_cost !== undefined
                            ? t.winning_bid_cost.toFixed(1)
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Task Bid Breakdown & Robot Workloads (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Task Details */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Bidding Transparency Matrix</span>
              {selectedTask && (
                <span className="font-mono text-indigo-600 text-[11px]">
                  Task {selectedTask.task_id}
                </span>
              )}
            </h4>

            {selectedTask ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 flex items-center justify-between pb-2 border-b border-slate-200">
                  <span>
                    Pickup: <b>{selectedTask.pickup_label}</b> ({selectedTask.pickup_location[0]},{' '}
                    {selectedTask.pickup_location[1]})
                  </span>
                  <span>
                    Dropoff: <b>{selectedTask.destination_label}</b> ({selectedTask.destination[0]},{' '}
                    {selectedTask.destination[1]})
                  </span>
                </div>

                {/* Bids List */}
                <div className="space-y-2">
                  {Object.keys(selectedTask.bids || {}).length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2 text-center">
                      No bids submitted yet for this task.
                    </div>
                  ) : (
                    Object.values(selectedTask.bids).map((bid: TaskBid) => {
                      const isWinner = selectedTask.assigned_robot === bid.robot_id;
                      const robotObj = robots.find((r) => r.robot_id === bid.robot_id);

                      return (
                        <div
                          key={bid.robot_id}
                          className={`p-2 rounded border text-xs ${
                            isWinner
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 font-bold font-mono text-slate-800">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: robotObj?.color_accent || '#2563eb' }}
                              />
                              {bid.robot_id}
                              {isWinner && (
                                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded uppercase">
                                  Winner
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getEligibilityBadge(bid.eligibility_status || bid.eligibility || 'ELIGIBLE', bid.is_valid ?? true)}
                              <span className="font-mono font-bold text-slate-800">
                                {bid.is_valid !== false ? `${bid.bid_cost.toFixed(1)} pts` : 'REJECT'}
                              </span>
                            </div>
                          </div>

                          {bid.is_valid !== false && (bid.breakdown || bid.bid_breakdown) ? (
                            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-600 mt-1.5 bg-slate-50 p-1.5 rounded border border-slate-200/60">
                              <div>
                                <span className="text-slate-400 block">Pickup D:</span>
                                {(bid.breakdown?.travel_to_pickup_cost ?? bid.breakdown?.pickup_distance_cost ?? bid.bid_breakdown?.pickup_distance_cost ?? 0).toFixed(1)}
                              </div>
                              <div>
                                <span className="text-slate-400 block">Dropoff D:</span>
                                {(bid.breakdown?.pickup_to_destination_cost ?? bid.breakdown?.travel_time_cost ?? bid.bid_breakdown?.travel_time_cost ?? 0).toFixed(1)}
                              </div>
                              <div>
                                <span className="text-slate-400 block">Battery P:</span>
                                {((bid.breakdown?.battery_penalty ?? bid.bid_breakdown?.battery_penalty ?? 0) > 0)
                                  ? `+${(bid.breakdown?.battery_penalty ?? bid.bid_breakdown?.battery_penalty ?? 0).toFixed(1)}`
                                  : '0.0'}
                              </div>
                              <div>
                                <span className="text-slate-400 block">Workload P:</span>
                                {((bid.breakdown?.workload_penalty ?? bid.breakdown?.workload_cost ?? bid.bid_breakdown?.workload_cost ?? 0) > 0)
                                  ? `+${(bid.breakdown?.workload_penalty ?? bid.breakdown?.workload_cost ?? bid.bid_breakdown?.workload_cost ?? 0).toFixed(1)}`
                                  : '0.0'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-rose-600 font-mono mt-1">
                              Reason: {bid.reject_reason || bid.ineligibility_reason || bid.eligibility_status || bid.eligibility}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-4 text-center">
                Select a task to inspect P2P bids.
              </div>
            )}
          </div>

          {/* Robot Task Distribution */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              AMR Active Mission Status
            </h4>
            <div className="space-y-1.5">
              {robots.map((r) => {
                const completedCount = tasks.filter(
                  (t) => t.assigned_robot === r.robot_id && t.status === 'COMPLETED'
                ).length;

                return (
                  <div
                    key={r.robot_id}
                    className="bg-white p-2 rounded border border-slate-200 text-xs flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color_accent || '#2563eb' }}
                      />
                      <span className="font-bold font-mono text-slate-800">{r.robot_id}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Battery: {r.battery.toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {r.assigned_task ? (
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          Task {r.assigned_task} ({r.task_stage || 'EN ROUTE'})
                        </span>
                      ) : (
                        <span className="text-slate-400">IDLE (0 active)</span>
                      )}
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {completedCount} done
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
