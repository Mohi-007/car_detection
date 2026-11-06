"""
Test suite for FastAPI and WebSocket Backend Endpoints
"""

import asyncio
import os
import sys
import pytest

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from server import (
    get_system_status,
    get_all_components,
    get_component,
    get_component_research,
    start_camera_feed,
    stop_camera_feed,
    component_db,
    gesture_recognizer,
)


def test_get_system_status():
    status = asyncio.run(get_system_status())
    assert status["status"] == "ONLINE"
    assert "vision_system" in status
    assert "active_clients" in status


def test_get_all_components():
    res = asyncio.run(get_all_components())
    assert "components" in res
    assert "vehicle" in res
    assert len(res["components"]) >= 10


def test_get_single_component():
    comp = asyncio.run(get_component("battery"))
    assert comp["id"] == "battery"
    assert "High-Voltage" in comp["name"]


def test_get_component_research():
    research = asyncio.run(get_component_research("battery"))
    assert "static_specs" in research
    assert "live_telemetry" in research
    assert research["meta"]["name"] == "High-Voltage Traction Battery Pack"


def test_component_not_found():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_component("unknown_nonexistent_part"))
    assert exc_info.value.status_code == 404


def test_camera_toggle():
    res_start = asyncio.run(start_camera_feed())
    assert "success" in res_start
    res_stop = asyncio.run(stop_camera_feed())
    assert res_stop["success"] is True
    assert res_stop["camera_available"] is False


def test_gesture_pipeline_processing():
    # Verify landmark processing pipeline integration with smoothing frames
    from test_gestures import make_dummy_landmarks
    hand1 = make_dummy_landmarks(pinch=True)
    # Feed frames to satisfy smoothing threshold
    for _ in range(gesture_recognizer.smoothing_frames):
        packet = gesture_recognizer.process_frame([hand1])
    assert packet["gesture"] in ["PINCH", "PINCH_DRAG"]
    assert "cursor" in packet
