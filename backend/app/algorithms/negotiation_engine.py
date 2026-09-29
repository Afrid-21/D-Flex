from typing import Dict, List, Optional, Tuple, Any
from app.schemas.warehouse import (
    NegotiationState,
    NegotiationProposal,
    NegotiationSession,
    P2PMessage,
    P2PMessageType,
    ResourceType,
    RobotStatus,
)
from app.config import config

class NegotiationManager:
    """
    Decentralized conflict negotiation engine embedded directly inside each AMRAgent.
    Maintains local negotiation sessions, executes deterministic state transitions,
    evaluates time-shift proposals, and applies arbitration rules.
    
    CRITICAL ARCHITECTURE INVARIANT:
    Operates strictly as a local peer agent. No central resolver exists.
    """

    def __init__(self, owner_robot_id: str):
        self.owner_robot_id: str = owner_robot_id
        self.sessions: Dict[str, NegotiationSession] = {}
        self.session_counter: int = 0
        self.timeout_ticks: int = config.negotiation_timeout_ticks

    def _generate_session_id(self, peer_id: str, conflict_id: str) -> str:
        participants = sorted([self.owner_robot_id, peer_id])
        return f"neg-{participants[0]}-{participants[1]}-{conflict_id}"

    def initiate_negotiation(
        self,
        peer_id: str,
        conflict_id: str,
        resource_type: str,
        cell: Optional[Tuple[int, int]],
        edge: Optional[Tuple[Tuple[int, int], Tuple[int, int]]],
        requested_window: Tuple[int, int],
        current_tick: int,
        current_time_s: float = 0.0,
        reservation_id: Optional[str] = None,
    ) -> Tuple[NegotiationSession, P2PMessage]:
        """
        Initiates a new negotiation session when a conflict or reservation collision is detected.
        Sends a CONFLICT_PROPOSE message to the peer.
        """
        session_id = self._generate_session_id(peer_id, conflict_id)
        proposal = NegotiationProposal(
            session_id=session_id,
            conflict_id=conflict_id,
            resource_type=resource_type,
            cell=cell,
            edge=edge,
            requested_time_window=requested_window,
            reservation_id=reservation_id,
            proposer_id=self.owner_robot_id,
            reason="Spatial/Temporal Collision Detected",
        )

        session = NegotiationSession(
            session_id=session_id,
            conflict_id=conflict_id,
            participants=[self.owner_robot_id, peer_id],
            initiator=self.owner_robot_id,
            receiver=peer_id,
            current_state=NegotiationState.PROPOSED,
            created_at_tick=current_tick,
            last_updated_tick=current_tick,
            resource_type=resource_type,
            cell=cell,
            edge=edge,
            proposal=proposal,
            timeout_at_tick=current_tick + self.timeout_ticks,
        )
        self.sessions[session_id] = session

        msg = P2PMessage(
            message_id=f"msg-neg-prop-{self.owner_robot_id}-{current_tick}",
            message_type=P2PMessageType.CONFLICT_PROPOSE,
            sender_id=self.owner_robot_id,
            recipient_id=peer_id,
            timestamp_tick=current_tick,
            timestamp_s=current_time_s,
            negotiation_payload=proposal,
        )
        return session, msg

    def handle_incoming_message(
        self,
        message: P2PMessage,
        current_tick: int,
        current_time_s: float = 0.0,
        agent_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[P2PMessage]:
        """
        Processes an incoming negotiation message and returns a response P2PMessage if needed.
        """
        payload = message.negotiation_payload
        if not payload:
            return None

        session_id = payload.session_id or self._generate_session_id(message.sender_id, payload.conflict_id)
        msg_type = message.message_type

        # 1. Incoming CONFLICT_PROPOSE
        if msg_type == P2PMessageType.CONFLICT_PROPOSE:
            session = NegotiationSession(
                session_id=session_id,
                conflict_id=payload.conflict_id,
                participants=[message.sender_id, self.owner_robot_id],
                initiator=message.sender_id,
                receiver=self.owner_robot_id,
                current_state=NegotiationState.OFFER_RECEIVED,
                created_at_tick=current_tick,
                last_updated_tick=current_tick,
                resource_type=payload.resource_type,
                cell=payload.cell,
                edge=payload.edge,
                proposal=payload,
                timeout_at_tick=current_tick + self.timeout_ticks,
            )
            self.sessions[session_id] = session

            # Evaluate time-shift possibility using local arbitration rules
            req_start, req_end = payload.requested_time_window
            
            # Deterministic Arbitration Rule:
            # Earlier booking gets precedence; if equal, lower robot ID string wins.
            sender_id = message.sender_id
            owner_id = self.owner_robot_id
            
            # Check if owner yields (owner ID > sender ID if timestamps identical)
            should_owner_shift = (owner_id > sender_id)

            if should_owner_shift:
                # Propose time shifting owner's interval (+2 ticks)
                shift_amount = 2
                shifted_window = (req_start + shift_amount, req_end + shift_amount)
                offer_payload = NegotiationProposal(
                    session_id=session_id,
                    conflict_id=payload.conflict_id,
                    resource_type=payload.resource_type,
                    cell=payload.cell,
                    edge=payload.edge,
                    requested_time_window=payload.requested_time_window,
                    proposed_time_window=shifted_window,
                    shift_ticks=shift_amount,
                    proposer_id=self.owner_robot_id,
                    reason=f"{self.owner_robot_id} yields via +{shift_amount}t time-shift",
                    status="OFFERED",
                )
                session.response = offer_payload
                session.current_state = NegotiationState.WAITING_RESPONSE
                session.last_updated_tick = current_tick

                return P2PMessage(
                    message_id=f"msg-neg-off-{self.owner_robot_id}-{current_tick}",
                    message_type=P2PMessageType.NEGOTIATION_OFFER,
                    sender_id=self.owner_robot_id,
                    recipient_id=sender_id,
                    timestamp_tick=current_tick,
                    timestamp_s=current_time_s,
                    negotiation_payload=offer_payload,
                )
            else:
                # Owner has precedence -> Requests sender to shift
                shift_amount = 2
                shifted_window = (req_start + shift_amount, req_end + shift_amount)
                offer_payload = NegotiationProposal(
                    session_id=session_id,
                    conflict_id=payload.conflict_id,
                    resource_type=payload.resource_type,
                    cell=payload.cell,
                    edge=payload.edge,
                    requested_time_window=payload.requested_time_window,
                    proposed_time_window=shifted_window,
                    shift_ticks=shift_amount,
                    proposer_id=self.owner_robot_id,
                    reason=f"{self.owner_robot_id} has precedence; requests {sender_id} +{shift_amount}t shift",
                    status="OFFERED",
                )
                session.response = offer_payload
                session.current_state = NegotiationState.WAITING_RESPONSE
                session.last_updated_tick = current_tick

                return P2PMessage(
                    message_id=f"msg-neg-off-{self.owner_robot_id}-{current_tick}",
                    message_type=P2PMessageType.NEGOTIATION_OFFER,
                    sender_id=self.owner_robot_id,
                    recipient_id=sender_id,
                    timestamp_tick=current_tick,
                    timestamp_s=current_time_s,
                    negotiation_payload=offer_payload,
                )

        # 2. Incoming NEGOTIATION_OFFER
        elif msg_type == P2PMessageType.NEGOTIATION_OFFER:
            session = self.sessions.get(session_id)
            if not session:
                return None

            session.response = payload
            session.last_updated_tick = current_tick

            # Validate the offer
            if payload.proposed_time_window and payload.shift_ticks > 0:
                session.current_state = NegotiationState.RESOLVED
                session.resolution = f"Accepted +{payload.shift_ticks}t time-shift ({payload.proposed_time_window[0]}-{payload.proposed_time_window[1]})"

                accept_payload = NegotiationProposal(
                    session_id=session_id,
                    conflict_id=payload.conflict_id,
                    resource_type=payload.resource_type,
                    cell=payload.cell,
                    edge=payload.edge,
                    requested_time_window=payload.requested_time_window,
                    proposed_time_window=payload.proposed_time_window,
                    shift_ticks=payload.shift_ticks,
                    proposer_id=self.owner_robot_id,
                    status="ACCEPTED",
                )

                return P2PMessage(
                    message_id=f"msg-neg-acc-{self.owner_robot_id}-{current_tick}",
                    message_type=P2PMessageType.NEGOTIATION_ACCEPT,
                    sender_id=self.owner_robot_id,
                    recipient_id=message.sender_id,
                    timestamp_tick=current_tick,
                    timestamp_s=current_time_s,
                    negotiation_payload=accept_payload,
                )
            else:
                session.current_state = NegotiationState.DECLINED
                session.resolution = "Offer rejected -> SAFE WAIT"
                decline_payload = NegotiationProposal(
                    session_id=session_id,
                    conflict_id=payload.conflict_id,
                    resource_type=payload.resource_type,
                    cell=payload.cell,
                    edge=payload.edge,
                    requested_time_window=payload.requested_time_window,
                    proposer_id=self.owner_robot_id,
                    status="DECLINED",
                )
                return P2PMessage(
                    message_id=f"msg-neg-dec-{self.owner_robot_id}-{current_tick}",
                    message_type=P2PMessageType.NEGOTIATION_DECLINE,
                    sender_id=self.owner_robot_id,
                    recipient_id=message.sender_id,
                    timestamp_tick=current_tick,
                    timestamp_s=current_time_s,
                    negotiation_payload=decline_payload,
                )

        # 3. Incoming NEGOTIATION_ACCEPT
        elif msg_type == P2PMessageType.NEGOTIATION_ACCEPT:
            session = self.sessions.get(session_id)
            if session:
                session.current_state = NegotiationState.RESOLVED
                session.last_updated_tick = current_tick
                session.resolution = f"Resolved with {message.sender_id}"
            return None

        # 4. Incoming NEGOTIATION_DECLINE
        elif msg_type == P2PMessageType.NEGOTIATION_DECLINE:
            session = self.sessions.get(session_id)
            if session:
                session.current_state = NegotiationState.DECLINED
                session.last_updated_tick = current_tick
                session.resolution = f"Declined by {message.sender_id} -> SAFE WAIT"
            return None

        return None

    def check_timeouts(self, current_tick: int):
        """
        Transitions active negotiation sessions to TIMEOUT if no response arrives within timeout_ticks.
        """
        for session in self.sessions.values():
            if session.current_state in [
                NegotiationState.PROPOSED,
                NegotiationState.WAITING_RESPONSE,
                NegotiationState.OFFER_RECEIVED,
            ]:
                if current_tick >= session.timeout_at_tick:
                    session.current_state = NegotiationState.TIMEOUT
                    session.last_updated_tick = current_tick
                    session.resolution = f"Negotiation timed out ({self.timeout_ticks} ticks) -> SAFE WAIT"

    def get_all_sessions(self) -> List[NegotiationSession]:
        """Returns all negotiation sessions sorted by recency."""
        return sorted(self.sessions.values(), key=lambda s: s.last_updated_tick, reverse=True)

    def clear(self):
        """Resets all negotiation sessions."""
        self.sessions.clear()
        self.session_counter = 0
