import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export const CompactLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-300 bg-white/95 backdrop-blur-md shadow-md text-xs select-none min-w-[220px]">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-700 hover:text-slate-900 font-mono text-[11px] font-bold w-full justify-between cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
          <span>MAP LEGEND</span>
        </div>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-[280px]">
          {/* Storage Racks */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-slate-800 border border-slate-900" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-[10px] truncate">■ Storage Rack</div>
              <div className="text-[9px] text-slate-500 truncate">Inventory Bays</div>
            </div>
          </div>

          {/* AMR */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-blue-600 border border-blue-800 flex items-center justify-center text-[7px] text-white font-bold">R</span>
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-[10px] truncate">● AMR</div>
              <div className="text-[9px] text-slate-500 truncate">Autonomous Mobile Robot</div>
            </div>
          </div>

          {/* Planned Route */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-600 rounded shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-[10px] truncate">━━ Planned Route</div>
              <div className="text-[9px] text-slate-500 truncate">Active A* Trajectory</div>
            </div>
          </div>

          {/* Old / Invalid Route */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 border-b-2 border-dashed border-rose-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-rose-600 text-[10px] truncate">┄┄ Old / Invalid Route</div>
              <div className="text-[9px] text-slate-500 truncate">Blocked / Replaced Path</div>
            </div>
          </div>

          {/* Spatio-Temporal Reservation */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-blue-100 border border-dashed border-blue-500" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-[10px] truncate">▣ Reserved Cell</div>
              <div className="text-[9px] text-slate-500 truncate">4D Time Window</div>
            </div>
          </div>

          {/* Blocked Cell / Obstacle */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-amber-400 border border-rose-600 flex items-center justify-center text-[7px] text-rose-900 font-bold">✕</span>
            <div className="min-w-0">
              <div className="font-bold text-rose-700 text-[10px] truncate">■ Blocked / Obstacle</div>
              <div className="text-[9px] text-slate-500 truncate">Industrial Blockage</div>
            </div>
          </div>

          {/* Conflict */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-rose-100 border border-rose-600 animate-pulse flex items-center justify-center text-[7px] text-rose-700 font-bold">!</span>
            <div className="min-w-0">
              <div className="font-bold text-rose-600 text-[10px] truncate">⚠ Conflict</div>
              <div className="text-[9px] text-slate-500 truncate">Space-Time Collision</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
