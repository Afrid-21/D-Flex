import math
from typing import Dict, List, Optional, Tuple
from app.schemas.warehouse import (
    WarehouseTask,
    TaskBid,
    BidBreakdown,
    TaskPriority,
    TaskStatus,
    TaskEligibilityStatus,
    TaskReassignReason,
    TaskReassignmentEvent,
    TaskReassignmentMetrics,
    RobotStatus,
)
from app.core.grid import WarehouseMap
from app.algorithms.astar_planner import AStarPlanner, PathResult
from app.algorithms.task_allocator import (
    BiddingEngine,
    DeterministicWinnerSelector,
    BATTERY_CONSUMPTION_PER_CELL,
    MIN_RESERVE_BATTERY_MARGIN,
    ABSOLUTE_MIN_BATTERY,
)

# Thresholds
PROLONGED_SAFE_WAIT_THRESHOLD = 15  # Ticks waiting in SAFE_WAIT before reassignment
MAX_ROUTE_REPLAN_FAILURES = 3       # Consecutive A* failures before reassignment


class TaskReassignEngine:
    """
    Decentralized Dynamic Task Reassignment Engine.
    Evaluates health degradation triggers, computes take-over bids from peers,
    and deterministically elects replacement AMRs while guaranteeing zero task loss.
    """

    @staticmethod
    def evaluate_trigger(
        robot_id: str,
        status: RobotStatus,
        battery: float,
        safe_wait_ticks: int = 0,
        route_failures: int = 0,
        is_deadlock_unresolved: bool = False,
        is_offline: bool = False,
        assigned_task: Optional[WarehouseTask] = None,
    ) -> Tuple[bool, Optional[TaskReassignReason], Optional[str]]:
        """
        Checks if an AMR executing a task has degraded to a state requiring task reassignment.
        """
        if assigned_task is None or assigned_task.status in [
            TaskStatus.COMPLETED,
            TaskStatus.CANCELLED,
            TaskStatus.REASSIGNED,
        ]:
            return (False, None, None)

        # 1. Offline / Disconnect
        if is_offline or status == RobotStatus.OFFLINE:
            return (
                True,
                TaskReassignReason.ROBOT_OFFLINE,
                f"AMR {robot_id} went offline during task {assigned_task.task_id}",
            )

        # 2. Battery Critical Gating
        if battery < ABSOLUTE_MIN_BATTERY:
            return (
                True,
                TaskReassignReason.BATTERY_CRITICAL,
                f"AMR {robot_id} battery dropped to {battery:.1f}% (< {ABSOLUTE_MIN_BATTERY}%) during task {assigned_task.task_id}",
            )

        # 3. Prolonged Safe Wait
        if safe_wait_ticks >= PROLONGED_SAFE_WAIT_THRESHOLD:
            return (
                True,
                TaskReassignReason.PROLONGED_SAFE_WAIT,
                f"AMR {robot_id} stuck in SAFE_WAIT for {safe_wait_ticks} ticks (threshold: {PROLONGED_SAFE_WAIT_THRESHOLD})",
            )

        # 4. Route Replanning Failure
        if route_failures >= MAX_ROUTE_REPLAN_FAILURES:
            return (
                True,
                TaskReassignReason.ROUTE_UNAVAILABLE,
                f"AMR {robot_id} failed {route_failures} consecutive route replans to destination",
            )

        # 5. Unresolved Deadlock
        if is_deadlock_unresolved:
            return (
                True,
                TaskReassignReason.DEADLOCK_UNRESOLVED,
                f"AMR {robot_id} encountered unresolvable cyclic deadlock during task {assigned_task.task_id}",
            )

        return (False, None, None)

    @staticmethod
    def calculate_takeover_bid(
        candidate_robot_id: str,
        candidate_pos: Tuple[int, int],
        candidate_battery: float,
        candidate_status: RobotStatus,
        task: WarehouseTask,
        handoff_location: Tuple[int, int],
        failing_robot_id: str,
        warehouse_map: WarehouseMap,
        current_tick: int = 0,
        current_time_s: float = 0.0,
        is_busy_with_other_task: bool = False,
    ) -> TaskBid:
        """
        Calculates a peer's transparent bid to take over a reassigned task from the handoff location.
        """
        # Failing robot cannot bid on its own yielded task
        if candidate_robot_id == failing_robot_id:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_STATUS,
                ineligibility_reason=f"Robot {candidate_robot_id} is the yielding agent",
                bid_breakdown=None,
            )

        # Offline / Safe-wait check
        if candidate_status in [RobotStatus.SAFE_WAIT, RobotStatus.REROUTING, RobotStatus.OFFLINE]:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_STATUS,
                ineligibility_reason=f"Candidate {candidate_robot_id} in {candidate_status.value} status",
                bid_breakdown=None,
            )

        if is_busy_with_other_task:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_BUSY,
                ineligibility_reason=f"Candidate {candidate_robot_id} is busy with another task",
                bid_breakdown=None,
            )

        # Route check from candidate position to handoff location
        path_to_handoff = AStarPlanner.plan_path(candidate_pos, handoff_location, warehouse_map)
        if not path_to_handoff.success:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE,
                ineligibility_reason=f"No safe route from {candidate_pos} to handoff {handoff_location}",
                bid_breakdown=None,
            )

        # Route check from handoff location to final destination
        path_handoff_to_dest = AStarPlanner.plan_path(handoff_location, task.destination, warehouse_map)
        if not path_handoff_to_dest.success:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE,
                ineligibility_reason=f"No safe route from handoff {handoff_location} to destination {task.destination}",
                bid_breakdown=None,
            )

        # Battery check
        dist_handoff = len(path_to_handoff.path)
        dist_dest = len(path_handoff_to_dest.path)
        total_cells = dist_handoff + dist_dest
        required_battery = (total_cells * BATTERY_CONSUMPTION_PER_CELL) + MIN_RESERVE_BATTERY_MARGIN

        if candidate_battery < required_battery or candidate_battery < ABSOLUTE_MIN_BATTERY:
            return TaskBid(
                task_id=task.task_id,
                robot_id=candidate_robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=TaskEligibilityStatus.INELIGIBLE_LOW_BATTERY,
                ineligibility_reason=f"Candidate battery {candidate_battery:.1f}% insufficient (requires {required_battery:.1f}%)",
                bid_breakdown=None,
            )

        # Compute cost
        travel_time_cost = round(dist_handoff * 1.0 + dist_dest * 0.5, 2)
        pickup_distance_cost = round(dist_handoff * 0.5, 2)
        workload_cost = 0.0
        congestion_cost = 0.0
        battery_penalty = round(max(0.0, (100.0 - candidate_battery) * 0.05), 2)

        if task.priority == TaskPriority.HIGH:
            priority_bonus = 3.0
        elif task.priority == TaskPriority.NORMAL:
            priority_bonus = 1.5
        else:
            priority_bonus = 0.0

        raw_cost = (
            travel_time_cost
            + pickup_distance_cost
            + workload_cost
            + congestion_cost
            + battery_penalty
            - priority_bonus
        )
        total_cost = round(max(0.1, raw_cost), 2)

        breakdown = BidBreakdown(
            travel_time_cost=travel_time_cost,
            pickup_distance_cost=pickup_distance_cost,
            workload_cost=workload_cost,
            congestion_cost=congestion_cost,
            battery_penalty=battery_penalty,
            priority_bonus=priority_bonus,
            total_cost=total_cost,
        )

        return TaskBid(
            task_id=task.task_id,
            robot_id=candidate_robot_id,
            task_version=task.task_version,
            bid_cost=total_cost,
            bid_timestamp=current_tick,
            bid_timestamp_s=current_time_s,
            eligibility=TaskEligibilityStatus.ELIGIBLE,
            ineligibility_reason=None,
            bid_breakdown=breakdown,
            estimated_pickup_time=current_tick + dist_handoff,
            estimated_completion_time=current_tick + dist_handoff + dist_dest,
        )

    @staticmethod
    def select_reassignment_winner(
        bids: Dict[str, TaskBid],
        current_task_version: Optional[int] = None,
        yielding_robot_id: Optional[str] = None,
    ) -> Optional[TaskBid]:
        """
        Applies Phase 10 deterministic winner selection on take-over bids.
        Strictly ignores stale bids from prior task versions and the yielding robot.
        """
        valid_bids: Dict[str, TaskBid] = {}
        for rid, bid in bids.items():
            if yielding_robot_id and rid == yielding_robot_id:
                continue
            if current_task_version is not None and bid.task_version < current_task_version:
                continue
            if bid.eligibility == TaskEligibilityStatus.ELIGIBLE and bid.bid_cost < 999999.0:
                valid_bids[rid] = bid

        if not valid_bids:
            return None
        return DeterministicWinnerSelector.select_winner(valid_bids)
