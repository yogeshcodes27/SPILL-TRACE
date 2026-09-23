import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  MAPBOX_TOKEN,
  MAPBOX_STYLES,
  DEFAULT_BOUNDS,
  ZOOM_LIMITS,
  isMapboxConfigured,
} from '../../services/map/mapboxConfig.js';
import {
  buildIncidentMarkersGeoJson,
  buildSarFootprintGeoJson,
  buildArchiveObservationGeoJson,
  buildAisTracksGeoJson,
  buildAisGapGeoJson,
  buildVesselsGeoJson,
  computeBounds,
  EMPTY_FC,
} from '../../services/map/mapboxSources.js';

// Source and layer IDs for the Incidents Archive Map
const SOURCES = {
  MARKERS: 'incident-markers',
  SAR: 'incident-sar-footprint',
  OBSERVATION: 'incident-observation-footprint',
  AIS_TRACKS: 'incident-ais-tracks',
  AIS_GAP: 'incident-ais-gap',
  VESSELS: 'incident-vessels',
};

/**
 * Generate a crisp 32x32 ImageData with a professional top-down maritime vessel silhouette.
 * Hull points North (0° / top) so it can be dynamically oriented by COG in Mapbox symbol layer.
 * Returns an ImageData object with width, height, and valid Uint8ClampedArray pixel buffer
 * as required by Mapbox GL JS map.addImage().
 */
function createVesselCanvas(fillColor, strokeColor, isSelected) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  // Subtle contrasting halo/shadow so it remains clearly visible over satellite basemap
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = isSelected ? 5 : 3;
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
 * Generic data-driven camera fitting for the selected incident.
 * Uses available geometry (SAR bbox, observation polygon, AIS tracks) or point center/zoom.
 */
export function fitIncidentToMap(map, incident, scenario) {
  if (!map || !incident) return;

  if (scenario) {
    const collections = [];
    const sarFc = buildSarFootprintGeoJson(scenario);
    if (sarFc.features?.length) collections.push(sarFc);

    const obsFc = buildArchiveObservationGeoJson(scenario);
    if (obsFc.features?.length) collections.push(obsFc);

    const tracksFc = buildAisTracksGeoJson(scenario);
    if (tracksFc.features?.length) collections.push(tracksFc);

    const bbox = computeBounds(collections);
    if (bbox) {
      const pad = 0.05;
      map.fitBounds(
        [
          [bbox[0] - pad, bbox[1] - pad],
          [bbox[2] + pad, bbox[3] + pad],
        ],
        { padding: 60, maxZoom: 12, duration: 1000 }
      );
      return;
    }
  }

  // Fallback: fly to incident geographic point
  if (incident.lon != null && incident.lat != null) {
    map.flyTo({
      center: [incident.lon, incident.lat],
      zoom: ZOOM_LIMITS.INCIDENT_FLY_TO || 9,
      duration: 1000,
    });
  }
}

/**
 * Fit map camera to selected vessel track
 */
export function fitVesselToMap(map, mmsi, scenario) {
  if (!map || !mmsi || !scenario?.aisTraffic?.tracks) return;
  const track = scenario.aisTraffic.tracks.find((t) => String(t.mmsi) === String(mmsi));
  if (!track) return;

  if (track.positions?.length > 1) {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    track.positions.forEach((p) => {
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    });
    const pad = 0.02;
    map.fitBounds(
      [
        [minLon - pad, minLat - pad],
        [maxLon + pad, maxLat + pad],
      ],
      { padding: 70, maxZoom: 13, duration: 800 }
    );
  } else if (track.positions?.length === 1) {
    const p = track.positions[0];
    map.flyTo({
      center: [p.lon, p.lat],
      zoom: 12,
      duration: 800,
    });
  }
}

/**
 * IncidentMap — Mapbox GL JS incident browser map.
 * Renders each existing AIS vessel point as a clean directional maritime ship icon,
 * preserving existing map layout, data flow, and selection behaviors.
 */
export default function IncidentMap({
  incidents = [],
  selectedIncidentId,
  scenario,
  onSelectIncident,
  selectedVesselMmsi,
  onSelectVessel,
  getScenarioId,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);
  const [layerVisibility, setLayerVisibility] = useState({
    sar: true,
    observation: true,
    ais: true,
    aisGap: true,
    vessels: true,
  });
  const [layerControlOpen, setLayerControlOpen] = useState(false);

  // Synchronized refs to avoid stale closures in Mapbox event handlers
  const scenarioRef = useRef(scenario);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  const incidentsRef = useRef(incidents);
  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  const selectedIncidentIdRef = useRef(selectedIncidentId);
  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
  }, [selectedIncidentId]);

  const selectedVesselMmsiRef = useRef(selectedVesselMmsi);
  useEffect(() => {
    selectedVesselMmsiRef.current = selectedVesselMmsi;
  }, [selectedVesselMmsi]);

  const onSelectIncidentRef = useRef(onSelectIncident);
  useEffect(() => {
    onSelectIncidentRef.current = onSelectIncident;
  }, [onSelectIncident]);

  const onSelectVesselRef = useRef(onSelectVessel);
  useEffect(() => {
    onSelectVesselRef.current = onSelectVessel;
  }, [onSelectVessel]);

  // Available layers based on current scenario
  const availableLayers = useMemo(() => {
    if (!scenario) return {};
    return {
      sar: Boolean(scenario.scene?.bbox),
      observation: Boolean(scenario.spill?.polygon),
      ais: Boolean(scenario.aisTraffic?.tracks?.length),
      aisGap: Boolean(scenario.aisTraffic?.tracks?.some((t) => t.hasAisGap)),
      vessels: Boolean(scenario.aisTraffic?.tracks?.length),
    };
  }, [scenario]);

  // Selected incident object
  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) || incidents[0] || null;
  }, [incidents, selectedIncidentId]);

  // ─── 1. Initialize Mapbox ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !isMapboxConfigured()) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLES.SATELLITE,
      center: [78, 14],
      zoom: 4,
      attributionControl: true,
      maxZoom: ZOOM_LIMITS.MAX,
      minZoom: ZOOM_LIMITS.MIN,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Register crisp directional maritime vessel icons
    const registerVesselImages = () => {
      if (!map.hasImage('vessel-normal')) {
        const normalData = createVesselCanvas('#FFFFFF', '#0F172A', false);
        if (normalData) map.addImage('vessel-normal', normalData, { pixelRatio: 1 });
      }
      if (!map.hasImage('vessel-selected')) {
        const selectedData = createVesselCanvas('#FFD54F', '#000000', true);
        if (selectedData) map.addImage('vessel-selected', selectedData, { pixelRatio: 1 });
      }
    };

    map.on('styleimagemissing', (e) => {
      if (e.id === 'vessel-normal' || e.id === 'vessel-selected') {
        registerVesselImages();
      }
    });

    map.on('load', () => {
      registerVesselImages();

      // Register all GeoJSON sources (empty initially)
      Object.values(SOURCES).forEach((id) => {
        if (!map.getSource(id)) {
          map.addSource(id, { type: 'geojson', data: EMPTY_FC });
        }
      });

      // ── 1. SAR Scene Footprint ──
      map.addLayer({
        id: 'sar-bbox-fill',
        source: SOURCES.SAR,
        type: 'fill',
        filter: ['==', ['get', 'type'], 'sar-bbox'],
        paint: {
          'fill-color': '#78909C',
          'fill-opacity': 0.04,
        },
      });
      map.addLayer({
        id: 'sar-bbox-line',
        source: SOURCES.SAR,
        type: 'line',
        filter: ['==', ['get', 'type'], 'sar-bbox'],
        paint: {
          'line-color': '#78909C',
          'line-width': 1.5,
          'line-dasharray': [6, 4],
        },
      });
      map.addLayer({
        id: 'sar-tag-label',
        source: SOURCES.SAR,
        type: 'symbol',
        filter: ['==', ['get', 'type'], 'sar-tag'],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0.5, 0.5],
          'text-anchor': 'top-left',
        },
        paint: {
          'text-color': '#B0BEC5',
          'text-halo-color': '#0A1118',
          'text-halo-width': 2.0,
        },
      });

      // ── 2. Raw Observation Footprint (Detected Slick) ──
      map.addLayer({
        id: 'observation-fill',
        source: SOURCES.OBSERVATION,
        type: 'fill',
        filter: ['==', ['get', 'type'], 'observation-polygon'],
        paint: {
          'fill-color': '#D32F2F',
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'observation-line',
        source: SOURCES.OBSERVATION,
        type: 'line',
        filter: ['==', ['get', 'type'], 'observation-polygon'],
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 2.0,
        },
      });
      map.addLayer({
        id: 'observation-centroid',
        source: SOURCES.OBSERVATION,
        type: 'circle',
        filter: ['==', ['get', 'type'], 'observation-centroid'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#D32F2F',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'observation-tag-label',
        source: SOURCES.OBSERVATION,
        type: 'symbol',
        filter: ['==', ['get', 'type'], 'observation-tag'],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0A1118',
          'text-halo-width': 2.2,
        },
      });

      // ── 3. AIS Tracks ──
      map.addLayer({
        id: 'ais-tracks-line',
        source: SOURCES.AIS_TRACKS,
        type: 'line',
        paint: {
          'line-color': [
            'case',
            ['==', ['to-string', ['get', 'mmsi']], String(selectedVesselMmsi || '')],
            '#FFD54F',
            '#42A5F5',
          ],
          'line-width': [
            'case',
            ['==', ['to-string', ['get', 'mmsi']], String(selectedVesselMmsi || '')],
            3.5,
            1.8,
          ],
          'line-opacity': [
            'case',
            ['==', ['to-string', ['get', 'mmsi']], String(selectedVesselMmsi || '')],
            1.0,
            0.65,
          ],
        },
      });

      // ── 4. AIS Gap (SYN-003 Transponder Blackout Interval) ──
      map.addLayer({
        id: 'ais-gap-line',
        source: SOURCES.AIS_GAP,
        type: 'line',
        filter: ['==', ['get', 'type'], 'ais-gap'],
        paint: {
          'line-color': '#FF5252',
          'line-width': 3,
          'line-dasharray': [4, 4],
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'ais-gap-label',
        source: SOURCES.AIS_GAP,
        type: 'symbol',
        filter: ['==', ['get', 'type'], 'ais-gap-label'],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FF5252',
          'text-halo-color': '#0A1118',
          'text-halo-width': 2.2,
        },
      });

      // ── 5. Directional Maritime Vessel Icons (Replacing Circular Markers) ──
      map.addLayer({
        id: 'vessels-symbol',
        source: SOURCES.VESSELS,
        type: 'symbol',
        filter: ['==', ['get', 'type'], 'vessel-position'],
        layout: {
          'icon-image': [
            'case',
            ['==', ['to-string', ['get', 'mmsi']], String(selectedVesselMmsiRef.current || '')],
            'vessel-selected',
            'vessel-normal',
          ],
          'icon-rotate': ['coalesce', ['get', 'cog'], 0],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            0.8,
            8,
            1.0,
            12,
            1.25,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // ── 6. Incident Archive Markers (All 12 Cases) ──
      map.addLayer({
        id: 'incident-markers-circle',
        source: SOURCES.MARKERS,
        type: 'circle',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'incidentId'], selectedIncidentId || ''],
            8,
            5,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'incidentId'], selectedIncidentId || ''],
            '#F97316',
            '#FFFFFF',
          ],
          'circle-stroke-color': '#0A1118',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'incident-markers-label',
        source: SOURCES.MARKERS,
        type: 'symbol',
        layout: {
          'text-field': ['get', 'code'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 9.5,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0A1118',
          'text-halo-width': 2.0,
        },
      });

      mapReadyRef.current = true;

      // Populate initial markers
      const srcMarkers = map.getSource(SOURCES.MARKERS);
      if (srcMarkers) {
        srcMarkers.setData(buildIncidentMarkersGeoJson(incidentsRef.current || incidents, getScenarioId));
      }

      // Populate initial scenario layers if available
      const currentScenario = scenarioRef.current || scenario;
      if (currentScenario) {
        const setSrc = (id, data) => {
          const s = map.getSource(id);
          if (s) s.setData(data);
        };
        setSrc(SOURCES.SAR, buildSarFootprintGeoJson(currentScenario));
        setSrc(SOURCES.OBSERVATION, buildArchiveObservationGeoJson(currentScenario));
        setSrc(SOURCES.AIS_TRACKS, buildAisTracksGeoJson(currentScenario));
        setSrc(SOURCES.AIS_GAP, buildAisGapGeoJson(currentScenario));
        setSrc(SOURCES.VESSELS, buildVesselsGeoJson(currentScenario));
      }

      // Initial fit to selected incident or all incidents
      if (selectedIncident) {
        fitIncidentToMap(map, selectedIncident, currentScenario);
      } else {
        const markersGeoJson = buildIncidentMarkersGeoJson(incidentsRef.current || incidents, getScenarioId);
        const bbox = computeBounds([markersGeoJson]);
        if (bbox) {
          const pad = 0.5;
          map.fitBounds(
            [
              [bbox[0] - pad, bbox[1] - pad],
              [bbox[2] + pad, bbox[3] + pad],
            ],
            { padding: 40, maxZoom: 8, duration: 800 }
          );
        }
      }
    });

    // ── Interaction: Click incident marker (Bidirectional: Map → Case Table) ──
    map.on('click', 'incident-markers-circle', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const incId = feature.properties.incidentId;
      if (incId && onSelectIncidentRef.current) {
        const inc = (incidentsRef.current || []).find((i) => i.id === incId);
        if (inc) onSelectIncidentRef.current(inc);
      }
    });

    // ── Interaction: Click vessel ship icon (Bidirectional: Map → AIS Table) ──
    map.on('click', 'vessels-symbol', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const mmsi = feature.properties.mmsi;
      if (mmsi && onSelectVesselRef.current) {
        const curr = selectedVesselMmsiRef.current;
        onSelectVesselRef.current(String(mmsi) === String(curr) ? null : mmsi);
      }
    });

    // ── Interaction: Click AIS track line (Bidirectional: Map → AIS Table) ──
    map.on('click', 'ais-tracks-line', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const mmsi = feature.properties.mmsi;
      if (mmsi && onSelectVesselRef.current) {
        const curr = selectedVesselMmsiRef.current;
        onSelectVesselRef.current(String(mmsi) === String(curr) ? null : mmsi);
      }
    });

    // Hover cursor feedback
    const setPointer = () => { if (map.getCanvas()) map.getCanvas().style.cursor = 'pointer'; };
    const resetPointer = () => { if (map.getCanvas()) map.getCanvas().style.cursor = ''; };

    map.on('mouseenter', 'incident-markers-circle', setPointer);
    map.on('mouseleave', 'incident-markers-circle', resetPointer);
    map.on('mouseenter', 'vessels-symbol', setPointer);
    map.on('mouseleave', 'vessels-symbol', resetPointer);
    map.on('mouseenter', 'ais-tracks-line', setPointer);
    map.on('mouseleave', 'ais-tracks-line', resetPointer);

    mapRef.current = map;
    if (typeof window !== 'undefined') {
      window._incidentMap = map;
    }

    return () => {
      mapReadyRef.current = false;
      if (typeof window !== 'undefined') {
        delete window._incidentMap;
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 2. Update incident markers source ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource(SOURCES.MARKERS);
    if (src) {
      src.setData(buildIncidentMarkersGeoJson(incidents, getScenarioId));
    }
  }, [incidents, getScenarioId]);

  // ─── 3. Update selected incident marker highlight ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (map.getLayer('incident-markers-circle')) {
      map.setPaintProperty('incident-markers-circle', 'circle-radius', [
        'case',
        ['==', ['get', 'incidentId'], selectedIncidentId || ''],
        8,
        5,
      ]);
      map.setPaintProperty('incident-markers-circle', 'circle-color', [
        'case',
        ['==', ['get', 'incidentId'], selectedIncidentId || ''],
        '#F97316',
        '#FFFFFF',
      ]);
    }
  }, [selectedIncidentId]);

  // ─── 4. Update scenario layers & clean stale geometry ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const setSource = (id, data) => {
      const src = map.getSource(id);
      if (src) src.setData(data);
    };

    if (!scenario) {
      // Incident without scenario: IMMEDIATELY wipe all scenario layers to EMPTY_FC
      setSource(SOURCES.SAR, EMPTY_FC);
      setSource(SOURCES.OBSERVATION, EMPTY_FC);
      setSource(SOURCES.AIS_TRACKS, EMPTY_FC);
      setSource(SOURCES.AIS_GAP, EMPTY_FC);
      setSource(SOURCES.VESSELS, EMPTY_FC);
      return;
    }

    // Incident with scenario: populate archive observation context only
    setSource(SOURCES.SAR, buildSarFootprintGeoJson(scenario));
    setSource(SOURCES.OBSERVATION, buildArchiveObservationGeoJson(scenario));
    setSource(SOURCES.AIS_TRACKS, buildAisTracksGeoJson(scenario));
    setSource(SOURCES.AIS_GAP, buildAisGapGeoJson(scenario));
    setSource(SOURCES.VESSELS, buildVesselsGeoJson(scenario));
  }, [scenario]);

  // ─── 5. Camera: Fly/Fit to Selected Incident ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !selectedIncidentId) return;

    const inc = incidents.find((i) => i.id === selectedIncidentId);
    if (!inc) return;

    fitIncidentToMap(map, inc, scenario);
  }, [selectedIncidentId, scenario, incidents]);

  // ─── 6. Camera & Layer Update: Selected Vessel ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const mmsiStr = String(selectedVesselMmsi || '');

    // Update vessel symbol icon
    if (map.getLayer('vessels-symbol')) {
      map.setLayoutProperty('vessels-symbol', 'icon-image', [
        'case',
        ['==', ['to-string', ['get', 'mmsi']], mmsiStr],
        'vessel-selected',
        'vessel-normal',
      ]);
    }

    // Update AIS track highlight
    if (map.getLayer('ais-tracks-line')) {
      map.setPaintProperty('ais-tracks-line', 'line-color', [
        'case',
        ['==', ['to-string', ['get', 'mmsi']], mmsiStr],
        '#FFD54F',
        '#42A5F5',
      ]);
      map.setPaintProperty('ais-tracks-line', 'line-width', [
        'case',
        ['==', ['to-string', ['get', 'mmsi']], mmsiStr],
        3.5,
        1.8,
      ]);
      map.setPaintProperty('ais-tracks-line', 'line-opacity', [
        'case',
        ['==', ['to-string', ['get', 'mmsi']], mmsiStr],
        1.0,
        0.65,
      ]);
    }

    if (selectedVesselMmsi && scenario) {
      fitVesselToMap(map, selectedVesselMmsi, scenario);
    }
  }, [selectedVesselMmsi, scenario]);

  // ─── 7. Layer Visibility Toggle ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const layerMap = {
      sar: ['sar-bbox-fill', 'sar-bbox-line', 'sar-tag-label'],
      observation: [
        'observation-fill',
        'observation-line',
        'observation-centroid',
        'observation-tag-label',
      ],
      ais: ['ais-tracks-line'],
      aisGap: ['ais-gap-line', 'ais-gap-label'],
      vessels: ['vessels-symbol'],
    };

    for (const [key, layerIds] of Object.entries(layerMap)) {
      const vis = layerVisibility[key] ? 'visible' : 'none';
      for (const id of layerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', vis);
        }
      }
    }
  }, [layerVisibility]);

  // ─── Controls: Fit incident or all ─────────────────────────────────
  const handleFit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (selectedIncident) {
      fitIncidentToMap(map, selectedIncident, scenario);
      return;
    }

    // Fit to all incident markers
    const markersGeoJson = buildIncidentMarkersGeoJson(incidents, getScenarioId);
    const bbox = computeBounds([markersGeoJson]);
    if (bbox) {
      map.fitBounds(
        [
          [bbox[0] - 0.5, bbox[1] - 0.5],
          [bbox[2] + 0.5, bbox[3] + 0.5],
        ],
        { padding: 40, maxZoom: 8, duration: 800 }
      );
    }
  }, [selectedIncident, scenario, incidents, getScenarioId]);

  const toggleLayer = useCallback((key) => {
    setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Fallback if Mapbox Token is missing ───────────────────────────
  if (!isMapboxConfigured()) {
    return (
      <div className="border border-[#E5E5E5] bg-[#FAFAFA] font-mono text-xs mb-12 relative w-full aspect-[16/7] flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-[#888888] uppercase tracking-wider text-[10px] font-bold mb-2">
            MAPBOX UNAVAILABLE
          </div>
          <div className="text-[#666666] text-[11px] max-w-sm">
            Add <span className="font-bold text-[#111111]">VITE_MAPBOX_TOKEN</span> to{' '}
            <span className="font-bold text-[#111111]">.env</span> to enable the incident map.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="incident-map-card" className="border border-[#CCCCCC] bg-[#FAFAFA] font-mono text-xs mb-12 relative overflow-hidden shadow-xs">
      {/* Map top bar */}
      <div className="bg-white border-b border-[#CCCCCC] px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] z-10 relative text-[#111111]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-2 h-2 bg-emerald-600 inline-block flex-shrink-0 rounded-full" />
          <span className="font-bold text-[#111111] uppercase tracking-wider">
            GEOSPATIAL INCIDENT BROWSER
          </span>
          <span className="text-[#CCCCCC] hidden md:inline">|</span>
          <span className="text-[#666666] hidden md:inline text-[10px]">
            MAPBOX GL · SATELLITE
          </span>
          {selectedIncidentId && (
            <>
              <span className="text-[#CCCCCC] hidden lg:inline">|</span>
              <span className="text-[#B45309] hidden lg:inline text-[10px] font-bold">
                {selectedIncidentId}
                {scenario ? ` [${scenario.id}]` : ' [ARCHIVE RECORD ONLY]'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFit}
            className="px-2.5 py-1 hover:bg-[#F5F5F5] text-[#111111] text-[10px] uppercase font-semibold cursor-pointer border border-[#CCCCCC] bg-white transition-colors"
            title="Fit to incident bounds"
          >
            FIT
          </button>
          <div className="relative">
            <button
              onClick={() => setLayerControlOpen(!layerControlOpen)}
              className="px-2.5 py-1 hover:bg-[#F5F5F5] text-[#111111] text-[10px] uppercase font-semibold cursor-pointer border border-[#CCCCCC] bg-white transition-colors flex items-center gap-1.5"
              title="Toggle layer visibility"
            >
              <span>LAYERS</span>
              <span className="text-[8px]">{layerControlOpen ? '▲' : '▼'}</span>
            </button>
            {layerControlOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-white border border-[#CCCCCC] shadow-lg z-20 w-48 text-[#111111] p-1.5">
                {[
                  { key: 'sar', label: 'SAR SWATH', color: '#78909C', available: availableLayers.sar },
                  { key: 'observation', label: 'RAW OBSERVATION', color: '#D32F2F', available: availableLayers.observation },
                  { key: 'ais', label: 'AIS TRACKS', color: '#42A5F5', available: availableLayers.ais },
                  { key: 'aisGap', label: 'AIS GAP', color: '#FF5252', available: availableLayers.aisGap },
                  { key: 'vessels', label: 'VESSELS', color: '#FFD54F', available: availableLayers.vessels },
                ]
                  .filter((l) => l.available)
                  .map((l) => (
                    <button
                      key={l.key}
                      onClick={() => toggleLayer(l.key)}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#F5F5F5] text-[10px] uppercase font-semibold cursor-pointer transition-colors"
                    >
                      <span className={layerVisibility[l.key] ? 'text-[#111111]' : 'text-[#888888]'}>
                        {l.label}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full transition-all border border-[#CCCCCC]"
                        style={{
                          backgroundColor: layerVisibility[l.key] ? l.color : '#E5E5E5',
                        }}
                      />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="w-full" style={{ height: '480px' }} />
    </div>
  );
}
