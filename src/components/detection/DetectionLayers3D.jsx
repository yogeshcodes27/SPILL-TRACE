import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/**
 * DetectionLayers3D — "FOUR LAYERS. ONE DATASET."
 * 
 * Progressive visual storytelling of Section 2 powered by authentic satellite imagery:
 * - State 01 (RAW SAR): User's Sentinel-1 radar observation tile in 3D diamond perspective.
 * - State 02 (SEGMENTATION): User's DeepLabV3+ AI segmentation layer elevates above the base in 3D.
 * - State 03 (LOOK-ALIKE CHECK): User's polarimetric verification layer with multi-colored candidate inspection elevates into a 3-layer stack.
 * - State 04 (VERIFIED MASK): 3D diamond perspective smoothly straightens into a flat, front-on / top-down projection,
 *   layers merge flat onto the exact same footprint, displaying user's verified green slick with centroid coordinates and area metrics.
 */

const STAGES = [
  {
    id: 0,
    number: '01',
    name: 'RAW SAR',
    title: 'SATELLITE OBSERVATION',
    badge: 'STAGE 01 // SENSOR ACQUISITION',
    desc: 'Geo-referenced Sentinel-1 C-Band radar backscatter capture. Ocean surface capillary waves produce diffuse backscatter; hydrocarbon films dampen ripples, revealing backscatter damping anomalies.',
    detail: 'PASS 148 (DESCENDING) · VV/VH DUAL-POL · 10m SPATIAL RESOLUTION',
  },
  {
    id: 1,
    number: '02',
    name: 'SEGMENTATION',
    title: 'OIL-SPILL DETECTION',
    badge: 'DETECT // OIL-SPILL DETECTION',
    desc: 'Atrous Spatial Pyramid Pooling isolates candidate slick boundaries across multiscale receptive fields, extracting anomalous ocean depressions.',
    detail: 'RESNET-101 BACKBONE · ASPP RECEPTIVE FIELD · CANDIDATE SLICK DETECTED',
  },
  {
    id: 2,
    number: '03',
    name: 'LOOK-ALIKE CHECK',
    title: 'LOOK-ALIKE FILTERING',
    badge: 'DETECT // LOOK-ALIKE FILTERING',
    desc: 'Dual-polarisation entropy & texture analysis filters false positives: low-wind calm shadows, biogenic films, and ship wakes are discarded.',
    detail: 'POLARIMETRIC ENTROPY H & DEPRESSION RATIO · MULTI-TARGET FILTERING',
  },
  {
    id: 3,
    number: '04',
    name: 'VERIFIED MASK',
    title: 'CHARACTERISATION',
    badge: 'DETECT // CHARACTERISATION',
    desc: 'Verified forensic hydrocarbon polygon resolved with centroid coordinates and calibrated area, aligned for reverse hydrodynamic drift reconstruction.',
    detail: 'CALIBRATED POLYGON: 18.42 km² · CENTROID: 11.238°N, 79.814°E',
  },
];

const LAYER_IMAGES = [
  '/images/layers/layer1_raw_sar.jpg',
  '/images/layers/layer2_segmentation.jpg',
  '/images/layers/layer3_lookalike_check.jpg',
  '/images/layers/layer4_verified_mask.jpg',
];

export default function DetectionLayers3D() {
  const containerRef = useRef(null);
  const mountRef = useRef(null);

  // Active stage: 0, 1, 2, 3
  const [activeStage, setActiveStage] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(0);

  // Three.js refs
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const stackGroupRef = useRef(null);

  const layerMeshesRef = useRef([]);
  const layerMatsRef = useRef([]);
  const cornerLinesRef = useRef([]);

  // Damped progress tracking: 0.0 -> 3.0
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);

  // Smooth scroll to a specific stage when clicked on left vertical rail
  const scrollToStage = useCallback((stageIndex) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset;
    const containerTop = rect.top + scrollTop;
    const totalScrollable = container.offsetHeight - window.innerHeight;
    
    // Exact ratios matching each stage
    const ratios = [0.03, 0.35, 0.68, 0.98];
    const targetScrollY = containerTop + ratios[stageIndex] * totalScrollable;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 640;

    // 1. Scene & Perspective Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 24);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 2. High-Precision WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Master 3D Layers Stack Group
    const stackGroup = new THREE.Group();
    // Initial isometric diamond orientation (tilted back around X, rotated 45° around Z)
    stackGroup.rotation.x = -0.68; // ~39 deg tilt
    stackGroup.rotation.z = -Math.PI / 4; // -45 deg diamond rotation
    stackGroup.position.set(0, -1.0, 0);
    scene.add(stackGroup);
    stackGroupRef.current = stackGroup;

    // Image & Canvas Texture Setup (Aspect Ratio: 1024 x 682 = 1.5015)
    const C_WIDTH = 1024;
    const C_HEIGHT = 682;
    const slickCentroid = { x: 528, y: 359 };

    // Create 4 dedicated canvases for compositing the user images with technical overlays
    const canvases = [];
    const textures = [];

    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = C_WIDTH;
      canvas.height = C_HEIGHT;
      const ctx = canvas.getContext('2d');

      // Initial dark plate while image loads
      ctx.fillStyle = '#060B12';
      ctx.fillRect(0, 0, C_WIDTH, C_HEIGHT);

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 8;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;

      canvases.push(canvas);
      textures.push(tex);

      // Load user image and draw with crisp geospatial overlay
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = LAYER_IMAGES[i];

      img.onload = () => {
        // Draw the authentic satellite imagery
        ctx.clearRect(0, 0, C_WIDTH, C_HEIGHT);
        ctx.drawImage(img, 0, 0, C_WIDTH, C_HEIGHT);

        // Render technical metadata overlay specific to each stage
        if (i === 0) {
          // LAYER 1: RAW SAR
          // Coordinate graticule lines
          ctx.strokeStyle = 'rgba(140, 200, 255, 0.16)';
          ctx.lineWidth = 0.9;
          ctx.setLineDash([8, 8]);
          for (let gx = 256; gx < C_WIDTH; gx += 256) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, C_HEIGHT);
            ctx.stroke();
          }
          for (let gy = 170; gy < C_HEIGHT; gy += 170) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(C_WIDTH, gy);
            ctx.stroke();
          }
          ctx.setLineDash([]);

          // Telemetry
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('01 RAW SAR // SENTINEL-1 C-BAND RADAR OBSERVATION', 35, 42);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#64c8ff';
          ctx.fillText('11°20\'00"N / 79°40\'00"E · PASS 148 (DESCENDING) · 10m RESOLUTION', 35, 62);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText('σ₀ BACKSCATTER INTENSITY · VV/VH DUAL-POL', C_WIDTH - 350, C_HEIGHT - 30);
        } else if (i === 1) {
          // LAYER 2: SEGMENTATION
          // Fine cyan subgrid
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
          ctx.lineWidth = 0.8;
          for (let gx = 128; gx < C_WIDTH; gx += 128) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, C_HEIGHT);
            ctx.stroke();
          }

          // Corner bounding brackets around the extracted red slick
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(105, 120, 28, 3);
          ctx.strokeRect(105, 120, 3, 28);
          ctx.strokeRect(855, 585, -28, 3);
          ctx.strokeRect(855, 585, 3, -28);

          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#00f0ff';
          ctx.fillText('[CANDIDATE 01: EXTRACTED SLICK]', 115, 108);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('DEEPLABV3+ ASPP · IOU: 0.892 · AREA: 18.42 km²', 115, 126);

          // Header info
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('02 SEGMENTATION // DEEPLABV3+ RESNET-101 EXTRACTION', 35, 42);
          ctx.fillStyle = '#00f0ff';
          ctx.fillText('PRIMARY HYDROCARBON CANDIDATE ISOLATED FROM CLUTTER', 35, 62);
        } else if (i === 2) {
          // LAYER 3: LOOK-ALIKE CHECK
          // Inspection tags pointing to candidate features
          // Confirmed red candidate
          ctx.save();
          ctx.fillStyle = 'rgba(4, 8, 14, 0.92)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(360, 160, 310, 58);
          ctx.fillRect(360, 160, 310, 58);
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('✓ MINERAL OIL SLICK: DETECTED', 374, 184);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#00f0ff';
          ctx.fillText('CONFIDENCE: 91.4% (ILLUSTRATIVE / DEMO)', 374, 204);
          ctx.restore();

          // Rejection callouts for false positives
          // Blue candidate (low wind)
          ctx.save();
          ctx.fillStyle = 'rgba(4, 8, 14, 0.92)';
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(90, 480, 240, 48);
          ctx.fillRect(90, 480, 240, 48);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ff4444';
          ctx.fillText('✕ REJECTED: LOW-WIND CALM', 102, 500);
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText('ENTROPY H: 0.28 (UNIFORM)', 102, 516);
          ctx.restore();

          // Yellow candidate (biogenic film)
          ctx.save();
          ctx.fillStyle = 'rgba(4, 8, 14, 0.92)';
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(430, 500, 240, 48);
          ctx.fillRect(430, 500, 240, 48);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ff4444';
          ctx.fillText('✕ REJECTED: BIOGENIC FILM', 442, 520);
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText('VV/VH RATIO: 1.12 (ORGANIC)', 442, 536);
          ctx.restore();

          // Green candidate (ship wake)
          ctx.save();
          ctx.fillStyle = 'rgba(4, 8, 14, 0.92)';
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(700, 250, 240, 48);
          ctx.fillRect(700, 250, 240, 48);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ff4444';
          ctx.fillText('✕ REJECTED: SHIP WAKE', 712, 270);
          ctx.font = '10px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText('LINEARITY: 0.98 (VESSEL TRACK)', 712, 286);
          ctx.restore();

          // Header
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('03 LOOK-ALIKE CHECK // POLARIMETRIC VERIFICATION', 35, 42);
          ctx.fillStyle = '#ff4444';
          ctx.fillText('3 FALSE POSITIVES REJECTED  ·  1 VERIFIED SLICK RETAINED', 35, 62);
        } else if (i === 3) {
          // LAYER 4: VERIFIED MASK
          // Centroid reticle crosshairs at (528, 359)
          const kx = slickCentroid.x;
          const ky = slickCentroid.y;

          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(kx - 30, ky);
          ctx.lineTo(kx + 30, ky);
          ctx.moveTo(kx, ky - 30);
          ctx.lineTo(kx, ky + 30);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(kx, ky, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#00ff66';
          ctx.beginPath();
          ctx.arc(kx, ky, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Callout Leader line & Forensic Target Box
          ctx.beginPath();
          ctx.moveTo(kx + 16, ky - 16);
          ctx.lineTo(kx + 60, ky - 60);
          ctx.lineTo(kx + 310, ky - 60);
          ctx.stroke();

          ctx.fillStyle = '#020509';
          ctx.fillRect(kx + 60, ky - 100, 270, 70);
          ctx.strokeStyle = '#00ff66';
          ctx.strokeRect(kx + 60, ky - 100, 270, 70);

          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('VALIDATED SLICK POLYGON', kx + 72, ky - 78);
          ctx.font = '11px monospace';
          ctx.fillStyle = '#00ff66';
          ctx.fillText('CENTROID: 11.238°N, 79.814°E', kx + 72, ky - 58);
          ctx.fillStyle = '#ffffff';
          ctx.fillText('AREA: 18.42 km² · HEADING: 042°', kx + 72, ky - 40);
          ctx.restore();

          // North Arrow
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.strokeRect(C_WIDTH - 80, 30, 45, 45);
          ctx.font = 'bold 15px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('▲ N', C_WIDTH - 68, 60);
          ctx.restore();

          // Scale Bar
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(C_WIDTH - 210, C_HEIGHT - 38);
          ctx.lineTo(C_WIDTH - 50, C_HEIGHT - 38);
          ctx.stroke();
          ctx.moveTo(C_WIDTH - 210, C_HEIGHT - 30);
          ctx.lineTo(C_WIDTH - 210, C_HEIGHT - 46);
          ctx.moveTo(C_WIDTH - 50, C_HEIGHT - 30);
          ctx.lineTo(C_WIDTH - 50, C_HEIGHT - 46);
          ctx.stroke();
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('5 KM GEODETIC SCALE', C_WIDTH - 200, C_HEIGHT - 48);
          ctx.restore();

          // Verification stamp
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#00ff66';
          ctx.fillText('✓ FORENSIC VERIFICATION: PASSED // HINDCAST READY', 35, C_HEIGHT - 35);

          // Header
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('04 VERIFIED MASK // VALIDATED GEOSPATIAL INTELLIGENCE', 35, 42);
          ctx.fillStyle = '#00ff66';
          ctx.fillText('READY FOR REVERSE HYDRODYNAMIC DRIFT HINDCAST', 35, 62);
        }

        tex.needsUpdate = true;
      };
    }

    // =========================================================================
    // 3D SHEETS: 15m x 10m (Exact 1.5:1 Aspect Ratio of 1024x682 Images)
    // =========================================================================
    const planeGeo = new THREE.PlaneGeometry(15, 10);
    const borderGeo = new THREE.EdgesGeometry(planeGeo);

    const meshes = [];
    const materials = [];

    const borderColors = [0x5080a8, 0x00f0ff, 0xff5555, 0x00ff66];

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        opacity: i === 0 ? 1.0 : 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.renderOrder = i + 1;
      mesh.position.set(0, 0, 0);

      // Technical border around the layer sheet
      const borderMat = new THREE.LineBasicMaterial({
        color: borderColors[i],
        transparent: true,
        opacity: 0.65,
      });
      const borderMesh = new THREE.LineSegments(borderGeo, borderMat);
      mesh.add(borderMesh);

      stackGroup.add(mesh);
      meshes.push(mesh);
      materials.push(mat);
    }

    layerMeshesRef.current = meshes;
    layerMatsRef.current = materials;

    // Corner connector guide lines in 3D space
    const corners = [
      [-7.5, -5],
      [7.5, -5],
      [7.5, 5],
      [-7.5, 5],
    ];

    const lines = [];
    corners.forEach(([px, py]) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(px, py, 0),
        new THREE.Vector3(px, py, 0),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x64c8ff,
        dashSize: 0.25,
        gapSize: 0.18,
        transparent: true,
        opacity: 0.45,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.renderOrder = 10;
      stackGroup.add(line);
      lines.push(line);
    });
    cornerLinesRef.current = lines;

    // =========================================================================
    // 60 FPS CONTINUOUS ANIMATION LOOP: 4 STATES PROGRESSION
    // =========================================================================
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth progress interpolation: [0.0 to 3.0]
      currentProgressRef.current += (targetProgressRef.current - currentProgressRef.current) * 0.08;
      const p = currentProgressRef.current;

      // STAGE 01 (p in [0.0, 1.0]): Base SAR in 3D diamond perspective
      // STAGE 02 (p in [1.0, 2.0]): Layer 2 rises along +Z (normal to plane)
      // STAGE 03 (p in [2.0, 3.0]): Layer 3 rises, forming 3-layer floating stack
      // STAGE 04 (p in [2.1, 3.0]): Perspective straightens to 0, layers merge flat into cadastral map

      const tFinal = Math.max(0.0, Math.min(1.0, (p - 2.1) / 0.9));

      // 3D Rotation:
      // States 1, 2, 3: Diamond isometric perspective (-0.68 rad tilt, -45 deg rotation)
      // State 4: Smoothly straightens to 0.0 (clean, straight, flat top-down GIS projection)
      stackGroup.rotation.x = THREE.MathUtils.lerp(-0.68, 0.0, tFinal);
      stackGroup.rotation.z = THREE.MathUtils.lerp(-Math.PI / 4, 0.0, tFinal);
      stackGroup.rotation.y = 0.0;

      // Group Y-position adjusts to center the stack in diamond vs flat view
      stackGroup.position.y = THREE.MathUtils.lerp(-1.0, 0.0, tFinal);

      // Layer 1 (RAW SAR): Base layer, always at Z = 0
      meshes[0].position.z = 0;
      materials[0].opacity = 1.0;

      // Layer 2 (SEGMENTATION): Rises as p goes from 0.0 to 1.0
      const tSeg = Math.max(0.0, Math.min(1.0, p / 1.0));
      const zSegTarget = tSeg * 2.2;
      meshes[1].position.z = THREE.MathUtils.lerp(zSegTarget, 0.02, tFinal);
      materials[1].opacity = THREE.MathUtils.lerp(tSeg * 0.95, 0.35, tFinal);

      // Layer 3 (LOOK-ALIKE CHECK): Rises as p goes from 1.0 to 2.0
      const tDisc = Math.max(0.0, Math.min(1.0, (p - 1.0) / 1.0));
      const zDiscTarget = 2.2 + tDisc * 2.2;
      meshes[2].position.z = THREE.MathUtils.lerp(zDiscTarget, 0.04, tFinal);
      // In final state, rejected badges fade out
      materials[2].opacity = THREE.MathUtils.lerp(tDisc * 0.95, 0.0, tFinal);

      // Layer 4 (VERIFIED MASK): Appears in final state
      meshes[3].position.z = 0.06;
      materials[3].opacity = tFinal;

      // Update corner connecting lines
      const maxZ = Math.max(meshes[1].position.z, meshes[2].position.z);
      cornerLinesRef.current.forEach((line, idx) => {
        const [px, py] = corners[idx];
        const posAttr = line.geometry.attributes.position;
        posAttr.setXYZ(0, px, py, 0);
        posAttr.setXYZ(1, px, py, maxZ);
        posAttr.needsUpdate = true;
        line.computeLineDistances();
        line.material.opacity = (1.0 - tFinal) * (maxZ > 0.3 ? 0.4 : 0.0);
      });

      renderer.render(scene, camera);
    };

    animate();

    // Responsive container resize handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 640;
      const newHeight = container.clientHeight || 640;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      textures.forEach((t) => t.dispose());
    };
  }, []);

  // Sticky Scroll Listener: Maps scroll progression through the section [0..3]
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const totalScrollable = container.offsetHeight - windowHeight;
      if (totalScrollable <= 0) return;

      const scrolled = -rect.top;
      const ratio = Math.max(0, Math.min(1, scrolled / totalScrollable));

      setScrollRatio(ratio);

      // Map ratio 0..1 to 0..3 progress
      const targetP = ratio * 3.0;
      targetProgressRef.current = targetP;

      // 4 distinct active stages
      let activeIdx = 0;
      if (targetP < 0.75) {
        activeIdx = 0; // 01 RAW SAR
      } else if (targetP < 1.75) {
        activeIdx = 1; // 02 SEGMENTATION
      } else if (targetP < 2.5) {
        activeIdx = 2; // 03 LOOK-ALIKE CHECK
      } else {
        activeIdx = 3; // 04 VERIFIED MASK
      }
      setActiveStage(activeIdx);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentStage = STAGES[activeStage];

  return (
    <div ref={containerRef} className="relative h-[400vh] bg-[#040711] text-white">
      
      {/* Pinned Sticky Viewport (Full Screen Pinned Track) */}
      <div className="sticky top-0 h-screen w-full relative flex flex-col justify-between p-6 sm:p-8 overflow-hidden select-none">

        {/* ------------------------------------------------------------------ */}
        {/* TOP CONTENT: Section Header (Left) + Layer Explanation (Right) */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative z-20 max-w-[1440px] w-full mx-auto flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pointer-events-auto">
          {/* Left Column: Section Headline */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-label text-white/50 mb-2">
              <span className="w-1.5 h-1.5 bg-white inline-block" />
              <span>01 / Detection &amp; Discrimination</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-white">
              Find the signal.<br />
              <span className="text-white/95">Verify the slick.</span>
            </h2>

            <p className="text-white/70 text-[15px] sm:text-[16px] leading-[1.55] mt-3 font-normal max-w-lg">
              Not every dark patch is oil. A two-stage architecture separates DeepLabV3+ segmentation from polarimetric look-alike verification, screening low wind, biogenic films, and ship wakes.
            </p>
          </div>

          {/* Right Column: Active Layer Specification Card */}
          <div className="w-full lg:max-w-xl bg-[#0A0A0A] border border-white/15 p-5 font-mono shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-white font-medium text-xs tracking-label uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white font-semibold">{currentStage.number}</span>
                <span>{currentStage.badge}</span>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-label hidden sm:inline font-medium">
                {currentStage.title}
              </span>
            </div>

            <p className="text-white/80 text-xs sm:text-[13px] leading-relaxed font-normal">
              {currentStage.desc}
            </p>

            {currentStage.detail && (
              <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-white/50 font-mono tracking-wider flex items-center justify-between gap-2 uppercase">
                <div className="flex items-center gap-2">
                  <span className="text-white/40">DATA SPEC:</span>
                  <span className="text-white/80">{currentStage.detail}</span>
                </div>
                <span className="text-white/60 hidden md:inline">
                  PHASE {currentStage.number} / 04 ACTIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* LEFT VERTICAL NAVIGATION RAIL */}
        {/* ------------------------------------------------------------------ */}
        <div className="absolute left-6 sm:left-8 lg:left-10 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-6 font-mono pointer-events-auto">
          {/* Continuous vertical connecting line behind circular indicators */}
          <div className="absolute left-[7px] top-3 bottom-3 w-[1px] bg-white/20 -z-10" />

          {STAGES.map((s) => {
            const isActive = activeStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => scrollToStage(s.id)}
                className="group flex items-center gap-3.5 text-left cursor-pointer outline-none transition-all"
              >
                {/* Circular indicator node */}
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-white border-white'
                      : 'bg-[#0A0A0A] border-white/30 group-hover:border-white/70'
                  }`}
                >
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#111111]" />}
                </div>

                {/* Stage number & titles */}
                <div className="flex flex-col">
                  <span
                    className={`text-xs uppercase tracking-label transition-colors duration-200 ${
                      isActive ? 'text-white font-semibold' : 'text-white/40 group-hover:text-white/70'
                    }`}
                  >
                    {s.number} {s.name}
                  </span>
                  <span
                    className={`text-[10px] transition-colors duration-200 ${
                      isActive ? 'text-white/75 font-medium' : 'text-white/25 group-hover:text-white/45'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT VERTICAL PROGRESS INDICATOR */}
        {/* ------------------------------------------------------------------ */}
        <div className="absolute right-6 sm:right-8 lg:right-10 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3 font-mono text-[10px] pointer-events-none">
          <span className="text-white/40 text-[9px]">01</span>
          
          <div className="w-[1px] h-36 bg-white/15 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full bg-white transition-all duration-150"
              style={{ height: `${Math.round(scrollRatio * 100)}%` }}
            />
          </div>

          <span className="text-white/40 text-[9px]">04</span>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* CENTRAL 3D GEOSPATIAL VISUALIZATION */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative flex-1 flex items-center justify-center my-3 pointer-events-auto min-h-0">
          <div className="h-full max-h-[48vh] sm:max-h-[54vh] lg:max-h-[58vh] xl:max-h-[62vh] aspect-[1.5/1] max-w-[720px] bg-[#0A0A0A] border border-white/15 relative overflow-hidden flex items-center justify-center">
            
            {/* Three.js canvas mount */}
            <div 
              ref={mountRef} 
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" 
            />

            {/* Corner technical reticles */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/30 pointer-events-none" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/30 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/30 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/30 pointer-events-none" />

            {/* Viewport HUD tags */}
            <div className="absolute top-3 left-3.5 font-mono text-[9px] sm:text-[10px] text-white/40 tracking-label uppercase pointer-events-none">
              {activeStage === 3 ? 'PROJECTION: ORTHOGRAPHIC 2D GIS' : 'PROJECTION: 3D SPATIAL STACK'}
            </div>
            <div className="absolute bottom-3 right-3.5 font-mono text-[9px] sm:text-[10px] text-white/40 tracking-label uppercase pointer-events-none">
              11.238°N / 79.814°E
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* BOTTOM STATUS & TELEMETRY BAR */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative z-20 max-w-[1440px] w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-white/15 font-mono text-[11px] text-white/60 pointer-events-auto">
          <div className="flex items-center gap-3">
            <span className="text-white font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {currentStage.badge}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-white/50 hidden md:inline uppercase">
              {currentStage.detail}
            </span>
          </div>

          <div className="flex items-center gap-3 text-white/70">
            <span className="text-white/40 uppercase">ACTIVE PHASE:</span>
            <span className="text-white font-semibold uppercase">
              {currentStage.number} {currentStage.name}
            </span>
            <span className="text-white/20 hidden sm:inline">|</span>
            <span className="text-white/80 hidden sm:inline uppercase">
              {activeStage === 3 ? 'ALIGNMENT COMPLETE' : 'SCROLL TO ASSEMBLE ↓'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
