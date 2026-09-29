import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationState, LogEvent, EventSeverity } from '../types/warehouse';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const WS_BASE = API_BASE.replace(/^http/, 'ws');
const WS_URL = `${WS_BASE}/ws/simulation`;
const REST_URL = `${API_BASE}/api`;

export function useSimulation() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const prevStateRef = useRef<SimulationState | null>(null);

  const addEvent = useCallback((severity: EventSeverity, category: string, message: string, details?: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newEvent: LogEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
      severity,
      category,
      message,
      details,
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        addEvent('success', 'SYSTEM', 'Edge Orchestrator Connected', 'Live 10 Hz telemetry link active');
      };

      ws.onmessage = (event) => {
        try {
          const data: SimulationState = JSON.parse(event.data);
          
          // Detect state transitions for event feed
          const prev = prevStateRef.current;
          if (prev) {
            if (prev.status !== data.status) {
              const sev: EventSeverity = data.status === 'running' ? 'success' : 'info';
              addEvent(sev, 'ENGINE', `Simulation state changed: ${data.status.toUpperCase()}`);
            }
            if (prev.active_obstacles_count < data.active_obstacles_count) {
              addEvent('warning', 'HAZARD', `Dynamic obstruction detected on grid (+${data.active_obstacles_count - prev.active_obstacles_count})`);
            } else if (prev.active_obstacles_count > data.active_obstacles_count) {
              addEvent('info', 'HAZARD', 'Dynamic hazard cleared from transit corridor');
            }

            // Track Conflict Transitions
            if (data.conflicts && data.conflicts.total_conflicts > 0) {
              const prevConfCount = prev.conflicts ? prev.conflicts.total_conflicts : 0;
              if (data.conflicts.total_conflicts !== prevConfCount) {
                const firstConf = data.conflicts.conflicts[0];
                const sev: EventSeverity = firstConf.severity === 'CRITICAL' ? 'critical' : 'warning';
                addEvent(
                  sev,
                  'CONFLICT',
                  `${firstConf.severity}: ${firstConf.type.replace('_', ' ')} [${firstConf.robots.join(' ↔ ')}]`,
                  firstConf.description
                );
              }
            } else if (prev.conflicts && prev.conflicts.total_conflicts > 0 && (!data.conflicts || data.conflicts.total_conflicts === 0)) {
              addEvent('info', 'CONFLICT', 'All spatio-temporal conflicts cleared from trajectory horizon');
            }

            // Track Deadlocks (Phase 8)
            if (data.deadlocks && data.deadlocks.active_cycles && data.deadlocks.active_cycles.length > 0) {
              const prevDeadlocks = prev.deadlocks ? prev.deadlocks.active_cycles.length : 0;
              if (data.deadlocks.active_cycles.length !== prevDeadlocks) {
                const firstCycle = data.deadlocks.active_cycles[0];
                addEvent(
                  'critical',
                  'DEADLOCK',
                  `CYCLE DETECTED: [${firstCycle.robots_in_cycle.join(' → ')} → ${firstCycle.robots_in_cycle[0]}]`,
                  `Yielding Agent: ${firstCycle.yielding_robot || 'Elected'} via +${firstCycle.shift_ticks}t time-shift`
                );
              }
            } else if (prev.deadlocks && prev.deadlocks.active_cycles && prev.deadlocks.active_cycles.length > 0 && (!data.deadlocks || data.deadlocks.active_cycles.length === 0)) {
              addEvent('success', 'DEADLOCK', 'Deadlock resolved and cleared via distributed P2P recovery protocol');
            }

            // Track AMR transitions & Rerouting events
            if (prev.robots && data.robots) {
              for (const robot of data.robots) {
                const prevRobot = prev.robots.find((r) => r.robot_id === robot.robot_id);
                if (prevRobot) {
                  if (prevRobot.status !== robot.status) {
                    if (robot.status === 'MOVING') {
                      if ((robot.route_version ?? 1) > 1 && prevRobot.status === 'REROUTING') {
                        addEvent('success', 'REROUTE', `AMR ${robot.robot_id} RESUMING MISSION along replanned route v${robot.route_version}`);
                      } else {
                        addEvent('info', 'PLANNER', `AMR ${robot.robot_id} executing A* route -> ${robot.destination_label || 'Destination'}`);
                      }
                    } else if (robot.status === 'REROUTING') {
                      addEvent('warning', 'REROUTE', `AMR ${robot.robot_id} ROUTE BLOCKED: Invalidation detected. Replanning alternative A* trajectory...`);
                    } else if (robot.status === 'SAFE_WAIT') {
                      addEvent('critical', 'REROUTE', `AMR ${robot.robot_id} NO ROUTE AVAILABLE: Entered SAFE_WAIT fail-safe state`);
                    } else if (robot.status === 'ARRIVED') {
                      addEvent('success', 'MISSION', `AMR ${robot.robot_id} reached destination ${robot.destination_label || 'Target'}`);
                    }
                  }

                  // Track route version change
                  if ((robot.route_version ?? 1) > (prevRobot.route_version ?? 1)) {
                    addEvent('success', 'P2P REROUTE', `AMR ${robot.robot_id} REROUTE COMPLETE: Route v${prevRobot.route_version ?? 1} → v${robot.route_version} (${robot.path_length ?? 0} cells) | Broadcasted P2P ROUTE_UPDATE`);
                  } else if (prevRobot.destination_label !== robot.destination_label || (prevRobot.path_length !== robot.path_length && prevRobot.status !== 'REROUTING')) {
                    addEvent('info', 'A* SEARCH', `AMR ${robot.robot_id} planned A* path to ${robot.destination_label || 'Target'}: ${robot.path_length ?? 0} cells (${robot.planning_time_ms ? robot.planning_time_ms.toFixed(2) : '<0.1'}ms)`);
                  }
                }
              }
            }
          } else if (data.robots && data.robots.length > 0) {
            // Initial fleet spawn event
            for (const r of data.robots) {
              addEvent('info', 'FLEET', `AMR ${r.robot_id} initialized at (${r.position[0]}, ${r.position[1]})`, `A* Path: ${r.path_length ?? 0} cells -> ${r.destination_label || 'Target'}`);
            }
          }

          prevStateRef.current = data;
          setState(data);
        } catch (err) {
          console.error('[WS Parse Error]', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        addEvent('warning', 'NETWORK', 'Connection to edge broker interrupted. Retrying...');
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn('[WS Error]', err);
        setError('Connecting to simulation backend...');
      };
    } catch (err) {
      setError('Failed to establish WebSocket connection');
    }
  }, [addEvent]);

  useEffect(() => {
    connect();

    fetch(`${REST_URL}/state`)
      .then((res) => res.json())
      .then((data: SimulationState) => {
        setState((prev) => prev || data);
        prevStateRef.current = data;
      })
      .catch(() => {});

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendCommand = useCallback((action: string, params?: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, params }));
    } else {
      fetch(`${REST_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.state) setState(res.state);
        })
        .catch((err) => console.error('[REST Control Error]', err));
    }
  }, []);

  const start = useCallback(() => sendCommand('start'), [sendCommand]);
  const pause = useCallback(() => sendCommand('pause'), [sendCommand]);
  const reset = useCallback(() => {
    sendCommand('reset');
    addEvent('info', 'SYSTEM', 'Simulation clock, obstacles, and AMR fleet reset to initial state');
  }, [sendCommand, addEvent]);
  const step = useCallback(() => sendCommand('step'), [sendCommand]);
  const setSpeed = useCallback((speed: number) => {
    sendCommand('set_speed', { speed });
    addEvent('info', 'CONFIG', `Time warp multiplier adjusted to ${speed.toFixed(1)}x`);
  }, [sendCommand, addEvent]);
  const toggleObstacle = useCallback((x: number, y: number) => sendCommand('toggle_obstacle', { x, y }), [sendCommand]);
  const clearObstacles = useCallback(() => sendCommand('clear_obstacles'), [sendCommand]);
  const addRobot = useCallback((params: Record<string, unknown>) => {
    sendCommand('add_robot', params);
    addEvent('success', 'FLEET', `AMR ${String(params.robot_id || '').toUpperCase()} registered with a live A* route`);
  }, [sendCommand, addEvent]);
  const triggerConflictDemo = useCallback(() => {
    sendCommand('trigger_conflict_demo');
    addEvent('warning', 'SCENARIO', 'SIH 2026 Conflict Demonstration scenario active (R1 ⚡ R2 intersection crossing)');
  }, [sendCommand, addEvent]);
  const triggerDeadlock2RobotDemo = useCallback(() => {
    sendCommand('trigger_deadlock_demo_2robot');
    addEvent('critical', 'DEADLOCK DEMO', '2-Robot Head-On Deadlock active (R1 ↔ R2 corridor blocking; R2 yields)');
  }, [sendCommand, addEvent]);
  const triggerDeadlock3RobotDemo = useCallback(() => {
    sendCommand('trigger_deadlock_demo_3robot');
    addEvent('critical', 'DEADLOCK DEMO', '3-Robot Cyclic Deadlock active (R1 → R2 → R3 → R1 crossing; R3 yields)');
  }, [sendCommand, addEvent]);
  const resolveDeadlock = useCallback(() => {
    sendCommand('resolve_deadlock');
    addEvent('success', 'RECOVERY', 'Executing distributed P2P deadlock recovery protocol');
  }, [sendCommand, addEvent]);

  // Phase 9 Dynamic Reroute Scenario Triggers
  const triggerRerouteScenarioA = useCallback(() => {
    sendCommand('trigger_reroute_scenario_a');
    addEvent('warning', 'REROUTE DEMO', 'Scenario A Active: Dynamic obstacle placed in R1 path -> A* replanning triggered');
  }, [sendCommand, addEvent]);

  const triggerRerouteScenarioB = useCallback(() => {
    sendCommand('trigger_reroute_scenario_b');
    addEvent('warning', 'REROUTE DEMO', 'Scenario B Active: Reservation clash injected -> R2 replans alternative path');
  }, [sendCommand, addEvent]);

  const triggerRerouteScenarioC = useCallback(() => {
    sendCommand('trigger_reroute_scenario_c');
    addEvent('critical', 'REROUTE DEMO', 'Scenario C Active: Path boxed in -> No valid path -> Transitions to SAFE_WAIT');
  }, [sendCommand, addEvent]);

  // Phase 10 Distributed Dynamic Task Allocation Scenario Triggers
  const triggerTaskScenarioA = useCallback(() => {
    sendCommand('trigger_task_scenario_a');
    addEvent('info', 'TASK ALLOCATION', 'Scenario A Active: Normal Multi-AMR Task Bidding (R1 closest to PK-01 wins T01)');
  }, [sendCommand, addEvent]);

  const triggerTaskScenarioB = useCallback(() => {
    sendCommand('trigger_task_scenario_b');
    addEvent('warning', 'TASK ALLOCATION', 'Scenario B Active: Low Battery Safety Gating (R1 18% rejected; R2 wins)');
  }, [sendCommand, addEvent]);

  const triggerTaskScenarioC = useCallback(() => {
    sendCommand('trigger_task_scenario_c');
    addEvent('critical', 'TASK ALLOCATION', 'Scenario C Active: No Safe Route Ineligibility (PK-01 blocked; R1 ineligible)');
  }, [sendCommand, addEvent]);

  const triggerTaskScenarioD = useCallback(() => {
    sendCommand('trigger_task_scenario_d');
    addEvent('info', 'TASK ALLOCATION', 'Scenario D Active: Deterministic Tie-Breaker (Equidistant R1 & R2; R1 elected)');
  }, [sendCommand, addEvent]);

  const triggerTaskScenarioE = useCallback(() => {
    sendCommand('trigger_task_scenario_e');
    addEvent('success', 'TASK ALLOCATION', 'Scenario E Active: 6-Task Batch Allocation across R1, R2, R3 fleet');
  }, [sendCommand, addEvent]);

  // Phase 11 Distributed Dynamic Task Reassignment Scenario Triggers
  const triggerReassignScenarioA = useCallback(() => {
    sendCommand('trigger_reassign_scenario_a');
    addEvent('warning', 'TASK REASSIGNMENT', 'Scenario A Active: Mid-Mission Battery Failure (R1 at 14% -> Reassigned to R2)');
  }, [sendCommand, addEvent]);

  const triggerReassignScenarioB = useCallback(() => {
    sendCommand('trigger_reassign_scenario_b');
    addEvent('critical', 'TASK REASSIGNMENT', 'Scenario B Active: Prolonged Safe Wait (R1 stuck 15 ticks -> Reassigned to R3)');
  }, [sendCommand, addEvent]);

  const triggerReassignScenarioC = useCallback(() => {
    sendCommand('trigger_reassign_scenario_c');
    addEvent('info', 'TASK REASSIGNMENT', 'Scenario C Active: Zero Eligible Peer Fallback (All peers low battery -> Task Queued safely)');
  }, [sendCommand, addEvent]);

  // Phase 12 Edge AI & Predictive Intelligence Scenario Triggers
  const triggerEdgeAIScenarioA = useCallback(() => {
    sendCommand('trigger_edge_ai_scenario_a');
    addEvent('info', 'EDGE AI', 'Scenario A Active: High-Congestion Hotspot Proactive A* Avoidance at (14,7)');
  }, [sendCommand, addEvent]);

  const triggerEdgeAIScenarioB = useCallback(() => {
    sendCommand('trigger_edge_ai_scenario_b');
    addEvent('success', 'EDGE AI', 'Scenario B Active: Predictive Velocity Modulation (R1 slows to 0.5 m/s at junction)');
  }, [sendCommand, addEvent]);

  const triggerEdgeAIScenarioC = useCallback(() => {
    sendCommand('trigger_edge_ai_scenario_c');
    addEvent('info', 'EDGE AI', 'Scenario C Active: Asymmetric Multi-Corridor Traffic Load Balancing');
  }, [sendCommand, addEvent]);

  // Phase 13 Network Fault Injection & Communication Resilience Scenario Triggers
  const setNetworkFaults = useCallback((params: { packet_loss_rate_pct?: number; simulated_latency_ms?: number; isolated_nodes?: string[] }) => {
    sendCommand('set_network_faults', params);
    addEvent('warning', 'NETWORK CONFIG', `Network fault params updated: loss=${params.packet_loss_rate_pct ?? 0}%, latency=${params.simulated_latency_ms ?? 0}ms`);
  }, [sendCommand, addEvent]);

  const triggerNetworkScenarioA = useCallback(() => {
    sendCommand('trigger_network_scenario_a');
    addEvent('warning', 'NETWORK SCENARIO', 'Scenario A Active: 30% Packet Loss & Jitter -> Retransmission & Dynamic Buffering verified');
  }, [sendCommand, addEvent]);

  const triggerNetworkScenarioB = useCallback(() => {
    sendCommand('trigger_network_scenario_b');
    addEvent('critical', 'NETWORK SCENARIO', 'Scenario B Active: Total Node Partition (R3 Isolated) -> Safe Wait & Gossip State Sync verified');
  }, [sendCommand, addEvent]);

  const triggerNetworkScenarioC = useCallback(() => {
    sendCommand('trigger_network_scenario_c');
    addEvent('success', 'NETWORK SCENARIO', 'Scenario C Active: Asymmetric Network Partition -> Multi-Hop Relay fallback verified');
  }, [sendCommand, addEvent]);

  // Phase 14 Centralized vs Distributed Architecture Comparator
  const triggerSpofFailure = useCallback(() => {
    sendCommand('trigger_spof_failure');
    addEvent('critical', 'SPOF INJECTION', 'Centralized Controller crashed -> Centralized fleet frozen (0% uptime); D-FLEX mesh unaffected (100% operational)');
  }, [sendCommand, addEvent]);

  const restoreCentralizedServer = useCallback(() => {
    sendCommand('restore_centralized_server');
    addEvent('success', 'SYSTEM RESTORE', 'Centralized server restored online');
  }, [sendCommand, addEvent]);

  // Phase 15 Quantitative Benchmarking Suite
  const runBenchmarkSuite = useCallback(() => {
    sendCommand('run_benchmark_suite');
    addEvent('info', 'BENCHMARK', 'Executing automated quantitative performance benchmarking suite');
  }, [sendCommand, addEvent]);

  // Phase 17 End-to-End Mission Demonstration Orchestrator
  const triggerFullE2EDemo = useCallback(() => {
    sendCommand('trigger_full_e2e_demo');
    addEvent('success', 'E2E MISSION', 'Launching full automated multi-stage continuous warehouse mission');
  }, [sendCommand, addEvent]);

  const resetTasks = useCallback(() => {
    sendCommand('reset_tasks');
    addEvent('info', 'TASK ALLOCATION', 'Task allocation state and default tasks reset');
  }, [sendCommand, addEvent]);

  return {
    state,
    isConnected,
    error,
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
    addEvent,
  };
}

