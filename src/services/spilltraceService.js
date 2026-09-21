/**
 * SPILLTRACE — Service Layer Facade
 * 
 * Async API client that mimics the future FastAPI backend.
 * All methods return Promises resolved with deterministic scenario data.
 * Replace this module's internals with real HTTP calls when the backend is ready.
 */
import { SCENARIOS, SCENARIO_LIST } from './scenariosData.js';
import { DISCLAIMER, PRIORITY } from './types.js';
import { haversineDistanceNm } from './map/mapGeometry.js';

// Simulated network delay (ms)
const LATENCY = 80;
const delay = (ms = LATENCY) => new Promise(r => setTimeout(r, ms));

/**
 * Canonical Mapping: Archive Incidents → Synthetic Scenarios
 * INC-2026-001 through INC-2026-005 map to canonical scenarios SYN-001 through SYN-005.
 * Incidents without a synthesized scenario return null.
 */
export const INCIDENT_TO_SCENARIO_MAP = {
  'INC-2026-001': 'SYN-001',
  'INC-2026-002': 'SYN-002',
  'INC-2026-003': 'SYN-003',
  'INC-2026-004': 'SYN-004',
  'INC-2026-005': 'SYN-005',
};

export const SCENARIO_TO_INCIDENT_MAP = {
  'SYN-001': 'INC-2026-001',
  'SYN-002': 'INC-2026-002',
  'SYN-003': 'INC-2026-003',
  'SYN-004': 'INC-2026-004',
  'SYN-005': 'INC-2026-005',
};

/**
 * Resolve scenario ID for a given incident ID
 * @param {string} incidentId - e.g. 'INC-2026-001'
 * @returns {string|null} - 'SYN-001' or null if unavailable
 */
export function getScenarioIdForIncident(incidentId) {
  if (!incidentId) return null;
  return INCIDENT_TO_SCENARIO_MAP[incidentId] || null;
}

/**
 * Resolve incident ID for a given scenario ID
 * @param {string} scenarioId - e.g. 'SYN-001'
 * @returns {string|null} - 'INC-2026-001' or null
 */
export function getIncidentIdForScenario(scenarioId) {
  if (!scenarioId) return null;
  return SCENARIO_TO_INCIDENT_MAP[scenarioId] || null;
}

/**
 * Get nominal backward drift duration for a scenario
 * @param {string} scenarioId
 * @returns {number} duration in hours
 */
export function getScenarioNominalDuration(scenarioId) {
  const s = SCENARIOS[scenarioId];
  return s?.drift?.backward?.durationHours || 12;
}

/**
 * List all available scenarios / incidents
 */
export async function getIncidents() {
  await delay();
  return SCENARIO_LIST.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    expectedOutcome: s.expectedOutcome,
    scene: s.scene,
    spillArea: s.spill.areaKm2,
    candidateCount: s.evidence.filter(e => e.priority !== 'NONE').length,
    topScore: s.evidence.length > 0 ? Math.max(...s.evidence.map(e => e.overallScore)) : 0,
  }));
}

/**
 * Get full incident / scenario data by ID
 */
export async function getIncidentById(scenarioOrIncidentId) {
  await delay();
  const scenarioId = INCIDENT_TO_SCENARIO_MAP[scenarioOrIncidentId] || scenarioOrIncidentId;
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Scenario ${scenarioOrIncidentId} not found`);
  return scenario;
}

/**
 * Validate a satellite scene
 */
export async function validateScene(scenarioId) {
  await delay();
  const s = SCENARIOS[scenarioId];
  return s ? s.scene : null;
}

/**
 * Run detection and return spill geometry with look-alike scores
 */
export async function runDetection(scenarioId, threshold = 0.5) {
  await delay(120);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;
  return {
    ...s.spill,
    detectionThreshold: threshold,
    passesThreshold: s.spill.confidence >= threshold,
  };
}

/**
 * Characterise slick geometry
 */
export async function characteriseSlick(scenarioId) {
  await delay();
  const s = SCENARIOS[scenarioId];
  return s ? s.spill : null;
}

/**
 * Format timestamp to canonical UTC display: '18 JUN · 00:42 UTC'
 */
function formatUtcTimestamp(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} · ${hh}:${mm} UTC`;
}

/**
 * Run drift simulation — supports backward hindcast and forward forecast
 * Dynamically computes release window, origin radius, and drift distance based on sliders.
 * @param {string} scenarioId
 * @param {Object} params - { direction, durationHours, windFactor, currentFactor }
 */
export async function runDriftSimulation(scenarioId, params = {}) {
  await delay(120);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;

  const direction = params.direction || 'backward';
  const baseDrift = direction === 'backward' ? s.drift.backward : s.drift.forward;

  // Apply perturbations from interactive controls
  const windFactor = typeof params.windFactor === 'number' ? params.windFactor : 1.0;
  const currentFactor = typeof params.currentFactor === 'number' ? params.currentFactor : 1.0;
  const durationHours = typeof params.durationHours === 'number' ? params.durationHours : baseDrift.durationHours;

  // Compute dynamic release time window based on scene acquisition time minus duration
  const acqDate = s.scene?.acquisitionTime ? new Date(s.scene.acquisitionTime) : new Date('2026-06-18T06:42:00Z');
  const centerTimeMs = acqDate.getTime() - durationHours * 3600000;
  const windowHalfMs = 45 * 60 * 1000; // ±45 minute uncertainty interval
  const startDate = new Date(centerTimeMs - windowHalfMs);
  const endDate = new Date(centerTimeMs + windowHalfMs);

  const releaseWindowStart = formatUtcTimestamp(startDate);
  const releaseWindowEnd = formatUtcTimestamp(endDate);

  // Scale origin radius based on duration and wind/current perturbation
  const nominalDuration = baseDrift.durationHours || 12;
  const nominalRadius = baseDrift.originRadiusKm || 3.0;
  const durationRatio = durationHours / nominalDuration;
  const perturbationFactor = 0.5 + 0.5 * Math.max(windFactor, currentFactor);

  const perturbedRadius = nominalRadius * durationRatio * perturbationFactor;
  const nominalDistance = baseDrift.driftDistanceNm || 8.4;
  const perturbedDistance = nominalDistance * durationRatio * ((windFactor + currentFactor) / 2);
  const originUncertaintyKm2 = Math.round(Math.PI * Math.pow(perturbedRadius, 2) * 10) / 10;

  // Dynamically calculate origin centroid along backward drift vector
  let dynamicOriginCentroid = baseDrift.originCentroid;
  let trajectory = baseDrift.trajectory || [];

  if (s.spill?.centroid && baseDrift.originCentroid) {
    const spillLon = s.spill.centroid[0];
    const spillLat = s.spill.centroid[1];
    const nomOriginLon = baseDrift.originCentroid[0];
    const nomOriginLat = baseDrift.originCentroid[1];
    const scale = durationRatio * ((windFactor + currentFactor) / 2);

    const dynamicLon = Math.round((spillLon + (nomOriginLon - spillLon) * scale) * 10000) / 10000;
    const dynamicLat = Math.round((spillLat + (nomOriginLat - spillLat) * scale) * 10000) / 10000;
    dynamicOriginCentroid = [dynamicLon, dynamicLat];

    // Compute intermediate advection trajectory steps
    const steps = 4;
    trajectory = [];
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      trajectory.push([
        Math.round((spillLon + frac * (dynamicLon - spillLon)) * 10000) / 10000,
        Math.round((spillLat + frac * (dynamicLat - spillLat)) * 10000) / 10000,
      ]);
    }
  }

  return {
    ...baseDrift,
    durationHours,
    releaseWindowStart,
    releaseWindowEnd,
    releaseWindowCenterIso: new Date(centerTimeMs).toISOString(),
    originCentroid: dynamicOriginCentroid,
    originRadiusKm: Math.round(perturbedRadius * 10) / 10,
    originUncertaintyKm2,
    driftDistanceNm: Math.round(perturbedDistance * 10) / 10,
    trajectory,
    forcing: {
      ...baseDrift.forcing,
      windSpeedKn: Math.round((baseDrift.forcing.windSpeedKn || 14) * windFactor * 10) / 10,
      currentSpeedMs: Math.round((baseDrift.forcing.currentSpeedMs || 0.6) * currentFactor * 100) / 100,
    },
    perturbation: { windFactor, currentFactor, durationHours },
  };
}

/**
 * Query AIS candidates within origin region and time window
 */
export async function queryAisCandidates(scenarioId, driftResult = null) {
  await delay(80);
  const s = SCENARIOS[scenarioId];
  if (!s) return { summary: {}, tracks: [] };
  return s.aisTraffic;
}

/**
 * Evaluate evidence scores for candidates
 * Cascades drift perturbations, real CPA spatial metrics, and AIS continuity into
 * explainable candidate factors and composite attribution scoring.
 * 
 * @param {string} scenarioId
 * @param {Object|null} driftResult
 * @param {Object|null} aisTraffic
 * @param {Object|null} detection
 * @returns {Promise<Object>} Structured evidence dossier contract (and iterable candidate array)
 */
export async function evaluateEvidenceScores(scenarioId, driftResult = null, aisTraffic = null, detection = null) {
  await delay(80);
  const s = SCENARIOS[scenarioId];
  if (!s) {
    const empty = [];
    empty.candidates = [];
    empty.allContacts = [];
    empty.candidateCount = 0;
    empty.correlationWindow = { start: '—', end: '—' };
    empty.attributionStatus = 'ABSTAINED';
    empty.abstentionReason = 'No scenario loaded';
    return empty;
  }

  const drift = driftResult || s.drift.backward;
  const ais = aisTraffic || s.aisTraffic;
  const tracks = ais?.tracks || [];
  const baseEvidence = s.evidence || [];
  const isSyn004 = scenarioId === 'SYN-004' || s.report?.abstention;

  // Origin centroid and uncertainty
  const originCentroid = drift.originCentroid || s.drift.backward.originCentroid;
  const originRadiusKm = drift.originRadiusKm || 2.0;
  const originRadiusNm = originRadiusKm * 0.539957;

  // Drift perturbations
  const durationHours = drift.durationHours || drift.perturbation?.durationHours || s.drift.backward.durationHours || 12;
  const baseDuration = s.drift.backward.durationHours || 12;
  const durationDiff = Math.abs(durationHours - baseDuration);
  const windFactor = drift.perturbation?.windFactor || 1.0;
  const currentFactor = drift.perturbation?.currentFactor || 1.0;
  const envDiff = Math.abs(windFactor - 1.0) + Math.abs(currentFactor - 1.0);

  // Evaluate each candidate track
  const evaluatedContacts = tracks.map((track) => {
    const baseEv = baseEvidence.find((e) => String(e.mmsi) === String(track.mmsi));
    const positions = track.positions || [];

    // Calculate physical CPA to originCentroid
    let minDistanceNm = 999.0;
    let cpaPos = null;
    let cpaTimestamp = null;
    if (originCentroid && positions.length > 0) {
      for (const pos of positions) {
        if (!pos.isGap) {
          const d = haversineDistanceNm(pos.lat, pos.lon, originCentroid[1], originCentroid[0]);
          if (d < minDistanceNm) {
            minDistanceNm = d;
            cpaPos = pos;
            cpaTimestamp = pos.timestamp;
          }
        }
      }
    }

    if (minDistanceNm === 999.0) {
      minDistanceNm = baseEv?.spatialCompatibility ? (100 - baseEv.spatialCompatibility) * 0.2 : 25.0;
    }

    // 1. Spatial Proximity / Compatibility (0–100)
    const baseSpatial = baseEv ? baseEv.spatialCompatibility : 35;
    let spatialPenalty = 0;
    if (minDistanceNm > originRadiusNm) {
      spatialPenalty = Math.min(45, Math.round((minDistanceNm - originRadiusNm) * 3.5));
    }
    const spatialProximity = isSyn004 ? Math.min(32, baseSpatial) : Math.max(15, Math.min(100, baseSpatial - spatialPenalty));

    // 2. Temporal Compatibility (0–100)
    const baseTemporal = baseEv ? baseEv.temporalCompatibility : 35;
    const temporalPenalty = durationDiff * 2.5;
    const temporalCompatibility = isSyn004 ? Math.min(35, baseTemporal) : Math.max(15, Math.min(100, Math.round(baseTemporal - temporalPenalty)));

    // 3. Drift Consistency (0–100)
    const baseDrift = baseEv ? (baseEv.driftConsistency || baseEv.environmentalConsistency || 75) : 30;
    const driftConsistency = isSyn004 ? Math.min(30, baseDrift) : Math.max(15, Math.min(100, Math.round(baseDrift - envDiff * 15)));

    // 4. Trajectory Consistency (0–100)
    const baseTraj = baseEv ? baseEv.trajectoryCompatibility : 30;
    const trajectoryConsistency = isSyn004 ? Math.min(25, baseTraj) : Math.max(15, Math.min(100, baseTraj));

    // 5. Speed / Course Consistency (0–100)
    const speedCourseConsistency = Math.round((trajectoryConsistency + driftConsistency) / 2);

    // 6. AIS Continuity (0–100)
    let aisContinuity = baseEv ? baseEv.aisContinuity : 98;
    if (track.hasAisGap) {
      // SYN-003: explicit transmission gap penalties
      aisContinuity = 54;
    }

    // 7. Weighted Composite Score (0–100)
    // (Spatial: 25%, Temporal: 25%, Drift: 20%, Trajectory: 15%, AIS: 15%)
    let compositeScore = Math.round(
      0.25 * spatialProximity +
      0.25 * temporalCompatibility +
      0.20 * driftConsistency +
      0.15 * trajectoryConsistency +
      0.15 * aisContinuity
    );

    if (isSyn004) {
      compositeScore = Math.min(32, compositeScore);
    }

    // Determine status and priority
    let priority = PRIORITY.NONE;
    let status = 'EXCLUDED';
    if (!isSyn004) {
      if (compositeScore >= 80) {
        priority = PRIORITY.HIGH;
        status = 'PRIMARY_LEAD';
      } else if (compositeScore >= 60) {
        priority = PRIORITY.MODERATE;
        status = 'CANDIDATE';
      } else if (compositeScore >= 40) {
        priority = PRIORITY.LOW;
        status = 'INVESTIGATIVE_LEAD';
      } else {
        priority = PRIORITY.NONE;
        status = 'EXCLUDED';
      }
    }

    // Rank stability
    let rankStability = baseEv?.rankStability || 0;
    if (scenarioId === 'SYN-005') {
      rankStability = 52; // Ensemble spread causes rank volatility
    } else if (isSyn004) {
      rankStability = 0;
    }

    // Contextual evidence explanations (Why this candidate appears)
    const lastPos = positions[positions.length - 1];
    const heading = lastPos?.cog != null ? lastPos.cog : (track.cog || 0);
    const cpaFormatted = cpaTimestamp ? cpaTimestamp.replace('T', ' ').substring(11, 16) + ' UTC' : 'window';

    const temporalExplanation = temporalCompatibility >= 70
      ? `Vessel transit (${cpaFormatted}) coincides directly with the reconstructed release window (${drift.releaseWindowStart || '17 JUN 20:00'} – ${drift.releaseWindowEnd || '18 JUN 02:00'}).`
      : `Vessel transit (${cpaFormatted}) falls outside the primary estimated release window.`;

    const spatialExplanation = spatialProximity >= 70
      ? `Closest point of approach (${minDistanceNm.toFixed(1)} NM) enters the reconstructed origin uncertainty envelope (${(drift.originUncertaintyKm2 || 15).toFixed(1)} km²).`
      : `Closest point of approach (${minDistanceNm.toFixed(1)} NM) remains peripheral to the reconstructed origin envelope.`;

    const driftExplanation = driftConsistency >= 70
      ? `Observed vessel trajectory aligns with the inferred backward drift corridor and coupled metocean forcing vectors.`
      : `Trajectory angle deviates from the primary Lagrangian hydrodynamic transport corridor.`;

    const trajectoryExplanation = trajectoryConsistency >= 70
      ? `Vessel heading (${heading}° COG) is consistent with the origin-to-slick dispersion geometry.`
      : `Vessel transit heading (${heading}° COG) diverges from the expected discharge dispersion axis.`;

    const aisExplanation = track.hasAisGap
      ? `Contextual AIS transmission gap detected: transponder inactive for ${track.aisGap?.durationMinutes || 204}m (${track.aisGap?.startTime?.substring(11, 16) || '18:15'} → ${track.aisGap?.endTime?.substring(11, 16) || '21:39'} UTC) during corridor transit.`
      : `Continuous AIS transponder transmissions verified across the entire observation window.`;

    const supportingEvidence = [
      temporalExplanation,
      spatialExplanation,
      driftExplanation,
      trajectoryExplanation,
      aisExplanation,
    ];

    return {
      vesselId: track.mmsi,
      mmsi: track.mmsi,
      vesselName: track.vesselName,
      vesselType: track.vesselType,
      flag: track.flag,
      lengthM: track.lengthM,
      beamM: track.beamM,
      compositeScore,
      overallScore: compositeScore, // existing field name
      spatialCompatibility: spatialProximity, // existing field name
      temporalCompatibility, // existing field name
      trajectoryCompatibility: trajectoryConsistency, // existing field name
      aisContinuity, // existing field name
      driftConsistency,
      environmentalConsistency: driftConsistency, // existing field name
      speedCourseConsistency,
      factors: {
        temporalCompatibility,
        spatialProximity,
        driftConsistency,
        trajectoryConsistency,
        speedCourseConsistency,
        aisContinuity,
      },
      factorsDetail: {
        temporal: { score: temporalCompatibility, explanation: temporalExplanation },
        spatial: { score: spatialProximity, cpaNm: minDistanceNm, explanation: spatialExplanation },
        drift: { score: driftConsistency, explanation: driftExplanation },
        trajectory: { score: trajectoryConsistency, explanation: trajectoryExplanation },
        speedCourse: { score: speedCourseConsistency, explanation: `${track.avgSpeedKn || lastPos?.sog || 12} kn @ ${heading}° COG` },
        continuity: {
          score: aisContinuity,
          isGap: !!track.hasAisGap,
          gap: track.aisGap,
          explanation: aisExplanation,
        },
      },
      cpaDistanceNm: minDistanceNm,
      cpaTimestamp,
      rankStability,
      priority,
      status,
      reasons: supportingEvidence, // existing field name
      supportingEvidence,
      uncertainty: {
        originUncertaintyKm2: drift.originUncertaintyKm2 || 15.0,
        confidenceInterval: '95%',
      },
      hasAisGap: !!track.hasAisGap,
      aisGap: track.aisGap,
    };
  });

  // Candidate filtering: only non-excluded candidates
  const validCandidates = isSyn004
    ? []
    : evaluatedContacts
        .filter((c) => c.priority !== PRIORITY.NONE)
        .sort((a, b) => b.compositeScore - a.compositeScore);

  const candidateCount = validCandidates.length;
  const attributionStatus = isSyn004
    ? 'ABSTAINED'
    : (candidateCount > 0 ? 'INVESTIGATIVE_LEAD' : 'ABSTAINED');

  const correlationWindow = {
    start: drift.releaseWindowStart || '—',
    end: drift.releaseWindowEnd || '—',
  };

  const resultCandidates = isSyn004 ? [] : (validCandidates.length > 0 ? validCandidates : evaluatedContacts);

  // Return object that functions both as candidate array and structured contract
  const evidenceContract = Object.assign([...resultCandidates], {
    candidates: resultCandidates,
    allContacts: evaluatedContacts,
    candidateCount,
    correlationWindow,
    attributionStatus,
    abstentionReason: isSyn004
      ? (s.report?.abstentionMessage || 'All available AIS tracks transited outside the release window or beyond spatial proximity limits.')
      : null,
  });

  return evidenceContract;
}

/**
 * Run stability ensemble (for Scenario 5)
 */
export async function runStabilityEnsemble(scenarioId) {
  await delay(150);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;
  return s.ensembleRuns || null;
}

/**
 * Generate complete investigation dossier
 */
export async function generateDossier(scenarioId, dynamicState = {}) {
  await delay(100);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;

  const drift = dynamicState.drift || s.drift.backward;
  const evidence = dynamicState.evidence || s.evidence;
  const candList = evidence?.candidates || (Array.isArray(evidence) ? evidence : []);
  const topCand = (scenarioId === 'SYN-004' || s.report?.abstention) ? null : candList.find(e => e.priority !== PRIORITY.NONE);

  return {
    ...s.report,
    estimatedOrigin: `${drift.releaseWindowStart} – ${drift.releaseWindowEnd}`,
    scene: s.scene,
    spill: s.spill,
    drift: { ...s.drift, backward: drift },
    aisTraffic: s.aisTraffic,
    evidence,
    topCandidate: topCand || null,
    provenance: s.provenance,
  };
}

/**
 * Export investigation data as GeoJSON FeatureCollection
 */
export async function exportGeoJson(scenarioId, dynamicState = {}) {
  await delay(60);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;

  const drift = dynamicState.drift || s.drift.backward;
  const evidence = dynamicState.evidence || s.evidence;

  const features = [];

  // Spill polygon feature
  features.push({
    type: 'Feature',
    properties: {
      featureType: 'spill_polygon',
      spillId: s.spill.spillId,
      areaKm2: s.spill.areaKm2,
      confidence: s.spill.confidence,
      classification: s.spill.classification,
      dataStatus: 'synthetic',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [s.spill.polygon],
    },
  });

  // Origin region feature
  if (drift.originRegion) {
    features.push({
      type: 'Feature',
      properties: {
        featureType: 'origin_region',
        radiusKm: drift.originRadiusKm,
        releaseWindow: `${drift.releaseWindowStart} – ${drift.releaseWindowEnd}`,
        dataStatus: 'synthetic',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [drift.originRegion],
      },
    });
  }

  // AIS track features
  const candList = evidence?.candidates || (Array.isArray(evidence) ? evidence : []);
  s.aisTraffic.tracks.forEach(track => {
    const score = candList.find(e => e.mmsi === track.mmsi);
    features.push({
      type: 'Feature',
      properties: {
        featureType: 'ais_track',
        mmsi: track.mmsi,
        vesselName: track.vesselName,
        vesselType: track.vesselType,
        hasAisGap: track.hasAisGap,
        evidenceScore: score ? score.overallScore : null,
        priority: score ? score.priority : 'NONE',
        dataStatus: 'synthetic',
      },
      geometry: {
        type: 'LineString',
        coordinates: track.positions
          .filter(p => !p.isGap)
          .map(p => [p.lon, p.lat]),
      },
    });
  });

  return {
    type: 'FeatureCollection',
    properties: {
      scenarioId: s.id,
      incidentId: s.report.incidentId,
      disclaimer: DISCLAIMER,
      exportedAt: new Date().toISOString(),
    },
    features,
  };
}

/**
 * Export unmapped incident record as GeoJSON FeatureCollection
 */
export function exportIncidentRecordGeoJson(incident) {
  if (!incident) return null;
  return {
    type: 'FeatureCollection',
    properties: {
      incidentId: incident.id,
      basin: incident.basin,
      detectionTime: incident.detectionTime,
      sensor: incident.sensor,
      area: incident.area,
      status: incident.status,
      disclaimer: DISCLAIMER,
      exportedAt: new Date().toISOString(),
    },
    features: [
      {
        type: 'Feature',
        properties: {
          featureType: 'incident_record',
          id: incident.id,
          basin: incident.basin,
          leadVessel: incident.leadVessel,
          confidence: incident.confidence,
        },
        geometry: {
          type: 'Point',
          coordinates: [incident.lon, incident.lat],
        },
      },
    ],
  };
}
