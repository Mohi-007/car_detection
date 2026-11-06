"""
3D Holographic Car Laboratory - Backend Server
FastAPI + WebSocket server providing real-time gesture streaming,
automotive component telemetry, research diagnostics, and static web serving.
"""

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Set

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Ensure backend package can import sibling modules
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from component_db import component_db
from gesture_recognizer import GestureRecognizer
from hand_tracker import HandTracker

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("3D-Holographic-Car")

# Engine instances
hand_tracker = HandTracker(camera_index=0)
gesture_recognizer = GestureRecognizer(smoothing_frames=3, sensitivity=1.0)
backend_camera_task: asyncio.Task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - Camera is not locked automatically so browser getUserMedia has full access
    global backend_camera_task
    backend_camera_task = asyncio.create_task(camera_worker_loop())
    yield
    # Shutdown
    if backend_camera_task:
        backend_camera_task.cancel()
    hand_tracker.stop_camera()


app = FastAPI(
    title="3D Holographic Car Laboratory API",
    version="1.0.0",
    description="Backend engine for 3D Holographic Car gesture tracking, telemetry, and research diagnostics",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    """Manages active WebSocket client connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client connected. Active count: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(
            f"Client disconnected. Active count: {len(self.active_connections)}"
        )

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return
        payload = json.dumps(message)
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.discard(d)


manager = ConnectionManager()
active_research_component: Dict[str, Any] = {"id": None, "active": False}
backend_camera_task: asyncio.Task = None


# ------------------ REST ENDPOINTS ------------------


@app.get("/api/status")
async def get_system_status():
    """Returns overall laboratory status."""
    return {
        "status": "ONLINE",
        "vision_system": "ACTIVE" if hand_tracker.camera_available else "STANDBY",
        "camera_available": hand_tracker.camera_available,
        "active_clients": len(manager.active_connections),
        "tracking_fps": hand_tracker.fps,
        "selected_component": active_research_component.get("id"),
        "research_mode": active_research_component.get("active", False),
    }


@app.get("/api/components")
async def get_all_components():
    """Returns all vehicle component 3D layouts and metadata."""
    return {
        "vehicle": component_db.vehicle_meta,
        "components": component_db.get_all(),
    }


@app.get("/api/components/{component_id}")
async def get_component(component_id: str):
    """Returns technical details for a specific component."""
    comp = component_db.get_by_id(component_id)
    if not comp:
        raise HTTPException(
            status_code=404, detail=f"Component '{component_id}' not found"
        )
    return comp


@app.get("/api/research/{component_id}")
async def get_component_research(component_id: str):
    """Returns high-detail engineering research telemetry for the selected component."""
    data = component_db.get_research_telemetry(component_id)
    if not data:
        raise HTTPException(
            status_code=404, detail=f"Component '{component_id}' not found"
        )
    return data


@app.post("/api/camera/start")
async def start_camera_feed():
    """Starts Python backend camera capture."""
    success = hand_tracker.start_camera()
    return {"success": success, "camera_available": hand_tracker.camera_available}


@app.post("/api/camera/stop")
async def stop_camera_feed():
    """Stops Python backend camera capture."""
    hand_tracker.stop_camera()
    return {"success": True, "camera_available": False}


# ------------------ WEBSOCKET ENDPOINT ------------------


@app.websocket("/ws/gestures")
async def websocket_gestures_endpoint(websocket: WebSocket):
    """
    Bi-directional real-time communication channel:
    - Pushes gesture, cursor, zoom, rotation, explosion events to frontend
    - Receives client commands (selection, sensitivity, research toggle, client landmarks)
    """
    await manager.connect(websocket)
    try:
        # Initial greeting with system configuration
        await websocket.send_text(
            json.dumps(
                {
                    "type": "INIT",
                    "components": component_db.get_all(),
                    "vehicle": component_db.vehicle_meta,
                    "camera_available": hand_tracker.camera_available,
                }
            )
        )

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "SELECT_COMPONENT":
                    cid = msg.get("id")
                    active_research_component["id"] = cid
                    telemetry = (
                        component_db.get_research_telemetry(cid) if cid else None
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "COMPONENT_INFO",
                                "id": cid,
                                "telemetry": telemetry,
                            }
                        )
                    )

                elif msg_type == "TOGGLE_RESEARCH_MODE":
                    active_research_component["active"] = msg.get("active", False)
                    await manager.broadcast(
                        {
                            "type": "RESEARCH_MODE_STATUS",
                            "active": active_research_component["active"],
                        }
                    )

                elif msg_type == "SET_SENSITIVITY":
                    val = float(msg.get("value", 1.0))
                    gesture_recognizer.sensitivity = max(0.1, min(5.0, val))

                elif msg_type == "PROCESS_CLIENT_LANDMARKS":
                    # Browser captures webcam and sends landmarks to Python gesture engine
                    client_lms = msg.get("landmarks", [])
                    gesture_packet = gesture_recognizer.process_frame(client_lms)
                    gesture_packet["type"] = "GESTURE_UPDATE"
                    await websocket.send_text(json.dumps(gesture_packet))

                elif msg_type == "PING":
                    await websocket.send_text(
                        json.dumps({"type": "PONG", "time": msg.get("time")})
                    )

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        manager.disconnect(websocket)


# ------------------ BACKGROUND CAMERA LOOP ------------------


async def camera_worker_loop():
    """Background task processing Python camera frames when active."""
    logger.info("Camera background worker loop initialized.")
    while True:
        try:
            if hand_tracker.is_running and hand_tracker.camera_available:
                lms, conf, meta = hand_tracker.process_frame()
                if lms or meta.get("camera_available"):
                    packet = gesture_recognizer.process_frame(lms)
                    packet["type"] = "GESTURE_UPDATE"
                    packet["meta"] = meta
                    packet["confidence"] = conf
                    await manager.broadcast(packet)

            # Periodic research telemetry push if component selected
            if (
                active_research_component["active"]
                and active_research_component["id"]
                and len(manager.active_connections) > 0
            ):
                cid = active_research_component["id"]
                telemetry = component_db.get_research_telemetry(cid)
                if telemetry:
                    await manager.broadcast(
                        {"type": "RESEARCH_TELEMETRY", "id": cid, "data": telemetry}
                    )

            await asyncio.sleep(0.033)  # ~30 FPS loop
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in camera loop: {e}")
            await asyncio.sleep(0.1)





# ------------------ STATIC FRONTEND MOUNTING ------------------

frontend_dir = os.path.join(parent_dir, "frontend")
data_dir = os.path.join(parent_dir, "data")

# Mount data directory for /data/components.json access
if os.path.isdir(data_dir):
    app.mount("/data", StaticFiles(directory=data_dir), name="data")

# Mount frontend at /static as backup
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# Mount frontend assets at root so relative paths (css/, js/, models/, draco/) resolve correctly
if os.path.isdir(frontend_dir):
    css_dir = os.path.join(frontend_dir, "css")
    js_dir = os.path.join(frontend_dir, "js")
    models_dir = os.path.join(frontend_dir, "models")
    draco_dir = os.path.join(frontend_dir, "draco")
    mediapipe_dir = os.path.join(frontend_dir, "mediapipe")

    if os.path.isdir(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.isdir(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    if os.path.isdir(models_dir):
        app.mount("/models", StaticFiles(directory=models_dir), name="models")
    if os.path.isdir(draco_dir):
        app.mount("/draco", StaticFiles(directory=draco_dir), name="draco")
    if os.path.isdir(mediapipe_dir):
        app.mount("/mediapipe", StaticFiles(directory=mediapipe_dir), name="mediapipe")


@app.get("/")
async def root_index():
    """Serves the main 3D Holographic Car Explorer UI."""
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return JSONResponse({"status": "3D Holographic Car Backend Online"})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"=== Starting 3D Holographic Car Laboratory on http://localhost:{port} ===")
    uvicorn.run("server:app", host=host, port=port, reload=False)
