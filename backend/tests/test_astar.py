import pytest
from app.core.grid import WarehouseMap
from app.algorithms.astar_planner import AStarPlanner
from app.core.amr_agent import AMRAgent, FleetManager
from app.schemas.warehouse import RobotStatus, CellType

@pytest.fixture
def warehouse():
    return WarehouseMap(width=28, height=20)

def test_astar_empty_grid(warehouse):
    """Test path planning on open aisle coordinates."""
    start = (1, 1)
    goal = (5, 1)
    result = AStarPlanner.plan_path(start, goal, warehouse)
    
    assert result.success is True
    assert len(result.path) == 5  # (1,1)->(2,1)->(3,1)->(4,1)->(5,1)
    assert result.path_length == 4
    assert result.path[0] == start
    assert result.path[-1] == goal

def test_astar_around_shelves(warehouse):
    """Test that A* routes around shelf obstacles without penetrating them."""
    # Shelf block A1 is at x: 6..7, y: 3..6
    start = (5, 4)
    goal = (8, 4)
    result = AStarPlanner.plan_path(start, goal, warehouse)
    
    assert result.success is True
    assert result.path[0] == start
    assert result.path[-1] == goal
    
    # Verify no shelf node is in the generated path
    for pt in result.path:
        cell = warehouse.grid[pt[1]][pt[0]]
        assert cell.type != CellType.SHELF
        assert cell.is_walkable is True

def test_astar_start_surrounded(warehouse):
    """Test start cell that is surrounded by obstacles returns failure."""
    # Place obstacles around aisle intersection (8, 8)
    center = (8, 8)
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        nx, ny = center[0] + dx, center[1] + dy
        if 0 <= nx < warehouse.width and 0 <= ny < warehouse.height:
            placed = warehouse.toggle_obstacle(nx, ny)
            assert placed is True

    goal = (1, 15)
    result = AStarPlanner.plan_path(center, goal, warehouse)
    assert result.success is False
    assert result.path == []
    assert result.reason in ["NO_PATH", "INVALID_START_POSITION"]

def test_astar_goal_surrounded(warehouse):
    """Test goal cell completely surrounded by obstacles returns failure."""
    start = (1, 1)
    goal = (12, 10)
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        nx, ny = goal[0] + dx, goal[1] + dy
        if 0 <= nx < warehouse.width and 0 <= ny < warehouse.height:
            warehouse.toggle_obstacle(nx, ny)
            
    result = AStarPlanner.plan_path(start, goal, warehouse)
    assert result.success is False
    assert result.path == []
    assert result.reason == "NO_PATH"

def test_astar_start_equals_goal(warehouse):
    """Test start == goal edge case."""
    pos = (4, 2)
    result = AStarPlanner.plan_path(pos, pos, warehouse)
    assert result.success is True
    assert result.path == [pos]
    assert result.path_length == 0
    assert result.reason == "START_EQUALS_GOAL"

def test_astar_no_blocked_cells_in_path(warehouse):
    """Verify that every step of a long path traverses only walkable cells."""
    start = (1, 2)
    goal = (26, 17)
    result = AStarPlanner.plan_path(start, goal, warehouse)
    assert result.success is True
    for pt in result.path:
        assert warehouse.is_walkable(pt[0], pt[1]) or pt == goal

def test_astar_bounded_path(warehouse):
    """Verify that all path waypoints stay within grid boundaries."""
    s = (1, 1)
    g = (26, 18)
    result = AStarPlanner.plan_path(s, g, warehouse)
    assert result.success is True
    for x, y in result.path:
        assert 0 <= x < warehouse.width
        assert 0 <= y < warehouse.height

def test_astar_destination_change_replan(warehouse):
    """Test AMR replanning when destination changes."""
    amr = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 2),
        destination=(2, 5),
        destination_label="PK-01",
        warehouse_map=warehouse,
    )
    assert amr.path_length > 0
    old_dest = amr.destination
    
    # Change destination to DP-01 at (25, 5)
    new_res = amr.set_destination((25, 5), "DP-01", warehouse)
    assert new_res.success is True
    assert amr.destination == (25, 5)
    assert amr.destination != old_dest
    assert amr.current_path[-1] == (25, 5)
    assert amr.path_index == 0

def test_astar_independent_amr_planning(warehouse):
    """Test that R1, R2, and R3 compute distinct A* routes."""
    fleet = FleetManager(warehouse)
    r1 = fleet.robots["R1"]
    r2 = fleet.robots["R2"]
    r3 = fleet.robots["R3"]
    
    assert len(r1.current_path) > 0
    assert len(r2.current_path) > 0
    assert len(r3.current_path) > 0
    
    assert r1.destination == (1, 5)
    assert r2.destination == (25, 5)
    assert r3.destination == (2, 1)

    assert r1.current_path[-1] == (1, 5)
    assert r2.current_path[-1] == (25, 5)
    assert r3.current_path[-1] == (2, 1)

def test_astar_execution_to_destination(warehouse):
    """Test that executing steps along A* path reaches destination and marks ARRIVED."""
    amr = AMRAgent(
        robot_id="R1",
        initial_pos=(1, 2),
        destination=(4, 2),
        destination_label="Target",
        warehouse_map=warehouse,
    )
    amr.status = RobotStatus.MOVING
    
    max_steps = 10
    steps = 0
    while amr.status != RobotStatus.ARRIVED and steps < max_steps:
        amr.step(warehouse)
        steps += 1
        
    assert amr.status == RobotStatus.ARRIVED
    assert amr.position == (4, 2)
    assert amr.remaining_distance == 0
