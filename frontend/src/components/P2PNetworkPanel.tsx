import React, { useState } from 'react';
import { P2PNetworkSummary, RobotInfo } from '../types/warehouse';
import { Network, ArrowRight } from 'lucide-react';


interface P2PNetworkPanelProps {
  p2pSummary?: P2PNetworkSummary;
  robots: RobotInfo[];
  selectedRobotId?: string;
  onSelectRobot?: (robotId: string) => void;
}

export const P2PNetworkPanel: React.FC<P2PNetworkPanelProps> = ({
  p2pSummary,
  robots,
  selectedRobotId,
  onSelectRobot,
}) => {
  const [activeTab, setActiveTab] = useState<'topology' | 'stream'>('topology');

  const totalExchanged = p2pSummary?.total_messages_exchanged ?? 0;
  const meshStatus = p2pSummary?.mesh_status ?? 'CONNECTED';
  const events = p2pSummary?.recent_events ?? [];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Network className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wide uppercase">
            P2P Fleet Network
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              meshStatus === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                : meshStatus === 'DEGRADED'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                meshStatus === 'CONNECTED'
                  ? 'bg-emerald-500 animate-pulse'
                  : meshStatus === 'DEGRADED'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            {meshStatus}
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1 text-[11px] bg-slate-100 dark:bg-slate-800 p-0.5 rounded">
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeTab === 'topology'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Topology
          </button>
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeTab === 'stream'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Msg Log ({events.length})
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="p-3">
        {activeTab === 'topology' ? (
          <div>
            {/* Triangular Industrial Mesh SVG */}
            <div className="relative bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-100 dark:border-slate-800/60 p-2 flex flex-col items-center justify-center">
              <svg viewBox="0 0 240 120" className="w-full max-w-[240px] h-28">
                <defs>
                  <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* Mesh Links */}
                {/* R1 (40, 30) to R2 (200, 30) */}
                <line
                  x1="55"
                  y1="30"
                  x2="185"
                  y2="30"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
                {/* R1 (40, 30) to R3 (120, 95) */}
                <line
                  x1="48"
                  y1="40"
                  x2="112"
                  y2="88"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
                {/* R2 (200, 30) to R3 (120, 95) */}
                <line
                  x1="192"
                  y1="40"
                  x2="128"
                  y2="88"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />

                {/* Node R1 */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectRobot && onSelectRobot('R1')}
                >
                  <circle
                    cx="40"
                    cy="30"
                    r="18"
                    fill={selectedRobotId === 'R1' ? '#2563eb' : '#eff6ff'}
                    stroke="#2563eb"
                    strokeWidth="2"
                  />
                  <text
                    x="40"
                    y="34"
                    textAnchor="middle"
                    fill={selectedRobotId === 'R1' ? '#ffffff' : '#1e3a8a'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    R1
                  </text>
                </g>

                {/* Node R2 */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectRobot && onSelectRobot('R2')}
                >
                  <circle
                    cx="200"
                    cy="30"
                    r="18"
                    fill={selectedRobotId === 'R2' ? '#059669' : '#ecfdf5'}
                    stroke="#059669"
                    strokeWidth="2"
                  />
                  <text
                    x="200"
                    y="34"
                    textAnchor="middle"
                    fill={selectedRobotId === 'R2' ? '#ffffff' : '#064e3b'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    R2
                  </text>
                </g>

                {/* Node R3 */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectRobot && onSelectRobot('R3')}
                >
                  <circle
                    cx="120"
                    cy="95"
                    r="18"
                    fill={selectedRobotId === 'R3' ? '#7c3aed' : '#f5f3ff'}
                    stroke="#7c3aed"
                    strokeWidth="2"
                  />
                  <text
                    x="120"
                    y="99"
                    textAnchor="middle"
                    fill={selectedRobotId === 'R3' ? '#ffffff' : '#4c1d95'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    R3
                  </text>
                </g>
              </svg>

              <div className="w-full flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                <span>Architecture: Full Mesh P2P</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                  {totalExchanged} msgs exchanged
                </span>
              </div>
            </div>

            {/* Peer Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {robots.map((r) => {
                const isSelected = selectedRobotId === r.robot_id;
                const neighborCount = r.neighbors?.length ?? 0;
                return (
                  <button
                    key={r.robot_id}
                    onClick={() => onSelectRobot && onSelectRobot(r.robot_id)}
                    className={`p-2 rounded border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-700 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {r.robot_id}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {r.p2p_status ?? 'OK'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                      <div>Peers: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{neighborCount}</span></div>
                      <div>Tx: <span className="font-mono">{r.messages_sent ?? 0}</span> | Rx: <span className="font-mono">{r.messages_received ?? 0}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* P2P Message Stream Feed */
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Awaiting P2P telemetry exchange...
              </div>
            ) : (
              events.map((evt) => {
                const isState = evt.message_type === 'STATE_UPDATE';
                const isIntent = evt.message_type === 'INTENT_UPDATE';
                const isHb = evt.message_type === 'HEARTBEAT';

                const badgeBg = isState
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                  : isIntent
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400'
                  : isHb
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

                return (
                  <div
                    key={evt.event_id}
                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {evt.sender_id}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {evt.recipient_id}
                      </span>
                      <span className={`px-1 py-0.5 rounded text-[9px] font-semibold uppercase ${badgeBg}`}>
                        {evt.message_type.replace('_UPDATE', '')}
                      </span>
                      <span className="truncate text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                        {evt.summary}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] text-slate-400 pl-2 shrink-0">
                      T+{evt.timestamp_tick}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
