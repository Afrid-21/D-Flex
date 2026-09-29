import pytest
from app.algorithms.centralized_baseline import CentralizedBaselineEngine
from app.core.simulation import SimulationEngine


def test_centralized_baseline_initial_metrics():
    engine = CentralizedBaselineEngine()
    metrics = engine.get_metrics()
    assert metrics.server_online is True
    assert metrics.spof_active is False
    assert metrics.centralized_uptime_pct == 100.0
    assert metrics.distributed_uptime_pct == 100.0
    assert metrics.distributed_latency_ms < metrics.centralized_latency_ms


def test_centralized_spof_failure_simulation():
    engine = CentralizedBaselineEngine()
    engine.trigger_spof_failure()
    metrics = engine.get_metrics()
    assert metrics.server_online is False
    assert metrics.spof_active is True
    assert metrics.centralized_throughput == 0.0
    assert metrics.distributed_throughput > 0.0

    # Test tick under failure
    engine.update_tick(3, 1)
    assert engine.failed_requests_count > 0

    # Restore server
    engine.restore_server()
    restored_metrics = engine.get_metrics()
    assert restored_metrics.server_online is True
    assert restored_metrics.spof_active is False


def test_simulation_engine_centralized_comparator_integration():
    sim = SimulationEngine()
    state = sim.get_state()
    assert state.centralized_comparator is not None
    assert state.centralized_comparator.server_online is True

    sim.trigger_spof_failure()
    failed_state = sim.get_state()
    assert failed_state.centralized_comparator.server_online is False

    sim.restore_centralized_server()
    recovered_state = sim.get_state()
    assert recovered_state.centralized_comparator.server_online is True
