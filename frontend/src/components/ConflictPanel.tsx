import React from 'react';
import { ShieldAlert, Zap, Clock, MapPin, Activity, CheckCircle2 } from 'lucide-react';
import { ConflictReport, ConflictEvent } from '../types/warehouse';

interface ConflictPanelProps {
  conflictReport?: ConflictReport;
  onTriggerDemo: () => void;
  onSelectCell?: (x: number, y: number) => void;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({
  conflictReport,
  onTriggerDemo,
  onSelectCell,
}) => {
  const total = conflictReport?.total_conflicts || 0;
  const conflicts = conflictReport?.conflicts || [];

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'VERTEX_CONFLICT':
        return 'VERTEX CONFLICT';
      case 'EDGE_CONFLICT':
        return 'EDGE HEAD-ON SWAP';
      case 'FOLLOWING_CONFLICT':
        return 'UNSAFE HEADWAY';
      case 'INTERSECTION_CONFLICT':
        return 'JUNCTION CONTENTION';
      default:
        return type.replace('_', ' ');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            total > 0 ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
          }`}>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm">
                SPATIO-TEMPORAL CONFLICT MONITOR
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                total > 0 ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {total > 0 ? `${total} ACTIVE CONFLICT${total > 1 ? 'S' : ''}` : 'NO CONFLICTS'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Multi-Agent Time-Space Trajectory Inspection
            </div>
          </div>
        </div>

        {/* Solver Stats */}
        {conflictReport && (
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-slate-400" />
              {conflictReport.detection_time_ms ? `${conflictReport.detection_time_ms.toFixed(2)}ms` : '<0.1ms'}
            </span>
            <span className="text-slate-300">|</span>
            <span>{conflictReport.pairs_examined} pairs</span>
          </div>
        )}
      </div>

      {/* Metrics Breakdown Bar */}
      <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
        <div className="rounded border border-rose-200 bg-rose-50/60 p-1.5">
          <div className="text-[9px] font-mono font-bold text-rose-700">VERTEX</div>
          <div className="text-sm font-mono font-black text-rose-900">
            {conflictReport?.vertex_conflicts ?? 0}
          </div>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50/60 p-1.5">
          <div className="text-[9px] font-mono font-bold text-amber-700">EDGE</div>
          <div className="text-sm font-mono font-black text-amber-900">
            {conflictReport?.edge_conflicts ?? 0}
          </div>
        </div>
        <div className="rounded border border-yellow-200 bg-yellow-50/60 p-1.5">
          <div className="text-[9px] font-mono font-bold text-yellow-700">FOLLOWING</div>
          <div className="text-sm font-mono font-black text-yellow-900">
            {conflictReport?.following_conflicts ?? 0}
          </div>
        </div>
        <div className="rounded border border-indigo-200 bg-indigo-50/60 p-1.5">
          <div className="text-[9px] font-mono font-bold text-indigo-700">JUNCTION</div>
          <div className="text-sm font-mono font-black text-indigo-900">
            {conflictReport?.intersection_conflicts ?? 0}
          </div>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
        {conflicts.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800 mb-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>All Projected Trajectories Clear</span>
            </div>
            <div className="text-[10px] text-emerald-600">
              No space-time collisions or headway violations detected along current A* paths.
            </div>
          </div>
        ) : (
          conflicts.map((conf: ConflictEvent, idx: number) => (
            <div
              key={conf.conflict_id || idx}
              onClick={() => {
                if (conf.cell && onSelectCell) {
                  onSelectCell(conf.cell[0], conf.cell[1]);
                }
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/90 hover:bg-slate-100/90 p-2.5 transition-colors cursor-pointer text-xs"
            >
              {/* Row 1: Index + Type + Severity */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {getTypeLabel(conf.type)}
                  </span>
                </div>
                <span className={`rounded border px-1.5 py-0.2 text-[9px] font-mono font-bold ${getSeverityBadge(conf.severity)}`}>
                  {conf.severity}
                </span>
              </div>

              {/* Row 2: Robots Involved + Location + Time */}
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="font-bold text-blue-600">{conf.robots[0]}</span>
                  <span className="text-slate-400">↔</span>
                  <span className="font-bold text-emerald-600">{conf.robots[1]}</span>
                </div>

                <div className="flex items-center gap-1 text-slate-600">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>
                    {conf.cell
                      ? `(${conf.cell[0]}, ${conf.cell[1]})`
                      : conf.from_cell && conf.to_cell
                      ? `(${conf.from_cell[0]},${conf.from_cell[1]})→(${conf.to_cell[0]},${conf.to_cell[1]})`
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1 text-slate-700 font-semibold">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span>T+{conf.time_step} ({conf.relative_time_s.toFixed(1)}s)</span>
                </div>
              </div>

              {/* Description Snippet */}
              <div className="mt-1 text-[10px] text-slate-500 font-sans truncate">
                {conf.description}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SIH Demonstration Scenario Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={onTriggerDemo}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 text-xs font-mono font-bold text-rose-800 transition-colors shadow-sm"
          title="Setup deterministic R1 & R2 crossing scenario at intersection (8,7)"
        >
          <Zap className="h-3.5 w-3.5 text-rose-600" />
          <span>TRIGGER SIH 2026 CONFLICT DEMO (R1 ⚡ R2 CROSSING)</span>
        </button>
      </div>
    </div>
  );
};
