from typing import List, Dict, Tuple, Optional, Set
from app.schemas.warehouse import (
    ResourceType,
    ReservationStatus,
    Reservation,
    RobotReservationSummary,
    ReservationConflictInfo,
    ReservationSummary,
)

class ReservationTable:
    """
    Modular Spatio-Temporal Reservation Engine for Warehouse Fleets.
    Tracks and arbitrates ownership of grid cells and path edges across time intervals [Tstart, Tend].
    Enforces the core safety invariant: existing reservations are NEVER silently overwritten.
    """

    def __init__(self, safety_buffer_steps: int = 1):
        self.safety_buffer_steps: int = safety_buffer_steps
        self.cell_reservations: Dict[Tuple[int, int], List[Reservation]] = {}
        self.edge_reservations: Dict[Tuple[Tuple[int, int], Tuple[int, int]], List[Reservation]] = {}
        self.all_reservations: Dict[str, Reservation] = {}
        self.conflicts: List[ReservationConflictInfo] = []
        self._res_counter: int = 0

    def _next_id(self, r_type: ResourceType) -> str:
        self._res_counter += 1
        prefix = "RES-CEL" if r_type == ResourceType.CELL else "RES-EDG"
        return f"{prefix}-{self._res_counter:04d}"

    def clear(self):
        """Clears all reservations and conflict records."""
        self.cell_reservations.clear()
        self.edge_reservations.clear()
        self.all_reservations.clear()
        self.conflicts.clear()
        self._res_counter = 0

    def reserve_cell(
        self,
        robot_id: str,
        cell: Tuple[int, int],
        start_time: int,
        end_time: int,
        current_tick: int = 0,
    ) -> Tuple[bool, Reservation, Optional[Reservation]]:
        """
        Attempts to reserve a grid cell for [start_time, end_time].
        Applies safety buffer to prevent unsafe headway collisions.
        Returns: (granted: bool, requested_or_created_reservation, conflicting_reservation_if_any)
        """
        # Search for overlapping active/created reservations on this cell from other robots
        cell_key = (int(cell[0]), int(cell[1]))
        existing_list = self.cell_reservations.get(cell_key, [])

        effective_start = max(0, start_time - self.safety_buffer_steps)
        effective_end = end_time + self.safety_buffer_steps

        for existing in existing_list:
            if existing.status in [ReservationStatus.ACTIVE, ReservationStatus.CREATED]:
                if existing.robot_id != robot_id:
                    # Check interval overlap: max(start1, start2) <= min(end1, end2)
                    if max(effective_start, existing.start_time) <= min(effective_end, existing.end_time):
                        # CONFLICT: Existing reservation is preserved, new reservation rejected
                        res_id = self._next_id(ResourceType.CELL)
                        conflicted_res = Reservation(
                            reservation_id=res_id,
                            robot_id=robot_id,
                            resource_type=ResourceType.CELL,
                            cell=cell_key,
                            start_time=start_time,
                            end_time=end_time,
                            status=ReservationStatus.CONFLICTED,
                            created_at_tick=current_tick,
                        )
                        conflict_info = ReservationConflictInfo(
                            reservation_id=res_id,
                            requested_by=robot_id,
                            resource_type=ResourceType.CELL,
                            resource_repr=f"Cell ({cell_key[0]}, {cell_key[1]})",
                            requested_interval=(start_time, end_time),
                            conflicting_robot=existing.robot_id,
                            conflicting_reservation_id=existing.reservation_id,
                            status="CONFLICTED",
                        )
                        self.conflicts.append(conflict_info)
                        self.all_reservations[res_id] = conflicted_res
                        return False, conflicted_res, existing

        # No conflict -> GRANTED
        res_id = self._next_id(ResourceType.CELL)
        new_res = Reservation(
            reservation_id=res_id,
            robot_id=robot_id,
            resource_type=ResourceType.CELL,
            cell=cell_key,
            start_time=start_time,
            end_time=end_time,
            status=ReservationStatus.ACTIVE,
            created_at_tick=current_tick,
        )
        self.cell_reservations.setdefault(cell_key, []).append(new_res)
        self.all_reservations[res_id] = new_res
        return True, new_res, None

    def reserve_edge(
        self,
        robot_id: str,
        from_cell: Tuple[int, int],
        to_cell: Tuple[int, int],
        start_time: int,
        end_time: int,
        current_tick: int = 0,
    ) -> Tuple[bool, Reservation, Optional[Reservation]]:
        """
        Attempts to reserve a directed transition edge (from_cell -> to_cell) for [start_time, end_time].
        Checks for both forward edge collisions and reverse head-on edge collisions (to_cell -> from_cell).
        """
        f_key = (int(from_cell[0]), int(from_cell[1]))
        t_key = (int(to_cell[0]), int(to_cell[1]))
        forward_edge = (f_key, t_key)
        reverse_edge = (t_key, f_key)

        # Check opposing/reverse edge traversal (head-on collision)
        for existing in self.edge_reservations.get(reverse_edge, []):
            if existing.status in [ReservationStatus.ACTIVE, ReservationStatus.CREATED]:
                if existing.robot_id != robot_id:
                    if max(start_time, existing.start_time) <= min(end_time, existing.end_time):
                        res_id = self._next_id(ResourceType.EDGE)
                        conflicted_res = Reservation(
                            reservation_id=res_id,
                            robot_id=robot_id,
                            resource_type=ResourceType.EDGE,
                            from_cell=f_key,
                            to_cell=t_key,
                            start_time=start_time,
                            end_time=end_time,
                            status=ReservationStatus.CONFLICTED,
                            created_at_tick=current_tick,
                        )
                        conflict_info = ReservationConflictInfo(
                            reservation_id=res_id,
                            requested_by=robot_id,
                            resource_type=ResourceType.EDGE,
                            resource_repr=f"Edge ({f_key[0]},{f_key[1]})→({t_key[0]},{t_key[1]})",
                            requested_interval=(start_time, end_time),
                            conflicting_robot=existing.robot_id,
                            conflicting_reservation_id=existing.reservation_id,
                            status="CONFLICTED",
                        )
                        self.conflicts.append(conflict_info)
                        self.all_reservations[res_id] = conflicted_res
                        return False, conflicted_res, existing

        # Check same edge concurrent occupancy
        for existing in self.edge_reservations.get(forward_edge, []):
            if existing.status in [ReservationStatus.ACTIVE, ReservationStatus.CREATED]:
                if existing.robot_id != robot_id:
                    if max(start_time, existing.start_time) <= min(end_time, existing.end_time):
                        res_id = self._next_id(ResourceType.EDGE)
                        conflicted_res = Reservation(
                            reservation_id=res_id,
                            robot_id=robot_id,
                            resource_type=ResourceType.EDGE,
                            from_cell=f_key,
                            to_cell=t_key,
                            start_time=start_time,
                            end_time=end_time,
                            status=ReservationStatus.CONFLICTED,
                            created_at_tick=current_tick,
                        )
                        conflict_info = ReservationConflictInfo(
                            reservation_id=res_id,
                            requested_by=robot_id,
                            resource_type=ResourceType.EDGE,
                            resource_repr=f"Edge ({f_key[0]},{f_key[1]})→({t_key[0]},{t_key[1]})",
                            requested_interval=(start_time, end_time),
                            conflicting_robot=existing.robot_id,
                            conflicting_reservation_id=existing.reservation_id,
                            status="CONFLICTED",
                        )
                        self.conflicts.append(conflict_info)
                        self.all_reservations[res_id] = conflicted_res
                        return False, conflicted_res, existing

        # No conflict -> GRANTED
        res_id = self._next_id(ResourceType.EDGE)
        new_res = Reservation(
            reservation_id=res_id,
            robot_id=robot_id,
            resource_type=ResourceType.EDGE,
            from_cell=f_key,
            to_cell=t_key,
            start_time=start_time,
            end_time=end_time,
            status=ReservationStatus.ACTIVE,
            created_at_tick=current_tick,
        )
        self.edge_reservations.setdefault(forward_edge, []).append(new_res)
        self.all_reservations[res_id] = new_res
        return True, new_res, None

    def reserve_robot_path(
        self,
        robot_id: str,
        path: List[Tuple[int, int]],
        start_tick: int = 0,
        current_tick: int = 0,
    ) -> List[Tuple[bool, Reservation, Optional[Reservation]]]:
        """
        Converts an ordered path into sequential cell and edge reservations.
        """
        results: List[Tuple[bool, Reservation, Optional[Reservation]]] = []
        if not path:
            return results

        # 1. Release previous active reservations for this robot before rebooking
        self.release_robot_reservations(robot_id)

        path_len = len(path)
        for k in range(path_len):
            cell = path[k]
            t_entry = start_tick + k
            # Reserve cell for occupancy window
            t_exit = t_entry + 1
            cell_res = self.reserve_cell(
                robot_id=robot_id,
                cell=cell,
                start_time=t_entry,
                end_time=t_exit,
                current_tick=current_tick,
            )
            results.append(cell_res)

            # Reserve edge transition to next cell
            if k < path_len - 1:
                next_cell = path[k + 1]
                edge_res = self.reserve_edge(
                    robot_id=robot_id,
                    from_cell=cell,
                    to_cell=next_cell,
                    start_time=t_entry,
                    end_time=t_exit,
                    current_tick=current_tick,
                )
                results.append(edge_res)

        return results

    def release_reservation(self, reservation_id: str) -> bool:
        """Marks a reservation as RELEASED."""
        if reservation_id in self.all_reservations:
            res = self.all_reservations[reservation_id]
            res.status = ReservationStatus.RELEASED
            return True
        return False

    def release_robot_reservations(self, robot_id: str) -> int:
        """Releases all active or created reservations owned by robot_id."""
        released_count = 0
        for res in self.all_reservations.values():
            if res.robot_id == robot_id and res.status in [
                ReservationStatus.ACTIVE,
                ReservationStatus.CREATED,
            ]:
                res.status = ReservationStatus.RELEASED
                released_count += 1
        return released_count

    def release_future_reservations(self, robot_id: str, current_tick: int) -> int:
        """
        Releases only the future reservations (start_time > current_tick) for robot_id,
        preserving current occupancy reservation.
        """
        released_count = 0
        for res in self.all_reservations.values():
            if res.robot_id == robot_id and res.start_time > current_tick and res.status in [
                ReservationStatus.ACTIVE,
                ReservationStatus.CREATED,
            ]:
                res.status = ReservationStatus.RELEASED
                released_count += 1
        return released_count

    def get_cell_reservation(
        self,
        cell: Tuple[int, int],
        time_step: int,
        exclude_robot: Optional[str] = None,
    ) -> Optional[Reservation]:
        """Returns the active reservation owning cell at time_step, if any."""
        return self.is_cell_reserved(cell, time_step, exclude_robot)

    def expire_reservations(self, current_time: int) -> int:
        """Marks reservations with end_time < current_time as EXPIRED."""
        expired_count = 0
        for res in self.all_reservations.values():
            if res.status == ReservationStatus.ACTIVE and res.end_time < current_time:
                res.status = ReservationStatus.EXPIRED
                expired_count += 1
        return expired_count

    def is_cell_reserved(
        self,
        cell: Tuple[int, int],
        time_step: int,
        exclude_robot: Optional[str] = None,
    ) -> Optional[Reservation]:
        """Returns the active reservation owning cell at time_step, if any."""
        cell_key = (int(cell[0]), int(cell[1]))
        for res in self.cell_reservations.get(cell_key, []):
            if res.status == ReservationStatus.ACTIVE:
                if exclude_robot is None or res.robot_id != exclude_robot:
                    if res.start_time <= time_step <= res.end_time:
                        return res
        return None

    def is_edge_reserved(
        self,
        from_cell: Tuple[int, int],
        to_cell: Tuple[int, int],
        time_step: int,
        exclude_robot: Optional[str] = None,
    ) -> Optional[Reservation]:
        """Returns active reservation on edge (or reverse edge) at time_step, if any."""
        f_key = (int(from_cell[0]), int(from_cell[1]))
        t_key = (int(to_cell[0]), int(to_cell[1]))
        edge_key = (f_key, t_key)
        for res in self.edge_reservations.get(edge_key, []):
            if res.status == ReservationStatus.ACTIVE:
                if exclude_robot is None or res.robot_id != exclude_robot:
                    if res.start_time <= time_step <= res.end_time:
                        return res
        return None

    def get_reservations_for_robot(
        self,
        robot_id: str,
        status_filter: Optional[ReservationStatus] = None,
    ) -> List[Reservation]:
        """Retrieves reservations for a specific robot."""
        return [
            r
            for r in self.all_reservations.values()
            if r.robot_id == robot_id
            and (status_filter is None or r.status == status_filter)
        ]

    def get_active_reservations(self) -> List[Reservation]:
        """Retrieves all currently ACTIVE reservations across the fleet."""
        return [
            r
            for r in self.all_reservations.values()
            if r.status == ReservationStatus.ACTIVE
        ]

    def get_reservations_for_cell(self, cell: Tuple[int, int]) -> List[Reservation]:
        """Retrieves all reservations for a specific cell coordinate."""
        cell_key = (int(cell[0]), int(cell[1]))
        return [
            r
            for r in self.cell_reservations.get(cell_key, [])
            if r.status in [ReservationStatus.ACTIVE, ReservationStatus.CONFLICTED]
        ]

    def get_summary(self) -> ReservationSummary:
        """Generates a comprehensive snapshot for WebSocket telemetry & dashboard."""
        by_robot: Dict[str, RobotReservationSummary] = {}
        active_list: List[Reservation] = []
        conflicts_list: List[ReservationConflictInfo] = list(self.conflicts)

        for res in self.all_reservations.values():
            if res.status == ReservationStatus.ACTIVE:
                active_list.append(res)
                summary = by_robot.setdefault(
                    res.robot_id,
                    RobotReservationSummary(
                        robot_id=res.robot_id,
                        cell_count=0,
                        edge_count=0,
                        start_time=res.start_time,
                        end_time=res.end_time,
                        has_conflicts=False,
                    ),
                )
                if res.resource_type == ResourceType.CELL:
                    summary.cell_count += 1
                else:
                    summary.edge_count += 1
                summary.start_time = min(summary.start_time, res.start_time)
                summary.end_time = max(summary.end_time, res.end_time)

        # Flag robots with active conflicts
        for conf in conflicts_list:
            if conf.requested_by in by_robot:
                by_robot[conf.requested_by].has_conflicts = True
            if conf.conflicting_robot in by_robot:
                by_robot[conf.conflicting_robot].has_conflicts = True

        return ReservationSummary(
            total_active=len(active_list),
            total_conflicted=len(conflicts_list),
            by_robot=by_robot,
            active_reservations=active_list,
            conflicts=conflicts_list,
        )
