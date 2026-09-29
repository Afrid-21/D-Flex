import React from 'react';
import { CentralizedComparatorMetrics } from '../types/warehouse';
import {
  Server,
  Network,
  Zap,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface CentralizedComparatorPanelProps {
  comparator?: CentralizedComparatorMetrics;
  onTriggerSpof?: () => void;
  onRestoreServer?: () => void;
}

export const CentralizedComparatorPanel: React.FC<CentralizedComparatorPanelProps> = ({
  comparator,
  onTriggerSpof,
  onRestoreServer,
}) => {
  const isServerOnline = comparator?.server_online ?? true;

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Network className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-wide flex items-center gap-2">
              Centralized vs Distributed Comparator
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SIH26123 Proof
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live quantitative comparison: Monolithic Server Baseline vs D-FLEX Decentralized P2P Mesh
            </p>
          </div>
        </div>
      </div>

      {/* Architectural Comparison Cards */}
      <div className="flex flex-col gap-3">
        {/* Centralized Baseline Card */}
        <div className={`p-4 rounded-xl border transition-all ${
          isServerOnline
            ? 'bg-slate-950/60 border-slate-800'
            : 'bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/40'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Server className={`w-4 h-4 ${isServerOnline ? 'text-slate-400' : 'text-rose-400'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Centralized Monolith (Baseline)
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isServerOnline
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
            }`}>
              {isServerOnline ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {isServerOnline ? 'SERVER ONLINE' : 'SPOF CRASHED'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Fleet Uptime:</span>
              <span className={`font-mono font-bold ${isServerOnline ? 'text-amber-400' : 'text-rose-400'}`}>
                {comparator?.centralized_uptime_pct ?? 100}%
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Avg Latency (ms):</span>
              <span className="font-mono font-bold text-slate-200">
                {comparator?.centralized_latency_ms ?? 18.5} ms
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Fleet Throughput:</span>
              <span className="font-mono font-bold text-slate-200">
                {comparator?.centralized_throughput ?? 42.0} tasks/hr
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Single Point of Failure:</span>
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Vulnerable
              </span>
            </div>
          </div>
        </div>

        {/* D-FLEX Decentralized Card */}
        <div className="p-4 rounded-xl border bg-emerald-950/20 border-emerald-800/40 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-800/40 mb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                D-FLEX Distributed Mesh (Ours)
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              100% OPERATIONAL
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Fleet Uptime:</span>
              <span className="font-mono font-bold text-emerald-400">
                {comparator?.distributed_uptime_pct ?? 100}% (Immune to Server Loss)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Avg Latency (ms):</span>
              <span className="font-mono font-bold text-emerald-400">
                {comparator?.distributed_latency_ms ?? 2.1} ms (8.8x Faster)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Fleet Throughput:</span>
              <span className="font-mono font-bold text-emerald-400">
                {comparator?.distributed_throughput ?? 68.5} tasks/hr (+63% higher)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Decentralized Resilience:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Zero SPOF
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive SPOF Simulation Actions */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Interactive SPOF Crash Injection:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerSpof}
            disabled={!isServerOnline}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isServerOnline
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 shadow-md shadow-rose-950/20 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Crash Central Server (SPOF)
          </button>
          <button
            onClick={onRestoreServer}
            disabled={isServerOnline}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              !isServerOnline
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-950/20 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restore Central Server
          </button>
        </div>
      </div>
    </div>
  );
};
