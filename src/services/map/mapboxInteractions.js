/**
 * SPILLTRACE — Mapbox Interactions & Event Handlers
 *
 * Sets up bidirectional click, hover, popup, and pointer events
 * for the Mapbox investigation map instance.
 */

import mapboxgl from 'mapbox-gl';

const INTERACTIVE_LAYERS = [
  'vessel-position-circle',
  'ais-tracks-line',
  'slick-fill',
  'slick-line',
  'origin-region-fill',
  'origin-uncertainty-fill',
  'origin-centroid-circle',
  'ais-gap-line',
  'incident-marker-circle',
  'segmentation-fill',
];

/**
 * Attaches bidirectional interaction handlers to the Mapbox instance.
 * Returns a cleanup function to remove listeners.
 */
export function setupMapboxInteractions(map, {
  onSelectCandidate,
  onFeatureSelect,
  onSelectIncident,
  onHoverCoords,
}) {
  if (!map) return () => {};

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'technical-mapbox-popup',
    offset: 12,
  });

  // ── 1. Cursor Hover & Pointers ───────────────────────────────────────
  const onMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  };

  INTERACTIVE_LAYERS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.on('mouseenter', layerId, onMouseEnter);
      map.on('mouseleave', layerId, onMouseLeave);
    }
  });

  // ── 2. Real-Time Cursor Coordinates ──────────────────────────────────
  const onMouseMove = (e) => {
    if (onHoverCoords) {
      onHoverCoords({
        lat: e.lngLat.lat.toFixed(4),
        lng: e.lngLat.lng.toFixed(4),
      });
    }
  };
  map.on('mousemove', onMouseMove);

  // ── 3. Tooltip Popups on Hover ───────────────────────────────────────
  // Vessel tooltip
  const onVesselHover = (e) => {
    if (!e.features?.length) return;
    const f = e.features[0];
    const p = f.properties || {};
    const coords = e.lngLat;

    popup
      .setLngLat(coords)
      .setHTML(
        `<div class="font-mono text-[10px] p-0.5 bg-[#111111] text-white">
          <span class="font-bold text-[#FACC15] block uppercase">${p.vesselName || 'VESSEL'} // ${p.mmsi || ''}</span>
          <span>SOG: ${p.sog ?? '—'} kn · COG: ${p.cog ?? '—'}° · ${p.vesselType || 'Vessel'}</span>
        </div>`
      )
      .addTo(map);
  };
  if (map.getLayer('vessel-position-circle')) {
    map.on('mousemove', 'vessel-position-circle', onVesselHover);
  }

  // Slick tooltip
  const onSlickHover = (e) => {
    if (!e.features?.length) return;
    const f = e.features[0];
    const p = f.properties || {};
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="font-mono text-[10px] p-0.5 bg-[#111111] text-white">
          <span class="font-bold text-white block uppercase">OBSERVED SLICK GEOMETRY</span>
          <span>Area: ${p.areaKm2 ?? '—'} km² · Major: ${p.majorAxisKm ?? '—'} km</span>
        </div>`
      )
      .addTo(map);
  };
  if (map.getLayer('slick-fill')) {
    map.on('mousemove', 'slick-fill', onSlickHover);
  }

  // AIS Gap tooltip
  const onGapHover = (e) => {
    if (!e.features?.length) return;
    const f = e.features[0];
    const p = f.properties || {};
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="font-mono text-[10px] p-0.5 bg-[#111111] text-[#EF4444]">
          <span class="font-bold block uppercase">[ AIS TRANSMISSION GAP ${p.gapHours || ''}h ]</span>
          <span class="text-white text-[9px]">Duration: ${p.durationMinutes || ''} min · MMSI: ${p.mmsi || ''}</span>
        </div>`
      )
      .addTo(map);
  };
  if (map.getLayer('ais-gap-line')) {
    map.on('mousemove', 'ais-gap-line', onGapHover);
  }

  // ── 4. Feature Click Handlers ─────────────────────────────────────────
  const onVesselClick = (e) => {
    if (!e.features?.length) return;
    const mmsi = e.features[0].properties?.mmsi;
    if (mmsi && onSelectCandidate) {
      onSelectCandidate(mmsi);
    }
  };
  if (map.getLayer('vessel-position-circle')) {
    map.on('click', 'vessel-position-circle', onVesselClick);
  }
  if (map.getLayer('ais-tracks-line')) {
    map.on('click', 'ais-tracks-line', onVesselClick);
  }

  const onSlickClick = () => {
    if (onFeatureSelect) onFeatureSelect('spill');
  };
  if (map.getLayer('slick-fill')) {
    map.on('click', 'slick-fill', onSlickClick);
  }

  const onOriginClick = () => {
    if (onFeatureSelect) onFeatureSelect('origin');
  };
  ['origin-region-fill', 'origin-uncertainty-fill', 'origin-centroid-circle'].forEach((id) => {
    if (map.getLayer(id)) {
      map.on('click', id, onOriginClick);
    }
  });

  const onIncidentClick = (e) => {
    if (!e.features?.length) return;
    const incId = e.features[0].properties?.incidentId;
    if (incId && onSelectIncident) {
      onSelectIncident(incId);
    }
  };
  if (map.getLayer('incident-marker-circle')) {
    map.on('click', 'incident-marker-circle', onIncidentClick);
  }

  const onSegmentationClick = (e) => {
    if (!e.features?.length) return;
    const cls = e.features[0].properties?.classification;
    if (onFeatureSelect) {
      onFeatureSelect(cls === 'oilSlick' ? 'spill' : 'classification');
    }
  };
  if (map.getLayer('segmentation-fill')) {
    map.on('click', 'segmentation-fill', onSegmentationClick);
  }

  // Return teardown function
  return () => {
    popup.remove();
    map.off('mousemove', onMouseMove);
    INTERACTIVE_LAYERS.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.off('mouseenter', layerId, onMouseEnter);
        map.off('mouseleave', layerId, onMouseLeave);
      }
    });
  };
}
