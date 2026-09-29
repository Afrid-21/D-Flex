import React from 'react';
import { Bot } from 'lucide-react';
import { SimulationStatus } from '../types/warehouse';

interface HeaderProps {
  status: SimulationStatus;
  elapsedSeconds: number;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  elapsedSeconds,
  isConnected,
}) => {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = (elapsedSeconds % 60).toFixed(1);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(parseFloat(seconds) < 10 ? '0' + seconds : seconds)}`;

  const statusDisplay = () => {
    switch (status) {
      case 'running':
        return { text: 'RUNNING', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600 animate-pulse' };
      case 'paused':
        return { text: 'PAUSED', bg: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-600' };
      default:
        return { text: 'STANDBY', bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' };
    }
  };

  const st = statusDisplay();

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm sticky top-0 z-50 select-none">
      <div className="flex items-center justify-between gap-4">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 shadow-sm">
            <Bot className="h-5 w-5 text-blue-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base text-slate-900 font-sans">
                D-FLEX
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                FLEET OS
              </span>
            </div>
            <p className="text-[11px] tracking-tight text-slate-500 font-sans hidden sm:block">
              Distributed Fleet Intelligence for Autonomous Warehouse Robotics
            </p>
          </div>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-3">
          {/* Connection */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-sm' : 'bg-rose-500 animate-ping'}`} />
            <span className={`text-[11px] font-semibold ${isConnected ? 'text-slate-700' : 'text-rose-600'}`}>
              {isConnected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Sim State Badge */}
          <div className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-mono font-bold ${st.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            <span>{st.text}</span>
          </div>

          {/* Clock */}
          <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 shadow-inner">
            <span className="text-slate-400 mr-1 text-[10px]">T+</span>
            {formattedTime}
          </div>

        </div>
      </div>
    </header>
  );
};
