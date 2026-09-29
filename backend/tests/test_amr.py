import pytest
from app.core.grid import WarehouseMap
from app.core.amr_agent import AMRAgent, FleetManager
from app.core.simulation import SimulationEngine
from app.schemas.warehouse import RobotStatus, CellType

def test_amr_creation_and_unique_ids():
    fleet = FleetManager()
    assert len(fleet.robots) == 3
    robot_ids = list(fleet.robots.keys())
    assert set(robot_ids) == {"R1", "R2", "R3"}
    assert len(set(robot_ids)) == 3

    r1 = fleet.robots["R1"]
    assert r1.status == RobotStatus.IDLE
    assert r1.initial_battery == 95.0
    assert r1.battery == 95.0
    assert r1.speed == 1.0

    r2 = fleet.robots["R2"]
    assert r2.initial_battery == 82.0

    r3 = fleet.robots["R3"]
    assert r3.initial_battery == 70.0

def test_valid_spawn_locations():
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)

    for robot in fleet.robots.values():
        x, y = robot.position
        # Must be within bounds
        assert 0 <= x < wmap.width
        assert 0 <= y < wmap.height
        # Must not be a shelf
        assert wmap.grid[y][x].type != CellType.SHELF
        # Must be walkable
        assert wmap.is_walkable(x, y) is True

def test_amr_movement_and_waypoints():
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    r1 = fleet.robots["R1"]

    initial_pos = r1.position
    # First step: transitions to MOVING and takes first step
    moved = r1.step(wmap)
    assert moved is True
    assert r1.status == RobotStatus.MOVING
    assert r1.position == r1.initial_path[1]
    assert r1.position != initial_pos
    assert r1.direction == "S"

def test_battery_drain_while_moving():
    wmap = WarehouseMap(width=28, height=20)
    r1 = AMRAgent("R1", initial_pos=(1, 2), destination=(3, 2), destination_label="Dest", initial_battery=95.0, initial_path=[(1, 2), (2, 2), (3, 2)])

    assert r1.battery == 95.0
    r1.step(wmap)
    assert r1.battery < 95.0
    assert r1.battery == 94.95

    # Pause and ensure battery does NOT drain
    r1.pause()
    batt_paused = r1.battery
    r1.step(wmap)
    assert r1.battery == batt_paused

def test_destination_arrival():
    wmap = WarehouseMap(width=28, height=20)
    short_path = [(1, 2), (2, 2)]
    r = AMRAgent("R_TEST", initial_pos=(1, 2), destination=(2, 2), destination_label="Station", initial_path=short_path)

    assert r.status == RobotStatus.IDLE
    # Step to destination
    r.step(wmap)
    assert r.position == (2, 2)
    assert r.status == RobotStatus.ARRIVED

    # Further steps return False
    assert r.step(wmap) is False

def test_obstacle_collision_protection():
    wmap = WarehouseMap(width=28, height=20)
    fleet = FleetManager(wmap)
    r1 = fleet.robots["R1"]
    assert len(r1.current_path) > 1
    next_target = r1.current_path[1]

    # Place dynamic obstacle directly in front of R1
    wmap.toggle_obstacle(next_target[0], next_target[1])
    assert wmap.is_walkable(next_target[0], next_target[1]) is False

    moved = r1.step(wmap)
    # Should be blocked and not move into obstacle
    assert moved is False
    assert r1.position == (1, 2)

def test_simulation_engine_fleet_lifecycle():
    engine = SimulationEngine()
    state_initial = engine.get_state()
    assert len(state_initial.robots) == 3
    assert state_initial.robots[0].status == RobotStatus.IDLE

    # Start simulation
    engine.start()
    assert engine.status == RobotStatus.MOVING or engine.status == "running"
    state_running = engine.get_state()
    assert state_running.robots[0].status == RobotStatus.MOVING

    # Step simulation
    engine.step()
    # Pause simulation
    engine.pause()
    assert engine.status == "paused"
    state_paused = engine.get_state()
    assert state_paused.robots[0].status == RobotStatus.PAUSED

    # Reset simulation
    engine.reset()
    state_reset = engine.get_state()
    assert state_reset.status == "idle"
    assert state_reset.tick == 0
    assert state_reset.robots[0].status == RobotStatus.IDLE
    assert state_reset.robots[0].position == (1, 2)
    assert state_reset.robots[0].battery == 95.0
