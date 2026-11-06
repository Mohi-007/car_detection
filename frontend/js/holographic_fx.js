/**
 * 3D Holographic Car Laboratory - Holographic Environment & FX Engine
 * Adds holographic floor grids, acoustic particle field, radar rings,
 * and Web Audio synthesized soundscapes for the 3D Holographic Car laboratory aesthetic.
 */

import * as THREE from 'three';

export class HolographicFX {
  constructor(scene) {
    this.scene = scene;
    this.audioEnabled = true;
    this.audioCtx = null;

    this._initHolographicGrid();
    this._initRadarRings();
    this._initAudioSynthesizer();
  }

  _initHolographicGrid() {
    this.grid = new THREE.GridHelper(16, 32, 0x00f0ff, 0x003355);
    this.grid.position.y = -0.52;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.45;
    this.grid.material.blending = THREE.AdditiveBlending;
    this.scene.add(this.grid);
  }

  _initRadarRings() {
    const ringGeom = new THREE.RingGeometry(3.4, 3.46, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    this.ring1 = new THREE.Mesh(ringGeom, ringMat);
    this.ring1.rotation.x = -Math.PI / 2;
    this.ring1.position.y = -0.51;
    this.scene.add(this.ring1);

    const ringGeom2 = new THREE.RingGeometry(4.8, 4.84, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x00e5a3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.ring2 = new THREE.Mesh(ringGeom2, ringMat2);
    this.ring2.rotation.x = -Math.PI / 2;
    this.ring2.position.y = -0.51;
    this.scene.add(this.ring2);
  }

  _initAudioSynthesizer() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.audioCtx = new AudioContext();
    }
  }

  _ensureAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSelectSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    this._ensureAudio();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playAssembleSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    this._ensureAudio();

    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.08, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.4);
    });
  }

  playDragHum() {
    if (!this.audioEnabled || !this.audioCtx) return;
    this._ensureAudio();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.08);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playResetSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    this._ensureAudio();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.35);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  update(deltaTime, elapsedTime) {
    if (this.ring1) this.ring1.rotation.z = elapsedTime * 0.25;
    if (this.ring2) this.ring2.rotation.z = -elapsedTime * 0.15;

    if (this.grid) {
      this.grid.material.opacity = 0.38 + 0.12 * Math.sin(elapsedTime * 1.8);
    }
  }
}
