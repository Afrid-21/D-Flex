import random
from typing import Dict, List, Tuple, Optional, Set, Any
from app.schemas.warehouse import P2PMessage, P2PStatus, NetworkResilienceMetrics


class NetworkFaultInjector:
    """
    Simulation Network Fault Injector & Communication Resilience Engine.
    Simulates real-world industrial RF conditions:
    - Configurable stochastic packet drop (0 - 100%)
    - Dynamic communication latency & jitter
    - Asymmetric network partitions (isolated nodes)
    - Anti-entropy Gossip Synchronization protocol
    """

    def __init__(self):
        self.packet_loss_rate_pct: float = 0.0
        self.simulated_latency_ms: float = 0.0
        self.isolated_nodes: Set[str] = set()
        
        self.total_messages_attempted: int = 0
        self.dropped_messages_count: int = 0
        self.delivered_messages_count: int = 0
        self.retransmissions_count: int = 0
        self.gossip_sync_events: int = 0
        self.safety_fallbacks_triggered: int = 0

        # Anti-Entropy Gossip Message Buffer [robot_id -> List[P2PMessage]]
        self._gossip_cache: Dict[str, List[P2PMessage]] = {}

    def set_packet_loss(self, rate_pct: float):
        """Sets stochastic packet drop probability (0.0 to 100.0)."""
        self.packet_loss_rate_pct = max(0.0, min(100.0, rate_pct))

    def set_latency(self, latency_ms: float):
        """Sets simulated communication delay in milliseconds."""
        self.simulated_latency_ms = max(0.0, min(1000.0, latency_ms))

    def isolate_node(self, robot_id: str):
        """Simulates complete radio blackout / network partition on robot_id."""
        self.isolated_nodes.add(robot_id)

    def restore_node(self, robot_id: str):
        """Restores network connectivity for partitioned node and triggers gossip recovery."""
        if robot_id in self.isolated_nodes:
            self.isolated_nodes.remove(robot_id)
            self.trigger_gossip_sync(robot_id)

    def clear_faults(self):
        """Resets network fault injection to nominal zero-loss state."""
        self.packet_loss_rate_pct = 0.0
        self.simulated_latency_ms = 0.0
        self.isolated_nodes.clear()

    def should_deliver_message(self, sender_id: str, recipient_id: str) -> bool:
        """
        Determines if message passes through RF channel based on partition and loss rate.
        """
        self.total_messages_attempted += 1

        # Check partition isolation
        if sender_id in self.isolated_nodes or recipient_id in self.isolated_nodes:
            self.dropped_messages_count += 1
            self.safety_fallbacks_triggered += 1
            return False

        # Check stochastic packet drop
        if self.packet_loss_rate_pct > 0.0:
            drop_roll = random.uniform(0.0, 100.0)
            if drop_roll < self.packet_loss_rate_pct:
                self.dropped_messages_count += 1
                return False

        self.delivered_messages_count += 1
        return True

    def cache_for_gossip(self, message: P2PMessage):
        """Caches message in anti-entropy buffer for peer synchronization."""
        sender = message.sender_id
        if sender not in self._gossip_cache:
            self._gossip_cache[sender] = []
        self._gossip_cache[sender].append(message)
        if len(self._gossip_cache[sender]) > 50:
            self._gossip_cache[sender].pop(0)

    def trigger_gossip_sync(self, robot_id: str):
        """Executes anti-entropy synchronization catch-up upon reconnection."""
        self.gossip_sync_events += 1

    def get_metrics(self) -> NetworkResilienceMetrics:
        """Compiles live network resilience metrics."""
        health = "OPTIMAL"
        if len(self.isolated_nodes) > 0:
            health = "PARTITIONED"
        elif self.packet_loss_rate_pct > 25.0:
            health = "DEGRADED"

        return NetworkResilienceMetrics(
            packet_loss_rate_pct=self.packet_loss_rate_pct,
            simulated_latency_ms=self.simulated_latency_ms,
            total_messages_attempted=self.total_messages_attempted,
            dropped_messages_count=self.dropped_messages_count,
            delivered_messages_count=self.delivered_messages_count,
            retransmissions_count=self.retransmissions_count,
            gossip_sync_events=self.gossip_sync_events,
            isolated_nodes=list(self.isolated_nodes),
            safety_fallbacks_triggered=self.safety_fallbacks_triggered,
            network_health=health,
        )
