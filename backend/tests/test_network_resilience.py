import pytest
from app.core.grid import WarehouseMap
from app.core.amr_agent import FleetManager, AMRAgent
from app.algorithms.p2p_transport import P2PTransport
from app.algorithms.network_fault_injector import NetworkFaultInjector, NetworkResilienceMetrics
from app.schemas.warehouse import P2PMessage, P2PMessageType, P2PStatus, RobotStatus


def test_network_fault_injector_mechanics():
    """Verify stochastic packet drop, latency, node isolation, and gossip sync."""
    injector = NetworkFaultInjector()
    assert injector.packet_loss_rate_pct == 0.0

    # 100% loss test
    injector.set_packet_loss(100.0)
    assert not injector.should_deliver_message("R1", "R2")
    assert injector.dropped_messages_count == 1

    # 0% loss test
    injector.set_packet_loss(0.0)
    assert injector.should_deliver_message("R1", "R2")
    assert injector.delivered_messages_count == 1

    # Node isolation / partition
    injector.isolate_node("R1")
    assert not injector.should_deliver_message("R1", "R2")
    assert not injector.should_deliver_message("R3", "R1")
    assert injector.should_deliver_message("R2", "R3")

    # Restore node
    injector.restore_node("R1")
    assert injector.should_deliver_message("R1", "R2")
    assert injector.gossip_sync_events >= 1


def test_p2p_transport_with_packet_loss():
    """Verify P2PTransport message handling under packet loss."""
    transport = P2PTransport()
    wmap = WarehouseMap(width=28, height=20)
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", warehouse_map=wmap, transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", warehouse_map=wmap, transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    # Inject 100% packet loss
    transport.fault_injector.set_packet_loss(100.0)
    msg = r1.create_state_message(1, 0.1)
    delivered_count = transport.broadcast("R1", msg, 1, 0.1)
    assert delivered_count == 0
    assert transport.get_resilience_metrics().dropped_messages_count > 0

    # Clear faults and verify normal delivery
    transport.fault_injector.clear_faults()
    delivered_count = transport.broadcast("R1", msg, 2, 0.2)
    assert delivered_count == 1
    assert transport.get_resilience_metrics().delivered_messages_count > 0


def test_network_scenario_a():
    """Verify Scenario A: 30% packet loss during negotiation."""
    fleet = FleetManager()
    metrics = fleet.trigger_network_scenario_a()
    assert metrics.packet_loss_rate_pct == 30.0
    assert metrics.total_messages_attempted > 0


def test_network_scenario_b():
    """Verify Scenario B: AMR Network Partition / Blackout & Gossip Sync."""
    fleet = FleetManager()
    metrics = fleet.trigger_network_scenario_b()
    assert metrics.gossip_sync_events >= 1
    assert metrics.safety_fallbacks_triggered >= 1


def test_network_scenario_c():
    """Verify Scenario C: Extreme 50% packet loss safety fallback."""
    fleet = FleetManager()
    metrics = fleet.trigger_network_scenario_c()
    assert metrics.packet_loss_rate_pct == 50.0
    assert metrics.simulated_latency_ms == 250.0
    assert metrics.network_health == "DEGRADED"


@pytest.mark.parametrize(
    ("params", "expected_loss", "expected_latency"),
    [
        ({"packet_loss_rate_pct": 35, "simulated_latency_ms": 125}, 35, 125),
        ({"packet_loss_pct": 45, "latency_ms": 250}, 45, 250),
    ],
)
def test_network_fault_control_accepts_frontend_and_legacy_parameter_names(
    params, expected_loss, expected_latency
):
    from app.main import _apply_network_fault_params, sim_engine

    try:
        _apply_network_fault_params(params)
        metrics = sim_engine.fleet.get_network_resilience_metrics()
        assert metrics.packet_loss_rate_pct == expected_loss
        assert metrics.simulated_latency_ms == expected_latency
    finally:
        sim_engine.set_network_faults(0.0, 0.0)
