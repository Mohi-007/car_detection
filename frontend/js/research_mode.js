/**
 * 3D Holographic Car Laboratory - Component Information & Research Mode
 * Provides deep-dive technical diagnostics, animated CAN-FD bus oscilloscopes,
 * thermal gradient visualization, and electrical subsystem schematics.
 */

export class ResearchModeEngine {
  constructor(carModel, holographicFX) {
    this.carModel = carModel;
    this.holographicFX = holographicFX;
    this.isActive = false;
    this.selectedComponent = null;

    this.panel = document.getElementById('component-panel');
    this.liveTelemetryData = null;
    this.graphHistory = [];
    this.maxHistory = 60;

    // Cache elements
    this.compTitle = document.getElementById('comp-title');
    this.compCategory = document.getElementById('comp-category');
    this.compRole = document.getElementById('comp-role');
    this.compMaterial = document.getElementById('comp-material');
    this.compMass = document.getElementById('comp-mass');
    this.compStatus = document.getElementById('comp-status');
    this.compDtc = document.getElementById('comp-dtc');
    this.connectedList = document.getElementById('connected-list');
    this.specsContainer = document.getElementById('specs-container');
    this.researchContainer = document.getElementById('research-container');
    this.graphCanvas = document.getElementById('telemetry-graph');
    this.graphCtx = this.graphCanvas ? this.graphCanvas.getContext('2d') : null;

    this._bindEvents();
  }

  _bindEvents() {
    const researchBtn = document.getElementById('btn-research-mode');
    if (researchBtn) {
      researchBtn.addEventListener('click', () => {
        this.toggleResearchMode();
      });
    }

    const xrayBtn = document.getElementById('btn-xray');
    if (xrayBtn) {
      xrayBtn.addEventListener('click', () => {
        this.carModel.displayModes.xray = !this.carModel.displayModes.xray;
        xrayBtn.classList.toggle('active', this.carModel.displayModes.xray);
      });
    }

    const wfBtn = document.getElementById('btn-wireframe');
    if (wfBtn) {
      wfBtn.addEventListener('click', () => {
        this.carModel.displayModes.wireframe = !this.carModel.displayModes.wireframe;
        wfBtn.classList.toggle('active', this.carModel.displayModes.wireframe);
      });
    }

    const thermalBtn = document.getElementById('btn-thermal');
    if (thermalBtn) {
      thermalBtn.addEventListener('click', () => {
        this.carModel.displayModes.thermal = !this.carModel.displayModes.thermal;
        thermalBtn.classList.toggle('active', this.carModel.displayModes.thermal);
      });
    }
  }

  toggleResearchMode() {
    this.isActive = !this.isActive;
    const btn = document.getElementById('btn-research-mode');
    if (btn) btn.classList.toggle('active', this.isActive);

    const statusBadge = document.getElementById('research-status-badge');
    if (statusBadge) {
      statusBadge.textContent = this.isActive ? 'ACTIVE' : 'STANDBY';
      statusBadge.className = this.isActive ? 'metric-badge active' : 'metric-badge';
    }

    if (this.researchContainer) {
      this.researchContainer.style.display = this.isActive ? 'block' : 'none';
    }

    if (this.isActive) {
      this.holographicFX.playSelectSound();
    }
  }

  onComponentSelected(compData) {
    this.selectedComponent = compData;
    this.graphHistory = [];

    if (!compData) {
      if (this.panel) this.panel.style.display = 'none';
      const selLabel = document.getElementById('hud-selected-comp');
      if (selLabel) selLabel.textContent = 'NONE';
      return;
    }

    if (this.panel) this.panel.style.display = 'block';
    const selLabel = document.getElementById('hud-selected-comp');
    if (selLabel) selLabel.textContent = compData.name.toUpperCase();

    if (this.compTitle) this.compTitle.textContent = compData.name;
    if (this.compCategory) this.compCategory.textContent = compData.category.toUpperCase();
    if (this.compRole) this.compRole.textContent = compData.system_role;
    if (this.compMaterial) this.compMaterial.textContent = compData.material;
    if (this.compMass) this.compMass.textContent = (compData.mass_kg || 15) + ' kg';
    if (this.compStatus) this.compStatus.textContent = compData.status;

    if (this.connectedList) {
      this.connectedList.innerHTML = '';
      (compData.connected_components || []).forEach(cid => {
        const span = document.createElement('span');
        span.className = 'connected-tag';
        span.textContent = cid.toUpperCase();
        this.connectedList.appendChild(span);
      });
    }

    if (this.specsContainer) {
      this.specsContainer.innerHTML = '';
      const specs = compData.research_data || {};
      for (const key in specs) {
        if (key === 'diagnostic_code') {
          if (this.compDtc) this.compDtc.textContent = specs[key];
          continue;
        }
        const card = document.createElement('div');
        card.className = 'spec-card';
        const label = key.replace(/_/g, ' ');
        card.innerHTML = `
          <div class="spec-card-lbl">${label}</div>
          <div class="spec-card-val">${specs[key]}</div>
        `;
        this.specsContainer.appendChild(card);
      }
    }

    this.holographicFX.playSelectSound();
  }

  updateTelemetry(telemetryPayload) {
    this.liveTelemetryData = telemetryPayload;
    if (!this.liveTelemetryData || !this.selectedComponent) return;

    const live = this.liveTelemetryData.live_telemetry || {};
    const val = live.thermal_flux_w || live.live_voltage_v || live.system_health || 100;
    this.graphHistory.push(val);
    if (this.graphHistory.length > this.maxHistory) {
      this.graphHistory.shift();
    }

    this._drawGraph();
  }

  _drawGraph() {
    if (!this.graphCtx || !this.graphCanvas || this.graphHistory.length < 2) return;
    const ctx = this.graphCtx;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const minVal = Math.min(...this.graphHistory);
    const maxVal = Math.max(...this.graphHistory);
    const range = (maxVal - minVal) || 1.0;

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    this.graphHistory.forEach((val, i) => {
      const x = (i / (this.maxHistory - 1)) * w;
      const norm = (val - minVal) / range;
      const y = h - 10 - norm * (h - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  update(deltaTime, elapsedTime) {
    if (this.isActive && this.selectedComponent && this.graphHistory.length === 0) {
      const simulatedVal = 100 + 15 * Math.sin(elapsedTime * 4.0) + (Math.random() - 0.5) * 5;
      this.graphHistory.push(simulatedVal);
      if (this.graphHistory.length > this.maxHistory) this.graphHistory.shift();
      this._drawGraph();
    }
  }
}
