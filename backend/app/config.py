from pydantic import BaseModel

class SimulationConfig(BaseModel):
    # Warehouse grid dimensions (columns x rows)
    grid_width: int = 28
    grid_height: int = 20
    cell_size_meters: float = 1.0  # 1 cell = 1m x 1m

    # Simulation timing
    tick_rate_hz: float = 10.0
    speed_multiplier: float = 1.0

    # P2P Distributed Communication Timing
    p2p_state_update_interval_ticks: int = 2  # 200ms @ 10Hz
    p2p_heartbeat_interval_ticks: int = 5     # 500ms @ 10Hz
    p2p_stale_timeout_ticks: int = 15          # 1500ms @ 10Hz
    negotiation_timeout_ticks: int = 5        # 500ms @ 10Hz

    # Server networking
    host: str = "127.0.0.1"
    port: int = 8000
    ws_endpoint: str = "/ws/simulation"

config = SimulationConfig()

