/**
 * SPILLTRACE — Mapbox GeoJSON Source Builders
 *
 * Pure functions converting structured investigation/scenario state into
 * GeoJSON FeatureCollections for Mapbox GL JS.
 *
 * CRITICAL RULE: All coordinates passed to Mapbox MUST be [longitude, latitude].
 * Never invent random coordinates; extract only from active scenario state.
 */

import {
  projectPoint,
  calculateSlickAxes,
  generateUncertaintyEllipse,
  getDeterministicSegmentation,
  haversineDistanceNm,
} from './mapGeometry.js';
import { MAP_STYLES } from './mapStyles.js';
import { SOURCES } from './mapboxLayers.js';
import { INITIAL_INCIDENTS } from '../../data/incidentsData.js';
import { getScenarioIdForIncident } from '../spilltraceService.js';

export const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// ─── Coordinate Conversion Helpers ────────────────────────────────────
/** Convert [lat, lon] to [lon, lat] */
export const latLonToLonLat = (pt) => (Array.isArray(pt) && pt.length >= 2 ? [pt[1], pt[0]] : [0, 0]);

/** Convert an array of [lat, lon] rings into an array of [lon, lat] rings */
export const latLonRingToLonLatRing = (ring) => (Array.isArray(ring) ? ring.map(latLonToLonLat) : []);

// ─── 1. Incident Markers Source (All 12 Incidents) ────────────────────
export function buildIncidentMarkersGeoJson(incidents = [], getScenarioId) {
  if (!incidents || !incidents.length) return EMPTY_FC;
  const features = incidents
    .filter((inc) => inc.lat != null && inc.lon != null)
    .map((inc) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [inc.lon, inc.lat],
      },
      properties: {
        incidentId: inc.id,
        scenarioId: getScenarioId ? getScenarioId(inc.id) : null,
        title: inc.basin,
        status: inc.status,
        timestamp: inc.detectionTime,
        area: inc.area,
        code: inc.code,
      },
    }));
  return { type: 'FeatureCollection', features };
}

// ─── 2. SAR Scene Footprint Source ────────────────────────────────────
export function buildSarFootprintGeoJson(scenario) {
  if (!scenario?.scene?.bbox) return EMPTY_FC;
  const [minLon, minLat, maxLon, maxLat] = scenario.scene.bbox;

  const features = [
    // Swath Bounding Box Polygon
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [minLon, maxLat],
            [maxLon, maxLat],
            [maxLon, minLat],
            [minLon, minLat],
            [minLon, maxLat],
          ],
        ],
      },
      properties: {
        type: 'sar-bbox',
        sensor: scenario.scene.sensor || 'Sentinel-1 C-SAR',
        sceneId: scenario.scene.sceneId || 'IW_GRDH',
      },
    },
    // Top-left acquisition tag
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [minLon, maxLat],
      },
      properties: {
        type: 'sar-tag',
        label: `${scenario.scene.sensor || 'SENTINEL-1 C-SAR'} // ${scenario.scene.sceneId || 'IW_GRDH'}`,
      },
    },
    // 4 Corner Crosshairs
    ...[
      [minLon, maxLat],
      [maxLon, maxLat],
      [minLon, minLat],
      [maxLon, minLat],
    ].map(([cLon, cLat]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cLon, cLat] },
      properties: { type: 'sar-corner' },
    })),
  ];

  return { type: 'FeatureCollection', features };
}

// ─── 3. Tab 02: Semantic Segmentation Source ──────────────────────────
export function buildSegmentationGeoJson(scenario) {
  if (!scenario?.spill) return EMPTY_FC;
  const regions = getDeterministicSegmentation(scenario);
  if (!regions || !regions.length) return EMPTY_FC;

  const features = [];
  regions.forEach((reg) => {
    const style = MAP_STYLES.segmentation[reg.type] || MAP_STYLES.segmentation.oilSlick;
    const lonLatRing = latLonRingToLonLatRing(reg.polygon);

    // Polygon
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [lonLatRing],
      },
      properties: {
        type: 'segmentation-polygon',
        classification: reg.type,
        label: reg.label,
        confidence: reg.confidence,
        areaKm2: reg.areaKm2,
        strokeColor: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
      },
    });

    // Centroid point
    const cLonLat = [reg.centroid[1], reg.centroid[0]];
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cLonLat,
      },
      properties: {
        type: 'segmentation-centroid',
        classification: reg.type,
        label: reg.label,
        strokeColor: style.color,
      },
    });

    // Label tag for primary oil slick
    if (reg.type === 'oilSlick') {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: cLonLat,
        },
        properties: {
          type: 'segmentation-tag',
          label: `DETECTED SLICK · ${reg.areaKm2} km²`,
        },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

// ─── 4. Technical Slick & GIS Geometry Source (Tabs 03–07) ────────────
export function buildSlickGeoJson(scenario, showAxes = false) {
  if (!scenario?.spill?.polygon) return EMPTY_FC;
  const spill = scenario.spill;
  const ring = spill.polygon; // already in [lon, lat]

  const features = [
    // Main Slick Polygon
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        type: 'slick-polygon',
        areaKm2: spill.areaKm2,
        majorAxisKm: spill.majorAxisKm,
        minorAxisKm: spill.minorAxisKm,
        confidence: spill.confidence,
        orientationDeg: spill.orientationDeg,
      },
    },
  ];

  // Centroid point
  if (spill.centroid) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: spill.centroid },
      properties: {
        type: 'slick-centroid',
        label: `SLICK CENTROID (${spill.areaKm2} km²)`,
      },
    });
  }

  // Measurement Axes for Tab 03
  if (showAxes && spill.centroid && spill.majorAxisKm) {
    const axes = calculateSlickAxes(
      spill.centroid,
      spill.majorAxisKm,
      spill.minorAxisKm,
      spill.orientationDeg
    );

    if (axes) {
      const majorStart = latLonToLonLat(axes.major[0]);
      const majorEnd = latLonToLonLat(axes.major[1]);
      const minorStart = latLonToLonLat(axes.minor[0]);
      const minorEnd = latLonToLonLat(axes.minor[1]);

      // Major Axis Line
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [majorStart, majorEnd],
        },
        properties: {
          type: 'axis-major',
          lengthKm: spill.majorAxisKm,
          orientationDeg: spill.orientationDeg,
        },
      });

      // Major Axis Label Badge at end
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: majorEnd },
        properties: {
          type: 'axis-major-label',
          label: `MAJOR AXIS: ${spill.majorAxisKm} km · ${spill.orientationDeg}°`,
        },
      });

      // Minor Axis Line
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [minorStart, minorEnd],
        },
        properties: {
          type: 'axis-minor',
          lengthKm: spill.minorAxisKm,
        },
      });

      // Minor Axis Label Badge at end
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: minorEnd },
        properties: {
          type: 'axis-minor-label',
          label: `MINOR AXIS: ${spill.minorAxisKm} km`,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ─── 4b. Archive Observation Footprint (Incidents Archive Map) ─────────
export function buildArchiveObservationGeoJson(scenario) {
  if (!scenario?.spill?.polygon) return EMPTY_FC;
  const spill = scenario.spill;
  const features = [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [spill.polygon] },
      properties: {
        type: 'observation-polygon',
        areaKm2: spill.areaKm2,
        label: `ARCHIVE OBSERVATION · ${spill.areaKm2} km²`,
      },
    },
  ];

  if (spill.centroid) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: spill.centroid },
      properties: {
        type: 'observation-centroid',
        label: `OBSERVATION CENTROID (${spill.areaKm2} km²)`,
      },
    });
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: spill.centroid },
      properties: {
        type: 'observation-tag',
        label: `DETECTED SLICK · ${spill.areaKm2} km²`,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── 5. Reconstructed Origin & Uncertainty Source ─────────────────────
export function buildOriginGeoJson(scenario, driftResult, highlightedFactor = null) {
  const drift = driftResult || scenario?.drift?.backward;
  if (!drift?.originCentroid) return EMPTY_FC;

  const isSpatialFocus = highlightedFactor === 'spatial';
  const isDriftFocus = highlightedFactor === 'drift';
  const radiusKm = drift.originRadiusKm || 2.8;

  const features = [];

  // Reconstructed Origin Region (Polygon)
  if (drift.originRegion) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [drift.originRegion] },
      properties: {
        type: 'origin-region',
        radiusKm,
        isSpatialFocus,
        isDriftFocus,
      },
    });
  }

  // Origin Uncertainty Ellipse (Smoothed dispersion envelope)
  const ellipsePoints = generateUncertaintyEllipse(
    drift.originCentroid[0],
    drift.originCentroid[1],
    radiusKm * 1.35,
    radiusKm * 0.85,
    scenario?.forcing?.currentDirectionDeg || 118,
    28
  );
  const ellipseLonLat = latLonRingToLonLatRing(ellipsePoints);
  features.push({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ellipseLonLat] },
    properties: {
      type: 'origin-uncertainty-ellipse',
      dispersionAreaKm2: (drift.originUncertaintyKm2 || 14.8).toFixed(1),
      isSpatialFocus,
      isDriftFocus,
    },
  });

  // Origin Centroid Point
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: drift.originCentroid },
    properties: {
      type: 'origin-centroid',
      label: `RECONSTRUCTED ORIGIN // T - ${drift.durationHours || 12}h`,
    },
  });

  // Callout Tag at origin centroid
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: drift.originCentroid },
    properties: {
      type: 'origin-tag',
      label: `RECONSTRUCTED ORIGIN // T - ${drift.durationHours || 12}h`,
    },
  });

  return { type: 'FeatureCollection', features };
}

// ─── 6. Backward Drift Trajectory Source ──────────────────────────────
export function buildDriftGeoJson(scenario, driftResult, highlightedFactor = null) {
  const drift = driftResult || scenario?.drift?.backward;
  if (!drift?.originCentroid || !scenario?.spill?.centroid) return EMPTY_FC;

  const isDriftFocus = highlightedFactor === 'drift';
  const spillCentroid = scenario.spill.centroid; // [lon, lat]
  const originCentroid = drift.originCentroid;   // [lon, lat]

  const features = [];

  // Trajectory coordinates
  let trajectoryLonLats = [];
  if (Array.isArray(drift.trajectory) && drift.trajectory.length > 1) {
    trajectoryLonLats = drift.trajectory; // [lon, lat]
  } else {
    // Generate intermediate advection steps
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      trajectoryLonLats.push([
        spillCentroid[0] + frac * (originCentroid[0] - spillCentroid[0]),
        spillCentroid[1] + frac * (originCentroid[1] - spillCentroid[1]),
      ]);
    }
  }

  // 1. Backward Drift Trajectory Line
  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: trajectoryLonLats,
    },
    properties: {
      type: 'drift-trajectory',
      durationHours: drift.durationHours || 12,
      distanceNm: drift.driftDistanceNm || 16.8,
      isDriftFocus,
    },
  });

  // 2. Intermediate Advection Points & Historical Slick Envelopes
  trajectoryLonLats.forEach((pt, idx) => {
    if (idx > 0 && idx < trajectoryLonLats.length - 1) {
      const hoursBack = Math.round((idx / (trajectoryLonLats.length - 1)) * (drift.durationHours || 12));
      const scale = 1 - (idx / trajectoryLonLats.length) * 0.35;

      const histPoints = generateUncertaintyEllipse(
        pt[0],
        pt[1],
        (scenario.spill?.majorAxisKm || 5) * 0.35 * scale,
        (scenario.spill?.minorAxisKm || 1.8) * 0.35 * scale,
        scenario.spill?.orientationDeg || 300,
        14
      );
      const histLonLats = latLonRingToLonLatRing(histPoints);

      // Historical slick envelope polygon
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [histLonLats] },
        properties: {
          type: 'advection-envelope',
          hoursBack,
        },
      });

      // Advection pip point
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {
          type: 'advection-point',
          label: `T - ${hoursBack}h`,
          hoursBack,
        },
      });
    }
  });

  // 3. Drift Distance Label Midway along trajectory
  const midIdx = Math.floor(trajectoryLonLats.length / 2);
  if (trajectoryLonLats[midIdx]) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: trajectoryLonLats[midIdx] },
      properties: {
        type: 'drift-distance-label',
        label: `BACKWARD DRIFT: ${drift.driftDistanceNm || 16.8} NM`,
      },
    });
  }

  // 4. Forward Dispersion Envelope if present
  const fwd = scenario?.drift?.forward;
  if (fwd?.forwardEnvelope) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [fwd.forwardEnvelope] },
      properties: { type: 'drift-forward-envelope' },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── 7. Metocean Forcing Vectors Source ────────────────────────────────
export function buildMetoceanGeoJson(scenario) {
  if (!scenario?.forcing || !scenario?.spill?.centroid) return EMPTY_FC;
  const forcing = scenario.forcing;
  const [cLon, cLat] = scenario.spill.centroid;

  // Position indicator ~12 km NE of spill
  const [indLat, indLon] = projectPoint(cLat, cLon, 12, 45);

  const features = [];

  // Wind Vector Line & Label
  const windLengthKm = 4.5;
  const [windEndLat, windEndLon] = projectPoint(indLat, indLon, windLengthKm, forcing.windDirectionDeg);
  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [indLon, indLat],
        [windEndLon, windEndLat],
      ],
    },
    properties: {
      type: 'metocean-wind',
      speedKn: forcing.windSpeedKn,
      directionDeg: forcing.windDirectionDeg,
    },
  });
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [windEndLon, windEndLat] },
    properties: {
      type: 'metocean-wind-label',
      label: `WIND: ${forcing.windSpeedKn} kn · ${forcing.windDirectionDeg}°`,
    },
  });

  // Ocean Current Vector Line & Label
  const curLengthKm = 3.5;
  const [curEndLat, curEndLon] = projectPoint(indLat, indLon, curLengthKm, forcing.currentDirectionDeg);
  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [indLon, indLat],
        [curEndLon, curEndLat],
      ],
    },
    properties: {
      type: 'metocean-current',
      speedMs: forcing.currentSpeedMs,
      directionDeg: forcing.currentDirectionDeg,
    },
  });
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [curEndLon, curEndLat] },
    properties: {
      type: 'metocean-current-label',
      label: `CURRENT: ${forcing.currentSpeedMs} m/s · ${forcing.currentDirectionDeg}°`,
    },
  });

  return { type: 'FeatureCollection', features };
}

// ─── 8. AIS Tracks Source (Continuous & Gap-Split) ─────────────────────
export function buildAisTracksGeoJson(
  scenario,
  aisData,
  selectedCandidateMmsi,
  highlightedFactor = null,
  isEvidenceStage = false
) {
  const tracks = aisData?.tracks || scenario?.aisTraffic?.tracks;
  if (!tracks || !tracks.length) return EMPTY_FC;

  const isSyn004 = scenario?.id === 'SYN-004';
  const hasSelection = isEvidenceStage && !isSyn004 && Boolean(selectedCandidateMmsi);

  const features = [];

  for (const track of tracks) {
    if (!track.positions || track.positions.length < 2) continue;

    const isCandidate = isEvidenceStage && !isSyn004 && String(track.mmsi) === String(selectedCandidateMmsi);
    const vName = track.vesselName || track.name || 'VESSEL';

    if (track.hasAisGap && track.aisGap) {
      // Split into pre-gap and post-gap segments
      const preGap = [];
      const postGap = [];
      let gapStarted = false;

      track.positions.forEach((p) => {
        if (p.isGap) {
          gapStarted = true;
        } else if (!gapStarted) {
          preGap.push([p.lon, p.lat]);
        } else {
          postGap.push([p.lon, p.lat]);
        }
      });

      if (preGap.length > 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: preGap },
          properties: {
            type: 'ais-track',
            segment: 'pre-gap',
            mmsi: track.mmsi,
            vesselName: vName,
            isCandidate,
            hasSelection,
          },
        });
      }

      if (postGap.length > 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: postGap },
          properties: {
            type: 'ais-track',
            segment: 'post-gap',
            mmsi: track.mmsi,
            vesselName: vName,
            isCandidate,
            hasSelection,
          },
        });
      }
    } else {
      // Continuous vessel track
      const lonLats = track.positions.map((p) => [p.lon, p.lat]);
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: lonLats },
        properties: {
          type: 'ais-track',
          segment: 'continuous',
          mmsi: track.mmsi,
          vesselName: vName,
          isCandidate,
          hasSelection,
        },
      });
    }

    // Progression Pips every 5 positions
    track.positions.forEach((p, pIdx) => {
      if (pIdx > 0 && pIdx % 5 === 0 && !p.isGap && pIdx < track.positions.length - 1) {
        const timeStr = p.timestamp ? p.timestamp.substring(11, 16) + ' UTC' : `+${pIdx * 0.5}h`;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: {
            type: 'track-pip',
            mmsi: track.mmsi,
            label: `${timeStr} · ${Math.round(p.sog || 0)} kn`,
            isCandidate,
          },
        });
      }
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── 9. AIS Gap Segment & Annotation Source (SYN-003) ─────────────────
export function buildAisGapGeoJson(
  scenario,
  aisData,
  selectedCandidateMmsi,
  highlightedFactor = null
) {
  const tracks = aisData?.tracks || scenario?.aisTraffic?.tracks;
  if (!tracks || !tracks.length) return EMPTY_FC;

  const features = [];

  for (const track of tracks) {
    if (!track.hasAisGap || !track.aisGap || !track.positions?.length) continue;

    const preGap = [];
    const postGap = [];
    let gapStarted = false;

    track.positions.forEach((p) => {
      if (p.isGap) {
        gapStarted = true;
      } else if (!gapStarted) {
        preGap.push([p.lon, p.lat]);
      } else {
        postGap.push([p.lon, p.lat]);
      }
    });

    if (preGap.length > 0 && postGap.length > 0) {
      const p1 = preGap[preGap.length - 1];
      const p2 = postGap[0];
      const isGapFocus = highlightedFactor === 'continuity';
      const gapDuration = track.aisGap.durationMinutes != null
        ? track.aisGap.durationMinutes
        : (track.aisGap.start && track.aisGap.end ? Math.round((new Date(track.aisGap.end) - new Date(track.aisGap.start)) / 60000) : 0);
      const gapHours = (gapDuration / 60).toFixed(1);

      // Gap Connector LineString
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [p1, p2],
        },
        properties: {
          type: 'ais-gap-line',
          mmsi: track.mmsi,
          durationMinutes: track.aisGap.durationMinutes,
          gapHours,
          isGapFocus,
        },
      });

      // Gap Midpoint Callout Label
      const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: mid },
        properties: {
          type: 'ais-gap-label',
          label: `[ AIS GAP ${gapHours}h${isGapFocus ? ' · FOCUS' : ''} ]`,
          mmsi: track.mmsi,
          durationMinutes: track.aisGap.durationMinutes,
          isGapFocus,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ─── 10. Vessel Contacts & Lookahead Vectors Source ───────────────────
export function buildVesselsGeoJson(
  scenario,
  aisData,
  selectedCandidateMmsi,
  showCandidateTags = false
) {
  const tracks = aisData?.tracks || scenario?.aisTraffic?.tracks;
  if (!tracks || !tracks.length) return EMPTY_FC;

  const isSyn004 = scenario?.id === 'SYN-004';
  const features = [];

  for (const track of tracks) {
    if (!track.positions || !track.positions.length) continue;
    const lastPos = track.positions[track.positions.length - 1];
    if (!lastPos) continue;

    const isCandidate = showCandidateTags && !isSyn004 && String(track.mmsi) === String(selectedCandidateMmsi);
    const cog = Math.round(lastPos.cog != null ? lastPos.cog : 0);
    const sog = Math.round((lastPos.sog != null ? lastPos.sog : (track.avgSpeedKn || 12)) * 10) / 10;
    const vName = track.vesselName || track.name || 'VESSEL';

    // Vessel Position Point
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lastPos.lon, lastPos.lat],
      },
      properties: {
        type: 'vessel-position',
        mmsi: track.mmsi,
        vesselName: vName,
        vesselType: track.vesselType || track.type || 'Vessel',
        cog,
        sog,
        isCandidate,
      },
    });

    // 15-Minute Heading/Speed Lookahead Vector
    if (sog > 0) {
      const advanceDistKm = sog * 1.852 * 0.25; // 15-min lookahead in km
      const [projLat, projLon] = projectPoint(lastPos.lat, lastPos.lon, advanceDistKm, cog);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [lastPos.lon, lastPos.lat],
            [projLon, projLat],
          ],
        },
        properties: {
          type: 'vessel-lookahead',
          mmsi: track.mmsi,
          isCandidate,
        },
      });
    }

    // Candidate Vessel Callout Tag (ONLY if showCandidateTags is true)
    if (showCandidateTags && isCandidate) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lastPos.lon, lastPos.lat],
        },
        properties: {
          type: 'candidate-tag',
          label: `[ INVESTIGATIVE LEAD ] ${vName} · ${track.mmsi}`,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ─── 11. Closest Point of Approach (CPA) Tie-Line Source ──────────────
export function buildCpaGeoJson(
  scenario,
  aisData,
  driftResult,
  selectedCandidateMmsi,
  highlightedFactor = null
) {
  if (scenario?.id === 'SYN-004' || !selectedCandidateMmsi) return EMPTY_FC;

  const drift = driftResult || scenario?.drift?.backward;
  if (!drift?.originCentroid) return EMPTY_FC;

  const tracks = aisData?.tracks || scenario?.aisTraffic?.tracks;
  const candTrack = tracks?.find((t) => String(t.mmsi) === String(selectedCandidateMmsi));
  if (!candTrack?.positions || !candTrack.positions.length) return EMPTY_FC;

  const [originLon, originLat] = drift.originCentroid;
  let minDistanceNm = Infinity;
  let closestPos = null;

  candTrack.positions.forEach((p) => {
    if (!p.isGap) {
      const dist = haversineDistanceNm(p.lat, p.lon, originLat, originLon);
      if (dist < minDistanceNm) {
        minDistanceNm = dist;
        closestPos = p;
      }
    }
  });

  if (!closestPos || minDistanceNm > 40) return EMPTY_FC;

  const isSpatialFocus = highlightedFactor === 'spatial';
  const isTemporalFocus = highlightedFactor === 'temporal';

  const features = [
    // CPA Dashed Tie-Line
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [closestPos.lon, closestPos.lat],
          [originLon, originLat],
        ],
      },
      properties: {
        type: 'cpa-line',
        distanceNm: minDistanceNm.toFixed(1),
        isSpatialFocus,
      },
    },
    // CPA Distance Badge Midway
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          (closestPos.lon + originLon) / 2,
          (closestPos.lat + originLat) / 2,
        ],
      },
      properties: {
        type: 'cpa-badge',
        label: `CPA: ${minDistanceNm.toFixed(1)} NM${isSpatialFocus ? ' · SPATIAL FOCUS' : ''}`,
        isSpatialFocus,
      },
    },
  ];

  // Transit Window Callout if Temporal factor is active
  if (isTemporalFocus) {
    const transitTime = closestPos.timestamp
      ? closestPos.timestamp.substring(11, 16) + ' UTC'
      : 'RELEASE WINDOW';
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [closestPos.lon, closestPos.lat],
      },
      properties: {
        type: 'temporal-focus-tag',
        label: `TRANSIT: ${transitTime} [TEMPORAL FOCUS]`,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── 12. Ensemble Uncertainty Dispersion Source (SYN-005) ─────────────
export function buildEnsembleGeoJson(scenario, ensembleData) {
  if (scenario?.id !== 'SYN-005') return EMPTY_FC;

  const runs = ensembleData?.length ? ensembleData : scenario?.ensembleRuns;
  if (!runs || !runs.length) return EMPTY_FC;

  const spillCentroid = scenario?.spill?.centroid || [75.121, 9.582];
  const originCentroid = scenario?.drift?.backward?.originCentroid || [75.06, 9.64];

  const features = [];

  // 1. Broad Ensemble Uncertainty Envelope Polygon
  const envelopePoints = generateUncertaintyEllipse(
    originCentroid[0],
    originCentroid[1],
    7.8, // Major km
    5.4, // Minor km
    275,
    24
  );
  const envelopeLonLats = latLonRingToLonLatRing(envelopePoints);

  features.push({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [envelopeLonLats] },
    properties: {
      type: 'ensemble-envelope',
      runCount: runs.length,
      label: `ENSEMBLE DISPERSION ENVELOPE (${runs.length} PERTURBATIONS)`,
    },
  });

  // 2. Perturbation Member Trajectories & Endpoints
  runs.forEach((run, idx) => {
    const wP = (run.windPerturbation || 0) / 100;
    const cP = (run.currentPerturbation || 0) / 100;
    const isNominal = idx === 0;

    const timeShift = run.label?.includes('+2h') ? 0.018 : run.label?.includes('-2h') ? -0.018 : 0;
    const offLon = wP * 0.02 + cP * 0.028 + timeShift;
    const offLat = wP * 0.024 - cP * 0.018 + timeShift;
    const endLon = originCentroid[0] + offLon;
    const endLat = originCentroid[1] + offLat;

    // Realization LineString
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [spillCentroid, [endLon, endLat]],
      },
      properties: {
        type: 'ensemble-trajectory',
        isNominal,
        label: run.label,
      },
    });

    // Realization Endpoint Point
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [endLon, endLat] },
      properties: {
        type: 'ensemble-endpoint',
        isNominal,
        label: run.label,
        originRadiusKm: run.originRadiusKm,
        score: run.topCandidateScore,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

// ─── 13. Annotations & Abstention Source (SYN-004) ────────────────────
export function buildAnnotationsGeoJson(
  scenario,
  activeTab,
  highlightedFactor,
  selectedCandidateMmsi
) {
  // Annotations strictly forbidden before Tab 06
  if (activeTab !== '06' && activeTab !== '07') {
    return EMPTY_FC;
  }

  const features = [];

  // SYN-004: Explicit Abstention Notice
  if (scenario?.id === 'SYN-004' || scenario?.report?.abstention) {
    const centroid = scenario?.spill?.centroid || [68.42, 21.84];
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [centroid[0], centroid[1] + 0.08],
      },
      properties: {
        type: 'abstention-banner',
        label: 'NO CANDIDATE · EVIDENCE FUSION — ABSTAINED',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── 14. Stage-Aware Dynamic Map Data Selector ─────────────────────────
/**
 * Stage-Aware Map Data Selector:
 * Generates ONLY the permitted GeoJSON sources for the active investigation stage.
 * All downstream or forbidden sources are strictly set to EMPTY_FC.
 *
 * Matrix:
 * 01 ARCHIVE: Incidents + SAR footprint ONLY
 * 02 DETECTION: SAR footprint + Segmentation anomaly ONLY (no origin, drift, metocean, AIS, CPA)
 * 03 SLICK ANALYSIS: SAR footprint + Slick geometry with measurement axes ONLY (no origin, drift, AIS, CPA)
 * 04 DRIFT & ORIGIN: Slick + Origin + Drift + Metocean (+ Ensemble for SYN-005) (no AIS, CPA)
 * 05 AIS TRAFFIC: Slick + Origin + Drift + AIS tracks + Gap + Vessels (NO CPA, NO candidate labels)
 * 06 EVIDENCE FUSION: Slick + Origin + Drift + Metocean + AIS + Vessels (with candidate tags) + CPA + Annotations (+ Ensemble for SYN-005)
 * 07 EVIDENCE REPORT: Complete consolidated investigation visualization
 */
export function getMapDataForStage(investigationState, activeTab = '02', options = {}) {
  const scenario = investigationState?.scenario;
  const detection = investigationState?.detection || scenario?.spill;
  const slick = investigationState?.slick || scenario?.spill;
  const drift = investigationState?.drift || scenario?.drift?.backward;
  const aisTraffic = investigationState?.aisTraffic || scenario?.aisTraffic;
  const ensemble = investigationState?.ensemble || scenario?.ensembleRuns;
  const { selectedCandidateMmsi, highlightedFactor } = options;

  // Initialize ALL 13 sources to EMPTY_FC
  const data = {
    [SOURCES.INCIDENTS]: EMPTY_FC,
    [SOURCES.SAR]: EMPTY_FC,
    [SOURCES.SEGMENTATION]: EMPTY_FC,
    [SOURCES.SLICK]: EMPTY_FC,
    [SOURCES.ORIGIN]: EMPTY_FC,
    [SOURCES.DRIFT]: EMPTY_FC,
    [SOURCES.METOCEAN]: EMPTY_FC,
    [SOURCES.AIS_TRACKS]: EMPTY_FC,
    [SOURCES.AIS_GAP]: EMPTY_FC,
    [SOURCES.VESSELS]: EMPTY_FC,
    [SOURCES.CPA]: EMPTY_FC,
    [SOURCES.ENSEMBLE]: EMPTY_FC,
    [SOURCES.ANNOTATIONS]: EMPTY_FC,
  };

  if (!scenario && activeTab !== '01') return data;

  switch (activeTab) {
    case '01':
      // 01 ARCHIVE:
      // Allowed: incident marker, case location, SAR scene footprint/context.
      // Forbidden: detection result, slick analysis, origin, drift, metocean, AIS tracks, candidates, CPA, evidence annotations.
      data[SOURCES.INCIDENTS] = buildIncidentMarkersGeoJson(INITIAL_INCIDENTS, getScenarioIdForIncident);
      if (scenario) {
        data[SOURCES.SAR] = buildSarFootprintGeoJson(scenario);
      }
      break;

    case '02':
      // 02 DETECTION:
      // Allowed: SAR scene footprint, detection/segmentation anomaly, centroid, classification.
      // Forbidden: reconstructed origin, backward drift, wind/current vectors, AIS tracks, vessel positions, candidate tags, CPA, evidence scores, candidate annotations.
      data[SOURCES.SAR] = buildSarFootprintGeoJson(scenario);
      data[SOURCES.SEGMENTATION] = buildSegmentationGeoJson(detection ? { ...scenario, spill: detection } : scenario);
      break;

    case '03':
      // 03 SLICK ANALYSIS:
      // Allowed: slick polygon, centroid, boundary, major/minor axis, morphology measurements, SAR footprint.
      // Forbidden: reconstructed origin, backward drift, AIS, candidate vessels, CPA, evidence fusion annotations.
      data[SOURCES.SAR] = buildSarFootprintGeoJson(scenario);
      data[SOURCES.SLICK] = buildSlickGeoJson(slick ? { ...scenario, spill: slick } : scenario, true /* showAxes */);
      break;

    case '04':
      // 04 DRIFT & ORIGIN:
      // Allowed: slick, reconstructed origin, backward drift trajectory, origin uncertainty, wind vectors, current vectors, metocean information, SYN-005 ensemble trajectories.
      // Forbidden: AIS vessel tracks, candidate vessel labels, CPA lines, evidence scores, candidate ranking.
      data[SOURCES.SLICK] = buildSlickGeoJson(slick ? { ...scenario, spill: slick } : scenario, false);
      data[SOURCES.ORIGIN] = buildOriginGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.DRIFT] = buildDriftGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.METOCEAN] = buildMetoceanGeoJson(scenario);
      if (scenario.id === 'SYN-005') {
        data[SOURCES.ENSEMBLE] = buildEnsembleGeoJson(scenario, ensemble);
      }
      break;

    case '05':
      // 05 AIS TRAFFIC:
      // Allowed: slick, origin, drift, AIS vessel tracks, vessel positions, AIS gap for SYN-003.
      // Forbidden: CPA lines, evidence fusion candidate ranking, evidence factor annotations, final attribution/evidence labels, candidate labels.
      data[SOURCES.SLICK] = buildSlickGeoJson(slick ? { ...scenario, spill: slick } : scenario, false);
      data[SOURCES.ORIGIN] = buildOriginGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.DRIFT] = buildDriftGeoJson(scenario, drift, highlightedFactor);
      // Continuous/gap tracks WITHOUT candidate ranking highlights:
      data[SOURCES.AIS_TRACKS] = buildAisTracksGeoJson(scenario, aisTraffic, null, null, false);
      data[SOURCES.AIS_GAP] = buildAisGapGeoJson(scenario, aisTraffic, null, null);
      // Vessel positions WITHOUT candidate tags:
      data[SOURCES.VESSELS] = buildVesselsGeoJson(scenario, aisTraffic, null, false);
      break;

    case '06':
      // 06 EVIDENCE FUSION:
      // Allowed: slick, origin, drift, metocean, AIS tracks, relevant candidates, CPA/tie lines, candidate tags, evidence annotations.
      // First stage where candidate association and CPA visualization appear.
      data[SOURCES.SLICK] = buildSlickGeoJson(slick ? { ...scenario, spill: slick } : scenario, false);
      data[SOURCES.ORIGIN] = buildOriginGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.DRIFT] = buildDriftGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.METOCEAN] = buildMetoceanGeoJson(scenario);
      data[SOURCES.AIS_TRACKS] = buildAisTracksGeoJson(scenario, aisTraffic, selectedCandidateMmsi, highlightedFactor, true);
      data[SOURCES.AIS_GAP] = buildAisGapGeoJson(scenario, aisTraffic, selectedCandidateMmsi, highlightedFactor);
      data[SOURCES.VESSELS] = buildVesselsGeoJson(scenario, aisTraffic, selectedCandidateMmsi, true);
      data[SOURCES.CPA] = buildCpaGeoJson(scenario, aisTraffic, drift, selectedCandidateMmsi, highlightedFactor);
      if (scenario.id === 'SYN-005') {
        data[SOURCES.ENSEMBLE] = buildEnsembleGeoJson(scenario, ensemble);
      }
      data[SOURCES.ANNOTATIONS] = buildAnnotationsGeoJson(scenario, activeTab, highlightedFactor, selectedCandidateMmsi);
      break;

    case '07':
    default:
      // 07 EVIDENCE REPORT:
      // Complete consolidated investigation visualization.
      data[SOURCES.SAR] = buildSarFootprintGeoJson(scenario);
      data[SOURCES.SLICK] = buildSlickGeoJson(slick ? { ...scenario, spill: slick } : scenario, false);
      data[SOURCES.ORIGIN] = buildOriginGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.DRIFT] = buildDriftGeoJson(scenario, drift, highlightedFactor);
      data[SOURCES.METOCEAN] = buildMetoceanGeoJson(scenario);
      data[SOURCES.AIS_TRACKS] = buildAisTracksGeoJson(scenario, aisTraffic, selectedCandidateMmsi, highlightedFactor, true);
      data[SOURCES.AIS_GAP] = buildAisGapGeoJson(scenario, aisTraffic, selectedCandidateMmsi, highlightedFactor);
      data[SOURCES.VESSELS] = buildVesselsGeoJson(scenario, aisTraffic, selectedCandidateMmsi, true);
      data[SOURCES.CPA] = buildCpaGeoJson(scenario, aisTraffic, drift, selectedCandidateMmsi, highlightedFactor);
      if (scenario.id === 'SYN-005') {
        data[SOURCES.ENSEMBLE] = buildEnsembleGeoJson(scenario, ensemble);
      }
      data[SOURCES.ANNOTATIONS] = buildAnnotationsGeoJson(scenario, activeTab, highlightedFactor, selectedCandidateMmsi);
      break;
  }

  return data;
}

// ─── 15. Tab-Specific Camera Bounding Box Computation ─────────────────
export function computeTabBounds(
  scenario,
  activeTab = '02',
  driftResult = null,
  aisData = null,
  selectedCandidateMmsi = null
) {
  if (!scenario) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const extend = (lon, lat) => {
    if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return;
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  };

  const spill = scenario.spill;
  const drift = driftResult || scenario.drift?.backward;
  const tracks = aisData?.tracks || scenario.aisTraffic?.tracks || [];

  if (activeTab === '01') {
    // Tab 01: SAR footprint & incident location only
    if (scenario.scene?.bbox) {
      const [bMinLon, bMinLat, bMaxLon, bMaxLat] = scenario.scene.bbox;
      extend(bMinLon, bMinLat);
      extend(bMaxLon, bMaxLat);
    }
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
  } else if (activeTab === '02') {
    // Tab 02: SAR scene bbox and detection anomaly
    if (scenario.scene?.bbox) {
      const [bMinLon, bMinLat, bMaxLon, bMaxLat] = scenario.scene.bbox;
      extend(bMinLon, bMinLat);
      extend(bMaxLon, bMaxLat);
    }
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (spill?.polygon) spill.polygon.forEach(([lon, lat]) => extend(lon, lat));
  } else if (activeTab === '03') {
    // Tab 03: Tight fit around slick morphology
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (spill?.polygon) spill.polygon.forEach(([lon, lat]) => extend(lon, lat));
  } else if (activeTab === '04') {
    // Tab 04: Slick + Reconstructed Origin + Drift trajectory
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (spill?.polygon) spill.polygon.forEach(([lon, lat]) => extend(lon, lat));
    if (drift?.originCentroid) extend(drift.originCentroid[0], drift.originCentroid[1]);
    if (drift?.originRegion) drift.originRegion.forEach(([lon, lat]) => extend(lon, lat));
  } else if (activeTab === '05') {
    // Tab 05: Slick + Origin + AIS vessel tracks
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (drift?.originCentroid) extend(drift.originCentroid[0], drift.originCentroid[1]);
    tracks.forEach((track) => {
      track.positions?.forEach((p) => extend(p.lon, p.lat));
    });
  } else if (activeTab === '06') {
    // Tab 06: Slick + Origin + Candidate vessel track
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (drift?.originCentroid) extend(drift.originCentroid[0], drift.originCentroid[1]);
    const cand = tracks.find((t) => String(t.mmsi) === String(selectedCandidateMmsi)) || tracks[0];
    cand?.positions?.forEach((p) => extend(p.lon, p.lat));
  } else {
    // Tab 07: Full consolidated extent
    if (spill?.centroid) extend(spill.centroid[0], spill.centroid[1]);
    if (drift?.originCentroid) extend(drift.originCentroid[0], drift.originCentroid[1]);
    tracks.forEach((track) => {
      track.positions?.forEach((p) => extend(p.lon, p.lat));
    });
  }

  if (minLon === Infinity || minLat === Infinity) return null;

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * Compute bounding box [west, south, east, north] across an array of FeatureCollections.
 */
export function computeBounds(featureCollections) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  let hasCoords = false;

  for (const fc of featureCollections) {
    if (!fc?.features) continue;
    for (const f of fc.features) {
      const coords = extractCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < west) west = lon;
        if (lon > east) east = lon;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
        hasCoords = true;
      }
    }
  }

  if (!hasCoords) return null;
  return [west, south, east, north];
}

function extractCoordinates(geometry) {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'LineString':
      return geometry.coordinates;
    case 'Polygon':
      return geometry.coordinates[0] || [];
    default:
      return [];
  }
}

