import React from 'react';
import { Calendar, ShieldAlert, Lock, ArrowRight } from 'lucide-react';
import { ReservationSummary, Reservation } from '../types/warehouse';

interface ReservationPanelProps {
  reservations?: ReservationSummary;
  selectedRobotId: string | null;
  selectedReservation?: Reservation | null;
  onSelectRobot: (robotId: string | null) => void;
}

export const ReservationPanel: React.FC<ReservationPanelProps> = ({
  reservations,
  selectedRobotId,
  selectedReservation,
  onSelectRobot,
}) => {
  const totalActive = reservations?.total_active ?? 0;
  const totalConflicted = reservations?.total_conflicted ?? 0;
  const byRobot = reservations?.by_robot ?? {};
  const conflicts = reservations?.conflicts ?? [];

  const robotColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    R1: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', accent: '#2563eb' },
    R2: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', accent: '#059669' },
    R3: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', accent: '#7c3aed' },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            totalConflicted > 0 ? 'bg-amber-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
          }`}>
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm">
                SPATIO-TEMPORAL RESERVATION TABLE
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                totalConflicted > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {totalActive} ACTIVE · {totalConflicted} CONFLICTED
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Time-Indexed Cell & Edge Space-Time Allocation
            </div>
          </div>
        </div>
      </div>

      {/* Robot Trajectory Reservation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {['R1', 'R2', 'R3'].map((rid) => {
          const sum = byRobot[rid];
          const color = robotColors[rid] || { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', accent: '#334155' };
          const isSelected = selectedRobotId === rid;

          return (
            <div
              key={rid}
              onClick={() => onSelectRobot(isSelected ? null : rid)}
              className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-blue-500 shadow-md bg-white border-blue-300'
                  : `${color.bg} ${color.border} hover:shadow-sm`
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color.accent }}
                  />
                  <span className="font-mono font-bold text-xs text-slate-900">
                    AMR {rid}
                  </span>
                </div>
                {sum?.has_conflicts ? (
                  <span className="rounded bg-rose-100 text-rose-800 text-[8px] font-mono font-bold px-1 py-0.2">
                    CONFLICT
                  </span>
                ) : (
                  <span className="text-[8px] font-mono font-semibold text-slate-500">
                    LOCKED
                  </span>
                )}
              </div>

              <div className="space-y-0.5 text-[10px] font-mono text-slate-600">
                <div>Cells: <span className="font-bold text-slate-900">{sum?.cell_count ?? 0}</span> · Edges: <span className="font-bold text-slate-900">{sum?.edge_count ?? 0}</span></div>
                <div className="text-slate-500">
                  Window: <span className="font-semibold text-slate-700">T+{sum?.start_time ?? 0} → T+{sum?.end_time ?? 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reservation Conflict Alert Banner (If Any) */}
      {conflicts.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50/90 p-2.5 text-xs text-amber-950">
          <div className="flex items-center gap-1.5 font-mono font-bold text-amber-900 mb-1">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>RESERVATION CONFLICT DETECTED (NO SILENT OVERWRITE)</span>
          </div>
          <div className="space-y-1 text-[11px] font-mono text-amber-900">
            {conflicts.map((conf, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/70 rounded p-1.5 border border-amber-200">
                <span className="font-bold text-rose-700">{conf.requested_by}</span>
                <span className="text-slate-500">requested</span>
                <span className="font-semibold">{conf.resource_repr}</span>
                <span className="text-slate-400">at</span>
                <span className="font-semibold text-slate-700">T+{conf.requested_interval[0]}→T+{conf.requested_interval[1]}</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="text-slate-600">Blocked by <span className="font-bold text-blue-700">{conf.conflicting_robot}</span> ({conf.conflicting_reservation_id})</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-amber-700 font-sans flex items-center gap-1">
            <Lock className="h-3 w-3 text-amber-600" />
            <span>Safety Rule Active: Existing reservations are protected from being overwritten.</span>
          </div>
        </div>
      )}

      {/* Reservation Inspector (When Selected) */}
      {selectedReservation && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 text-xs">
          <div className="flex items-center justify-between mb-1 font-mono font-bold text-blue-900 text-[11px]">
            <span>INSPECTED RESERVATION: {selectedReservation.reservation_id}</span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] ${
              selectedReservation.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {selectedReservation.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-700">
            <div>Owner: <span className="font-bold text-blue-700">{selectedReservation.robot_id}</span></div>
            <div>Type: <span className="font-semibold">{selectedReservation.resource_type}</span></div>
            <div>Window: <span className="font-semibold">T+{selectedReservation.start_time} → T+{selectedReservation.end_time}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
