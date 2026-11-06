"""
3D Holographic Car Laboratory - Advanced Gesture Recognition Engine
Processes MediaPipe 21 3D hand landmarks, computes geometric metrics, applies
exponential smoothing and state-machine hysteresis for tactile 3D manipulation.
"""

import math
import time
from typing import Any, Dict, List, Optional, Tuple


def euclidean_dist_2d(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """Calculates 2D Euclidean distance."""
    return math.hypot(p1["x"] - p2["x"], p1["y"] - p2["y"])


def euclidean_dist_3d(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """Calculates 3D Euclidean distance."""
    return math.sqrt(
        (p1["x"] - p2["x"]) ** 2
        + (p1["y"] - p2["y"]) ** 2
        + (p1.get("z", 0.0) - p2.get("z", 0.0)) ** 2
    )


class SingleHandState:
    """Tracks state and kinematic trajectory for an individual hand."""

    def __init__(self, hand_id: int):
        self.hand_id = hand_id
        self.current_gesture = "NONE"
        self.candidate_gesture = "NONE"
        self.candidate_count = 0
        self.smoothed_center = {"x": 0.5, "y": 0.5, "z": 0.0}
        self.prev_center: Optional[Dict[str, float]] = None
        self.is_pinching = False
        self.pinch_center = {"x": 0.5, "y": 0.5, "z": 0.0}
        self.prev_pinch_center: Optional[Dict[str, float]] = None
        self.fist_hold_start: Optional[float] = None
        self.last_update_time = time.time()

    def update_center(self, center: Dict[str, float], alpha: float = 0.5) -> None:
        """Applies exponential moving average to hand center."""
        if self.prev_center is None:
            self.smoothed_center = {
                "x": center["x"],
                "y": center["y"],
                "z": center.get("z", 0.0),
            }
            self.prev_center = dict(self.smoothed_center)
            return
        self.smoothed_center["x"] += (center["x"] - self.smoothed_center["x"]) * alpha
        self.smoothed_center["y"] += (center["y"] - self.smoothed_center["y"]) * alpha
        self.smoothed_center["z"] += (
            center.get("z", 0.0) - self.smoothed_center["z"]
        ) * alpha
        self.prev_center = dict(self.smoothed_center)

    def stabilize_gesture(self, gesture: str, required_frames: int = 3) -> str:
        """Stabilizes gesture classification across frames using hysteresis."""
        if gesture == self.candidate_gesture:
            self.candidate_count += 1
        else:
            self.candidate_gesture = gesture
            self.candidate_count = 1

        if self.candidate_count >= required_frames and self.current_gesture != gesture:
            self.current_gesture = gesture
            self.prev_center = None
            self.prev_pinch_center = None

        return self.current_gesture


class GestureRecognizer:
    """
    Recognizes automotive engineering laboratory gestures:
    - PINCH: Component selection / focal grabbing
    - PINCH_DRAG: Free 3D spatial translation of selected component
    - OPEN_HAND_ROTATE: Orbit vehicle rotation
    - TWO_HAND_ZOOM: Dynamic camera focal zoom
    - TWO_HAND_EXPLODE: Kinetic outward explosion disassembly
    - TWO_FISTS_ASSEMBLE: Magnetic snap vehicle assembly
    - FIST_RESET: System calibration & view reset
    """

    def __init__(self, smoothing_frames: int = 3, sensitivity: float = 1.0):
        self.smoothing_frames = smoothing_frames
        self.sensitivity = sensitivity
        self.hands_state: List[SingleHandState] = [
            SingleHandState(0),
            SingleHandState(1),
        ]
        self.two_hand_zoom_baseline: Optional[Dict[str, float]] = None
        self.two_hand_explode_baseline: Optional[float] = None
        self.system_reset_triggered = False

    def classify_hand(self, landmarks: List[Dict[str, float]]) -> Tuple[str, Dict[str, Any]]:
        """
        Classifies single hand into OPEN, PINCH, FIST, POINT.
        Landmark indices:
        0: Wrist
        4: Thumb tip, 3: Thumb IP, 2: Thumb MCP
        8: Index tip, 7: Index DIP, 6: Index PIP, 5: Index MCP
        12: Middle tip, 10: Middle PIP, 9: Middle MCP
        16: Ring tip, 14: Ring PIP, 13: Ring MCP
        20: Pinky tip, 18: Pinky PIP, 17: Pinky MCP
        """
        if len(landmarks) < 21:
            return "NONE", {}

        wrist = landmarks[0]
        middle_mcp = landmarks[9]
        palm_scale = euclidean_dist_2d(wrist, middle_mcp) or 1.0

        # Pinch metric: Thumb tip (4) to Index tip (8)
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        pinch_dist = euclidean_dist_2d(thumb_tip, index_tip)
        norm_pinch = pinch_dist / palm_scale

        # Finger curl detection (Fist)
        curled_fingers = 0
        finger_pairs = [(8, 6), (12, 10), (16, 14), (20, 18)]
        for tip_idx, pip_idx in finger_pairs:
            dist_tip = euclidean_dist_2d(landmarks[tip_idx], wrist)
            dist_pip = euclidean_dist_2d(landmarks[pip_idx], wrist)
            if dist_tip < dist_pip * 1.05:
                curled_fingers += 1

        # Pinch center
        pinch_center = {
            "x": (thumb_tip["x"] + index_tip["x"]) / 2.0,
            "y": (thumb_tip["y"] + index_tip["y"]) / 2.0,
            "z": (thumb_tip.get("z", 0.0) + index_tip.get("z", 0.0)) / 2.0,
        }

        # Classification rules
        gesture = "OPEN"
        if curled_fingers == 4 or (curled_fingers >= 3 and norm_pinch >= 0.25):
            gesture = "FIST"
        elif norm_pinch < 0.25:
            gesture = "PINCH"
        elif curled_fingers >= 3:
            gesture = "FIST"
        elif curled_fingers == 2 and norm_pinch > 0.4:
            gesture = "POINT"

        metrics = {
            "norm_pinch": round(norm_pinch, 3),
            "curled_fingers": curled_fingers,
            "pinch_center": pinch_center,
            "palm_scale": round(palm_scale, 3),
        }
        return gesture, metrics

    def process_frame(
        self, hands_landmarks: List[List[Dict[str, float]]]
    ) -> Dict[str, Any]:
        """
        Main gesture processing pipeline. Returns unified interaction payload
        ready for Three.js engine consumption.
        """
        num_hands = min(len(hands_landmarks), 2)
        now = time.time()

        result = {
            "timestamp": now,
            "hands_count": num_hands,
            "gesture": "NONE",
            "action": None,
            "cursor": {"x": 0.5, "y": 0.5},
            "delta_rotation": {"dx": 0.0, "dy": 0.0},
            "delta_translation": {"dx": 0.0, "dy": 0.0, "dz": 0.0},
            "zoom_factor": 1.0,
            "explosion_delta": 0.0,
            "explosion_target": None,
            "reset_view": False,
            "raw_gestures": [],
            "status_text": "SYSTEM READY",
        }

        if num_hands == 0:
            for s in self.hands_state:
                s.current_gesture = "NONE"
                s.candidate_count = 0
                s.prev_center = None
                s.prev_pinch_center = None
                s.fist_hold_start = None
            self.two_hand_zoom_baseline = None
            self.two_hand_explode_baseline = None
            result["status_text"] = "NO HAND DETECTED"
            return result

        # Sort hands horizontally (left to right in camera space)
        hands_data = []
        for i in range(num_hands):
            lms = hands_landmarks[i]
            # Center of palm: MCP of middle finger (landmark 9)
            center = {
                "x": 1.0 - lms[9]["x"],  # Mirror for natural user interaction
                "y": lms[9]["y"],
                "z": lms[9].get("z", 0.0),
            }
            hands_data.append((lms, center))

        hands_data.sort(key=lambda item: item[1]["x"])

        classified_gestures = []
        for i in range(num_hands):
            lms, center = hands_data[i]
            state = self.hands_state[i]
            state.update_center(center)

            raw_gesture, metrics = self.classify_hand(lms)
            stable_gesture = state.stabilize_gesture(
                raw_gesture, required_frames=self.smoothing_frames
            )
            state.pinch_center = {
                "x": 1.0 - metrics["pinch_center"]["x"],
                "y": metrics["pinch_center"]["y"],
                "z": metrics["pinch_center"]["z"],
            }
            classified_gestures.append(
                {
                    "hand_id": i,
                    "gesture": stable_gesture,
                    "center": state.smoothed_center,
                    "pinch_center": state.pinch_center,
                    "metrics": metrics,
                }
            )

        result["raw_gestures"] = [cg["gesture"] for cg in classified_gestures]

        # ------------------- TWO HAND INTERACTIONS -------------------
        if num_hands == 2:
            h0, h1 = classified_gestures[0], classified_gestures[1]
            g0, g1 = h0["gesture"], h1["gesture"]
            dist_hands = euclidean_dist_2d(h0["center"], h1["center"])
            mid_cursor = {
                "x": (h0["center"]["x"] + h1["center"]["x"]) / 2.0,
                "y": (h0["center"]["y"] + h1["center"]["y"]) / 2.0,
            }
            result["cursor"] = mid_cursor

            # Two Fists -> Magnetic Assemble (Vehicles returns to whole)
            if g0 == "FIST" and g1 == "FIST":
                result["gesture"] = "TWO_FISTS_ASSEMBLE"
                result["action"] = "assemble"
                result["explosion_target"] = 0.0
                result["status_text"] = "TWO FISTS DETECTED: ASSEMBLE VEHICLE"
                self.two_hand_zoom_baseline = None

            # Two Pinches -> Two Hand Zoom
            elif g0 == "PINCH" and g1 == "PINCH":
                result["gesture"] = "TWO_HAND_ZOOM"
                result["action"] = "zoom"
                pinch_dist = euclidean_dist_2d(h0["pinch_center"], h1["pinch_center"])

                if self.two_hand_zoom_baseline is None:
                    self.two_hand_zoom_baseline = {"dist": pinch_dist, "zoom": 1.0}
                    result["zoom_factor"] = 1.0
                else:
                    ratio = (
                        pinch_dist / self.two_hand_zoom_baseline["dist"]
                        if self.two_hand_zoom_baseline["dist"] > 0
                        else 1.0
                    )
                    # Sensitivity curve
                    zoom_delta = (ratio - 1.0) * self.sensitivity * 1.5
                    result["zoom_factor"] = max(0.4, min(3.0, 1.0 + zoom_delta))

                result["status_text"] = "TWO-HAND PINCH: ZOOMING VEHICLE"

            # Two Open Hands -> Outward Explosion Disassembly
            elif g0 == "OPEN" and g1 == "OPEN":
                result["gesture"] = "TWO_HAND_EXPLODE"
                result["action"] = "explode"
                # Target explosion level mapped from hands spread distance
                # min distance ~0.2, max spread ~0.8
                norm_spread = max(0.0, min(1.0, (dist_hands - 0.2) / 0.5))
                result["explosion_target"] = round(norm_spread, 3)
                result["status_text"] = f"TWO OPEN HANDS: EXPLODE ({int(norm_spread * 100)}%)"
                self.two_hand_zoom_baseline = None

            else:
                self.two_hand_zoom_baseline = None
                result["status_text"] = f"TWO HANDS DETECTED: {g0} + {g1}"

        # ------------------- SINGLE HAND INTERACTIONS -------------------
        elif num_hands == 1:
            h = classified_gestures[0]
            g = h["gesture"]
            state = self.hands_state[0]
            result["cursor"] = {"x": h["center"]["x"], "y": h["center"]["y"]}
            self.two_hand_zoom_baseline = None

            # 1. Pinch -> Select component or Drag component
            if g == "PINCH":
                result["cursor"] = {
                    "x": h["pinch_center"]["x"],
                    "y": h["pinch_center"]["y"],
                }
                if state.prev_pinch_center is not None:
                    pdx = (
                        (h["pinch_center"]["x"] - state.prev_pinch_center["x"])
                        * 8.0
                        * self.sensitivity
                    )
                    pdy = (
                        (h["pinch_center"]["y"] - state.prev_pinch_center["y"])
                        * 8.0
                        * self.sensitivity
                    )
                    result["gesture"] = "PINCH_DRAG"
                    result["action"] = "drag_component"
                    result["delta_translation"] = {"dx": pdx, "dy": -pdy, "dz": 0.0}
                    result["status_text"] = "PINCH + MOVE: MANIPULATING COMPONENT"
                else:
                    result["gesture"] = "PINCH"
                    result["action"] = "select_component"
                    result["status_text"] = "PINCH: COMPONENT TARGETED"

                state.prev_pinch_center = dict(h["pinch_center"])
                state.prev_center = None
                state.fist_hold_start = None

            # 2. Open Hand -> Rotate Vehicle
            elif g == "OPEN":
                if state.prev_center is not None:
                    rdx = (
                        (h["center"]["x"] - state.prev_center["x"])
                        * 5.0
                        * self.sensitivity
                    )
                    rdy = (
                        (h["center"]["y"] - state.prev_center["y"])
                        * 4.0
                        * self.sensitivity
                    )
                    result["gesture"] = "OPEN_HAND_ROTATE"
                    result["action"] = "rotate_vehicle"
                    result["delta_rotation"] = {"dx": rdy, "dy": rdx}
                    result["status_text"] = "OPEN HAND: ROTATING VEHICLE"
                else:
                    result["gesture"] = "OPEN"
                    result["status_text"] = "OPEN HAND DETECTED"

                state.prev_center = dict(h["center"])
                state.prev_pinch_center = None
                state.fist_hold_start = None

            # 3. Fist -> Hold to Reset
            elif g == "FIST":
                if state.fist_hold_start is None:
                    state.fist_hold_start = now

                duration = now - state.fist_hold_start
                result["gesture"] = "FIST"
                result["status_text"] = f"CLOSED FIST (HOLD TO RESET: {min(1.0, duration):.1f}s)"

                if duration >= 1.0:
                    result["action"] = "reset_all"
                    result["reset_view"] = True
                    result["explosion_target"] = 0.0
                    result["status_text"] = "RESET TRIGGERED: RETURNING ALL COMPONENTS"
                    state.fist_hold_start = now  # restart countdown
                state.prev_center = None
                state.prev_pinch_center = None

            else:
                state.prev_center = None
                state.prev_pinch_center = None
                state.fist_hold_start = None
                result["status_text"] = f"SINGLE HAND: {g}"

        return result
