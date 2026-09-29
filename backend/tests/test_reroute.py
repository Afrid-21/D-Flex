import pytest
from app.schemas.warehouse import (
    RobotStatus,
    RerouteReason,
    P2PMessage,
    P2PMessageType,
    SimulationStatus,
)
from app.core.grid import WarehouseMap
from app.algorithms.astar_planner import AStarPlanner
from app.algorithms.reroute_engine import DynamicRerouteEngine
from app.algorithms.reservation_table import ReservationTable
from app.core.amr_agent import AMRAgent, FleetManager
from app.core.simulation import SimulationEngine

def test_valid_route_remains_unchanged_when_no_blockage_exists():
    """Verifies that an unblocked active route is not unnecessarily replanned."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()
    valid, reason, cell = engine.check_route_validity(agent, grid)
    assert valid is True
    assert reason is None
    assert cell is None
    assert agent.route_version == 1


def test_blocked_future_cell_triggers_rerouting():
    """Verifies that a newly placed obstacle on a future waypoint invalidates the route."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()
    # Place obstacle along R1's route at (8, 7)
    grid.add_obstacle(8, 7)

    valid, reason, cell = engine.check_route_validity(agent, grid)
    assert valid is False
    assert reason == RerouteReason.BLOCKED_CELL
    assert cell == (8, 7)


def test_rerouting_preserves_destination():
    """Verifies that replanned route retains the robot's original destination."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()
    grid.add_obstacle(8, 7)

    ok, p_res, msg = engine.execute_reroute(
        robot=agent,
        warehouse_map=grid,
        blocked_cells={(8, 7)},
        reservation_table=None,
        current_tick=0,
        reason=RerouteReason.BLOCKED_CELL,
    )
    assert ok is True
    assert agent.destination == (15, 7)
    assert agent.current_path[-1] == (15, 7)


def test_new_route_avoids_blocked_cells():
    """Verifies that the replanned route does not traverse any blocked cells."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()
    grid.add_obstacle(8, 7)

    ok, p_res, msg = engine.execute_reroute(
        robot=agent,
        warehouse_map=grid,
        blocked_cells={(8, 7)},
        reservation_table=None,
        current_tick=0,
        reason=RerouteReason.BLOCKED_CELL,
    )
    assert ok is True
    assert (8, 7) not in agent.current_path


def test_new_route_avoids_static_obstacles():
    """Verifies that the replanned route strictly avoids warehouse shelves."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 2),
        destination=(25, 17),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()

    # Block direct route
    grid.add_obstacle(8, 2)
    ok, p_res, msg = engine.execute_reroute(
        robot=agent,
        warehouse_map=grid,
        blocked_cells={(8, 2)},
        reservation_table=None,
        current_tick=0,
        reason=RerouteReason.BLOCKED_CELL,
    )
    assert ok is True
    for cell in agent.current_path:
        assert not grid.is_obstacle(cell[0], cell[1])


def test_old_future_reservations_released_and_new_created():
    """Verifies atomic reservation update: old future reservations released, new ones committed."""
    grid = WarehouseMap(width=28, height=20)
    res_table = ReservationTable()
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    res_table.reserve_robot_path("R1", agent.current_path, start_tick=0, current_tick=0)
    initial_res_count = len(res_table.all_reservations)

    engine = DynamicRerouteEngine()
    grid.add_obstacle(8, 7)

    ok, p_res, msg = engine.execute_reroute(
        robot=agent,
        warehouse_map=grid,
        blocked_cells={(8, 7)},
        reservation_table=res_table,
        current_tick=0,
        reason=RerouteReason.BLOCKED_CELL,
    )
    assert ok is True
    # (8, 7) should not have active reservation for R1
    active_res = res_table.get_cell_reservation((8, 7), 7)
    assert active_res is None or active_res.robot_id != "R1"


def test_route_version_increments():
    """Verifies that route_version increments monotonically on each successful reroute."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 7),
        destination=(15, 7),
        destination_label="Target",
        warehouse_map=grid,
    )
    assert agent.route_version == 1

    engine = DynamicRerouteEngine()
    grid.add_obstacle(8, 7)

    engine.execute_reroute(agent, grid, {(8, 7)}, None, 0, RerouteReason.BLOCKED_CELL)
    assert agent.route_version == 2

    # Second reroute
    grid.add_obstacle(8, 6)
    engine.execute_reroute(agent, grid, {(8, 6)}, None, 1, RerouteReason.BLOCKED_CELL)
    assert agent.route_version == 3


def test_stale_route_update_is_ignored():
    """Verifies that peer ignores older route versions or sequence numbers."""
    r1 = AMRAgent(robot_id="R1", initial_pos=(1, 2), destination=(1, 5), destination_label="T1")
    r2 = AMRAgent(robot_id="R2", initial_pos=(20, 2), destination=(25, 5), destination_label="T2")

    r1.route_version = 3
    msg_v3 = r1.create_route_update_message(current_tick=1)
    r2.receive_p2p_message(msg_v3, current_tick=1)

    assert r2.neighbor_table.get_neighbor("R1").last_seq == msg_v3.sequence_number

    # Old message with smaller sequence number
    old_msg = P2PMessage(
        message_id="old-msg",
        message_type=P2PMessageType.ROUTE_UPDATE,
        sender_id="R1",
        sequence_number=msg_v3.sequence_number - 1,
        timestamp_tick=0,
    )
    accepted = r2.receive_p2p_message(old_msg, current_tick=2)
    assert accepted is False


def test_p2p_route_update_is_broadcast():
    """Verifies that AMRAgent generates valid ROUTE_UPDATE message."""
    agent = AMRAgent(robot_id="R1", initial_pos=(1, 7), destination=(15, 7), destination_label="Target")
    agent.route_version = 2
    msg = agent.create_route_update_message(current_tick=5, current_time_s=0.5)

    assert msg.message_type == P2PMessageType.ROUTE_UPDATE
    assert msg.sender_id == "R1"
    assert msg.route_version == 2
    assert msg.intent_payload is not None


def test_no_route_condition_enters_safe_wait():
    """Verifies that when all alternative routes are blocked, robot enters SAFE_WAIT without collision."""
    grid = WarehouseMap(width=28, height=20)
    agent = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 2),
        destination=(1, 5),
        destination_label="Target",
        warehouse_map=grid,
    )
    engine = DynamicRerouteEngine()

    # Block completely
    blocked = {(0, 5), (2, 5), (1, 4), (1, 6), (1, 5), (1, 3), (0, 2), (2, 2), (1, 1)}
    for b in blocked:
        grid.add_obstacle(b[0], b[1])

    ok, p_res, msg = engine.execute_reroute(
        robot=agent,
        warehouse_map=grid,
        blocked_cells=blocked,
        reservation_table=None,
        current_tick=0,
        reason=RerouteReason.NO_ALTERNATIVE,
    )
    assert ok is False
    assert agent.status == RobotStatus.SAFE_WAIT
    assert engine.metrics.failed_reroutes >= 1


def test_two_robot_rerouting():
    """Verifies two AMRs rerouting simultaneously without conflicting."""
    grid = WarehouseMap(width=28, height=20)
    fleet = FleetManager(warehouse_map=grid)
    engine = fleet.reroute_engine

    # R1 from (1, 7) to (15, 7), R2 from (20, 2) to (25, 5)
    grid.add_obstacle(8, 7)
    grid.add_obstacle(22, 2)

    engine.execute_reroute(fleet.robots["R1"], grid, {(8, 7)}, fleet.reservation_table, 0, RerouteReason.BLOCKED_CELL)
    engine.execute_reroute(fleet.robots["R2"], grid, {(22, 2)}, fleet.reservation_table, 0, RerouteReason.BLOCKED_CELL)

    assert fleet.robots["R1"].route_version == 2
    assert fleet.robots["R2"].route_version == 2
    assert fleet.robots["R1"].status == RobotStatus.MOVING
    assert fleet.robots["R2"].status == RobotStatus.MOVING


def test_three_robot_rerouting():
    """Verifies three AMRs all successfully rerouting under dynamic obstacles."""
    grid = WarehouseMap(width=28, height=20)
    fleet = FleetManager(warehouse_map=grid)
    engine = fleet.reroute_engine

    grid.add_obstacle(8, 7)
    grid.add_obstacle(22, 2)
    grid.add_obstacle(8, 10)

    for rid in ["R1", "R2", "R3"]:
        engine.execute_reroute(fleet.robots[rid], grid, set(), fleet.reservation_table, 0, RerouteReason.BLOCKED_CELL)
        assert fleet.robots[rid].route_version == 2


def test_reroute_scenario_a():
    """Verifies Scenario A: Blocked Route demo."""
    fleet = FleetManager()
    metrics = fleet.trigger_reroute_scenario_a()

    assert metrics.total_reroutes >= 1
    assert metrics.successful_reroutes >= 1
    assert fleet.robots["R1"].route_version >= 2
    assert (8, 7) not in fleet.robots["R1"].current_path


def test_reroute_scenario_b():
    """Verifies Scenario B: Reservation Invalidation demo."""
    fleet = FleetManager()
    metrics = fleet.trigger_reroute_scenario_b()

    assert metrics.total_reroutes >= 1
    assert metrics.successful_reroutes >= 1
    assert fleet.robots["R1"].last_reroute_reason == RerouteReason.RESERVATION_CONFLICT.value


def test_reroute_scenario_c():
    """Verifies Scenario C: No Alternative Route demo enters SAFE_WAIT."""
    fleet = FleetManager()
    metrics = fleet.trigger_reroute_scenario_c()

    assert metrics.failed_reroutes >= 1
    assert fleet.robots["R1"].status == RobotStatus.SAFE_WAIT


def test_phase8_deadlock_recovery_remains_functional():
    """Verifies that Phase 8 deadlock detection & resolution continues working alongside Phase 9."""
    fleet = FleetManager()
    summary = fleet.trigger_deadlock_demo_2robot()
    assert len(summary.active_cycles) >= 1

    resolved = fleet.resolve_deadlock()
    assert resolved.recovered_count >= 1


def test_simulation_state_rerouting_metrics():
    """Verifies that SimulationEngine exposes rerouting metrics in state."""
    engine = SimulationEngine()
    engine.trigger_reroute_scenario_a()
    state = engine.get_state()

    assert state.rerouting is not None
    assert state.rerouting.total_reroutes >= 1
    assert len(state.rerouting.recent_events) >= 1
