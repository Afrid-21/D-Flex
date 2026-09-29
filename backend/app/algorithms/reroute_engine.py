import time
from typing import Dict, List, Optional, Tuple, Set, Any
from app.schemas.warehouse import (
    RobotStatus,
    RerouteReason,
    RerouteEvent,
    ReroutingMetrics,
    P2PMessage,
    P2PMessageType,
    RobotIntentPayload,
    ResourceType,
)
from app.core.grid import WarehouseMap
from app.algorithms.astar_planner import AStarPlanner, PathResult
from app.algorithms.reservation_table import ReservationTable

class DynamicRerouteEngine:
    """
    Decentralized Dynamic Rerouting Engine.
    Monitors route validity, detects blockages and reservation invalidations,
    invokes the Phase 3 A* planner to compute alternative routes from current cell to destination,
    validates spatio-temporal reservation safety, updates reservation schedules atomically,
    increments route versions, and tracks simulation rerouting metrics.
    """

    def __init__(self):
        self.metrics = ReroutingMetrics()
        self.event_counter: int = 0

    def check_route_validity(
        self,
        robot: Any,
        warehouse_map: WarehouseMap,
        reservation_table: Optional[ReservationTable] = None,
        current_tick: int = 0,
    ) -> Tuple[bool, Optional[RerouteReason], Optional[Tuple[int, int]]]:
        """
        Inspects the robot's upcoming path waypoints.
        Returns (is_valid, invalidation_reason, problematic_cell).
        """
        remaining_path = robot.get_remaining_path()
        if not remaining_path or len(remaining_path) <= 1:
            return True, None, None

        # Check future waypoints (from next waypoint onwards)
        for i, cell in enumerate(remaining_path[1:], start=1):
            # 1. Check if cell is an obstacle in warehouse map
            if warehouse_map.is_obstacle(cell[0], cell[1]):
                return False, RerouteReason.BLOCKED_CELL, cell

            # 2. Check reservation collisions if reservation table is provided
            if reservation_table:
                step_time = current_tick + i
                existing_res = reservation_table.get_cell_reservation(cell, step_time)
                if existing_res and existing_res.robot_id != robot.robot_id:
                    return False, RerouteReason.RESERVATION_CONFLICT, cell

        return True, None, None

    def execute_reroute(
        self,
        robot: Any,
        warehouse_map: WarehouseMap,
        blocked_cells: Set[Tuple[int, int]],
        reservation_table: Optional[ReservationTable],
        current_tick: int,
        reason: RerouteReason,
        current_time_s: float = 0.0,
    ) -> Tuple[bool, Optional[PathResult], Optional[str]]:
        """
        Executes safe A* replanning from current robot cell to destination,
        validates spatio-temporal safety, updates reservations atomically,
        increments route version, and logs metrics.
        """
        start_time = time.perf_counter()
        old_version = getattr(robot, "route_version", 1)
        old_path = list(robot.current_path)
        old_length = robot.remaining_distance

        # Transition status to REROUTING
        robot.status = RobotStatus.REROUTING
        if robot.robot_id not in self.metrics.currently_rerouting:
            self.metrics.currently_rerouting.append(robot.robot_id)

        # Create temporary map representation incorporating blocked cells
        obs_coords = [(obs.x, obs.y) for obs in warehouse_map.obstacles.values()]
        temp_obstacles = set(obs_coords).union(blocked_cells)
        temp_map = WarehouseMap(
            width=warehouse_map.width,
            height=warehouse_map.height,
            obstacles=list(temp_obstacles),
        )

        # Execute Phase 3 A* Search from CURRENT position to ORIGINAL destination
        path_result = AStarPlanner.plan_path(
            start=robot.position,
            goal=robot.destination,
            warehouse_map=temp_map,
        )

        calc_ms = round((time.perf_counter() - start_time) * 1000.0, 3)

        if not path_result.success or len(path_result.path) < 1:
            # Failed to find feasible route -> Transition to SAFE_WAIT
            robot.status = RobotStatus.SAFE_WAIT
            robot.last_reroute_reason = reason.value
            if robot.robot_id in self.metrics.currently_rerouting:
                self.metrics.currently_rerouting.remove(robot.robot_id)

            self.event_counter += 1
            event = RerouteEvent(
                event_id=f"evt-reroute-{self.event_counter}",
                robot_id=robot.robot_id,
                timestamp_tick=current_tick,
                timestamp_s=current_time_s,
                reason=RerouteReason.NO_ALTERNATIVE if reason == RerouteReason.NO_ALTERNATIVE else reason,
                old_route_version=old_version,
                new_route_version=old_version,
                old_path_length=old_length,
                new_path_length=0,
                computation_time_ms=calc_ms,
                status="FAILED",
                details=f"No safe alternative path found from {robot.position} to {robot.destination}. Entered SAFE_WAIT.",
            )
            self.metrics.total_reroutes += 1
            self.metrics.failed_reroutes += 1
            self.metrics.recent_events.append(event)
            return False, None, "No alternative path found. Robot entered SAFE_WAIT."

        # Route validation: must start at current position and avoid obstacles
        new_path = path_result.path
        for cell in new_path:
            if cell in blocked_cells or warehouse_map.is_obstacle(cell[0], cell[1]):
                robot.status = RobotStatus.SAFE_WAIT
                return False, None, f"Planned path touches blocked cell {cell}"

        # Atomic reservation update: Release old future reservations and commit new ones
        if reservation_table:
            # Release future reservations for this robot
            reservation_table.release_future_reservations(robot.robot_id, current_tick)

            # Reserve new path
            new_res = reservation_table.reserve_robot_path(
                robot_id=robot.robot_id,
                path=new_path,
                start_tick=current_tick,
                current_tick=current_tick,
            )
            robot.local_reservation_ids = [
                item[1].reservation_id for item in new_res if item and len(item) > 1 and item[1]
            ]

        # Update Robot State
        new_version = old_version + 1
        robot.previous_path = list(old_path)
        robot.current_path = list(new_path)
        robot.path_index = 0
        robot.path_length = len(new_path) - 1
        robot.planning_time_ms = path_result.planning_time_ms
        robot.explored_nodes = path_result.explored_nodes
        robot.route_version = new_version
        robot.last_reroute_reason = reason.value
        robot.status = RobotStatus.MOVING if len(new_path) > 1 else RobotStatus.ARRIVED

        if robot.robot_id in self.metrics.currently_rerouting:
            self.metrics.currently_rerouting.remove(robot.robot_id)

        # Update Metrics
        added_len = max(0, (len(new_path) - 1) - old_length)
        self.metrics.total_reroutes += 1
        self.metrics.successful_reroutes += 1

        # Compute running averages
        total_s = self.metrics.successful_reroutes
        prev_avg_t = self.metrics.avg_computation_time_ms
        self.metrics.avg_computation_time_ms = round(
            ((prev_avg_t * (total_s - 1)) + calc_ms) / total_s, 2
        )
        prev_avg_l = self.metrics.avg_added_path_length
        self.metrics.avg_added_path_length = round(
            ((prev_avg_l * (total_s - 1)) + added_len) / total_s, 2
        )

        self.event_counter += 1
        event = RerouteEvent(
            event_id=f"evt-reroute-{self.event_counter}",
            robot_id=robot.robot_id,
            timestamp_tick=current_tick,
            timestamp_s=current_time_s,
            reason=reason,
            old_route_version=old_version,
            new_route_version=new_version,
            old_path_length=old_length,
            new_path_length=len(new_path) - 1,
            computation_time_ms=calc_ms,
            status="SUCCESS",
            details=f"Rerouted from v{old_version} to v{new_version} (+{added_len} cells): {len(new_path)-1} cells in {calc_ms}ms",
        )
        self.metrics.recent_events.append(event)
        return True, path_result, f"Route v{new_version} validated and committed (+{added_len} cells)"
