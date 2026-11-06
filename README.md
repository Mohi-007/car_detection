# 3D Holographic Car Engineering Laboratory

A real-time interactive 3D automotive engineering visualization system with hand gesture control. Features a realistic **Ferrari 458 Italia** GLTF model loaded from the Three.js examples library, with holographic HUD overlays and full gesture-driven manipulation.

---

## Features

- **Realistic 3D Car Model** - Ferrari 458 Italia loaded via GLTFLoader with PBR materials
- **Hand Gesture Control** - Pinch, drag, zoom, rotate, explode, and reassemble using MediaPipe Hands
- **Holographic HUD** - 3D holographic scanlines, radar rings, particle fields, and neon wireframe overlays
- **Component Inspection** - Click or pinch-select individual car parts to view engineering telemetry
- **Exploded View** - Gesture or slider-driven kinetic disassembly showing all components separated
- **Research Mode** - Live CAN-FD oscilloscope, thermal flux monitoring, and diagnostic codes
- **Display Modes** - X-Ray, Wireframe, and Thermal visualization modes
- **Audio Feedback** - Procedural Web Audio synthesized sound effects for all interactions
- **WebSocket Backend** - Python FastAPI server with real-time gesture streaming and telemetry push
- **Dual Tracking** - Browser-side MediaPipe fallback + Python backend OpenCV+MediaPipe tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Engine | Three.js r162 (ES Modules) |
| Car Model | Ferrari 458 Italia GLTF (Three.js examples) |
| Hand Tracking | MediaPipe Hands (browser) + OpenCV (Python) |
| Backend | Python 3.10+ / FastAPI / WebSockets |
| Audio | Web Audio API (procedural synthesis) |
| Styling | Custom CSS with Orbitron + Share Tech Mono fonts |

---

## Project Structure

```
CAR_detection/
  backend/
    __init__.py
    server.py              # FastAPI WebSocket server
    gesture_recognizer.py  # Advanced gesture classification engine
    hand_tracker.py        # OpenCV + MediaPipe wrapper
    component_db.py        # Component database + telemetry simulator
  frontend/
    index.html             # Main HTML with ES module import maps
    css/
      hologram.css         # 3D holographic theme
    js/
      app.js               # Main orchestrator (ES module)
      car_model.js         # Ferrari GLTF loader + component decomposition
      holographic_fx.js    # Grid, rings, particles, audio
      gesture_controller.js # WebSocket + mouse + MediaPipe bridge
      research_mode.js     # Component info panel + oscilloscope
  data/
    components.json        # 22 automotive component engineering specs
  tests/
    test_gestures.py       # Gesture recognition unit tests
    test_components.py     # Component database tests
    test_server.py         # FastAPI endpoint tests
  requirements.txt
  package.json
  .env.example
  README.md
```

---

## Quick Start

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Backend Server

```bash
python backend/server.py
```

The server starts on `http://localhost:8000` and serves the frontend statically.

### 3. Open in Browser

Navigate to **http://localhost:8000/static/index.html**

### 4. Choose Input Mode

- **INITIALIZE WITH WEBCAM** - Enables MediaPipe hand tracking via your webcam
- **CONTINUE WITH MOUSE** - Use mouse drag to rotate, scroll to zoom, click to select components

---

## Gesture Controls

| Gesture | Action |
|---------|--------|
| **Pinch** (thumb + index) | Select / highlight a component |
| **Pinch + Move** | Translate selected component through 3D space |
| **Open Hand Move** | Rotate the entire vehicle |
| **Two-Hand Pinch** | Zoom the vehicle in/out |
| **Two Hands Apart** | Explode (disassemble) all components outward |
| **Two Fists Closed** | Snap reassemble the entire vehicle |
| **Fist Hold (1 second)** | Full system reset |

---

## Mouse Controls

| Input | Action |
|-------|--------|
| **Left-click drag** | Rotate the car |
| **Left-click (no drag)** | Select a component |
| **Scroll wheel** | Zoom in/out |

---

## Display Modes

- **X-RAY** - Makes unselected components semi-transparent
- **WIREFRAME** - Shows all geometry as wireframe mesh
- **THERMAL** - Thermal gradient visualization overlay
- **RESEARCH MODE** - Opens CAN-FD oscilloscope and deep diagnostics

---

## Running Tests

```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

---

## Environment Variables

Copy `.env.example` to `.env` and customize:

```
HOST=0.0.0.0
PORT=8000
CAMERA_INDEX=0
LOG_LEVEL=info
```

---

## Architecture

```
Browser (Three.js + MediaPipe)
    |
    |-- WebSocket (/ws/gestures)
    |
Python Backend (FastAPI)
    |-- Hand Tracker (OpenCV + MediaPipe)
    |-- Gesture Recognizer (classification engine)
    |-- Component Database (JSON + telemetry simulator)
    |-- REST API (/api/components, /api/health)
```

The system supports **dual tracking mode**:
1. **Browser-side**: Webcam captured in browser, MediaPipe JS runs locally, landmarks sent to Python via WebSocket for gesture classification
2. **Server-side**: Python captures webcam directly via OpenCV, runs MediaPipe, broadcasts gesture packets

---

## Credits

- Ferrari 458 Italia model by [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) (via Three.js examples)
- Three.js by [mrdoob](https://threejs.org)
- MediaPipe by Google
- Fonts: Orbitron, Share Tech Mono (Google Fonts)
