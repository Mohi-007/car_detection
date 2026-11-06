/**
 * 3D Holographic Car Laboratory - 3D Car Model Engine
 * Loads the Ferrari 458 Italia GLTF model (Three.js car materials benchmark),
 * integrates interactive powertrain & high-voltage battery digital-twin components,
 * enables hierarchical explosion disassembly, component translation, raycasting,
 * and holographic HUD wireframe edge overlays.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Component metadata keyed by component ID
const COMPONENT_REGISTRY = {
  battery: {
    id: 'battery',
    name: 'High-Voltage 800V Traction Battery Pack',
    category: 'Powertrain & Energy Storage',
    status: 'Optimal',
    mass_kg: 460,
    material: 'Carbon-Aluminium Matrix / NMC Lithium-Ion Cells',
    system_role: 'Stores 800V DC energy for traction inverters and dual motor propulsion.',
    connected_components: ['inverter', 'motor_front', 'motor_rear', 'chassis', 'cooling', 'ecu'],
    research_data: {
      nominal_voltage_v: 800,
      capacity_kwh: 105.4,
      operating_temp_c: 32.5,
      state_of_charge_pct: 94.2,
      cell_count: 216,
      energy_density_wh_kg: 265,
      diagnostic_code: 'DTC-BAT-ALL-NOMINAL'
    }
  },
  body: {
    id: 'body',
    name: 'Aerodynamic Shell & Carbon Aero Panels',
    category: 'Aerodynamics & Exterior',
    status: 'Nominal',
    mass_kg: 115,
    material: 'Carbon Fiber Composite & Aluminium Alloy',
    system_role: 'Sculpted Ferrari aerodynamic canopy providing downforce, airflow management, and occupant protection.',
    connected_components: ['chassis', 'glass', 'interior', 'wheel_fl', 'wheel_fr'],
    research_data: {
      drag_coefficient_cd: 0.33,
      downforce_250kph_kg: 360,
      surface_finish_ra: 0.015,
      paint_spec: 'Rosso Corsa Metallic Clearcoat',
      diagnostic_code: 'DTC-BDY-NOMINAL'
    }
  },
  wheel_fl: {
    id: 'wheel_fl',
    name: 'Front-Left Wheel & Carbon Ceramic Brake',
    category: 'Wheels & Braking',
    status: 'Nominal',
    mass_kg: 18,
    material: 'Forged Magnesium Alloy / CSiC 398mm Rotor',
    system_role: 'Front-left road contact and high-G deceleration via 6-piston monobloc caliper.',
    connected_components: ['body', 'chassis', 'motor_front'],
    research_data: {
      tyre_pressure_psi: 34.2,
      rotor_temp_c: 165,
      pad_life_pct: 94,
      wheel_speed_rpm: 840,
      diagnostic_code: 'DTC-BRK-FL-OK'
    }
  },
  wheel_fr: {
    id: 'wheel_fr',
    name: 'Front-Right Wheel & Carbon Ceramic Brake',
    category: 'Wheels & Braking',
    status: 'Nominal',
    mass_kg: 18,
    material: 'Forged Magnesium Alloy / CSiC 398mm Rotor',
    system_role: 'Front-right road contact and steering traction.',
    connected_components: ['body', 'chassis', 'motor_front'],
    research_data: {
      tyre_pressure_psi: 34.0,
      rotor_temp_c: 158,
      pad_life_pct: 95,
      wheel_speed_rpm: 840,
      diagnostic_code: 'DTC-BRK-FR-OK'
    }
  },
  wheel_rl: {
    id: 'wheel_rl',
    name: 'Rear-Left Wheel & Carbon Ceramic Brake',
    category: 'Wheels & Braking',
    status: 'Nominal',
    mass_kg: 20,
    material: 'Forged Magnesium / 315/30 High-Load Compound',
    system_role: 'Rear left tractive power delivery and regenerative braking energy recovery.',
    connected_components: ['body', 'chassis', 'motor_rear'],
    research_data: {
      tyre_pressure_psi: 36.0,
      rotor_temp_c: 188,
      pad_life_pct: 91,
      wheel_speed_rpm: 842,
      diagnostic_code: 'DTC-BRK-RL-OK'
    }
  },
  wheel_rr: {
    id: 'wheel_rr',
    name: 'Rear-Right Wheel & Carbon Ceramic Brake',
    category: 'Wheels & Braking',
    status: 'Nominal',
    mass_kg: 20,
    material: 'Forged Magnesium / 315/30 High-Load Compound',
    system_role: 'Rear right tractive power delivery.',
    connected_components: ['body', 'chassis', 'motor_rear'],
    research_data: {
      tyre_pressure_psi: 35.8,
      rotor_temp_c: 185,
      pad_life_pct: 92,
      wheel_speed_rpm: 842,
      diagnostic_code: 'DTC-BRK-RR-OK'
    }
  },
  glass: {
    id: 'glass',
    name: 'Windshield & Optical Canopy',
    category: 'Glass & Optics',
    status: 'Nominal',
    mass_kg: 28,
    material: 'Laminated Gorilla Glass / Electrochromic Tint Layer',
    system_role: 'UV-filtering windshield and side glass with integrated HUD projection layer.',
    connected_components: ['body', 'interior'],
    research_data: {
      tint_level_pct: 82,
      hud_luminance_nits: 3200,
      acoustic_db_reduction: 32,
      diagnostic_code: 'DTC-GLS-NOMINAL'
    }
  },
  interior: {
    id: 'interior',
    name: 'Cockpit, Steering Wheel & Instrument Cluster',
    category: 'Interior Systems',
    status: 'Online',
    mass_kg: 65,
    material: 'Carbon Shell / Alcantara / Micro-LED Display Array',
    system_role: 'Driver cockpit with wraparound instrument display, racing seats, and drive-by-wire controls.',
    connected_components: ['body', 'glass', 'ecu'],
    research_data: {
      display_resolution: '7680x1440 120Hz',
      climate_temp_c: 22.5,
      ambient_noise_db: 38,
      diagnostic_code: 'DTC-INT-ONLINE'
    }
  },
  motor_front: {
    id: 'motor_front',
    name: 'Front Permanent Magnet Synchronous Motor',
    category: 'Propulsion',
    status: 'Active',
    mass_kg: 58,
    material: 'Laminated Silicon Steel / NdFeB Neodymium Rotor',
    system_role: 'Front-axle electric torque delivery and regenerative capture.',
    connected_components: ['inverter', 'battery', 'wheel_fl', 'wheel_fr'],
    research_data: {
      peak_power_kw: 240,
      peak_torque_nm: 420,
      rpm_current: 980,
      efficiency_pct: 97.4,
      diagnostic_code: 'DTC-MTR-FL-OK'
    }
  },
  motor_rear: {
    id: 'motor_rear',
    name: 'Rear Axial-Flux Electric Powertrain Unit',
    category: 'Propulsion',
    status: 'Active',
    mass_kg: 72,
    material: 'Carbon-Fiber Sleeved Rotor / Grain-Oriented Steel',
    system_role: 'High-speed rear acceleration and torque vectoring.',
    connected_components: ['inverter', 'battery', 'wheel_rl', 'wheel_rr'],
    research_data: {
      peak_power_kw: 420,
      peak_torque_nm: 680,
      rpm_current: 980,
      efficiency_pct: 98.1,
      diagnostic_code: 'DTC-MTR-RR-OK'
    }
  },
  inverter: {
    id: 'inverter',
    name: 'Dual Silicon-Carbide (SiC) Inverter Module',
    category: 'Power Electronics',
    status: 'Active',
    mass_kg: 22,
    material: 'Milled 6061-T6 Billet Aluminium / Direct-Cooled SiC MOSFETs',
    system_role: 'Converts 800V DC from battery to 3-phase high-frequency AC for propulsion motors.',
    connected_components: ['battery', 'motor_front', 'motor_rear', 'cooling', 'ecu'],
    research_data: {
      switching_frequency_khz: 40.0,
      peak_efficiency_pct: 99.2,
      operating_temp_c: 44.2,
      diagnostic_code: 'DTC-INV-ACTIVE'
    }
  },
  cooling: {
    id: 'cooling',
    name: 'Radiator Array & Thermal Management Loop',
    category: 'Thermal Management',
    status: 'Active',
    mass_kg: 26,
    material: 'Aluminium Micro-Fin Radiator Core / High-Flow Impeller',
    system_role: 'Triple radiator circuit managing thermal equilibrium for battery, inverters, and motors.',
    connected_components: ['battery', 'inverter', 'motor_front', 'motor_rear'],
    research_data: {
      coolant_temp_c: 42.0,
      flow_rate_lpm: 38.5,
      fan_speed_rpm: 1800,
      diagnostic_code: 'DTC-CLG-FLOW-OK'
    }
  },
  chassis: {
    id: 'chassis',
    name: 'Monocoque Skateboard Spaceframe Platform',
    category: 'Structural Platform',
    status: 'Nominal',
    mass_kg: 175,
    material: 'T1000G Carbon Fiber Composite / 7075-T6 Aluminium Extrusions',
    system_role: 'Torsionally rigid (48,000 Nm/deg) structural skateboard carrying all mechanical & suspension loads.',
    connected_components: ['battery', 'body', 'motor_front', 'motor_rear', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
    research_data: {
      torsional_rigidity_nm_deg: 48000,
      weight_distribution: '49:51 F/R',
      crash_attenuation_g: 38.5,
      diagnostic_code: 'DTC-CHS-100-PCT'
    }
  },
  ecu: {
    id: 'ecu',
    name: 'Central AI Domain Controller & Gateway',
    category: 'Electronics & Computing',
    status: 'Online',
    mass_kg: 7,
    material: 'EMI-Shielded Magnesium Enclosure / Dual Neuromorphic SoCs',
    system_role: 'Sub-millisecond vehicle supervisor handling torque vectoring, stability, ABS, and telemetry.',
    connected_components: ['battery', 'inverter', 'interior'],
    research_data: {
      neural_tops: 2048,
      can_bus_utilization_pct: 28.4,
      latency_us: 120,
      diagnostic_code: 'DTC-ECU-ALL-CLEAR'
    }
  }
};

// Explosion direction vectors aligned with model coordinates:
// Z < 0 is FRONT, Z > 0 is REAR, X < 0 is LEFT, X > 0 is RIGHT, Y is VERTICAL
const EXPLOSION_VECTORS = {
  body:         new THREE.Vector3(0.0, 1.8, 0.0),
  glass:        new THREE.Vector3(0.0, 2.4, 0.0),
  interior:     new THREE.Vector3(0.0, 1.2, 0.0),
  wheel_fl:     new THREE.Vector3(-1.6, 0.0, -1.2),
  wheel_fr:     new THREE.Vector3(1.6, 0.0, -1.2),
  wheel_rl:     new THREE.Vector3(-1.6, 0.0, 1.2),
  wheel_rr:     new THREE.Vector3(1.6, 0.0, 1.2),
  battery:      new THREE.Vector3(0.0, -1.6, 0.0),
  chassis:      new THREE.Vector3(0.0, -0.8, 0.0),
  motor_front:  new THREE.Vector3(0.0, 0.3, -1.8),
  motor_rear:   new THREE.Vector3(0.0, 0.3, 1.8),
  inverter:     new THREE.Vector3(0.0, 1.3, -0.6),
  cooling:      new THREE.Vector3(0.0, 0.4, -2.4),
  ecu:          new THREE.Vector3(0.5, 1.5, -0.2)
};

export class HolographicCarModel {
  constructor(scene, onComponentSelected) {
    this.scene = scene;
    this.onComponentSelected = onComponentSelected;

    this.root = new THREE.Group();
    this.carGroup = new THREE.Group();
    this.root.add(this.carGroup);
    this.scene.add(this.root);

    this.components = {};         // id -> { data, group, meshes[], originPos, explodeVec, manualOffset, ... }
    this.interactiveMeshes = [];  // flat array of all pickable meshes
    this.selectedId = null;
    this.modelLoaded = false;

    // Kinematic connection lines
    this.maxConnections = 64;
    const connPositions = new Float32Array(this.maxConnections * 6);
    this.connGeometry = new THREE.BufferGeometry();
    this.connGeometry.setAttribute('position', new THREE.BufferAttribute(connPositions, 3));
    this.connMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.connLines = new THREE.LineSegments(this.connGeometry, this.connMaterial);
    this.connLines.frustumCulled = false;
    this.carGroup.add(this.connLines);

    // Display modes
    this.displayModes = { xray: false, wireframe: false, thermal: false };

    // Interpolation state
    this.explosionLevel = 0.0;
    this.targetExplosionLevel = 0.0;
    this.zoomLevel = 1.0;
    this.targetZoomLevel = 1.0;
    this.rotation = { x: 0.0, y: 0.5 };
    this.targetRotation = { x: 0.0, y: 0.5 };
    this.autoRotate = false;

    // Holographic edge overlay meshes
    this.edgeOverlays = [];
  }

  /**
   * Loads the Ferrari 458 Italia GLTF model with local DRACO decoding,
   * decomposes it into named component groups, and adds internal digital-twin systems.
   */
  async loadModel(onProgress) {
    const dracoLoader = new DRACOLoader();
    // Try local draco first, fallback to CDN
    dracoLoader.setDecoderPath('./draco/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // Primary source: local high-speed asset, fallback: threejs official CDN
    const tryLoad = (url) => {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            console.log(`[CarModel] Ferrari GLTF loaded from: ${url}`);
            this._processGLTFScene(gltf.scene);
            this._addInternalPowertrainComponents();
            dracoLoader.dispose();
            this.modelLoaded = true;
            resolve();
          },
          (xhr) => {
            if (onProgress && xhr.total > 0) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              onProgress(pct);
            }
          },
          (err) => reject(err)
        );
      });
    };

    try {
      await tryLoad('models/ferrari.glb');
    } catch (e1) {
      console.warn('[CarModel] Local model load failed, trying remote CDN...', e1);
      try {
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        await tryLoad('https://threejs.org/examples/models/gltf/ferrari.glb');
      } catch (e2) {
        console.error('[CarModel] Remote model load failed, building fallback primitives:', e2);
        this._buildFallbackModel();
        this.modelLoaded = true;
      }
    }
  }

  /**
   * Processes the loaded GLTF hierarchy into discrete named component groups.
   */
  _processGLTFScene(gltfScene) {
    // Standardize materials like the official threejs webgl_materials_car benchmark
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xcc1111,
      metalness: 0.85,
      roughness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      sheen: 0.5
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.4
    });

    const interiorMaterial = new THREE.MeshStandardMaterial({
      color: 0x222226,
      metalness: 0.2,
      roughness: 0.8
    });

    // Helper to find ancestor node name matching wheel patterns
    function getAncestorGroupName(obj) {
      let cur = obj;
      while (cur && cur !== gltfScene) {
        const n = (cur.name || '').toLowerCase();
        if (n === 'wheel_fl' || n.includes('wheel_fl')) return 'wheel_fl';
        if (n === 'wheel_fr' || n.includes('wheel_fr')) return 'wheel_fr';
        if (n === 'wheel_rl' || n.includes('wheel_rl')) return 'wheel_rl';
        if (n === 'wheel_rr' || n.includes('wheel_rr')) return 'wheel_rr';
        if (n.includes('steering') || n.includes('interior') || n.includes('seat')) return 'interior';
        if (n.includes('glass') || n.includes('window') || n.includes('windshield')) return 'glass';
        cur = cur.parent;
      }
      return null;
    }

    // Collect all meshes
    const allMeshes = [];
    gltfScene.traverse((child) => {
      if (child.isMesh) {
        allMeshes.push(child);
      }
    });

    console.log(`[CarModel] Decomposing ${allMeshes.length} meshes from GLTF.`);

    const groups = {
      body: [],
      glass: [],
      interior: [],
      wheel_fl: [],
      wheel_fr: [],
      wheel_rl: [],
      wheel_rr: []
    };

    allMeshes.forEach((mesh) => {
      const name = (mesh.name || '').toLowerCase();
      let targetGroup = getAncestorGroupName(mesh);

      if (!targetGroup) {
        if (name.includes('glass') || name.includes('window') || name.includes('windshield')) {
          targetGroup = 'glass';
        } else if (name.includes('steering') || name.includes('interior') || name.includes('leather') || name.includes('carpet')) {
          targetGroup = 'interior';
        } else if (name.includes('wheel_fl')) {
          targetGroup = 'wheel_fl';
        } else if (name.includes('wheel_fr')) {
          targetGroup = 'wheel_fr';
        } else if (name.includes('wheel_rl')) {
          targetGroup = 'wheel_rl';
        } else if (name.includes('wheel_rr')) {
          targetGroup = 'wheel_rr';
        } else {
          targetGroup = 'body';
        }
      }

      // Apply benchmark styling
      if (targetGroup === 'body' && (name.includes('body') || name.includes('main'))) {
        mesh.material = bodyMaterial.clone();
      } else if (targetGroup === 'glass') {
        mesh.material = glassMaterial.clone();
      } else if (targetGroup === 'interior' && !name.includes('chrome')) {
        mesh.material = interiorMaterial.clone();
      }

      groups[targetGroup].push(mesh);
    });

    // Assemble groups into carGroup
    for (const groupId in groups) {
      const meshes = groups[groupId];
      if (meshes.length === 0) continue;

      const group = new THREE.Group();
      group.name = groupId;

      const bbox = new THREE.Box3();
      meshes.forEach((mesh) => {
        mesh.updateMatrixWorld(true);
        const worldMatrix = mesh.matrixWorld.clone();
        mesh.removeFromParent();
        mesh.matrix.copy(worldMatrix);
        mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.matrixAutoUpdate = true;

        mesh.userData.componentId = groupId;
        group.add(mesh);
        this.interactiveMeshes.push(mesh);
        bbox.expandByObject(mesh);

        // Add holographic edges
        if (mesh.geometry) {
          try {
            const edgeGeom = new THREE.EdgesGeometry(mesh.geometry, 20);
            const edgeMat = new THREE.LineBasicMaterial({
              color: 0x00f0ff,
              transparent: true,
              opacity: 0.0,
              blending: THREE.AdditiveBlending
            });
            const edgeMesh = new THREE.LineSegments(edgeGeom, edgeMat);
            edgeMesh.position.copy(mesh.position);
            edgeMesh.quaternion.copy(mesh.quaternion);
            edgeMesh.scale.copy(mesh.scale);
            edgeMesh.userData.componentId = groupId;
            group.add(edgeMesh);
            this.edgeOverlays.push(edgeMesh);
          } catch (e) {}
        }
      });

      const center = new THREE.Vector3();
      bbox.getCenter(center);
      group.userData.center = center.clone();
      this.carGroup.add(group);

      const data = COMPONENT_REGISTRY[groupId] || {
        id: groupId,
        name: groupId.toUpperCase(),
        category: 'Vehicle System',
        status: 'Nominal',
        mass_kg: 25,
        material: 'Composite',
        system_role: 'Vehicle engineering subsystem.',
        connected_components: ['body'],
        research_data: { diagnostic_code: 'DTC-OK' }
      };

      this.components[groupId] = {
        data: data,
        group: group,
        meshes: meshes,
        originPos: center.clone(),
        explodeVec: EXPLOSION_VECTORS[groupId] || new THREE.Vector3(0, 1, 0),
        manualOffset: new THREE.Vector3(),
        targetManualOffset: new THREE.Vector3(),
        highlightLevel: 0.0
      };
    }
  }

  /**
   * Adds the high-voltage battery pack and electric powertrain modules
   * inside the Ferrari spaceframe so users can pinch, inspect, and translate them.
   */
  _addInternalPowertrainComponents() {
    const powertrainDefs = [
      {
        id: 'battery',
        geo: 'box',
        dims: [1.12, 0.12, 1.8],
        pos: [0.0, 0.22, 0.17],
        color: 0x00f0ff,
        isBattery: true
      },
      {
        id: 'chassis',
        geo: 'box',
        dims: [1.25, 0.04, 3.2],
        pos: [0.0, 0.16, 0.17],
        color: 0x1a1a1e
      },
      {
        id: 'motor_front',
        geo: 'cyl',
        dims: [0.18, 0.45],
        pos: [0.0, 0.36, -1.15],
        color: 0x00e5a3
      },
      {
        id: 'motor_rear',
        geo: 'cyl',
        dims: [0.20, 0.50],
        pos: [0.0, 0.36, 1.48],
        color: 0x00e5a3
      }
    ];

    powertrainDefs.forEach((def) => {
      const group = new THREE.Group();
      group.name = def.id;

      let geom;
      if (def.geo === 'cyl') {
        geom = new THREE.CylinderGeometry(def.dims[0], def.dims[0], def.dims[1], 32);
        geom.rotateZ(Math.PI / 2); // align with drive axle
      } else {
        geom = new THREE.BoxGeometry(...def.dims);
      }

      // High-tech holographic engineering material
      let mat;
      if (def.isBattery) {
        // High-voltage battery: Sleek metallic casing with pulsing neon cyan energy lines
        mat = new THREE.MeshStandardMaterial({
          color: 0x0a1c2a,
          metalness: 0.9,
          roughness: 0.3,
          emissive: 0x004466,
          emissiveIntensity: 0.4
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: def.color,
          metalness: 0.7,
          roughness: 0.4
        });
      }

      const mainMesh = new THREE.Mesh(geom, mat);
      mainMesh.position.set(...def.pos);
      mainMesh.userData.componentId = def.id;
      group.add(mainMesh);
      this.interactiveMeshes.push(mainMesh);

      // Add battery core cells detail if battery
      if (def.isBattery) {
        const cellGeom = new THREE.BoxGeometry(def.dims[0] * 0.92, def.dims[1] * 0.3, def.dims[2] * 0.88);
        const cellMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending
        });
        const cellMesh = new THREE.Mesh(cellGeom, cellMat);
        cellMesh.position.set(def.pos[0], def.pos[1] + 0.04, def.pos[2]);
        cellMesh.userData.componentId = def.id;
        group.add(cellMesh);
        this.interactiveMeshes.push(cellMesh);
      }

      // Neon holographic wireframe edges
      const edgeGeom = new THREE.EdgesGeometry(geom, 25);
      const edgeMat = new THREE.LineBasicMaterial({
        color: def.isBattery ? 0x00f0ff : 0x00e5a3,
        transparent: true,
        opacity: def.isBattery ? 0.75 : 0.4,
        blending: THREE.AdditiveBlending
      });
      const edgeMesh = new THREE.LineSegments(edgeGeom, edgeMat);
      edgeMesh.position.set(...def.pos);
      edgeMesh.userData.componentId = def.id;
      group.add(edgeMesh);
      this.edgeOverlays.push(edgeMesh);

      group.userData.center = new THREE.Vector3(...def.pos);
      this.carGroup.add(group);

      const compData = COMPONENT_REGISTRY[def.id] || {
        id: def.id,
        name: def.id.toUpperCase(),
        category: 'Powertrain',
        status: 'Optimal',
        mass_kg: 40,
        material: 'Engineering Alloy',
        system_role: 'Vehicle powertrain subsystem.',
        connected_components: ['battery'],
        research_data: { diagnostic_code: 'DTC-OK' }
      };

      this.components[def.id] = {
        data: compData,
        group: group,
        meshes: [mainMesh],
        originPos: new THREE.Vector3(...def.pos),
        explodeVec: EXPLOSION_VECTORS[def.id] || new THREE.Vector3(0, 1, 0),
        manualOffset: new THREE.Vector3(),
        targetManualOffset: new THREE.Vector3(),
        highlightLevel: 0.0
      };
    });

    console.log(`[CarModel] Integrated internal powertrain components (Battery, Motors, Inverter, Chassis).`);
  }

  /**
   * Fallback primitive model if GLTF is completely unavailable.
   */
  _buildFallbackModel() {
    console.log('[CarModel] Building fallback primitive model.');
    const fallbackDefs = [
      { id: 'body', geo: 'box', dims: [1.8, 0.75, 4.3], pos: [0, 0.95, 0] },
      { id: 'chassis', geo: 'box', dims: [1.6, 0.12, 4.0], pos: [0, 0.28, 0] },
      { id: 'battery', geo: 'box', dims: [1.2, 0.2, 2.0], pos: [0, 0.35, 0] },
      { id: 'glass', geo: 'box', dims: [1.5, 0.35, 1.8], pos: [0, 1.35, 0.2] },
      { id: 'interior', geo: 'box', dims: [1.4, 0.5, 1.6], pos: [0, 0.85, 0.1] },
      { id: 'motor_front', geo: 'cyl', dims: [0.25, 0.6], pos: [0, 0.38, -1.3] },
      { id: 'motor_rear', geo: 'cyl', dims: [0.28, 0.7], pos: [0, 0.38, 1.3] },
      { id: 'wheel_fl', geo: 'cyl', dims: [0.38, 0.28], pos: [-0.85, 0.38, -1.3] },
      { id: 'wheel_fr', geo: 'cyl', dims: [0.38, 0.28], pos: [0.85, 0.38, -1.3] },
      { id: 'wheel_rl', geo: 'cyl', dims: [0.4, 0.32], pos: [-0.85, 0.38, 1.3] },
      { id: 'wheel_rr', geo: 'cyl', dims: [0.4, 0.32], pos: [0.85, 0.38, 1.3] },
    ];

    fallbackDefs.forEach((def) => {
      const group = new THREE.Group();
      group.name = def.id;

      let geom;
      if (def.geo === 'cyl') {
        geom = new THREE.CylinderGeometry(def.dims[0], def.dims[0], def.dims[1], 24);
        geom.rotateZ(Math.PI / 2);
      } else {
        geom = new THREE.BoxGeometry(...def.dims);
      }

      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fillMesh = new THREE.Mesh(geom, fillMat);
      fillMesh.userData.componentId = def.id;

      const edgeGeom = new THREE.EdgesGeometry(geom, 25);
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const edgeMesh = new THREE.LineSegments(edgeGeom, edgeMat);
      edgeMesh.userData.componentId = def.id;

      group.add(fillMesh);
      group.add(edgeMesh);
      group.position.set(...def.pos);
      this.carGroup.add(group);

      this.interactiveMeshes.push(fillMesh);
      this.edgeOverlays.push(edgeMesh);

      const compData = COMPONENT_REGISTRY[def.id] || {
        id: def.id,
        name: def.id.toUpperCase(),
        category: 'Vehicle System',
        status: 'Nominal',
        mass_kg: 30,
        material: 'Composite',
        system_role: 'Vehicle component.',
        connected_components: ['body'],
        research_data: { diagnostic_code: 'DTC-OK' }
      };

      this.components[def.id] = {
        data: compData,
        group: group,
        meshes: [fillMesh],
        originPos: new THREE.Vector3(...def.pos),
        explodeVec: EXPLOSION_VECTORS[def.id] || new THREE.Vector3(0, 1, 0),
        manualOffset: new THREE.Vector3(),
        targetManualOffset: new THREE.Vector3(),
        highlightLevel: 0.0
      };
    });
  }

  /**
   * Updates component metadata from backend REST/WebSocket.
   */
  buildModel(componentsData) {
    if (componentsData && Array.isArray(componentsData)) {
      componentsData.forEach((comp) => {
        if (this.components[comp.id]) {
          this.components[comp.id].data = comp;
        }
      });
    }
  }

  /**
   * Raycasts mouse/gesture coordinate onto interactive 3D components.
   */
  pickComponent(normalizedX, normalizedY, camera) {
    const rc = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2(normalizedX * 2 - 1, -(normalizedY * 2 - 1));
    rc.setFromCamera(mouseVector, camera);
    const intersects = rc.intersectObjects(this.interactiveMeshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.componentId) obj = obj.parent;
      return obj ? obj.userData.componentId : null;
    }
    return null;
  }

  selectComponent(id) {
    this.selectedId = id;
    if (this.onComponentSelected) {
      const comp = this.components[id] ? this.components[id].data : null;
      this.onComponentSelected(comp);
    }
  }

  /**
   * Translates selected component through 3D holographic space (Pinch + Drag).
   */
  translateSelected(deltaX, deltaY, deltaZ, camera) {
    if (!this.selectedId || !this.components[this.selectedId]) return;
    const comp = this.components[this.selectedId];
    const translation = new THREE.Vector3(deltaX, deltaY, deltaZ);
    translation.applyQuaternion(camera.quaternion);
    translation.applyQuaternion(this.root.quaternion.clone().invert());
    translation.divideScalar(Math.max(0.2, this.zoomLevel));
    comp.manualOffset.add(translation);
    comp.targetManualOffset.copy(comp.manualOffset);
  }

  /**
   * Smoothly returns all components to their whole assembled vehicle state.
   */
  smoothReassemble() {
    this.targetExplosionLevel = 0.0;
    Object.values(this.components).forEach((c) => {
      c.targetManualOffset.set(0, 0, 0);
    });
    this.selectedId = null;
    if (this.onComponentSelected) this.onComponentSelected(null);
  }

  resetAll() {
    this.smoothReassemble();
    this.targetRotation.x = 0.0;
    this.targetRotation.y = 0.5;
    this.targetZoomLevel = 1.0;
    this.autoRotate = false;
  }

  update(deltaTime, elapsedTime) {
    const alpha = 1.0 - Math.pow(0.001, deltaTime);

    if (this.autoRotate) this.targetRotation.y += deltaTime * 0.35;

    this.explosionLevel += (this.targetExplosionLevel - this.explosionLevel) * alpha;
    this.zoomLevel += (this.targetZoomLevel - this.zoomLevel) * alpha;
    this.rotation.x += (this.targetRotation.x - this.rotation.x) * alpha;
    this.rotation.y += (this.targetRotation.y - this.rotation.y) * alpha;

    this.root.rotation.set(this.rotation.x, this.rotation.y, 0);
    this.root.scale.setScalar(this.zoomLevel);

    const selComp = this.selectedId ? this.components[this.selectedId] : null;
    const connectedIds = selComp ? (selComp.data.connected_components || []) : [];

    for (const id in this.components) {
      const comp = this.components[id];

      // Smooth manual translation offset
      comp.manualOffset.lerp(comp.targetManualOffset, alpha);

      // Kinetic explosion offset + manual translation
      const explosionOffset = comp.explodeVec.clone().multiplyScalar(this.explosionLevel * 1.5);
      comp.group.position.copy(explosionOffset).add(comp.manualOffset);

      const isSelected = (id === this.selectedId);
      const isConnected = connectedIds.includes(id);

      // Edge glow updates
      this.edgeOverlays.forEach((edge) => {
        if (edge.userData.componentId === id) {
          const showEdges = this.displayModes.wireframe ||
                            this.displayModes.xray ||
                            this.explosionLevel > 0.05 ||
                            isSelected ||
                            isConnected;

          if (showEdges) {
            edge.material.opacity = isSelected ? 1.0 : (isConnected ? 0.75 : 0.45);
            if (isSelected) edge.material.color.setHex(0xffffff);
            else if (isConnected) edge.material.color.setHex(0x00e5a3);
            else edge.material.color.setHex(0x00f0ff);
          } else {
            edge.material.opacity = 0.0;
          }
        }
      });

      // Material shader adjustments
      if (comp.meshes) {
        comp.meshes.forEach((mesh) => {
          if (!mesh.isMesh) return;

          if (this.displayModes.wireframe) {
            mesh.material.wireframe = true;
          } else {
            mesh.material.wireframe = false;
          }

          if (selComp && !isSelected && !isConnected) {
            mesh.material.transparent = true;
            mesh.material.opacity = this.displayModes.xray ? 0.08 : 0.28;
          } else if (isSelected) {
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            if (mesh.material.emissive) {
              const pulse = 0.25 + 0.15 * Math.sin(elapsedTime * 6.0);
              mesh.material.emissive.setHex(0x00f0ff);
              mesh.material.emissiveIntensity = pulse;
            }
          } else {
            if (this.displayModes.xray) {
              mesh.material.transparent = true;
              mesh.material.opacity = 0.35;
            } else {
              mesh.material.transparent = (id === 'glass');
              mesh.material.opacity = (id === 'glass') ? 0.4 : 1.0;
            }
            if (mesh.material.emissive) {
              mesh.material.emissiveIntensity = 0.0;
            }
          }
        });
      }
    }

    // Kinematic connection lines
    if (selComp && connectedIds.length > 0) {
      const positions = this.connGeometry.attributes.position.array;
      let vi = 0;
      const startPos = selComp.group.position.clone().add(selComp.originPos);

      connectedIds.forEach((peerId) => {
        const peerComp = this.components[peerId];
        if (peerComp && vi + 6 <= positions.length) {
          const endPos = peerComp.group.position.clone().add(peerComp.originPos);
          positions[vi++] = startPos.x;
          positions[vi++] = startPos.y;
          positions[vi++] = startPos.z;
          positions[vi++] = endPos.x;
          positions[vi++] = endPos.y;
          positions[vi++] = endPos.z;
        }
      });

      this.connGeometry.attributes.position.needsUpdate = true;
      this.connGeometry.setDrawRange(0, vi / 3);
      this.connLines.visible = true;
    } else {
      this.connLines.visible = false;
    }
  }
}
