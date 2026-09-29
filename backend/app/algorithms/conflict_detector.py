import time
from typing import List, Dict, Tuple, Set, Optional
from app.schemas.warehouse import (
    ConflictType,
    ConflictSeverity,
    ConflictEvent,
    ConflictReport,
    RobotStatus,
)

class ConflictDetector:
    """
    Modular Multi-AMR Spatio-Temporal Conflict Detection Engine.
    Analyzes projected time-space trajectories of active robots to identify:
    - VERTEX_CONFLICT: Same cell at identical time step (Critical)
    - EDGE_CONFLICT: Traversing same edge in opposite directions simultaneously (Critical/Warning)
    - FOLLOWING_CONFLICT: Entering same cell within unsafe safety headway (Warning)
    - INTERSECTION_CONFLICT: Contention across designated intersections within overlapping time windows (Warning)
    """

    def __init__(
        self,
        safety_headway: int = 1,
        intersection_window: int = 1,
        time_step_duration_s: float = 0.1,
    ):
        self.safety_headway = safety_headway
        self.intersection_window = intersection_window
        self.time_step_duration_s = time_step_duration_s

    def detect_conflicts(
        self,
        robots: Dict[str, any],
        current_tick: int = 0,
        intersections: Optional[Set[Tuple[int, int]]] = None,
    ) -> ConflictReport:
        """
        Executes pairwise spatio-temporal conflict analysis on all active AMR paths.
        """
        start_time = time.perf_counter()
        conflicts: List[ConflictEvent] = []
        intersections_set = intersections or set()

        # 1. Extract valid projected timelines for each active robot
        # Filter for robots that have remaining waypoints
        timelines: Dict[str, List[Tuple[int, int]]] = {}
        active_robot_ids = list(robots.keys())

        for rid, robot in robots.items():
            if hasattr(robot, "get_remaining_path"):
                path = robot.get_remaining_path()
            elif hasattr(robot, "current_path"):
                path = robot.current_path
            else:
                path = []

            # If path has at least current position
            if path:
                timelines[rid] = list(path)
            elif hasattr(robot, "position"):
                timelines[rid] = [robot.position]

        pairs_examined = 0
        robot_list = [rid for rid in active_robot_ids if rid in timelines and len(timelines[rid]) > 0]
        n_robots = len(robot_list)

        vertex_conflicts = 0
        edge_conflicts = 0
        following_conflicts = 0
        intersection_conflicts = 0

        # Set to prevent duplicate conflicts for the same pair and time/location
        seen_conflict_keys: Set[str] = set()

        # 2. Pairwise Trajectory Inspection
        for i in range(n_robots):
            for j in range(i + 1, n_robots):
                r1_id = robot_list[i]
                r2_id = robot_list[j]
                pairs_examined += 1

                t1 = timelines[r1_id]
                t2 = timelines[r2_id]

                len1 = len(t1)
                len2 = len(t2)
                max_len = max(len1, len2)

                # Map of cell -> time steps visited by r1 and r2
                r1_cell_times: Dict[Tuple[int, int], List[int]] = {}
                for step, cell in enumerate(t1):
                    r1_cell_times.setdefault(cell, []).append(step)

                r2_cell_times: Dict[Tuple[int, int], List[int]] = {}
                for step, cell in enumerate(t2):
                    r2_cell_times.setdefault(cell, []).append(step)

                # A. VERTEX & EDGE CONFLICTS (Time-synchronous evaluation)
                for step in range(max_len):
                    pos1 = t1[min(step, len1 - 1)]
                    pos2 = t2[min(step, len2 - 1)]

                    # If both robots have already finished their paths and are parked, skip stationary checks
                    if step >= len1 and step >= len2:
                        continue

                    # Vertex Conflict: Same cell at same time
                    if pos1 == pos2:
                        c_key = f"VERTEX-{min(r1_id, r2_id)}-{max(r1_id, r2_id)}-{step}-{pos1}"
                        if c_key not in seen_conflict_keys:
                            seen_conflict_keys.add(c_key)
                            vertex_conflicts += 1
                            conflicts.append(
                                ConflictEvent(
                                    conflict_id=f"CONF-VTX-{vertex_conflicts:03d}",
                                    type=ConflictType.VERTEX_CONFLICT,
                                    robots=[r1_id, r2_id],
                                    cell=pos1,
                                    time_step=step,
                                    relative_time_s=round(step * self.time_step_duration_s, 2),
                                    severity=ConflictSeverity.CRITICAL,
                                    detected_at_tick=current_tick,
                                    description=(
                                        f"Vertex Conflict: {r1_id} and {r2_id} both occupy "
                                        f"cell ({pos1[0]}, {pos1[1]}) at timestep T+{step}"
                                    ),
                                )
                            )

                    # Edge Conflict: Swapping adjacent cells across same transition step
                    if step < max_len - 1:
                        next_pos1 = t1[min(step + 1, len1 - 1)]
                        next_pos2 = t2[min(step + 1, len2 - 1)]

                        if (
                            pos1 == next_pos2
                            and next_pos1 == pos2
                            and pos1 != next_pos1
                            and pos2 != next_pos2
                        ):
                            c_key = f"EDGE-{min(r1_id, r2_id)}-{max(r1_id, r2_id)}-{step+1}-{pos1}-{next_pos1}"
                            if c_key not in seen_conflict_keys:
                                seen_conflict_keys.add(c_key)
                                edge_conflicts += 1
                                conflicts.append(
                                    ConflictEvent(
                                        conflict_id=f"CONF-EDG-{edge_conflicts:03d}",
                                        type=ConflictType.EDGE_CONFLICT,
                                        robots=[r1_id, r2_id],
                                        from_cell=pos1,
                                        to_cell=next_pos1,
                                        time_step=step + 1,
                                        relative_time_s=round((step + 1) * self.time_step_duration_s, 2),
                                        severity=ConflictSeverity.CRITICAL,
                                        detected_at_tick=current_tick,
                                        description=(
                                            f"Edge Conflict: {r1_id} ({pos1}->{next_pos1}) and {r2_id} "
                                            f"({pos2}->{next_pos2}) traverse opposing directions at T+{step+1}"
                                        ),
                                    )
                                )

                # B. FOLLOWING CONFLICTS (Unsafe safety headway)
                # Check cells visited by both robots where time delta <= safety_headway (and delta > 0)
                common_cells = set(r1_cell_times.keys()) & set(r2_cell_times.keys())
                for cell in common_cells:
                    for time1 in r1_cell_times[cell]:
                        for time2 in r2_cell_times[cell]:
                            dt = abs(time1 - time2)
                            # Only if non-zero (zero is Vertex Conflict) and within headway
                            if 0 < dt <= self.safety_headway:
                                # Ensure both were actively moving into this cell
                                is_active = (time1 < len1) and (time2 < len2)
                                if is_active:
                                    lead_id = r1_id if time1 < time2 else r2_id
                                    follow_id = r2_id if time1 < time2 else r1_id
                                    entry_time = max(time1, time2)
                                    c_key = f"FOLL-{min(r1_id, r2_id)}-{max(r1_id, r2_id)}-{entry_time}-{cell}"
                                    if c_key not in seen_conflict_keys:
                                        seen_conflict_keys.add(c_key)
                                        following_conflicts += 1
                                        conflicts.append(
                                            ConflictEvent(
                                                conflict_id=f"CONF-FOL-{following_conflicts:03d}",
                                                type=ConflictType.FOLLOWING_CONFLICT,
                                                robots=[lead_id, follow_id],
                                                cell=cell,
                                                time_step=entry_time,
                                                relative_time_s=round(entry_time * self.time_step_duration_s, 2),
                                                severity=ConflictSeverity.WARNING,
                                                detected_at_tick=current_tick,
                                                description=(
                                                    f"Following Conflict: {follow_id} enters cell ({cell[0]}, {cell[1]}) "
                                                    f"at T+{entry_time}, only {dt} step(s) behind {lead_id}"
                                                ),
                                            )
                                        )

                # C. INTERSECTION CONFLICTS (Intersection contention window)
                for isect in intersections_set:
                    if isect in r1_cell_times and isect in r2_cell_times:
                        for time1 in r1_cell_times[isect]:
                            for time2 in r2_cell_times[isect]:
                                dt = abs(time1 - time2)
                                if 0 < dt <= self.intersection_window:
                                    cross_time = min(time1, time2)
                                    c_key = f"ISECT-{min(r1_id, r2_id)}-{max(r1_id, r2_id)}-{cross_time}-{isect}"
                                    if c_key not in seen_conflict_keys:
                                        seen_conflict_keys.add(c_key)
                                        intersection_conflicts += 1
                                        conflicts.append(
                                            ConflictEvent(
                                                conflict_id=f"CONF-INT-{intersection_conflicts:03d}",
                                                type=ConflictType.INTERSECTION_CONFLICT,
                                                robots=[r1_id, r2_id],
                                                cell=isect,
                                                time_step=cross_time,
                                                relative_time_s=round(cross_time * self.time_step_duration_s, 2),
                                                severity=ConflictSeverity.WARNING,
                                                detected_at_tick=current_tick,
                                                description=(
                                                    f"Intersection Contention: {r1_id} (T+{time1}) and {r2_id} (T+{time2}) "
                                                    f"cross junction ({isect[0]}, {isect[1]}) within {dt} step window"
                                                ),
                                            )
                                        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)

        return ConflictReport(
            conflicts=conflicts,
            total_conflicts=len(conflicts),
            vertex_conflicts=vertex_conflicts,
            edge_conflicts=edge_conflicts,
            following_conflicts=following_conflicts,
            intersection_conflicts=intersection_conflicts,
            detection_time_ms=elapsed_ms,
            pairs_examined=pairs_examined,
        )
