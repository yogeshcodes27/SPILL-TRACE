/**
 * SPILLTRACE — Canonical Scenario Data
 * 
 * Five deterministic synthetic scenarios as defined in 04_DATASETS_AND_DATA_COLLECTION.md (§15–19).
 * Each scenario provides the complete data chain: scene → spill → drift → AIS → evidence.
 * All data is explicitly labelled as synthetic/demo.
 */
import { DATA_STATUS, CLASSIFICATION, PRIORITY, DISCLAIMER } from './types.js';

// ─── Helper: Generate polygon ring around a centroid ────────────────
function makePolygon(centerLon, centerLat, majorKm, minorKm, orientDeg, points = 24) {
  const ring = [];
  const orientRad = (orientDeg * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const dx = (majorKm / 2) * Math.cos(angle);
    const dy = (minorKm / 2) * Math.sin(angle);
    const rotX = dx * Math.cos(orientRad) - dy * Math.sin(orientRad);
    const rotY = dx * Math.sin(orientRad) + dy * Math.cos(orientRad);
    ring.push([
      centerLon + rotX / (111.32 * Math.cos((centerLat * Math.PI) / 180)),
      centerLat + rotY / 110.574,
    ]);
  }
  return ring;
}

// ─── Helper: Generate AIS track positions ───────────────────────────
function generateTrackPositions(startLat, startLon, heading, speedKn, startTime, count, gapStart, gapEnd) {
  const positions = [];
  const headingRad = (heading * Math.PI) / 180;
  const speedDegPerHour = speedKn / 60; // approx degrees per hour
  const dt = new Date(startTime);
  for (let i = 0; i < count; i++) {
    const hours = i * 0.5; // 30-minute intervals
    const lat = startLat + hours * speedDegPerHour * Math.cos(headingRad);
    const lon = startLon + hours * speedDegPerHour * Math.sin(headingRad) / Math.cos((startLat * Math.PI) / 180);
    const t = new Date(dt.getTime() + hours * 3600000);
    const isGap = gapStart && gapEnd && t >= new Date(gapStart) && t <= new Date(gapEnd);
    positions.push({
      lat: Math.round(lat * 1000) / 1000,
      lon: Math.round(lon * 1000) / 1000,
      sog: isGap ? 0 : speedKn + (Math.sin(i * 0.7) * 0.5),
      cog: heading + (Math.sin(i * 0.3) * 2),
      timestamp: t.toISOString(),
      isGap,
    });
  }
  return positions;
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 1: Single Clear Candidate (SYN-001)
// ═══════════════════════════════════════════════════════════════════════
const scenario1 = {
  id: 'SYN-001',
  name: 'Single Clear Candidate',
  description: 'One vessel with high spatio-temporal and trajectory correlation. Clear association expected.',
  expectedOutcome: 'SYN001 identified as high-priority candidate vessel.',

  scene: {
    sceneId: 'S1A_IW_GRDH_20260618_064200',
    sensor: 'Sentinel-1 C-SAR',
    agency: 'ESA',
    acquisitionTime: '2026-06-18T06:42:00Z',
    orbitDirection: 'DESCENDING',
    polarization: 'VV+VH',
    productType: 'GRDH',
    crs: 'EPSG:4326',
    bbox: [79.92, 10.95, 80.45, 11.52],
    resolutionM: 10,
    calibrationStatus: 'CALIBRATED',
    passNumber: 6102,
    validation: {
      geometryValid: true,
      radiometryValid: true,
      coverageComplete: true,
      noiseFloorDb: -22.4,
    },
  },

  spill: {
    spillId: 'SPL-SYN001-A',
    polygon: makePolygon(80.184, 11.238, 6.42, 1.8, 298.4),
    areaKm2: 12.6,
    perimeterKm: 18.4,
    centroid: [80.184, 11.238],
    majorAxisKm: 6.42,
    minorAxisKm: 1.8,
    orientationDeg: 298.4,
    compactness: 0.47,
    aspectRatio: 3.57,
    confidence: 0.964,
    classification: CLASSIFICATION.MINERAL_OIL,
    lookAlikeScores: {
      mineralOil: 0.914,
      lowWindCalm: 0.052,
      shipWake: 0.021,
      biogenic: 0.013,
    },
  },

  forcing: {
    source: 'CMEMS + ERA5',
    windSpeedKn: 14.2,
    windDirectionDeg: 225,
    currentSpeedMs: 0.35,
    currentDirectionDeg: 118,
    stokesDriftMs: 0.04,
    timestamp: '2026-06-18T06:00:00Z',
  },

  drift: {
    backward: {
      runId: 'DRF-SYN001-BWD',
      direction: 'backward',
      durationHours: 12,
      particleCount: 1000,
      originRegion: makePolygon(80.088, 11.162, 2.8, 2.2, 310, 12),
      originCentroid: [80.088, 11.162],
      originRadiusKm: 2.8,
      releaseWindowStart: '17 JUN · 20:00 UTC',
      releaseWindowEnd: '18 JUN · 02:00 UTC',
      driftDistanceNm: 16.8,
      forcing: { windSpeedKn: 14.2, windDirectionDeg: 225, currentSpeedMs: 0.35, currentDirectionDeg: 118 },
    },
    forward: {
      runId: 'DRF-SYN001-FWD',
      direction: 'forward',
      durationHours: 48,
      particleCount: 500,
      forwardEnvelope: makePolygon(80.280, 11.310, 12, 6, 298, 16),
      forcing: { windSpeedKn: 14.2, windDirectionDeg: 225, currentSpeedMs: 0.35, currentDirectionDeg: 118 },
    },
  },

  aisTraffic: {
    summary: { vesselsInRegion: 27, temporalMatches: 8, spatialMatches: 5, candidates: 3 },
    tracks: [
      {
        mmsi: '419001001',
        vesselName: 'PACIFIC HORIZON',
        vesselType: 'CARGO VESSEL',
        flag: 'SG',
        lengthM: 189,
        beamM: 28,
        positions: generateTrackPositions(11.02, 80.01, 38, 12.4, '2026-06-17T18:00:00Z', 24),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '419002002',
        vesselName: 'EASTERN SPIRIT',
        vesselType: 'BULK CARRIER',
        flag: 'PA',
        lengthM: 225,
        beamM: 32,
        positions: generateTrackPositions(11.45, 80.28, 215, 9.2, '2026-06-17T16:00:00Z', 28),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '419003003',
        vesselName: 'CORAL TIDE',
        vesselType: 'PRODUCT TANKER',
        flag: 'LR',
        lengthM: 175,
        beamM: 26,
        positions: generateTrackPositions(11.15, 80.35, 300, 8.5, '2026-06-18T01:00:00Z', 20),
        hasAisGap: false,
        aisGap: null,
      },
    ],
  },

  evidence: [
    {
      mmsi: '419001001',
      vesselName: 'PACIFIC HORIZON',
      spatialCompatibility: 92,
      temporalCompatibility: 88,
      trajectoryCompatibility: 91,
      aisContinuity: 96,
      environmentalConsistency: 81,
      overallScore: 87,
      rankStability: 94,
      priority: PRIORITY.HIGH,
      reasons: [
        'Trajectory intersects the reconstructed origin region.',
        'Recorded position falls within the estimated release window.',
        'Observed heading is compatible with the reconstructed drift direction.',
        'AIS coverage is continuous across the relevant investigation window.',
      ],
    },
    {
      mmsi: '419002002',
      vesselName: 'EASTERN SPIRIT',
      spatialCompatibility: 61,
      temporalCompatibility: 72,
      trajectoryCompatibility: 45,
      aisContinuity: 98,
      environmentalConsistency: 58,
      overallScore: 62,
      rankStability: 5,
      priority: PRIORITY.LOW,
      reasons: [
        'Trajectory passes near the origin region but course diverges by > 30°.',
        'Temporal proximity is moderate but heading is inconsistent.',
      ],
    },
    {
      mmsi: '419003003',
      vesselName: 'CORAL TIDE',
      spatialCompatibility: 44,
      temporalCompatibility: 38,
      trajectoryCompatibility: 52,
      aisContinuity: 95,
      environmentalConsistency: 41,
      overallScore: 46,
      rankStability: 1,
      priority: PRIORITY.LOW,
      reasons: [
        'Vessel entered the region after the estimated release window.',
        'Spatial proximity is marginal; trajectory is counter-directional.',
      ],
    },
  ],

  report: {
    incidentId: 'INC-SYN-001',
    detectionTime: '18 JUN 2026 · 06:42 UTC',
    spillArea: '12.6 km²',
    estimatedOrigin: '17 JUN 2026 · 20:00–02:00 UTC',
    candidateCount: 3,
    findings: [
      { step: '01', title: 'Spill Detection', desc: 'A candidate oil-spill signature was detected in the SAR scene and separated from evaluated look-alike conditions.' },
      { step: '02', title: 'Slick Characterisation', desc: 'The detected region was converted into a measurable spatial geometry for downstream analysis.' },
      { step: '03', title: 'Origin Reconstruction', desc: 'Backward drift reconstruction produced an estimated origin region under the selected environmental forcing conditions.' },
      { step: '04', title: 'AIS Correlation', desc: 'AIS trajectories were evaluated against the reconstructed origin region and estimated release window.' },
      { step: '05', title: 'Candidate Association', desc: 'Candidate vessels were ranked using explainable spatial, temporal, trajectory, AIS-continuity and environmental-consistency factors.' },
    ],
  },

  provenance: {
    datasetSource: 'Synthetic Generator v1.0',
    modelVersion: 'SPILLTRACE-PROTO-1.0',
    processedAt: '2026-06-18T07:30:00Z',
    seed: 'SYN001-SEED-42',
    dataStatus: DATA_STATUS.SYNTHETIC,
    disclaimer: DISCLAIMER,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 2: Dense Traffic (SYN-002)
// ═══════════════════════════════════════════════════════════════════════
const scenario2 = {
  id: 'SYN-002',
  name: 'Dense Traffic',
  description: 'Source vessel among 5 nearby vessels with crossing tracks. Tests trajectory discrimination.',
  expectedOutcome: 'System must distinguish spatio-temporally consistent from merely nearby.',

  scene: {
    sceneId: 'S1A_IW_GRDH_20260615_111800',
    sensor: 'Sentinel-1 C-SAR',
    agency: 'ESA',
    acquisitionTime: '2026-06-15T11:18:00Z',
    orbitDirection: 'ASCENDING',
    polarization: 'VV+VH',
    productType: 'GRDH',
    crs: 'EPSG:4326',
    bbox: [69.5, 17.8, 70.7, 19.0],
    resolutionM: 10,
    calibrationStatus: 'CALIBRATED',
    passNumber: 5981,
    validation: {
      geometryValid: true,
      radiometryValid: true,
      coverageComplete: true,
      noiseFloorDb: -21.8,
    },
  },

  spill: {
    spillId: 'SPL-SYN002-A',
    polygon: makePolygon(70.114, 18.421, 3.1, 1.4, 142.1),
    areaKm2: 4.2,
    perimeterKm: 10.8,
    centroid: [70.114, 18.421],
    majorAxisKm: 3.10,
    minorAxisKm: 1.4,
    orientationDeg: 142.1,
    compactness: 0.45,
    aspectRatio: 2.21,
    confidence: 0.921,
    classification: CLASSIFICATION.MINERAL_OIL,
    lookAlikeScores: {
      mineralOil: 0.882,
      lowWindCalm: 0.068,
      shipWake: 0.032,
      biogenic: 0.018,
    },
  },

  forcing: {
    source: 'CMEMS + ERA5',
    windSpeedKn: 9.8,
    windDirectionDeg: 190,
    currentSpeedMs: 0.28,
    currentDirectionDeg: 95,
    stokesDriftMs: 0.03,
    timestamp: '2026-06-15T11:00:00Z',
  },

  drift: {
    backward: {
      runId: 'DRF-SYN002-BWD',
      direction: 'backward',
      durationHours: 8,
      particleCount: 1000,
      originRegion: makePolygon(70.08, 18.46, 3.5, 2.8, 150, 12),
      originCentroid: [70.08, 18.46],
      originRadiusKm: 3.5,
      releaseWindowStart: '15 JUN · 03:00 UTC',
      releaseWindowEnd: '15 JUN · 07:00 UTC',
      driftDistanceNm: 8.4,
      forcing: { windSpeedKn: 9.8, windDirectionDeg: 190, currentSpeedMs: 0.28, currentDirectionDeg: 95 },
    },
    forward: {
      runId: 'DRF-SYN002-FWD',
      direction: 'forward',
      durationHours: 24,
      particleCount: 500,
      forwardEnvelope: makePolygon(70.18, 18.38, 8, 4, 142, 16),
      forcing: { windSpeedKn: 9.8, windDirectionDeg: 190, currentSpeedMs: 0.28, currentDirectionDeg: 95 },
    },
  },

  aisTraffic: {
    summary: { vesselsInRegion: 42, temporalMatches: 14, spatialMatches: 9, candidates: 5 },
    tracks: [
      {
        mmsi: '538001001',
        vesselName: 'MUMBAI CARRIER',
        vesselType: 'CRUDE OIL TANKER',
        flag: 'IN',
        lengthM: 245,
        beamM: 42,
        positions: generateTrackPositions(18.52, 69.95, 142, 10.4, '2026-06-15T01:00:00Z', 22),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '538002002',
        vesselName: 'ARABIAN STAR',
        vesselType: 'BULK CARRIER',
        flag: 'PA',
        lengthM: 200,
        beamM: 32,
        positions: generateTrackPositions(18.60, 70.00, 160, 9.1, '2026-06-15T00:00:00Z', 24),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '538003003',
        vesselName: 'WESTERN PEARL',
        vesselType: 'CONTAINER SHIP',
        flag: 'LR',
        lengthM: 280,
        beamM: 38,
        positions: generateTrackPositions(18.30, 70.20, 310, 14.2, '2026-06-14T22:00:00Z', 30),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '538004004',
        vesselName: 'COASTAL EXPRESS',
        vesselType: 'GENERAL CARGO',
        flag: 'IN',
        lengthM: 120,
        beamM: 18,
        positions: generateTrackPositions(18.48, 70.10, 85, 7.8, '2026-06-15T02:00:00Z', 20),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '538005005',
        vesselName: 'DEEP OCEAN VII',
        vesselType: 'CHEMICAL TANKER',
        flag: 'MH',
        lengthM: 170,
        beamM: 24,
        positions: generateTrackPositions(18.40, 70.05, 200, 8.9, '2026-06-15T03:00:00Z', 18),
        hasAisGap: false,
        aisGap: null,
      },
    ],
  },

  evidence: [
    {
      mmsi: '538001001',
      vesselName: 'MUMBAI CARRIER',
      spatialCompatibility: 88,
      temporalCompatibility: 84,
      trajectoryCompatibility: 86,
      aisContinuity: 94,
      environmentalConsistency: 78,
      overallScore: 84,
      rankStability: 72,
      priority: PRIORITY.HIGH,
      reasons: [
        'Trajectory passes through the reconstructed origin region.',
        'Temporal overlap with the estimated release window is strong.',
        'Course heading aligns with slick major axis orientation.',
      ],
    },
    {
      mmsi: '538002002',
      vesselName: 'ARABIAN STAR',
      spatialCompatibility: 79,
      temporalCompatibility: 76,
      trajectoryCompatibility: 71,
      aisContinuity: 96,
      environmentalConsistency: 72,
      overallScore: 76,
      rankStability: 22,
      priority: PRIORITY.MODERATE,
      reasons: [
        'Trajectory is near the origin region with partial temporal overlap.',
        'Course diverges by ~18° from the slick orientation.',
      ],
    },
    {
      mmsi: '538003003',
      vesselName: 'WESTERN PEARL',
      spatialCompatibility: 52,
      temporalCompatibility: 68,
      trajectoryCompatibility: 34,
      aisContinuity: 99,
      environmentalConsistency: 55,
      overallScore: 56,
      rankStability: 4,
      priority: PRIORITY.LOW,
      reasons: [
        'Vessel was transiting in the opposite direction.',
        'Spatial proximity is coincidental, not trajectory-consistent.',
      ],
    },
    {
      mmsi: '538004004',
      vesselName: 'COASTAL EXPRESS',
      spatialCompatibility: 65,
      temporalCompatibility: 59,
      trajectoryCompatibility: 42,
      aisContinuity: 92,
      environmentalConsistency: 48,
      overallScore: 57,
      rankStability: 2,
      priority: PRIORITY.LOW,
      reasons: [
        'East-west course is perpendicular to slick major axis.',
        'Temporal proximity is moderate.',
      ],
    },
    {
      mmsi: '538005005',
      vesselName: 'DEEP OCEAN VII',
      spatialCompatibility: 74,
      temporalCompatibility: 81,
      trajectoryCompatibility: 68,
      aisContinuity: 91,
      environmentalConsistency: 70,
      overallScore: 74,
      rankStability: 18,
      priority: PRIORITY.MODERATE,
      reasons: [
        'Spatial and temporal proximity to origin region.',
        'Southward heading is partially consistent with slick orientation.',
      ],
    },
  ],

  report: {
    incidentId: 'INC-SYN-002',
    detectionTime: '15 JUN 2026 · 11:18 UTC',
    spillArea: '4.2 km²',
    estimatedOrigin: '15 JUN 2026 · 03:00–07:00 UTC',
    candidateCount: 5,
    findings: [
      { step: '01', title: 'Spill Detection', desc: 'A candidate oil-spill signature was detected in a dense traffic zone within the Arabian Sea.' },
      { step: '02', title: 'Slick Characterisation', desc: 'Slick geometry was extracted and characterized among multiple proximate vessel wake signatures.' },
      { step: '03', title: 'Origin Reconstruction', desc: 'Backward drift reconstruction produced a broader origin region due to moderate environmental forcing.' },
      { step: '04', title: 'AIS Correlation', desc: 'Multiple vessel trajectories intersect the origin region, requiring trajectory discrimination.' },
      { step: '05', title: 'Candidate Association', desc: 'Ranked 5 candidates; the top candidate shows the strongest trajectory alignment but competing evidence exists.' },
    ],
  },

  provenance: {
    datasetSource: 'Synthetic Generator v1.0',
    modelVersion: 'SPILLTRACE-PROTO-1.0',
    processedAt: '2026-06-15T12:30:00Z',
    seed: 'SYN002-SEED-73',
    dataStatus: DATA_STATUS.SYNTHETIC,
    disclaimer: DISCLAIMER,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 3: AIS Gap Anomaly (SYN-003)
// ═══════════════════════════════════════════════════════════════════════
const scenario3 = {
  id: 'SYN-003',
  name: 'AIS Gap Anomaly',
  description: 'Source vessel has an AIS transmission gap during transit through the origin window. Gap ≠ guilt.',
  expectedOutcome: 'AIS gap flagged as contextual evidence, not automatic conclusion of illegal discharge.',

  scene: {
    sceneId: 'RS2_SCAN_20260609_043100',
    sensor: 'Radarsat-2',
    agency: 'MDA',
    acquisitionTime: '2026-06-09T04:31:00Z',
    orbitDirection: 'DESCENDING',
    polarization: 'HH',
    productType: 'ScanSAR',
    crs: 'EPSG:4326',
    bbox: [57.2, 23.8, 58.5, 24.8],
    resolutionM: 25,
    calibrationStatus: 'CALIBRATED',
    passNumber: 4422,
    validation: {
      geometryValid: true,
      radiometryValid: true,
      coverageComplete: true,
      noiseFloorDb: -19.6,
    },
  },

  spill: {
    spillId: 'SPL-SYN003-A',
    polygon: makePolygon(57.852, 24.305, 8.9, 2.4, 312.0),
    areaKm2: 7.31,
    perimeterKm: 22.6,
    centroid: [57.852, 24.305],
    majorAxisKm: 8.90,
    minorAxisKm: 2.4,
    orientationDeg: 312.0,
    compactness: 0.18,
    aspectRatio: 3.71,
    confidence: 0.948,
    classification: CLASSIFICATION.MINERAL_OIL,
    lookAlikeScores: {
      mineralOil: 0.926,
      lowWindCalm: 0.038,
      shipWake: 0.024,
      biogenic: 0.012,
    },
  },

  forcing: {
    source: 'CMEMS Persian Gulf + ERA5',
    windSpeedKn: 18.4,
    windDirectionDeg: 340,
    currentSpeedMs: 0.42,
    currentDirectionDeg: 132,
    stokesDriftMs: 0.06,
    timestamp: '2026-06-09T04:00:00Z',
  },

  drift: {
    backward: {
      runId: 'DRF-SYN003-BWD',
      direction: 'backward',
      durationHours: 18,
      particleCount: 1000,
      originRegion: makePolygon(57.80, 24.38, 4.2, 3.0, 320, 12),
      originCentroid: [57.80, 24.38],
      originRadiusKm: 4.2,
      releaseWindowStart: '08 JUN · 10:00 UTC',
      releaseWindowEnd: '08 JUN · 18:00 UTC',
      driftDistanceNm: 22.4,
      forcing: { windSpeedKn: 18.4, windDirectionDeg: 340, currentSpeedMs: 0.42, currentDirectionDeg: 132 },
    },
    forward: {
      runId: 'DRF-SYN003-FWD',
      direction: 'forward',
      durationHours: 48,
      particleCount: 500,
      forwardEnvelope: makePolygon(57.92, 24.22, 18, 8, 312, 16),
      forcing: { windSpeedKn: 18.4, windDirectionDeg: 340, currentSpeedMs: 0.42, currentDirectionDeg: 132 },
    },
  },

  aisTraffic: {
    summary: { vesselsInRegion: 35, temporalMatches: 11, spatialMatches: 6, candidates: 3 },
    tracks: [
      {
        mmsi: '636001001',
        vesselName: 'GULF NAVIGATOR',
        vesselType: 'PRODUCT TANKER',
        flag: 'OM',
        lengthM: 195,
        beamM: 30,
        positions: generateTrackPositions(24.42, 57.72, 132, 12.1, '2026-06-08T06:00:00Z', 28,
          '2026-06-08T12:00:00Z', '2026-06-08T15:30:00Z'),
        hasAisGap: true,
        aisGap: {
          start: '2026-06-08T12:00:00Z',
          end: '2026-06-08T15:30:00Z',
          durationMinutes: 210,
        },
      },
      {
        mmsi: '636002002',
        vesselName: 'STRAIT PASSAGE',
        vesselType: 'CRUDE OIL TANKER',
        flag: 'PA',
        lengthM: 330,
        beamM: 58,
        positions: generateTrackPositions(24.50, 57.60, 110, 10.8, '2026-06-08T08:00:00Z', 24),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '636003003',
        vesselName: 'HORMUZ TRADER',
        vesselType: 'CHEMICAL TANKER',
        flag: 'AE',
        lengthM: 160,
        beamM: 24,
        positions: generateTrackPositions(24.25, 57.90, 290, 9.4, '2026-06-08T14:00:00Z', 20),
        hasAisGap: false,
        aisGap: null,
      },
    ],
  },

  evidence: [
    {
      mmsi: '636001001',
      vesselName: 'GULF NAVIGATOR',
      spatialCompatibility: 86,
      temporalCompatibility: 82,
      trajectoryCompatibility: 84,
      aisContinuity: 54,
      environmentalConsistency: 79,
      overallScore: 78,
      rankStability: 81,
      priority: PRIORITY.HIGH,
      reasons: [
        'Trajectory intersects the reconstructed origin region.',
        'AIS transmission gap of 210 minutes overlaps the estimated release window.',
        'AIS gap is flagged as contextual evidence; it does not confirm discharge.',
        'Pre- and post-gap positions are consistent with transit through origin.',
      ],
    },
    {
      mmsi: '636002002',
      vesselName: 'STRAIT PASSAGE',
      spatialCompatibility: 71,
      temporalCompatibility: 68,
      trajectoryCompatibility: 62,
      aisContinuity: 97,
      environmentalConsistency: 65,
      overallScore: 70,
      rankStability: 14,
      priority: PRIORITY.MODERATE,
      reasons: [
        'Large tanker transiting near the origin region.',
        'Continuous AIS provides good data quality but trajectory diverges.',
      ],
    },
    {
      mmsi: '636003003',
      vesselName: 'HORMUZ TRADER',
      spatialCompatibility: 48,
      temporalCompatibility: 55,
      trajectoryCompatibility: 38,
      aisContinuity: 94,
      environmentalConsistency: 44,
      overallScore: 50,
      rankStability: 5,
      priority: PRIORITY.LOW,
      reasons: [
        'Vessel entered the region after the primary release window.',
        'Westward heading is counter-directional to slick orientation.',
      ],
    },
  ],

  report: {
    incidentId: 'INC-SYN-003',
    detectionTime: '09 JUN 2026 · 04:31 UTC',
    spillArea: '7.31 km²',
    estimatedOrigin: '08 JUN 2026 · 10:00–18:00 UTC',
    candidateCount: 3,
    findings: [
      { step: '01', title: 'Spill Detection', desc: 'A candidate hydrocarbon plume was detected in the Gulf of Oman approach.' },
      { step: '02', title: 'Slick Characterisation', desc: 'Heavy sheen core with elongated major axis along tanker transit corridor.' },
      { step: '03', title: 'Origin Reconstruction', desc: 'Backward drift under strong Shamal-type winds produced a broader origin uncertainty region.' },
      { step: '04', title: 'AIS Correlation', desc: 'One candidate vessel exhibits an AIS transmission gap overlapping the release window.' },
      { step: '05', title: 'Candidate Association', desc: 'AIS gap is reported as contextual evidence. It does not constitute proof of discharge.' },
    ],
  },

  provenance: {
    datasetSource: 'Synthetic Generator v1.0',
    modelVersion: 'SPILLTRACE-PROTO-1.0',
    processedAt: '2026-06-09T06:00:00Z',
    seed: 'SYN003-SEED-88',
    dataStatus: DATA_STATUS.SYNTHETIC,
    disclaimer: DISCLAIMER,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 4: No Matching Vessel (SYN-004)
// ═══════════════════════════════════════════════════════════════════════
const scenario4 = {
  id: 'SYN-004',
  name: 'No Matching Vessel',
  description: 'Legitimate spill whose origin has no vessel in the AIS dataset. Important abstention test.',
  expectedOutcome: 'No sufficiently consistent candidate found. System must abstain from false attribution.',

  scene: {
    sceneId: 'S1A_IW_GRDH_20260604_220500',
    sensor: 'Sentinel-1 C-SAR',
    agency: 'ESA',
    acquisitionTime: '2026-06-04T22:05:00Z',
    orbitDirection: 'DESCENDING',
    polarization: 'VV',
    productType: 'GRDH',
    crs: 'EPSG:4326',
    bbox: [99.6, 2.6, 100.8, 3.7],
    resolutionM: 10,
    calibrationStatus: 'CALIBRATED',
    passNumber: 5844,
    validation: {
      geometryValid: true,
      radiometryValid: true,
      coverageComplete: true,
      noiseFloorDb: -23.1,
    },
  },

  spill: {
    spillId: 'SPL-SYN004-A',
    polygon: makePolygon(100.220, 3.150, 2.4, 1.1, 118.5),
    areaKm2: 1.88,
    perimeterKm: 7.2,
    centroid: [100.220, 3.150],
    majorAxisKm: 2.40,
    minorAxisKm: 1.1,
    orientationDeg: 118.5,
    compactness: 0.46,
    aspectRatio: 2.18,
    confidence: 0.908,
    classification: CLASSIFICATION.MINERAL_OIL,
    lookAlikeScores: {
      mineralOil: 0.872,
      lowWindCalm: 0.078,
      shipWake: 0.034,
      biogenic: 0.016,
    },
  },

  forcing: {
    source: 'CMEMS + ERA5',
    windSpeedKn: 6.8,
    windDirectionDeg: 160,
    currentSpeedMs: 0.22,
    currentDirectionDeg: 300,
    stokesDriftMs: 0.02,
    timestamp: '2026-06-04T22:00:00Z',
  },

  drift: {
    backward: {
      runId: 'DRF-SYN004-BWD',
      direction: 'backward',
      durationHours: 10,
      particleCount: 1000,
      originRegion: makePolygon(100.18, 3.18, 2.0, 1.6, 120, 12),
      originCentroid: [100.18, 3.18],
      originRadiusKm: 2.0,
      releaseWindowStart: '04 JUN · 12:00 UTC',
      releaseWindowEnd: '04 JUN · 18:00 UTC',
      driftDistanceNm: 5.2,
      forcing: { windSpeedKn: 6.8, windDirectionDeg: 160, currentSpeedMs: 0.22, currentDirectionDeg: 300 },
    },
    forward: {
      runId: 'DRF-SYN004-FWD',
      direction: 'forward',
      durationHours: 24,
      particleCount: 500,
      forwardEnvelope: makePolygon(100.28, 3.12, 5, 3, 118, 16),
      forcing: { windSpeedKn: 6.8, windDirectionDeg: 160, currentSpeedMs: 0.22, currentDirectionDeg: 300 },
    },
  },

  aisTraffic: {
    summary: { vesselsInRegion: 18, temporalMatches: 3, spatialMatches: 1, candidates: 0 },
    tracks: [
      {
        mmsi: '525001001',
        vesselName: 'STRAIT LINER',
        vesselType: 'CONTAINER SHIP',
        flag: 'SG',
        lengthM: 260,
        beamM: 36,
        positions: generateTrackPositions(3.30, 100.40, 310, 16.2, '2026-06-04T18:00:00Z', 16),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '525002002',
        vesselName: 'MALACCA FEEDER',
        vesselType: 'GENERAL CARGO',
        flag: 'MY',
        lengthM: 90,
        beamM: 14,
        positions: generateTrackPositions(3.05, 100.10, 135, 6.5, '2026-06-04T20:00:00Z', 12),
        hasAisGap: false,
        aisGap: null,
      },
    ],
  },

  evidence: [
    {
      mmsi: '525001001',
      vesselName: 'STRAIT LINER',
      spatialCompatibility: 28,
      temporalCompatibility: 35,
      trajectoryCompatibility: 22,
      aisContinuity: 98,
      environmentalConsistency: 30,
      overallScore: 29,
      rankStability: 0,
      priority: PRIORITY.NONE,
      reasons: [
        'Vessel was transiting well outside the reconstructed origin region.',
        'No spatial, temporal, or trajectory consistency with the spill origin.',
      ],
    },
    {
      mmsi: '525002002',
      vesselName: 'MALACCA FEEDER',
      spatialCompatibility: 32,
      temporalCompatibility: 41,
      trajectoryCompatibility: 18,
      aisContinuity: 95,
      environmentalConsistency: 26,
      overallScore: 31,
      rankStability: 0,
      priority: PRIORITY.NONE,
      reasons: [
        'Small coastal vessel entered the area after the estimated release window.',
        'Evidence score is below the minimum threshold for candidate consideration.',
      ],
    },
  ],

  report: {
    incidentId: 'INC-SYN-004',
    detectionTime: '04 JUN 2026 · 22:05 UTC',
    spillArea: '1.88 km²',
    estimatedOrigin: '04 JUN 2026 · 12:00–18:00 UTC',
    candidateCount: 0,
    findings: [
      { step: '01', title: 'Spill Detection', desc: 'A candidate oil-spill signature was detected in the Malacca Strait Traffic Separation Scheme.' },
      { step: '02', title: 'Slick Characterisation', desc: 'Relatively compact slick geometry with moderate confidence.' },
      { step: '03', title: 'Origin Reconstruction', desc: 'Backward drift under light wind conditions produced a confined origin region.' },
      { step: '04', title: 'AIS Correlation', desc: 'No AIS-tracked vessel demonstrates sufficient spatio-temporal consistency with the origin.' },
      { step: '05', title: 'Candidate Association', desc: 'No sufficiently consistent candidate found. The system abstains from attribution.' },
    ],
    abstention: true,
    abstentionMessage: 'No sufficiently consistent candidate found. The origin region may correspond to a vessel not transmitting AIS, or the spill may originate from a non-vessel source.',
  },

  provenance: {
    datasetSource: 'Synthetic Generator v1.0',
    modelVersion: 'SPILLTRACE-PROTO-1.0',
    processedAt: '2026-06-04T23:30:00Z',
    seed: 'SYN004-SEED-55',
    dataStatus: DATA_STATUS.SYNTHETIC,
    disclaimer: DISCLAIMER,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO 5: Environmental Uncertainty (SYN-005)
// ═══════════════════════════════════════════════════════════════════════
const scenario5 = {
  id: 'SYN-005',
  name: 'Environmental Uncertainty',
  description: 'Same release tested under multiple forcing perturbations. Measures origin spread and rank stability.',
  expectedOutcome: 'Larger origin uncertainty region and reduced confidence in candidate ranking.',

  scene: {
    sceneId: 'CSK_SCAN_20260828_150000',
    sensor: 'Cosmo-SkyMed',
    agency: 'ASI',
    acquisitionTime: '2026-08-28T15:00:00Z',
    orbitDirection: 'ASCENDING',
    polarization: 'HH',
    productType: 'ScanSAR',
    crs: 'EPSG:4326',
    bbox: [74.5, 9.0, 75.7, 10.2],
    resolutionM: 15,
    calibrationStatus: 'CALIBRATED',
    passNumber: 3301,
    validation: {
      geometryValid: true,
      radiometryValid: true,
      coverageComplete: true,
      noiseFloorDb: -20.2,
    },
  },

  spill: {
    spillId: 'SPL-SYN005-A',
    polygon: makePolygon(75.121, 9.582, 4.5, 2.1, 270.0),
    areaKm2: 3.45,
    perimeterKm: 13.2,
    centroid: [75.121, 9.582],
    majorAxisKm: 4.50,
    minorAxisKm: 2.1,
    orientationDeg: 270.0,
    compactness: 0.25,
    aspectRatio: 2.14,
    confidence: 0.885,
    classification: CLASSIFICATION.MINERAL_OIL,
    lookAlikeScores: {
      mineralOil: 0.842,
      lowWindCalm: 0.092,
      shipWake: 0.042,
      biogenic: 0.024,
    },
  },

  forcing: {
    source: 'CMEMS + ERA5',
    windSpeedKn: 12.5,
    windDirectionDeg: 280,
    currentSpeedMs: 0.31,
    currentDirectionDeg: 180,
    stokesDriftMs: 0.04,
    timestamp: '2026-08-28T15:00:00Z',
  },

  drift: {
    backward: {
      runId: 'DRF-SYN005-BWD',
      direction: 'backward',
      durationHours: 16,
      particleCount: 2000,
      originRegion: makePolygon(75.06, 9.64, 6.8, 5.2, 275, 12),
      originCentroid: [75.06, 9.64],
      originRadiusKm: 6.8,
      releaseWindowStart: '27 AUG · 23:00 UTC',
      releaseWindowEnd: '28 AUG · 08:00 UTC',
      driftDistanceNm: 14.2,
      forcing: { windSpeedKn: 12.5, windDirectionDeg: 280, currentSpeedMs: 0.31, currentDirectionDeg: 180 },
    },
    forward: {
      runId: 'DRF-SYN005-FWD',
      direction: 'forward',
      durationHours: 48,
      particleCount: 1000,
      forwardEnvelope: makePolygon(75.20, 9.52, 14, 8, 270, 16),
      forcing: { windSpeedKn: 12.5, windDirectionDeg: 280, currentSpeedMs: 0.31, currentDirectionDeg: 180 },
    },
  },

  ensembleRuns: [
    { label: 'Nominal', windPerturbation: 0, currentPerturbation: 0, originRadiusKm: 4.2, topCandidateScore: 74 },
    { label: 'Wind +20%', windPerturbation: 20, currentPerturbation: 0, originRadiusKm: 5.8, topCandidateScore: 68 },
    { label: 'Wind −20%', windPerturbation: -20, currentPerturbation: 0, originRadiusKm: 5.1, topCandidateScore: 71 },
    { label: 'Current +30%', windPerturbation: 0, currentPerturbation: 30, originRadiusKm: 6.4, topCandidateScore: 65 },
    { label: 'Current −30%', windPerturbation: 0, currentPerturbation: -30, originRadiusKm: 5.6, topCandidateScore: 72 },
    { label: 'Wind +20%, Current +30%', windPerturbation: 20, currentPerturbation: 30, originRadiusKm: 7.8, topCandidateScore: 58 },
    { label: 'Release +2h', windPerturbation: 0, currentPerturbation: 0, originRadiusKm: 5.4, topCandidateScore: 69 },
    { label: 'Release −2h', windPerturbation: 0, currentPerturbation: 0, originRadiusKm: 4.9, topCandidateScore: 73 },
  ],

  aisTraffic: {
    summary: { vesselsInRegion: 22, temporalMatches: 7, spatialMatches: 4, candidates: 2 },
    tracks: [
      {
        mmsi: '477001001',
        vesselName: 'NINE DEGREE',
        vesselType: 'BULK CARRIER',
        flag: 'HK',
        lengthM: 210,
        beamM: 32,
        positions: generateTrackPositions(9.68, 74.95, 180, 10.2, '2026-08-28T01:00:00Z', 26),
        hasAisGap: false,
        aisGap: null,
      },
      {
        mmsi: '477002002',
        vesselName: 'LACCADIVE SUN',
        vesselType: 'GENERAL CARGO',
        flag: 'IN',
        lengthM: 130,
        beamM: 20,
        positions: generateTrackPositions(9.55, 75.20, 260, 7.8, '2026-08-28T05:00:00Z', 20),
        hasAisGap: false,
        aisGap: null,
      },
    ],
  },

  evidence: [
    {
      mmsi: '477001001',
      vesselName: 'NINE DEGREE',
      spatialCompatibility: 72,
      temporalCompatibility: 68,
      trajectoryCompatibility: 64,
      aisContinuity: 93,
      environmentalConsistency: 58,
      overallScore: 68,
      rankStability: 52,
      priority: PRIORITY.MODERATE,
      reasons: [
        'Trajectory passes through the origin region under nominal forcing.',
        'Under wind/current perturbations, the origin region shifts, reducing spatial overlap.',
        'Rank stability is moderate (52%) across ensemble runs.',
      ],
    },
    {
      mmsi: '477002002',
      vesselName: 'LACCADIVE SUN',
      spatialCompatibility: 58,
      temporalCompatibility: 62,
      trajectoryCompatibility: 51,
      aisContinuity: 90,
      environmentalConsistency: 48,
      overallScore: 58,
      rankStability: 38,
      priority: PRIORITY.MODERATE,
      reasons: [
        'Vessel transits near the extended uncertainty region.',
        'Environmental forcing perturbations alter the candidate ranking in 38% of runs.',
      ],
    },
  ],

  report: {
    incidentId: 'INC-SYN-005',
    detectionTime: '28 AUG 2026 · 15:00 UTC',
    spillArea: '3.45 km²',
    estimatedOrigin: '27 AUG · 23:00 – 28 AUG · 08:00 UTC',
    candidateCount: 2,
    findings: [
      { step: '01', title: 'Spill Detection', desc: 'A candidate oil-spill signature was detected in the Lakshadweep Basin.' },
      { step: '02', title: 'Slick Characterisation', desc: 'Moderate-confidence slick with wave weathering evidence.' },
      { step: '03', title: 'Origin Reconstruction', desc: 'Ensemble backward drift under 8 forcing perturbations produced a large origin uncertainty region (6.8 km radius).' },
      { step: '04', title: 'AIS Correlation', desc: 'Two vessels were evaluated; both show moderate consistency that varies across ensemble runs.' },
      { step: '05', title: 'Candidate Association', desc: 'Rank stability is reduced. Environmental uncertainty limits confidence in candidate ordering.' },
    ],
  },

  provenance: {
    datasetSource: 'Synthetic Generator v1.0',
    modelVersion: 'SPILLTRACE-PROTO-1.0',
    processedAt: '2026-08-28T16:30:00Z',
    seed: 'SYN005-SEED-99',
    dataStatus: DATA_STATUS.SYNTHETIC,
    disclaimer: DISCLAIMER,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// EXPORTED SCENARIO MAP
// ═══════════════════════════════════════════════════════════════════════
export const SCENARIOS = {
  'SYN-001': scenario1,
  'SYN-002': scenario2,
  'SYN-003': scenario3,
  'SYN-004': scenario4,
  'SYN-005': scenario5,
};

export const SCENARIO_LIST = [scenario1, scenario2, scenario3, scenario4, scenario5];

export default SCENARIOS;
