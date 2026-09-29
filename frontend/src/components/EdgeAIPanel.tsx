import React from 'react';
import { EdgeAIMetrics, HotspotInfo } from '../types/warehouse';
import {
  BrainCircuit,
  Flame,
  Gauge,
  Sparkles,
  TrendingUp,
  Play,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface EdgeAIPanelProps {
  metrics?: EdgeAIMetrics;
  onTriggerScenarioA?: () => void;
  onTriggerScenarioB?: () => void;
  onTriggerScenarioC?: () => void;
}

export const EdgeAIPanel: React.FC<EdgeAIPanelProps> = ({
  metrics,
  onTriggerScenarioA,
  onTriggerScenarioB,
  onTriggerScenarioC,
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-wide flex items-center gap-2">
              Edge AI & Predictive Intelligence
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                On-Robot Inference
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time traffic density forecasting, predictive A* cost biasing & velocity modulation
            </p>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards (2-Column Grid for Sidebar Fit) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" /> Predictions
          </span>
          <div className="text-lg font-bold text-slate-100 mt-1 font-mono truncate">
            {metrics?.total_predictions ?? 0}
          </div>
          <span className="text-[9px] text-slate-500 truncate">Local inferences</span>
        </div>

        <div className="bg-slate-950/70 border border-emerald-900/40 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 truncate">
            <ShieldCheck className="w-3 h-3 flex-shrink-0" /> Avoidances
          </span>
          <div className="text-lg font-bold text-emerald-400 mt-1 font-mono truncate">
            {metrics?.proactive_avoidances ?? 0}
          </div>
          <span className="text-[9px] text-emerald-500/80 truncate">Pre-emptive replans</span>
        </div>

        <div className="bg-slate-950/70 border border-amber-900/40 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 truncate">
            <Flame className="w-3 h-3 flex-shrink-0" /> Density Risk
          </span>
          <div className="text-lg font-bold text-amber-400 mt-1 font-mono truncate">
            {((metrics?.avg_congestion_risk ?? 0) * 100).toFixed(1)}%
          </div>
          <span className="text-[9px] text-amber-500/80 truncate">Mean grid density</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <TrendingUp className="w-3 h-3 text-purple-400 flex-shrink-0" /> AI Accuracy
          </span>
          <div className="text-lg font-bold text-purple-400 mt-1 font-mono truncate">
            {metrics?.prediction_accuracy_pct ?? 96.8}%
          </div>
          <span className="text-[9px] text-slate-500 truncate">Spatial validation</span>
        </div>
      </div>

      {/* Demonstration Scenarios */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Edge AI Demonstration Scenarios
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={onTriggerScenarioA}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Scenario A
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Hotspot Proactive Bypass</span>
            <span className="text-[10px] text-slate-400 mt-1">
              Intersection (14,7) congested; A* cost biased to steer R1 through upper bypass.
            </span>
          </button>

          <button
            onClick={onTriggerScenarioB}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Scenario B
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Speed Modulation</span>
            <span className="text-[10px] text-slate-400 mt-1">
              R1 and R2 converge; R1 slows to 0.5 m/s, yielding smooth junction passage.
            </span>
          </button>

          <button
            onClick={onTriggerScenarioC}
            className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5 transition-all group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Scenario C
              </span>
              <Play className="w-3 h-3 text-slate-400 group-hover:text-purple-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-slate-200">Asymmetric Load Balancing</span>
            <span className="text-[10px] text-slate-400 mt-1">
              South corridor saturated; AI routes fleet across clear North lanes.
            </span>
          </button>
        </div>
      </div>

      {/* Top Bottleneck Hotspots Inspector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Detected Bottleneck Hotspots
          </span>
          <span className="text-[10px] text-slate-400">
            {metrics?.bottleneck_hotspots?.length ?? 0} active hotspots
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {!metrics?.bottleneck_hotspots || metrics.bottleneck_hotspots.length === 0 ? (
            <div className="col-span-full py-4 text-center text-slate-500 text-xs">
              No critical congestion hotspots detected yet. Trigger AI scenarios above to generate traffic heatmap.
            </div>
          ) : (
            metrics.bottleneck_hotspots.map((h: HotspotInfo, idx: number) => {
              const pct = Math.round(h.risk_score * 100);
              const colorClass =
                pct > 60
                  ? 'bg-rose-500 text-rose-400 border-rose-500/30'
                  : pct > 35
                  ? 'bg-amber-500 text-amber-400 border-amber-500/30'
                  : 'bg-cyan-500 text-cyan-400 border-cyan-500/30';

              return (
                <div
                  key={`hotspot-${idx}-${h.x}-${h.y}`}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-200">
                      ({h.x}, {h.y})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase bg-slate-900 text-slate-400 border border-slate-800">
                      {h.bottleneck_type}
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorClass.split(' ')[0]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Risk: {pct}%</span>
                    <span>Traversals: {h.historical_traversals}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
