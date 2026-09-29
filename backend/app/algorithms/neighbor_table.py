from typing import Dict, List, Optional
from app.schemas.warehouse import (
    NeighborInfo,
    P2PMessage,
    P2PMessageType,
    P2PStatus,
    RobotStatus,
)

class NeighborTable:
    """
    Local view of neighboring AMRs maintained independently inside each AMR agent.
    Tracks peer telemetry, intention, sequence ordering, and staleness detection.
    """

    def __init__(self, owner_robot_id: str):
        self.owner_robot_id: str = owner_robot_id
        self._neighbors: Dict[str, NeighborInfo] = {}
        self._last_seq: Dict[str, int] = {}

    def update_neighbor_from_message(
        self, message: P2PMessage, current_tick: int, current_time_s: float = 0.0
    ) -> bool:
        """
        Updates local neighbor knowledge from an incoming P2P message.
        Rejects stale/out-of-order sequence numbers.
        Returns True if message was accepted and processed, False if rejected as stale.
        """
        sender_id = message.sender_id
        if sender_id == self.owner_robot_id:
            return False

        # Verify sequence number ordering
        if sender_id in self._last_seq:
            prev_seq = self._last_seq[sender_id]
            if message.sequence_number <= prev_seq and message.sequence_number != 1:
                # Stale or duplicate message ignored
                return False

        self._last_seq[sender_id] = message.sequence_number

        # Fetch or create neighbor record
        if sender_id not in self._neighbors:
            self._neighbors[sender_id] = NeighborInfo(
                robot_id=sender_id,
                agent_id=f"agent_{sender_id}",
                position=(0, 0),
                status=RobotStatus.IDLE,
                last_seen_tick=current_tick,
                last_seen_time_s=current_time_s,
                last_seq=message.sequence_number,
                p2p_status=P2PStatus.CONNECTED,
            )

        neighbor = self._neighbors[sender_id]
        neighbor.last_seen_tick = current_tick
        neighbor.last_seen_time_s = current_time_s
        neighbor.last_seq = message.sequence_number
        neighbor.p2p_status = P2PStatus.CONNECTED

        if message.reservation_ids:
            neighbor.reservation_ids = list(message.reservation_ids)

        if message.message_type == P2PMessageType.STATE_UPDATE and message.state_payload:
            payload = message.state_payload
            neighbor.position = payload.position
            neighbor.speed = payload.speed
            neighbor.direction = payload.direction
            neighbor.destination = payload.destination
            neighbor.destination_label = payload.destination_label
            neighbor.status = payload.status
            neighbor.battery = payload.battery
            if payload.path_segment:
                neighbor.planned_cells = list(payload.path_segment)
                if len(payload.path_segment) > 1:
                    neighbor.next_cell = payload.path_segment[1]
                else:
                    neighbor.next_cell = None
            if payload.reservation_ids:
                neighbor.reservation_ids = list(payload.reservation_ids)

        elif message.message_type == P2PMessageType.INTENT_UPDATE and message.intent_payload:
            payload = message.intent_payload
            neighbor.position = payload.current_cell
            neighbor.next_cell = payload.next_cell
            neighbor.planned_cells = list(payload.planned_cells)
            neighbor.destination = payload.destination
            if payload.reservation_ids:
                neighbor.reservation_ids = list(payload.reservation_ids)

        elif message.message_type == P2PMessageType.HEARTBEAT and message.heartbeat_payload:
            payload = message.heartbeat_payload
            neighbor.position = payload.position
            neighbor.status = payload.status
            neighbor.battery = payload.battery

        elif message.message_type == P2PMessageType.RESERVATION_UPDATE:
            if message.reservation_ids:
                neighbor.reservation_ids = list(message.reservation_ids)

        return True

    def check_stale_peers(self, current_tick: int, timeout_ticks: int = 15):
        """
        Marks peers as STALE if no message or heartbeat has been received within timeout_ticks.
        """
        for neighbor in self._neighbors.values():
            if current_tick - neighbor.last_seen_tick > timeout_ticks:
                neighbor.p2p_status = P2PStatus.STALE

    def get_neighbor(self, robot_id: str) -> Optional[NeighborInfo]:
        """Returns local view of a specific neighboring AMR."""
        return self._neighbors.get(robot_id)

    def get_all_neighbors(self) -> List[NeighborInfo]:
        """Returns all neighbor records sorted by robot_id."""
        return sorted(self._neighbors.values(), key=lambda n: n.robot_id)

    def remove_neighbor(self, robot_id: str):
        """Removes a neighbor from the table."""
        if robot_id in self._neighbors:
            del self._neighbors[robot_id]
        if robot_id in self._last_seq:
            del self._last_seq[robot_id]

    def is_neighbor_alive(self, robot_id: str, current_tick: int, timeout_ticks: int = 15) -> bool:
        """Returns True if the neighbor exists and has communicated within timeout_ticks."""
        neighbor = self._neighbors.get(robot_id)
        if not neighbor:
            return False
        return (current_tick - neighbor.last_seen_tick) <= timeout_ticks

    def clear(self):
        """Resets the neighbor table."""
        self._neighbors.clear()
        self._last_seq.clear()
