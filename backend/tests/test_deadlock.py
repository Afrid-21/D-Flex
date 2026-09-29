import pytest
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
    SimulationStatus,
)
from app.algorithms.deadlock_detector import WaitForGraph, DeadlockManager
from app.core.amr_agent import AMRAgent, FleetManager
from app.core.simulation import SimulationEngine
from app.core.grid import WarehouseMap

def test_wfg_add_remove_clear():
    """Verifies Wait-For Graph (WFG) creation, dependency addition, removal, and clearing."""
    wfg = WaitForGraph()
    assert len(wfg.get_all_dependencies()) == 0
    assert not wfg.has_cycle()

    dep = DeadlockDependency(
        waiting_robot="R1",
        blocking_robot="R2",
        resource_type="CELL",
        cell=(10, 7),
        edge=None,
        time_window=(5, 6),
        detected_at_tick=10,
    )
    wfg.add_dependency(dep)
    assert len(wfg.get_all_dependencies()) == 1
    assert "R1" in wfg.adj
    assert "R2" in wfg.adj["R1"]

    # Remove dependency
    removed = wfg.remove_dependency("R1", "R2")
    assert removed is True
    assert len(wfg.get_all_dependencies()) == 0

    # Clear robot
    wfg.add_dependency(dep)
    wfg.clear_robot("R1")
    assert len(wfg.get_all_dependencies()) == 0


def test_wfg_cycle_detection_2robot():
    """Verifies that a mutual 2-robot dependency R1 -> R2 and R2 -> R1 triggers cycle detection."""
    wfg = WaitForGraph()
    wfg.add_dependency(DeadlockDependency(waiting_robot="R1", blocking_robot="R2", time_window=(5, 6), detected_at_tick=1))
    wfg.add_dependency(DeadlockDependency(waiting_robot="R2", blocking_robot="R1", time_window=(5, 6), detected_at_tick=1))

    assert wfg.has_cycle() is True
    cycles = wfg.detect_cycles()
    assert len(cycles) == 1
    assert sorted(cycles[0]) == ["R1", "R2"]


def test_wfg_cycle_detection_3robot():
    """Verifies that a 3-way circular dependency R1 -> R2 -> R3 -> R1 triggers cycle detection."""
    wfg = WaitForGraph()
    wfg.add_dependency(DeadlockDependency(waiting_robot="R1", blocking_robot="R2", time_window=(5, 6), detected_at_tick=1))
    wfg.add_dependency(DeadlockDependency(waiting_robot="R2", blocking_robot="R3", time_window=(5, 6), detected_at_tick=1))
    wfg.add_dependency(DeadlockDependency(waiting_robot="R3", blocking_robot="R1", time_window=(5, 6), detected_at_tick=1))

    assert wfg.has_cycle() is True
    cycles = wfg.detect_cycles()
    assert len(cycles) == 1
    assert sorted(cycles[0]) == ["R1", "R2", "R3"]


def test_wfg_acyclic_no_false_positive():
    """Verifies that a linear dependency chain R1 -> R2 -> R3 does NOT trigger a false positive deadlock."""
    wfg = WaitForGraph()
    wfg.add_dependency(DeadlockDependency(waiting_robot="R1", blocking_robot="R2", time_window=(5, 6), detected_at_tick=1))
    wfg.add_dependency(DeadlockDependency(waiting_robot="R2", blocking_robot="R3", time_window=(5, 6), detected_at_tick=1))

    assert wfg.has_cycle() is False
    assert len(wfg.detect_cycles()) == 0


def test_wfg_prune_stale_dependencies():
    """Verifies that stale dependencies exceeding max age are pruned."""
    wfg = WaitForGraph()
    wfg.add_dependency(DeadlockDependency(waiting_robot="R1", blocking_robot="R2", time_window=(5, 6), detected_at_tick=5))
    wfg.add_dependency(DeadlockDependency(waiting_robot="R2", blocking_robot="R3", time_window=(5, 6), detected_at_tick=25))

    # At tick 30, with max_age_ticks=20, tick 5 dependency is 25 ticks old (> 20)
    pruned = wfg.prune_stale(current_tick=30, max_age_ticks=20)
    assert pruned == 1
    deps = wfg.get_all_dependencies()
    assert len(deps) == 1
    assert deps[0].waiting_robot == "R2"


def test_deterministic_yielding_election():
    """Verifies deterministic distributed yielding election rule across multiple cycle topologies."""
    mgr1 = DeadlockManager(owner_robot_id="R1")
    mgr2 = DeadlockManager(owner_robot_id="R2")
    mgr3 = DeadlockManager(owner_robot_id="R3")

    # In 2-robot cycle [R1, R2], R2 yields (lexicographical string tie-breaker)
    assert mgr1.elect_yielding_robot(["R1", "R2"]) == "R2"
    assert mgr2.elect_yielding_robot(["R1", "R2"]) == "R2"

    # In 3-robot cycle [R1, R2, R3], R3 yields
    assert mgr1.elect_yielding_robot(["R1", "R2", "R3"]) == "R3"
    assert mgr2.elect_yielding_robot(["R1", "R2", "R3"]) == "R3"
    assert mgr3.elect_yielding_robot(["R1", "R2", "R3"]) == "R3"


def test_deadlock_manager_local_cycle_discovery():
    """Verifies DeadlockManager updates local cycle records and state transitions."""
    mgr = DeadlockManager(owner_robot_id="R1")
    assert mgr.state == DeadlockState.NO_DEADLOCK

    mgr.update_dependency("R2", "CELL", (8, 7), None, (5, 6), 1)
    assert mgr.state == DeadlockState.DEPENDENCY_DETECTED

    # Add peer dependency
    mgr.record_peer_dependency(
        DeadlockDependency(waiting_robot="R2", blocking_robot="R1", resource_type="CELL", cell=(8, 7), time_window=(5, 6), detected_at_tick=1)
    )

    cycles = mgr.check_deadlocks(current_tick=1)
    assert len(cycles) == 1
    assert mgr.state == DeadlockState.CYCLE_DETECTED
    assert mgr.yielding is False  # R2 is yielding robot in ['R1', 'R2']


def test_deadlock_recovery_protocol_exchange():
    """Verifies the P2P recovery protocol exchange: PROPOSE -> ACCEPT -> COMPLETE."""
    r1_mgr = DeadlockManager(owner_robot_id="R1")
    r2_mgr = DeadlockManager(owner_robot_id="R2")

    dep1 = DeadlockDependency(waiting_robot="R1", blocking_robot="R2", time_window=(5, 6), detected_at_tick=1)
    dep2 = DeadlockDependency(waiting_robot="R2", blocking_robot="R1", time_window=(5, 6), detected_at_tick=1)

    r1_mgr.record_peer_dependency(dep1)
    r1_mgr.record_peer_dependency(dep2)
    r2_mgr.record_peer_dependency(dep1)
    r2_mgr.record_peer_dependency(dep2)

    r1_mgr.check_deadlocks(current_tick=1)
    r2_mgr.check_deadlocks(current_tick=1)

    cycle_id = "dlk-R1-R2"
    # R2 is yielding robot -> generates recovery proposal
    assert r2_mgr.yielding is True
    prop_msgs = r2_mgr.propose_recovery(cycle_id, current_tick=1, shift_ticks=2)
    assert len(prop_msgs) == 1
    assert prop_msgs[0].message_type == P2PMessageType.DEADLOCK_RECOVERY_PROPOSE
    assert prop_msgs[0].recipient_id == "R1"
    assert prop_msgs[0].deadlock_payload.yielding_robot == "R2"

    # R1 receives proposal and generates accept
    acc_msg = r1_mgr.handle_deadlock_message(prop_msgs[0], current_tick=2)
    assert acc_msg is not None
    assert acc_msg.message_type == P2PMessageType.DEADLOCK_RECOVERY_ACCEPT
    assert acc_msg.recipient_id == "R2"

    # R2 receives accept and generates complete broadcast
    comp_msg = r2_mgr.handle_deadlock_message(acc_msg, current_tick=3)
    assert comp_msg is not None
    assert comp_msg.message_type == P2PMessageType.DEADLOCK_RECOVERY_COMPLETE
    assert comp_msg.recipient_id is None  # Broadcast
    assert r2_mgr.state == DeadlockState.RECOVERED

    # R1 receives complete broadcast
    r1_mgr.handle_deadlock_message(comp_msg, current_tick=4)
    assert r1_mgr.state == DeadlockState.NO_DEADLOCK


def test_deadlock_message_serialization():
    """Verifies that all Deadlock P2P message types serialize and deserialize correctly."""
    payload = DeadlockRecoveryPayload(
        cycle_id="dlk-R1-R2-R3",
        robots_in_cycle=["R1", "R2", "R3"],
        proposer_id="R3",
        yielding_robot="R3",
        action=DeadlockRecoveryAction.TIME_SHIFT,
        shift_ticks=3,
        reason="Testing Serialization",
        status="PROPOSED",
    )
    msg = P2PMessage(
        message_id="msg-dlk-test-1",
        message_type=P2PMessageType.DEADLOCK_RECOVERY_PROPOSE,
        sender_id="R3",
        recipient_id="R1",
        timestamp_tick=10,
        deadlock_payload=payload,
    )
    json_str = msg.model_dump_json()
    assert "DEADLOCK_RECOVERY_PROPOSE" in json_str
    assert "dlk-R1-R2-R3" in json_str

    deserialized = P2PMessage.model_validate_json(json_str)
    assert deserialized.message_id == "msg-dlk-test-1"
    assert deserialized.deadlock_payload.shift_ticks == 3
    assert deserialized.deadlock_payload.action == DeadlockRecoveryAction.TIME_SHIFT


def test_fleet_deadlock_demo_2robot():
    """Verifies FleetManager trigger_deadlock_demo_2robot sets up head-on deadlock with R2 yielding."""
    fleet = FleetManager()
    summary = fleet.trigger_deadlock_demo_2robot()

    assert summary.total_deadlocks >= 1
    assert len(summary.active_cycles) >= 1
    cycle = summary.active_cycles[0]
    assert sorted(cycle.robots_in_cycle) == ["R1", "R2"]
    assert cycle.yielding_robot == "R2"
    assert fleet.robots["R2"].deadlock_mgr.yielding is True
    assert fleet.robots["R1"].deadlock_mgr.yielding is False


def test_fleet_deadlock_demo_3robot():
    """Verifies FleetManager trigger_deadlock_demo_3robot sets up 3-way circular deadlock with R3 yielding."""
    fleet = FleetManager()
    summary = fleet.trigger_deadlock_demo_3robot()

    assert summary.total_deadlocks >= 1
    assert len(summary.active_cycles) >= 1
    cycle = summary.active_cycles[0]
    assert sorted(cycle.robots_in_cycle) == ["R1", "R2", "R3"]
    assert cycle.yielding_robot == "R3"
    assert fleet.robots["R3"].deadlock_mgr.yielding is True


def test_fleet_resolve_deadlock():
    """Verifies that calling resolve_deadlock() on FleetManager resolves active cycles."""
    fleet = FleetManager()
    fleet.trigger_deadlock_demo_2robot()
    assert len(fleet.get_all_deadlocks().active_cycles) >= 1

    summary = fleet.resolve_deadlock()
    # Cycles are resolved / recovered
    assert summary.recovered_count >= 1


def test_simulation_engine_deadlock_state():
    """Verifies SimulationEngine exposes deadlocks in SimulationState."""
    engine = SimulationEngine()
    engine.trigger_deadlock_demo_2robot()
    state = engine.get_state()

    assert state.deadlocks is not None
    assert len(state.deadlocks.active_cycles) >= 1
    assert state.robots[0].deadlock_state != DeadlockState.NO_DEADLOCK or state.robots[1].deadlock_state != DeadlockState.NO_DEADLOCK
