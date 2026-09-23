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
 * Generate a crisp 32x32 ImageData with a professional top-down maritime vessel silhouette.
 * Hull points North (0° / top) so it can be dynamically oriented by COG in Mapbox symbol layer.
 */
export function createVesselCanvas(fillColor, strokeColor, isSelected) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  // Subtle contrasting halo/shadow so it remains clearly visible over satellite basemap
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = isSelected ? 4 : 2.5;
  ctx.shadowOffsetY = 1;

  // Streamlined top-down vessel hull pointed North (0°)
  ctx.beginPath();
  ctx.moveTo(16, 3); // Bow tip
  // Starboard curve
  ctx.bezierCurveTo(19.5, 7, 21.5, 11.5, 21.5, 16);
  ctx.lineTo(21.5, 22.5);
  ctx.quadraticCurveTo(21.5, 26.5, 18.5, 27); // Starboard quarter
  // Transom stern
  ctx.lineTo(13.5, 27);
  // Port quarter
  ctx.quadraticCurveTo(10.5, 26.5, 10.5, 22.5);
  ctx.lineTo(10.5, 16);
  ctx.bezierCurveTo(10.5, 11.5, 12.5, 7, 16, 3);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.lineWidth = isSelected ? 2.2 : 1.6;
  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Reset shadow for bridge deckhouse
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Bridge / Wheelhouse
  ctx.fillStyle = isSelected ? '#B45309' : '#334155';
  ctx.fillRect(13.5, 18, 5, 4.5);
  ctx.strokeStyle = isSelected ? '#78350F' : '#0F172A';
  ctx.lineWidth = 1;
  ctx.strokeRect(13.5, 18, 5, 4.5);

  // Radar mast dot
  ctx.fillStyle = isSelected ? '#FEF08A' : '#E2E8F0';
  ctx.beginPath();
  ctx.arc(16, 14, 1.2, 0, Math.PI * 2);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

/**
 * Register vessel-normal and vessel-selected images onto a Mapbox map instance.
 * Provides instant crisp procedural fallback, immediately supplemented by authentic
 * high-resolution 3D rendered maritime vessel textures with dynamic COG alignment.
 */
export function registerVesselImages(map) {
  if (!map) return;

  // 1. Instant synchronous procedural baseline
  if (!map.hasImage('vessel-normal')) {
    const normalData = createVesselCanvas('#FFFFFF', '#0F172A', false);
    if (normalData) map.addImage('vessel-normal', normalData, { pixelRatio: 1 });
  }
  if (!map.hasImage('vessel-selected')) {
    const selectedData = createVesselCanvas('#FFD54F', '#000000', true);
    if (selectedData) map.addImage('vessel-selected', selectedData, { pixelRatio: 1 });
  }

  // 2. Load authentic high-resolution 3D vessel models with drop shadow and tactical selection aura
  if (typeof window !== 'undefined' && map.loadImage) {
    map.loadImage('/images/vessel_3d_normal.png', (err, img) => {
      if (!err && img && map.getSource) {
        if (map.hasImage('vessel-normal')) {
          map.removeImage('vessel-normal');
        }
        map.addImage('vessel-normal', img, { pixelRatio: 2 });
      }
    });

    map.loadImage('/images/vessel_3d_selected.png', (err, img) => {
      if (!err && img && map.getSource) {
        if (map.hasImage('vessel-selected')) {
          map.removeImage('vessel-selected');
        }
        map.addImage('vessel-selected', img, { pixelRatio: 2 });
      }
    });
  }
}

/**
 * Register all 13 GeoJSON sources and their forensic layers on the Mapbox instance.
 * Must be called once on map 'load' event.
 */
export function registerInvestigationLayers(map) {
  // Ensure top-down ship silhouette images are registered
  registerVesselImages(map);

  if (!map._vesselImageListenerAdded) {
    map._vesselImageListenerAdded = true;
    map.on('styleimagemissing', (e) => {
      if (e.id === 'vessel-normal' || e.id === 'vessel-selected') {
        registerVesselImages(map);
      }
    });
  }

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
        'fill-color': '#78909C',
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
        'line-color': '#78909C',
        'line-width': 1.5,
        'line-dasharray': [6, 4],
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
        'circle-color': '#78909C',
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
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#B0BEC5',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'circle-radius': 4.5,
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
        'text-size': 9.5,
        'text-offset': [0, -1.3],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.2,
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
        'fill-color': '#CE93D8',
        'fill-opacity': 0.12,
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
        'line-color': '#CE93D8',
        'line-width': 1.8,
        'line-dasharray': [5, 4],
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
        'line-color': ['case', ['get', 'isNominal'], '#E1BEE7', '#AB47BC'],
        'line-width': ['case', ['get', 'isNominal'], 2.2, 1.2],
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
        'circle-color': ['case', ['get', 'isNominal'], '#FFFFFF', '#BA68C8'],
        'circle-stroke-color': '#4A148C',
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
        'fill-color': '#D32F2F',
        'fill-opacity': 0.45,
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
        'line-width': 2.0,
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
        'text-size': 8.5,
        'text-offset': [0, 1.2],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': '#FFCDD2',
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
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFCDD2',
        'text-halo-color': '#0A1118',
        'text-halo-width': 1.8,
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
        'circle-color': '#D32F2F',
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
          '#EF5350',
          ['get', 'isDriftFocus'],
          '#00BFA5',
          '#00BFA5',
        ],
        'fill-opacity': [
          'case',
          ['get', 'isSpatialFocus'],
          0.28,
          ['get', 'isDriftFocus'],
          0.22,
          0.15,
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
          '#EF5350',
          ['get', 'isDriftFocus'],
          '#00E676',
          '#00BFA5',
        ],
        'line-width': ['case', ['get', 'isSpatialFocus'], 2.5, 1.8],
        'line-dasharray': [5, 4],
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
        'fill-color': '#00BFA5',
        'fill-opacity': 0.18,
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
        'line-color': '#00BFA5',
        'line-width': 2.0,
        'line-dasharray': [4, 3],
      },
    });
  }
  // Origin 50%, 75%, 95% Containment Rings (Lagrangian probability containment)
  if (!map.getLayer('origin-containment-fill')) {
    map.addLayer({
      id: 'origin-containment-fill',
      source: SOURCES.ORIGIN,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'origin-containment-ring'],
      slot,
      paint: {
        'fill-color': '#00E676',
        'fill-opacity': [
          'case',
          ['==', ['get', 'tier'], 50],
          0.20,
          ['==', ['get', 'tier'], 75],
          0.12,
          0.06,
        ],
      },
    });
  }
  if (!map.getLayer('origin-containment-line')) {
    map.addLayer({
      id: 'origin-containment-line',
      source: SOURCES.ORIGIN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'origin-containment-ring'],
      slot,
      paint: {
        'line-color': '#00E676',
        'line-width': [
          'case',
          ['==', ['get', 'tier'], 50],
          2.0,
          ['==', ['get', 'tier'], 75],
          1.6,
          1.3,
        ],
        'line-dasharray': [4, 3],
      },
    });
  }
  if (!map.getLayer('origin-containment-label-symbol')) {
    map.addLayer({
      id: 'origin-containment-label-symbol',
      source: SOURCES.ORIGIN,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'origin-containment-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 8.5,
        'text-anchor': 'bottom',
        'text-offset': [0, -0.6],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#69F0AE',
        'text-halo-color': '#0A1118',
        'text-halo-width': 1.8,
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
        'circle-radius': 6.0,
        'circle-color': '#00E676',
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2.2,
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
        'text-size': 9.5,
        'text-offset': [0, -1.8],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#69F0AE',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.2,
      },
    });
  }

  // ─── 7. Backward Drift Layers ─────────────────────────────────────────
  // Stochastic Ensemble Dispersion Fan Lines
  if (!map.getLayer('drift-ensemble-fan-line')) {
    map.addLayer({
      id: 'drift-ensemble-fan-line',
      source: SOURCES.DRIFT,
      type: 'line',
      filter: ['==', ['get', 'type'], 'drift-ensemble-fan'],
      slot,
      paint: {
        'line-color': '#4DB6AC',
        'line-width': 1.1,
        'line-dasharray': [3, 4],
        'line-opacity': 0.35,
      },
    });
  }
  if (!map.getLayer('drift-envelope-fill')) {
    map.addLayer({
      id: 'drift-envelope-fill',
      source: SOURCES.DRIFT,
      type: 'fill',
      filter: ['==', ['get', 'type'], 'advection-envelope'],
      slot,
      paint: {
        'fill-color': '#00BFA5',
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
        'line-color': '#4DB6AC',
        'line-width': 1.3,
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
        'line-color': ['case', ['get', 'isDriftFocus'], '#00E676', '#00BFA5'],
        'line-width': ['case', ['get', 'isDriftFocus'], 3.2, 2.2],
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
        'circle-stroke-color': '#00BFA5',
        'circle-stroke-width': 1.4,
      },
    });
  }
  if (!map.getLayer('drift-time-markers-symbol')) {
    map.addLayer({
      id: 'drift-time-markers-symbol',
      source: SOURCES.DRIFT,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'drift-time-marker'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9.5,
        'text-anchor': 'left',
        'text-offset': [0.6, 0.4],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#80DEEA',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'text-size': 9,
        'text-offset': [0, -1.2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
      },
    });
  }
  // Forward Dispersion Forecast Layers
  if (!map.getLayer('drift-forward-line')) {
    map.addLayer({
      id: 'drift-forward-line',
      source: SOURCES.DRIFT,
      type: 'line',
      filter: ['==', ['get', 'type'], 'drift-forward-line'],
      slot,
      paint: {
        'line-color': '#29B6F6',
        'line-width': 1.8,
        'line-dasharray': [5, 4],
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
        'fill-color': '#0288D1',
        'fill-opacity': 0.12,
      },
    });
  }
  if (!map.getLayer('drift-forward-envelope-line')) {
    map.addLayer({
      id: 'drift-forward-envelope-line',
      source: SOURCES.DRIFT,
      type: 'line',
      filter: ['==', ['get', 'type'], 'drift-forward-envelope'],
      slot,
      paint: {
        'line-color': '#29B6F6',
        'line-width': 1.6,
        'line-dasharray': [4, 4],
      },
    });
  }
  if (!map.getLayer('drift-forward-label-symbol')) {
    map.addLayer({
      id: 'drift-forward-label-symbol',
      source: SOURCES.DRIFT,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'drift-forward-label'],
      slot,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 9,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#81D4FA',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': '#B0BEC5',
        'line-width': 2.0,
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
        'text-size': 8.5,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#ECEFF1',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': '#4FC3F7',
        'line-width': 2.0,
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
        'text-size': 8.5,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#E1F5FE',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
      },
    });
  }

  // ─── 8. Metocean Forcing Layers ───────────────────────────────────────
  if (!map.getLayer('metocean-wind-line')) {
    map.addLayer({
      id: 'metocean-wind-line',
      source: SOURCES.METOCEAN,
      type: 'line',
      filter: ['==', ['get', 'type'], 'metocean-wind'],
      slot,
      paint: {
        'line-color': '#64B5F6',
        'line-width': ['case', ['get', 'isPrimary'], 2.4, 1.4],
        'line-dasharray': [3, 2],
        'line-opacity': 0.85,
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
        'text-size': 8.5,
        'text-anchor': 'left',
        'text-offset': [0.6, 0],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#90CAF9',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': '#4DB6AC',
        'line-width': ['case', ['get', 'isPrimary'], 2.4, 1.4],
        'line-dasharray': [4, 3],
        'line-opacity': 0.85,
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
        'text-size': 8.5,
        'text-anchor': 'left',
        'text-offset': [0.6, 0],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#80CBC4',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
      },
    });
  }

  // ─── 9. AIS Tracks Layers ─────────────────────────────────────────────
  if (!map.getLayer('ais-tracks-casing')) {
    map.addLayer({
      id: 'ais-tracks-casing',
      source: SOURCES.AIS_TRACKS,
      type: 'line',
      filter: ['all', ['==', ['get', 'type'], 'ais-track'], ['==', ['get', 'isCandidate'], true]],
      slot,
      paint: {
        'line-color': '#0F172A',
        'line-width': 4.2,
        'line-opacity': 0.85,
      },
    });
  }
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
          '#FFD54F',
          '#42A5F5',
        ],
        'line-width': [
          'case',
          ['get', 'isCandidate'],
          2.8,
          ['get', 'hasSelection'],
          1.2,
          1.5,
        ],
        'line-opacity': [
          'case',
          ['get', 'isCandidate'],
          1.0,
          ['get', 'hasSelection'],
          0.25,
          0.55,
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
        'circle-color': ['case', ['get', 'isCandidate'], '#FFD54F', '#90CAF9'],
        'circle-opacity': 0.85,
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
        'line-color': '#FF5252',
        'line-width': ['case', ['get', 'isGapFocus'], 3.8, 2.8],
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
        'text-size': 9,
        'text-offset': [0, -1.2],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FF5252',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': ['case', ['get', 'isSpatialFocus'], '#FF5252', '#FFD54F'],
        'line-width': ['case', ['get', 'isSpatialFocus'], 2.5, 1.8],
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
        'text-size': 8.5,
        'text-offset': [0, -1.2],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'text-size': 8.5,
        'text-offset': [0, 1.3],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#00E676',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'line-color': ['case', ['get', 'isCandidate'], '#FFD54F', '#78909C'],
        'line-width': ['case', ['get', 'isCandidate'], 2.0, 1.2],
        'line-dasharray': [2, 3],
      },
    });
  }
  if (!map.getLayer('vessels-symbol')) {
    map.addLayer({
      id: 'vessels-symbol',
      source: SOURCES.VESSELS,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'vessel-position'],
      slot,
      layout: {
        'icon-image': [
          'case',
          ['get', 'isCandidate'],
          'vessel-selected',
          'vessel-normal',
        ],
        'icon-rotate': ['coalesce', ['get', 'cog'], 0],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6, 0.14,
          8, 0.22,
          10, 0.35,
          12, 0.52,
          14, 0.75,
          16, 1.05,
        ],
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
        'text-size': 9,
        'text-anchor': 'top',
        'text-offset': [0, 1.3],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFD54F',
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
      },
    });
  }

  if (!map.getLayer('vessel-name-label')) {
    map.addLayer({
      id: 'vessel-name-label',
      source: SOURCES.VESSELS,
      type: 'symbol',
      filter: ['==', ['get', 'type'], 'vessel-position'],
      minzoom: 8.0,
      slot,
      layout: {
        'text-field': ['concat', ['get', 'vesselName'], ' · ', ['to-string', ['get', 'sog']], ' kn'],
        'text-size': 8.5,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.3],
        'text-allow-overlap': false,
        'text-optional': true,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': ['case', ['get', 'isCandidate'], '#FFD54F', '#CFD8DC'],
        'text-halo-color': '#0A1118',
        'text-halo-width': 2.0,
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
        'text-size': 10,
        'text-offset': [0, -1.8],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FF5252',
        'text-halo-color': '#000000',
        'text-halo-width': 2.2,
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
        'circle-stroke-color': '#0A1118',
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
        'text-size': 9.5,
        'text-offset': [0, -1.4],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#0A1118',
        'text-halo-width': 1.8,
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
  origin: [
    'origin-containment-fill',
    'origin-containment-line',
    'origin-containment-label-symbol',
    'origin-uncertainty-fill',
    'origin-uncertainty-line',
    'origin-region-fill',
    'origin-region-line',
    'origin-centroid-circle',
    'origin-tag-symbol',
  ],
  drift: [
    'drift-ensemble-fan-line',
    'drift-envelope-fill',
    'drift-envelope-line',
    'drift-trajectory-line',
    'drift-advection-point',
    'drift-time-markers-symbol',
    'drift-distance-symbol',
    'drift-forward-line',
    'drift-forward-envelope-fill',
    'drift-forward-envelope-line',
    'drift-forward-label-symbol',
  ],
  metocean: ['metocean-wind-line', 'metocean-wind-symbol', 'metocean-current-line', 'metocean-current-symbol'],
  ais: ['ais-tracks-casing', 'ais-tracks-line', 'ais-track-pips', 'vessel-lookahead-line', 'vessels-symbol', 'vessel-name-label', 'ais-gap-line', 'ais-gap-label-symbol'],
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

  // 2. SAR Footprint (Tab 01 context, Tab 02 detection scene, Tab 03 context)
  const showSar = (visibleLayers.sarFootprint ?? true) && (tab === '01' || tab === '02' || tab === '03');
  setLayersVisibility(map, LAYER_GROUPS.sar, showSar);

  // 3. Semantic Segmentation Anomaly (Tab 02 only)
  const showSeg = (visibleLayers.spill ?? true) && tab === '02';
  setLayersVisibility(map, LAYER_GROUPS.segmentation, showSeg);

  // 4. Characterized Slick / Observation Geometry (Tabs 01, 03–07)
  const showSlick = (visibleLayers.spill ?? true) && (tab === '01' || tab === '03' || tab === '04' || tab === '05' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.slick, showSlick);

  // 4b. Slick Measurement Axes (Tab 03 only)
  const showAxes = showSlick && tab === '03';
  setLayersVisibility(map, LAYER_GROUPS.slickAxes, showAxes);

  // 5. Origin & Drift (Tabs 04–07)
  const showDrift = (visibleLayers.drift ?? true) && (tab === '04' || tab === '05' || tab === '06' || tab === '07');
  setLayersVisibility(map, LAYER_GROUPS.drift, showDrift);
  setLayersVisibility(map, LAYER_GROUPS.origin, showDrift);

  // 6. Metocean Forcing Vectors (Tabs 04 & 06 — NOT Tab 01, 02, 03, 05, or 07)
  const showMetocean = (visibleLayers.metocean ?? true) && (tab === '04' || tab === '06');
  setLayersVisibility(map, LAYER_GROUPS.metocean, showMetocean);

  // 7. AIS Vessel Tracks & Traffic (Tabs 01 context, 05–07 investigation & record)
  const showAis = (visibleLayers.ais ?? true) && (tab === '01' || tab === '05' || tab === '06' || tab === '07');
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

