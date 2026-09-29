import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.warehouse import SimulationState, ControlCommand
from app.core.simulation import SimulationEngine
from app.config import config

# Singleton simulation engine instance
sim_engine = SimulationEngine()

# Connected WebSocket clients
active_websockets: List[WebSocket] = []
websocket_state_queues: Dict[WebSocket, asyncio.Queue[str]] = {}
last_obstacle_signature: tuple[tuple[int, int, str], ...] | None = None

def _apply_network_fault_params(params: dict):
    packet_loss_pct = params.get("packet_loss_rate_pct", params.get("packet_loss_pct", 0.0))
    latency_ms = params.get("simulated_latency_ms", params.get("latency_ms", 0.0))
    sim_engine.set_network_faults(float(packet_loss_pct), float(latency_ms))

def _queue_latest_state(queue: asyncio.Queue[str], payload: str):
    if queue.full():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
    queue.put_nowait(payload)

async def _send_queued_states(websocket: WebSocket, queue: asyncio.Queue[str]):
    try:
        while True:
            await websocket.send_text(await queue.get())
    except asyncio.CancelledError:
        raise
    except Exception as error:
        print(f"[WebSocket] State sender stopped: {error}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        websocket_state_queues.pop(websocket, None)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

def broadcast_state(state: SimulationState):
    """Callback invoked by sim_engine on state change/tick to push to all WebSockets."""
    global last_obstacle_signature
    obstacle_signature = tuple(
        (obstacle.x, obstacle.y, obstacle.label)
        for obstacle in state.layout.obstacles
    )
    layout_changed = obstacle_signature != last_obstacle_signature
    last_obstacle_signature = obstacle_signature
    payload = state.model_dump_json(exclude=None if layout_changed else {"layout"})
    for ws in list(active_websockets):
        queue = websocket_state_queues.get(ws)
        if queue is not None:
            _queue_latest_state(queue, payload)

sim_engine.register_listener(broadcast_state)

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await sim_engine.shutdown()

app = FastAPI(
    title="SIH26123 AMR Fleet Simulation API",
    version="1.0.0",
    description="Edge-AI Distributed Fleet Coordination Simulator for Smart Warehouses",
    lifespan=lifespan,
)

# Allow the deployed frontend and local development servers to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d-flex-eight.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "phase": "Phase 1 - Basic Warehouse Simulation"}

@app.get("/api/state", response_model=SimulationState)
async def get_simulation_state():
    return sim_engine.get_state()

@app.post("/api/control")
async def handle_control(command: ControlCommand):
    action = command.action.lower()
    params = command.params or {}

    if action == "start":
        sim_engine.start()
    elif action == "pause":
        sim_engine.pause()
    elif action == "reset":
        sim_engine.reset()
    elif action == "step":
        sim_engine.step()
    elif action == "set_speed":
        speed = float(params.get("speed", 1.0))
        sim_engine.set_speed(speed)
    elif action == "toggle_obstacle":
        x = int(params.get("x", -1))
        y = int(params.get("y", -1))
        sim_engine.toggle_obstacle(x, y)
    elif action == "clear_obstacles":
        sim_engine.map.clear_all_obstacles()
        sim_engine._notify_listeners()
    elif action == "set_robot_destination":
        robot_id = str(params.get("robot_id", "R1"))
        x = int(params.get("x", 0))
        y = int(params.get("y", 0))
        label = str(params.get("label", f"Target ({x},{y})"))
        sim_engine.fleet.set_robot_destination(robot_id, (x, y), label)
        sim_engine._notify_listeners()
    elif action == "add_robot":
        sim_engine.fleet.add_robot(
            str(params.get("robot_id", "")),
            (int(params.get("start_x", 0)), int(params.get("start_y", 0))),
            (int(params.get("goal_x", 0)), int(params.get("goal_y", 0))),
            str(params.get("destination_label", "")),
            float(params.get("battery", 100.0)),
            str(params.get("task", "Live mission")),
        )
        sim_engine._notify_listeners()
    elif action == "replan_all":
        sim_engine.fleet.replan_all()
        sim_engine._notify_listeners()
    elif action == "trigger_conflict_demo":
        sim_engine.trigger_conflict_demo()
    elif action == "trigger_deadlock_demo_2robot":
        sim_engine.trigger_deadlock_demo_2robot()
    elif action == "trigger_deadlock_demo_3robot":
        sim_engine.trigger_deadlock_demo_3robot()
    elif action == "resolve_deadlock":
        sim_engine.resolve_deadlock()
    elif action == "trigger_reroute_scenario_a":
        sim_engine.trigger_reroute_scenario_a()
    elif action == "trigger_reroute_scenario_b":
        sim_engine.trigger_reroute_scenario_b()
    elif action == "trigger_reroute_scenario_c":
        sim_engine.trigger_reroute_scenario_c()
    elif action == "trigger_task_scenario_a":
        sim_engine.trigger_task_scenario_a()
    elif action == "trigger_task_scenario_b":
        sim_engine.trigger_task_scenario_b()
    elif action == "trigger_task_scenario_c":
        sim_engine.trigger_task_scenario_c()
    elif action == "trigger_task_scenario_d":
        sim_engine.trigger_task_scenario_d()
    elif action == "trigger_task_scenario_e":
        sim_engine.trigger_task_scenario_e()
    elif action == "trigger_reassign_scenario_a":
        sim_engine.trigger_reassign_scenario_a()
    elif action == "trigger_reassign_scenario_b":
        sim_engine.trigger_reassign_scenario_b()
    elif action == "trigger_reassign_scenario_c":
        sim_engine.trigger_reassign_scenario_c()
    elif action == "trigger_edge_ai_scenario_a":
        sim_engine.trigger_edge_ai_scenario_a()
    elif action == "trigger_edge_ai_scenario_b":
        sim_engine.trigger_edge_ai_scenario_b()
    elif action == "trigger_edge_ai_scenario_c":
        sim_engine.trigger_edge_ai_scenario_c()
    elif action == "set_network_faults":
        _apply_network_fault_params(params)
    elif action == "trigger_network_scenario_a":
        sim_engine.trigger_network_scenario_a()
    elif action == "trigger_network_scenario_b":
        sim_engine.trigger_network_scenario_b()
    elif action == "trigger_network_scenario_c":
        sim_engine.trigger_network_scenario_c()
    elif action == "trigger_spof_failure":
        sim_engine.trigger_spof_failure()
    elif action == "restore_centralized_server":
        sim_engine.restore_centralized_server()
    elif action == "run_benchmark_suite":
        sim_engine.run_benchmark_suite()
    elif action == "trigger_full_e2e_demo":
        sim_engine.trigger_full_e2e_demo()
    elif action == "reset_tasks":
        sim_engine.reset_tasks()
    else:
        return {"success": False, "error": f"Unknown action '{action}'"}

    return {"success": True, "action": action, "state": sim_engine.get_state()}

@app.post("/api/plan-path")
async def plan_path_endpoint(payload: dict):
    """Direct A* query endpoint for testing custom paths."""
    from app.algorithms.astar_planner import AStarPlanner
    start = (int(payload.get("start_x", 0)), int(payload.get("start_y", 0)))
    goal = (int(payload.get("goal_x", 0)), int(payload.get("goal_y", 0)))
    result = AStarPlanner.plan_path(start, goal, sim_engine.map)
    return result.model_dump()

@app.websocket("/ws/simulation")
async def simulation_websocket(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    send_queue: asyncio.Queue[str] = asyncio.Queue(maxsize=1)
    websocket_state_queues[websocket] = send_queue
    sender_task = None
    # Send initial state immediately upon connection
    await websocket.send_text(sim_engine.get_state().model_dump_json())
    sender_task = asyncio.create_task(_send_queued_states(websocket, send_queue))

    try:
        while True:
            data = await websocket.receive_json()
            # Support incoming control commands over WebSocket too
            action = data.get("action", "").lower()
            params = data.get("params", {})

            if action == "start":
                sim_engine.start()
            elif action == "pause":
                sim_engine.pause()
            elif action == "reset":
                sim_engine.reset()
            elif action == "step":
                sim_engine.step()
            elif action == "set_speed":
                sim_engine.set_speed(float(params.get("speed", 1.0)))
            elif action == "toggle_obstacle":
                sim_engine.toggle_obstacle(int(params.get("x", -1)), int(params.get("y", -1)))
            elif action == "clear_obstacles":
                sim_engine.map.clear_all_obstacles()
                sim_engine.fleet.check_and_reroute_blocked_robots(sim_engine.map, sim_engine.tick_count, sim_engine.elapsed_seconds)
                sim_engine._notify_listeners()
            elif action == "add_robot":
                sim_engine.fleet.add_robot(
                    str(params.get("robot_id", "")),
                    (int(params.get("start_x", 0)), int(params.get("start_y", 0))),
                    (int(params.get("goal_x", 0)), int(params.get("goal_y", 0))),
                    str(params.get("destination_label", "")),
                    float(params.get("battery", 100.0)),
                    str(params.get("task", "Live mission")),
                )
                sim_engine._notify_listeners()
            elif action == "trigger_conflict_demo":
                sim_engine.trigger_conflict_demo()
            elif action == "trigger_deadlock_demo_2robot":
                sim_engine.trigger_deadlock_demo_2robot()
            elif action == "trigger_deadlock_demo_3robot":
                sim_engine.trigger_deadlock_demo_3robot()
            elif action == "resolve_deadlock":
                sim_engine.resolve_deadlock()
            elif action == "trigger_reroute_scenario_a":
                sim_engine.trigger_reroute_scenario_a()
            elif action == "trigger_reroute_scenario_b":
                sim_engine.trigger_reroute_scenario_b()
            elif action == "trigger_reroute_scenario_c":
                sim_engine.trigger_reroute_scenario_c()
            elif action == "trigger_task_scenario_a":
                sim_engine.trigger_task_scenario_a()
            elif action == "trigger_task_scenario_b":
                sim_engine.trigger_task_scenario_b()
            elif action == "trigger_task_scenario_c":
                sim_engine.trigger_task_scenario_c()
            elif action == "trigger_task_scenario_d":
                sim_engine.trigger_task_scenario_d()
            elif action == "trigger_task_scenario_e":
                sim_engine.trigger_task_scenario_e()
            elif action == "trigger_reassign_scenario_a":
                sim_engine.trigger_reassign_scenario_a()
            elif action == "trigger_reassign_scenario_b":
                sim_engine.trigger_reassign_scenario_b()
            elif action == "trigger_reassign_scenario_c":
                sim_engine.trigger_reassign_scenario_c()
            elif action == "trigger_edge_ai_scenario_a":
                sim_engine.trigger_edge_ai_scenario_a()
            elif action == "trigger_edge_ai_scenario_b":
                sim_engine.trigger_edge_ai_scenario_b()
            elif action == "trigger_edge_ai_scenario_c":
                sim_engine.trigger_edge_ai_scenario_c()
            elif action == "set_network_faults":
                _apply_network_fault_params(params)
            elif action == "trigger_network_scenario_a":
                sim_engine.trigger_network_scenario_a()
            elif action == "trigger_network_scenario_b":
                sim_engine.trigger_network_scenario_b()
            elif action == "trigger_network_scenario_c":
                sim_engine.trigger_network_scenario_c()
            elif action == "reset_tasks":
                sim_engine.reset_tasks()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Command receiver stopped: {e}")
    finally:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        websocket_state_queues.pop(websocket, None)
        if sender_task is not None:
            sender_task.cancel()
            try:
                await sender_task
            except asyncio.CancelledError:
                pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=config.host, port=config.port, reload=True)
