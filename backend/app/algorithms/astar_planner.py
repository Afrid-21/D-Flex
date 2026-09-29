import heapq
import time
from typing import List, Tuple, Optional, Dict, Set
from pydantic import BaseModel, Field
from app.core.grid import WarehouseMap
from app.schemas.warehouse import CellType

class PathResult(BaseModel):
    success: bool
    path: List[Tuple[int, int]] = Field(default_factory=list)
    path_length: int = 0
    explored_nodes: int = 0
    planning_time_ms: float = 0.0
    reason: Optional[str] = None

class AStarPlanner:
    """
    4-Directional A* Grid Path Planner for Autonomous Mobile Robots.
    Cost function: f(n) = g(n) + h(n)
    g(n): step cost from start
    h(n): Manhattan distance to goal
    """

    # 4 cardinal movement directions (dx, dy): Right, Left, Down, Up
    CARDINAL_MOTIONS: List[Tuple[int, int]] = [
        (1, 0),   # East
        (-1, 0),  # West
        (0, 1),   # South
        (0, -1),  # North
    ]

    @staticmethod
    def manhattan_distance(p1: Tuple[int, int], p2: Tuple[int, int]) -> int:
        """Computes Manhattan distance h(n) = |x1 - x2| + |y1 - y2|."""
        return abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])

    @classmethod
    def plan_path(
        cls,
        start: Tuple[int, int],
        goal: Tuple[int, int],
        warehouse_map: WarehouseMap,
        allow_goal_station: bool = True,
    ) -> PathResult:
        """
        Calculates the shortest 4-directional collision-free path from start to goal.
        Returns a PathResult containing the ordered waypoint list and planning metrics.
        """
        start_time = time.perf_counter()

        # 1. Edge Case: Start equals Goal
        if start == goal:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)
            return PathResult(
                success=True,
                path=[start],
                path_length=0,
                explored_nodes=1,
                planning_time_ms=elapsed_ms,
                reason="START_EQUALS_GOAL",
            )

        # 2. Boundary and Walkability Validation
        width, height = warehouse_map.width, warehouse_map.height

        def is_valid_cell(pos: Tuple[int, int], is_goal: bool = False) -> bool:
            x, y = pos
            if x < 0 or x >= width or y < 0 or y >= height:
                return False
            cell = warehouse_map.grid[y][x]
            if not cell.is_walkable or cell.type == CellType.SHELF or cell.type == CellType.OBSTACLE:
                # If destination is a designated logistics station / charging dock, allow goal
                if is_goal and allow_goal_station and cell.type in [
                    CellType.CHARGING_STATION,
                    CellType.PICKUP_STATION,
                    CellType.DROPOFF_STATION,
                ]:
                    return True
                return False
            return True

        # Validate Start
        if not is_valid_cell(start):
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)
            return PathResult(
                success=False,
                path=[],
                path_length=0,
                explored_nodes=0,
                planning_time_ms=elapsed_ms,
                reason="INVALID_START_POSITION",
            )

        # Validate Goal
        if not is_valid_cell(goal, is_goal=True):
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)
            return PathResult(
                success=False,
                path=[],
                path_length=0,
                explored_nodes=0,
                planning_time_ms=elapsed_ms,
                reason="INVALID_GOAL_POSITION",
            )

        # 3. Priority Queue (Min-Heap) and Visited/Cost tracking
        # Heap item: (f_score, h_score, tie_breaker_count, current_node)
        tie_breaker = 0
        open_set: List[Tuple[float, float, int, Tuple[int, int]]] = []
        h_start = cls.manhattan_distance(start, goal)
        heapq.heappush(open_set, (h_start, h_start, tie_breaker, start))

        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
        g_score: Dict[Tuple[int, int], float] = {start: 0.0}
        f_score: Dict[Tuple[int, int], float] = {start: float(h_start)}
        explored_nodes: Set[Tuple[int, int]] = set()

        # 4. A* Search Loop
        while open_set:
            _, _, _, current = heapq.heappop(open_set)

            if current in explored_nodes:
                continue
            explored_nodes.add(current)

            # Destination Reached!
            if current == goal:
                # Reconstruct path
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                path.reverse()

                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)
                return PathResult(
                    success=True,
                    path=path,
                    path_length=len(path) - 1,
                    explored_nodes=len(explored_nodes),
                    planning_time_ms=elapsed_ms,
                    reason="PATH_FOUND",
                )

            # Explore 4 Cardinal Neighbors
            for dx, dy in cls.CARDINAL_MOTIONS:
                neighbor = (current[0] + dx, current[1] + dy)
                is_goal_node = (neighbor == goal)

                if not is_valid_cell(neighbor, is_goal=is_goal_node):
                    continue

                tentative_g = g_score[current] + 1.0  # Unit cost per grid cell

                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    h_val = cls.manhattan_distance(neighbor, goal)
                    f_val = tentative_g + h_val
                    f_score[neighbor] = f_val

                    tie_breaker += 1
                    heapq.heappush(open_set, (f_val, h_val, tie_breaker, neighbor))

        # 5. Open set exhausted -> No Valid Path Exists
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 3)
        return PathResult(
            success=False,
            path=[],
            path_length=0,
            explored_nodes=len(explored_nodes),
            planning_time_ms=elapsed_ms,
            reason="NO_PATH",
        )
