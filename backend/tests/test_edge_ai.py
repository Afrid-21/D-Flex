import pytest
from app.core.grid import WarehouseMap
from app.core.amr_agent import FleetManager, AMRAgent
from app.algorithms.edge_ai_predictor import EdgeAIEngine
from app.schemas.warehouse import RobotStatus, CellType, HotspotInfo, EdgeAIMetrics


def test_edge_ai_heatmap_recording_and_decay():
    """Verify traversal recording and exponential heatmap decay."""
    engine = EdgeAIEngine(width=28, height=20)
    assert engine.traversal_density[7][14] == 0.0

    # Record traversals
    engine.record_traversal(14, 7, weight=2.0)
    engine.record_traversal(14, 7, weight=1.0)
    assert engine.traversal_density[7][14] == 3.0
    assert engine.historical_counts[7][14] == 2

    # Decay heatmap
    engine.decay_heatmap()
    assert engine.traversal_density[7][14] == pytest.approx(3.0 * 0.95, rel=1e-3)


def test_cell_risk_scoring():
    """Verify risk score estimation taking into account density and intersection structure."""
    wmap = WarehouseMap(width=28, height=20)
    engine = EdgeAIEngine(width=28, height=20)

    # Clean cell
    risk_empty = engine.get_cell_risk(2, 2, wmap)
    assert 0.0 <= risk_empty <= 0.4

    # Intersection cell at (8, 7)
    risk_intersection = engine.get_cell_risk(8, 7, wmap)
    assert risk_intersection >= 0.2

    # Heavy traffic cell
    for _ in range(10):
        engine.record_traversal(8, 7, weight=1.0)
    risk_heavy = engine.get_cell_risk(8, 7, wmap)
    assert risk_heavy > risk_intersection
    assert risk_heavy <= 1.0


def test_trajectory_risk_and_proactive_reroute():
    """Verify trajectory risk evaluation and proactive reroute trigger."""
    wmap = WarehouseMap(width=28, height=20)
    engine = EdgeAIEngine(width=28, height=20)

    path = [(2, 7), (3, 7), (4, 7), (5, 7), (6, 7)]
    initial_risk = engine.evaluate_trajectory_risk(path, wmap)
    assert initial_risk < 0.5
    assert not engine.should_proactively_reroute(path, 0, wmap)

    # Congest cell (4, 7)
    for _ in range(20):
        engine.record_traversal(4, 7, weight=2.0)

    elevated_risk = engine.evaluate_trajectory_risk(path, wmap)
    assert elevated_risk > initial_risk
    assert engine.should_proactively_reroute(path, 0, wmap, risk_threshold=0.5)


def test_velocity_modulation_prediction():
    """Verify predictive velocity modulation when AMRs converge on shared intersection."""
    wmap = WarehouseMap(width=28, height=20)
    engine = EdgeAIEngine(width=28, height=20)

    # Intersection at (8, 7)
    my_next = (8, 7)
    peer_near = [(8, 6)]
    peer_far = [(20, 15)]

    assert engine.should_modulate_velocity(my_next, peer_near, wmap)
    assert not engine.should_modulate_velocity(my_next, peer_far, wmap)


def test_edge_ai_scenario_a():
    """Verify Scenario A: High-congestion hotspot proactive avoidance."""
    fleet = FleetManager()
    metrics = fleet.trigger_edge_ai_scenario_a()
    assert metrics.total_predictions >= 1
    assert metrics.proactive_avoidances >= 1
    assert len(metrics.bottleneck_hotspots) > 0


def test_edge_ai_scenario_b():
    """Verify Scenario B: Predictive velocity modulation."""
    fleet = FleetManager()
    metrics = fleet.trigger_edge_ai_scenario_b()
    assert metrics.total_predictions >= 2
    assert metrics.proactive_avoidances >= 1
    assert fleet.robots["R1"].speed == 0.5


def test_edge_ai_scenario_c():
    """Verify Scenario C: Asymmetric traffic load balancing."""
    fleet = FleetManager()
    metrics = fleet.trigger_edge_ai_scenario_c()
    assert metrics.total_predictions >= 3
    assert metrics.avg_congestion_risk > 0.0
