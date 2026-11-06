"""
Test suite for Vehicle Component Database and Research Telemetry
"""

import os
import sys
import pytest

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from component_db import component_db


def test_components_loaded():
    comps = component_db.get_all()
    assert len(comps) >= 10, "Expected at least 10 modular automotive components"


def test_battery_component_present():
    battery = component_db.get_by_id("battery")
    assert battery is not None
    assert battery["name"] == "High-Voltage Traction Battery Pack"
    assert battery["geometry_type"] == "box"
    assert len(battery["dimensions"]) == 3
    assert len(battery["explosion_vector"]) == 3
    assert "inverter" in battery["connected_components"]


def test_kinematic_connections():
    connected = component_db.get_connected("battery")
    assert len(connected) > 0
    connected_ids = [c["id"] for c in connected]
    assert "inverter" in connected_ids


def test_research_telemetry_generation():
    telemetry = component_db.get_research_telemetry("battery")
    assert telemetry is not None
    assert "meta" in telemetry
    assert "static_specs" in telemetry
    assert "live_telemetry" in telemetry
    assert telemetry["live_telemetry"]["live_voltage_v"] > 700
    assert "thermal_flux_w" in telemetry["live_telemetry"]
    assert "connected_subsystems" in telemetry


def test_unknown_component():
    assert component_db.get_by_id("non_existent_part_99") is None
    assert component_db.get_research_telemetry("non_existent_part_99") is None
