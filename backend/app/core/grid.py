from typing import List, Dict, Tuple, Optional, Set
from app.schemas.warehouse import (
    CellType,
    CellData,
    ShelfInfo,
    StationInfo,
    ObstacleInfo,
    WarehouseLayout,
)

class WarehouseMap:
    """
    Manages the 2D spatial layout, topological features, racks, aisles,
    stations, charging bays, and dynamic obstacles of the smart warehouse.
    """

    def __init__(self, width: int = 28, height: int = 20, obstacles: Optional[List[Tuple[int, int]]] = None):
        self.width = width
        self.height = height

        self.shelves: Dict[str, ShelfInfo] = {}
        self.stations: Dict[str, StationInfo] = {}
        self.charging_docks: Dict[str, StationInfo] = {}
        self.obstacles: Dict[str, ObstacleInfo] = {}
        self.intersections: Set[Tuple[int, int]] = set()

        # 2D grid of CellData
        self.grid: List[List[CellData]] = []
        self._build_default_layout()

        if obstacles:
            for obs in obstacles:
                self.add_obstacle(obs[0], obs[1])

    def _build_default_layout(self):
        """Builds a realistic automated warehouse layout."""
        # 1. Initialize empty grid
        self.grid = []
        for y in range(self.height):
            row: List[CellData] = []
            for x in range(self.width):
                row.append(
                    CellData(
                        x=x,
                        y=y,
                        type=CellType.AISLE,
                        is_walkable=True,
                    )
                )
            self.grid.append(row)

        # 2. Add Charging Stations at bottom-left and top-left corners
        charging_coords = [
            (2, 1, "CHG-01", "Charging Bay 1"),
            (3, 1, "CHG-02", "Charging Bay 2"),
            (4, 1, "CHG-03", "Charging Bay 3"),
            (2, 18, "CHG-04", "Charging Bay 4"),
            (3, 18, "CHG-05", "Charging Bay 5"),
            (4, 18, "CHG-06", "Charging Bay 6"),
        ]
        for x, y, sid, name in charging_coords:
            st = StationInfo(
                id=sid,
                name=name,
                x=x,
                y=y,
                station_type=CellType.CHARGING_STATION,
                description="High-Speed AMR Inductive Charger",
            )
            self.charging_docks[sid] = st
            self.grid[y][x] = CellData(
                x=x, y=y, type=CellType.CHARGING_STATION, meta_id=sid, is_walkable=True
            )

        # 3. Add Pickup / Inbound Stations on the West wall
        pickup_coords = [
            (1, 5, "PK-01", "Inbound Dock A (Electronics)"),
            (1, 9, "PK-02", "Inbound Dock B (Hardware)"),
            (1, 13, "PK-03", "Inbound Dock C (Apparel)"),
        ]
        for x, y, sid, name in pickup_coords:
            st = StationInfo(
                id=sid,
                name=name,
                x=x,
                y=y,
                station_type=CellType.PICKUP_STATION,
                description="Receiving and Item Picking Station",
            )
            self.stations[sid] = st
            self.grid[y][x] = CellData(
                x=x, y=y, type=CellType.PICKUP_STATION, meta_id=sid, is_walkable=True
            )

        # 4. Add Dropoff / Packing / Outbound Stations on the East wall
        dropoff_coords = [
            (26, 5, "DP-01", "Packing Bay A (Express)"),
            (26, 9, "DP-02", "Packing Bay B (Standard)"),
            (26, 13, "DP-03", "Packing Bay C (Bulk Dispatch)"),
        ]
        for x, y, sid, name in dropoff_coords:
            st = StationInfo(
                id=sid,
                name=name,
                x=x,
                y=y,
                station_type=CellType.DROPOFF_STATION,
                description="Sorting and Packaging Station",
            )
            self.stations[sid] = st
            self.grid[y][x] = CellData(
                x=x, y=y, type=CellType.DROPOFF_STATION, meta_id=sid, is_walkable=True
            )

        # 5. Add Storage Shelf Blocks (Double-racks separated by main aisles)
        # Rack column pairs: (6,7), (10,11), (14,15), (18,19), (22,23)
        # Rack row spans: rows 3..6 (Zone A), rows 9..12 (Zone B), rows 14..16 (Zone C)
        rack_col_pairs = [(6, 7), (10, 11), (14, 15), (18, 19), (22, 23)]
        rack_row_bands = [
            (3, 6, "Zone A - High Turn"),
            (9, 12, "Zone B - Medium Turn"),
            (14, 16, "Zone C - Bulk Storage"),
        ]

        shelf_index = 1
        for col_pair in rack_col_pairs:
            for y_start, y_end, zone in rack_row_bands:
                for y in range(y_start, y_end + 1):
                    for x in col_pair:
                        sid = f"SH-{shelf_index:03d}"
                        cat = "Standard SKU"
                        sh = ShelfInfo(
                            id=sid,
                            x=x,
                            y=y,
                            zone=zone,
                            category=cat,
                            occupied_sku=f"SKU-{shelf_index * 107 % 999:03d}",
                        )
                        self.shelves[sid] = sh
                        self.grid[y][x] = CellData(
                            x=x,
                            y=y,
                            type=CellType.SHELF,
                            zone=zone,
                            meta_id=sid,
                            is_walkable=False,  # AMRs cannot drive through physical shelves
                        )
                        shelf_index += 1

        # 6. Detect Intersections (Aisle cells crossing between vertical and horizontal corridors)
        # Vertical main aisles are at x in [0, 1, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 27]
        # Horizontal cross aisles are at y in [0, 2, 7, 8, 13, 17, 19]
        self._compute_intersections()

    def _compute_intersections(self):
        """Identifies key multi-way crossing cells (intersections)."""
        self.intersections.clear()
        for y in range(self.height):
            for x in range(self.width):
                if self.grid[y][x].type == CellType.AISLE:
                    # Count walkable neighbors in 4 cardinal directions
                    walkable_horiz = 0
                    walkable_vert = 0
                    if x > 0 and self.is_walkable(x - 1, y):
                        walkable_horiz += 1
                    if x < self.width - 1 and self.is_walkable(x + 1, y):
                        walkable_horiz += 1
                    if y > 0 and self.is_walkable(x, y - 1):
                        walkable_vert += 1
                    if y < self.height - 1 and self.is_walkable(x, y + 1):
                        walkable_vert += 1

                    # If this cell connects both horizontal and vertical lanes, mark as intersection
                    if walkable_horiz >= 2 and walkable_vert >= 2:
                        self.intersections.add((x, y))
                        self.grid[y][x].type = CellType.INTERSECTION

    def get_cell(self, x: int, y: int) -> Optional[CellData]:
        """Returns the CellData at (x, y) if within bounds."""
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.grid[y][x]
        return None

    def is_walkable(self, x: int, y: int) -> bool:
        """Returns True if the cell is within bounds and not blocked by a shelf or obstacle."""
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return False
        cell = self.grid[y][x]
        return cell.is_walkable and (cell.type != CellType.SHELF and cell.type != CellType.OBSTACLE)

    def is_obstacle(self, x: int, y: int) -> bool:
        """Returns True if the cell is blocked by a shelf, obstacle, or out-of-bounds."""
        return not self.is_walkable(x, y)

    def add_obstacle(self, x: int, y: int, label: str = "Dynamic Obstacle") -> bool:
        """Adds a dynamic obstacle on cell (x, y) if not already blocked."""
        obs_key = f"{x},{y}"
        if obs_key in self.obstacles:
            return True
        return self.toggle_obstacle(x, y, label)

    def remove_obstacle(self, x: int, y: int) -> bool:
        """Removes a dynamic obstacle on cell (x, y) if present."""
        obs_key = f"{x},{y}"
        if obs_key in self.obstacles:
            self.toggle_obstacle(x, y)
            return True
        return False

    def toggle_obstacle(self, x: int, y: int, label: str = "Dynamic Obstacle") -> bool:
        """
        Toggles a dynamic obstacle on cell (x, y).
        Returns True if obstacle was added, False if removed or invalid.
        """
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return False

        cell = self.grid[y][x]
        # Don't allow placing obstacles on permanent shelves or stations
        if cell.type in [CellType.SHELF, CellType.PICKUP_STATION, CellType.DROPOFF_STATION, CellType.CHARGING_STATION]:
            return False

        obs_key = f"{x},{y}"
        if obs_key in self.obstacles:
            # Remove obstacle
            del self.obstacles[obs_key]
            # Restore cell type
            is_intersect = (x, y) in self.intersections
            cell.type = CellType.INTERSECTION if is_intersect else CellType.AISLE
            cell.is_walkable = True
            cell.meta_id = None
            return False
        else:
            # Add obstacle
            obs = ObstacleInfo(
                id=f"OBS-{x}-{y}",
                x=x,
                y=y,
                label=label,
                is_dynamic=True,
            )
            self.obstacles[obs_key] = obs
            cell.type = CellType.OBSTACLE
            cell.is_walkable = False
            cell.meta_id = obs.id
            return True

    def clear_all_obstacles(self):
        """Removes all dynamic obstacles."""
        for obs in list(self.obstacles.values()):
            x, y = obs.x, obs.y
            is_intersect = (x, y) in self.intersections
            self.grid[y][x].type = CellType.INTERSECTION if is_intersect else CellType.AISLE
            self.grid[y][x].is_walkable = True
            self.grid[y][x].meta_id = None
        self.obstacles.clear()

    def clone(self) -> 'WarehouseMap':
        """Creates a clone of the current warehouse map."""
        obs_coords = [(obs.x, obs.y) for obs in self.obstacles.values()]
        return WarehouseMap(width=self.width, height=self.height, obstacles=obs_coords)

    def get_layout(self) -> WarehouseLayout:
        """Returns the serialized Pydantic warehouse layout."""
        return WarehouseLayout(
            width=self.width,
            height=self.height,
            cells=self.grid,
            shelves=list(self.shelves.values()),
            stations=list(self.stations.values()),
            charging_docks=list(self.charging_docks.values()),
            obstacles=list(self.obstacles.values()),
            intersections=list(self.intersections),
        )
