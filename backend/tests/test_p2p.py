import pytest
from app.algorithms.neighbor_table import NeighborTable
from app.algorithms.p2p_transport import P2PTransport
from app.core.amr_agent import AMRAgent, FleetManager
from app.schemas.warehouse import (
    P2PMessage,
    P2PMessageType,
    P2PStatus,
    RobotStatus,
    RobotStatePayload,
    RobotIntentPayload,
    HeartbeatPayload,
)

def test_r1_send_state_update():
    """1. Test that R1 creates and broadcasts a valid STATE_UPDATE message."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", speed=1.0, transport=transport)
    transport.register_agent("R1", r1)

    msg = r1.create_state_message(current_tick=1, current_time_s=0.1)
    assert msg.message_type == P2PMessageType.STATE_UPDATE
    assert msg.sender_id == "R1"
    assert msg.sequence_number == 1
    assert msg.state_payload is not None
    assert msg.state_payload.position == (1, 2)
    assert msg.state_payload.status == RobotStatus.IDLE

def test_r2_receives_r1_state():
    """2. Test that R2 receives R1's state update and populates its local neighbor table."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    msg = r1.create_state_message(current_tick=2, current_time_s=0.2)
    r1.send_p2p_message(msg, current_tick=2, current_time_s=0.2)

    assert r1.messages_sent == 1
    assert r2.messages_received == 1

    r2_n_r1 = r2.neighbor_table.get_neighbor("R1")
    assert r2_n_r1 is not None
    assert r2_n_r1.robot_id == "R1"
    assert r2_n_r1.position == (1, 2)
    assert r2_n_r1.p2p_status == P2PStatus.CONNECTED
    assert r2_n_r1.last_seen_tick == 2

def test_r3_receives_r1_state():
    """3. Test that R3 receives R1's state update simultaneously in a broadcast."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    r3 = AMRAgent("R3", (8, 17), (2, 1), "CHG-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)
    transport.register_agent("R3", r3)

    msg = r1.create_state_message(current_tick=5, current_time_s=0.5)
    delivered = r1.send_p2p_message(msg, current_tick=5, current_time_s=0.5)

    assert delivered is True
    assert r1.messages_sent == 1
    assert r2.messages_received == 1
    assert r3.messages_received == 1

    r3_n_r1 = r3.neighbor_table.get_neighbor("R1")
    assert r3_n_r1 is not None
    assert r3_n_r1.position == (1, 2)

def test_intent_messages_transmitted():
    """4. Test that INTENT_UPDATE messages carry next_cell, planned waypoints, and ETAs."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport, initial_path=[(1, 2), (1, 3), (1, 4), (1, 5)])
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    intent_msg = r1.create_intent_message(current_tick=1, current_time_s=0.1)
    assert intent_msg.message_type == P2PMessageType.INTENT_UPDATE
    assert intent_msg.intent_payload.next_cell == (1, 3)
    assert intent_msg.intent_payload.eta_to_next > 0
    assert (1, 4) in intent_msg.intent_payload.planned_cells

    r1.send_p2p_message(intent_msg, current_tick=1, current_time_s=0.1)
    r2_n_r1 = r2.neighbor_table.get_neighbor("R1")
    assert r2_n_r1.next_cell == (1, 3)
    assert r2_n_r1.planned_cells == [(1, 2), (1, 3), (1, 4), (1, 5)]

def test_reservation_ids_transmitted():
    """5. Test that active reservation IDs are included in P2P message payloads."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    r1.local_reservation_ids = ["RES-R1-CELL-(1,2)-0", "RES-R1-CELL-(1,3)-1"]
    msg = r1.create_intent_message(current_tick=3, current_time_s=0.3)
    assert "RES-R1-CELL-(1,2)-0" in msg.reservation_ids

    r1.send_p2p_message(msg, current_tick=3, current_time_s=0.3)
    r2_n_r1 = r2.neighbor_table.get_neighbor("R1")
    assert "RES-R1-CELL-(1,2)-0" in r2_n_r1.reservation_ids

def test_heartbeats_transmitted():
    """6. Test that periodic HEARTBEAT messages are generated and processed."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (5, 5), (10, 5), "Target", transport=transport)
    r2 = AMRAgent("R2", (10, 5), (15, 5), "Target", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    hb = r1.create_heartbeat_message(current_tick=10, current_time_s=1.0)
    assert hb.message_type == P2PMessageType.HEARTBEAT
    assert hb.heartbeat_payload.position == (5, 5)

    r1.send_p2p_message(hb, current_tick=10, current_time_s=1.0)
    neighbor = r2.neighbor_table.get_neighbor("R1")
    assert neighbor.last_seen_tick == 10
    assert neighbor.p2p_status == P2PStatus.CONNECTED

def test_sequence_numbers_increase():
    """7. Test that each robot increments sequence numbers monotonically."""
    r1 = AMRAgent("R1", (0, 0), (5, 5), "Target")
    s1 = r1.next_sequence_number()
    s2 = r1.next_sequence_number()
    s3 = r1.next_sequence_number()
    assert s1 == 1
    assert s2 == 2
    assert s3 == 3
    assert r1.sequence_number == 3

def test_older_messages_ignored():
    """8. Test that NeighborTable rejects out-of-order or stale sequence numbers."""
    table = NeighborTable(owner_robot_id="R2")
    
    # Message 1 with seq=5
    msg1 = P2PMessage(
        message_id="msg-5",
        message_type=P2PMessageType.HEARTBEAT,
        sender_id="R1",
        sequence_number=5,
        heartbeat_payload=HeartbeatPayload(status=RobotStatus.IDLE, position=(1, 1), battery=100.0),
    )
    assert table.update_neighbor_from_message(msg1, current_tick=1) is True

    # Stale Message with seq=3
    msg_stale = P2PMessage(
        message_id="msg-3",
        message_type=P2PMessageType.HEARTBEAT,
        sender_id="R1",
        sequence_number=3,
        heartbeat_payload=HeartbeatPayload(status=RobotStatus.IDLE, position=(0, 0), battery=100.0),
    )
    assert table.update_neighbor_from_message(msg_stale, current_tick=2) is False
    
    # Verify neighbor table kept data from msg1 (seq=5)
    n = table.get_neighbor("R1")
    assert n.position == (1, 1)
    assert n.last_seq == 5

def test_neighbor_table_updates_correctly():
    """9. Test comprehensive NeighborTable CRUD operations."""
    table = NeighborTable(owner_robot_id="R1")
    msg = P2PMessage(
        message_id="msg-1",
        message_type=P2PMessageType.STATE_UPDATE,
        sender_id="R2",
        sequence_number=1,
        state_payload=RobotStatePayload(
            position=(10, 5),
            speed=1.5,
            direction="S",
            status=RobotStatus.MOVING,
            battery=88.5,
        ),
    )
    table.update_neighbor_from_message(msg, current_tick=10, current_time_s=1.0)
    
    neighbor = table.get_neighbor("R2")
    assert neighbor is not None
    assert neighbor.position == (10, 5)
    assert neighbor.speed == 1.5
    assert neighbor.direction == "S"
    assert neighbor.battery == 88.5

    table.remove_neighbor("R2")
    assert table.get_neighbor("R2") is None

def test_multiple_peers_maintained():
    """10. Test that an AMR maintains distinct records for all connected peers."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    r3 = AMRAgent("R3", (8, 17), (2, 1), "CHG-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)
    transport.register_agent("R3", r3)

    # R2 and R3 broadcast
    r2.send_p2p_message(r2.create_state_message(current_tick=1), current_tick=1)
    r3.send_p2p_message(r3.create_state_message(current_tick=1), current_tick=1)

    r1_neighbors = r1.neighbor_table.get_all_neighbors()
    assert len(r1_neighbors) == 2
    r_ids = {n.robot_id for n in r1_neighbors}
    assert r_ids == {"R2", "R3"}

def test_stale_peer_detection():
    """11. Test that NeighborTable marks peers STALE when no heartbeat arrives within timeout."""
    table = NeighborTable(owner_robot_id="R1")
    msg = P2PMessage(
        message_id="msg-1",
        message_type=P2PMessageType.HEARTBEAT,
        sender_id="R2",
        sequence_number=1,
        heartbeat_payload=HeartbeatPayload(status=RobotStatus.IDLE, position=(1, 1), battery=100.0),
    )
    table.update_neighbor_from_message(msg, current_tick=10)
    assert table.get_neighbor("R2").p2p_status == P2PStatus.CONNECTED

    # Check at tick 20 (delta = 10, timeout = 15) -> still CONNECTED
    table.check_stale_peers(current_tick=20, timeout_ticks=15)
    assert table.get_neighbor("R2").p2p_status == P2PStatus.CONNECTED

    # Check at tick 30 (delta = 20 > 15) -> marked STALE
    table.check_stale_peers(current_tick=30, timeout_ticks=15)
    assert table.get_neighbor("R2").p2p_status == P2PStatus.STALE

def test_p2p_status_transitions():
    """12. Test is_neighbor_alive helper."""
    table = NeighborTable(owner_robot_id="R1")
    msg = P2PMessage(
        message_id="msg-1",
        message_type=P2PMessageType.HEARTBEAT,
        sender_id="R3",
        sequence_number=1,
        heartbeat_payload=HeartbeatPayload(status=RobotStatus.IDLE, position=(8, 17), battery=100.0),
    )
    table.update_neighbor_from_message(msg, current_tick=5)
    assert table.is_neighbor_alive("R3", current_tick=10, timeout_ticks=15) is True
    assert table.is_neighbor_alive("R3", current_tick=25, timeout_ticks=15) is False
    assert table.is_neighbor_alive("UNKNOWN", current_tick=10) is False

def test_message_counters_accurate():
    """13. Test that sent/received message statistics increment accurately."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 2), (1, 5), "PK-01", transport=transport)
    r2 = AMRAgent("R2", (20, 2), (25, 5), "DP-01", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    for i in range(5):
        msg = r1.create_state_message(current_tick=i)
        r1.send_p2p_message(msg, current_tick=i)

    assert r1.messages_sent == 5
    assert r2.messages_received == 5
    assert r2.messages_sent == 0
    assert r1.messages_received == 0

def test_three_robot_mesh_communication():
    """14. Test decentralized 3-robot mesh communication without central controller."""
    fleet = FleetManager()
    # Step simulation 10 ticks
    for t in range(1, 11):
        fleet.step(current_tick=t, current_time_s=t * 0.1)

    r1 = fleet.robots["R1"]
    r2 = fleet.robots["R2"]
    r3 = fleet.robots["R3"]

    # Check each robot has 2 neighbors
    assert len(r1.neighbor_table.get_all_neighbors()) == 2
    assert len(r2.neighbor_table.get_all_neighbors()) == 2
    assert len(r3.neighbor_table.get_all_neighbors()) == 2

    # Check all messages exchanged
    summary = fleet.p2p_transport.get_network_summary(current_tick=10)
    assert summary.total_messages_exchanged > 0
    assert set(summary.active_nodes) == {"R1", "R2", "R3"}
    assert summary.mesh_status == "CONNECTED"
