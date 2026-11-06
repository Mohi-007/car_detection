/**
 * 3D Holographic Car Laboratory - Gesture Controller & Dual Tracking Engine
 * Manages WebSocket communication with Python backend, local MediaPipe Hands tracking,
 * real-time holographic canvas rendering, and bridges tactile gestures directly to Three.js 3D space.
 */

// Standard MediaPipe Hand Connections (21 landmarks)
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base & Knuckles
  [5, 9], [9, 13], [13, 17]
];

function dist2D(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export class GestureController {
  constructor(carModel, holographicFX, camera) {
    this.carModel = carModel;
    this.holographicFX = holographicFX;
    this.camera = camera;

    this.ws = null;
    this.isWsConnected = false;
    this.wsReconnectTimer = null;

    // Local browser MediaPipe Hands tracking
    this.localHands = null;
    this.localVideoStream = null;
    this.isLocalCameraActive = false;
    this.isProcessingFrame = false;
    this.lastFrameTime = performance.now();
    this.fpsCount = 0;
    this.currentFps = 0;

    // Cursor reticle
    this.cursorEl = document.getElementById('pinch-cursor');
    this.resetRingEl = document.getElementById('reset-ring');

    // Gesture HUD elements
    this.hudGesture = document.getElementById('hud-gesture');
    this.hudConfidence = document.getElementById('hud-confidence');
    this.hudFps = document.getElementById('hud-fps');
    this.hudZoom = document.getElementById('hud-zoom');
    this.hudExplode = document.getElementById('hud-explode');
    this.hudRotation = document.getElementById('hud-rot');
    this.hudVisionStatus = document.getElementById('vision-status-badge');
    this.hudWsStatus = document.getElementById('ws-status-badge');

    // Tracking state
    this.sensitivity = 1.0;
    this.prevHandCenter = null;
    this.prevPinchCenter = null;
    this.wasPinching = false;
    this.fistStartTime = null;
    this.twoHandZoomBaseDist = null;
    this.twoHandZoomBaseLevel = 1.0;

    this._initWebSocket();
    this._initMouseControls();
    this._bindControls();
  }

  _initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws/gestures`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[GestureController] Connected to Python Backend WebSocket.');
        this.isWsConnected = true;
        if (this.hudWsStatus) {
          this.hudWsStatus.innerHTML = '<span class="status-dot"></span> PYTHON WS: CONNECTED';
          this.hudWsStatus.className = 'metric-badge';
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = jsonParseSafe(event.data);
          if (packet) this.handleBackendPacket(packet);
        } catch (e) {
          console.error('[GestureController] Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isWsConnected = false;
        if (this.hudWsStatus) {
          this.hudWsStatus.innerHTML = '<span class="status-dot warn"></span> PYTHON WS: STANDBY (CLIENT TRACKING ACTIVE)';
          this.hudWsStatus.className = 'metric-badge warn';
        }
        clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => this._initWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        this.isWsConnected = false;
      };
    } catch (e) {
      console.warn('[GestureController] WebSocket initialization error:', e);
    }
  }

  handleBackendPacket(packet) {
    if (packet.type === 'INIT') {
      console.log('[GestureController] Received system initialization from backend.');
      if (packet.components && packet.components.length > 0) {
        this.carModel.buildModel(packet.components);
      }
      return;
    }

    if (packet.type === 'GESTURE_UPDATE') {
      // Only process backend gestures if client camera is not driving directly
      if (!this.isLocalCameraActive) {
        const g = packet.gesture || 'NONE';
        const action = packet.action;

        if (this.hudGesture) this.hudGesture.textContent = packet.status_text || g;
        if (this.hudConfidence) this.hudConfidence.textContent = Math.round((packet.confidence || 0.95) * 100) + '%';

        if (packet.cursor && packet.hands_count > 0) {
          this._updateCursor(packet.cursor.x, packet.cursor.y, g === 'PINCH' || g === 'PINCH_DRAG');
        } else {
          if (this.cursorEl) this.cursorEl.style.display = 'none';
        }

        // 1. PINCH: Select component
        if (g === 'PINCH' && packet.cursor) {
          const pickedId = this.carModel.pickComponent(packet.cursor.x, packet.cursor.y, this.camera);
          if (pickedId && pickedId !== this.carModel.selectedId) {
            this.carModel.selectComponent(pickedId);
            this.holographicFX.playSelectSound();
            this._notifyComponentSelection(pickedId);
          }
        }

        // 2. PINCH_DRAG: Translate selected component
        if (g === 'PINCH_DRAG' && packet.delta_translation) {
          const dt = packet.delta_translation;
          this.carModel.translateSelected(dt.dx * 0.5, dt.dy * 0.5, dt.dz * 0.5, this.camera);
          this.holographicFX.playDragHum();
        }

        // 3. OPEN_HAND_ROTATE: Orbit car rotation
        if (g === 'OPEN_HAND_ROTATE' && packet.delta_rotation) {
          const dr = packet.delta_rotation;
          this.carModel.targetRotation.y += dr.dy * 0.35;
          this.carModel.targetRotation.x = Math.max(-1.2, Math.min(1.2, this.carModel.targetRotation.x + dr.dx * 0.25));
        }

        // 4. TWO_HAND_ZOOM: Scale vehicle zoom
        if (g === 'TWO_HAND_ZOOM' && packet.zoom_factor) {
          this.carModel.targetZoomLevel = Math.max(0.4, Math.min(2.8, packet.zoom_factor));
        }

        // 5. TWO_HAND_EXPLODE: Outward disassembly
        if (g === 'TWO_HAND_EXPLODE' && packet.explosion_target !== null) {
          this.carModel.targetExplosionLevel = packet.explosion_target;
          const slider = document.getElementById('slider-explode');
          if (slider) slider.value = Math.round(packet.explosion_target * 100);
        }

        // 6. TWO_FISTS_ASSEMBLE: Smooth reassembly
        if (g === 'TWO_FISTS_ASSEMBLE' || action === 'assemble') {
          this.carModel.smoothReassemble();
          this.holographicFX.playAssembleSound();
          const slider = document.getElementById('slider-explode');
          if (slider) slider.value = 0;
        }

        // 7. FIST_RESET: System reset
        if (packet.reset_view) {
          this.carModel.resetAll();
          this.holographicFX.playResetSound();
        }
      }
    }
  }

  _notifyComponentSelection(componentId) {
    if (this.ws && this.isWsConnected) {
      this.ws.send(JSON.stringify({
        type: 'SELECT_COMPONENT',
        id: componentId
      }));
    }
  }

  _updateCursor(normX, normY, isPinching) {
    if (!this.cursorEl) return;
    this.cursorEl.style.display = 'block';
    this.cursorEl.style.left = `${normX * 100}vw`;
    this.cursorEl.style.top = `${normY * 100}vh`;

    if (isPinching) {
      this.cursorEl.classList.add('active', 'grabbing');
    } else {
      this.cursorEl.classList.remove('active', 'grabbing');
    }
  }

  _bindControls() {
    const explodeSlider = document.getElementById('slider-explode');
    if (explodeSlider) {
      explodeSlider.addEventListener('input', (e) => {
        this.carModel.targetExplosionLevel = parseFloat(e.target.value) / 100;
      });
    }

    const sensSlider = document.getElementById('slider-sens');
    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        this.sensitivity = parseFloat(e.target.value) / 10;
        if (this.ws && this.isWsConnected) {
          this.ws.send(JSON.stringify({
            type: 'SET_SENSITIVITY',
            value: this.sensitivity
          }));
        }
      });
    }

    const assembleBtn = document.getElementById('btn-assemble');
    if (assembleBtn) {
      assembleBtn.addEventListener('click', () => {
        this.carModel.smoothReassemble();
        this.holographicFX.playAssembleSound();
        if (explodeSlider) explodeSlider.value = 0;
      });
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.carModel.resetAll();
        this.holographicFX.playResetSound();
        if (explodeSlider) explodeSlider.value = 0;
      });
    }

    const autoRotateBtn = document.getElementById('btn-autorotate');
    if (autoRotateBtn) {
      autoRotateBtn.addEventListener('click', () => {
        this.carModel.autoRotate = !this.carModel.autoRotate;
        autoRotateBtn.classList.toggle('active', this.carModel.autoRotate);
      });
    }

    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        this.holographicFX.audioEnabled = !this.holographicFX.audioEnabled;
        audioBtn.classList.toggle('active', this.holographicFX.audioEnabled);
        audioBtn.textContent = this.holographicFX.audioEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
      });
    }

    const toggleCamBtn = document.getElementById('btn-toggle-cam');
    if (toggleCamBtn) {
      toggleCamBtn.addEventListener('click', async () => {
        if (this.isLocalCameraActive) {
          this.stopLocalCamera();
        } else {
          await this.startLocalCamera();
        }
      });
    }
  }

  async startLocalCamera() {
    try {
      const video = document.getElementById('cam-video');
      if (!video) return false;

      // Request webcam with fallback resolutions
      try {
        this.localVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }
        });
      } catch (e1) {
        // Fallback to basic constraint
        this.localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      video.srcObject = this.localVideoStream;
      await video.play();

      // Ensure video metadata is ready
      if (!video.videoWidth) {
        await new Promise((resolve) => {
          video.onloadedmetadata = () => resolve();
          setTimeout(resolve, 800);
        });
      }

      if (window.Hands) {
        // Use local mediapipe files with CDN fallback
        this.localHands = new window.Hands({
          locateFile: (file) => `/mediapipe/${file}`
        });

        this.localHands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });

        this.localHands.onResults((results) => this._onLocalHandsResult(results));

        this.isLocalCameraActive = true;
        if (this.hudVisionStatus) {
          this.hudVisionStatus.innerHTML = '<span class="status-dot"></span> VISION: ACTIVE';
          this.hudVisionStatus.className = 'metric-badge';
        }

        const self = this;
        async function renderLoop() {
          if (self.isLocalCameraActive && video.readyState >= 2 && !self.isProcessingFrame) {
            self.isProcessingFrame = true;
            try {
              await self.localHands.send({ image: video });
            } catch (err) {
              console.warn('[GestureController] MediaPipe send frame error:', err);
            } finally {
              self.isProcessingFrame = false;
            }
          }
          if (self.isLocalCameraActive) requestAnimationFrame(renderLoop);
        }
        requestAnimationFrame(renderLoop);
        console.log('[GestureController] Local webcam and MediaPipe Hands tracking initialized successfully.');
        return true;
      } else {
        console.error('[GestureController] window.Hands not available.');
        return false;
      }
    } catch (err) {
      console.warn('[GestureController] Webcam access denied or unavailable:', err);
      if (this.hudVisionStatus) {
        this.hudVisionStatus.innerHTML = '<span class="status-dot warn"></span> VISION: PERMISSION DENIED';
        this.hudVisionStatus.className = 'metric-badge warn';
      }
      return false;
    }
  }

  stopLocalCamera() {
    this.isLocalCameraActive = false;
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach(t => t.stop());
      this.localVideoStream = null;
    }
    const canvas = document.getElementById('cam-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (this.cursorEl) {
      this.cursorEl.style.display = 'none';
    }
    if (this.hudVisionStatus) {
      this.hudVisionStatus.innerHTML = '<span class="status-dot warn"></span> VISION: STANDBY';
      this.hudVisionStatus.className = 'metric-badge warn';
    }
  }

  /**
   * Processes hand tracking results with 0ms latency client-side gesture recognition
   * and draws vivid holographic neon skeleton HUD overlay on webcam canvas.
   */
  _onLocalHandsResult(results) {
    const canvas = document.getElementById('cam-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const lmsList = results.multiHandLandmarks || [];
    const numHands = lmsList.length;

    // Draw HUD top status bar on camera canvas
    ctx.fillStyle = 'rgba(2, 10, 20, 0.7)';
    ctx.fillRect(0, 0, cw, 22);
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = numHands > 0 ? '#00f0ff' : '#608090';
    ctx.fillText(`TRACKING: ${numHands} HAND${numHands === 1 ? '' : 'S'} | FPS: ${this.currentFps}`, 6, 15);

    if (numHands === 0) {
      this.prevHandCenter = null;
      this.prevPinchCenter = null;
      this.wasPinching = false;
      this.fistStartTime = null;
      this.twoHandZoomBaseDist = null;
      if (this.cursorEl) this.cursorEl.style.display = 'none';
      if (this.hudGesture) this.hudGesture.textContent = 'AWAITING HAND GESTURE';
      if (this.hudConfidence) this.hudConfidence.textContent = '0%';
      return;
    }

    if (this.hudConfidence) this.hudConfidence.textContent = '96%';

    // Analyze each hand
    const analyzedHands = [];

    lmsList.forEach((lms, handIdx) => {
      const wrist = lms[0];
      const middleMcp = lms[9];
      const thumbTip = lms[4];
      const indexTip = lms[8];
      const middleTip = lms[12];
      const ringTip = lms[16];
      const pinkyTip = lms[20];

      const palmScale = dist2D(wrist, middleMcp) || 0.1;
      const pinchDist = dist2D(thumbTip, indexTip);
      const normPinch = pinchDist / palmScale;

      // Count curled fingers (tips closer to wrist than PIP joints)
      let curled = 0;
      const fingerPairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
      for (const [tipIdx, pipIdx] of fingerPairs) {
        if (dist2D(lms[tipIdx], wrist) < dist2D(lms[pipIdx], wrist) * 1.05) {
          curled++;
        }
      }

      // Gesture classification
      let gesture = 'OPEN';
      if (curled === 4 || (curled >= 3 && normPinch >= 0.28)) {
        gesture = 'FIST';
      } else if (normPinch < 0.28) {
        gesture = 'PINCH';
      }

      // Mirrored coordinates for intuitive interaction
      const center = {
        x: 1.0 - middleMcp.x,
        y: middleMcp.y
      };

      const pinchCenter = {
        x: 1.0 - (thumbTip.x + indexTip.x) / 2.0,
        y: (thumbTip.y + indexTip.y) / 2.0
      };

      analyzedHands.push({
        handIdx,
        gesture,
        center,
        pinchCenter,
        normPinch,
        curled,
        landmarks: lms
      });

      // --- Draw Neon Skeleton on Camera Canvas ---
      // Note: Video is displayed mirrored in CSS or raw; we draw aligned to canvas coordinates
      ctx.save();
      ctx.shadowColor = gesture === 'PINCH' ? '#ffaa00' : '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = gesture === 'PINCH' ? 'rgba(255, 170, 0, 0.85)' : 'rgba(0, 240, 255, 0.75)';
      ctx.lineWidth = 2;

      // Draw bone connections
      for (const [i1, i2] of HAND_CONNECTIONS) {
        const p1 = lms[i1];
        const p2 = lms[i2];
        ctx.beginPath();
        ctx.moveTo(p1.x * cw, p1.y * ch);
        ctx.lineTo(p2.x * cw, p2.y * ch);
        ctx.stroke();
      }

      // Draw joints
      for (let i = 0; i < lms.length; i++) {
        const p = lms[i];
        const isTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);
        const isPinchTip = (i === 4 || i === 8) && gesture === 'PINCH';

        ctx.beginPath();
        ctx.arc(p.x * cw, p.y * ch, isPinchTip ? 5 : (isTip ? 3.5 : 2.5), 0, Math.PI * 2);
        ctx.fillStyle = isPinchTip ? '#ffaa00' : (isTip ? '#00f0ff' : '#88e0ff');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw gesture label tag next to wrist
      ctx.shadowBlur = 0;
      ctx.fillStyle = gesture === 'PINCH' ? '#ffaa00' : '#00f0ff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`[${gesture}]`, wrist.x * cw - 20, Math.max(30, wrist.y * ch - 10));

      ctx.restore();
    });

    // Sort hands horizontally
    analyzedHands.sort((a, b) => a.center.x - b.center.x);

    // ================= CLIENT-SIDE REALTIME GESTURE ACTIONS =================

    // 1. TWO HAND INTERACTIONS
    if (numHands >= 2) {
      const h0 = analyzedHands[0];
      const h1 = analyzedHands[1];
      const distHands = dist2D(h0.center, h1.center);
      const midCursor = {
        x: (h0.center.x + h1.center.x) / 2.0,
        y: (h0.center.y + h1.center.y) / 2.0
      };
      this._updateCursor(midCursor.x, midCursor.y, false);

      // (A) TWO FISTS -> Magnetic Assembly (Vehicle whole again)
      if (h0.gesture === 'FIST' && h1.gesture === 'FIST') {
        this.carModel.smoothReassemble();
        this.holographicFX.playAssembleSound();
        const slider = document.getElementById('slider-explode');
        if (slider) slider.value = 0;
        if (this.hudGesture) this.hudGesture.textContent = 'TWO FISTS: ASSEMBLE VEHICLE (WHOLE AGAIN)';
        this.twoHandZoomBaseDist = null;
      }

      // (B) TWO PINCHES -> Dynamic Zoom
      else if (h0.gesture === 'PINCH' && h1.gesture === 'PINCH') {
        const pinchDist = dist2D(h0.pinchCenter, h1.pinchCenter);
        if (this.twoHandZoomBaseDist === null) {
          this.twoHandZoomBaseDist = pinchDist;
          this.twoHandZoomBaseLevel = this.carModel.zoomLevel;
        } else {
          const ratio = pinchDist / Math.max(0.05, this.twoHandZoomBaseDist);
          this.carModel.targetZoomLevel = Math.max(0.4, Math.min(2.8, this.twoHandZoomBaseLevel * ratio));
        }
        if (this.hudGesture) this.hudGesture.textContent = 'TWO-HAND PINCH: ZOOMING VEHICLE';
      }

      // (C) TWO OPEN HANDS -> Explosion Disassembly
      else if (h0.gesture === 'OPEN' && h1.gesture === 'OPEN') {
        this.twoHandZoomBaseDist = null;
        // Spread between 0.18 and 0.65 maps to 0.0 -> 1.0 explosion
        const normSpread = Math.max(0.0, Math.min(1.0, (distHands - 0.18) / 0.45));
        this.carModel.targetExplosionLevel = normSpread;
        const slider = document.getElementById('slider-explode');
        if (slider) slider.value = Math.round(normSpread * 100);
        if (this.hudGesture) this.hudGesture.textContent = `TWO OPEN HANDS: EXPLODE (${Math.round(normSpread * 100)}%)`;
      } else {
        this.twoHandZoomBaseDist = null;
        if (this.hudGesture) this.hudGesture.textContent = `TWO HANDS: ${h0.gesture} + ${h1.gesture}`;
      }

      this.prevHandCenter = null;
      this.prevPinchCenter = null;
      this.wasPinching = false;
      this.fistStartTime = null;
    }

    // 2. SINGLE HAND INTERACTIONS
    else if (numHands === 1) {
      const h = analyzedHands[0];
      this.twoHandZoomBaseDist = null;

      // (A) PINCH -> Select component or Drag component through 3D space
      if (h.gesture === 'PINCH') {
        this._updateCursor(h.pinchCenter.x, h.pinchCenter.y, true);

        if (!this.wasPinching) {
          // Initial pinch down: Pick component at reticle
          const pickedId = this.carModel.pickComponent(h.pinchCenter.x, h.pinchCenter.y, this.camera);
          if (pickedId) {
            this.carModel.selectComponent(pickedId);
            this.holographicFX.playSelectSound();
            this._notifyComponentSelection(pickedId);
          }
          this.wasPinching = true;
          if (this.hudGesture) this.hudGesture.textContent = 'PINCH: COMPONENT TARGETED';
        } else if (this.prevPinchCenter) {
          // Dragging: translate selected component in 3D
          const dx = (h.pinchCenter.x - this.prevPinchCenter.x) * 8.0 * this.sensitivity;
          const dy = -(h.pinchCenter.y - this.prevPinchCenter.y) * 8.0 * this.sensitivity;
          if (Math.hypot(dx, dy) > 0.003) {
            this.carModel.translateSelected(dx, dy, 0, this.camera);
            this.holographicFX.playDragHum();
            if (this.hudGesture) this.hudGesture.textContent = 'PINCH + MOVE: MANIPULATING COMPONENT';
          }
        }

        this.prevPinchCenter = { x: h.pinchCenter.x, y: h.pinchCenter.y };
        this.prevHandCenter = null;
        this.fistStartTime = null;
      }

      // (B) OPEN HAND -> Orbit vehicle rotation
      else if (h.gesture === 'OPEN') {
        this._updateCursor(h.center.x, h.center.y, false);
        this.wasPinching = false;
        this.prevPinchCenter = null;
        this.fistStartTime = null;

        if (this.prevHandCenter) {
          const dx = (h.center.x - this.prevHandCenter.x) * 4.0 * this.sensitivity;
          const dy = (h.center.y - this.prevHandCenter.y) * 3.0 * this.sensitivity;
          if (Math.hypot(dx, dy) > 0.002) {
            this.carModel.targetRotation.y += dx;
            this.carModel.targetRotation.x = Math.max(-1.2, Math.min(1.2, this.carModel.targetRotation.x + dy));
            if (this.hudGesture) this.hudGesture.textContent = 'OPEN HAND: ROTATING VEHICLE';
          }
        } else {
          if (this.hudGesture) this.hudGesture.textContent = 'OPEN HAND DETECTED';
        }

        this.prevHandCenter = { x: h.center.x, y: h.center.y };
      }

      // (C) FIST -> Hold to Reset
      else if (h.gesture === 'FIST') {
        this._updateCursor(h.center.x, h.center.y, false);
        this.wasPinching = false;
        this.prevPinchCenter = null;
        this.prevHandCenter = null;

        const now = performance.now();
        if (!this.fistStartTime) this.fistStartTime = now;
        const duration = (now - this.fistStartTime) / 1000;

        if (this.hudGesture) {
          this.hudGesture.textContent = `CLOSED FIST (HOLD TO RESET: ${Math.min(1.0, duration).toFixed(1)}s)`;
        }

        if (duration >= 1.0) {
          this.carModel.resetAll();
          this.holographicFX.playResetSound();
          if (this.hudGesture) this.hudGesture.textContent = 'RESET TRIGGERED: ALL ASSEMBLED';
          this.fistStartTime = now; // restart countdown
        }
      }
    }

    // Stream landmarks to Python backend WebSocket to keep backend telemetry in sync
    if (this.ws && this.isWsConnected && numHands > 0) {
      try {
        this.ws.send(JSON.stringify({
          type: 'PROCESS_CLIENT_LANDMARKS',
          landmarks: lmsList.map(lms => lms.map(p => ({ x: p.x, y: p.y, z: p.z || 0.0 })))
        }));
      } catch (err) {}
    }
  }

  _initMouseControls() {
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let hasMovedSignificantly = false;

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('.hud-panel') || e.target.closest('#dock') || e.target.closest('#top-bar') || e.target.closest('#boot-modal') || e.target.closest('#camera-pip')) return;
      isDragging = true;
      hasMovedSignificantly = false;
      prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      if (Math.hypot(dx, dy) > 4) hasMovedSignificantly = true;

      this.carModel.targetRotation.y += dx * 0.006 * this.sensitivity;
      this.carModel.targetRotation.x = Math.max(-1.2, Math.min(1.2, this.carModel.targetRotation.x + dy * 0.004 * this.sensitivity));

      prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', (e) => {
      if (isDragging && !hasMovedSignificantly) {
        const normX = e.clientX / window.innerWidth;
        const normY = e.clientY / window.innerHeight;
        const compId = this.carModel.pickComponent(normX, normY, this.camera);
        this.carModel.selectComponent(compId);
        if (compId) this._notifyComponentSelection(compId);
      }
      isDragging = false;
    });

    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.hud-panel') || e.target.closest('#dock') || e.target.closest('#camera-pip')) return;
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.carModel.targetZoomLevel = Math.max(0.4, Math.min(2.8, this.carModel.targetZoomLevel * zoomFactor));
    });
  }

  update(deltaTime, elapsedTime) {
    this.fpsCount++;
    const now = performance.now();
    if (now - this.lastFrameTime >= 500) {
      this.currentFps = Math.round((this.fpsCount * 1000) / (now - this.lastFrameTime));
      this.fpsCount = 0;
      this.lastFrameTime = now;
      if (this.hudFps) this.hudFps.textContent = this.currentFps;
    }

    if (this.hudZoom) this.hudZoom.textContent = this.carModel.zoomLevel.toFixed(2) + 'x';
    if (this.hudExplode) this.hudExplode.textContent = Math.round(this.carModel.explosionLevel * 100) + '%';
    if (this.hudRotation) {
      const rx = (this.carModel.rotation.x * 57.3).toFixed(0);
      const ry = ((this.carModel.rotation.y * 57.3) % 360).toFixed(0);
      this.hudRotation.textContent = `${rx}, ${ry}`;
    }
  }
}

function jsonParseSafe(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}