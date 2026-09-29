import pytest
from app.algorithms.benchmark_engine import BenchmarkEngine
from app.core.simulation import SimulationEngine


def test_benchmark_engine_execution():
    engine = BenchmarkEngine()
    metrics = engine.execute_full_suite(fleet_size=3)
    assert metrics.overall_efficiency_score > 90.0
    assert metrics.throughput_improvement_pct > 50.0
    assert metrics.latency_reduction_pct > 70.0
    assert len(metrics.results) == 7

    # Check metrics fields
    optimality = next(r for r in metrics.results if "Path Optimality" in r.metric_name)
    assert optimality.dflex_value >= 95.0
    assert optimality.baseline_value < optimality.dflex_value


def test_simulation_engine_benchmark_trigger():
    sim = SimulationEngine()
    state_before = sim.get_state()
    assert state_before.benchmarks is not None

    sim.run_benchmark_suite()
    state_after = sim.get_state()
    assert state_after.benchmarks.benchmarks_completed >= 1
