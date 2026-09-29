import React from 'react';

export const LegendPanel: React.FC = () => {
  const legendItems = [
    {
      label: 'Storage Racks / Shelves',
      desc: 'Static multi-tier SKU inventory bays (Non-walkable)',
      color: 'bg-blue-900 border-blue-400',
      icon: 'SH',
    },
    {
      label: 'Inbound Picking Stations',
      desc: 'Item induction & pick receiving dock',
      color: 'bg-emerald-950 border-emerald-500 text-emerald-400',
      icon: '📥',
    },
    {
      label: 'Outbound Packing Bays',
      desc: 'Order sorting and dispatch station',
      color: 'bg-amber-950 border-amber-500 text-amber-400',
      icon: '📦',
    },
    {
      label: 'Charging Docks',
      desc: 'High-speed automated AMR inductive charger',
      color: 'bg-purple-950 border-purple-500 text-purple-400',
      icon: '⚡',
    },
    {
      label: 'Dynamic Obstacles',
      desc: 'Configurable real-time blockage / hazard',
      color: 'bg-red-950 border-red-500 text-red-400',
      icon: '⚠️',
    },
    {
      label: 'Main Aisles & Intersections',
      desc: 'Bidirectional transit grid for AMRs',
      color: 'bg-slate-900 border-slate-700 text-slate-400',
      icon: '✛',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-md">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Warehouse Map Legend
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {legendItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2 text-xs"
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border text-xs font-bold ${item.color}`}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-200 truncate">{item.label}</div>
              <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
