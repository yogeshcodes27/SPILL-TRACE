/**
 * SPILLTRACE — Forensic Map Geometry & Generation Services
 * 
 * Geographic projections, coordinate conversions, deterministic SAR simulation,
 * and deterministic segmentation polygon synthesis.
 */

// ─── Simple Seeded Pseudo-Random Number Generator (LCG) ─────────────
export function createPrng(seedStr = 'SPILLTRACE-001') {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  let s = Math.abs(hash) || 123456789;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ─── Coordinate Conversion Helpers ──────────────────────────────────
// GeoJSON coordinates are [lon, lat]. Leaflet requires [lat, lon].
export const toLatLng = (pt) =>
  Array.isArray(pt) && pt.length >= 2 ? [pt[1], pt[0]] : [0, 0];

export const toLatLngs = (ring) =>
  Array.isArray(ring) ? ring.map(toLatLng) : [];

export const bboxToLatLngBounds = (bbox) => {
  if (!Array.isArray(bbox) || bbox.length < 4) return [[0, 0], [0, 0]];
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
};

// Nautical distance helper (Haversine in Nautical Miles)
export function haversineDistanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in NM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Project a geographic coordinate along a bearing (degrees) and distance (km)
export const projectPoint = (centerLat, centerLon, distanceKm, bearingDeg) => {
  if (centerLat == null || centerLon == null || distanceKm == null || bearingDeg == null) {
    return [centerLat || 0, centerLon || 0];
  }
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latKm = 110.574;
  const lonKm = 111.32 * Math.cos((centerLat * Math.PI) / 180) || 111.32;
  const dLat = (distanceKm * Math.cos(bearingRad)) / latKm;
  const dLon = (distanceKm * Math.sin(bearingRad)) / lonKm;
  return [centerLat + dLat, centerLon + dLon];
};

// ─── Major & Minor Axis Geometries ──────────────────────────────────
export function calculateSlickAxes(centroid, majorAxisKm, minorAxisKm, orientationDeg) {
  if (!centroid || centroid.length < 2) return null;
  const [lon, lat] = centroid;
  const halfMajor = (majorAxisKm || 5) / 2;
  const halfMinor = (minorAxisKm || 1.5) / 2;

  // Major axis runs along orientationDeg and (orientationDeg + 180)
  const majorStart = projectPoint(lat, lon, halfMajor, (orientationDeg + 180) % 360);
  const majorEnd = projectPoint(lat, lon, halfMajor, orientationDeg % 360);

  // Minor axis runs perpendicular (orientationDeg + 90) and (orientationDeg - 90)
  const minorStart = projectPoint(lat, lon, halfMinor, (orientationDeg - 90 + 360) % 360);
  const minorEnd = projectPoint(lat, lon, halfMinor, (orientationDeg + 90) % 360);

  return {
    major: [majorStart, majorEnd],
    minor: [minorStart, minorEnd],
  };
}

// ─── Generate Smooth Uncertainty Ellipse ────────────────────────────
export function generateUncertaintyEllipse(centerLon, centerLat, semiMajorKm, semiMinorKm, orientDeg = 0, numPoints = 32) {
  const points = [];
  const orientRad = (orientDeg * Math.PI) / 180;
  const latKm = 110.574;
  const lonKm = 111.32 * Math.cos((centerLat * Math.PI) / 180) || 111.32;

  for (let i = 0; i <= numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const dx = semiMajorKm * Math.cos(angle);
    const dy = semiMinorKm * Math.sin(angle);
    const rotX = dx * Math.cos(orientRad) - dy * Math.sin(orientRad);
    const rotY = dx * Math.sin(orientRad) + dy * Math.cos(orientRad);
    points.push([
      centerLat + rotY / latKm,
      centerLon + rotX / lonKm,
    ]);
  }
  return points;
}

// ─── Deterministic Segmentation Regions (Tab 02) ────────────────────
export function getDeterministicSegmentation(scenario) {
  if (!scenario || !scenario.spill) return [];

  const spill = scenario.spill;
  const [cLon, cLat] = spill.centroid;
  const prng = createPrng(scenario.id || 'SYN-001');

  // 1. Primary Oil Slick
  const regions = [
    {
      id: 'reg-oil',
      type: 'oilSlick',
      label: 'CONFIRMED SLICK',
      confidence: spill.confidence ? `${(spill.confidence * 100).toFixed(1)}%` : '96.4%',
      areaKm2: spill.areaKm2 || 12.6,
      polygon: toLatLngs(spill.polygon),
      centroid: [cLat, cLon],
    },
  ];

  // Extract real look-alike discrimination scores from scenario
  const scores = spill.lookAlikeScores || {};
  const bioScore = scores.biogenic != null ? scores.biogenic : 0.013;
  const wakeScore = scores.shipWake != null ? scores.shipWake : 0.021;
  const calmScore = scores.lowWindCalm != null ? scores.lowWindCalm : 0.052;

  // 2. Look-Alike (Biogenic Film / Algae Bloom) — offset 6-8 km NE
  const lookBearing = 35 + prng() * 20;
  const lookDist = 6.5 + prng() * 2;
  const [lookLat, lookLon] = projectPoint(cLat, cLon, lookDist, lookBearing);
  const lookPoly = generateUncertaintyEllipse(lookLon, lookLat, 2.2, 1.1, 45, 16);
  regions.push({
    id: 'reg-lookalike',
    type: 'lookAlike',
    label: 'BIOGENIC FILM (LOOK-ALIKE)',
    confidence: `FALSE ALARM (${(bioScore * 100).toFixed(1)}%)`,
    areaKm2: 3.4,
    polygon: lookPoly,
    centroid: [lookLat, lookLon],
  });

  // 3. Ship Wake (Turbulent non-spill linear feature) — offset 7 km NW
  const wakeBearing = 310 + prng() * 15;
  const wakeDist = 7.2 + prng() * 2;
  const [wakeLat, wakeLon] = projectPoint(cLat, cLon, wakeDist, wakeBearing);
  const wakePoly = generateUncertaintyEllipse(wakeLon, wakeLat, 3.8, 0.45, 130, 16);
  regions.push({
    id: 'reg-wake',
    type: 'shipWake',
    label: 'SHIP WAKE (NON-POLLUTION)',
    confidence: `REJECTED (${(wakeScore * 100).toFixed(1)}%)`,
    areaKm2: 1.8,
    polygon: wakePoly,
    centroid: [wakeLat, wakeLon],
  });

  // 4. Low-Wind Calm Region — offset 9 km SE
  const calmBearing = 140 + prng() * 20;
  const calmDist = 9.0 + prng() * 2;
  const [calmLat, calmLon] = projectPoint(cLat, cLon, calmDist, calmBearing);
  const calmPoly = generateUncertaintyEllipse(calmLon, calmLat, 4.5, 2.1, 15, 20);
  regions.push({
    id: 'reg-lowwind',
    type: 'lowWindCalm',
    label: 'LOW-WIND CALM REGION',
    confidence: `REJECTED (${(calmScore * 100).toFixed(1)}%)`,
    areaKm2: 7.9,
    polygon: calmPoly,
    centroid: [calmLat, calmLon],
  });

  return regions;
}

// ─── Deterministic Simulated SAR Texture Generator ──────────────────
// Produces a technical radar backscatter image overlay matching Sentinel-1 IW GRD
const sarCache = new Map();

export function generateSimulatedSarOverlay(scenario) {
  if (!scenario || !scenario.scene || !scenario.scene.bbox) return null;

  const key = scenario.id || 'SYN-001';
  if (sarCache.has(key)) return sarCache.get(key);

  const [minLon, minLat, maxLon, maxLat] = scenario.scene.bbox;
  const width = 512;
  const height = 512;

  // Offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const prng = createPrng(key + '-SAR-TEXTURE');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Scenario centroid pixel coordinate
  const spill = scenario.spill;
  const [sLon, sLat] = spill?.centroid || [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  const spillPixelX = Math.round(((sLon - minLon) / (maxLon - minLon)) * width);
  const spillPixelY = Math.round(((maxLat - sLat) / (maxLat - minLat)) * height);

  // Approximate slick radius in pixels
  const spillRadiusX = Math.max(16, Math.round(((spill?.majorAxisKm || 6) / 100) * width));
  const spillRadiusY = Math.max(8, Math.round(((spill?.minorAxisKm || 2) / 100) * height));

  const waveDirRad = ((scenario.forcing?.windDirectionDeg || 225) * Math.PI) / 180;
  const cosW = Math.cos(waveDirRad);
  const sinW = Math.sin(waveDirRad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Base ocean radar backscatter (-15 dB nominal: grayscale ~42)
      let backscatter = 40 + (prng() - 0.5) * 16;

      // Subtle directional Bragg wave modulation
      const wavePhase = (x * cosW + y * sinW) / 14;
      backscatter += Math.sin(wavePhase) * 4;

      // Range falloff (subtle antenna pattern across swath)
      backscatter += (x / width) * 6;

      // Check distance from slick centroid (damped capillary backscatter)
      const dx = (x - spillPixelX) / spillRadiusX;
      const dy = (y - spillPixelY) / spillRadiusY;
      const distSq = dx * dx + dy * dy;

      if (distSq < 1.0) {
        // Core slick: Marangoni capillary wave damping (-24 dB: dark value ~12)
        const damping = Math.exp(-distSq * 2);
        backscatter = backscatter * (1 - 0.72 * damping);
      } else if (distSq < 1.8) {
        // Transition zone
        const edgeDamping = (1.8 - distSq) / 0.8;
        backscatter = backscatter * (1 - 0.45 * edgeDamping);
      }

      // Metallic vessel point returns (bright specular scatter)
      const isShipTarget =
        (Math.abs(x - (spillPixelX - 35)) < 2 && Math.abs(y - (spillPixelY - 25)) < 2) ||
        (Math.abs(x - (spillPixelX + 60)) < 2 && Math.abs(y - (spillPixelY + 40)) < 2);

      if (isShipTarget) {
        backscatter = 240;
      }

      const val = Math.max(6, Math.min(255, Math.round(backscatter)));
      data[idx] = val; // R
      data[idx + 1] = val; // G
      data[idx + 2] = val + 2; // B (very slight cool radar tint)
      data[idx + 3] = 230; // Alpha
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Overlay technical SAR grid ticks and frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Technical corner marks
  const tickLen = 14;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  // Top-left
  ctx.moveTo(10, 10 + tickLen);
  ctx.lineTo(10, 10);
  ctx.lineTo(10 + tickLen, 10);
  // Top-right
  ctx.moveTo(width - 10 - tickLen, 10);
  ctx.lineTo(width - 10, 10);
  ctx.lineTo(width - 10, 10 + tickLen);
  // Bottom-left
  ctx.moveTo(10, height - 10 - tickLen);
  ctx.lineTo(10, height - 10);
  ctx.lineTo(10 + tickLen, height - 10);
  // Bottom-right
  ctx.moveTo(width - 10 - tickLen, height - 10);
  ctx.lineTo(width - 10, height - 10);
  ctx.lineTo(width - 10, height - 10 - tickLen);
  ctx.stroke();

  // Technical sensor watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '10px monospace';
  ctx.fillText('SENTINEL-1 C-SAR // IW_GRDH_1SDV', 16, 24);
  ctx.fillText('SIMULATED RADAR BACKSCATTER (VV+VH)', 16, height - 16);

  const dataUrl = canvas.toDataURL('image/png');
  const result = {
    dataUrl,
    bounds: bboxToLatLngBounds(scenario.scene.bbox),
  };
  sarCache.set(key, result);
  return result;
}
