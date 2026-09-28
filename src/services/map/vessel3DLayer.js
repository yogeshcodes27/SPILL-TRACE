/**
 * SPILLTRACE — 3D Maritime Vessel Custom Mapbox Layer
 *
 * Implements Mapbox GL JS CustomLayerInterface for genuine Three.js 3D vessel rendering.
 * Features:
 * - Single shared WebGL context with Mapbox (zero separate overlay canvases)
 * - Geographically anchored to AIS coordinates via mapboxgl.MercatorCoordinate
 * - Canonical coordinate normalization:
 *     Bow = +Z, Stern = -Z, Up = +Y
 *     COG rotation maps Bow to actual direction of travel:
 *       COG 000° -> North (-Y in Mercator)
 *       COG 090° -> East  (+X in Mercator)
 *       COG 180° -> South (+Y in Mercator)
 *       COG 270° -> West  (-X in Mercator)
 * - Procedural Parent-Child Stern Wake:
 *     Child of vessel group, automatically points 180° opposite travel
 *     Localized V-shaped Kelvin wake with animated foam ripples
 * - Slow realistic AIS trajectory playback (Stage 05)
 * - Strict AIS gap preservation (SYN-003): stops interpolation across missing intervals
 * - Stage-aware behavior: Stage 06/07 pinned at forensic CPA evidentiary position
 * - Interactive hover highlight & Three.js raycast selection
 * - Controlled zoom-adaptive scaling
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import mapboxgl from 'mapbox-gl';

// ─── Procedural Stern Wake Texture Generator ────────────────────────
function createWakeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Background transparent
  ctx.clearRect(0, 0, 512, 1024);

  // Gradient along wake length (Y=0 is stern, Y=1024 is tail)
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, 'rgba(240, 250, 255, 0.85)');
  grad.addColorStop(0.15, 'rgba(210, 240, 255, 0.65)');
  grad.addColorStop(0.45, 'rgba(180, 225, 245, 0.35)');
  grad.addColorStop(0.8, 'rgba(150, 210, 235, 0.12)');
  grad.addColorStop(1.0, 'rgba(130, 200, 230, 0.0)');

  // Central Turbulent Propeller Wash / Froth
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(256 - 32, 0);
  ctx.lineTo(256 + 32, 0);
  ctx.lineTo(256 + 70, 700);
  ctx.lineTo(256 - 70, 700);
  ctx.closePath();
  ctx.fill();

  // Kelvin V-Shaped Divergent Wave Arms
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  // Starboard arm
  ctx.moveTo(256 + 28, 0);
  ctx.quadraticCurveTo(256 + 120, 300, 500, 950);
  // Port arm
  ctx.moveTo(256 - 28, 0);
  ctx.quadraticCurveTo(256 - 120, 300, 12, 950);
  ctx.stroke();

  // Secondary Echelon Waves (Transverse ripples)
  for (let y = 60; y < 900; y += 45) {
    const spread = (y / 900) * 180 + 30;
    const alpha = (1 - y / 900) * 0.45;
    ctx.strokeStyle = `rgba(220, 245, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 4 + (y / 200);
    ctx.beginPath();
    ctx.arc(256, y - 20, spread, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();
  }

  // Froth particle noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 400; i++) {
    const px = 256 + (Math.random() - 0.5) * 80 * (1 + (i / 100));
    const py = Math.random() * 600;
    ctx.fillRect(px, py, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ─── Build V-Shaped Wake Mesh Geometry ──────────────────────────────
function createSternWakeMesh(wakeTexture) {
  // Wake fan geometry: starts at stern (Z=0) and expands aft into negative Z
  const length = 75.0; // ~2.0 vessel lengths aft
  const sternWidth = 6.8;
  const tailWidth = 38.0;

  const geo = new THREE.PlaneGeometry(1, 1, 16, 32);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    // In Three.js PlaneGeometry, y=+0.5 has V=1 (canvas top, froth), y=-0.5 has V=0 (canvas bottom, fade)
    const yNorm = 0.5 - pos.getY(i); // 0 at stern (y=+0.5) to 1 at tail (y=-0.5)
    const xNorm = pos.getX(i);       // -0.5 to +0.5

    const curWidth = sternWidth + (tailWidth - sternWidth) * yNorm;
    pos.setX(i, xNorm * curWidth);
    pos.setY(i, 0); // Flat on water surface
    pos.setZ(i, -yNorm * length); // Extends aft along -Z
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    map: wakeTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.03, -18.5); // Placed at transom stern waterline
  mesh.name = 'SternWake';
  return mesh;
}

// ─── Build Tactical Selection Waterline Aura Ring ───────────────────
function createSelectionRing() {
  const ringGeo = new THREE.RingGeometry(21.0, 23.5, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 0.05, 0);
  ring.visible = false;
  ring.name = 'SelectionRing';
  return ring;
}

// ─── Shortest Arc Angular Distance Helper ───────────────────────────
function interpolateAngleDeg(a, b, t) {
  let diff = (b - a) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (a + diff * t + 360) % 360;
}

// ─── Distance Calculation Helper (Haversine km) ──────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═════════════════════════════════════════════════════════════════════
// 3D VESSEL CUSTOM LAYER IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════
export function createVessel3DLayer({
  onSelectCandidate,
  getActiveScenario,
  getActiveTab,
  getSelectedMmsi,
  getVisibleLayers,
}) {
  let mapInstance = null;
  let glContext = null;
  let threeScene = null;
  let threeCamera = null;
  let threeRenderer = null;
  let raycaster = null;

  // Master GLB model template and shared wake texture
  let masterModel = null;
  let sharedWakeTexture = null;
  let isModelLoaded = false;

  // Active vessel runtime instances: Map<mmsi, VesselInstance>
  const vesselInstances = new Map();

  // Animation clock state
  let lastTimeMs = performance.now();
  let animationProgress = 0.0; // 0..1 loop progress across trajectory
  const SLOW_SPEED_SCALE = 0.000035; // Deliberate slow satellite time-lapse pace

  // Hover state
  let hoveredMmsi = null;

  // ─── Base Orientation Transform Matrices ──────────────────────────
  // Brings canonical Three.js model (Bow=+Z, Stern=-Z, Up=+Y) into Mapbox Mercator (North=-Y, East=+X, Up=+Z)
  const ROT_BASE = new THREE.Matrix4().makeRotationX(Math.PI / 2);

  // ─── Helper: Setup or Refresh Vessel Instances ─────────────────────
  function refreshVessels() {
    if (!threeScene || !masterModel) return;

    const scenario = typeof getActiveScenario === 'function' ? getActiveScenario() : null;
    const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : '01';
    const selectedMmsi = typeof getSelectedMmsi === 'function' ? getSelectedMmsi() : null;
    const isAisVisible = typeof getVisibleLayers === 'function' ? (getVisibleLayers()?.ais ?? true) : true;

    // Vessels are forensic in Stages 01, 02, 04, 05, 06, 07
    const isVesselStage = isAisVisible && (activeTab === '01' || activeTab === '02' || activeTab === '04' || activeTab === '05' || activeTab === '06' || activeTab === '07');

    if (!isVesselStage || !scenario?.aisTraffic?.tracks) {
      // Hide all vessels if in non-vessel stages (e.g. Stage 03 Slick) or if AIS layer is unchecked
      vesselInstances.forEach((inst) => {
        inst.group.visible = false;
      });
      return;
    }

    const currentTracks = scenario.aisTraffic.tracks;
    const currentMmsis = new Set(currentTracks.map((t) => String(t.mmsi)));

    // Remove obsolete instances
    vesselInstances.forEach((inst, mmsi) => {
      if (!currentMmsis.has(mmsi)) {
        threeScene.remove(inst.group);
        vesselInstances.delete(mmsi);
      }
    });

    // Create or update instances
    currentTracks.forEach((track) => {
      const mmsi = String(track.mmsi);
      let inst = vesselInstances.get(mmsi);

      if (!inst) {
        // Clone model scene
        const group = masterModel.clone(true);
        group.name = `Vessel_${mmsi}`;
        group.matrixAutoUpdate = false;

        // Attach stern wake as child of this vessel group!
        // This guarantees Wake rotates automatically with COG and moves with vessel
        const wakeMesh = createSternWakeMesh(sharedWakeTexture);
        group.add(wakeMesh);

        // Attach tactical selection ring
        const selRing = createSelectionRing();
        group.add(selRing);

        threeScene.add(group);

        inst = {
          mmsi,
          track,
          group,
          wakeMesh,
          selRing,
          currentLon: 0,
          currentLat: 0,
          currentCog: 0,
          currentSog: 0,
          isGapActive: false,
        };
        vesselInstances.set(mmsi, inst);
      }

      inst.track = track;
      inst.group.visible = true;

      // Selection state and tactical ring coloring matching reference screenshots
      const isSelected = selectedMmsi && String(selectedMmsi) === mmsi;
      const trackIdx = currentTracks.findIndex((t) => String(t.mmsi) === mmsi);
      if (inst.selRing) {
        if (activeTab === '02') {
          const colors = [0xf97316, 0x38bdf8, 0x10b981];
          const c = colors[trackIdx >= 0 ? trackIdx % colors.length : 0];
          inst.selRing.material.color.setHex(c);
          inst.selRing.visible = true;
        } else if (activeTab === '04') {
          const colors = [0x10b981, 0x94a3b8, 0x10b981];
          const c = colors[trackIdx >= 0 ? trackIdx % colors.length : 0];
          inst.selRing.material.color.setHex(c);
          inst.selRing.visible = true;
        } else if (activeTab === '06' || activeTab === '07') {
          const colors = [0xef4444, 0x38bdf8, 0x10b981, 0xcbd5e1, 0xf59e0b];
          const c = colors[trackIdx >= 0 ? trackIdx % colors.length : 0];
          inst.selRing.material.color.setHex(c);
          inst.selRing.visible = isSelected || trackIdx === 0;
        } else {
          inst.selRing.material.color.setHex(0xffd54f);
          inst.selRing.visible = !!isSelected;
        }
      }
    });
  }

  // ─── Custom Layer Interface Definition ────────────────────────────
  const customLayer = {
    id: '3d-vessel-layer',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapInstance = map;
      glContext = gl;

      threeCamera = new THREE.Camera();
      threeScene = new THREE.Scene();
      raycaster = new THREE.Raycaster();

      // Ambient Light for soft fill
      const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.25);
      threeScene.add(ambientLight);

      // Key Directional Sun Light (from SE)
      const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
      sunLight.position.set(30, -50, 80).normalize();
      threeScene.add(sunLight);

      // Secondary Cool Sky Light
      const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.3);
      fillLight.position.set(-40, 50, 60).normalize();
      threeScene.add(fillLight);

      // Shared wake texture
      sharedWakeTexture = createWakeTexture();

      // WebGL Renderer sharing Mapbox canvas and context
      threeRenderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      threeRenderer.autoClear = false;

      // Load Master 3D GLB Asset
      const loader = new GLTFLoader();
      loader.load(
        '/models/vessel_tanker.glb',
        (gltf) => {
          masterModel = gltf.scene;

          // Normalize materials and shadow casting
          masterModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.side = THREE.FrontSide;
              }
            }
          });

          isModelLoaded = true;
          refreshVessels();
          map.triggerRepaint();
        },
        undefined,
        (err) => {
          console.error('Failed to load /models/vessel_tanker.glb:', err);
        }
      );
    },

    render(gl, matrix) {
      if (!isModelLoaded || !threeRenderer || !threeScene || !mapInstance) return;

      const now = performance.now();
      const dt = Math.min((now - lastTimeMs) / 1000, 0.1);
      lastTimeMs = now;

      // Synchronize Mapbox projection matrix to Three.js camera
      threeCamera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
      threeCamera.projectionMatrixInverse.copy(threeCamera.projectionMatrix).invert();

      const scenario = typeof getActiveScenario === 'function' ? getActiveScenario() : null;
      const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : '01';
      const selectedMmsi = typeof getSelectedMmsi === 'function' ? getSelectedMmsi() : null;
      const isAisVisible = typeof getVisibleLayers === 'function' ? (getVisibleLayers()?.ais ?? true) : true;

      const isVesselStage = isAisVisible && (activeTab === '01' || activeTab === '04' || activeTab === '05' || activeTab === '06' || activeTab === '07');

      if (!isVesselStage) {
        vesselInstances.forEach((inst) => {
          inst.group.visible = false;
        });
        return;
      }

      // Advance slow progress for Stage 05 (AIS Traffic playback)
      // In Stages 06 & 07, movement is paused at the forensic CPA position to preserve evidence
      const isPlaybackStage = activeTab === '05';
      if (isPlaybackStage) {
        animationProgress = (animationProgress + SLOW_SPEED_SCALE * (dt * 60)) % 1.0;
      }

      // Animate wake foam ripples
      if (sharedWakeTexture) {
        sharedWakeTexture.offset.y = (sharedWakeTexture.offset.y + dt * 0.45) % 1.0;
      }

      // Update and transform each vessel instance
      vesselInstances.forEach((inst) => {
        const track = inst.track;
        if (!track || !track.positions || !track.positions.length) {
          inst.group.visible = false;
          return;
        }

        inst.group.visible = true;
        const positions = track.positions;

        let targetLon = positions[0].lon;
        let targetLat = positions[0].lat;
        let targetCog = positions[0].cog || 0;
        let targetSog = positions[0].sog || 0;
        let inGap = false;

        if (activeTab === '02') {
          // Stage 02 (Detection): Pin to vessel position closest to observed slick centroid
          const slickC = scenario?.spill?.centroid;
          let bestPos = positions[0];
          if (slickC && positions.length) {
            let minD = Infinity;
            for (const p of positions) {
              if (!p.isGap) {
                const d = haversineKm(p.lat, p.lon, slickC[1], slickC[0]);
                if (d < minD) {
                  minD = d;
                  bestPos = p;
                }
              }
            }
          }
          targetLon = bestPos.lon;
          targetLat = bestPos.lat;
          targetCog = bestPos.cog || 0;
          targetSog = bestPos.sog || 0;
        } else if (activeTab === '04' || activeTab === '06' || activeTab === '07') {
          // Stage 04 & Stage 06/07: Pin to evidentiary CPA position near reconstructed origin
          const origin = scenario?.drift?.backward?.originCentroid;
          let bestPos = positions[positions.length - 1];
          if (origin && positions.length) {
            let minD = Infinity;
            for (const p of positions) {
              if (!p.isGap) {
                const d = haversineKm(p.lat, p.lon, origin[1], origin[0]);
                if (d < minD) {
                  minD = d;
                  bestPos = p;
                }
              }
            }
          }
          targetLon = bestPos.lon;
          targetLat = bestPos.lat;
          targetCog = bestPos.cog || 0;
          targetSog = bestPos.sog || 0;
        } else if (isPlaybackStage) {
          // Stage 05: Slow, smooth interpolation along actual AIS trajectory points
          const numSegs = positions.length - 1;
          if (numSegs > 0) {
            const virtualIndex = animationProgress * numSegs;
            const segIdx = Math.floor(virtualIndex);
            const segFrac = virtualIndex - segIdx;

            const p0 = positions[segIdx];
            const p1 = positions[Math.min(segIdx + 1, positions.length - 1)];

            // CRITICAL: NEVER FABRICATE AIS GAPS
            // If the point is an AIS gap (SYN-003 transponder off), halt movement at p0!
            if (p0.isGap || p1.isGap) {
              inGap = true;
              targetLon = p0.lon;
              targetLat = p0.lat;
              targetCog = p0.cog || 0;
              targetSog = 0;
            } else {
              targetLon = p0.lon + (p1.lon - p0.lon) * segFrac;
              targetLat = p0.lat + (p1.lat - p0.lat) * segFrac;
              targetCog = interpolateAngleDeg(p0.cog || 0, p1.cog || p0.cog || 0, segFrac);
              targetSog = (p0.sog || 10) + ((p1.sog || 10) - (p0.sog || 10)) * segFrac;
            }
          }
        } else {
          // Default latest position
          const last = positions[positions.length - 1];
          targetLon = last.lon;
          targetLat = last.lat;
          targetCog = last.cog || 0;
          targetSog = last.sog || 0;
        }

        inst.currentLon = targetLon;
        inst.currentLat = targetLat;
        inst.currentCog = targetCog;
        inst.currentSog = targetSog;
        inst.isGapActive = inGap;

        // Wake visibility: active when moving and not in gap
        if (inst.wakeMesh) {
          inst.wakeMesh.visible = !inGap && targetSog > 0.5;
        }

        // Selection highlight ring
        const isSelected = selectedMmsi && String(selectedMmsi) === inst.mmsi;
        const isHovered = hoveredMmsi && String(hoveredMmsi) === inst.mmsi;
        if (inst.selRing) {
          inst.selRing.visible = !!isSelected || !!isHovered;
          inst.selRing.material.color.setHex(isSelected ? 0x00f0ff : 0xeab308);
          // Subtle pulse
          const pulse = 1.0 + Math.sin(now * 0.005) * 0.04;
          inst.selRing.scale.set(pulse, pulse, pulse);
        }

        // ─── GEOGRAPHIC COORDINATE TO MAPBOX MERCATOR TRANSFORMATION ───
        const mercCoord = mapboxgl.MercatorCoordinate.fromLngLat([targetLon, targetLat], 0);

        // Precise screen pixel scaling:
        // World width in pixels across 360° at current zoom is 512 * 2^zoom.
        // Tanker length in model units is 40.5. Real VLCC is ~330m.
        // At zoom 6-13, provide a crisp recognizable length (38-80px),
        // smoothly converging to 1:1 true physical scale at high zoom (14+).
        const currentZoom = mapInstance.getZoom();
        const worldPx = 512 * Math.pow(2, currentZoom);
        const physicalShipPx = 330 * mercCoord.meterInMercatorCoordinateUnits() * worldPx;
        const targetPx = Math.max(38 + Math.max(0, currentZoom - 6) * 5.5, physicalShipPx);
        const mercScale = targetPx / (40.5 * worldPx);

        // Canonical COG rotation (around Mercator vertical Z axis)
        const cogRad = (targetCog * Math.PI) / 180;
        const rotZ = new THREE.Matrix4().makeRotationZ(cogRad);

        // Keel elevation: model keel is at y = -2.48. Lifting by 2.48 * mercScale
        // guarantees the hull sits perfectly on and above sea level with zero depth clipping
        const zElevation = mercCoord.z + 2.48 * mercScale;

        // Assemble local world transformation matrix:
        // M = Translation * Scale * rotZ(cog) * rotBase(X = PI/2)
        const matrixLocal = new THREE.Matrix4()
          .makeTranslation(mercCoord.x, mercCoord.y, zElevation)
          .scale(new THREE.Vector3(mercScale, mercScale, mercScale))
          .multiply(rotZ)
          .multiply(ROT_BASE);

        inst.group.matrix.copy(matrixLocal);
      });

      // Render Three.js scene into Mapbox WebGL context
      threeRenderer.resetState();
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      threeRenderer.render(threeScene, threeCamera);
      mapInstance.triggerRepaint();
    },
  };

  // ─── Mouse Pointer & Click Handling ───────────────────────────────
  function handleMapClick(e) {
    if (!mapInstance || !vesselInstances.size) return false;

    // Check hit test against all active vessels
    let closestMmsi = null;
    let closestDist = Infinity;
    const clickPoint = e.point;

    vesselInstances.forEach((inst) => {
      if (!inst.group.visible) return;
      const screenPos = mapInstance.project([inst.currentLon, inst.currentLat]);
      const dist = Math.hypot(screenPos.x - clickPoint.x, screenPos.y - clickPoint.y);

      // Hit threshold of 35 screen pixels
      if (dist < 35 && dist < closestDist) {
        closestDist = dist;
        closestMmsi = inst.mmsi;
      }
    });

    if (closestMmsi) {
      if (typeof onSelectCandidate === 'function') {
        onSelectCandidate(closestMmsi);
      }
      mapInstance.triggerRepaint();
      return true;
    }
    return false;
  }

  function handleMapMouseMove(e) {
    if (!mapInstance || !vesselInstances.size) return;

    let foundMmsi = null;
    let closestDist = Infinity;
    const movePoint = e.point;

    vesselInstances.forEach((inst) => {
      if (!inst.group.visible) return;
      const screenPos = mapInstance.project([inst.currentLon, inst.currentLat]);
      const dist = Math.hypot(screenPos.x - movePoint.x, screenPos.y - movePoint.y);

      if (dist < 32 && dist < closestDist) {
        closestDist = dist;
        foundMmsi = inst.mmsi;
      }
    });

    if (foundMmsi !== hoveredMmsi) {
      hoveredMmsi = foundMmsi;
      mapInstance.getCanvas().style.cursor = hoveredMmsi ? 'pointer' : '';
      mapInstance.triggerRepaint();
    }
  }

  // ─── Layer Controller API ─────────────────────────────────────────
  return {
    customLayer,
    refreshVessels,
    handleMapClick,
    handleMapMouseMove,
    dispose() {
      if (sharedWakeTexture) {
        sharedWakeTexture.dispose();
      }
      vesselInstances.forEach((inst) => {
        if (inst.wakeMesh) {
          inst.wakeMesh.geometry.dispose();
          inst.wakeMesh.material.dispose();
        }
        if (inst.selRing) {
          inst.selRing.geometry.dispose();
          inst.selRing.material.dispose();
        }
      });
      vesselInstances.clear();
      if (threeRenderer) {
        threeRenderer.dispose();
      }
    },
  };
}
