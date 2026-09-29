import asyncio
import time
from typing import Callable, List, Optional
from app.schemas.warehouse import (
    FleetSummary,
    RobotStatus,
    SimulationStatus,
    SimulationState,
    WarehouseLayout,
)
from app.core.grid import WarehouseMap
from app.core.amr_agent import FleetManager
from app.algorithms.centralized_baseline import CentralizedBaselineEngine
from app.algorithms.benchmark_engine import BenchmarkEngine
from app.algorithms.demo_orchestrator import DemoOrchestrator
from app.config import config

class SimulationEngine:
    """
    Core simulation event loop runner.
    Controls simulation time, AMR fleet stepping, start/pause/reset/step, and state broadcasting.
    """

    def __init__(self, warehouse_map: Optional[WarehouseMap] = None):
        self.map: WarehouseMap = warehouse_map or WarehouseMap(
            width=config.grid_width, height=config.grid_height
        )
        self.fleet: FleetManager = FleetManager(self.map)
        self.comparator: CentralizedBaselineEngine = CentralizedBaselineEngine()
        self.benchmark_engine: BenchmarkEngine = BenchmarkEngine()
        self.demo_orchestrator: DemoOrchestrator = DemoOrchestrator()
        self.status: SimulationStatus = SimulationStatus.IDLE
        self.tick_count: int = 0
        self.elapsed_seconds: float = 0.0
        self.tick_rate_hz: float = config.tick_rate_hz
        self.speed_multiplier: float = config.speed_multiplier

        self._task: Optional[asyncio.Task] = None
        self._listeners: List[Callable[[SimulationState], None]] = []

    def register_listener(self, callback: Callable[[SimulationState], None]):
        """Adds a listener callback that receives state updates on every tick/action."""
        if callback not in self._listeners:
            self._listeners.append(callback)

    def unregister_listener(self, callback: Callable[[SimulationState], None]):
        if callback in self._listeners:
            self._listeners.remove(callback)

    def _notify_listeners(self):
        state = self.get_state()
        for callback in self._listeners:
            try:
                callback(state)
            except Exception as e:
                print(f"[SimEngine] Error notifying listener: {e}")

    def _build_fleet_summary(self) -> FleetSummary:
        robots = self.fleet.get_robots_info(self.tick_count, self.tick_rate_hz)
        total_robots = len(robots)
        if total_robots == 0:
            return FleetSummary(total_robots=0, available_robots=0, utilization_pct=0.0, health_status="HEALTHY")

        available_robots = sum(
            1
            for robot in robots
            if robot.status not in {RobotStatus.DEADLOCKED, RobotStatus.OFFLINE}
        )
        active_robots = sum(
            1
            for robot in robots
            if robot.status in {RobotStatus.MOVING, RobotStatus.REROUTING, RobotStatus.SAFE_WAIT}
        )
        utilization_pct = (active_robots / total_robots) * 100.0
        avg_battery = sum(robot.battery for robot in robots) / total_robots

        if avg_battery < 30.0 or any(robot.status == RobotStatus.OFFLINE for robot in robots):
            health_status = "WARNING"
        elif avg_battery < 60.0:
            health_status = "DEGRADED"
        else:
            health_status = "HEALTHY"

        return FleetSummary(
            total_robots=total_robots,
            available_robots=available_robots,
            utilization_pct=utilization_pct,
            health_status=health_status,
        )

    def get_state(self) -> SimulationState:
        """Constructs the current complete state snapshot including AMR fleet, conflicts, reservations, P2P mesh, and negotiations."""
        conflicts = self.fleet.detect_conflicts(self.tick_count)
        reservations = self.fleet.reservation_table.get_summary()
        p2p_summary = self.fleet.p2p_transport.get_network_summary(
            self.tick_count, config.p2p_stale_timeout_ticks
        )
        negotiations = self.fleet.get_all_negotiations()
        robots = self.fleet.get_robots_info(self.tick_count, self.tick_rate_hz)
        return SimulationState(
            status=self.status,
            tick=self.tick_count,
            elapsed_seconds=round(self.elapsed_seconds, 2),
            tick_rate_hz=self.tick_rate_hz,
            speed_multiplier=self.speed_multiplier,
            active_obstacles_count=len(self.map.obstacles),
            layout=self.map.get_layout(),
            robots=robots,
            fleet_summary=self._build_fleet_summary(),
            conflicts=conflicts,
            reservations=reservations,
            p2p_network=p2p_summary,
            negotiations=negotiations,
            deadlocks=self.fleet.get_all_deadlocks(),
            rerouting=self.fleet.get_rerouting_metrics(),
            task_allocation=self.fleet.get_task_allocation_metrics(),
            task_reassignment=self.fleet.get_task_reassignment_metrics(),
            edge_ai=self.fleet.get_edge_ai_metrics(),
            network_resilience=self.fleet.get_network_resilience_metrics(),
            centralized_comparator=self.comparator.get_metrics(),
            benchmarks=self.benchmark_engine.get_metrics(),
            demo_orchestrator=self.demo_orchestrator.get_metrics(),
            tasks=list(self.fleet.tasks.values()),
        )

    def trigger_full_e2e_demo(self):
        """Starts the multi-stage continuous autonomous warehouse mission demo."""
        self.status = SimulationStatus.RUNNING
        self.demo_orchestrator.start_demo()
        self.fleet.trigger_task_scenario_e()  # batch tasks
        self._notify_listeners()

    def run_benchmark_suite(self):
        """Executes the full automated benchmarking suite."""
        self.benchmark_engine.execute_full_suite(len(self.fleet.robots))
        self._notify_listeners()

    def trigger_spof_failure(self):
        """Simulates central server crash (Centralized fails, D-FLEX thrives)."""
        self.comparator.trigger_spof_failure()
        self._notify_listeners()

    def restore_centralized_server(self):
        """Restores central server online."""
        self.comparator.restore_server()
        self._notify_listeners()

    def trigger_conflict_demo(self):
        """Switches to the deterministic SIH 2026 R1/R2 cross-intersection conflict scenario."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.map.clear_all_obstacles()
        self.fleet.trigger_conflict_demo()
        self._notify_listeners()

    def trigger_deadlock_demo_2robot(self):
        """Switches to the deterministic 2-robot head-on deadlock scenario."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.map.clear_all_obstacles()
        self.fleet.trigger_deadlock_demo_2robot()
        self._notify_listeners()

    def trigger_deadlock_demo_3robot(self):
        """Switches to the deterministic 3-robot cyclic deadlock scenario."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.map.clear_all_obstacles()
        self.fleet.trigger_deadlock_demo_3robot()
        self._notify_listeners()

    def resolve_deadlock(self):
        """Executes decentralized P2P deadlock recovery."""
        self.fleet.resolve_deadlock()
        self._notify_listeners()

    def trigger_reroute_scenario_a(self):
        """Switches to Scenario A: Blocked route on moving AMR."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reroute_scenario_a()
        self._notify_listeners()

    def trigger_reroute_scenario_b(self):
        """Switches to Scenario B: Reservation invalidation."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reroute_scenario_b()
        self._notify_listeners()

    def trigger_reroute_scenario_c(self):
        """Switches to Scenario C: No alternative route -> SAFE_WAIT."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reroute_scenario_c()
        self._notify_listeners()

    def trigger_task_scenario_a(self):
        """Switches to Phase 10 Scenario A: Normal 3-task allocation."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_task_scenario_a()
        self._notify_listeners()

    def trigger_task_scenario_b(self):
        """Switches to Phase 10 Scenario B: Low battery safety gating."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_task_scenario_b()
        self._notify_listeners()

    def trigger_task_scenario_c(self):
        """Switches to Phase 10 Scenario C: No safe route ineligibility."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_task_scenario_c()
        self._notify_listeners()

    def trigger_task_scenario_d(self):
        """Switches to Phase 10 Scenario D: Deterministic tie-breaker."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_task_scenario_d()
        self._notify_listeners()

    def trigger_task_scenario_e(self):
        """Switches to Phase 10 Scenario E: 6-task batch allocation."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_task_scenario_e()
        self._notify_listeners()

    def trigger_reassign_scenario_a(self):
        """Switches to Phase 11 Scenario A: Mid-mission battery failure reassignment."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reassign_scenario_a()
        self._notify_listeners()

    def trigger_reassign_scenario_b(self):
        """Switches to Phase 11 Scenario B: Prolonged safe wait corridor blockage reassignment."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reassign_scenario_b()
        self._notify_listeners()

    def trigger_reassign_scenario_c(self):
        """Switches to Phase 11 Scenario C: Zero eligible peer fallback."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_reassign_scenario_c()
        self._notify_listeners()

    def trigger_edge_ai_scenario_a(self):
        """Switches to Phase 12 Scenario A: High-congestion hotspot proactive avoidance."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_edge_ai_scenario_a()
        self._notify_listeners()

    def trigger_edge_ai_scenario_b(self):
        """Switches to Phase 12 Scenario B: Predictive velocity modulation."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_edge_ai_scenario_b()
        self._notify_listeners()

    def trigger_edge_ai_scenario_c(self):
        """Switches to Phase 12 Scenario C: Asymmetric traffic load balancing."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_edge_ai_scenario_c()
        self._notify_listeners()

    def set_network_faults(self, packet_loss_pct: float, latency_ms: float = 0.0):
        """Sets network packet loss and latency parameters."""
        self.fleet.set_network_faults(packet_loss_pct, latency_ms)
        self._notify_listeners()

    def trigger_network_scenario_a(self):
        """Switches to Phase 13 Scenario A: 30% packet loss during negotiation."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_network_scenario_a()
        self._notify_listeners()

    def trigger_network_scenario_b(self):
        """Switches to Phase 13 Scenario B: AMR Network Partition / Blackout."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_network_scenario_b()
        self._notify_listeners()

    def trigger_network_scenario_c(self):
        """Switches to Phase 13 Scenario C: Extreme 50% packet loss + jitter."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.fleet.trigger_network_scenario_c()
        self._notify_listeners()

    def reset_tasks(self):
        """Resets the task allocation queue to defaults."""
        self.fleet.reset_tasks()
        self._notify_listeners()

    def start(self):
        """Starts or resumes the simulation loop and activates the fleet."""
        if self.status == SimulationStatus.RUNNING:
            return

        self.status = SimulationStatus.RUNNING
        self.fleet.start()
        try:
            loop = asyncio.get_running_loop()
            if self._task is None or self._task.done():
                self._task = loop.create_task(self._run_loop())
        except RuntimeError:
            pass  # No running async event loop (e.g. sync unit test)
        self._notify_listeners()

    def pause(self):
        """Pauses the running simulation and pauses the fleet."""
        if self.status == SimulationStatus.RUNNING:
            self.status = SimulationStatus.PAUSED
            self.fleet.pause()
            self._notify_listeners()

    def reset(self):
        """Resets the simulation clock, obstacles, and AMR fleet to initial condition."""
        self.status = SimulationStatus.IDLE
        self.tick_count = 0
        self.elapsed_seconds = 0.0
        self.map.clear_all_obstacles()
        self.fleet.reset()
        self._notify_listeners()

    def step(self):
        """Advances the simulation by exactly 1 tick (useful when paused or idle)."""
        if self.status != SimulationStatus.RUNNING:
            self._advance_tick()
            self._notify_listeners()

    def set_speed(self, speed: float):
        """Adjusts the playback speed multiplier (0.1x to 10.0x)."""
        self.speed_multiplier = max(0.1, min(10.0, speed))
        self._notify_listeners()

    def toggle_obstacle(self, x: int, y: int) -> bool:
        """Toggles an obstacle at (x, y) and triggers real-time dynamic rerouting for affected AMRs."""
        result = self.map.toggle_obstacle(x, y)
        self.fleet.check_and_reroute_blocked_robots(self.map, self.tick_count, self.elapsed_seconds)
        self._notify_listeners()
        return result

    def _advance_tick(self):
        """Executes one simulation tick, steps all AMRs, and updates reservations."""
        self.tick_count += 1
        dt = (1.0 / self.tick_rate_hz)
        self.elapsed_seconds += dt
        self.fleet.step(self.tick_count, self.elapsed_seconds)
        self.comparator.update_tick(len(self.fleet.robots), self.tick_count)
        self.demo_orchestrator.step_demo(self.tick_count)


    async def _run_loop(self):
        """Async background task that ticks the simulation."""
        while True:
            if self.status == SimulationStatus.RUNNING:
                self._advance_tick()
                self._notify_listeners()

            # Calculate sleep interval adjusted for speed multiplier
            sleep_time = (1.0 / self.tick_rate_hz) / max(0.1, self.speed_multiplier)
            await asyncio.sleep(sleep_time)

    async def shutdown(self):
        """Gracefully cancels the simulation task."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
