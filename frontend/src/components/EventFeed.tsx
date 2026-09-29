import React from 'react';
import { Radio, AlertTriangle, CheckCircle2, Info, Flame } from 'lucide-react';
import { LogEvent } from '../types/warehouse';

interface EventFeedProps {
  events: LogEvent[];
}

export const EventFeed: React.FC<EventFeedProps> = ({ events }) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'success':
        return {
          icon: <CheckCircle2 className="h-3 w-3 text-emerald-600" />,
          border: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-3 w-3 text-amber-600" />,
          border: 'border-amber-200 bg-amber-50/80 text-amber-900',
        };
      case 'critical':
        return {
          icon: <Flame className="h-3 w-3 text-rose-600" />,
          border: 'border-rose-200 bg-rose-50/80 text-rose-900',
        };
      default:
        return {
          icon: <Info className="h-3 w-3 text-blue-600" />,
          border: 'border-slate-200 bg-slate-50 text-slate-800',
        };
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm select-none">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            Live Telemetry Feed
          </h2>
        </div>
        <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">
          STREAMING
        </span>
      </div>

      {/* Scrollable event list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[500px]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Radio className="h-6 w-6 text-slate-300 mb-2" />
            <span className="text-xs font-mono font-medium text-slate-500">Telemetry feed active</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Awaiting state transitions...</span>
          </div>
        ) : (
          events.map((evt) => {
            const style = getSeverityBadge(evt.severity);
            return (
              <div
                key={evt.id}
                className={`rounded-lg border p-2 text-xs transition-all ${style.border}`}
              >
                <div className="flex items-center justify-between gap-1 mb-1 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {style.icon}
                    <span className="font-bold uppercase tracking-wider">{evt.category}</span>
                  </div>
                  <span className="text-slate-400 font-medium">{evt.timestamp}</span>
                </div>
                <div className="text-[11px] font-medium leading-tight text-slate-800">
                  {evt.message}
                </div>
                {evt.details && (
                  <div className="mt-1 text-[10px] text-slate-500 font-mono bg-white/70 border border-slate-200/60 px-1.5 py-0.5 rounded">
                    {evt.details}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
