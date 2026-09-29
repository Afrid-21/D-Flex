import asyncio
import json
import pytest
from app.core.simulation import SimulationEngine
from app.schemas.warehouse import SimulationStatus

def test_simulation_initial_state():
    engine = SimulationEngine()
    state = engine.get_state()
    assert state.status == SimulationStatus.IDLE
    assert state.tick == 0
    assert state.elapsed_seconds == 0.0

def test_simulation_step_and_pause():
    engine = SimulationEngine()
    engine.step()
    assert engine.tick_count == 1
    assert engine.elapsed_seconds > 0.0

    engine.step()
    assert engine.tick_count == 2

    # Reset
    engine.reset()
    assert engine.tick_count == 0
    assert engine.elapsed_seconds == 0.0
    assert engine.status == SimulationStatus.IDLE

def test_simulation_speed_multiplier():
    engine = SimulationEngine()
    engine.set_speed(2.5)
    assert engine.speed_multiplier == 2.5

    # Clamp test
    engine.set_speed(15.0)
    assert engine.speed_multiplier == 10.0

    engine.set_speed(0.01)
    assert engine.speed_multiplier == 0.1


def test_fleet_summary_is_reported():
    engine = SimulationEngine()
    state = engine.get_state()

    assert state.fleet_summary.total_robots == 3
    assert state.fleet_summary.available_robots >= 1
    assert state.fleet_summary.utilization_pct >= 0.0
    assert state.fleet_summary.health_status in {"HEALTHY", "DEGRADED", "WARNING"}


def test_websocket_broadcast_only_includes_layout_when_it_changes(monkeypatch):
    from app import main

    socket = object()
    queue = asyncio.Queue(maxsize=1)
    engine = SimulationEngine()
    monkeypatch.setattr(main, "active_websockets", [socket])
    monkeypatch.setattr(main, "websocket_state_queues", {socket: queue})
    monkeypatch.setattr(main, "last_obstacle_signature", None)

    main.broadcast_state(engine.get_state())
    first_state = json.loads(queue.get_nowait())
    main.broadcast_state(engine.get_state())
    steady_state = json.loads(queue.get_nowait())
    engine.map.add_obstacle(0, 0)
    main.broadcast_state(engine.get_state())
    changed_map_state = json.loads(queue.get_nowait())

    assert "layout" in first_state
    assert "layout" not in steady_state
    assert "layout" in changed_map_state

    main._queue_latest_state(queue, "stale")
    main._queue_latest_state(queue, "latest")
    assert queue.qsize() == 1
    assert queue.get_nowait() == "latest"
