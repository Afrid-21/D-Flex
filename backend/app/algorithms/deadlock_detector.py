from typing import Dict, List, Optional, Tuple, Set, Any
from app.schemas.warehouse import (
    DeadlockState,
    DeadlockDependency,
    DeadlockCycle,
    DeadlockRecoveryAction,
    DeadlockRecoveryPayload,
    DeadlockSummary,
    P2PMessage,
    P2PMessageType,
    ResourceType,
    RobotStatus,
)
from app.config import config

class WaitForGraph:
    """
    Decentralized Wait-For Graph (WFG) representing directional resource blocking dependencies
    between Autonomous Mobile Robots in the warehouse digital twin.
    
    A directed edge A -> B means Robot A is blocked / waiting for Robot B to vacate or release
    a spatial resource (cell or edge) at time interval [t_start, t_end].
    """
    def __init__(self):
        # adjacency[waiting_robot][blocking_robot] = DeadlockDependency
        self.adj: Dict[str, Dict[str, DeadlockDependency]] = {}

    def add_dependency(self, dep: DeadlockDependency) -> None:
        """Adds or updates a directed waiting dependency A -> B."""
        if dep.waiting_robot not in self.adj:
            self.adj[dep.waiting_robot] = {}
        self.adj[dep.waiting_robot][dep.blocking_robot] = dep

    def remove_dependency(self, waiting_robot: str, blocking_robot: str) -> bool:
        """Removes a specific directed edge A -> B."""
        if waiting_robot in self.adj and blocking_robot in self.adj[waiting_robot]:
            del self.adj[waiting_robot][blocking_robot]
            if not self.adj[waiting_robot]:
                del self.adj[waiting_robot]
            return True
        return False

    def clear_robot(self, robot_id: str) -> None:
        """Removes all incoming and outgoing dependencies for robot_id."""
        if robot_id in self.adj:
            del self.adj[robot_id]
        for src in list(self.adj.keys()):
            if robot_id in self.adj[src]:
                del self.adj[src][robot_id]
                if not self.adj[src]:
                    del self.adj[src]

    def clear(self) -> None:
        """Clears all edges in the WFG."""
        self.adj.clear()

    def prune_stale(self, current_tick: int, max_age_ticks: int = 20) -> int:
        """Removes dependencies older than max_age_ticks."""
        pruned = 0
        for src in list(self.adj.keys()):
            for dst in list(self.adj[src].keys()):
                dep = self.adj[src][dst]
                if current_tick - dep.detected_at_tick > max_age_ticks:
                    del self.adj[src][dst]
                    pruned += 1
            if not self.adj[src]:
                del self.adj[src]
        return pruned

    def get_all_dependencies(self) -> List[DeadlockDependency]:
        """Returns all current active directed edges in the WFG."""
        deps = []
        for src in sorted(self.adj.keys()):
            for dst in sorted(self.adj[src].keys()):
                deps.append(self.adj[src][dst])
        return deps

    def detect_cycles(self) -> List[List[str]]:
        """
        Detects all simple cycles in the Wait-For Graph using DFS with a recursion stack.
        Returns a list of unique normalized cycles (e.g. [['R1', 'R2'], ['R1', 'R2', 'R3']]).
        """
        visited: Set[str] = set()
        rec_stack: List[str] = []
        found_cycles: List[List[str]] = []
        seen_canonical: Set[Tuple[str, ...]] = set()

        def dfs(node: str):
            visited.add(node)
            rec_stack.append(node)

            neighbors = self.adj.get(node, {})
            for neighbor in neighbors.keys():
                if neighbor in rec_stack:
                    # Cycle found! Extract slice from neighbor to end of stack
                    idx = rec_stack.index(neighbor)
                    cycle = rec_stack[idx:]
                    if len(cycle) >= 2:
                        # Canonicalize cycle by rotating to smallest lexicographical element
                        min_elem = min(cycle)
                        min_idx = cycle.index(min_elem)
                        canonical = tuple(cycle[min_idx:] + cycle[:min_idx])
                        if canonical not in seen_canonical:
                            seen_canonical.add(canonical)
                            found_cycles.append(list(canonical))
                elif neighbor not in visited:
                    dfs(neighbor)

            rec_stack.pop()

        all_nodes = list(self.adj.keys())
        for node in all_nodes:
            if node not in visited:
                dfs(node)

        return found_cycles

    def has_cycle(self) -> bool:
        """Returns True if any cycle exists in the WFG."""
        return len(self.detect_cycles()) > 0


class DeadlockManager:
    """
    Decentralized Deadlock Detection & Resolution manager embedded locally inside each AMR agent.
    
    Responsibilities:
    - Maintains local WFG based on observed reservations, conflict blocks, and P2P gossip.
    - Runs local cycle detection to identify circular deadlocks.
    - Elects yielding robot deterministically (highest robot ID string: R3 > R2 > R1).
    - Negotiates distributed recovery actions (Time-Shift / Safe Pause) via P2P messages.
    - Applies non-conflicting schedule adjustments and releases deadlock state.
    """
    def __init__(self, owner_robot_id: str):
        self.owner_robot_id: str = owner_robot_id
        self.wfg = WaitForGraph()
        self.active_cycles: Dict[str, DeadlockCycle] = {}
        self.historical_cycles: List[DeadlockCycle] = []
        self.state: DeadlockState = DeadlockState.NO_DEADLOCK
        self.yielding: bool = False
        self.recovered_count: int = 0
        self.failed_count: int = 0
        self.pending_recovery_accepts: Dict[str, Set[str]] = {}

    def update_dependency(
        self,
        blocking_robot: str,
        resource_type: str,
        cell: Optional[Tuple[int, int]],
        edge: Optional[Tuple[Tuple[int, int], Tuple[int, int]]],
        time_window: Tuple[int, int],
        current_tick: int,
    ) -> DeadlockDependency:
        """Records that owner is waiting on blocking_robot."""
        dep = DeadlockDependency(
            waiting_robot=self.owner_robot_id,
            blocking_robot=blocking_robot,
            resource_type=resource_type,
            cell=cell,
            edge=edge,
            time_window=time_window,
            detected_at_tick=current_tick,
        )
        self.wfg.add_dependency(dep)
        self.state = DeadlockState.DEPENDENCY_DETECTED
        return dep

    def record_peer_dependency(self, dep: DeadlockDependency) -> None:
        """Records a peer dependency learned via P2P gossip."""
        self.wfg.add_dependency(dep)

    def remove_dependency(self, blocking_robot: str) -> None:
        """Clears waiting dependency on blocking_robot."""
        self.wfg.remove_dependency(self.owner_robot_id, blocking_robot)
        if not self.wfg.detect_cycles():
            if not self.wfg.adj.get(self.owner_robot_id):
                self.state = DeadlockState.NO_DEADLOCK
                self.yielding = False

    def clear_all_dependencies(self) -> None:
        """Clears all dependencies."""
        self.wfg.clear()
        self.active_cycles.clear()
        self.state = DeadlockState.NO_DEADLOCK
        self.yielding = False

    def elect_yielding_robot(self, robots_in_cycle: List[str]) -> str:
        """
        Deterministic distributed election rule for choosing the yielding robot in a cycle.
        Deterministic tie-breaker: robot with highest string ID (e.g. R3 > R2 > R1).
        All agents computing this locally arrive at the exact same yielding agent.
        """
        return max(robots_in_cycle)

    def _generate_cycle_id(self, robots_in_cycle: List[str]) -> str:
        sorted_robots = sorted(robots_in_cycle)
        return f"dlk-{'-'.join(sorted_robots)}"

    def check_deadlocks(self, current_tick: int) -> List[DeadlockCycle]:
        """
        Runs cycle detection on WFG. If a cycle involves this robot, creates or updates
        DeadlockCycle record and transitions state.
        """
        raw_cycles = self.wfg.detect_cycles()
        current_cycle_ids = set()

        for cycle_nodes in raw_cycles:
            if self.owner_robot_id in cycle_nodes:
                cycle_id = self._generate_cycle_id(cycle_nodes)
                current_cycle_ids.add(cycle_id)

                # Collect dependencies belonging to this cycle
                cycle_deps = []
                for i in range(len(cycle_nodes)):
                    src = cycle_nodes[i]
                    dst = cycle_nodes[(i + 1) % len(cycle_nodes)]
                    if src in self.wfg.adj and dst in self.wfg.adj[src]:
                        cycle_deps.append(self.wfg.adj[src][dst])

                yielding_bot = self.elect_yielding_robot(cycle_nodes)

                if cycle_id not in self.active_cycles:
                    cycle = DeadlockCycle(
                        cycle_id=cycle_id,
                        robots_in_cycle=cycle_nodes,
                        dependencies=cycle_deps,
                        state=DeadlockState.CYCLE_DETECTED,
                        recovery_action=DeadlockRecoveryAction.TIME_SHIFT,
                        yielding_robot=yielding_bot,
                        shift_ticks=2,
                        detected_at_tick=current_tick,
                    )
                    self.active_cycles[cycle_id] = cycle
                    self.state = DeadlockState.CYCLE_DETECTED
                    self.yielding = (self.owner_robot_id == yielding_bot)
                else:
                    self.active_cycles[cycle_id].dependencies = cycle_deps

        # Clean up resolved cycles no longer in WFG
        for cid in list(self.active_cycles.keys()):
            if cid not in current_cycle_ids and self.active_cycles[cid].state in [
                DeadlockState.RECOVERED,
                DeadlockState.NO_DEADLOCK,
            ]:
                del self.active_cycles[cid]

        return list(self.active_cycles.values())

    def propose_recovery(
        self,
        cycle_id: str,
        current_tick: int,
        current_time_s: float = 0.0,
        shift_ticks: int = 2,
    ) -> List[P2PMessage]:
        """
        Yielding robot proposes a recovery action (Time-Shift) to all other peers in the cycle.
        """
        cycle = self.active_cycles.get(cycle_id)
        if not cycle:
            return []

        if cycle.yielding_robot != self.owner_robot_id:
            # Only the designated yielding robot initiates the recovery proposal
            return []

        cycle.state = DeadlockState.RECOVERY_PROPOSED
        cycle.shift_ticks = shift_ticks
        self.state = DeadlockState.RECOVERY_PROPOSED
        self.pending_recovery_accepts[cycle_id] = set()

        messages = []
        peers = [r for r in cycle.robots_in_cycle if r != self.owner_robot_id]
        
        for peer_id in peers:
            payload = DeadlockRecoveryPayload(
                cycle_id=cycle_id,
                robots_in_cycle=cycle.robots_in_cycle,
                proposer_id=self.owner_robot_id,
                yielding_robot=self.owner_robot_id,
                action=DeadlockRecoveryAction.TIME_SHIFT,
                shift_ticks=shift_ticks,
                reason=f"{self.owner_robot_id} yields via +{shift_ticks}t time-shift to resolve cycle",
                status="PROPOSED",
            )
            msg = P2PMessage(
                message_id=f"msg-dlk-prop-{self.owner_robot_id}-{peer_id}-{current_tick}",
                message_type=P2PMessageType.DEADLOCK_RECOVERY_PROPOSE,
                sender_id=self.owner_robot_id,
                recipient_id=peer_id,
                timestamp_tick=current_tick,
                timestamp_s=current_time_s,
                deadlock_payload=payload,
            )
            messages.append(msg)

        return messages

    def handle_deadlock_message(
        self,
        message: P2PMessage,
        current_tick: int,
        current_time_s: float = 0.0,
        agent_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[P2PMessage]:
        """
        Handles incoming deadlock P2P messages and executes deterministic recovery transitions.
        """
        payload = message.deadlock_payload
        if not payload:
            return None

        msg_type = message.message_type
        cycle_id = payload.cycle_id

        # 1. DEADLOCK_DETECTED broadcast
        if msg_type == P2PMessageType.DEADLOCK_DETECTED:
            # Check or update local cycle
            self.check_deadlocks(current_tick)
            return None

        # 2. DEADLOCK_RECOVERY_PROPOSE received by peers in cycle
        elif msg_type == P2PMessageType.DEADLOCK_RECOVERY_PROPOSE:
            cycle = self.active_cycles.get(cycle_id)
            if not cycle and self.owner_robot_id in payload.robots_in_cycle:
                # Synchronize cycle record
                cycle = DeadlockCycle(
                    cycle_id=cycle_id,
                    robots_in_cycle=payload.robots_in_cycle,
                    state=DeadlockState.RECOVERY_PROPOSED,
                    recovery_action=payload.action,
                    yielding_robot=payload.yielding_robot,
                    shift_ticks=payload.shift_ticks,
                    detected_at_tick=current_tick,
                )
                self.active_cycles[cycle_id] = cycle

            if cycle:
                cycle.state = DeadlockState.RECOVERY_ACCEPTED
                self.state = DeadlockState.RECOVERY_ACCEPTED
                accept_payload = DeadlockRecoveryPayload(
                    cycle_id=cycle_id,
                    robots_in_cycle=payload.robots_in_cycle,
                    proposer_id=self.owner_robot_id,
                    yielding_robot=payload.yielding_robot,
                    action=payload.action,
                    shift_ticks=payload.shift_ticks,
                    reason=f"{self.owner_robot_id} accepts {payload.yielding_robot} recovery proposal",
                    status="ACCEPTED",
                )
                return P2PMessage(
                    message_id=f"msg-dlk-acc-{self.owner_robot_id}-{message.sender_id}-{current_tick}",
                    message_type=P2PMessageType.DEADLOCK_RECOVERY_ACCEPT,
                    sender_id=self.owner_robot_id,
                    recipient_id=message.sender_id,
                    timestamp_tick=current_tick,
                    timestamp_s=current_time_s,
                    deadlock_payload=accept_payload,
                )

        # 3. DEADLOCK_RECOVERY_ACCEPT received by yielding robot
        elif msg_type == P2PMessageType.DEADLOCK_RECOVERY_ACCEPT:
            cycle = self.active_cycles.get(cycle_id)
            if cycle and cycle.yielding_robot == self.owner_robot_id:
                if cycle_id not in self.pending_recovery_accepts:
                    self.pending_recovery_accepts[cycle_id] = set()
                self.pending_recovery_accepts[cycle_id].add(message.sender_id)

                peers_in_cycle = {r for r in cycle.robots_in_cycle if r != self.owner_robot_id}
                
                # Check if all peers in the cycle have accepted
                if peers_in_cycle.issubset(self.pending_recovery_accepts[cycle_id]):
                    cycle.state = DeadlockState.RECOVERED
                    cycle.resolution = f"{self.owner_robot_id} executed +{cycle.shift_ticks}t time-shift recovery"
                    cycle.resolved_at_tick = current_tick
                    self.state = DeadlockState.RECOVERED
                    self.recovered_count += 1
                    self.wfg.clear_robot(self.owner_robot_id)

                    # Return complete broadcast
                    comp_payload = DeadlockRecoveryPayload(
                        cycle_id=cycle_id,
                        robots_in_cycle=cycle.robots_in_cycle,
                        proposer_id=self.owner_robot_id,
                        yielding_robot=self.owner_robot_id,
                        action=cycle.recovery_action or DeadlockRecoveryAction.TIME_SHIFT,
                        shift_ticks=cycle.shift_ticks,
                        reason=f"Deadlock {cycle_id} successfully resolved",
                        status="COMPLETED",
                    )
                    return P2PMessage(
                        message_id=f"msg-dlk-comp-{self.owner_robot_id}-{current_tick}",
                        message_type=P2PMessageType.DEADLOCK_RECOVERY_COMPLETE,
                        sender_id=self.owner_robot_id,
                        recipient_id=None,  # Broadcast to mesh
                        timestamp_tick=current_tick,
                        timestamp_s=current_time_s,
                        deadlock_payload=comp_payload,
                    )

        # 4. DEADLOCK_RECOVERY_COMPLETE broadcast received
        elif msg_type == P2PMessageType.DEADLOCK_RECOVERY_COMPLETE:
            cycle = self.active_cycles.get(cycle_id)
            if cycle:
                cycle.state = DeadlockState.RECOVERED
                cycle.resolution = payload.reason or "Resolved via distributed recovery"
                cycle.resolved_at_tick = current_tick
            self.wfg.clear()
            self.state = DeadlockState.NO_DEADLOCK
            self.yielding = False
            return None

        return None

    def get_summary(self) -> DeadlockSummary:
        """Returns summary metrics of deadlocks and dependencies for observer dashboard."""
        active_cycles_list = list(self.active_cycles.values())
        return DeadlockSummary(
            total_deadlocks=len(self.active_cycles) + self.recovered_count,
            active_dependencies=self.wfg.get_all_dependencies(),
            active_cycles=active_cycles_list,
            recovered_count=self.recovered_count,
            failed_count=self.failed_count,
            recent_cycles=self.historical_cycles[-10:] if self.historical_cycles else active_cycles_list,
        )
