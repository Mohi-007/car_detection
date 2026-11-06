"""
3D Holographic Car Laboratory - Hand Tracking Module
Captures webcam video, extracts 21 3D hand landmarks using Google MediaPipe Hands,
and prepares normalized coordinate streams for the gesture recognition engine.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("HandTracker")

# Guard against missing modules during startup
try:
    import cv2
    import mediapipe as mp
    import numpy as np

    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False
    cv2 = None
    mp = None
    np = None


class HandTracker:
    """Manages OpenCV webcam capture and MediaPipe Hands landmark processing."""

    def __init__(
        self,
        camera_index: int = 0,
        max_num_hands: int = 2,
        min_detection_confidence: float = 0.6,
        min_tracking_confidence: float = 0.6,
        width: int = 640,
        height: int = 480,
    ):
        self.camera_index = camera_index
        self.max_num_hands = max_num_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.width = width
        self.height = height

        self.cap: Optional[Any] = None
        self.mp_hands: Optional[Any] = None
        self.hands: Optional[Any] = None
        self.is_running = False
        self.camera_available = False

        self.frame_count = 0
        self.fps = 0.0
        self.last_fps_time = time.time()
        self.last_annotated_frame_bytes: Optional[bytes] = None

        if HAS_DEPS:
            self._init_mediapipe()

    def _init_mediapipe(self) -> None:
        """Initializes MediaPipe Hands pipeline."""
        try:
            self.mp_hands = mp.solutions.hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=self.max_num_hands,
                min_detection_confidence=self.min_detection_confidence,
                min_tracking_confidence=self.min_tracking_confidence,
                model_complexity=1,
            )
            logger.info("MediaPipe Hands pipeline initialized.")
        except Exception as e:
            logger.error(f"Error initializing MediaPipe Hands: {e}")
            self.hands = None

    def start_camera(self) -> bool:
        """Attempts to open OpenCV camera capture."""
        if not HAS_DEPS:
            logger.warning("cv2/mediapipe not installed. Camera running in virtual mode.")
            self.camera_available = False
            return False

        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

            if self.cap.isOpened():
                ret, test_frame = self.cap.read()
                if ret and test_frame is not None:
                    self.camera_available = True
                    self.is_running = True
                    logger.info(f"Webcam {self.camera_index} opened successfully.")
                    return True

            logger.warning(
                f"Webcam index {self.camera_index} not accessible. Using virtual/browser fallback mode."
            )
            if self.cap:
                self.cap.release()
            self.camera_available = False
            return False
        except Exception as e:
            logger.error(f"Failed to start camera: {e}")
            self.camera_available = False
            return False

    def stop_camera(self) -> None:
        """Stops camera and releases resources."""
        self.is_running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.camera_available = False
        logger.info("Webcam stopped.")

    def process_frame(
        self, frame: Optional[Any] = None
    ) -> Tuple[List[List[Dict[str, float]]], float, Dict[str, Any]]:
        """
        Reads one frame from webcam (or uses passed image), runs MediaPipe detection,
        and returns list of normalized 3D landmarks for each detected hand.
        """
        if not HAS_DEPS or self.hands is None:
            return [], 0.0, {"error": "MediaPipe dependencies not ready"}

        if frame is None and self.cap is not None and self.camera_available:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                return [], 0.0, {"error": "Camera frame read failed"}

        if frame is None:
            return [], 0.0, {"status": "No active frame"}

        # Calculate FPS
        self.frame_count += 1
        now = time.time()
        elapsed = now - self.last_fps_time
        if elapsed >= 0.5:
            self.fps = round(self.frame_count / elapsed, 1)
            self.frame_count = 0
            self.last_fps_time = now

        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.hands.process(rgb_frame)

        hands_landmarks: List[List[Dict[str, float]]] = []
        confidence_scores: List[float] = []

        if results.multi_hand_landmarks:
            for lms in results.multi_hand_landmarks:
                pts = []
                for p in lms.landmark:
                    pts.append(
                        {
                            "x": round(float(p.x), 4),
                            "y": round(float(p.y), 4),
                            "z": round(float(p.z), 4),
                        }
                    )
                hands_landmarks.append(pts)

            if results.multi_handedness:
                for h in results.multi_handedness:
                    for classification in h.classification:
                        confidence_scores.append(float(classification.score))

        avg_confidence = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores
            else 0.0
        )

        meta = {
            "fps": self.fps,
            "hands_detected": len(hands_landmarks),
            "avg_confidence": round(avg_confidence, 2),
            "camera_available": self.camera_available,
        }

        return hands_landmarks, avg_confidence, meta

    def get_latest_jpeg(self) -> Optional[bytes]:
        """Returns the latest annotated video frame encoded as JPEG for streaming."""
        return self.last_annotated_frame_bytes
