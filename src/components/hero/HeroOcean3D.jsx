import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * HeroOcean3D — High-Contrast Natural Blue Ocean & Thin-Film Oil Slick Simulation
 * 
 * Updated Characteristics:
 * - REALISTIC NATURAL OCEAN WATER: Rich deep navy, open-ocean blue, muted cyan crests, and daylight sky reflections
 * - HIGH VISUAL CONTRAST: Deep charcoal-black oil slick sharply defined against natural blue seawater
 * - PROMINENT 3D WAVE GEOMETRY: Multi-scale Gerstner swells, visible peaks, ridges, troughs, and crest foam
 * - SUBTLE SCIENTIFIC IRIDESCENCE: Restrained bronze, silver, violet, and prismatic thin-film sheen on slick fringes
 * - ELEVATED DAYLIGHT LIGHTING: Crisp specular highlights on wave facets and mirror-like reflections on the oil film
 * - WEB BANNER COMPOSITION: Preserves negative space on the left for text, visual weight on center-right
 */
export default function HeroOcean3D({ onToggleSar, isSarActive = false }) {
  const mountRef = useRef(null);
  const [waveIntensity, setWaveIntensity] = useState(1.15);
  const [oilSpread, setOilSpread] = useState(1.0);
  const [cameraDrift, setCameraDrift] = useState(true);

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const mouseTargetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    // Elevated oblique aerial perspective looking across the ocean surface
    camera.position.set(0, 24, 38);
    camera.lookAt(8, 0, -6);

    // 2. High-Precision WebGL Renderer with Daylight Exposure
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18; // Crisp daylight exposure
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Dense Subdivided Ocean Geometry for Smooth 3D Wave Profiles
    const oceanGeometry = new THREE.PlaneGeometry(200, 150, 280, 280);
    oceanGeometry.rotateX(-Math.PI / 2);

    // 4. Custom GLSL Physical Ocean & Iridescent Oil Slick Shader
    const customMaterial = new THREE.ShaderMaterial({
      wireframe: false,
      uniforms: {
        u_time: { value: 0 },
        u_waveIntensity: { value: 1.15 },
        u_oilSpread: { value: 1.0 },
        u_sunDir: { value: new THREE.Vector3(0.55, 0.85, 0.35).normalize() },
      },
      vertexShader: `
        uniform float u_time;
        uniform float u_waveIntensity;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWaveHeight;
        varying float vFoam;

        // Gerstner wave displacement function with steepness Q
        vec3 gerstnerWave(vec4 wave, vec3 p, inout vec3 tangent, inout vec3 binormal) {
          float steepness = wave.z;
          float wavelength = wave.w;
          float k = 2.0 * 3.14159265 / wavelength;
          float c = sqrt(9.81 / k);
          vec2 d = normalize(wave.xy);
          float f = k * (dot(d, p.xz) - c * u_time * 0.75);
          float a = steepness / k * u_waveIntensity;

          tangent += vec3(
            -d.x * d.x * (steepness * sin(f)),
            d.x * (steepness * cos(f)),
            -d.x * d.y * (steepness * sin(f))
          );
          binormal += vec3(
            -d.x * d.y * (steepness * sin(f)),
            d.y * (steepness * cos(f)),
            -d.y * d.y * (steepness * sin(f))
          );

          return vec3(
            d.x * (a * cos(f)),
            a * sin(f),
            d.y * (a * cos(f))
          );
        }

        void main() {
          vec3 gridPoint = position;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec3 p = gridPoint;

          // 5 Layered Gerstner Waves: Large Swell, Crossing Swell, Wind Chop, Short Chop, Capillary
          // 1. Primary rolling ocean swell (38m wavelength)
          p += gerstnerWave(vec4(0.85, 0.53, 0.28, 38.0), gridPoint, tangent, binormal);
          // 2. Secondary crossing swell (22m wavelength)
          p += gerstnerWave(vec4(-0.45, 0.89, 0.22, 22.0), gridPoint, tangent, binormal);
          // 3. Medium wind chop (11.5m wavelength)
          p += gerstnerWave(vec4(0.35, 0.94, 0.16, 11.5), gridPoint, tangent, binormal);
          // 4. Short directional chop (5.8m wavelength)
          p += gerstnerWave(vec4(-0.75, 0.66, 0.11, 5.8), gridPoint, tangent, binormal);
          // 5. Fine capillary wave (3.2m wavelength)
          p += gerstnerWave(vec4(0.60, -0.80, 0.07, 3.2), gridPoint, tangent, binormal);

          // Micro-surface ripples across wave crests for natural geometric depth
          float micro = sin(p.x * 3.5 - u_time * 2.2) * cos(p.z * 3.2 - u_time * 1.8) * 0.09 * u_waveIntensity;
          micro += sin((p.x + p.z) * 5.2 + u_time * 2.8) * 0.04 * u_waveIntensity;
          p.y += micro;

          vec3 normal = normalize(cross(binormal, tangent));
          vNormal = normal;
          vWaveHeight = p.y;

          // Realistic crest foam: triggered on elevated peaks and steep wave faces
          vFoam = clamp((p.y - 0.38) * 1.8 + (1.0 - normal.y) * 1.3, 0.0, 1.0);

          vec4 worldPos = modelMatrix * vec4(p, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform float u_oilSpread;
        uniform vec3 u_sunDir;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vWaveHeight;
        varying float vFoam;

        // Multi-octave Simplex-like noise for fluid boundary deformation
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = rot * p * 2.05;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 n = normalize(vNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 halfDir = normalize(u_sunDir + viewDir);

          // -------------------------------------------------------------
          // 1. OIL SLICK DETECTION & SPATIAL DEFORMATION (Center-Right Focus)
          // -------------------------------------------------------------
          vec2 slickCenter = vec2(16.0, -9.0);
          vec2 relCoord = vWorldPosition.xz - slickCenter;
          // Hydrodynamic drift alignment (rotated along prevailing current)
          relCoord = mat2(0.86, 0.51, -0.51, 0.86) * relCoord;
          
          float slickDist = length(relCoord * vec2(0.68, 1.32)) / u_oilSpread;

          // Multi-scale current advection & wave stretching
          float slowTime = u_time * 0.12;
          float n1 = fbm(relCoord * 0.075 + vec2(slowTime * 0.06, slowTime * 0.04));
          float n2 = fbm(relCoord * 0.22 - vec2(slowTime * 0.08, slowTime * 0.025));

          // Oil conforms dynamically to wave movement (bunches slightly in troughs)
          float waveAdvection = vWaveHeight * 0.18;

          // Main irregular slick body
          float slickDensity = smoothstep(19.0, 4.5, slickDist + n1 * 12.5 + n2 * 5.2 + waveAdvection);

          // Thin elongated tendrils and streamers extending from main plume
          float tendril = smoothstep(0.46, 0.54, sin(relCoord.x * 0.32 + n1 * 3.6)) * exp(-slickDist * 0.11);
          slickDensity = clamp(slickDensity + tendril * 0.48, 0.0, 1.0);

          // Fragmented droplets and patches around perimeter
          float droplets = smoothstep(0.64, 0.84, noise(relCoord * 0.82 + n2 * 2.2)) * smoothstep(25.0, 12.0, slickDist);
          slickDensity = clamp(slickDensity + droplets * 0.38, 0.0, 1.0);

          // -------------------------------------------------------------
          // 2. CAPILLARY WAVE NORMAL PERTURBATION (Surface Sparkle vs Oil Damping)
          // -------------------------------------------------------------
          // Natural micro-facet ripples across clean seawater
          vec2 rippleCoord = vWorldPosition.xz * 0.55;
          float rTime = u_time * 1.5;
          float bx = sin(rippleCoord.x * 2.8 + rippleCoord.y * 1.9 - rTime) * 0.055 + sin(rippleCoord.x * 5.4 - rippleCoord.y * 3.8 + rTime * 1.2) * 0.03;
          float bz = cos(rippleCoord.x * 2.2 - rippleCoord.y * 3.5 + rTime * 0.9) * 0.055 + cos(rippleCoord.x * 4.6 + rippleCoord.y * 4.9 - rTime * 1.1) * 0.03;
          
          // Physical damping: Oil strongly dampens capillary ripples (Marangoni effect)
          vec3 waterNormal = normalize(n + vec3(bx, 0.0, bz) * (1.0 - slickDensity * 0.88));

          // -------------------------------------------------------------
          // 3. REALISTIC NATURAL OCEAN WATER COLOR PALETTE
          // (Deep oceanic navy, natural open-sea blue, and muted cyan wave crests)
          // -------------------------------------------------------------
          vec3 oceanDeepTrough = vec3(0.038, 0.12, 0.25);   // Deep ocean navy blue
          vec3 oceanMidWater   = vec3(0.08, 0.25, 0.42);    // Rich natural open-ocean blue
          vec3 oceanCrestCyan  = vec3(0.16, 0.40, 0.56);    // Muted cyan-blue wave crest
          vec3 oceanSubsurface = vec3(0.12, 0.44, 0.62);    // Forward sunlight scattering in crests

          // Natural daylight sky reflections
          vec3 skyZenith  = vec3(0.32, 0.46, 0.64);
          vec3 skyHorizon = vec3(0.58, 0.70, 0.82);
          vec3 skyReflection = mix(skyHorizon, skyZenith, clamp(waterNormal.y, 0.0, 1.0));

          // Base water color modulated by wave elevation (peaks are brighter and clearer)
          float heightFactor = clamp(vWaveHeight * 0.35 + 0.5, 0.0, 1.0);
          vec3 waterBody = mix(oceanDeepTrough, oceanMidWater, heightFactor);
          waterBody = mix(waterBody, oceanCrestCyan, pow(heightFactor, 2.0) * 0.65);

          // Subsurface scattering: daylight penetrating through thin rolling crests
          float sss = pow(clamp(dot(viewDir, -u_sunDir), 0.0, 1.0), 3.0) * heightFactor * (1.0 - waterNormal.y);
          waterBody += oceanSubsurface * sss * 0.45;

          // Diffuse directional sunlight illumination on forward wave slopes
          float NdotL = max(dot(waterNormal, u_sunDir), 0.0);
          waterBody += oceanMidWater * NdotL * 0.45;

          // Water Fresnel reflection (water reflects maritime sky at glancing angles)
          float waterFresnel = 0.02 + 0.98 * pow(1.0 - max(dot(viewDir, waterNormal), 0.0), 4.5);
          vec3 waterColor = mix(waterBody, skyReflection, waterFresnel * 0.72);

          // Bright natural sunlight specular highlights across wave surfaces
          vec3 waterHalfDir = normalize(u_sunDir + viewDir);
          float waterSpec = pow(max(dot(waterNormal, waterHalfDir), 0.0), 75.0) * 1.8;
          waterColor += vec3(0.98, 0.97, 0.92) * waterSpec;

          // -------------------------------------------------------------
          // 4. DARK CHARCOAL OIL SLICK OPTICS & SUBTLE SCIENTIFIC IRIDESCENCE
          // -------------------------------------------------------------
          // Thickness gradation: thin sheen on fringes, dense core in center
          float slickThickness = slickDensity;
          float oilOpacity = smoothstep(0.04, 0.72, slickThickness);

          // Deep charcoal-black hydrocarbon base color
          vec3 darkOilCore = vec3(0.015, 0.017, 0.021);

          // High-gloss mirror reflection on smooth oil film (sharp exponent)
          float oilSpecular = pow(max(dot(n, halfDir), 0.0), 180.0) * 3.4;
          float oilFresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);

          // Scientific thin-film interference: bronze, silver, subtle purple/violet, faint rainbow sheen
          float thinFilmPhase = (slickThickness * 5.2 + oilFresnel * 1.8 + vWaveHeight * 0.4);
          vec3 iriSpectral = 0.5 + 0.5 * cos(6.28318 * (thinFilmPhase + vec3(0.05, 0.38, 0.68)));
          vec3 iriBronze   = vec3(0.74, 0.62, 0.48);
          vec3 iriSilver   = vec3(0.68, 0.72, 0.76);
          vec3 iriViolet   = vec3(0.48, 0.42, 0.62);

          // Blend scientific iridescence: restrained, subtle, focused on 0.08 - 0.55 thickness zones
          vec3 thinFilmColor = mix(iriSilver, iriBronze, smoothstep(0.1, 0.35, slickThickness));
          thinFilmColor = mix(thinFilmColor, mix(iriViolet, iriSpectral * 0.7 + 0.3, 0.4), smoothstep(0.2, 0.55, slickThickness));

          // Fringe sheen mask: strictly concentrated at boundaries, tendrils, and wave slopes
          float fringeMask = smoothstep(0.04, 0.38, slickThickness) * (1.0 - smoothstep(0.60, 0.95, slickThickness));

          // Translucent composite: Water visible through thin sheens, transitioning to dark charcoal core
          vec3 oilSurface = mix(waterColor * 0.28 + darkOilCore * 0.72, darkOilCore, oilOpacity);
          oilSurface += thinFilmColor * fringeMask * 0.38;
          oilSurface += vec3(0.98, 0.97, 0.92) * oilSpecular * (0.4 + 0.6 * oilOpacity);

          // -------------------------------------------------------------
          // 5. CREST FOAM (Oil dampens wave froth)
          // -------------------------------------------------------------
          float foamMask = vFoam * (1.0 - slickDensity * 0.96);
          vec3 foamColor = vec3(0.92, 0.96, 1.0);

          // -------------------------------------------------------------
          // 6. HIGH-CONTRAST COMPOSITING: BLUE OCEAN + DARK OIL + FOAM
          // -------------------------------------------------------------
          vec3 finalSurface = mix(waterColor, oilSurface, smoothstep(0.02, 0.15, slickThickness));
          finalSurface = mix(finalSurface, foamColor, foamMask * 0.85);

          // Soft daylight atmospheric distance haze
          float dist = length(vWorldPosition - cameraPosition);
          float fog = 1.0 - exp(-dist * 0.012);
          vec3 daylightHaze = vec3(0.32, 0.44, 0.58);
          vec3 finalColor = mix(finalSurface, daylightHaze, fog);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
    materialRef.current = customMaterial;

    const oceanMesh = new THREE.Mesh(oceanGeometry, customMaterial);
    scene.add(oceanMesh);

    // 5. Smooth 60 FPS Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Update shader uniform time
      customMaterial.uniforms.u_time.value = elapsedTime;

      // Slow cinematic camera drift with subtle parallax
      if (cameraDrift) {
        const driftX = Math.sin(elapsedTime * 0.12) * 3.5;
        const driftZ = 38.0 + Math.cos(elapsedTime * 0.1) * 2.2;
        const driftY = 24.0 + Math.sin(elapsedTime * 0.08) * 1.2;

        // Smoothly interpolate towards mouse parallax offset
        camera.position.x += ((driftX + mouseTargetRef.current.x * 5.5) - camera.position.x) * 0.04;
        camera.position.y += ((driftY - mouseTargetRef.current.y * 2.8) - camera.position.y) * 0.04;
        camera.position.z += (driftZ - camera.position.z) * 0.04;

        camera.lookAt(8 + mouseTargetRef.current.x * 2.0, 0, -6);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 6. Responsive Window Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    // 7. Mouse Movement Handler for Parallax
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseTargetRef.current = { x, y };
    };

    window.addEventListener('resize', handleResize);
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      oceanGeometry.dispose();
      customMaterial.dispose();
    };
  }, [cameraDrift]);

  // Sync intensity controls with shader uniforms
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_waveIntensity.value = waveIntensity;
      materialRef.current.uniforms.u_oilSpread.value = oilSpread;
    }
  }, [waveIntensity, oilSpread]);

  return (
    <div className="relative w-full h-full min-h-[560px] lg:min-h-[660px] overflow-hidden bg-[#0A1A2E]">
      {/* Three.js 3D Natural Blue Ocean & Oil Slick WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-crosshair" />

      {/* Balanced Vignette: Preserves Left Typography Legibility Without Blacking Out the Natural Blue Ocean */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-[#06121f]/75 via-[#071526]/25 to-transparent" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent opacity-80" />
    </div>
  );
}

