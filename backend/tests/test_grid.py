import pytest
from app.core.grid import WarehouseMap
from app.schemas.warehouse import CellType

def test_warehouse_dimensions_and_initialization():
    wmap = WarehouseMap(width=28, height=20)
    assert wmap.width == 28
    assert wmap.height == 20
    assert len(wmap.grid) == 20
    assert len(wmap.grid[0]) == 28

def test_shelves_and_stations_created():
    wmap = WarehouseMap(width=28, height=20)
    assert len(wmap.shelves) > 0
    assert len(wmap.stations) == 6  # 3 pickup + 3 dropoff
    assert len(wmap.charging_docks) == 6
    assert len(wmap.intersections) > 0

    # Test that shelves are not walkable
    for shelf in wmap.shelves.values():
        assert wmap.is_walkable(shelf.x, shelf.y) is False
        assert wmap.grid[shelf.y][shelf.x].type == CellType.SHELF

def test_obstacle_toggle_behavior():
    wmap = WarehouseMap(width=28, height=20)
    # Pick an aisle cell
    test_x, test_y = 5, 2
    assert wmap.is_walkable(test_x, test_y) is True

    # Toggle obstacle on
    added = wmap.toggle_obstacle(test_x, test_y)
    assert added is True
    assert wmap.is_walkable(test_x, test_y) is False
    assert wmap.grid[test_y][test_x].type == CellType.OBSTACLE

    # Toggle obstacle off
    removed = wmap.toggle_obstacle(test_x, test_y)
    assert removed is False
    assert wmap.is_walkable(test_x, test_y) is True
    assert wmap.grid[test_y][test_x].type != CellType.OBSTACLE

def test_shelf_obstacle_protection():
    wmap = WarehouseMap(width=28, height=20)
    # Get first shelf
    shelf = list(wmap.shelves.values())[0]
    # Attempting to toggle obstacle on top of a shelf must be rejected
    res = wmap.toggle_obstacle(shelf.x, shelf.y)
    assert res is False

def test_clear_all_obstacles():
    wmap = WarehouseMap(width=28, height=20)
    wmap.toggle_obstacle(2, 2)
    wmap.toggle_obstacle(5, 5)
    assert len(wmap.obstacles) == 2

    wmap.clear_all_obstacles()
    assert len(wmap.obstacles) == 0
    assert wmap.is_walkable(2, 2) is True
    assert wmap.is_walkable(5, 5) is True
