/**
 * 3D Holographic Car Laboratory - Main Application Entrypoint
 * Orchestrates Three.js rendering pipeline, GLTF Ferrari model loading,
 * holographic FX subsystems, and gesture controller initialization.
 */

import * as THREE from 'three';
import { HolographicCarModel } from './car_model.js';
import { HolographicFX } from './holographic_fx.js';
import { ResearchModeEngine } from './research_mode.js';
import { GestureController } from './gesture_controller.js';

(async function () {
  console.log('[3D-CAR] Initializing 3D Holographic Car Laboratory...');

  // ---- Renderer Setup ----
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- Scene ----
  const scene = new THREE.Scene();

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.4, 7.5);
  camera.lookAt(0, 0.4, 0);

  // ---- Lighting (for PBR materials on the Ferrari model) ----
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = false;
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x00d4ff, 0.4);
  dirLight2.position.set(-5, 4, -5);
  scene.add(dirLight2);

  const pointLight = new THREE.PointLight(0x00f0ff, 0.6, 20);
  pointLight.position.set(0, 5, 0);
  scene.add(pointLight);

  // Hemisphere light for ambient fill
  const hemiLight = new THREE.HemisphereLight(0x88aaff, 0x003311, 0.4);
  scene.add(hemiLight);

  // ---- Resize ----
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- Initialize Subsystems ----
  const holographicFX = new HolographicFX(scene);

  let researchEngine = null;

  const carModel = new HolographicCarModel(scene, (selectedComp) => {
    if (researchEngine) {
      researchEngine.onComponentSelected(selectedComp);
    }
  });

  researchEngine = new ResearchModeEngine(carModel, holographicFX);

  const gestureController = new GestureController(carModel, holographicFX, camera);

  // ---- Loading Overlay ----
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingBarFill = document.getElementById('loading-bar-fill');
  const loadingPct = document.getElementById('loading-pct');

  function updateLoadingProgress(pct) {
    if (loadingBarFill) loadingBarFill.style.width = pct + '%';
    if (loadingPct) loadingPct.textContent = pct + '%';
  }

  function hideLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 600);
    }
  }

  // ---- Load Ferrari GLTF Model ----
  console.log('[3D-CAR] Loading Ferrari 458 Italia GLTF model...');
  try {
    await carModel.loadModel((pct) => {
      updateLoadingProgress(pct);
    });
    console.log('[3D-CAR] Vehicle model loaded successfully.');
    updateLoadingProgress(100);
  } catch (err) {
    console.error('[3D-CAR] Model load error, using fallback:', err);
    updateLoadingProgress(100);
  }

  hideLoadingOverlay();

  // ---- Load supplemental component data from backend ----
  async function loadComponentMetadata() {
    try {
      const resp = await fetch('/api/components');
      if (resp.ok) {
        const json = await resp.json();
        if (json.components && json.components.length > 0) {
          carModel.buildModel(json.components);
          return;
        }
      }
    } catch (e) {
      console.warn('[3D-CAR] Could not fetch /api/components, using built-in metadata.');
    }
  }

  await loadComponentMetadata();

  // ---- Main Render Loop ----
  const clock = new THREE.Clock();

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    carModel.update(deltaTime, elapsedTime);
    holographicFX.update(deltaTime, elapsedTime);
    gestureController.update(deltaTime, elapsedTime);
    researchEngine.update(deltaTime, elapsedTime);

    renderer.render(scene, camera);
  }

  renderLoop();

  // ---- Boot Sequence UI ----
  const bootModal = document.getElementById('boot-modal');
  const bootLog = document.getElementById('boot-log');
  const btnStartCam = document.getElementById('btn-boot-start-cam');
  const btnStartMouse = document.getElementById('btn-boot-mouse');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (bootLog) {
    const logs = [
      'INITIALIZING 3D HOLOGRAPHIC CAR PROTOCOLS...',
      'LOADING FERRARI 458 ITALIA DIGITAL TWIN...',
      'CONNECTING TO SENSORY & VISION PIPELINES...',
      'CALIBRATING GESTURE RECOGNITION ENGINE...',
      'SYSTEMS NOMINAL. READY FOR OPERATOR INTERACTION.'
    ];
    for (const msg of logs) {
      bootLog.innerHTML += msg + '<br>';
      await wait(250);
    }
  }

  if (btnStartCam) {
    btnStartCam.addEventListener('click', async () => {
      await gestureController.startLocalCamera();
      if (bootModal) bootModal.style.display = 'none';
    });
  }

  if (btnStartMouse) {
    btnStartMouse.addEventListener('click', () => {
      if (bootModal) bootModal.style.display = 'none';
    });
  }

  console.log('[3D-CAR] Laboratory online and rendering.');
})();
