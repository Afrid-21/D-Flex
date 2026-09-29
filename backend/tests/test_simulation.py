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

    payloads = []

    class RecordingSocket:
        async def send_text(self, payload):
            payloads.append(payload)

    engine = SimulationEngine()
    monkeypatch.setattr(main, "active_websockets", [RecordingSocket()])
    monkeypatch.setattr(main, "last_obstacle_signature", None)

    async def broadcast_updates():
        main.broadcast_state(engine.get_state())
        await asyncio.sleep(0)
        main.broadcast_state(engine.get_state())
        await asyncio.sleep(0)
        engine.map.add_obstacle(0, 0)
        main.broadcast_state(engine.get_state())
        await asyncio.sleep(0)

    asyncio.run(broadcast_updates())

    states = [json.loads(payload) for payload in payloads]
    assert len(states) == 3
    assert "layout" in states[0]
    assert "layout" not in states[1]
    assert "layout" in states[2]
