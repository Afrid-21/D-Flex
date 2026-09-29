import React from 'react';
import { DemoOrchestratorMetrics } from '../types/warehouse';
import {
  Rocket,
  CheckCircle2,
  Clock,
  Play,
  Layers,
  Sparkles,
} from 'lucide-react';

interface DemoOrchestratorPanelProps {
  demo?: DemoOrchestratorMetrics;
  onLaunchDemo?: () => void;
}

export const DemoOrchestratorPanel: React.FC<DemoOrchestratorPanelProps> = ({
  demo,
  onLaunchDemo,
}) => {
  const progress = demo?.progress_pct ?? 0;

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-cyan-500/30 rounded-xl p-4 shadow-2xl flex flex-col gap-3.5 text-slate-100 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex-shrink-0">
            <Rocket className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-semibold text-sm tracking-wide text-slate-100">
                Autonomous Mission Orchestrator
              </h3>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-2.5 h-2.5" /> 6-Step Mission
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              Continuous multi-agent mission linking task bidding, 4D reservations, negotiation & AI
            </p>
          </div>
        </div>

        <button
          onClick={onLaunchDemo}
          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/20 cursor-pointer self-end sm:self-auto flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          Launch Mission Sequence
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            Current Step: <strong className="text-slate-200">{demo?.active_stage_title || 'Ready'}</strong>
          </span>
          <span className="font-mono text-cyan-400 font-bold">{progress}% Complete</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 6-Stage Timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {demo?.stages && demo.stages.length > 0 ? (
          demo.stages.map((stage) => {
            const isStageActive = stage.status === 'ACTIVE';
            const isStageDone = stage.status === 'COMPLETED';

            return (
              <div
                key={stage.stage_number}
                className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 transition-all ${
                  isStageActive
                    ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                    : isStageDone
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    {isStageDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isStageActive ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    Step {stage.stage_number}: {stage.title}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isStageDone
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isStageActive
                        ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {stage.status}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400 font-mono">{stage.subsystem}</div>
                <p className="text-[11px] text-slate-400 line-clamp-2">{stage.description}</p>
              </div>
            );
          })
        ) : null}
      </div>
    </div>
  );
};
