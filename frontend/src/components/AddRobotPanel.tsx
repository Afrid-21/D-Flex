import React, { useState } from 'react';
import { Bot, Plus } from 'lucide-react';

interface AddRobotPanelProps {
  onAddRobot: (params: {
    robot_id: string;
    start_x: number;
    start_y: number;
    goal_x: number;
    goal_y: number;
    battery: number;
    destination_label: string;
    task: string;
  }) => void;
}

export const AddRobotPanel: React.FC<AddRobotPanelProps> = ({ onAddRobot }) => {
  const [robotId, setRobotId] = useState('R4');
  const [startX, setStartX] = useState('2');
  const [startY, setStartY] = useState('15');
  const [goalX, setGoalX] = useState('25');
  const [goalY, setGoalY] = useState('15');
  const [battery, setBattery] = useState('100');
  const [label, setLabel] = useState('Live Mission');
  const [task, setTask] = useState('Live warehouse mission');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onAddRobot({
      robot_id: robotId,
      start_x: Number(startX),
      start_y: Number(startY),
      goal_x: Number(goalX),
      goal_y: Number(goalY),
      battery: Number(battery),
      destination_label: label,
      task,
    });
  };

  const fieldClass = 'w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-blue-500';

  return (
    <form onSubmit={submit} className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-mono font-bold text-blue-900">
        <Bot className="h-4 w-4 text-blue-600" />ADD LIVE AMR
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-semibold text-slate-600">ROBOT ID<input className={fieldClass} value={robotId} onChange={(e) => setRobotId(e.target.value)} placeholder="R4" /></label>
        <label className="text-[10px] font-semibold text-slate-600">BATTERY %<input className={fieldClass} type="number" min="0" max="100" value={battery} onChange={(e) => setBattery(e.target.value)} /></label>
        <label className="text-[10px] font-semibold text-slate-600">START X<input className={fieldClass} type="number" min="0" max="27" value={startX} onChange={(e) => setStartX(e.target.value)} /></label>
        <label className="text-[10px] font-semibold text-slate-600">START Y<input className={fieldClass} type="number" min="0" max="19" value={startY} onChange={(e) => setStartY(e.target.value)} /></label>
        <label className="text-[10px] font-semibold text-slate-600">DESTINATION X<input className={fieldClass} type="number" min="0" max="27" value={goalX} onChange={(e) => setGoalX(e.target.value)} /></label>
        <label className="text-[10px] font-semibold text-slate-600">DESTINATION Y<input className={fieldClass} type="number" min="0" max="19" value={goalY} onChange={(e) => setGoalY(e.target.value)} /></label>
        <label className="col-span-2 text-[10px] font-semibold text-slate-600">DESTINATION LABEL<input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="col-span-2 text-[10px] font-semibold text-slate-600">TASK<input className={fieldClass} value={task} onChange={(e) => setTask(e.target.value)} /></label>
      </div>
      <button type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
        <Plus className="h-3.5 w-3.5" />REGISTER AMR AND PLAN ROUTE
      </button>
    </form>
  );
};