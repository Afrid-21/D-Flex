import pytest
from app.core.grid import WarehouseMap
from app.algorithms.conflict_detector import ConflictDetector
from app.core.amr_agent import AMRAgent, FleetManager
from app.core.simulation import SimulationEngine
from app.schemas.warehouse import ConflictType, ConflictSeverity, RobotStatus

@pytest.fixture
def warehouse():
    return WarehouseMap(width=28, height=20)

@pytest.fixture
def detector():
    return ConflictDetector(safety_headway=1, intersection_window=1)

def test_no_overlap_paths(detector):
    """TEST 1: Two paths with no spatial/temporal overlap yield 0 conflicts."""
    robots = {
        "R1": AMRAgent("R1", initial_pos=(1, 1), destination=(5, 1), destination_label="A", initial_path=[(1, 1), (2, 1), (3, 1), (4, 1), (5, 1)]),
        "R2": AMRAgent("R2", initial_pos=(1, 10), destination=(5, 10), destination_label="B", initial_path=[(1, 10), (2, 10), (3, 10), (4, 10), (5, 10)]),
    }
    report = detector.detect_conflicts(robots, current_tick=0)
    assert report.total_conflicts == 0
    assert len(report.conflicts) == 0

def test_vertex_conflict_same_cell_same_time(detector):
    """TEST 2: Two robots reach the same cell at the exact same time step."""
    # Both reach (5, 5) at t=3
    r1_path = [(2, 5), (3, 5), (4, 5), (5, 5)]
    r2_path = [(5, 2), (5, 3), (5, 4), (5, 5)]
    robots = {
        "R1": AMRAgent("R1", initial_pos=(2, 5), destination=(5, 5), destination_label="Dest", initial_path=r1_path),
        "R2": AMRAgent("R2", initial_pos=(5, 2), destination=(5, 5), destination_label="Dest", initial_path=r2_path),
    }
    report = detector.detect_conflicts(robots, current_tick=0)
    assert report.vertex_conflicts >= 1
    vtx = [c for c in report.conflicts if c.type == ConflictType.VERTEX_CONFLICT]
    assert len(vtx) >= 1
    assert vtx[0].cell == (5, 5)
    assert vtx[0].time_step == 3
    assert set(vtx[0].robots) == {"R1", "R2"}
    assert vtx[0].severity == ConflictSeverity.CRITICAL

def test_edge_conflict_head_on_swap(detector):
    """TEST 3: Two robots traverse the same edge in opposite directions at t=1."""
    # R1: (10, 8) -> (10, 9)
    # R2: (10, 9) -> (10, 8)
    r1_path = [(10, 8), (10, 9)]
    r2_path = [(10, 9), (10, 8)]
    robots = {
        "R1": AMRAgent("R1", initial_pos=(10, 8), destination=(10, 9), destination_label="D1", initial_path=r1_path),
        "R2": AMRAgent("R2", initial_pos=(10, 9), destination=(10, 8), destination_label="D2", initial_path=r2_path),
    }
    report = detector.detect_conflicts(robots, current_tick=0)
    assert report.edge_conflicts >= 1
    edge = [c for c in report.conflicts if c.type == ConflictType.EDGE_CONFLICT]
    assert len(edge) >= 1
    assert set(edge[0].robots) == {"R1", "R2"}
    assert edge[0].time_step == 1

def test_following_conflict_unsafe_headway(detector):
    """TEST 4: One robot enters cell A at t=2, second robot enters cell A at t=3."""
    # Headway is 1 step (unsafe)
    # R1: (1,1)->(2,1)->(3,1)->(4,1) -> cell (3,1) visited at t=2
    # R2: (0,1)->(1,1)->(2,1)->(3,1) -> cell (3,1) visited at t=3
    r1_path = [(1, 1), (2, 1), (3, 1), (4, 1)]
    r2_path = [(0, 1), (1, 1), (2, 1), (3, 1)]
    robots = {
        "R1": AMRAgent("R1", initial_pos=(1, 1), destination=(4, 1), destination_label="D1", initial_path=r1_path),
        "R2": AMRAgent("R2", initial_pos=(0, 1), destination=(3, 1), destination_label="D2", initial_path=r2_path),
    }
    report = detector.detect_conflicts(robots, current_tick=0)
    assert report.following_conflicts >= 1
    fol = [c for c in report.conflicts if c.type == ConflictType.FOLLOWING_CONFLICT]
    assert len(fol) >= 1
    assert fol[0].severity == ConflictSeverity.WARNING

def test_intersection_conflict_overlapping_window(detector):
    """TEST 5: Two robots cross the same designated intersection within overlapping time window."""
    isect = (8, 7)
    # R1 reaches (8, 7) at t=3
    r1_path = [(5, 7), (6, 7), (7, 7), (8, 7), (9, 7)]
    # R2 reaches (8, 7) at t=4
    r2_path = [(8, 3), (8, 4), (8, 5), (8, 6), (8, 7)]
    robots = {
        "R1": AMRAgent("R1", initial_pos=(5, 7), destination=(9, 7), destination_label="D1", initial_path=r1_path),
        "R2": AMRAgent("R2", initial_pos=(8, 3), destination=(8, 7), destination_label="D2", initial_path=r2_path),
    }
    report = detector.detect_conflicts(robots, current_tick=0, intersections={isect})
    assert report.intersection_conflicts >= 1
    ic = [c for c in report.conflicts if c.type == ConflictType.INTERSECTION_CONFLICT]
    assert len(ic) >= 1
    assert ic[0].cell == isect

def test_pairwise_analysis_three_robots(detector):
    """TEST 6: Pairwise analysis of 3 robots (R1, R2, R3) examines 3 unique pairs."""
    robots = {
        "R1": AMRAgent("R1", initial_pos=(1, 1), destination=(3, 1), destination_label="D1", initial_path=[(1, 1), (2, 1), (3, 1)]),
        "R2": AMRAgent("R2", initial_pos=(1, 5), destination=(3, 5), destination_label="D2", initial_path=[(1, 5), (2, 5), (3, 5)]),
        "R3": AMRAgent("R3", initial_pos=(1, 9), destination=(3, 9), destination_label="D3", initial_path=[(1, 9), (2, 9), (3, 9)]),
    }
    report = detector.detect_conflicts(robots, current_tick=0)
    assert report.pairs_examined == 3  # (R1,R2), (R1,R3), (R2,R3)
    assert report.total_conflicts == 0

def test_same_cell_different_times_no_vertex_conflict(detector):
    """TEST 7: Same cell visited with large time delta (> safety headway) produces no vertex conflict."""
    # R1 at (5, 5) at t=1
    r1_path = [(4, 5), (5, 5), (6, 5)]
    # R2 at (5, 5) at t=10
    r2_path = [(5, y) for y in range(15)]
    robots = {
        "R1": AMRAgent("R1", initial_pos=(4, 5), destination=(6, 5), destination_label="D1", initial_path=r1_path),
        "R2": AMRAgent("R2", initial_pos=(5, 0), destination=(5, 14), destination_label="D2", initial_path=r2_path),
    }
    # With headway=1, delta of |1 - 5| = 4 produces no vertex or following conflict
    det = ConflictDetector(safety_headway=1, intersection_window=1)
    report = det.detect_conflicts(robots, current_tick=0)
    assert report.vertex_conflicts == 0

def test_conflict_cleared_after_path_progress(warehouse):
    """TEST 8: As robots progress and past conflict point, active conflicts update/clear."""
    engine = SimulationEngine(warehouse)
    engine.fleet.trigger_conflict_demo()
    
    # Initially at t=0, conflict detected
    state_0 = engine.get_state()
    assert state_0.conflicts.total_conflicts > 0
    
    # Step simulation past the conflict point (8 steps)
    for _ in range(9):
        engine.step()
        
    state_after = engine.get_state()
    # Robots have passed or reached destinations, initial vertex conflict no longer pending ahead
    vtx_ahead = [c for c in state_after.conflicts.conflicts if c.type == ConflictType.VERTEX_CONFLICT and c.time_step > 0]
    assert len(vtx_ahead) == 0

def test_reset_clears_active_conflicts(warehouse):
    """TEST 9: Resetting simulation restores default fleet with clean conflict baseline."""
    engine = SimulationEngine(warehouse)
    engine.fleet.trigger_conflict_demo()
    assert engine.get_state().conflicts.total_conflicts > 0
    
    engine.reset()
    state_reset = engine.get_state()
    assert state_reset.status == "idle"
    # Default initial fleet routes don't collide
    assert state_reset.conflicts.vertex_conflicts == 0

def test_deterministic_sih_conflict_demo(warehouse):
    """TEST 10: trigger_conflict_demo creates deterministic R1 <-> R2 vertex & intersection conflict at (8, 7)."""
    fleet = FleetManager(warehouse)
    report = fleet.trigger_conflict_demo()
    
    assert report.total_conflicts > 0
    vtx = [c for c in report.conflicts if c.type == ConflictType.VERTEX_CONFLICT]
    assert len(vtx) >= 1
    assert vtx[0].cell == (8, 7)
    assert vtx[0].time_step == 7
    assert set(vtx[0].robots) == {"R1", "R2"}
    assert vtx[0].severity == ConflictSeverity.CRITICAL
