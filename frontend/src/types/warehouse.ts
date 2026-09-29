export type CellType =
  | 'empty'
  | 'aisle'
  | 'intersection'
  | 'shelf'
  | 'pickup_station'
  | 'dropoff_station'
  | 'charging_station'
  | 'obstacle';

export interface StationInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  station_type: CellType;
  queue_capacity: number;
  description?: string;
}

export interface ShelfInfo {
  id: string;
  x: number;
  y: number;
  zone: string;
  category: string;
  occupied_sku?: string;
}

export interface ObstacleInfo {
  id: string;
  x: number;
  y: number;
  label: string;
  is_dynamic: boolean;
  created_at_tick: number;
}

export interface CellData {
  x: number;
  y: number;
  type: CellType;
  zone?: string;
  meta_id?: string;
  is_walkable: boolean;
}

export interface WarehouseLayout {
  width: number;
  height: number;
  cells: CellData[][];
  shelves: ShelfInfo[];
  stations: StationInfo[];
  charging_docks: StationInfo[];
  obstacles: ObstacleInfo[];
  intersections: [number, number][];
}

export type RobotStatus = 'IDLE' | 'MOVING' | 'PAUSED' | 'ARRIVED' | 'REROUTING' | 'SAFE_WAIT';

export type P2PMessageType =
  | 'STATE_UPDATE'
  | 'INTENT_UPDATE'
  | 'RESERVATION_UPDATE'
  | 'ROUTE_UPDATE'
  | 'HEARTBEAT'
  | 'ACK'
  | 'CONFLICT_PROPOSE'
  | 'CONFLICT_ACK'
  | 'CONFLICT_REJECT'
  | 'NEGOTIATION_OFFER'
  | 'NEGOTIATION_ACCEPT'
  | 'NEGOTIATION_DECLINE'
  | 'NEGOTIATION_TIMEOUT'
  | 'NEGOTIATION_COMPLETE'
  | 'DEADLOCK_DETECTED'
  | 'DEADLOCK_RECOVERY_PROPOSE'
  | 'DEADLOCK_RECOVERY_ACCEPT'
  | 'DEADLOCK_RECOVERY_DECLINE'
  | 'DEADLOCK_RECOVERY_COMPLETE'
  | 'DEADLOCK_RECOVERY_TIMEOUT'
  | 'TASK_ANNOUNCE'
  | 'TASK_BID'
  | 'TASK_AWARD'
  | 'TASK_ACCEPT'
  | 'TASK_REJECT'
  | 'TASK_COMPLETE'
  | 'TASK_CANCEL';

export type DeadlockState =
  | 'NO_DEADLOCK'
  | 'WAITING'
  | 'DEPENDENCY_DETECTED'
  | 'CYCLE_DETECTED'
  | 'RECOVERY_PROPOSED'
  | 'RECOVERY_ACCEPTED'
  | 'RECOVERED'
  | 'RECOVERY_FAILED';

export type DeadlockRecoveryAction =
  | 'TIME_SHIFT'
  | 'YIELD_PRIORITY'
  | 'TEMPORARY_PAUSE'
  | 'SAFE_WAIT';

export interface DeadlockDependency {
  waiting_robot: string;
  blocking_robot: string;
  resource_type: string;
  cell?: [number, number] | null;
  edge?: [[number, number], [number, number]] | null;
  time_window: [number, number];
  detected_at_tick: number;
}

export interface DeadlockCycle {
  cycle_id: string;
  robots_in_cycle: string[];
  dependencies: DeadlockDependency[];
  state: DeadlockState;
  recovery_action?: DeadlockRecoveryAction | null;
  yielding_robot?: string | null;
  shift_ticks: number;
  resolution?: string | null;
  detected_at_tick: number;
  resolved_at_tick?: number | null;
}

export interface DeadlockSummary {
  total_deadlocks: number;
  active_dependencies: DeadlockDependency[];
  active_cycles: DeadlockCycle[];
  recovered_count: number;
  failed_count: number;
  recent_cycles: DeadlockCycle[];
}

export type NegotiationState =
  | 'NONE'
  | 'DETECTED'
  | 'PROPOSED'
  | 'WAITING_RESPONSE'
  | 'OFFER_RECEIVED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'TIMEOUT'
  | 'RESOLVED';

export interface NegotiationProposal {
  session_id: string;
  conflict_id: string;
  resource_type: string;
  cell?: [number, number] | null;
  edge?: [[number, number], [number, number]] | null;
  requested_time_window: [number, number];
  proposed_time_window?: [number, number] | null;
  reservation_id?: string | null;
  shift_ticks?: number;
  reason?: string | null;
  status?: string | null;
  proposer_id: string;
}

export interface NegotiationSession {
  session_id: string;
  conflict_id: string;
  participants: string[];
  initiator: string;
  receiver: string;
  current_state: NegotiationState;
  created_at_tick: number;
  last_updated_tick: number;
  resource_type: string;
  cell?: [number, number] | null;
  edge?: [[number, number], [number, number]] | null;
  proposal?: NegotiationProposal | null;
  response?: NegotiationProposal | null;
  timeout_at_tick: number;
  resolution?: string | null;
}

export type P2PStatus = 'CONNECTED' | 'DEGRADED' | 'STALE' | 'OFFLINE';


export interface NeighborInfo {
  robot_id: string;
  agent_id: string;
  position: [number, number];
  next_cell?: [number, number] | null;
  planned_cells: [number, number][];
  destination?: [number, number] | null;
  destination_label?: string | null;
  status: RobotStatus;
  battery: number;
  speed: number;
  direction: string;
  reservation_ids: string[];
  last_seen_tick: number;
  last_seen_time_s: number;
  last_seq: number;
  p2p_status: P2PStatus;
}

export interface P2PLogEvent {
  event_id: string;
  timestamp_tick: number;
  timestamp_s: number;
  sender_id: string;
  recipient_id: string;
  message_type: P2PMessageType;
  sequence_number: number;
  summary: string;
}

export interface P2PLinkInfo {
  source: string;
  target: string;
  status: P2PStatus;
  messages_count: number;
  last_activity_tick: number;
}

export interface P2PNetworkSummary {
  total_messages_exchanged: number;
  active_nodes: string[];
  links: P2PLinkInfo[];
  recent_events: P2PLogEvent[];
  mesh_status: string;
}

export interface FleetSummary {
  total_robots: number;
  available_robots: number;
  utilization_pct: number;
  health_status: 'HEALTHY' | 'DEGRADED' | 'WARNING';
}

export interface RobotInfo {
  robot_id: string;
  agent_id?: string;
  position: [number, number];
  destination: [number, number] | null;
  destination_label: string | null;
  speed: number;
  battery: number;
  status: RobotStatus;
  direction: string;
  current_task: string | null;
  current_path: [number, number][];
  color_accent: string;
  // Phase 3 A* Planning Metrics
  path_length?: number;
  path_progress?: number;
  remaining_distance?: number;
  planning_time_ms?: number;
  explored_nodes?: number;
  planning_status?: string;
  // Phase 6 P2P Distributed Agent Metrics
  p2p_status?: P2PStatus;
  neighbors?: NeighborInfo[];
  messages_sent?: number;
  messages_received?: number;
  last_heartbeat_ms?: number;
  sequence_number?: number;
  // Phase 8 Deadlock Metrics
  deadlock_state?: DeadlockState;
  is_yielding?: boolean;
  // Phase 9 Dynamic Rerouting Metrics
  route_version?: number;
  last_reroute_reason?: string;
  previous_path?: [number, number][];
  // Phase 10 Task Allocation Metrics
  assigned_task?: string | null;
  task_stage?: string | null;
}

export type ConflictType =
  | 'VERTEX_CONFLICT'
  | 'EDGE_CONFLICT'
  | 'FOLLOWING_CONFLICT'
  | 'INTERSECTION_CONFLICT';

export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ConflictEvent {
  conflict_id: string;
  type: ConflictType;
  robots: string[];
  cell?: [number, number] | null;
  from_cell?: [number, number] | null;
  to_cell?: [number, number] | null;
  time_step: number;
  relative_time_s: number;
  severity: ConflictSeverity;
  detected_at_tick: number;
  description: string;
}

export interface ConflictReport {
  conflicts: ConflictEvent[];
  total_conflicts: number;
  vertex_conflicts: number;
  edge_conflicts: number;
  following_conflicts: number;
  intersection_conflicts: number;
  detection_time_ms: number;
  pairs_examined: number;
}

export type ResourceType = 'CELL' | 'EDGE';

export type ReservationStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'RELEASED'
  | 'CONFLICTED';

export interface Reservation {
  reservation_id: string;
  robot_id: string;
  resource_type: ResourceType;
  cell?: [number, number] | null;
  from_cell?: [number, number] | null;
  to_cell?: [number, number] | null;
  start_time: number;
  end_time: number;
  status: ReservationStatus;
  created_at_tick: number;
}

export interface RobotReservationSummary {
  robot_id: string;
  cell_count: number;
  edge_count: number;
  start_time: number;
  end_time: number;
  has_conflicts: boolean;
}

export interface ReservationConflictInfo {
  reservation_id: string;
  requested_by: string;
  resource_type: ResourceType;
  resource_repr: string;
  requested_interval: [number, number];
  conflicting_robot: string;
  conflicting_reservation_id: string;
  status: string;
}

export interface ReservationSummary {
  total_active: number;
  total_conflicted: number;
  by_robot: Record<string, RobotReservationSummary>;
  active_reservations: Reservation[];
  conflicts: ReservationConflictInfo[];
}

export type RerouteReason =
  | 'DYNAMIC_OBSTACLE'
  | 'RESERVATION_CONFLICT'
  | 'PEER_POSITION_CONFLICT'
  | 'TRAJECTORY_SHIFT'
  | 'DEADLOCK_RECOVERY'
  | 'TASK_CHANGE'
  | 'MANUAL';

export interface RerouteEvent {
  event_id: string;
  robot_id: string;
  timestamp_tick: number;
  reason: RerouteReason;
  old_path_length: number;
  new_path_length: number;
  computation_time_ms: number;
  success: boolean;
  blocked_cell?: [number, number] | null;
  route_version: number;
}

export interface ReroutingMetrics {
  total_reroutes: number;
  successful_reroutes: number;
  failed_reroutes: number;
  avg_computation_time_ms: number;
  avg_added_path_length: number;
  recent_events: RerouteEvent[];
}

// Phase 10 & 11: Task Allocation & Dynamic Reassignment Types
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type TaskStatus =
  | 'UNASSIGNED'
  | 'ANNOUNCED'
  | 'BIDDING'
  | 'ALLOCATED'
  | 'AWARDED'
  | 'EXECUTING'
  | 'REASSIGNMENT_REQUIRED'
  | 'REASSIGNING'
  | 'REASSIGNED'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskEligibilityStatus =
  | 'ELIGIBLE'
  | 'INELIGIBLE_LOW_BATTERY'
  | 'INELIGIBLE_BUSY'
  | 'INELIGIBLE_NO_SAFE_ROUTE'
  | 'INELIGIBLE_PAYLOAD_CAPACITY'
  | 'INELIGIBLE_STATUS';

export type TaskReassignReason =
  | 'BATTERY_CRITICAL'
  | 'PROLONGED_SAFE_WAIT'
  | 'ROUTE_UNAVAILABLE'
  | 'DEADLOCK_UNRESOLVED'
  | 'ROBOT_OFFLINE'
  | 'TASK_TIMEOUT'
  | 'MANUAL';

export interface BidBreakdown {
  travel_to_pickup_cost?: number;
  pickup_to_destination_cost?: number;
  travel_time_cost?: number;
  pickup_distance_cost?: number;
  battery_penalty: number;
  workload_penalty?: number;
  workload_cost?: number;
  priority_bonus: number;
  congestion_factor?: number;
  congestion_cost?: number;
  total_cost: number;
  path_to_pickup_length?: number;
  path_to_dest_length?: number;
}

export interface TaskBid {
  task_id: string;
  robot_id: string;
  task_version?: number;
  bid_timestamp: number;
  eligibility_status?: TaskEligibilityStatus;
  eligibility?: TaskEligibilityStatus;
  bid_cost: number;
  breakdown?: BidBreakdown;
  bid_breakdown?: BidBreakdown;
  is_valid?: boolean;
  reject_reason?: string | null;
  ineligibility_reason?: string | null;
}

export interface WarehouseTask {
  task_id: string;
  task_name?: string;
  pickup_location: [number, number];
  pickup_label?: string;
  destination: [number, number];
  destination_label?: string;
  priority: TaskPriority;
  status: TaskStatus;
  payload_weight_kg?: number;
  creation_tick?: number;
  announced_at_tick?: number;
  allocated_at_tick?: number | null;
  assigned_robot?: string | null;
  winning_bid_cost?: number | null;
  completed_at_tick?: number | null;
  task_version?: number;
  reassignment_count?: number;
  last_reassign_reason?: TaskReassignReason | null;
  bids: Record<string, TaskBid>;
}

export interface TaskAllocationMetrics {
  total_tasks_announced?: number;
  total_tasks_allocated?: number;
  total_tasks_completed?: number;
  tasks_announced?: number;
  tasks_allocated?: number;
  tasks_completed?: number;
  average_winning_bid?: number;
  average_bids_per_task?: number;
  robot_task_distribution: Record<string, number>;
  active_tasks_count?: number;
  unassigned_tasks?: number;
}

export interface TaskReassignmentEvent {
  event_id: string;
  task_id: string;
  task_version: number;
  original_robot: string;
  reassigned_robot?: string | null;
  reason: TaskReassignReason;
  timestamp_tick: number;
  winning_bid_cost?: number | null;
  status: string;
}

export interface TaskReassignmentMetrics {
  total_reassignments_triggered: number;
  successful_reassignments: number;
  failed_reassignments: number;
  pending_reassignments: number;
  recent_events: TaskReassignmentEvent[];
}

export interface HotspotInfo {
  x: number;
  y: number;
  risk_score: number;
  historical_traversals: number;
  bottleneck_type: string;
}

export interface EdgeAIMetrics {
  total_predictions: number;
  proactive_avoidances: number;
  avg_congestion_risk: number;
  bottleneck_hotspots: HotspotInfo[];
  prediction_accuracy_pct: number;
  heatmap_matrix: number[][];
}

export interface NetworkResilienceMetrics {
  packet_loss_rate_pct: number;
  simulated_latency_ms: number;
  total_messages_attempted: number;
  dropped_messages_count: number;
  delivered_messages_count: number;
  retransmissions_count: number;
  gossip_sync_events: number;
  isolated_nodes: string[];
  safety_fallbacks_triggered: number;
  network_health: string;
}

export interface CentralizedComparatorMetrics {
  server_online: boolean;
  spof_active: boolean;
  centralized_latency_ms: number;
  distributed_latency_ms: number;
  centralized_uptime_pct: number;
  distributed_uptime_pct: number;
  centralized_throughput: number;
  distributed_throughput: number;
  spof_survivability_pct: number;
  message_bottleneck_ratio: string;
  architecture_verdict: string;
}

export interface BenchmarkResult {
  metric_name: string;
  unit: string;
  dflex_value: number;
  baseline_value: number;
  status: string;
  description: string;
}

export interface BenchmarkMetrics {
  is_running: boolean;
  benchmarks_completed: number;
  suite_execution_ms: number;
  overall_efficiency_score: number;
  throughput_improvement_pct: number;
  latency_reduction_pct: number;
  fault_tolerance_score: number;
  results: BenchmarkResult[];
}

export interface DemoStageInfo {
  stage_number: number;
  title: string;
  subsystem: string;
  description: string;
  status: string;
}

export interface DemoOrchestratorMetrics {
  is_active: boolean;
  current_stage: number;
  total_stages: number;
  progress_pct: number;
  active_stage_title: string;
  stages: DemoStageInfo[];
}

export type SimulationStatus = 'idle' | 'running' | 'paused';

export interface SimulationState {
  status: SimulationStatus;
  tick: number;
  elapsed_seconds: number;
  tick_rate_hz: number;
  speed_multiplier: number;
  active_obstacles_count: number;
  layout: WarehouseLayout;
  robots: RobotInfo[];
  fleet_summary?: FleetSummary;
  conflicts?: ConflictReport;
  reservations?: ReservationSummary;
  p2p_network?: P2PNetworkSummary;
  negotiations?: NegotiationSession[];
  deadlocks?: DeadlockSummary;
  rerouting?: ReroutingMetrics;
  task_allocation?: TaskAllocationMetrics;
  task_reassignment?: TaskReassignmentMetrics;
  edge_ai?: EdgeAIMetrics;
  network_resilience?: NetworkResilienceMetrics;
  centralized_comparator?: CentralizedComparatorMetrics;
  benchmarks?: BenchmarkMetrics;
  demo_orchestrator?: DemoOrchestratorMetrics;
  tasks?: WarehouseTask[];
}

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface LogEvent {
  id: string;
  timestamp: string;
  severity: EventSeverity;
  category: string;
  message: string;
  details?: string;
}

