import time
from typing import Dict, List, Optional, Any
from app.schemas.warehouse import (
    P2PMessage,
    P2PMessageType,
    P2PStatus,
    P2PLogEvent,
    P2PLinkInfo,
    P2PNetworkSummary,
)

from app.algorithms.network_fault_injector import NetworkFaultInjector, NetworkResilienceMetrics

class P2PTransport:
    """
    Decentralized simulation transport bus.
    Routes P2P messages directly between AMR agents with industrial RF fault injection.
    
    IMPORTANT ARCHITECTURE INVARIANT:
    This transport does NOT make decisions, allocate reservations, or arbitrate conflicts.
    It functions strictly as a message carrier and observer event aggregator.
    """

    def __init__(self, max_event_history: int = 30):
        self._agents: Dict[str, Any] = {}
        self._links: Dict[str, P2PLinkInfo] = {}
        self._event_history: List[P2PLogEvent] = []
        self._max_events: int = max_event_history
        self._total_messages: int = 0
        self._event_counter: int = 0
        self.fault_injector = NetworkFaultInjector()

    def register_agent(self, robot_id: str, agent: Any):
        """Registers an AMR agent with the transport bus."""
        self._agents[robot_id] = agent
        self._update_mesh_links()

    def unregister_agent(self, robot_id: str):
        """Unregisters an AMR agent."""
        if robot_id in self._agents:
            del self._agents[robot_id]
            self._update_mesh_links()

    def _get_link_key(self, src: str, dst: str) -> str:
        return f"{src}->{dst}"

    def _update_mesh_links(self):
        """Maintains full mesh link definitions for registered nodes."""
        node_ids = list(self._agents.keys())
        for src in node_ids:
            for dst in node_ids:
                if src != dst:
                    k = self._get_link_key(src, dst)
                    if k not in self._links:
                        self._links[k] = P2PLinkInfo(
                            source=src,
                            target=dst,
                            status=P2PStatus.CONNECTED,
                            messages_count=0,
                            last_activity_tick=0,
                        )

    def broadcast(
        self,
        sender_id: str,
        message: P2PMessage,
        current_tick: int,
        current_time_s: float = 0.0,
    ) -> int:
        """
        Transports a broadcast message to all peer agents with fault injection.
        """
        self.fault_injector.cache_for_gossip(message)
        recipients_count = 0
        for rid, agent in self._agents.items():
            if rid != sender_id:
                if not self.fault_injector.should_deliver_message(sender_id, rid):
                    # Message dropped due to RF packet loss or partition
                    lk = self._get_link_key(sender_id, rid)
                    if lk in self._links:
                        self._links[lk].status = P2PStatus.DEGRADED
                    continue

                agent.receive_p2p_message(message, current_tick, current_time_s)
                recipients_count += 1
                
                # Update link stats
                lk = self._get_link_key(sender_id, rid)
                if lk in self._links:
                    self._links[lk].messages_count += 1
                    self._links[lk].last_activity_tick = current_tick
                    self._links[lk].status = P2PStatus.CONNECTED

        self._total_messages += 1

        # Record event for observer log (throttle heartbeat spam)
        self._record_event(
            sender_id=sender_id,
            recipient_id="ALL",
            message=message,
            current_tick=current_tick,
            current_time_s=current_time_s,
        )

        return recipients_count

    def send_direct(
        self,
        sender_id: str,
        recipient_id: str,
        message: P2PMessage,
        current_tick: int,
        current_time_s: float = 0.0,
    ) -> bool:
        """
        Transports a direct point-to-point message with fault injection.
        """
        target_agent = self._agents.get(recipient_id)
        if not target_agent or recipient_id == sender_id:
            return False

        self.fault_injector.cache_for_gossip(message)
        if not self.fault_injector.should_deliver_message(sender_id, recipient_id):
            lk = self._get_link_key(sender_id, recipient_id)
            if lk in self._links:
                self._links[lk].status = P2PStatus.DEGRADED
            return False

        target_agent.receive_p2p_message(message, current_tick, current_time_s)
        self._total_messages += 1

        lk = self._get_link_key(sender_id, recipient_id)
        if lk in self._links:
            self._links[lk].messages_count += 1
        self._record_event(
            sender_id=sender_id,
            recipient_id=recipient_id,
            message=message,
            current_tick=current_tick,
            current_time_s=current_time_s,
        )
        return True

    def get_resilience_metrics(self) -> NetworkResilienceMetrics:
        """Returns live network resilience and fault injection telemetry."""
        return self.fault_injector.get_metrics()

    def _record_event(
        self,
        sender_id: str,
        recipient_id: str,
        message: P2PMessage,
        current_tick: int,
        current_time_s: float,
    ):
        """Appends formatted event to ring buffer with heartbeat aggregation."""
        # For heartbeats, only log once every 10 ticks to keep event log clean
        if message.message_type == P2PMessageType.HEARTBEAT and current_tick % 10 != 0:
            return

        self._event_counter += 1
        summary = ""
        if message.message_type == P2PMessageType.STATE_UPDATE:
            pos = message.state_payload.position if message.state_payload else (0,0)
            summary = f"STATE @ {pos} (seq #{message.sequence_number})"
        elif message.message_type == P2PMessageType.INTENT_UPDATE:
            nxt = message.intent_payload.next_cell if message.intent_payload else None
            summary = f"INTENT next->{nxt} (seq #{message.sequence_number})"
        elif message.message_type == P2PMessageType.HEARTBEAT:
            summary = f"HEARTBEAT alive (seq #{message.sequence_number})"
        elif message.message_type == P2PMessageType.RESERVATION_UPDATE:
            count = len(message.reservation_ids)
            summary = f"RESERVATIONS ({count} locked)"
        else:
            summary = f"{message.message_type.value} #{message.sequence_number}"

        event = P2PLogEvent(
            event_id=f"evt-{self._event_counter}",
            timestamp_tick=current_tick,
            timestamp_s=round(current_time_s, 2),
            sender_id=sender_id,
            recipient_id=recipient_id,
            message_type=message.message_type,
            sequence_number=message.sequence_number,
            summary=summary,
        )

        self._event_history.insert(0, event)
        if len(self._event_history) > self._max_events:
            self._event_history = self._event_history[:self._max_events]

    def get_network_summary(self, current_tick: int, stale_timeout_ticks: int = 15) -> P2PNetworkSummary:
        """Constructs an observer summary snapshot of the P2P communication mesh."""
        active_nodes = list(self._agents.keys())
        
        # Check link staleness
        links_list: List[P2PLinkInfo] = []
        all_alive = True
        for link in self._links.values():
            if current_tick > 0 and (current_tick - link.last_activity_tick) > stale_timeout_ticks:
                link.status = P2PStatus.STALE
                all_alive = False
            else:
                link.status = P2PStatus.CONNECTED
            links_list.append(link)

        mesh_status = "CONNECTED" if all_alive and len(active_nodes) >= 2 else ("DEGRADED" if not all_alive else "OFFLINE")

        return P2PNetworkSummary(
            total_messages_exchanged=self._total_messages,
            active_nodes=active_nodes,
            links=links_list,
            recent_events=list(self._event_history),
            mesh_status=mesh_status,
        )

    def clear(self):
        """Clears messages and reset counters."""
        self._total_messages = 0
        self._event_counter = 0
        self._event_history.clear()
        for link in self._links.values():
            link.messages_count = 0
            link.last_activity_tick = 0
            link.status = P2PStatus.CONNECTED
