import pytest
from app.algorithms.reservation_table import ReservationTable
from app.schemas.warehouse import ResourceType, ReservationStatus
from app.core.grid import WarehouseMap
from app.core.simulation import SimulationEngine

@pytest.fixture
def table():
    return ReservationTable(safety_buffer_steps=1)

def test_single_cell_reservation(table):
    """TEST 1: Single cell reservation granted."""
    granted, res, conf = table.reserve_cell("R1", (5, 5), start_time=2, end_time=3)
    assert granted is True
    assert res.status == ReservationStatus.ACTIVE
    assert res.robot_id == "R1"
    assert res.cell == (5, 5)
    assert res.start_time == 2
    assert res.end_time == 3
    assert conf is None

def test_multiple_cell_reservations(table):
    """TEST 2: Multiple distinct cell reservations for a robot."""
    path = [(1, 1), (1, 2), (1, 3), (1, 4)]
    results = table.reserve_robot_path("R1", path, start_tick=0)
    # 4 cells + 3 edges = 7 reservations
    assert len(results) == 7
    active = table.get_active_reservations()
    assert len(active) == 7

def test_non_overlapping_reservations(table):
    """TEST 3: Same cell reserved by different robots at non-overlapping times."""
    # R1: T0..T2, R2: T10..T12
    g1, r1, c1 = table.reserve_cell("R1", (5, 5), start_time=0, end_time=2)
    g2, r2, c2 = table.reserve_cell("R2", (5, 5), start_time=10, end_time=12)
    assert g1 is True
    assert g2 is True
    assert c1 is None
    assert c2 is None

def test_overlapping_cell_reservation_conflict(table):
    """TEST 4: Overlapping cell request is rejected with CONFLICTED and does not overwrite existing."""
    g1, r1, c1 = table.reserve_cell("R1", (5, 5), start_time=5, end_time=7)
    assert g1 is True
    assert r1.status == ReservationStatus.ACTIVE
    
    # R2 requests same cell at overlapping time [6, 8]
    g2, r2, c2 = table.reserve_cell("R2", (5, 5), start_time=6, end_time=8)
    assert g2 is False
    assert r2.status == ReservationStatus.CONFLICTED
    assert c2.reservation_id == r1.reservation_id
    assert c2.robot_id == "R1"
    
    # Invariant: R1 reservation is preserved
    assert r1.status == ReservationStatus.ACTIVE
    assert table.all_reservations[r1.reservation_id].status == ReservationStatus.ACTIVE

def test_edge_reservation(table):
    """TEST 5: Directed movement edge reservation."""
    granted, res, conf = table.reserve_edge("R1", (2, 3), (2, 4), start_time=3, end_time=4)
    assert granted is True
    assert res.resource_type == ResourceType.EDGE
    assert res.from_cell == (2, 3)
    assert res.to_cell == (2, 4)
    assert res.status == ReservationStatus.ACTIVE

def test_opposite_edge_conflict(table):
    """TEST 6: Head-on opposing edge traversal conflict."""
    # R1 traverses (10, 8) -> (10, 9) at T=5..6
    g1, r1, _ = table.reserve_edge("R1", (10, 8), (10, 9), start_time=5, end_time=6)
    assert g1 is True
    
    # R2 attempts reverse traversal (10, 9) -> (10, 8) at overlapping T=5..6
    g2, r2, c2 = table.reserve_edge("R2", (10, 9), (10, 8), start_time=5, end_time=6)
    assert g2 is False
    assert r2.status == ReservationStatus.CONFLICTED
    assert c2.robot_id == "R1"

def test_reservation_expiration(table):
    """TEST 7: Past reservations become EXPIRED as simulation time progresses."""
    table.reserve_cell("R1", (2, 2), start_time=0, end_time=3)
    table.reserve_cell("R1", (2, 3), start_time=4, end_time=8)
    
    # At t=5, the first reservation [0, 3] should expire
    expired_count = table.expire_reservations(current_time=5)
    assert expired_count == 1
    
    res_list = table.get_reservations_for_robot("R1")
    assert any(r.status == ReservationStatus.EXPIRED for r in res_list)
    assert any(r.status == ReservationStatus.ACTIVE for r in res_list)

def test_reservation_release(table):
    """TEST 8: Releasing reservations on mission completion."""
    _, r1, _ = table.reserve_cell("R1", (1, 1), start_time=0, end_time=5)
    assert r1.status == ReservationStatus.ACTIVE
    
    released = table.release_reservation(r1.reservation_id)
    assert released is True
    assert r1.status == ReservationStatus.RELEASED
    assert len(table.get_active_reservations()) == 0

def test_multiple_robots_reservations(table):
    """TEST 9: Multiple robots independently book valid non-conflicting paths."""
    p1 = [(1, 1), (2, 1), (3, 1)]
    p2 = [(1, 5), (2, 5), (3, 5)]
    p3 = [(1, 9), (2, 9), (3, 9)]
    
    table.reserve_robot_path("R1", p1, start_tick=0)
    table.reserve_robot_path("R2", p2, start_tick=0)
    table.reserve_robot_path("R3", p3, start_tick=0)
    
    summary = table.get_summary()
    assert summary.total_active > 0
    assert summary.total_conflicted == 0
    assert len(summary.by_robot) == 3
    assert summary.by_robot["R1"].has_conflicts is False

def test_reservation_lookup_by_robot(table):
    """TEST 10: Filtering reservations by robot ID."""
    table.reserve_cell("R1", (1, 1), start_time=0, end_time=2)
    table.reserve_cell("R2", (2, 2), start_time=0, end_time=2)
    
    r1_res = table.get_reservations_for_robot("R1")
    r2_res = table.get_reservations_for_robot("R2")
    
    assert len(r1_res) == 1
    assert len(r2_res) == 1
    assert r1_res[0].robot_id == "R1"
    assert r2_res[0].robot_id == "R2"

def test_cell_reservation_lookup(table):
    """TEST 11: Querying active reservation for a cell at specific timestep."""
    table.reserve_cell("R1", (4, 4), start_time=5, end_time=8)
    
    # At t=6, cell is reserved by R1
    res = table.is_cell_reserved((4, 4), time_step=6)
    assert res is not None
    assert res.robot_id == "R1"
    
    # At t=12, cell is not reserved
    res_none = table.is_cell_reserved((4, 4), time_step=12)
    assert res_none is None

def test_edge_reservation_lookup(table):
    """TEST 12: Querying edge reservation at specific timestep."""
    table.reserve_edge("R1", (3, 3), (3, 4), start_time=2, end_time=4)
    
    res = table.is_edge_reserved((3, 3), (3, 4), time_step=3)
    assert res is not None
    assert res.robot_id == "R1"

def test_safety_buffer_conflict_prevention():
    """TEST 13: Configurable safety buffer enforces safe spacing between reservations."""
    # With buffer_steps = 2
    buffered_table = ReservationTable(safety_buffer_steps=2)
    # R1 occupies (6, 6) for [5, 6]
    buffered_table.reserve_cell("R1", (6, 6), start_time=5, end_time=6)
    
    # R2 requests (6, 6) at t=7 (1 step difference <= buffer 2)
    g2, r2, c2 = buffered_table.reserve_cell("R2", (6, 6), start_time=7, end_time=8)
    assert g2 is False
    assert r2.status == ReservationStatus.CONFLICTED
