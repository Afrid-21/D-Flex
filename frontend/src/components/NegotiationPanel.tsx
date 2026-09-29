import React from 'react';
import { NegotiationSession } from '../types/warehouse';
import { Handshake, ShieldCheck, Clock } from 'lucide-react';

interface NegotiationPanelProps {
  negotiations?: NegotiationSession[];
  onSelectCell?: (x: number, y: number) => void;
}

export const NegotiationPanel: React.FC<NegotiationPanelProps> = ({
  negotiations = [],
  onSelectCell,
}) => {
  const getStateBadge = (state: string) => {
    switch (state) {
      case 'RESOLVED':
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60';
      case 'PROPOSED':
      case 'OFFER_RECEIVED':
      case 'WAITING_RESPONSE':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60 animate-pulse';
      case 'DECLINED':
      case 'TIMEOUT':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };


  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Handshake className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wide uppercase">
            Active Negotiations
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
            {negotiations.length} SESSIONS
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
        {negotiations.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            <span>No active conflicts under negotiation. Fleet schedules nominal.</span>
          </div>
        ) : (
          negotiations.map((session) => {
            const p1 = session.participants[0] || 'R1';
            const p2 = session.participants[1] || 'R2';
            const cellCoord = session.cell ? `(${session.cell[0]}, ${session.cell[1]})` : null;
            const requestedWindow = session.proposal?.requested_time_window
              ? `T+${session.proposal.requested_time_window[0]} → T+${session.proposal.requested_time_window[1]}`
              : null;
            const proposedWindow = session.proposal?.proposed_time_window
              ? `T+${session.proposal.proposed_time_window[0]} → T+${session.proposal.proposed_time_window[1]}`
              : null;

            return (
              <div
                key={session.session_id}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs flex flex-col gap-1.5"
              >
                {/* Session Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    <span className="text-blue-600 dark:text-blue-400">{p1}</span>
                    <span className="text-slate-400 font-normal">↔</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{p2}</span>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getStateBadge(
                      session.current_state
                    )}`}
                  >
                    {session.current_state}
                  </span>
                </div>

                {/* Resource Info */}
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  <div>
                    Conflict:{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {session.resource_type} {cellCoord}
                    </span>
                  </div>
                  {session.cell && (
                    <button
                      onClick={() => onSelectCell && onSelectCell(session.cell![0], session.cell![1])}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Locate
                    </button>
                  )}
                </div>

                {/* Time Shift Flow */}
                <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-mono text-slate-500 space-y-0.5">
                  {requestedWindow && (
                    <div className="flex items-center gap-1">
                      <span>Original Slot:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {requestedWindow}
                      </span>
                    </div>
                  )}
                  {proposedWindow && (
                    <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-semibold">
                      <Clock className="w-3 h-3" />
                      <span>Shift Proposal:</span>
                      <span>{proposedWindow}</span>
                      {session.proposal?.shift_ticks ? (
                        <span className="text-[9px] px-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                          +{session.proposal.shift_ticks}t
                        </span>
                      ) : null}
                    </div>
                  )}
                  {session.resolution && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-sans italic pt-0.5">
                      ✓ {session.resolution}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
