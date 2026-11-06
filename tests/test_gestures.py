"""
Test suite for 3D Holographic Car Gesture Recognition Engine
Validates geometric calculations, landmark metrics, and state-machine transitions.
"""

import os
import sys
import pytest

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from gesture_recognizer import GestureRecognizer, euclidean_dist_2d, euclidean_dist_3d


def make_dummy_landmarks(pinch: bool = False, fist: bool = False):
    """Generates synthetic 21-landmark hand configuration."""
    landmarks = []
    # 0: wrist
    landmarks.append({"x": 0.5, "y": 0.8, "z": 0.0})

    for i in range(1, 21):
        landmarks.append({"x": 0.5, "y": 0.8 - (i * 0.02), "z": 0.0})

    # Landmark 9 is middle MCP (sets palm scale)
    landmarks[9] = {"x": 0.5, "y": 0.5, "z": 0.0}

    if pinch:
        # Thumb tip (4) and index tip (8) very close
        landmarks[4] = {"x": 0.45, "y": 0.35, "z": 0.0}
        landmarks[8] = {"x": 0.46, "y": 0.36, "z": 0.0}
    elif fist:
        # Thumb tip tucked away from index tip
        landmarks[4] = {"x": 0.35, "y": 0.65, "z": 0.0}
        # All fingertips curled close to wrist (y: 0.8)
        # Wrist is at y: 0.8. Tips at 0.72, PIPs at 0.50
        for tip in [8, 12, 16, 20]:
            landmarks[tip] = {"x": 0.5, "y": 0.72, "z": 0.0}
        for pip in [6, 10, 14, 18]:
            landmarks[pip] = {"x": 0.5, "y": 0.50, "z": 0.0}
    else:
        # Open hand: fingertips extended far from wrist
        landmarks[4] = {"x": 0.3, "y": 0.4, "z": 0.0}
        landmarks[8] = {"x": 0.4, "y": 0.2, "z": 0.0}
        landmarks[12] = {"x": 0.5, "y": 0.18, "z": 0.0}
        landmarks[16] = {"x": 0.6, "y": 0.22, "z": 0.0}
        landmarks[20] = {"x": 0.7, "y": 0.28, "z": 0.0}

    return landmarks


def test_euclidean_distance():
    p1 = {"x": 0.0, "y": 0.0}
    p2 = {"x": 3.0, "y": 4.0}
    assert euclidean_dist_2d(p1, p2) == 5.0

    p3d_1 = {"x": 0.0, "y": 0.0, "z": 0.0}
    p3d_2 = {"x": 2.0, "y": 3.0, "z": 6.0}
    assert euclidean_dist_3d(p3d_1, p3d_2) == 7.0


def test_classify_pinch_gesture():
    recognizer = GestureRecognizer()
    landmarks = make_dummy_landmarks(pinch=True)
    gesture, metrics = recognizer.classify_hand(landmarks)
    assert gesture == "PINCH"
    assert metrics["norm_pinch"] < 0.25


def test_classify_fist_gesture():
    recognizer = GestureRecognizer()
    landmarks = make_dummy_landmarks(fist=True)
    gesture, metrics = recognizer.classify_hand(landmarks)
    assert gesture == "FIST"
    assert metrics["curled_fingers"] >= 3


def test_classify_open_hand():
    recognizer = GestureRecognizer()
    landmarks = make_dummy_landmarks(pinch=False, fist=False)
    gesture, metrics = recognizer.classify_hand(landmarks)
    assert gesture == "OPEN"


def test_two_fists_assemble_trigger():
    recognizer = GestureRecognizer(smoothing_frames=1)
    hand1 = make_dummy_landmarks(fist=True)
    hand2 = make_dummy_landmarks(fist=True)

    # Process frame with 2 closed fists
    result = recognizer.process_frame([hand1, hand2])
    assert result["hands_count"] == 2
    assert result["gesture"] == "TWO_FISTS_ASSEMBLE"
    assert result["action"] == "assemble"
    assert result["explosion_target"] == 0.0


def test_two_hands_explode():
    recognizer = GestureRecognizer(smoothing_frames=1)
    hand1 = make_dummy_landmarks()
    hand2 = make_dummy_landmarks()
    # Move hand2 far from hand1 to simulate spreading apart
    for lm in hand2:
        lm["x"] += 0.4

    result = recognizer.process_frame([hand1, hand2])
    assert result["hands_count"] == 2
    assert result["gesture"] == "TWO_HAND_EXPLODE"
    assert result["action"] == "explode"
    assert result["explosion_target"] is not None
    assert result["explosion_target"] > 0.0
