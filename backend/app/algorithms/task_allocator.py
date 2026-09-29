import math
from typing import Dict, List, Optional, Tuple
from app.schemas.warehouse import (
    WarehouseTask,
    TaskBid,
    BidBreakdown,
    TaskPriority,
    TaskStatus,
    TaskEligibilityStatus,
    RobotStatus,
)
from app.core.grid import WarehouseMap
from app.algorithms.astar_planner import AStarPlanner, PathResult

# Battery thresholds
BATTERY_CONSUMPTION_PER_CELL = 0.5  # % battery per cell traversed
MIN_RESERVE_BATTERY_MARGIN = 15.0   # % required minimum safety buffer
ABSOLUTE_MIN_BATTERY = 20.0        # % minimum battery to accept any new task

class BiddingEngine:
    """
    Decentralized task bidding evaluator executed locally by each AMR agent.
    Computes route feasibility, battery safety margins, and deterministic cost breakdowns.
    """

    @staticmethod
    def evaluate_eligibility(
        robot_id: str,
        current_pos: Tuple[int, int],
        battery: float,
        status: RobotStatus,
        task: WarehouseTask,
        warehouse_map: WarehouseMap,
        is_busy_with_task: bool = False,
    ) -> Tuple[TaskEligibilityStatus, Optional[str], Optional[PathResult], Optional[PathResult]]:
        """
        Evaluates whether an AMR agent is eligible to bid on a warehouse task.
        Returns (status, ineligibility_reason, candidate_path_to_pickup, candidate_path_to_dest).
        """
        # 1. Status & Offline Checks
        if status in [RobotStatus.SAFE_WAIT, RobotStatus.REROUTING]:
            return (
                TaskEligibilityStatus.INELIGIBLE_STATUS,
                f"Agent {robot_id} is currently in {status.value} status",
                None,
                None,
            )

        if is_busy_with_task:
            return (
                TaskEligibilityStatus.INELIGIBLE_BUSY,
                f"Agent {robot_id} is already executing another task",
                None,
                None,
            )

        # 2. Route Feasibility Evaluation via Phase 3 A* (without modifying agent active path)
        path_to_pickup = AStarPlanner.plan_path(current_pos, task.pickup_location, warehouse_map)
        if not path_to_pickup.success:
            return (
                TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE,
                f"No safe route from current position {current_pos} to pickup {task.pickup_location}",
                None,
                None,
            )

        path_to_dest = AStarPlanner.plan_path(task.pickup_location, task.destination, warehouse_map)
        if not path_to_dest.success:
            return (
                TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE,
                f"No safe route from pickup {task.pickup_location} to destination {task.destination}",
                None,
                None,
            )

        # 3. Battery Safety Gating
        dist_pickup = len(path_to_pickup.path)
        dist_dest = len(path_to_dest.path)
        total_cells = dist_pickup + dist_dest
        required_battery = (total_cells * BATTERY_CONSUMPTION_PER_CELL) + MIN_RESERVE_BATTERY_MARGIN

        if battery < required_battery or battery < ABSOLUTE_MIN_BATTERY:
            return (
                TaskEligibilityStatus.INELIGIBLE_LOW_BATTERY,
                f"Battery {battery:.1f}% insufficient (requires {required_battery:.1f}% with margin)",
                path_to_pickup,
                path_to_dest,
            )

        return (TaskEligibilityStatus.ELIGIBLE, None, path_to_pickup, path_to_dest)

    @staticmethod
    def calculate_bid(
        robot_id: str,
        current_pos: Tuple[int, int],
        battery: float,
        status: RobotStatus,
        task: WarehouseTask,
        warehouse_map: WarehouseMap,
        current_tick: int = 0,
        current_time_s: float = 0.0,
        current_workload_cells: int = 0,
        congestion_factor: float = 0.0,
        is_busy_with_task: bool = False,
    ) -> TaskBid:
        """
        Computes a deterministic, transparent bid for a warehouse task.
        """
        eligibility, reason, path_to_pickup, path_to_dest = BiddingEngine.evaluate_eligibility(
            robot_id=robot_id,
            current_pos=current_pos,
            battery=battery,
            status=status,
            task=task,
            warehouse_map=warehouse_map,
            is_busy_with_task=is_busy_with_task,
        )

        if eligibility != TaskEligibilityStatus.ELIGIBLE:
            return TaskBid(
                task_id=task.task_id,
                robot_id=robot_id,
                task_version=task.task_version,
                bid_cost=999999.0,
                bid_timestamp=current_tick,
                bid_timestamp_s=current_time_s,
                eligibility=eligibility,
                ineligibility_reason=reason,
                bid_breakdown=None,
                estimated_pickup_time=0,
                estimated_completion_time=0,
            )

        # Calculate Cost Components
        pickup_dist = len(path_to_pickup.path) if path_to_pickup else 0
        dest_dist = len(path_to_dest.path) if path_to_dest else 0

        travel_time_cost = round(pickup_dist * 1.0 + dest_dist * 0.5, 2)
        pickup_distance_cost = round(pickup_dist * 0.5, 2)
        workload_cost = round(current_workload_cells * 1.5, 2)
        congestion_cost = round(congestion_factor * 0.5, 2)
        battery_penalty = round(max(0.0, (100.0 - battery) * 0.05), 2)

        # Priority Bonus (Subtracted from cost: HIGH reduces cost more)
        if task.priority == TaskPriority.HIGH:
            priority_bonus = 3.0
        elif task.priority == TaskPriority.NORMAL:
            priority_bonus = 1.5
        else:  # LOW
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
            robot_id=robot_id,
            task_version=task.task_version,
            bid_cost=total_cost,
            bid_timestamp=current_tick,
            bid_timestamp_s=current_time_s,
            eligibility=TaskEligibilityStatus.ELIGIBLE,
            ineligibility_reason=None,
            bid_breakdown=breakdown,
            estimated_pickup_time=current_tick + pickup_dist,
            estimated_completion_time=current_tick + pickup_dist + dest_dist,
        )


class DeterministicWinnerSelector:
    """
    Deterministic winner determination rule applied uniformly across all AMRs.
    1. Filter only valid, eligible bids.
    2. Primary: Lowest bid cost wins.
    3. Tie-break #1: Earlier bid timestamp wins.
    4. Tie-break #2: Lower robot ID string wins (e.g. 'R1' < 'R2' < 'R3').
    """

    @staticmethod
    def select_winner(bids: Dict[str, TaskBid]) -> Optional[TaskBid]:
        eligible_bids = [
            b for b in bids.values()
            if b.eligibility == TaskEligibilityStatus.ELIGIBLE and b.bid_cost < 999990.0
        ]
        if not eligible_bids:
            return None

        # Sort key: (bid_cost, bid_timestamp, robot_id)
        sorted_bids = sorted(
            eligible_bids,
            key=lambda b: (b.bid_cost, b.bid_timestamp, b.robot_id)
        )
        return sorted_bids[0]
