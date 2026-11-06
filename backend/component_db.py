"""
3D Holographic Car Laboratory - Component Database & Telemetry Engine
Manages automotive component metadata, spatial bounds, kinematic connections,
and simulated research telemetry.
"""

import json
import math
import os
import random
import time
from typing import Any, Dict, List, Optional


class ComponentDatabase:
    """Manages digital twin component information, engineering specs, and live telemetry."""

    def __init__(self, data_path: Optional[str] = None):
        if data_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_path = os.path.join(base_dir, "data", "components.json")

        self.data_path = data_path
        self.vehicle_meta = {}
        self.components: Dict[str, Dict[str, Any]] = {}
        self.connection_graph: Dict[str, List[str]] = {}
        self.load_data()

    def load_data(self) -> None:
        """Loads component definitions and builds the dependency graph."""
        if os.path.exists(self.data_path):
            with open(self.data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.vehicle_meta = data.get("vehicle", {})
                for comp in data.get("components", []):
                    cid = comp["id"]
                    self.components[cid] = comp
                    self.connection_graph[cid] = comp.get("connected_components", [])
        else:
            self._init_fallback_data()

    def _init_fallback_data(self) -> None:
        """Fallback definition in case components.json is missing."""
        self.vehicle_meta = {
            "model": "3D Holographic Car Hyper-EV Digital Twin",
            "architecture": "800V SiC",
            "total_mass_kg": 1840,
        }
        fallback_comps = [
            {
                "id": "battery",
                "name": "High-Voltage Traction Battery",
                "geometry_type": "box",
                "dimensions": [2.2, 0.25, 1.3],
                "default_position": [0.0, 0.2, 0.0],
                "explosion_vector": [0.0, -2.4, 0.0],
                "mass_kg": 460,
                "material": "Carbon-Aluminium Matrix / NMC Cells",
                "category": "Powertrain",
                "status": "Optimal",
                "system_role": "High-voltage energy storage for dual motor powertrain.",
                "connected_components": ["inverter", "cooling", "chassis"],
                "research_data": {
                    "nominal_voltage_v": 800,
                    "capacity_kwh": 105.4,
                    "operating_temp_c": 32.5,
                    "state_of_charge_pct": 94.2,
                },
            }
        ]
        for comp in fallback_comps:
            self.components[comp["id"]] = comp
            self.connection_graph[comp["id"]] = comp.get("connected_components", [])

    def get_all(self) -> List[Dict[str, Any]]:
        """Returns all component specs."""
        return list(self.components.values())

    def get_by_id(self, component_id: str) -> Optional[Dict[str, Any]]:
        """Finds a component by ID."""
        return self.components.get(component_id)

    def get_connected(self, component_id: str) -> List[Dict[str, Any]]:
        """Returns direct kinematic / electrical connected components."""
        connected_ids = self.connection_graph.get(component_id, [])
        return [self.components[cid] for cid in connected_ids if cid in self.components]

    def get_research_telemetry(self, component_id: str) -> Optional[Dict[str, Any]]:
        """
        Generates simulated high-precision real-time research telemetry
        with dynamic jitter simulating live CAN-FD bus sensor readings.
        """
        comp = self.get_by_id(component_id)
        if not comp:
            return None

        base_research = comp.get("research_data", {}).copy()
        t = time.time()

        # Add dynamic live telemetry harmonics
        dynamic_readings = {
            "timestamp": t,
            "component_id": component_id,
            "system_health": round(98.5 + 1.2 * math.sin(t * 0.4), 2),
            "thermal_flux_w": round(140.0 + 15.0 * math.sin(t * 0.8), 2),
            "vibration_rms_g": round(0.04 + 0.01 * math.cos(t * 1.5), 4),
            "bus_latency_ms": round(0.18 + 0.04 * random.random(), 3),
        }

        # Component specific live dynamics
        if component_id == "battery":
            dynamic_readings["live_voltage_v"] = round(801.2 + 2.5 * math.sin(t * 0.5), 1)
            dynamic_readings["live_current_a"] = round(120.0 + 35.0 * math.sin(t * 0.9), 1)
            dynamic_readings["cell_temp_c"] = round(32.4 + 0.6 * math.sin(t * 0.2), 2)
        elif "motor" in component_id:
            dynamic_readings["live_rpm"] = int(8500 + 1200 * math.sin(t * 0.7))
            dynamic_readings["live_torque_nm"] = round(380 + 40 * math.sin(t * 1.1), 1)
            dynamic_readings["stator_temp_c"] = round(56.2 + 1.2 * math.sin(t * 0.3), 1)
        elif component_id == "inverter":
            dynamic_readings["inverter_efficiency_pct"] = round(99.12 + 0.1 * math.sin(t), 2)
            dynamic_readings["gate_temp_c"] = round(44.5 + 0.8 * math.sin(t * 0.5), 1)

        result = {
            "meta": {
                "name": comp["name"],
                "category": comp["category"],
                "status": comp["status"],
                "material": comp["material"],
                "mass_kg": comp.get("mass_kg", 0),
            },
            "static_specs": base_research,
            "live_telemetry": dynamic_readings,
            "connected_subsystems": [
                {"id": cid, "name": self.components[cid]["name"]}
                for cid in self.connection_graph.get(component_id, [])
                if cid in self.components
            ],
        }
        return result


# Singleton instance
component_db = ComponentDatabase()
