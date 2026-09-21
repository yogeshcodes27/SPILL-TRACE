/**
 * SPILLTRACE — Mapbox Layers & Dynamic Visibility Engine
 *
 * Configures all forensic investigation layers for Mapbox GL JS with support for:
 * - Mapbox Standard styles (`slot: 'top'`)
 * - Dynamic tab-specific visibility (Tabs 01–07)
 * - User layer toggle checkboxes
 * - Scenario-specific feature sets (SYN-001 through SYN-005)
 * - Evidence factor highlights
 */

export const SOURCES = {
  INCIDENTS: 'incident-source',
  SAR: 'sar-source',
  SEGMENTATION: 'segmentation-source',
  SLICK: 'slick-source',
  ORIGIN: 'origin-source',
  DRIFT: 'drift-source',
  METOCEAN: 'metocean-source',
  AIS_TRACKS: 'ais-track-source',
  AIS_GAP: 'ais-gap-source',
  VESSELS: 'vessel-source',
  CPA: 'cpa-source',
  ENSEMBLE: 'ensemble-source',
  ANNOTATIONS: 'annotation-source',
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

/**
 * Register all 13 GeoJSON sources and their forensic layers on the Mapbox instance.
 * Must be called once on map 'load' event.
 */
export function registerInvestigationLayers(map) {
  // 1. Register Sources (with empty GeoJSON initially)
  Object.values(SOURCES).forEach((sourceId) => {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: EMPTY_FC });
    }
  });

  const slot = 'top';

  // ─── 2. SAR Footprint Layers ─────────────────────────────────────────
  if (!map.getLayer('sar-footprint-fill')) {
    map.addLayer({
      id: 'sar-footprint-fill',
      source: SOURCES.SAR,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'sar-bbox'],
      slot,
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': 0.04,
      },
    });
  }
  if (!map.getLayer('sar-footprint-line')) {
    map.addLayer({
      id: 'sar-footprint-line',
      source: SOURCES.SAR,
      type: 'line',
      filter: ['==', ['get', 'type'], 'sar-bbox'],
      slot,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 1.5,
        'line-dasharray': [4, 3],
      },
    });
  }
  if (!map.getLayer('sar-corner-circle')) {
    map.addLayer({
      id: 'sar-corner-circle',
      source: SOURCES.SAR,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'sar-corner'],
      slot,
      paint: {
        'circle-radius': 3,
        'circle-color': '#FFFFFF',
      },
    });
  }
  if (!map.getLayer('sar-tag-symbol')) {
    map.addLayer({
      id: 'sar-tag-symbol',
      source: SOURCES.SAR,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'sar-tag'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-anchor': 'bottom-left',
        'text-offset': [0.6, -0.4],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.2,
      },
    });
  }

  // ─── 3. Semantic Segmentation Layers (Tab 02) ─────────────────────────
  if (!map.getLayer('segmentation-fill')) {
    map.addLayer({
      id: 'segmentation-fill',
      source: SOURCES.SEGMENTATION,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'segmentation-polygon'],
      slot,
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });
  }
  if (!map.getLayer('segmentation-line')) {
    map.addLayer({
      id: 'segmentation-line',
      source: SOURCES.SEGMENTATION,
      type: 'line',
      filter: ['==', ['get', 'type'], 'segmentation-polygon'],
      slot,
      paint: {
        'line-color': ['get', 'strokeColor'],
        'line-width': 2,
      },
    });
  }
  if (!map.getLayer('segmentation-centroid')) {
    map.addLayer({
      id: 'segmentation-centroid',
      source: SOURCES.SEGMENTATION,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'segmentation-centroid'],
      slot,
      paint: {
        'circle-radius': 4,
        'circle-color': ['get', 'strokeColor'],
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 1.5,
      },
    });
  }
  if (!map.getLayer('segmentation-tag')) {
    map.addLayer({
      id: 'segmentation-tag',
      source: SOURCES.SEGMENTATION,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'segmentation-tag'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, -1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }

  // ─── 4. Ensemble Envelopes & Perturbations (SYN-005) ──────────────────
  if (!map.getLayer('ensemble-envelope-fill')) {
    map.addLayer({
      id: 'ensemble-envelope-fill',
      source: SOURCES.ENSEMBLE,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'ensemble-envelope'],
      slot,
      paint: {
        'fill-color': '#EF4444',
        'fill-opacity': 0.08,
      },
    });
  }
  if (!map.getLayer('ensemble-envelope-line')) {
    map.addLayer({
      id: 'ensemble-envelope-line',
      source: SOURCES.ENSEMBLE,
      type: 'line',
      filter: ['==', ['get', 'type'], 'ensemble-envelope'],
      slot,
      paint: {
        'line-color': '#EF4444',
        'line-width': 1.5,
        'line-dasharray': [4, 4],
      },
    });
  }
  if (!map.getLayer('ensemble-trajectory-line')) {
    map.addLayer({
      id: 'ensemble-trajectory-line',
      source: SOURCES.ENSEMBLE,
      type: 'line',
      filter: ['==', ['get', 'type'], 'ensemble-trajectory'],
      slot,
      paint: {
        'line-color': ['case', ['get', 'isNominal'], '#FFFFFF', '#9CA3AF'],
        'line-width': ['case', ['get', 'isNominal'], 2, 1.2],
        'line-dasharray': [3, 3],
      },
    });
  }
  if (!map.getLayer('ensemble-endpoint-circle')) {
    map.addLayer({
      id: 'ensemble-endpoint-circle',
      source: SOURCES.ENSEMBLE,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'ensemble-endpoint'],
      slot,
      paint: {
        'circle-radius': ['case', ['get', 'isNominal'], 5, 3.5],
        'circle-color': ['case', ['get', 'isNominal'], '#FFFFFF', '#9CA3AF'],
        'circle-stroke-color': '#111111',
        'circle-stroke-width': 1.5,
      },
    });
  }

  // ─── 5. Technical Slick Layers (Tabs 03–07) ───────────────────────────
  if (!map.getLayer('slick-fill')) {
    map.addLayer({
      id: 'slick-fill',
      source: SOURCES.SLICK,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'slick-polygon'],
      slot,
      paint: {
        'fill-color': '#111111',
        'fill-opacity': 0.55,
      },
    });
  }
  if (!map.getLayer('slick-line')) {
    map.addLayer({
      id: 'slick-line',
      source: SOURCES.SLICK,
      type: 'line',
      filter: ['==', ['get', 'type'], 'slick-polygon'],
      slot,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 2,
      },
    });
  }
  if (!map.getLayer('slick-axis-major')) {
    map.addLayer({
      id: 'slick-axis-major',
      source: SOURCES.SLICK,
      type: 'line',
      filter: ['==', ['get', 'type'], 'axis-major'],
      slot,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 2.2,
      },
    });
  }
  if (!map.getLayer('slick-axis-major-label')) {
    map.addLayer({
      id: 'slick-axis-major-label',
      source: SOURCES.SLICK,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'axis-major-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-offset': [0, 1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }
  if (!map.getLayer('slick-axis-minor')) {
    map.addLayer({
      id: 'slick-axis-minor',
      source: SOURCES.SLICK,
      type: 'line',
      filter: ['==', ['get', 'type'], 'axis-minor'],
      slot,
      paint: {
        'line-color': '#CCCCCC',
        'line-width': 1.5,
        'line-dasharray': [3, 2],
      },
    });
  }
  if (!map.getLayer('slick-axis-minor-label')) {
    map.addLayer({
      id: 'slick-axis-minor-label',
      source: SOURCES.SLICK,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'axis-minor-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8,
        'text-offset': [0, 1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#CCCCCC',
        'text-halo-color': '#111111',
        'text-halo-width': 1.2,
      },
    });
  }
  if (!map.getLayer('slick-centroid')) {
    map.addLayer({
      id: 'slick-centroid',
      source: SOURCES.SLICK,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'slick-centroid'],
      slot,
      paint: {
        'circle-radius': 5,
        'circle-color': '#111111',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }

  // ─── 6. Origin & Uncertainty Layers ───────────────────────────────────
  if (!map.getLayer('origin-uncertainty-fill')) {
    map.addLayer({
      id: 'origin-uncertainty-fill',
      source: SOURCES.ORIGIN,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'origin-uncertainty-ellipse'],
      slot,
      paint: {
        'fill-color': [
          'case',
          ['get', 'isSpatialFocus'],
          '#EF4444',
          ['get', 'isDriftFocus'],
          '#3B82F6',
          '#22C55E',
        ],
        'fill-opacity': [
          'case',
          ['get', 'isSpatialFocus'],
          0.28,
          ['get', 'isDriftFocus'],
          0.24,
          0.12,
        ],
      },
    });
  }
  if (!map.getLayer('origin-uncertainty-line')) {
    map.addLayer({
      id: 'origin-uncertainty-line',
      source: SOURCES.ORIGIN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'origin-uncertainty-ellipse'],
      slot,
      paint: {
        'line-color': [
          'case',
          ['get', 'isSpatialFocus'],
          '#DC2626',
          ['get', 'isDriftFocus'],
          '#2563EB',
          '#22C55E',
        ],
        'line-width': ['case', ['get', 'isSpatialFocus'], 2.5, 1.5],
        'line-dasharray': [4, 4],
      },
    });
  }
  if (!map.getLayer('origin-region-fill')) {
    map.addLayer({
      id: 'origin-region-fill',
      source: SOURCES.ORIGIN,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'origin-region'],
      slot,
      paint: {
        'fill-color': '#22C55E',
        'fill-opacity': 0.15,
      },
    });
  }
  if (!map.getLayer('origin-region-line')) {
    map.addLayer({
      id: 'origin-region-line',
      source: SOURCES.ORIGIN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'origin-region'],
      slot,
      paint: {
        'line-color': '#22C55E',
        'line-width': 2,
        'line-dasharray': [4, 3],
      },
    });
  }
  if (!map.getLayer('origin-centroid-circle')) {
    map.addLayer({
      id: 'origin-centroid-circle',
      source: SOURCES.ORIGIN,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'origin-centroid'],
      slot,
      paint: {
        'circle-radius': 5,
        'circle-color': '#22C55E',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }
  if (!map.getLayer('origin-tag-symbol')) {
    map.addLayer({
      id: 'origin-tag-symbol',
      source: SOURCES.ORIGIN,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'origin-tag'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-offset': [0, -1.3],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }

  // ─── 7. Backward Drift Layers ─────────────────────────────────────────
  if (!map.getLayer('drift-envelope-fill')) {
    map.addLayer({
      id: 'drift-envelope-fill',
      source: SOURCES.DRIFT,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'advection-envelope'],
      slot,
      paint: {
        'fill-color': '#3B82F6',
        'fill-opacity': 0.08,
      },
    });
  }
  if (!map.getLayer('drift-envelope-line')) {
    map.addLayer({
      id: 'drift-envelope-line',
      source: SOURCES.DRIFT,
      type: 'line',
      filter: ['==', ['get', 'type'], 'advection-envelope'],
      slot,
      paint: {
        'line-color': '#60A5FA',
        'line-width': 1,
        'line-dasharray': [3, 3],
      },
    });
  }
  if (!map.getLayer('drift-trajectory-line')) {
    map.addLayer({
      id: 'drift-trajectory-line',
      source: SOURCES.DRIFT,
      type: 'line',
      filter: ['==', ['get', 'type'], 'drift-trajectory'],
      slot,
      paint: {
        'line-color': ['case', ['get', 'isDriftFocus'], '#60A5FA', '#3B82F6'],
        'line-width': ['case', ['get', 'isDriftFocus'], 3.5, 2.5],
        'line-dasharray': [6, 4],
      },
    });
  }
  if (!map.getLayer('drift-advection-point')) {
    map.addLayer({
      id: 'drift-advection-point',
      source: SOURCES.DRIFT,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'advection-point'],
      slot,
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#3B82F6',
        'circle-stroke-width': 1.5,
      },
    });
  }
  if (!map.getLayer('drift-advection-label')) {
    map.addLayer({
      id: 'drift-advection-label',
      source: SOURCES.DRIFT,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'advection-point'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8,
        'text-offset': [0, 1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#93C5FD',
        'text-halo-color': '#111111',
        'text-halo-width': 1.2,
      },
    });
  }
  if (!map.getLayer('drift-distance-symbol')) {
    map.addLayer({
      id: 'drift-distance-symbol',
      source: SOURCES.DRIFT,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'drift-distance-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8,
        'text-offset': [0, -1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }
  if (!map.getLayer('drift-forward-envelope-fill')) {
    map.addLayer({
      id: 'drift-forward-envelope-fill',
      source: SOURCES.DRIFT,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'drift-forward-envelope'],
      slot,
      paint: {
        'fill-color': '#3B82F6',
        'fill-opacity': 0.06,
      },
    });
  }

  // ─── 8. Metocean Forcing Vector Layers ────────────────────────────────
  if (!map.getLayer('metocean-wind-line')) {
    map.addLayer({
      id: 'metocean-wind-line',
      source: SOURCES.METOCEAN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'metocean-wind'],
      slot,
      paint: {
        'line-color': '#9CA3AF',
        'line-width': 2,
      },
    });
  }
  if (!map.getLayer('metocean-wind-symbol')) {
    map.addLayer({
      id: 'metocean-wind-symbol',
      source: SOURCES.METOCEAN,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'metocean-wind-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#D1D5DB',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }
  if (!map.getLayer('metocean-current-line')) {
    map.addLayer({
      id: 'metocean-current-line',
      source: SOURCES.METOCEAN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'metocean-current'],
      slot,
      paint: {
        'line-color': '#60A5FA',
        'line-width': 2,
      },
    });
  }
  if (!map.getLayer('metocean-current-symbol')) {
    map.addLayer({
      id: 'metocean-current-symbol',
      source: SOURCES.METOCEAN,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'metocean-current-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#93C5FD',
        'text-halo-color': '#111111',
        'text-halo-width': 1.5,
      },
    });
  }

  // ─── 9. AIS Tracks Layers ─────────────────────────────────────────────
  if (!map.getLayer('ais-tracks-line')) {
    map.addLayer({
      id: 'ais-tracks-line',
      source: SOURCES.AIS_TRACKS,
      type: 'line',
      filter: ['==', ['get', 'type'], 'ais-track'],
      slot,
      paint: {
        'line-color': [
          'case',
          ['get', 'isCandidate'],
          '#FACC15',
          '#94A3B8',
        ],
        'line-width': [
          'case',
          ['get', 'isCandidate'],
          3.5,
          ['get', 'hasSelection'],
          1.2,
          1.8,
        ],
        'line-opacity': [
          'case',
          ['get', 'isCandidate'],
          1.0,
          ['get', 'hasSelection'],
          0.25,
          0.65,
        ],
      },
    });
  }
  if (!map.getLayer('ais-track-pips')) {
    map.addLayer({
      id: 'ais-track-pips',
      source: SOURCES.AIS_TRACKS,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'track-pip'],
      slot,
      paint: {
        'circle-radius': ['case', ['get', 'isCandidate'], 2.5, 1.8],
        'circle-color': ['case', ['get', 'isCandidate'], '#FACC15', '#94A3B8'],
        'circle-opacity': 0.8,
      },
    });
  }

  // ─── 10. AIS Gap Layers (SYN-003) ─────────────────────────────────────
  if (!map.getLayer('ais-gap-line')) {
    map.addLayer({
      id: 'ais-gap-line',
      source: SOURCES.AIS_GAP,
      type: 'line',
      filter: ['==', ['get', 'type'], 'ais-gap-line'],
      slot,
      paint: {
        'line-color': '#EF4444',
        'line-width': ['case', ['get', 'isGapFocus'], 4, 2.5],
        'line-dasharray': [4, 3],
      },
    });
  }
  if (!map.getLayer('ais-gap-label-symbol')) {
    map.addLayer({
      id: 'ais-gap-label-symbol',
      source: SOURCES.AIS_GAP,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'ais-gap-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, -1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#EF4444',
        'text-halo-color': '#111111',
        'text-halo-width': 2,
      },
    });
  }

  // ─── 11. CPA Layers ───────────────────────────────────────────────────
  if (!map.getLayer('cpa-line')) {
    map.addLayer({
      id: 'cpa-line',
      source: SOURCES.CPA,
      type: 'line',
      filter: ['==', ['get', 'type'], 'cpa-line'],
      slot,
      paint: {
        'line-color': ['case', ['get', 'isSpatialFocus'], '#DC2626', '#FFFFFF'],
        'line-width': ['case', ['get', 'isSpatialFocus'], 2.5, 1.5],
        'line-dasharray': [4, 3],
      },
    });
  }
  if (!map.getLayer('cpa-badge-symbol')) {
    map.addLayer({
      id: 'cpa-badge-symbol',
      source: SOURCES.CPA,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'cpa-badge'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-offset': [0, -1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 2,
      },
    });
  }
  if (!map.getLayer('temporal-tag-symbol')) {
    map.addLayer({
      id: 'temporal-tag-symbol',
      source: SOURCES.CPA,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'temporal-focus-tag'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-offset': [0, 1.3],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#10B981',
        'text-halo-color': '#111111',
        'text-halo-width': 2,
      },
    });
  }

  // ─── 12. Vessels & Lookahead Layers ───────────────────────────────────
  if (!map.getLayer('vessel-lookahead-line')) {
    map.addLayer({
      id: 'vessel-lookahead-line',
      source: SOURCES.VESSELS,
      type: 'line',
      filter: ['==', ['get', 'type'], 'vessel-lookahead'],
      slot,
      paint: {
        'line-color': ['case', ['get', 'isCandidate'], '#FACC15', '#6B7280'],
        'line-width': ['case', ['get', 'isCandidate'], 2, 1.2],
        'line-dasharray': [2, 3],
      },
    });
  }
  if (!map.getLayer('vessel-position-circle')) {
    map.addLayer({
      id: 'vessel-position-circle',
      source: SOURCES.VESSELS,
      type: 'circle',
      filter: ['==', ['get', 'type'], 'vessel-position'],
      slot,
      paint: {
        'circle-radius': ['case', ['get', 'isCandidate'], 6, 4],
        'circle-color': ['case', ['get', 'isCandidate'], '#FACC15', '#E2E8F0'],
        'circle-stroke-color': '#111111',
        'circle-stroke-width': 2,
      },
    });
  }
  if (!map.getLayer('candidate-tag-symbol')) {
    map.addLayer({
      id: 'candidate-tag-symbol',
      source: SOURCES.VESSELS,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'candidate-tag'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, -1.5],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FACC15',
        'text-halo-color': '#111111',
        'text-halo-width': 2,
      },
    });
  }

  // ─── 13. Annotations & Abstention Banner (SYN-004) ────────────────────
  if (!map.getLayer('abstention-banner-symbol')) {
    map.addLayer({
      id: 'abstention-banner-symbol',
      source: SOURCES.ANNOTATIONS,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'abstention-banner'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, -2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#EF4444',
        'text-halo-color': '#000000',
        'text-halo-width': 2.5,
      },
    });
  }

  // ─── 14. Incident Markers Layers ──────────────────────────────────────
  if (!map.getLayer('incident-marker-circle')) {
    map.addLayer({
      id: 'incident-marker-circle',
      source: SOURCES.INCIDENTS,
      type: 'circle',
      slot,
      paint: {
        'circle-radius': 5,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#111111',
        'circle-stroke-width': 2,
      },
    });
  }
  if (!map.getLayer('incident-marker-label')) {
    map.addLayer({
      id: 'incident-marker-label',
      source: SOURCES.INCIDENTS,
      type: 'symbol',
      slot,
      layout: {
        'text-field': ['get', 'code'],
        'text-size': 10,
        'text-offset': [0, -1.4],
        'text-anchor': 'bottom',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#111111',
        'text-halo-width': 1.2,
      },
    });
  }
}

/**
 * Mapping of layer groups to layer IDs for visibility toggling.
 */
const LAYER_GROUPS = {
  sar: ['sar-footprint-fill', 'sar-footprint-line', 'sar-corner-circle', 'sar-tag-symbol'],
  segmentation: ['segmentation-fill', 'segmentation-line', 'segmentation-centroid', 'segmentation-tag'],
  slick: ['slick-fill', 'slick-line', 'slick-centroid'],
  slickAxes: ['slick-axis-major', 'slick-axis-major-label', 'slick-axis-minor', 'slick-axis-minor-label'],
  origin: ['origin-uncertainty-fill', 'origin-uncertainty-line', 'origin-region-fill', 'origin-region-line', 'origin-centroid-circle', 'origin-tag-symbol'],
  drift: ['drift-envelope-fill', 'drift-envelope-line', 'drift-trajectory-line', 'drift-advection-point', 'drift-advection-label', 'drift-distance-symbol', 'drift-forward-envelope-fill'],
  metocean: ['metocean-wind-line', 'metocean-wind-symbol', 'metocean-current-line', 'metocean-current-symbol'],
  ais: ['ais-tracks-line', 'ais-track-pips', 'vessel-lookahead-line', 'vessel-position-circle', 'ais-gap-line', 'ais-gap-label-symbol'],
  candidateTags: ['candidate-tag-symbol'],
  cpa: ['cpa-line', 'cpa-badge-symbol', 'temporal-tag-symbol'],
  ensemble: ['ensemble-envelope-fill', 'ensemble-envelope-line', 'ensemble-trajectory-line', 'ensemble-endpoint-circle'],
  annotations: ['abstention-banner-symbol'],
  incidents: ['incident-marker-circle', 'incident-marker-label'],
};

/**
 * Set visibility of a list of Mapbox layers.
 */
function setLayersVisibility(map, layerIds, isVisible) {
  const value = isVisible ? 'visible' : 'none';
  layerIds.forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value);
    }
  });
}

/**
 * Dynamically updates layer visibility based on:
 * - active investigation tab ('01' to '07')
 * - user layer checkboxes (`visibleLayers`)
 * - active scenarioId (e.g. SYN-005 enables ensemble, SYN-003 enables gap)
 */
export function updateMapboxLayerVisibility(
  map,
  activeTab = '02',
  visibleLayers = {},
  scenarioId = 'SYN-001'
) {
  if (!map || !map.isStyleLoaded()) return;

  const isSyn005 = scenarioId === 'SYN-005';
  const tab = activeTab;

  // 1. Incidents (Tab 01 only)
  const showIncidents = tab === '01';
  setLayersVisibility(map, LAYER_GROUPS.incidents, showIncidents);

  // 2. SAR Footprint (Tab 01 context, Tab 02 detection scene, Tab 03 & Tab 07)
  const showSar = (visibleLayers.sarFootprint ?? true) && (tab === '01' || tab === '02' || tab === '03' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.sar, showSar);

  // 3. Semantic Segmentation Anomaly (Tab 02 only)
  const showSeg = (visibleLayers.spill ?? true) && tab === '02';
  setLayersVisibility(map, LAYER_GROUPS.segmentation, showSeg);

  // 4. Characterized Slick Geometry (Tabs 03–07)
  const showSlick = (visibleLayers.spill ?? true) && (tab === '03' || tab === '04' || tab === '05' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.slick, showSlick);

  // 4b. Slick Measurement Axes (Tab 03 only)
  const showAxes = showSlick && tab === '03';
  setLayersVisibility(map, LAYER_GROUPS.slickAxes, showAxes);

  // 5. Origin & Drift (Tabs 04–07)
  const showDrift = (visibleLayers.drift ?? true) && (tab === '04' || tab === '05' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.drift, showDrift);
  setLayersVisibility(map, LAYER_GROUPS.origin, showDrift);

  // 6. Metocean Forcing Vectors (Tabs 04, 06 & 07 — NOT Tab 02, 03, or 05)
  const showMetocean = (visibleLayers.metocean ?? true) && (tab === '04' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.metocean, showMetocean);

  // 7. AIS Vessel Tracks & Traffic (Tabs 05–07)
  const showAis = (visibleLayers.ais ?? true) && (tab === '05' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.ais, showAis);

  // 7b. Candidate Lead Tag (Tabs 06 & 07 only — NOT Tab 05)
  const showCandidateTags = (tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.candidateTags, showCandidateTags);

  // 8. CPA Tie-Line & Spatial Relationships (Tabs 06 & 07 only — NOT Tab 05)
  const showCpa = showAis && (tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.cpa, showCpa);

  // 9. Ensemble Dispersion (SYN-005 ONLY, Tabs 04, 06 & 07)
  const showEnsemble = isSyn005 && (visibleLayers.uncertainty ?? true) && (tab === '04' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.ensemble, showEnsemble);

  // 10. Annotations / Abstention Banner (Tabs 06 & 07)
  const showAnnotations = tab === '06' || tab === '07';
  setLayersVisibility(map, LAYER_GROUPS.annotations, showAnnotations);
}

