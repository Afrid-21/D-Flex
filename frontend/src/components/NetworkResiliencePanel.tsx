import React, { useState } from 'react';
import { NetworkResilienceMetrics } from '../types/warehouse';
import {
  Wifi,
  WifiOff,
  Activity,
  Radio,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Play,
  Share2,
} from 'lucide-react';

interface NetworkResiliencePanelProps {
  metrics?: NetworkResilienceMetrics;
  onSetFaults?: (params: { packet_loss_rate_pct?: number; simulated_latency_ms?: number; isolated_nodes?: string[] }) => void;
  onTriggerScenarioA?: () => void;
  onTriggerScenarioB?: () => void;
  onTriggerScenarioC?: () => void;
}

export const NetworkResiliencePanel: React.FC<NetworkResiliencePanelProps> = ({
  metrics,
  onSetFaults,
  onTriggerScenarioA,
  onTriggerScenarioB,
  onTriggerScenarioC,
}) => {
  const [loss, setLoss] = useState<number>(metrics?.packet_loss_rate_pct || 0);
  const [latency, setLatency] = useState<number>(metrics?.simulated_latency_ms || 0);

  const handleApplyFaults = () => {
    if (onSetFaults) {
      onSetFaults({
        packet_loss_rate_pct: loss,
        simulated_latency_ms: latency,
      });
    }
  };

  const handleResetFaults = () => {
    setLoss(0);
    setLatency(0);
    if (onSetFaults) {
      onSetFaults({
        packet_loss_rate_pct: 0,
        simulated_latency_ms: 0,
        isolated_nodes: [],
      });
    }
  };

  const healthColor =
    metrics?.network_health === 'OPTIMAL'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : metrics?.network_health === 'DEGRADED'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Wifi className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-wide flex items-center gap-2">
              Network Fault Tolerance & Communication Resilience
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${healthColor}`}>
                {metrics?.network_health || 'OPTIMAL'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Packet loss simulation, jitter tolerance, partition blackout recovery & anti-entropy gossip sync
            </p>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards (2-Column Grid for Sidebar Fit) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <Radio className="w-3 h-3 text-indigo-400 flex-shrink-0" /> Routed P2P
          </span>
          <div className="text-lg font-bold text-slate-100 mt-1 font-mono truncate">
            {metrics?.delivered_messages_count ?? 0}/{metrics?.total_messages_attempted ?? 0}
          </div>
          <span className="text-[9px] text-slate-500 truncate">Delivered/Attempted</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <WifiOff className="w-3 h-3 text-rose-400 flex-shrink-0" /> Dropped Loss
          </span>
          <div className="text-lg font-bold text-rose-400 mt-1 font-mono truncate">
            {metrics?.dropped_messages_count ?? 0}
          </div>
          <span className="text-[9px] text-slate-500 truncate">Fault Injection Loss</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <RefreshCw className="w-3 h-3 text-amber-400 flex-shrink-0" /> Retries / Gossip
          </span>
          <div className="text-lg font-bold text-amber-400 mt-1 font-mono truncate">
            {metrics?.retransmissions_count ?? 0} / {metrics?.gossip_sync_events ?? 0}
          </div>
          <span className="text-[9px] text-slate-500 truncate">Anti-Entropy Sync</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
            <ShieldAlert className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Safe Fallbacks
          </span>
          <div className="text-lg font-bold text-emerald-400 mt-1 font-mono truncate">
            {metrics?.safety_fallbacks_triggered ?? 0}
          </div>
          <span className="text-[9px] text-slate-500 truncate">Zero Collision Failsafe</span>
        </div>
      </div>

      {/* Network Fault Controls */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Live Fault Injector
          </span>
          <button
            onClick={handleResetFaults}
            className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors"
          >
            Reset Faults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Packet Loss Rate:</span>
              <span className="font-mono text-indigo-400">{loss}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={loss}
              onChange={(e) => setLoss(Number(e.target.value))}
              onMouseUp={handleApplyFaults}
              onTouchEnd={handleApplyFaults}
              className="accent-indigo-500 cursor-pointer w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Simulated Latency:</span>
              <span className="font-mono text-indigo-400">{latency} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="25"
              value={latency}
              onChange={(e) => setLatency(Number(e.target.value))}
              onMouseUp={handleApplyFaults}
              onTouchEnd={handleApplyFaults}
              className="accent-indigo-500 cursor-pointer w-full"
            />
          </div>
        </div>

        {metrics?.isolated_nodes && metrics.isolated_nodes.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>
              Isolated Nodes (Blackout Partition): <strong>{metrics.isolated_nodes.join(', ')}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Scenarios */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" /> Resilience Demonstration Scenarios
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={onTriggerScenarioA}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all group text-left"
          >
            <Play className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            <div>
              <div className="font-semibold">Scenario A: 30% Loss</div>
              <div className="text-[10px] text-slate-400">Jitter + Retransmission</div>
            </div>
          </button>

          <button
            onClick={onTriggerScenarioB}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all group text-left"
          >
            <Play className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            <div>
              <div className="font-semibold">Scenario B: R3 Partition</div>
              <div className="text-[10px] text-slate-400">Safe Wait + Gossip Sync</div>
            </div>
          </button>

          <button
            onClick={onTriggerScenarioC}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all group text-left"
          >
            <Share2 className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            <div>
              <div className="font-semibold">Scenario C: Multi-Hop</div>
              <div className="text-[10px] text-slate-400">Asymmetric Relay Mesh</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
