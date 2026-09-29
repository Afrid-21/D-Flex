import pytest
from app.core.grid import WarehouseMap
from app.core.amr_agent import FleetManager, AMRAgent
from app.schemas.warehouse import (
    WarehouseTask,
    TaskBid,
    TaskPriority,
    TaskStatus,
    TaskEligibilityStatus,
    RobotStatus,
    P2PMessageType,
)
from app.algorithms.task_allocator import BiddingEngine, DeterministicWinnerSelector
from app.algorithms.p2p_transport import P2PTransport
from app.core.simulation import SimulationEngine

@pytest.fixture
def warehouse_map():
    return WarehouseMap(width=28, height=20)

@pytest.fixture
def fleet(warehouse_map):
    return FleetManager(warehouse_map)

# 1. Task creation
def test_task_creation():
    task = WarehouseTask(
        task_id="T01",
        pickup_location=(1, 5),
        destination=(26, 5),
        pickup_label="PK-01",
        destination_label="DP-01",
        priority=TaskPriority.HIGH,
    )
    assert task.task_id == "T01"
    assert task.status == TaskStatus.UNASSIGNED
    assert task.priority == TaskPriority.HIGH
    assert task.task_version == 1

# 2. Task announcement
def test_task_announcement(fleet):
    task = fleet.tasks["T01"]
    fleet.announce_task(task, current_tick=5)
    assert task.status in [TaskStatus.AWARDED, TaskStatus.EXECUTING]
    assert task.assigned_robot is not None
    assert task.bid_count == 3

# 3. Bid generation
def test_bid_generation(warehouse_map):
    task = WarehouseTask(
        task_id="T01",
        pickup_location=(1, 5),
        destination=(26, 5),
        priority=TaskPriority.HIGH,
    )
    bid = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(2, 5),
        battery=90.0,
        status=RobotStatus.IDLE,
        task=task,
        warehouse_map=warehouse_map,
        current_tick=1,
    )
    assert bid.robot_id == "R1"
    assert bid.eligibility == TaskEligibilityStatus.ELIGIBLE
    assert bid.bid_breakdown is not None
    assert bid.bid_cost > 0.0

# 4. Bid cost calculation & priority bonus
def test_bid_cost_calculation(warehouse_map):
    task_high = WarehouseTask(
        task_id="T_HIGH",
        pickup_location=(13, 7),
        destination=(25, 7),
        priority=TaskPriority.HIGH,
    )
    task_low = WarehouseTask(
        task_id="T_LOW",
        pickup_location=(13, 7),
        destination=(25, 7),
        priority=TaskPriority.LOW,
    )
    bid_high = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(3, 7),
        battery=100.0,
        status=RobotStatus.IDLE,
        task=task_high,
        warehouse_map=warehouse_map,
    )
    bid_low = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(3, 7),
        battery=100.0,
        status=RobotStatus.IDLE,
        task=task_low,
        warehouse_map=warehouse_map,
    )
    # HIGH priority provides a 3.0 bonus, resulting in lower bid cost
    assert bid_high.bid_cost < bid_low.bid_cost
    assert bid_high.bid_breakdown.priority_bonus == 3.0
    assert bid_low.bid_breakdown.priority_bonus == 0.0

# 5. Battery eligibility gating
def test_battery_eligibility(warehouse_map):
    task = WarehouseTask(
        task_id="T01",
        pickup_location=(1, 5),
        destination=(26, 5),
    )
    # Low battery: 10%
    bid_low_bat = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(2, 5),
        battery=10.0,
        status=RobotStatus.IDLE,
        task=task,
        warehouse_map=warehouse_map,
    )
    assert bid_low_bat.eligibility == TaskEligibilityStatus.INELIGIBLE_LOW_BATTERY
    assert "insufficient" in bid_low_bat.ineligibility_reason.lower()
    assert bid_low_bat.bid_cost >= 999990.0

# 6. Route feasibility gating
def test_route_feasibility(warehouse_map):
    # Enclose pickup in obstacles (all 4 directions)
    warehouse_map.add_obstacle(1, 4)
    warehouse_map.add_obstacle(1, 6)
    warehouse_map.add_obstacle(2, 5)
    warehouse_map.add_obstacle(0, 5)
    task = WarehouseTask(
        task_id="T_BLOCKED",
        pickup_location=(1, 5),
        destination=(26, 5),
    )
    bid = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(3, 7),
        battery=100.0,
        status=RobotStatus.IDLE,
        task=task,
        warehouse_map=warehouse_map,
    )
    assert bid.eligibility == TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE
    assert bid.bid_cost >= 999990.0

# 7. Robot eligibility on busy/safe_wait
def test_robot_eligibility_busy(warehouse_map):
    task = WarehouseTask(
        task_id="T01",
        pickup_location=(1, 5),
        destination=(26, 5),
    )
    bid = BiddingEngine.calculate_bid(
        robot_id="R1",
        current_pos=(2, 5),
        battery=100.0,
        status=RobotStatus.SAFE_WAIT,
        task=task,
        warehouse_map=warehouse_map,
    )
    assert bid.eligibility == TaskEligibilityStatus.INELIGIBLE_STATUS

# 8. TASK_ANNOUNCE P2P message
def test_task_announce_message():
    transport = P2PTransport()
    bot = AMRAgent(
        robot_id="R1",
        initial_pos=(2, 5),
        destination=(2, 5),
        destination_label="Base",
        transport=transport,
    )
    task = WarehouseTask(task_id="T01", pickup_location=(1, 5), destination=(26, 5))
    msg = bot.create_task_announce_message(task, current_tick=1)
    assert msg.message_type == P2PMessageType.TASK_ANNOUNCE
    assert msg.task_announce_payload.task.task_id == "T01"

# 9. TASK_BID P2P message
def test_task_bid_message():
    transport = P2PTransport()
    bot = AMRAgent(
        robot_id="R1",
        initial_pos=(2, 5),
        destination=(2, 5),
        destination_label="Base",
        transport=transport,
    )
    bid = TaskBid(task_id="T01", robot_id="R1", bid_cost=5.4, bid_timestamp=1)
    msg = bot.create_task_bid_message(bid, current_tick=1)
    assert msg.message_type == P2PMessageType.TASK_BID
    assert msg.task_bid_payload.bid.bid_cost == 5.4

# 10. Deterministic winner selection (cost)
def test_winner_selection_lowest_cost():
    bids = {
        "R1": TaskBid(task_id="T01", robot_id="R1", bid_cost=6.2, bid_timestamp=1),
        "R2": TaskBid(task_id="T01", robot_id="R2", bid_cost=4.8, bid_timestamp=1),
        "R3": TaskBid(task_id="T01", robot_id="R3", bid_cost=5.1, bid_timestamp=1),
    }
    winner = DeterministicWinnerSelector.select_winner(bids)
    assert winner is not None
    assert winner.robot_id == "R2"
    assert winner.bid_cost == 4.8

# 11. Timestamp tie-break
def test_winner_selection_timestamp_tiebreak():
    bids = {
        "R1": TaskBid(task_id="T01", robot_id="R1", bid_cost=5.0, bid_timestamp=5),
        "R2": TaskBid(task_id="T01", robot_id="R2", bid_cost=5.0, bid_timestamp=2), # Earlier timestamp
        "R3": TaskBid(task_id="T01", robot_id="R3", bid_cost=5.5, bid_timestamp=1),
    }
    winner = DeterministicWinnerSelector.select_winner(bids)
    assert winner is not None
    assert winner.robot_id == "R2"

# 12. Robot ID tie-break
def test_winner_selection_robot_id_tiebreak():
    bids = {
        "R2": TaskBid(task_id="T01", robot_id="R2", bid_cost=5.0, bid_timestamp=2),
        "R1": TaskBid(task_id="T01", robot_id="R1", bid_cost=5.0, bid_timestamp=2),
        "R3": TaskBid(task_id="T01", robot_id="R3", bid_cost=5.0, bid_timestamp=2),
    }
    winner = DeterministicWinnerSelector.select_winner(bids)
    assert winner is not None
    assert winner.robot_id == "R1" # Lower alphabetical ID: R1 < R2 < R3

# 13. Stale bid rejection (task versioning)
def test_stale_bid_rejection():
    task = WarehouseTask(task_id="T01", pickup_location=(1, 5), destination=(26, 5), task_version=2)
    stale_bid = TaskBid(task_id="T01", robot_id="R1", task_version=1, bid_cost=2.0)
    assert stale_bid.task_version < task.task_version

# 14. Task award and state transition
def test_task_award_and_execution(fleet):
    task = fleet.tasks["T01"]
    fleet.announce_task(task, current_tick=0)
    assert task.status in [TaskStatus.AWARDED, TaskStatus.EXECUTING]
    assigned_bot = fleet.robots[task.assigned_robot]
    assert assigned_bot.assigned_task is not None
    assert assigned_bot.task_stage == "TO_PICKUP"
    assert assigned_bot.status == RobotStatus.MOVING

# 15. Multi-stage navigation and completion
def test_task_execution_completion(fleet):
    task = fleet.tasks["T01"]
    fleet.announce_task(task, current_tick=0)
    assigned_bot = fleet.robots[task.assigned_robot]
    # Step simulation until task is completed
    for t in range(1, 80):
        fleet.step(current_tick=t, current_time_s=t * 0.1)
        if task.status == TaskStatus.COMPLETED:
            break
    assert task.status == TaskStatus.COMPLETED
    assert task.completed_at_tick is not None
    assert "T01" in assigned_bot.completed_task_ids

# 16. Scenario A: Normal Allocation
def test_scenario_a(fleet):
    metrics = fleet.trigger_task_scenario_a()
    assert metrics.tasks_announced >= 3
    assert metrics.tasks_allocated >= 3
    assert fleet.tasks["T01"].assigned_robot == "R1"
    assert fleet.tasks["T02"].assigned_robot == "R2"
    assert fleet.tasks["T03"].assigned_robot == "R3"

# 17. Scenario B: Low Battery Gating
def test_scenario_b(fleet):
    metrics = fleet.trigger_task_scenario_b()
    assert fleet.tasks["T01"].assigned_robot != "R1"
    assert fleet.tasks["T01"].assigned_robot in ["R2", "R3"]
    assert fleet.tasks["T01"].bids["R1"].eligibility == TaskEligibilityStatus.INELIGIBLE_LOW_BATTERY

# 18. Scenario C: No Safe Route
def test_scenario_c(fleet):
    metrics = fleet.trigger_task_scenario_c()
    assert fleet.tasks["T01"].assigned_robot != "R1"
    assert fleet.tasks["T01"].bids["R1"].eligibility == TaskEligibilityStatus.INELIGIBLE_NO_SAFE_ROUTE

# 19. Scenario D: Tie-Breaker
def test_scenario_d(fleet):
    metrics = fleet.trigger_task_scenario_d()
    task = fleet.tasks["T_TIE"]
    assert task.assigned_robot == "R1" # Lower robot ID tie-break

# 20. Scenario E: 6 Tasks Distribution
def test_scenario_e(fleet):
    metrics = fleet.trigger_task_scenario_e()
    assert metrics.tasks_announced == 6
    assert metrics.tasks_allocated >= 3
    # Step simulation until first batch completes
    for t in range(1, 80):
        fleet.step(current_tick=t, current_time_s=t * 0.1)
    # Re-evaluate remaining queued tasks for the freed fleet
    for tid in ["T04", "T05", "T06"]:
        if fleet.tasks[tid].status in [TaskStatus.ANNOUNCED, TaskStatus.UNASSIGNED]:
            fleet.announce_task(fleet.tasks[tid], current_tick=80)
    # Step simulation for second batch
    for t in range(81, 160):
        fleet.step(current_tick=t, current_time_s=t * 0.1)
    for tid in ["T04", "T05", "T06"]:
        if fleet.tasks[tid].status in [TaskStatus.ANNOUNCED, TaskStatus.UNASSIGNED]:
            fleet.announce_task(fleet.tasks[tid], current_tick=160)
    metrics_final = fleet.get_task_allocation_metrics()
    assert metrics_final.tasks_allocated == 6
    assert len(metrics_final.robot_task_distribution) == 3

# 21. SimulationEngine Task Integration
def test_simulation_engine_task_integration():
    engine = SimulationEngine()
    engine.trigger_task_scenario_a()
    state = engine.get_state()
    assert state.task_allocation.tasks_allocated >= 3
    assert len(state.tasks) >= 3
