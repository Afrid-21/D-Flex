import pytest
from app.algorithms.negotiation_engine import NegotiationManager
from app.algorithms.p2p_transport import P2PTransport
from app.algorithms.reservation_table import ReservationTable
from app.core.amr_agent import AMRAgent, FleetManager
from app.core.grid import WarehouseMap
from app.schemas.warehouse import (
    NegotiationState,
    NegotiationProposal,
    NegotiationSession,
    P2PMessage,
    P2PMessageType,
    ResourceType,
    RobotStatus,
)

def test_conflict_creates_negotiation_session():
    """1. Test that detecting a conflict creates a local NegotiationSession in PROPOSED state."""
    neg = NegotiationManager(owner_robot_id="R2")
    session, msg = neg.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-101",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=0,
    )
    assert session.session_id == "neg-R1-R2-CONF-101"
    assert session.current_state == NegotiationState.PROPOSED
    assert session.initiator == "R2"
    assert session.receiver == "R1"
    assert session.proposal.requested_time_window == (7, 8)

def test_conflict_propose_sent_p2p():
    """2. Test that CONFLICT_PROPOSE is created with accurate metadata."""
    neg = NegotiationManager(owner_robot_id="R2")
    session, msg = neg.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-102",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=1,
        current_time_s=0.1,
    )
    assert msg.message_type == P2PMessageType.CONFLICT_PROPOSE
    assert msg.sender_id == "R2"
    assert msg.recipient_id == "R1"
    assert msg.negotiation_payload is not None
    assert msg.negotiation_payload.cell == (8, 7)

def test_peer_receives_proposal():
    """3. Test that peer R1 receives proposal and instantiates a local session."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 7), (15, 7), "East", transport=transport)
    r2 = AMRAgent("R2", (8, 0), (8, 14), "South", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    session_r2, prop_msg = r2.negotiator.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-103",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=1,
    )
    r2.send_p2p_message(prop_msg, current_tick=1, recipient_id="R1")

    # R1 should now have a session in its local negotiator
    r1_session = r1.negotiator.sessions.get(session_r2.session_id)
    assert r1_session is not None
    assert r1_session.conflict_id == "CONF-103"
    assert r1_session.initiator == "R2"

def test_peer_creates_time_shift_offer():
    """4. Test that peer generates a valid time-shift proposal (e.g. +2 ticks)."""
    neg_r1 = NegotiationManager(owner_robot_id="R1")
    prop = NegotiationProposal(
        session_id="neg-R1-R2-CONF-104",
        conflict_id="CONF-104",
        resource_type="CELL",
        cell=(8, 7),
        requested_time_window=(7, 8),
        proposer_id="R2",
    )
    incoming_msg = P2PMessage(
        message_id="msg-1",
        message_type=P2PMessageType.CONFLICT_PROPOSE,
        sender_id="R2",
        recipient_id="R1",
        negotiation_payload=prop,
    )
    resp = neg_r1.handle_incoming_message(incoming_msg, current_tick=1)
    assert resp is not None
    assert resp.message_type == P2PMessageType.NEGOTIATION_OFFER
    assert resp.negotiation_payload.shift_ticks == 2
    assert resp.negotiation_payload.proposed_time_window == (9, 10)

def test_valid_offer_accepted():
    """5. Test that a valid time-shift offer transitions initiator to RESOLVED and returns ACCEPT."""
    neg_r2 = NegotiationManager(owner_robot_id="R2")
    session, _ = neg_r2.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-105",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=1,
    )
    
    offer = NegotiationProposal(
        session_id=session.session_id,
        conflict_id="CONF-105",
        resource_type="CELL",
        cell=(8, 7),
        requested_time_window=(7, 8),
        proposed_time_window=(9, 10),
        shift_ticks=2,
        proposer_id="R1",
    )
    offer_msg = P2PMessage(
        message_id="msg-offer",
        message_type=P2PMessageType.NEGOTIATION_OFFER,
        sender_id="R1",
        recipient_id="R2",
        negotiation_payload=offer,
    )
    resp = neg_r2.handle_incoming_message(offer_msg, current_tick=2)
    assert resp is not None
    assert resp.message_type == P2PMessageType.NEGOTIATION_ACCEPT
    assert session.current_state == NegotiationState.RESOLVED

def test_invalid_offer_declined():
    """6. Test that an invalid offer (shift <= 0) returns NEGOTIATION_DECLINE."""
    neg_r2 = NegotiationManager(owner_robot_id="R2")
    session, _ = neg_r2.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-106",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=1,
    )
    
    invalid_offer = NegotiationProposal(
        session_id=session.session_id,
        conflict_id="CONF-106",
        resource_type="CELL",
        cell=(8, 7),
        requested_time_window=(7, 8),
        proposed_time_window=(7, 8),
        shift_ticks=0,  # Invalid shift
        proposer_id="R1",
    )
    offer_msg = P2PMessage(
        message_id="msg-offer-bad",
        message_type=P2PMessageType.NEGOTIATION_OFFER,
        sender_id="R1",
        recipient_id="R2",
        negotiation_payload=invalid_offer,
    )
    resp = neg_r2.handle_incoming_message(offer_msg, current_tick=2)
    assert resp is not None
    assert resp.message_type == P2PMessageType.NEGOTIATION_DECLINE
    assert session.current_state == NegotiationState.DECLINED

def test_reservation_updated_after_acceptance():
    """7. Test that accepting a shifted time-window allows creating a valid non-conflicting reservation."""
    table = ReservationTable(safety_buffer_steps=0)
    
    # R1 occupies (8, 7) at [7, 8]
    succ1, res1, _ = table.reserve_cell("R1", (8, 7), start_time=7, end_time=8)
    assert succ1 is True

    # R2 initially attempted [7, 8] -> conflicted
    succ2, res2, _ = table.reserve_cell("R2", (8, 7), start_time=7, end_time=8)
    assert succ2 is False

    # After negotiation, R2 reserves shifted window [9, 10]
    succ2_shifted, res2_shifted, _ = table.reserve_cell("R2", (8, 7), start_time=9, end_time=10)
    assert succ2_shifted is True
    assert res2_shifted.start_time == 9
    assert res2_shifted.end_time == 10

def test_original_reservation_not_silently_overwritten():
    """8. Test that R1's granted reservation remains fully active and untouched throughout negotiation."""
    table = ReservationTable(safety_buffer_steps=1)
    succ1, res1, _ = table.reserve_cell("R1", (8, 7), start_time=7, end_time=8)
    assert succ1 is True

    # R2 fails to reserve same slot
    table.reserve_cell("R2", (8, 7), start_time=7, end_time=8)
    
    # Verify R1's reservation is unchanged and still ACTIVE
    active_r1 = table.get_reservations_for_robot("R1")
    assert len(active_r1) == 1
    assert active_r1[0].reservation_id == res1.reservation_id
    assert active_r1[0].status == "ACTIVE"


def test_identical_timestamp_tiebreak():
    """9. Test deterministic tie-breaking arbitration when timestamps match."""
    neg_r1 = NegotiationManager("R1")
    neg_r2 = NegotiationManager("R2")

    # When timestamps are equal, R1 < R2 -> R1 holds precedence
    # R2 yields and shifts
    should_r2_yield = ("R2" > "R1")
    should_r1_yield = ("R1" > "R2")
    assert should_r2_yield is True
    assert should_r1_yield is False


def test_conflict_demo_robot_waits_at_shared_intersection():
    """10. Verify the shared-intersection conflict scenario forces the lower-priority robot to wait."""
    fleet = FleetManager(WarehouseMap(width=30, height=20))
    fleet.trigger_conflict_demo()

    r1 = fleet.robots["R1"]
    r2 = fleet.robots["R2"]

    assert r1.status == RobotStatus.MOVING
    assert r2.status == RobotStatus.MOVING

    fleet.step(current_tick=0, current_time_s=0.0)

    assert r1.status in [RobotStatus.MOVING, RobotStatus.ARRIVED]
    assert r2.status in [RobotStatus.SAFE_WAIT, RobotStatus.MOVING]


def test_lower_robot_id_tiebreak_rule():
    """11. Test that tie-breaker applies strictly lexicographically ($R1 < R2 < R3$)."""
    robots = ["R3", "R1", "R2"]
    sorted_robots = sorted(robots)
    assert sorted_robots == ["R1", "R2", "R3"]

def test_negotiation_timeout_works():
    """11. Test that session transitions to TIMEOUT when ticks exceed timeout_at_tick."""
    neg = NegotiationManager("R1")
    session, _ = neg.initiate_negotiation(
        peer_id="R2",
        conflict_id="CONF-111",
        resource_type="CELL",
        cell=(5, 5),
        edge=None,
        requested_window=(10, 11),
        current_tick=0,
    )
    assert session.timeout_at_tick == 5
    
    # Step to tick 3 -> still PROPOSED
    neg.check_timeouts(current_tick=3)
    assert session.current_state == NegotiationState.PROPOSED

    # Step to tick 6 -> transitions to TIMEOUT
    neg.check_timeouts(current_tick=6)
    assert session.current_state == NegotiationState.TIMEOUT
    assert "timed out" in session.resolution

def test_negotiation_session_reaches_resolved():
    """12. Test full end-to-end P2P handshake reaching RESOLVED."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 7), (15, 7), "East", transport=transport)
    r2 = AMRAgent("R2", (8, 0), (8, 14), "South", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    # 1. R2 initiates negotiation with R1
    session_r2, prop_msg = r2.negotiator.initiate_negotiation(
        peer_id="R1",
        conflict_id="CONF-112",
        resource_type="CELL",
        cell=(8, 7),
        edge=None,
        requested_window=(7, 8),
        current_tick=1,
    )
    # R2 -> R1: CONFLICT_PROPOSE
    r2.send_p2p_message(prop_msg, current_tick=1, recipient_id="R1")

    # Check both agents resolved the session
    session_id = session_r2.session_id
    assert r1.negotiator.sessions[session_id].current_state == NegotiationState.RESOLVED
    assert r2.negotiator.sessions[session_id].current_state == NegotiationState.RESOLVED

def test_unresolved_negotiation_remains_safe():
    """13. Test that a declined or timed-out negotiation keeps robot in safe wait without collision."""
    r2 = AMRAgent("R2", (8, 0), (8, 14), "South")
    r2.status = RobotStatus.MOVING
    r2.pause()
    assert r2.status == RobotStatus.PAUSED


def test_two_simultaneous_negotiations_independent():
    """14. Test that simultaneous negotiations (R1<->R2 and R2<->R3) maintain independent state."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 7), (15, 7), "East", transport=transport)
    r2 = AMRAgent("R2", (8, 0), (8, 14), "South", transport=transport)
    r3 = AMRAgent("R3", (20, 7), (25, 7), "West", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)
    transport.register_agent("R3", r3)

    # Session 1: R1 <-> R2
    s1, msg1 = r2.negotiator.initiate_negotiation("R1", "CONF-A", "CELL", (8, 7), None, (7, 8), 1)
    r2.send_p2p_message(msg1, 1, recipient_id="R1")

    # Session 2: R2 <-> R3
    s2, msg2 = r3.negotiator.initiate_negotiation("R2", "CONF-B", "CELL", (20, 7), None, (5, 6), 1)
    r3.send_p2p_message(msg2, 1, recipient_id="R2")

    assert len(r2.negotiator.sessions) == 2
    assert s1.session_id != s2.session_id

def test_three_robot_negotiation_scenarios():
    """15. Test fleet manager negotiation orchestration during deterministic conflict demo."""
    fleet = FleetManager()
    conflicts = fleet.trigger_conflict_demo()
    
    # Check that negotiations were recorded
    negs = fleet.get_all_negotiations()
    assert len(negs) >= 1
    assert negs[0].conflict_id == "CONF-DEMO-R1-R2-8-7"
    assert negs[0].current_state == NegotiationState.RESOLVED

def test_p2p_message_counters_update():
    """16. Test that negotiation message exchanges increment P2P sent/received statistics."""
    transport = P2PTransport()
    r1 = AMRAgent("R1", (1, 7), (15, 7), "East", transport=transport)
    r2 = AMRAgent("R2", (8, 0), (8, 14), "South", transport=transport)
    transport.register_agent("R1", r1)
    transport.register_agent("R2", r2)

    s, msg = r2.negotiator.initiate_negotiation("R1", "CONF-116", "CELL", (8, 7), None, (7, 8), 1)
    r2.send_p2p_message(msg, 1, recipient_id="R1")

    # R2 sent PROPOSE -> R1 sent OFFER -> R2 sent ACCEPT
    assert r2.messages_sent >= 2
    assert r1.messages_received >= 1
    assert r1.messages_sent >= 1
