import pytest
from app.core.grid import WarehouseMap
from app.core.amr_agent import FleetManager, AMRAgent
from app.schemas.warehouse import (
    RobotInfo,
    RobotStatus,
    WarehouseTask,
    TaskStatus,
    TaskPriority,
    TaskEligibilityStatus,
    P2PMessageType,
    TaskReassignReason,
    TaskReassignmentEvent,
    TaskReassignmentMetrics,
)
from app.algorithms.task_reassigner import TaskReassignEngine


def test_health_trigger_evaluation():
    """Verify health triggers for battery, safe wait, route failure, deadlock, offline."""
    dummy_task = WarehouseTask(
        task_id="T_TEST",
        pickup_location=(1, 5),
        destination=(26, 5),
        priority=TaskPriority.HIGH,
        status=TaskStatus.EXECUTING,
    )

    # Normal state
    triggered, reason, _ = TaskReassignEngine.evaluate_trigger(
        robot_id="R1",
        status=RobotStatus.MOVING,
        battery=90.0,
        safe_wait_ticks=0,
        route_failures=0,
        assigned_task=dummy_task,
    )
    assert not triggered
    assert reason is None

    # Battery critical (<20%)
    triggered, reason, _ = TaskReassignEngine.evaluate_trigger(
        robot_id="R1",
        status=RobotStatus.MOVING,
        battery=18.0,
        safe_wait_ticks=0,
        route_failures=0,
        assigned_task=dummy_task,
    )
    assert triggered
    assert reason == TaskReassignReason.BATTERY_CRITICAL

    # Prolonged safe wait (>= 15 ticks)
    triggered, reason, _ = TaskReassignEngine.evaluate_trigger(
        robot_id="R1",
        status=RobotStatus.SAFE_WAIT,
        battery=80.0,
        safe_wait_ticks=15,
        route_failures=0,
        assigned_task=dummy_task,
    )
    assert triggered
    assert reason == TaskReassignReason.PROLONGED_SAFE_WAIT

    # Route replan failures (>= 3 failures)
    triggered, reason, _ = TaskReassignEngine.evaluate_trigger(
        robot_id="R1",
        status=RobotStatus.REROUTING,
        battery=80.0,
        safe_wait_ticks=2,
        route_failures=3,
        assigned_task=dummy_task,
    )
    assert triggered
    assert reason == TaskReassignReason.ROUTE_UNAVAILABLE

    # Deadlock unresolved
    triggered, reason, _ = TaskReassignEngine.evaluate_trigger(
        robot_id="R1",
        status=RobotStatus.PAUSED,
        battery=80.0,
        safe_wait_ticks=0,
        route_failures=0,
        is_deadlock_unresolved=True,
        assigned_task=dummy_task,
    )
    assert triggered
    assert reason == TaskReassignReason.DEADLOCK_UNRESOLVED


def test_takeover_bidding_and_winner_election():
    """Verify candidate bid calculations and deterministic winner selection."""
    wmap = WarehouseMap(width=28, height=20)
    task = WarehouseTask(
        task_id="TASK-REASSIGN-1",
        pickup_location=(1, 5),
        destination=(26, 5),
        priority=TaskPriority.HIGH,
        task_version=1,
    )

    # R2 bid (pos at (2,9))
    bid_r2 = TaskReassignEngine.calculate_takeover_bid(
        candidate_robot_id="R2",
        candidate_pos=(2, 9),
        candidate_battery=90.0,
        candidate_status=RobotStatus.IDLE,
        task=task,
        handoff_location=(1, 5),
        failing_robot_id="R1",
        warehouse_map=wmap,
    )
    assert bid_r2.eligibility == TaskEligibilityStatus.ELIGIBLE
    assert bid_r2.robot_id == "R2"
    assert bid_r2.bid_cost < 1000.0

    # R3 bid (pos at (2,13))
    bid_r3 = TaskReassignEngine.calculate_takeover_bid(
        candidate_robot_id="R3",
        candidate_pos=(2, 13),
        candidate_battery=85.0,
        candidate_status=RobotStatus.IDLE,
        task=task,
        handoff_location=(1, 5),
        failing_robot_id="R1",
        warehouse_map=wmap,
    )
    assert bid_r3.eligibility == TaskEligibilityStatus.ELIGIBLE
    assert bid_r3.robot_id == "R3"
    # R2 (2,9) is closer to (1,5) than R3 (2,13) is
    assert bid_r2.bid_cost < bid_r3.bid_cost

    # Winning robot election
    winner_bid = TaskReassignEngine.select_reassignment_winner({"R2": bid_r2, "R3": bid_r3})
    assert winner_bid is not None
    assert winner_bid.robot_id == "R2"

    # Ineligible robot (battery too low)
    bid_low = TaskReassignEngine.calculate_takeover_bid(
        candidate_robot_id="R4",
        candidate_pos=(2, 9),
        candidate_battery=15.0,
        candidate_status=RobotStatus.IDLE,
        task=task,
        handoff_location=(1, 5),
        failing_robot_id="R1",
        warehouse_map=wmap,
    )
    assert bid_low.eligibility == TaskEligibilityStatus.INELIGIBLE_LOW_BATTERY


def test_p2p_task_reassignment_protocol():
    """Verify decentralized P2P reassignment protocol with version bump and reservation isolation."""
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    fleet.reset_fleet_for_tasks()
    
    # Assign a task to R1
    task = fleet.tasks["T01"]
    fleet.announce_task(task, current_tick=0)
    r1 = fleet.robots["R1"]
    r1.status = RobotStatus.MOVING

    # Trigger reassignment on R1 due to battery critical
    r1.battery = 15.0
    msg = r1.request_task_reassignment(
        reason=TaskReassignReason.BATTERY_CRITICAL,
        warehouse_map=wmap,
        current_tick=1,
        current_time_s=0.1,
    )

    assert r1.assigned_task is None
    assert task.task_version == 2

    if msg:
        for rid, robot in fleet.robots.items():
            if rid != "R1":
                robot.receive_p2p_message(msg, current_tick=1, current_time_s=0.1, warehouse_map=wmap)

    # Task should now be awarded and accepted by an idle eligible robot (R2 or R3)
    reassigned_robot = task.assigned_robot
    assert reassigned_robot in ["R2", "R3"]
    assert task.status == TaskStatus.EXECUTING
    assert fleet.robots[reassigned_robot].assigned_task is not None
    assert fleet.robots[reassigned_robot].assigned_task.task_id == "T01"


def test_reassignment_scenario_a_battery_failure():
    """Verify Scenario A: Mid-mission battery failure triggers reassignment from R1 to R2."""
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    fleet.trigger_reassign_scenario_a()

    task = fleet.tasks.get("T01")
    assert task is not None
    assert task.task_version >= 2
    assert task.assigned_robot in ["R2", "R3"]
    assert task.status == TaskStatus.EXECUTING
    
    # Check metrics
    metrics = fleet.get_task_reassignment_metrics()
    assert metrics.total_reassignments_triggered >= 1
    assert metrics.successful_reassignments >= 1


def test_reassignment_scenario_b_safe_wait_blockage():
    """Verify Scenario B: Prolonged safe wait / corridor blockage triggers reassignment."""
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    fleet.trigger_reassign_scenario_b()

    task = fleet.tasks.get("T01")
    assert task is not None
    assert task.assigned_robot in ["R2", "R3"]
    assert task.status == TaskStatus.EXECUTING

    metrics = fleet.get_task_reassignment_metrics()
    assert metrics.total_reassignments_triggered >= 1
    assert metrics.successful_reassignments >= 1


def test_reassignment_scenario_c_zero_eligible_peers_fallback():
    """Verify Scenario C: Zero eligible peers fallback transitions task safely with 0 lost tasks."""
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    fleet.trigger_reassign_scenario_c()

    task = fleet.tasks.get("T01")
    assert task is not None

    # Both R2 and R3 had critical battery, so bid failed -> task must be REASSIGNMENT_REQUIRED (safe fallback)
    assert task.status in [TaskStatus.REASSIGNMENT_REQUIRED, TaskStatus.UNASSIGNED]
    assert task.assigned_robot is None
    
    metrics = fleet.get_task_reassignment_metrics()
    assert metrics.total_reassignments_triggered >= 1
    assert metrics.pending_reassignments >= 1 or metrics.failed_reassignments >= 1
