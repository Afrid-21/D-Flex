import React, { useState } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { SystemOverview } from './components/SystemOverview';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { MapControls } from './components/MapControls';
import { CompactLegend } from './components/CompactLegend';
import { EventFeed } from './components/EventFeed';
import { OperationsBar } from './components/OperationsBar';
import { RobotInfoPanel } from './components/RobotInfoPanel';
import { ConflictPanel } from './components/ConflictPanel';
import { ReservationPanel } from './components/ReservationPanel';
import { P2PNetworkPanel } from './components/P2PNetworkPanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { DeadlockPanel } from './components/DeadlockPanel';
import { ReroutePanel } from './components/ReroutePanel';
import { TaskAllocationPanel } from './components/TaskAllocationPanel';
import { TaskReassignmentPanel } from './components/TaskReassignmentPanel';
import { EdgeAIPanel } from './components/EdgeAIPanel';
import { NetworkResiliencePanel } from './components/NetworkResiliencePanel';
import { CentralizedComparatorPanel } from './components/CentralizedComparatorPanel';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { DemoOrchestratorPanel } from './components/DemoOrchestratorPanel';
import { AddRobotPanel } from './components/AddRobotPanel';
import {
  Eye,
  Bot,
  ShieldAlert,
  Workflow,
  Compass,
  CalendarClock,
  AlertTriangle,
  Lock,
  Wifi,
  BrainCircuit,
  BarChart3,
  ScrollText,
} from 'lucide-react';
import { Reservation } from './types/warehouse';

export type SidebarTab =
  | 'fleet'
  | 'tasks'
  | 'coordination'
  | 'reservations'
  | 'conflicts'
  | 'deadlocks'
  | 'p2p'
  | 'ai'
  | 'benchmarks'
  | 'events';

export const App: React.FC = () => {
  const {
    state,
    isConnected,
    events,
    start,
    pause,
    reset,
    step,
    setSpeed,
    toggleObstacle,
    clearObstacles,
    addRobot,
    triggerConflictDemo,
    triggerDeadlock2RobotDemo,
    triggerDeadlock3RobotDemo,
    resolveDeadlock,
    triggerRerouteScenarioA,
    triggerRerouteScenarioB,
    triggerRerouteScenarioC,
    triggerTaskScenarioA,
    triggerTaskScenarioB,
    triggerTaskScenarioC,
    triggerTaskScenarioD,
    triggerTaskScenarioE,
    triggerReassignScenarioA,
    triggerReassignScenarioB,
    triggerReassignScenarioC,
    triggerEdgeAIScenarioA,
    triggerEdgeAIScenarioB,
    triggerEdgeAIScenarioC,
    setNetworkFaults,
    triggerNetworkScenarioA,
    triggerNetworkScenarioB,
    triggerNetworkScenarioC,
    triggerSpofFailure,
    restoreCentralizedServer,
    runBenchmarkSuite,
    triggerFullE2EDemo,
    resetTasks,
  } = useSimulation();

  // UI Interactive States
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [activeObstacleBrush, setActiveObstacleBrush] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<SidebarTab>('fleet');

  const robots = state?.robots || [];
  const selectedRobot = robots.find((r) => r.robot_id === selectedRobotId) || null;
  const conflicts = state?.conflicts;
  const reservations = state?.reservations;
  const p2pSummary = state?.p2p_network;
  const negotiations = state?.negotiations;
  const deadlocks = state?.deadlocks;

  const handleCellClick = (x: number, y: number) => {
    toggleObstacle(x, y);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.0, parseFloat((z + 0.2).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.7, parseFloat((z - 0.2).toFixed(2))));
  const handleFitView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const tabList: { id: SidebarTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: 'fleet', label: 'Fleet', icon: <Bot className="w-3.5 h-3.5" />, badge: robots.length },
    { id: 'tasks', label: 'Tasks', icon: <Workflow className="w-3.5 h-3.5" />, badge: state?.tasks ? Object.keys(state.tasks).length : undefined },
    { id: 'coordination', label: 'Coordination', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'reservations', label: 'Reservations', icon: <CalendarClock className="w-3.5 h-3.5" />, badge: reservations ? Object.keys(reservations).length : undefined },
    { id: 'conflicts', label: 'Conflicts', icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: conflicts?.total_conflicts ? conflicts.total_conflicts : undefined },
    { id: 'deadlocks', label: 'Deadlocks', icon: <Lock className="w-3.5 h-3.5" />, badge: deadlocks?.active_cycles?.length ? deadlocks.active_cycles.length : undefined },
    { id: 'p2p', label: 'P2P Mesh', icon: <Wifi className="w-3.5 h-3.5" /> },
    { id: 'ai', label: 'Edge AI', icon: <BrainCircuit className="w-3.5 h-3.5" /> },
    { id: 'benchmarks', label: 'Benchmarks', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'events', label: 'Event Log', icon: <ScrollText className="w-3.5 h-3.5" />, badge: events.length > 0 ? events.length : undefined },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Mission-Control Header */}
      <Header
        status={state?.status || 'idle'}
        elapsedSeconds={state?.elapsed_seconds || 0}
        isConnected={isConnected}
      />

      {/* 2. Main Visual Workspace */}
      <main className="flex-1 w-full p-3 lg:p-4 flex flex-col gap-3">
        {/* Dynamic 2-Column Work Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch min-w-0">
          {/* Center Hero Column: Warehouse Digital Twin (Occupies Dominant 70%+ Width) */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-2.5 transition-all duration-300 min-w-0">
            {/* Top Canvas Bar: Title, Active Conflicts & Fleet Summary */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2 font-mono">
                <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                <span className="font-bold text-slate-800 uppercase tracking-wide">
                  Warehouse Digital Twin
                </span>
                <span className="text-slate-500 text-[10px] font-medium hidden sm:inline">
                  • {state?.layout.width || 28}W × {state?.layout.height || 20}H Grid
                </span>
                <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 flex items-center gap-1 font-mono">
                  <Bot className="h-3 w-3" />
                  <span>3 AMRs LIVE</span>
                </span>
                {conflicts && conflicts.total_conflicts > 0 && (
                  <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 flex items-center gap-1 font-mono animate-pulse">
                    <ShieldAlert className="h-3 w-3 text-rose-600" />
                    <span>{conflicts.total_conflicts} CONFLICTS DETECTED</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500 font-medium">
                {selectedRobotId && (
                  <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Selected: AMR {selectedRobotId}
                  </span>
                )}
                <span className="hidden sm:inline">Zoom: {Math.round(zoomLevel * 100)}%</span>
                <span className="flex items-center gap-1 text-blue-700 font-semibold">
                  <Eye className="h-3 w-3" /> Live Twin
                </span>
              </div>
            </div>

            {/* Floating Top Controls HUD */}
            <MapControls
              status={state?.status || 'idle'}
              speedMultiplier={state?.speed_multiplier || 1.0}
              activeObstaclesCount={state?.active_obstacles_count || 0}
              activeObstacleBrush={activeObstacleBrush}
              showGrid={showGrid}
              showLabels={showLabels}
              onStart={start}
              onPause={pause}
              onReset={() => {
                reset();
                setSelectedRobotId(null);
                setSelectedReservation(null);
              }}
              onStep={step}
              onSpeedChange={setSpeed}
              onToggleBrush={() => setActiveObstacleBrush((prev) => !prev)}
              onClearObstacles={clearObstacles}
              onTriggerBlockAisle={triggerRerouteScenarioA}
              onTriggerConflictDemo={triggerConflictDemo}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitView={handleFitView}
              onToggleGrid={() => setShowGrid((g) => !g)}
              onToggleLabels={() => setShowLabels((l) => !l)}
            />

            {/* Warehouse Hero Canvas */}
            <div className="relative flex-1 flex flex-col justify-center items-center min-w-0 min-h-0">
              <WarehouseCanvas
                layout={state?.layout || null}
                robots={robots}
                conflicts={conflicts}
                reservations={reservations}
                selectedRobotId={selectedRobotId}
                onSelectRobot={setSelectedRobotId}
                onCellClick={handleCellClick}
                onSelectReservation={setSelectedReservation}
                activeObstacleBrush={activeObstacleBrush}
                showGrid={showGrid}
                showLabels={showLabels}
                zoomLevel={zoomLevel}
                panOffset={panOffset}
                onPanChange={setPanOffset}
                onZoomChange={setZoomLevel}
              />

              {/* Floating Bottom-Left Compact Legend */}
              <div className="absolute bottom-3 left-3 z-30 pointer-events-auto">
                <CompactLegend />
              </div>
            </div>
          </div>

          {/* Right Column: Clean Tabbed Operational Sidebar */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-2.5 max-h-[calc(100vh-140px)] overflow-hidden min-w-0">
            {/* Sleek Tab Bar with Horizontal Scroll */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-inner select-none flex-shrink-0">
              {tabList.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {t.badge !== undefined && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-full font-mono font-bold ${
                          isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Body Scrollable Container */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-w-0">
              {/* If a robot is selected, always show its Inspector at the top */}
              {selectedRobot && (
                <RobotInfoPanel
                  robot={selectedRobot}
                  onDeselect={() => setSelectedRobotId(null)}
                />
              )}

              {/* TAB 1: FLEET OVERVIEW */}
              {activeTab === 'fleet' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <SystemOverview
                    state={state}
                    selectedRobotId={selectedRobotId}
                    onSelectRobot={setSelectedRobotId}
                  />
                  <AddRobotPanel onAddRobot={addRobot} />
                  <DemoOrchestratorPanel
                    demo={state?.demo_orchestrator}
                    onLaunchDemo={triggerFullE2EDemo}
                  />
                </div>
              )}

              {/* TAB 2: TASKS & ALLOCATION */}
              {activeTab === 'tasks' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <TaskAllocationPanel
                    taskAllocation={state?.task_allocation}
                    tasks={state?.tasks}
                    robots={robots}
                    onTriggerScenarioA={triggerTaskScenarioA}
                    onTriggerScenarioB={triggerTaskScenarioB}
                    onTriggerScenarioC={triggerTaskScenarioC}
                    onTriggerScenarioD={triggerTaskScenarioD}
                    onTriggerScenarioE={triggerTaskScenarioE}
                    onResetTasks={resetTasks}
                  />
                  <TaskReassignmentPanel
                    metrics={state?.task_reassignment}
                    onTriggerScenarioA={triggerReassignScenarioA}
                    onTriggerScenarioB={triggerReassignScenarioB}
                    onTriggerScenarioC={triggerReassignScenarioC}
                  />
                  <DemoOrchestratorPanel
                    demo={state?.demo_orchestrator}
                    onLaunchDemo={triggerFullE2EDemo}
                  />
                </div>
              )}

              {/* TAB 3: COORDINATION & NEGOTIATIONS */}
              {activeTab === 'coordination' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <ReroutePanel
                    rerouting={state?.rerouting}
                    robots={robots}
                    onTriggerScenarioA={triggerRerouteScenarioA}
                    onTriggerScenarioB={triggerRerouteScenarioB}
                    onTriggerScenarioC={triggerRerouteScenarioC}
                  />
                  <NegotiationPanel
                    negotiations={negotiations}
                    onSelectCell={(x, y) => {
                      setPanOffset({ x: -(x - 14) * 20, y: -(y - 10) * 20 });
                    }}
                  />
                </div>
              )}

              {/* TAB 4: RESERVATIONS */}
              {activeTab === 'reservations' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <ReservationPanel
                    reservations={reservations}
                    selectedRobotId={selectedRobotId}
                    selectedReservation={selectedReservation}
                    onSelectRobot={setSelectedRobotId}
                  />
                </div>
              )}

              {/* TAB 5: CONFLICT MONITOR */}
              {activeTab === 'conflicts' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <ConflictPanel
                    conflictReport={conflicts}
                    onTriggerDemo={triggerConflictDemo}
                    onSelectCell={(x, y) => {
                      setPanOffset({ x: -(x - 14) * 20, y: -(y - 10) * 20 });
                    }}
                  />
                </div>
              )}

              {/* TAB 6: DEADLOCKS */}
              {activeTab === 'deadlocks' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <DeadlockPanel
                    deadlocks={deadlocks}
                    robots={robots}
                    onTrigger2RobotDemo={triggerDeadlock2RobotDemo}
                    onTrigger3RobotDemo={triggerDeadlock3RobotDemo}
                    onResolveDeadlock={resolveDeadlock}
                  />
                </div>
              )}

              {/* TAB 7: P2P NETWORK & RESILIENCE */}
              {activeTab === 'p2p' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <P2PNetworkPanel
                    p2pSummary={p2pSummary}
                    robots={robots}
                    selectedRobotId={selectedRobotId || undefined}
                    onSelectRobot={(id) => setSelectedRobotId(id)}
                  />
                  <NetworkResiliencePanel
                    metrics={state?.network_resilience}
                    onSetFaults={setNetworkFaults}
                    onTriggerScenarioA={triggerNetworkScenarioA}
                    onTriggerScenarioB={triggerNetworkScenarioB}
                    onTriggerScenarioC={triggerNetworkScenarioC}
                  />
                </div>
              )}

              {/* TAB 8: EDGE AI */}
              {activeTab === 'ai' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <EdgeAIPanel
                    metrics={state?.edge_ai}
                    onTriggerScenarioA={triggerEdgeAIScenarioA}
                    onTriggerScenarioB={triggerEdgeAIScenarioB}
                    onTriggerScenarioC={triggerEdgeAIScenarioC}
                  />
                </div>
              )}

              {/* TAB 9: BENCHMARKS & ARCHITECTURE COMPARISON */}
              {activeTab === 'benchmarks' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <BenchmarkPanel
                    benchmarks={state?.benchmarks}
                    onRunBenchmarks={runBenchmarkSuite}
                  />
                  <CentralizedComparatorPanel
                    comparator={state?.centralized_comparator}
                    onTriggerSpof={triggerSpofFailure}
                    onRestoreServer={restoreCentralizedServer}
                  />
                </div>
              )}

              {/* TAB 10: EVENT FEED */}
              {activeTab === 'events' && (
                <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                  <EventFeed events={events} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Bottom Operations & KPI Strip */}
        <OperationsBar state={state} isConnected={isConnected} />
      </main>

      {/* 4. Minimalist Industrial Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500 select-none">
        <div className="flex items-center gap-2 font-medium">
          <span>D-FLEX EDGE ROBOTICS</span>
          <span>•</span>
          <span className="text-slate-700">SIH 2026 AUTONOMOUS FLEET INTELLIGENCE</span>
        </div>
        <div className="font-semibold text-slate-600">SIH 2026 • SIH26123</div>
      </footer>
    </div>
  );
};

export default App;
