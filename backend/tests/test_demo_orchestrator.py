import pytest
from app.algorithms.demo_orchestrator import DemoOrchestrator
from app.core.simulation import SimulationEngine


def test_demo_orchestrator_initialization():
    orchestrator = DemoOrchestrator()
    metrics = orchestrator.get_metrics()
    assert metrics.is_active is False
    assert metrics.current_stage == 1
    assert len(metrics.stages) == 6


def test_demo_orchestrator_lifecycle():
    orchestrator = DemoOrchestrator()
    orchestrator.start_demo()
    metrics = orchestrator.get_metrics()
    assert metrics.is_active is True
    assert metrics.stages[0].status == "ACTIVE"

    # Step through ticks
    for tick in range(1, 30):
        orchestrator.step_demo(tick)

    stepped_metrics = orchestrator.get_metrics()
    assert stepped_metrics.current_stage >= 2
    assert stepped_metrics.stages[0].status == "COMPLETED"


def test_simulation_engine_e2e_demo_integration():
    sim = SimulationEngine()
    state = sim.get_state()
    assert state.demo_orchestrator is not None

    sim.trigger_full_e2e_demo()
    active_state = sim.get_state()
    assert active_state.demo_orchestrator.is_active is True
