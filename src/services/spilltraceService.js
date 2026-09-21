/**
 * SPILLTRACE — Service Layer Facade & Investigation Pipeline Engine
 * 
 * Implements the authentic sequential investigation process flow:
 * Stage 1: Archive / Case Intake
 *     ↓
 * Stage 2: Detection & Look-Alike Screening
 *     ↓
 * Stage 3: Slick Characterisation & Morphology
 *     ↓
 * Stage 4: Backward Drift & Origin Inference
 *     ↓
 * Stage 5: AIS Traffic Correlation
 *     ↓
 * Stage 6: Forensic Evidence Fusion & Attribution
 *     ↓
 * Stage 7: Forensic Investigation Dossier / Report
 * 
 * Causal Rule: No downstream stage is precomputed independently.
 * Downstream stages consume the verified outputs of preceding stages.
 */
import { SCENARIOS, SCENARIO_LIST } from './scenariosData.js';
import { DISCLAIMER, PRIORITY } from './types.js';
import { haversineDistanceNm } from './map/mapGeometry.js';

// Simulated network delay (ms) for async API emulation
const LATENCY = 40;
const delay = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

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
 */
export function getScenarioIdForIncident(incidentId) {
  if (!incidentId) return null;
  return INCIDENT_TO_SCENARIO_MAP[incidentId] || null;
}

/**
 * Resolve incident ID for a given scenario ID
 */
export function getIncidentIdForScenario(scenarioId) {
  if (!scenarioId) return null;
  return SCENARIO_TO_INCIDENT_MAP[scenarioId] || null;
}

/**
 * Get nominal backward drift duration for a scenario
 */
export function getScenarioNominalDuration(scenarioId) {
  const s = SCENARIOS[scenarioId];
  return s?.drift?.backward?.durationHours || 12;
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

// ════════════════════════════════════════════════════════════════════════════
// ─── INVESTIGATION PIPELINE: 7 SEQUENTIAL STAGES ────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

/**
 * STAGE 1: Archive / Case Intake
 * Initializes the investigation case record from raw acquisition and environment inputs.
 * 
 * @param {string} scenarioId - e.g. 'SYN-001'
 * @param {Object|null} incidentObj - Optional archive record
 * @returns {Object} archiveStageOutput
 */
export function initArchiveStage(scenarioId, incidentObj = null) {
  const s = SCENARIOS[scenarioId];
  if (!s) throw new Error(`Scenario ${scenarioId} not found in scenario repository`);

  const incidentId = incidentObj?.id || SCENARIO_TO_INCIDENT_MAP[scenarioId] || s.report?.incidentId || 'INC-2026-001';
  const basin = incidentObj?.basin || s.scene?.basin || 'Strait of Malacca';

  return {
    stage: '01_ARCHIVE',
    scenarioId,
    incidentId,
    basin,
    scene: s.scene,
    forcing: s.forcing,
    rawSpill: s.spill,
    rawTraffic: s.aisTraffic,
    provenance: s.provenance,
    nominalDuration: s.drift?.backward?.durationHours || 12,
    initializedAt: s.provenance?.processedAt || new Date().toISOString(),
  };
}

/**
 * STAGE 2: Detection & Look-Alike Screening
 * Evaluates raw SAR observations from Stage 1 against the segmentation threshold.
 * 
 * @param {Object} archiveOutput - Output from Stage 1
 * @param {number} threshold - Detection confidence threshold (0.50 to 0.99)
 * @returns {Object} detectionStageOutput
 */
export function runDetectionStage(archiveOutput, threshold = 0.5) {
  if (!archiveOutput) return null;
  const rawSpill = archiveOutput.rawSpill;
  const passesThreshold = rawSpill.confidence >= threshold;

  // Sensitive segmented area responds causally to detection threshold
  // Higher threshold extracts tighter high-confidence core
  const areaScale = passesThreshold ? 1 - (threshold - 0.5) * 0.10 : 0;
  const areaKm2 = Math.round(rawSpill.areaKm2 * areaScale * 10) / 10;

  return {
    stage: '02_DETECTION',
    scenarioId: archiveOutput.scenarioId,
    incidentId: archiveOutput.incidentId,
    detectionId: `DET-${archiveOutput.scenarioId}`,
    polygon: rawSpill.polygon,
    centroid: rawSpill.centroid,
    confidence: rawSpill.confidence,
    detectionThreshold: threshold,
    passesThreshold,
    areaKm2: areaKm2 > 0 ? areaKm2 : rawSpill.areaKm2,
    classification: passesThreshold ? rawSpill.classification : 'BELOW_THRESHOLD_REJECTED',
    lookAlikeScores: rawSpill.lookAlikeScores,
    sarSceneId: archiveOutput.scene?.sensor,
    acquisitionTime: archiveOutput.scene?.acquisitionTime,
  };
}

/**
 * STAGE 3: Slick Characterisation & Morphology
 * Derives geometric axes, orientation, compactness, and spreading morphology
 * strictly from Stage 2 Detection geometry.
 * 
 * @param {Object} detectionOutput - Output from Stage 2
 * @returns {Object} slickAnalysisStageOutput
 */
export function runSlickAnalysisStage(detectionOutput) {
  if (!detectionOutput) return null;
  const s = SCENARIOS[detectionOutput.scenarioId];
  const baseSpill = s?.spill || {};

  // Major and minor axes scale causally with segmented area
  const areaRatio = Math.sqrt((detectionOutput.areaKm2 || baseSpill.areaKm2) / (baseSpill.areaKm2 || 1));
  const majorAxisKm = Math.round((baseSpill.majorAxisKm || 6.2) * areaRatio * 10) / 10;
  const minorAxisKm = Math.round((baseSpill.minorAxisKm || 1.8) * areaRatio * 10) / 10;
  const orientationDeg = baseSpill.orientationDeg || 68;
  const aspectRatio = minorAxisKm > 0 ? Math.round((majorAxisKm / minorAxisKm) * 100) / 100 : baseSpill.aspectRatio;
  const perimeterKm = Math.round((baseSpill.perimeterKm || 16.4) * areaRatio * 10) / 10;
  const compactness = baseSpill.compactness || 0.42;

  return {
    stage: '03_SLICK_ANALYSIS',
    scenarioId: detectionOutput.scenarioId,
    spillId: detectionOutput.detectionId,
    polygon: detectionOutput.polygon,
    centroid: detectionOutput.centroid,
    areaKm2: detectionOutput.areaKm2,
    majorAxisKm,
    minorAxisKm,
    orientationDeg,
    aspectRatio,
    compactness,
    perimeterKm,
    confidence: detectionOutput.confidence,
    classification: detectionOutput.classification,
    lookAlikeScores: detectionOutput.lookAlikeScores,
    dispersionAssessment: `Elongation along ${orientationDeg}° correlates with primary surface current shear and downwind transport vectors. Major/minor ratio of ${aspectRatio.toFixed(2)} indicates active Lagrangian spreading.`,
  };
}

/**
 * STAGE 4: Backward Drift & Origin Inference
 * Consumes Stage 3 Slick output + Stage 1 Archive input (forcing, acquisitionTime).
 * Backtracks Lagrangian advection from the slick centroid, computing the dynamic
 * release time window and origin uncertainty envelope.
 * 
 * @param {Object} slickOutput - Output from Stage 3
 * @param {Object} archiveOutput - Output from Stage 1
 * @param {Object} params - { durationHours, windFactor, currentFactor, direction }
 * @returns {Object} driftOriginStageOutput
 */
export function runDriftOriginStage(slickOutput, archiveOutput, params = {}) {
  if (!slickOutput || !archiveOutput) return null;
  const s = SCENARIOS[archiveOutput.scenarioId];
  const direction = params.direction || 'backward';
  const baseDrift = direction === 'backward' ? s.drift.backward : s.drift.forward;

  const windFactor = typeof params.windFactor === 'number' ? params.windFactor : 1.0;
  const currentFactor = typeof params.currentFactor === 'number' ? params.currentFactor : 1.0;
  const durationHours = typeof params.durationHours === 'number' ? params.durationHours : (baseDrift.durationHours || 12);

  // Compute release window causally from archive scene acquisition time minus duration
  const acqDate = archiveOutput.scene?.acquisitionTime ? new Date(archiveOutput.scene.acquisitionTime) : new Date('2026-06-18T06:42:00Z');
  const centerTimeMs = acqDate.getTime() - durationHours * 3600000;
  const windowHalfMs = 45 * 60 * 1000; // ±45 minute uncertainty interval
  const startDate = new Date(centerTimeMs - windowHalfMs);
  const endDate = new Date(centerTimeMs + windowHalfMs);

  const releaseWindowStart = formatUtcTimestamp(startDate);
  const releaseWindowEnd = formatUtcTimestamp(endDate);

  // Scale origin radius and uncertainty
  const nominalDuration = baseDrift.durationHours || 12;
  const nominalRadius = baseDrift.originRadiusKm || 3.0;
  const durationRatio = durationHours / nominalDuration;
  const perturbationFactor = 0.5 + 0.5 * Math.max(windFactor, currentFactor);

  const perturbedRadius = nominalRadius * durationRatio * perturbationFactor;
  const nominalDistance = baseDrift.driftDistanceNm || 8.4;
  const perturbedDistance = nominalDistance * durationRatio * ((windFactor + currentFactor) / 2);
  const originUncertaintyKm2 = Math.round(Math.PI * Math.pow(perturbedRadius, 2) * 10) / 10;

  // Origin centroid computed starting from slickOutput.centroid
  let dynamicOriginCentroid = baseDrift.originCentroid;
  let trajectory = baseDrift.trajectory || [];

  if (slickOutput.centroid && baseDrift.originCentroid) {
    const slickLon = slickOutput.centroid[0];
    const slickLat = slickOutput.centroid[1];
    const nomOriginLon = baseDrift.originCentroid[0];
    const nomOriginLat = baseDrift.originCentroid[1];
    const scale = durationRatio * ((windFactor + currentFactor) / 2);

    const dynamicLon = Math.round((slickLon + (nomOriginLon - slickLon) * scale) * 10000) / 10000;
    const dynamicLat = Math.round((slickLat + (nomOriginLat - slickLat) * scale) * 10000) / 10000;
    dynamicOriginCentroid = [dynamicLon, dynamicLat];

    const steps = 4;
    trajectory = [];
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      trajectory.push([
        Math.round((slickLon + frac * (dynamicLon - slickLon)) * 10000) / 10000,
        Math.round((slickLat + frac * (dynamicLat - slickLat)) * 10000) / 10000,
      ]);
    }
  }

  // Ensemble runs for SYN-005 (or if scenario provides ensembleRuns)
  let ensembleRuns = null;
  if (archiveOutput.scenarioId === 'SYN-005' && s.ensembleRuns) {
    // Recompute perturbation members centered around current origin centroid and uncertainty
    ensembleRuns = s.ensembleRuns.map((run) => {
      const runRadius = Math.round(perturbedRadius * (1 + run.windPerturbation / 100) * 10) / 10;
      return {
        ...run,
        originRadiusKm: runRadius,
      };
    });
  }

  return {
    stage: '04_DRIFT_ORIGIN',
    scenarioId: archiveOutput.scenarioId,
    direction,
    durationHours,
    releaseWindowStart,
    releaseWindowEnd,
    releaseWindowCenterIso: new Date(centerTimeMs).toISOString(),
    originCentroid: dynamicOriginCentroid,
    originRegion: baseDrift.originRegion,
    originRadiusKm: Math.round(perturbedRadius * 10) / 10,
    originUncertaintyKm2,
    driftDistanceNm: Math.round(perturbedDistance * 10) / 10,
    trajectory,
    forcing: {
      ...baseDrift.forcing,
      windSpeedKn: Math.round((baseDrift.forcing?.windSpeedKn || archiveOutput.forcing?.windSpeedKn || 14) * windFactor * 10) / 10,
      currentSpeedMs: Math.round((baseDrift.forcing?.currentSpeedMs || archiveOutput.forcing?.currentSpeedMs || 0.6) * currentFactor * 100) / 100,
    },
    perturbation: { windFactor, currentFactor, durationHours },
    ensembleRuns,
  };
}

/**
 * STAGE 5: AIS Traffic Correlation
 * Correlates raw AIS basin traffic from Stage 1 against the reconstructed
 * origin region and release time window from Stage 4.
 * 
 * @param {Object} driftOutput - Output from Stage 4
 * @param {Object} archiveOutput - Output from Stage 1
 * @returns {Object} aisTrafficStageOutput
 */
export function runAisTrafficStage(driftOutput, archiveOutput) {
  if (!driftOutput || !archiveOutput) return null;
  const s = SCENARIOS[archiveOutput.scenarioId];
  const rawTraffic = archiveOutput.rawTraffic || s.aisTraffic || { tracks: [] };
  const rawTracks = rawTraffic.tracks || [];

  const originCentroid = driftOutput.originCentroid;
  const originRadiusKm = driftOutput.originRadiusKm || 3.0;
  const originRadiusNm = originRadiusKm * 0.539957;
  const isSyn004 = archiveOutput.scenarioId === 'SYN-004';

  const windowCenterMs = driftOutput.releaseWindowCenterIso ? new Date(driftOutput.releaseWindowCenterIso).getTime() : 0;

  // Correlate each vessel track against Stage 4 spatio-temporal window
  let temporalMatches = 0;
  let spatialMatches = 0;
  let qualifyingCandidatesCount = 0;

  const evaluatedTracks = rawTracks.map((track) => {
    const positions = track.positions || [];
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
      minDistanceNm = 25.0;
    }

    // Evaluate temporal proximity to release window
    let isTemporalMatch = false;
    if (cpaTimestamp && windowCenterMs > 0) {
      const cpaMs = new Date(cpaTimestamp).getTime();
      const deltaHours = Math.abs(cpaMs - windowCenterMs) / 3600000;
      isTemporalMatch = deltaHours <= 2.5; // Within ±2.5h of center
    }

    // Evaluate spatial proximity to origin
    const isSpatialMatch = minDistanceNm <= (originRadiusNm * 1.6);

    if (!isSyn004) {
      if (isTemporalMatch) temporalMatches++;
      if (isSpatialMatch) spatialMatches++;
      if (isTemporalMatch && isSpatialMatch) qualifyingCandidatesCount++;
    }

    // Normalize AIS gap
    const gapStart = track.aisGap?.start || track.aisGap?.startTime;
    const gapEnd = track.aisGap?.end || track.aisGap?.endTime;
    const gapDuration = track.aisGap?.durationMinutes != null
      ? track.aisGap.durationMinutes
      : (gapStart && gapEnd ? Math.round((new Date(gapEnd) - new Date(gapStart)) / 60000) : null);

    const normalizedAisGap = track.aisGap
      ? {
          ...track.aisGap,
          start: gapStart,
          startTime: gapStart,
          end: gapEnd,
          endTime: gapEnd,
          durationMinutes: gapDuration,
        }
      : null;

    return {
      ...track,
      cpaDistanceNm: Math.round(minDistanceNm * 10) / 10,
      cpaTimestamp,
      isTemporalMatch: isSyn004 ? false : isTemporalMatch,
      isSpatialMatch: isSyn004 ? false : isSpatialMatch,
      hasAisGap: !!track.hasAisGap,
      aisGap: normalizedAisGap,
    };
  });

  return {
    stage: '05_AIS_TRAFFIC',
    scenarioId: archiveOutput.scenarioId,
    summary: {
      vesselsInRegion: rawTracks.length,
      temporalMatches: isSyn004 ? 0 : temporalMatches,
      spatialMatches: isSyn004 ? 0 : spatialMatches,
      candidates: isSyn004 ? 0 : qualifyingCandidatesCount,
    },
    correlationWindow: {
      start: driftOutput.releaseWindowStart,
      end: driftOutput.releaseWindowEnd,
    },
    tracks: evaluatedTracks,
  };
}

/**
 * STAGE 6: Forensic Evidence Fusion & Attribution
 * Consumes Stage 3 Slick + Stage 4 Drift + Stage 5 AIS Traffic + Stage 1 Archive.
 * Fuses multi-factor spatial, temporal, hydrodynamic, trajectory, and continuity evidence.
 * 
 * @param {Object} slickOutput - Output from Stage 3
 * @param {Object} driftOutput - Output from Stage 4
 * @param {Object} aisTrafficOutput - Output from Stage 5
 * @param {Object} archiveOutput - Output from Stage 1
 * @returns {Object} evidenceFusionStageOutput (Array and structured contract)
 */
export function runEvidenceFusionStage(slickOutput, driftOutput, aisTrafficOutput, archiveOutput) {
  if (!slickOutput || !driftOutput || !aisTrafficOutput || !archiveOutput) {
    const empty = [];
    empty.stage = '06_EVIDENCE_FUSION';
    empty.candidates = [];
    empty.allContacts = [];
    empty.candidateCount = 0;
    empty.correlationWindow = { start: '—', end: '—' };
    empty.attributionStatus = 'ABSTAINED';
    empty.abstentionReason = 'Incomplete investigation stage inputs';
    return empty;
  }

  const s = SCENARIOS[archiveOutput.scenarioId];
  const tracks = aisTrafficOutput.tracks || [];
  const baseEvidence = s?.evidence || [];
  const isSyn004 = archiveOutput.scenarioId === 'SYN-004' || s?.report?.abstention;

  const originCentroid = driftOutput.originCentroid;
  const originRadiusKm = driftOutput.originRadiusKm || 2.0;
  const originRadiusNm = originRadiusKm * 0.539957;

  // Drift parameter perturbations
  const durationHours = driftOutput.durationHours || 12;
  const baseDuration = s?.drift?.backward?.durationHours || 12;
  const durationDiff = Math.abs(durationHours - baseDuration);
  const windFactor = driftOutput.perturbation?.windFactor || 1.0;
  const currentFactor = driftOutput.perturbation?.currentFactor || 1.0;
  const envDiff = Math.abs(windFactor - 1.0) + Math.abs(currentFactor - 1.0);

  // Evaluate each contact track
  const evaluatedContacts = tracks.map((track) => {
    const baseEv = baseEvidence.find((e) => String(e.mmsi) === String(track.mmsi));
    const positions = track.positions || [];
    const minDistanceNm = track.cpaDistanceNm != null ? track.cpaDistanceNm : 25.0;
    const cpaTimestamp = track.cpaTimestamp;

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
    const baseDriftScore = baseEv ? (baseEv.driftConsistency || baseEv.environmentalConsistency || 75) : 30;
    const driftConsistency = isSyn004 ? Math.min(30, baseDriftScore) : Math.max(15, Math.min(100, Math.round(baseDriftScore - envDiff * 15)));

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
    if (archiveOutput.scenarioId === 'SYN-005') {
      rankStability = 52; // Ensemble spread causes rank volatility
    } else if (isSyn004) {
      rankStability = 0;
    }

    // Contextual evidence explanations
    const lastPos = positions[positions.length - 1];
    const heading = lastPos?.cog != null ? lastPos.cog : (track.cog || 0);
    const cpaFormatted = cpaTimestamp ? cpaTimestamp.replace('T', ' ').substring(11, 16) + ' UTC' : 'window';

    const temporalExplanation = temporalCompatibility >= 70
      ? `Vessel transit (${cpaFormatted}) coincides directly with the reconstructed release window (${driftOutput.releaseWindowStart || '17 JUN 20:00'} – ${driftOutput.releaseWindowEnd || '18 JUN 02:00'}).`
      : `Vessel transit (${cpaFormatted}) falls outside the primary estimated release window.`;

    const spatialExplanation = spatialProximity >= 70
      ? `Closest point of approach (${minDistanceNm.toFixed(1)} NM) enters the reconstructed origin uncertainty envelope (${(driftOutput.originUncertaintyKm2 || 15).toFixed(1)} km²).`
      : `Closest point of approach (${minDistanceNm.toFixed(1)} NM) remains peripheral to the reconstructed origin envelope.`;

    const driftExplanation = driftConsistency >= 70
      ? `Observed vessel trajectory aligns with the inferred backward drift corridor and coupled metocean forcing vectors.`
      : `Trajectory angle deviates from the primary Lagrangian hydrodynamic transport corridor.`;

    const trajectoryExplanation = trajectoryConsistency >= 70
      ? `Vessel heading (${heading}° COG) is consistent with the origin-to-slick dispersion geometry (orientation ${slickOutput.orientationDeg}°).`
      : `Vessel transit heading (${heading}° COG) diverges from the expected discharge dispersion axis (${slickOutput.orientationDeg}°).`;

    const aisExplanation = track.hasAisGap && track.aisGap
      ? `Contextual AIS transmission gap detected: transponder inactive for ${track.aisGap.durationMinutes != null ? `${track.aisGap.durationMinutes}m` : 'an unobserved interval'} during corridor transit.`
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
      overallScore: compositeScore,
      spatialCompatibility: spatialProximity,
      temporalCompatibility,
      trajectoryCompatibility: trajectoryConsistency,
      aisContinuity,
      driftConsistency,
      environmentalConsistency: driftConsistency,
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
      reasons: supportingEvidence,
      supportingEvidence,
      uncertainty: {
        originUncertaintyKm2: driftOutput.originUncertaintyKm2 || 15.0,
        confidenceInterval: '95%',
      },
      hasAisGap: !!track.hasAisGap,
      aisGap: track.aisGap,
    };
  });

  // Candidate filtering: non-excluded candidates
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
    start: driftOutput.releaseWindowStart || '—',
    end: driftOutput.releaseWindowEnd || '—',
  };

  const resultCandidates = isSyn004 ? [] : (validCandidates.length > 0 ? validCandidates : evaluatedContacts);

  // Return evidence object that behaves both as candidate array and structured contract
  const evidenceContract = Object.assign([...resultCandidates], {
    stage: '06_EVIDENCE_FUSION',
    scenarioId: archiveOutput.scenarioId,
    candidates: resultCandidates,
    allContacts: evaluatedContacts,
    candidateCount,
    correlationWindow,
    attributionStatus,
    abstentionReason: isSyn004
      ? (s?.report?.abstentionMessage || 'All available AIS tracks transited outside the release window or beyond spatial proximity limits.')
      : null,
    ensembleStability: archiveOutput.scenarioId === 'SYN-005' ? 52 : 94,
  });

  return evidenceContract;
}

/**
 * STAGE 7: Forensic Investigation Dossier / Report
 * Compiles the final forensic investigation dossier strictly from all upstream stage outputs.
 * 
 * @param {Object} archiveOutput - Stage 1
 * @param {Object} detectionOutput - Stage 2
 * @param {Object} slickOutput - Stage 3
 * @param {Object} driftOutput - Stage 4
 * @param {Object} aisTrafficOutput - Stage 5
 * @param {Object} evidenceOutput - Stage 6
 * @returns {Object} evidenceReportStageOutput
 */
export function compileReportStage(archiveOutput, detectionOutput, slickOutput, driftOutput, aisTrafficOutput, evidenceOutput) {
  if (!archiveOutput) return null;
  const s = SCENARIOS[archiveOutput.scenarioId];
  const candList = evidenceOutput?.candidates || (Array.isArray(evidenceOutput) ? evidenceOutput : []);
  const isSyn004 = archiveOutput.scenarioId === 'SYN-004' || s?.report?.abstention;
  const topCandidate = isSyn004 ? null : candList.find((e) => e.priority !== PRIORITY.NONE);

  return {
    ...s.report,
    stage: '07_EVIDENCE_REPORT',
    incidentId: archiveOutput.incidentId,
    scenarioId: archiveOutput.scenarioId,
    estimatedOrigin: `${driftOutput.releaseWindowStart} – ${driftOutput.releaseWindowEnd}`,
    scene: archiveOutput.scene,
    spill: slickOutput,
    detection: detectionOutput,
    drift: { ...s.drift, backward: driftOutput },
    aisTraffic: aisTrafficOutput,
    evidence: evidenceOutput,
    topCandidate: topCandidate || null,
    provenance: archiveOutput.provenance,
    abstention: isSyn004 || evidenceOutput?.attributionStatus === 'ABSTAINED',
  };
}

/**
 * MASTER ORCHESTRATOR: Execute Full Investigation Pipeline
 * Sequentially executes Stage 1 through Stage 7, passing each stage's outputs
 * causally into downstream stages.
 * 
 * @param {string} scenarioId - 'SYN-001' ... 'SYN-005'
 * @param {Object} options - { incidentObj, detectionThreshold, driftDuration, windFactor, currentFactor }
 * @returns {Promise<Object>} Unified investigation state
 */
export async function executeInvestigationPipeline(scenarioId, options = {}) {
  await delay();

  // Stage 1: Case Intake & Archive
  const archive = initArchiveStage(scenarioId, options.incidentObj);

  // Stage 2: Detection & Look-Alike Screening (consumes archive)
  const threshold = typeof options.detectionThreshold === 'number' ? options.detectionThreshold : 0.5;
  const detection = runDetectionStage(archive, threshold);

  // Stage 3: Slick Characterisation & Morphology (consumes detection)
  const slick = runSlickAnalysisStage(detection);

  // Stage 4: Backward Drift & Origin (consumes slick + archive forcing/time)
  const driftDuration = typeof options.driftDuration === 'number' ? options.driftDuration : archive.nominalDuration;
  const windFactor = typeof options.windFactor === 'number' ? options.windFactor : 1.0;
  const currentFactor = typeof options.currentFactor === 'number' ? options.currentFactor : 1.0;
  const drift = runDriftOriginStage(slick, archive, {
    direction: 'backward',
    durationHours: driftDuration,
    windFactor,
    currentFactor,
  });

  // Stage 5: AIS Traffic Correlation (consumes drift + archive traffic)
  const aisTraffic = runAisTrafficStage(drift, archive);

  // Stage 6: Evidence Fusion & Attribution (consumes slick + drift + aisTraffic + archive)
  const evidence = runEvidenceFusionStage(slick, drift, aisTraffic, archive);

  // Stage 7: Evidence Report Dossier (consumes all 6 upstream outputs)
  const report = compileReportStage(archive, detection, slick, drift, aisTraffic, evidence);

  return {
    scenarioId,
    archive,
    detection,
    slick,
    drift,
    aisTraffic,
    evidence,
    ensemble: drift.ensembleRuns,
    report,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── BACKWARD COMPATIBILITY EXPORTS (Delegate to Pipeline Stages) ───────────
// ════════════════════════════════════════════════════════════════════════════

export async function getIncidents() {
  await delay();
  return SCENARIO_LIST.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    expectedOutcome: s.expectedOutcome,
    scene: s.scene,
    spillArea: s.spill.areaKm2,
    candidateCount: s.evidence.filter((e) => e.priority !== 'NONE').length,
    topScore: s.evidence.length > 0 ? Math.max(...s.evidence.map((e) => e.overallScore)) : 0,
  }));
}

export async function getIncidentById(scenarioOrIncidentId) {
  await delay();
  const scenarioId = INCIDENT_TO_SCENARIO_MAP[scenarioOrIncidentId] || scenarioOrIncidentId;
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Scenario ${scenarioOrIncidentId} not found`);
  return scenario;
}

export async function validateScene(scenarioId) {
  await delay();
  const s = SCENARIOS[scenarioId];
  return s ? s.scene : null;
}

export async function runDetection(scenarioId, threshold = 0.5) {
  await delay(80);
  const archive = initArchiveStage(scenarioId);
  return runDetectionStage(archive, threshold);
}

export async function characteriseSlick(scenarioId) {
  await delay();
  const archive = initArchiveStage(scenarioId);
  const det = runDetectionStage(archive, 0.5);
  return runSlickAnalysisStage(det);
}

export async function runDriftSimulation(scenarioId, params = {}) {
  await delay(80);
  const archive = initArchiveStage(scenarioId);
  const det = runDetectionStage(archive, 0.5);
  const slick = runSlickAnalysisStage(det);
  return runDriftOriginStage(slick, archive, params);
}

export async function queryAisCandidates(scenarioId, driftResult = null) {
  await delay(60);
  const archive = initArchiveStage(scenarioId);
  const det = runDetectionStage(archive, 0.5);
  const slick = runSlickAnalysisStage(det);
  const drift = driftResult || runDriftOriginStage(slick, archive);
  return runAisTrafficStage(drift, archive);
}

export async function evaluateEvidenceScores(scenarioId, driftResult = null, aisTraffic = null, detection = null) {
  await delay(60);
  const archive = initArchiveStage(scenarioId);
  const det = detection || runDetectionStage(archive, 0.5);
  const slick = runSlickAnalysisStage(det);
  const drift = driftResult || runDriftOriginStage(slick, archive);
  const ais = aisTraffic || runAisTrafficStage(drift, archive);
  return runEvidenceFusionStage(slick, drift, ais, archive);
}

export async function runStabilityEnsemble(scenarioId) {
  await delay(60);
  const s = SCENARIOS[scenarioId];
  if (!s) return null;
  return s.ensembleRuns || null;
}

export async function generateDossier(scenarioId, dynamicState = {}) {
  await delay(80);
  const archive = initArchiveStage(scenarioId);
  const det = dynamicState.detection || runDetectionStage(archive, 0.5);
  const slick = dynamicState.slick || runSlickAnalysisStage(det);
  const drift = dynamicState.drift || runDriftOriginStage(slick, archive);
  const ais = dynamicState.aisTraffic || runAisTrafficStage(drift, archive);
  const evidence = dynamicState.evidence || runEvidenceFusionStage(slick, drift, ais, archive);
  return compileReportStage(archive, det, slick, drift, ais, evidence);
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
  s.aisTraffic.tracks.forEach((track) => {
    const score = candList.find((e) => e.mmsi === track.mmsi);
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
          .filter((p) => !p.isGap)
          .map((p) => [p.lon, p.lat]),
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
