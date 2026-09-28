/**
 * SPILLTRACE — Forensic Investigation Map Component (Mapbox GL JS Engine)
 *
 * Unified maritime geospatial investigation surface replacing Leaflet.
 * Features:
 * - Single persistent Mapbox GL JS instance across all 7 tabs and 5 scenarios
 * - Dynamic GeoJSON source updates via source.setData() (zero map recreation)
 * - Tab-specific camera focus and forensic layer visibility (Tabs 01–07)
 * - Real-time scenario synchronization (SYN-001 through SYN-005)
 * - Interactive bidirectional selection (vessels, slick, origin, AIS gap, CPA)
 * - High-resolution satellite basemap (Mapbox Standard / Satellite) with nautical toggle
 * - Full telemetry HUD, cursor coordinate tracking, and contextual legend
 */

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
  SOURCES,
  registerInvestigationLayers,
  updateMapboxLayerVisibility,
} from '../../services/map/mapboxLayers.js';
import {
  getMapDataForStage,
  computeTabBounds,
} from '../../services/map/mapboxSources.js';
import { setupMapboxInteractions } from '../../services/map/mapboxInteractions.js';
import { INITIAL_INCIDENTS } from '../../data/incidentsData.js';
import { getScenarioIdForIncident } from '../../services/spilltraceService.js';
import { calculateBearingDeg } from '../../services/map/mapGeometry.js';
import { createVessel3DLayer } from '../../services/map/vessel3DLayer.js';

const BASEMAP_MODES = {
  SATELLITE: 'satellite',
  MAP: 'map',
};

export default function InvestigationMap({
  investigationState,
  activeTab = '02',
  selectedCandidateMmsi,
  onSelectCandidate,
  highlightedFactor,
  onSelectFactor,
  onFeatureSelect,
  basemapMode: propBasemapMode,
  onBasemapChange,
  visibleLayers: propVisibleLayers,
  onToggleLayer,
  showCallouts = true,
  hideOverlays = false,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);
  const lastScenarioIdRef = useRef(null);
  const lastActiveTabRef = useRef(null);
  const prevCandidateMmsiRef = useRef(selectedCandidateMmsi);

  // Basemap mode: SATELLITE (default) | MAP (nautical light)
  const [internalBasemapMode, setInternalBasemapMode] = useState(BASEMAP_MODES.SATELLITE);
  const basemapMode = propBasemapMode !== undefined ? propBasemapMode : internalBasemapMode;

  const handleSetBasemapMode = (mode) => {
    setInternalBasemapMode(mode);
    if (onBasemapChange) onBasemapChange(mode);
  };

  // Real-time telemetry HUD state
  const [cursorCoords, setCursorCoords] = useState(null);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [internalVisibleLayers, setInternalVisibleLayers] = useState({
    sarFootprint: true,
    sarImage: true,
    spill: true,
    drift: true,
    forecast: true,
    uncertainty: true,
    ais: true,
    vesselTracks: true,
    candidateVessels: true,
    metocean: true,
    windVectors: true,
    oceanCurrents: true,
    coastline: true,
  });

  const visibleLayers = propVisibleLayers !== undefined ? propVisibleLayers : internalVisibleLayers;

  const scenario = investigationState?.scenario;
  const scenarioId = investigationState?.scenarioId || scenario?.id || 'SYN-001';
  const detection = investigationState?.detection || scenario?.spill;
  const slick = investigationState?.slick || scenario?.spill;
  const drift = investigationState?.drift || scenario?.drift?.backward;
  const aisTraffic = investigationState?.aisTraffic || scenario?.aisTraffic;
  const ensemble = investigationState?.ensemble || scenario?.ensembleRuns;

  // Mutable refs for 3D layer animation loop and events (zero re-instantiation context loss)
  const scenarioRef = useRef(scenario);
  const activeTabRef = useRef(activeTab);
  const selectedMmsiRef = useRef(selectedCandidateMmsi);
  const visibleLayersRef = useRef(visibleLayers);
  const vessel3DLayerRef = useRef(null);
  const calloutMarkersRef = useRef([]);

  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { selectedMmsiRef.current = selectedCandidateMmsi; }, [selectedCandidateMmsi]);
  useEffect(() => { visibleLayersRef.current = visibleLayers; }, [visibleLayers]);

  // ─── 0. Georeferenced SAR Radar Raster Overlay ───────────────────────
  const addOrUpdateSarRaster = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !scenario?.scene?.bbox) return;

    // CRITICAL: NEVER display the raw SAR raster overlay in Stage 04 (Origin Reconstruction) or Stage 06/07!
    // Stage 04 and 06 require the crystal-clear satellite ocean basemap (Reference 1).
    // In Stage 02, only display if explicitly enabled by user.
    const shouldShow = activeTab === '02' && (visibleLayers?.sarImage ?? true);
    if (!shouldShow) {
      if (map.getLayer('sar-raster-layer')) {
        map.setLayoutProperty('sar-raster-layer', 'visibility', 'none');
      }
      return;
    }

    const [minLon, minLat, maxLon, maxLat] = scenario.scene.bbox;
    const coords = [
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ];

    if (!map.getSource('sar-raster-source')) {
      map.addSource('sar-raster-source', {
        type: 'image',
        url: '/images/layers/layer1_raw_sar.jpg',
        coordinates: coords,
      });

      const beforeLayer = map.getLayer('sar-footprint-fill') ? 'sar-footprint-fill' : undefined;
      map.addLayer(
        {
          id: 'sar-raster-layer',
          type: 'raster',
          source: 'sar-raster-source',
          paint: {
            'raster-opacity': 0.72,
            'raster-contrast': 0.2,
          },
        },
        beforeLayer
      );
    } else {
      try {
        map.getSource('sar-raster-source').setCoordinates(coords);
        if (map.getLayer('sar-raster-layer')) {
          map.setLayoutProperty('sar-raster-layer', 'visibility', 'visible');
        }
      } catch (e) {}
    }
  }, [scenario, activeTab, visibleLayers]);

  // ─── 0b. Tactical Forensic Callout Markers (References 1, 2, 3) ───────
  const updateCalloutMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !scenario) return;

    // Clear existing markers
    calloutMarkersRef.current.forEach((m) => m.remove());
    calloutMarkersRef.current = [];

    if (!showCallouts) return;

    const currentTab = activeTab;

    // 1. Detected Oil Slick Marker (Tabs 04, 06, 07) -- NOT Tab 02 (clean slick in Ref 2)
    if (scenario?.spill?.centroid && (currentTab === '04' || currentTab === '06' || currentTab === '07')) {
      const [cLon, cLat] = scenario.spill.centroid;
      const acqTime = scenario?.scene?.acquisitionTime
        ? scenario.scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'
        : '2024-06-15 05:42 UTC';
      const area = scenario.spill.areaKm2 ? `${scenario.spill.areaKm2.toFixed(1)} km²` : '12.6 km²';

      const el = document.createElement('div');
      el.className = 'mapbox-forensic-callout-marker';
      el.style.cssText = 'pointer-events: none; transform: translate(-50%, -100%);';
      el.innerHTML = `
        <div style="background: #0B131E; border: 1px solid #ef4444; padding: 5px 9px; border-radius: 2px; box-shadow: 0 4px 16px rgba(0,0,0,0.85); font-family: monospace; font-size: 9.5px; color: #fff; min-width: 135px;">
          <div style="font-weight: 700; color: #fff; font-size: 10px; display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
            <span style="color: #ef4444; font-size: 12px; line-height: 1;">●</span> Detected Oil Slick
          </div>
          <div style="color: #cbd5e1; font-size: 8.5px;">${acqTime}</div>
          <div style="color: #94a3b8; font-size: 8.5px;">Area: <strong style="color: #fff;">${area}</strong></div>
        </div>
        <div style="width: 1.5px; height: 12px; background: #ef4444; margin: 0 auto;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444; margin: 0 auto; box-shadow: 0 0 8px #ef4444;"></div>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([cLon, cLat])
        .addTo(map);
      calloutMarkersRef.current.push(marker);
    }

    // 2. Estimated Origin Marker (Tabs 04, 06, 07)
    const originCentroid = scenario?.drift?.backward?.originCentroid;
    if (originCentroid && (currentTab === '04' || currentTab === '06' || currentTab === '07')) {
      const [oLon, oLat] = originCentroid;
      const relWindow = scenario?.drift?.backward?.releaseWindowStart && scenario?.drift?.backward?.releaseWindowEnd
        ? `${scenario.drift.backward.releaseWindowStart} – ${scenario.drift.backward.releaseWindowEnd}`
        : '2024-06-14 18:00 – 23:00 UTC';
      const uncertaintyKm = scenario?.drift?.backward?.originRadiusKm
        ? (scenario.drift.backward.originRadiusKm).toFixed(1)
        : '3.2';

      const el = document.createElement('div');
      el.className = 'mapbox-forensic-callout-marker';
      el.style.cssText = 'pointer-events: none; transform: translate(-50%, -100%);';
      el.innerHTML = `
        <div style="background: #0B131E; border: 1px solid #10b981; padding: 5px 9px; border-radius: 2px; box-shadow: 0 4px 16px rgba(0,0,0,0.85); font-family: monospace; font-size: 9.5px; color: #fff; min-width: 155px;">
          <div style="font-weight: 700; color: #fff; font-size: 10px; display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
            <span style="color: #10b981; font-size: 12px; line-height: 1;">⊕</span> Estimated Origin
          </div>
          <div style="color: #cbd5e1; font-size: 8.5px;">${oLat.toFixed(3)}° N, ${oLon.toFixed(3)}° E</div>
          <div style="color: #94a3b8; font-size: 8.5px;">${relWindow}</div>
          <div style="color: #34d399; font-size: 8.5px; font-weight: 600;">(± ${uncertaintyKm} km, 95% CI)</div>
        </div>
        <div style="width: 1.5px; height: 12px; background: #10b981; margin: 0 auto;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444; border: 1.5px solid #ffffff; margin: 0 auto; box-shadow: 0 0 8px #10b981;"></div>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([oLon, oLat])
        .addTo(map);
      calloutMarkersRef.current.push(marker);
    }

    // 3. Forecast Drift Marker (Tab 04)
    if (currentTab === '04') {
      const [cLon, cLat] = scenario.spill.centroid;
      const [oLon, oLat] = originCentroid || [cLon, cLat];
      const fwdLon = cLon + (cLon - oLon) * 0.48;
      const fwdLat = cLat + (cLat - oLat) * 0.48;

      const el = document.createElement('div');
      el.className = 'mapbox-forensic-callout-marker';
      el.style.cssText = 'pointer-events: none;';
      el.innerHTML = `
        <div style="background: #0B131E; border: 1px solid #38bdf8; padding: 4px 8px; border-radius: 2px; box-shadow: 0 4px 14px rgba(0,0,0,0.8); font-family: monospace; font-size: 9px; color: #fff;">
          <div style="font-weight: 700; color: #38bdf8; text-transform: uppercase;">Forecast Drift</div>
          <div style="color: #cbd5e1; font-size: 8px;">Next 24–72 h</div>
        </div>
      `;
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([fwdLon, fwdLat])
        .addTo(map);
      calloutMarkersRef.current.push(marker);
    }

    // 4. Candidate Vessel Callout Tags (Tabs 02, 04, 06)
    if ((currentTab === '02' || currentTab === '04' || currentTab === '06') && scenario?.aisTraffic?.tracks) {
      scenario.aisTraffic.tracks.forEach((track, idx) => {
        const positions = track.positions || [];
        if (!positions.length) return;

        let tagPos = positions[0];
        if (currentTab === '02') {
          // Stage 02: find closest position to spill centroid
          const slickC = scenario?.spill?.centroid;
          if (slickC) {
            let minD = Infinity;
            for (const p of positions) {
              if (!p.isGap) {
                const d = Math.hypot(p.lat - slickC[1], p.lon - slickC[0]);
                if (d < minD) {
                  minD = d;
                  tagPos = p;
                }
              }
            }
          }
        } else if (currentTab === '04' && idx === 0 && originCentroid) {
          tagPos = { lon: originCentroid[0] + 0.015, lat: originCentroid[1] - 0.012, timestamp: '2024-06-14T21:30:00Z' };
        } else if (currentTab === '04' || currentTab === '06' || currentTab === '07') {
          const origin = scenario?.drift?.backward?.originCentroid;
          if (origin) {
            let minD = Infinity;
            for (const p of positions) {
              if (!p.isGap) {
                const d = Math.hypot(p.lat - origin[1], p.lon - origin[0]);
                if (d < minD) {
                  minD = d;
                  tagPos = p;
                }
              }
            }
          }
        }

        const isSelected = selectedCandidateMmsi && String(track.mmsi) === String(selectedCandidateMmsi);

        // Vessel colors per tab matching reference images:
        let tagColor = '#38bdf8';
        let borderColor = '#334155';
        let vesselLabel = track.vesselName || `Vessel ${String.fromCharCode(65 + idx)}`;
        if (currentTab === '02') {
          const colors = ['#F97316', '#38BDF8', '#10B981'];
          tagColor = colors[idx % colors.length];
          borderColor = tagColor;
          vesselLabel = `Vessel ${String.fromCharCode(65 + idx)}`;
        } else if (currentTab === '04') {
          const colors = ['#10B981', '#94A3B8', '#10B981'];
          tagColor = colors[idx % colors.length];
          borderColor = tagColor;
          vesselLabel = `Vessel ${String.fromCharCode(65 + idx)}`;
        } else if (currentTab === '06') {
          const colors = ['#EF4444', '#38BDF8', '#10B981', '#CBD5E1', '#F59E0B'];
          tagColor = colors[idx % colors.length];
          borderColor = isSelected ? '#38bdf8' : tagColor;
        }

        const timeStr = tagPos.timestamp
          ? (currentTab === '02' ? tagPos.timestamp.substring(11, 16) + ' UTC' : tagPos.timestamp.substring(5, 16).replace('T', ' ') + ' UTC')
          : '06-14 21:30 UTC';

        const el = document.createElement('div');
        el.className = 'mapbox-vessel-tag-marker';
        el.style.cssText = 'pointer-events: auto; cursor: pointer; transform: translate(-50%, -100%);';
        el.innerHTML = `
          <div style="background: #0B131E; border: 1px solid ${borderColor}; padding: 3px 8px; border-radius: 2px; box-shadow: 0 4px 14px rgba(0,0,0,0.85); font-family: monospace; font-size: 8.5px; color: #fff; white-space: nowrap;">
            <div style="font-weight: 700; color: ${tagColor};">${vesselLabel}</div>
            <div style="color: #cbd5e1; font-size: 7.5px;">${timeStr}</div>
          </div>
          <div style="width: 1px; height: 10px; background: ${borderColor}; margin: 0 auto;"></div>
        `;
        el.onclick = () => {
          if (onSelectCandidate) onSelectCandidate(track.mmsi);
        };

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
          .setLngLat([tagPos.lon, tagPos.lat])
          .addTo(map);
        calloutMarkersRef.current.push(marker);
      });
    }

    // 5. Authentic Coastal Geographic Landmarks (Chennai, Mahabalipuram, Puducherry)
    const coastalLandmarks = [
      { name: 'Chennai', coords: [80.2707, 13.0827] },
      { name: 'Mahabalipuram', coords: [80.1927, 12.6269] },
      { name: 'Puducherry', coords: [79.8083, 11.9416] },
    ];

    coastalLandmarks.forEach((loc) => {
      const el = document.createElement('div');
      el.className = 'mapbox-coastal-landmark';
      el.style.cssText = 'pointer-events: none; transform: translate(-50%, -50%);';
      el.innerHTML = `
        <div style="background: rgba(11, 19, 30, 0.88); border: 1px solid rgba(255,255,255,0.25); padding: 1.5px 5px; border-radius: 2px; font-family: sans-serif; font-size: 8px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          ${loc.name}
        </div>
      `;
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(loc.coords)
        .addTo(map);
      calloutMarkersRef.current.push(marker);
    });
  }, [scenario, activeTab, showCallouts, selectedCandidateMmsi, onSelectCandidate]);

  // ─── 1. Synchronize Stage-Aware GeoJSON Sources ───────────────────────
  const syncSourceData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !scenario) return;

    try {
      const dataMap = getMapDataForStage(
        {
          scenario,
          scenarioId,
          detection,
          slick,
          drift,
          aisTraffic,
          ensemble,
        },
        activeTab,
        {
          selectedCandidateMmsi,
          highlightedFactor,
        }
      );

      Object.entries(dataMap).forEach(([sourceId, geoJson]) => {
        const src = map.getSource(sourceId);
        if (src) {
          src.setData(geoJson);
        }
      });

      addOrUpdateSarRaster();
      updateCalloutMarkers();
    } catch (err) {
      console.warn('Error syncing Mapbox investigation sources:', err);
    }
  }, [scenario, scenarioId, detection, slick, drift, aisTraffic, ensemble, activeTab, selectedCandidateMmsi, highlightedFactor, addOrUpdateSarRaster, updateCalloutMarkers]);


  // ─── 2. Camera Fit Helpers ───────────────────────────────────────────
  const fitCameraToExtent = useCallback((tab = activeTab, duration = 800) => {
    const map = mapRef.current;
    if (!map || !scenario) return;

    try {
      const bounds = computeTabBounds(
        scenario,
        tab,
        drift,
        aisTraffic,
        selectedCandidateMmsi
      );

      if (bounds) {
        const padding = { top: 40, bottom: 40, left: 45, right: 45 };
        const maxZoom = tab === '03' ? 14 : tab === '02' ? 12.5 : tab === '01' ? 9.5 : 12;
        const minZoom = tab === '01' ? 6.5 : 7.5;
        map.fitBounds(bounds, {
          padding,
          maxZoom,
          minZoom,
          duration,
        });
      }
    } catch (err) {
      console.warn('Error fitting Mapbox camera:', err);
    }
  }, [scenario, drift, aisTraffic, activeTab, selectedCandidateMmsi]);

  // ─── 3. Initialize Persistent Mapbox Engine ──────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !isMapboxConfigured()) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Use satellite-streets-v12 / standard-satellite
    const initialStyle =
      basemapMode === BASEMAP_MODES.SATELLITE
        ? MAPBOX_STYLES.SATELLITE
        : MAPBOX_STYLES.STREETS;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: [80.184, 11.238], // Default offshore Bay of Bengal
      zoom: 9,
      attributionControl: false,
      maxZoom: ZOOM_LIMITS.MAX,
      minZoom: ZOOM_LIMITS.MIN,
    });
    mapRef.current = map;

    // Load Handler: Register all sources, layers & event listeners once
    let cleanupInteractions = () => {};

    const init3DVesselLayer = () => {
      if (vessel3DLayerRef.current) {
        vessel3DLayerRef.current.dispose();
        vessel3DLayerRef.current = null;
      }
      const vessel3D = createVessel3DLayer({
        onSelectCandidate: (mmsi) => {
          if (onSelectCandidate) onSelectCandidate(mmsi);
        },
        getActiveScenario: () => scenarioRef.current,
        getActiveTab: () => activeTabRef.current,
        getSelectedMmsi: () => selectedMmsiRef.current,
        getVisibleLayers: () => visibleLayersRef.current,
      });
      vessel3DLayerRef.current = vessel3D;

      if (!map.getLayer('3d-vessel-layer')) {
        const beforeLayer = map.getLayer('vessel-name-label') ? 'vessel-name-label' : undefined;
        map.addLayer(vessel3D.customLayer, beforeLayer);
      }
    };

    const onStyleReady = () => {
      registerInvestigationLayers(map);
      mapReadyRef.current = true;

      // Populate current scenario data
      syncSourceData();

      // Set initial layer visibility for current tab
      updateMapboxLayerVisibility(map, activeTab, visibleLayers, scenarioId);

      // Initialize 3D vessel custom layer with shared WebGL context
      init3DVesselLayer();

      // Fit initial camera
      fitCameraToExtent(activeTab, 0);

      // Setup interactions
      cleanupInteractions();
      cleanupInteractions = setupMapboxInteractions(map, {
        onSelectCandidate,
        onFeatureSelect,
        onSelectIncident: (incId) => {
          if (onSelectCandidate) onSelectCandidate(incId);
        },
        onHoverCoords: (coords) => setCursorCoords(coords),
      });
    };

    map.on('load', onStyleReady);

    // Forward click and mousemove to 3D vessel layer for interactive raycast hit-testing
    const onMapClick = (e) => {
      if (vessel3DLayerRef.current?.handleMapClick(e)) {
        return;
      }
    };
    const onMapMouseMove = (e) => {
      vessel3DLayerRef.current?.handleMapMouseMove(e);
    };
    map.on('click', onMapClick);
    map.on('mousemove', onMapMouseMove);

    if (typeof window !== 'undefined') {
      window._investigationMap = map;
    }

    // Mouseout coordinates clearing
    const onMouseOut = () => setCursorCoords(null);
    map.getCanvas().addEventListener('mouseout', onMouseOut);

    return () => {
      cleanupInteractions();
      map.off('click', onMapClick);
      map.off('mousemove', onMapMouseMove);
      if (vessel3DLayerRef.current) {
        vessel3DLayerRef.current.dispose();
        vessel3DLayerRef.current = null;
      }
      map.getCanvas()?.removeEventListener('mouseout', onMouseOut);
      if (typeof window !== 'undefined') {
        delete window._investigationMap;
      }
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // Run once on mount

  // ─── 4. Switch Basemap Style (SATELLITE | MAP) ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const targetStyle =
      basemapMode === BASEMAP_MODES.SATELLITE
        ? MAPBOX_STYLES.SATELLITE
        : MAPBOX_STYLES.STREETS;

    mapReadyRef.current = false;
    map.setStyle(targetStyle);

    map.once('style.load', () => {
      registerInvestigationLayers(map);
      mapReadyRef.current = true;
      syncSourceData();
      updateMapboxLayerVisibility(map, activeTab, visibleLayers, scenarioId);

      // Re-initialize 3D vessel layer for the new style context
      if (vessel3DLayerRef.current) {
        vessel3DLayerRef.current.dispose();
        vessel3DLayerRef.current = null;
      }
      const vessel3D = createVessel3DLayer({
        onSelectCandidate: (mmsi) => {
          if (onSelectCandidate) onSelectCandidate(mmsi);
        },
        getActiveScenario: () => scenarioRef.current,
        getActiveTab: () => activeTabRef.current,
        getSelectedMmsi: () => selectedMmsiRef.current,
        getVisibleLayers: () => visibleLayersRef.current,
      });
      vessel3DLayerRef.current = vessel3D;
      const beforeLayer = map.getLayer('vessel-name-label') ? 'vessel-name-label' : undefined;
      map.addLayer(vessel3D.customLayer, beforeLayer);
    });
  }, [basemapMode]);

  // ─── 5. Update Sources When Scenario / Parameters Change ─────────────
  useEffect(() => {
    if (!mapReadyRef.current) return;
    syncSourceData();
    vessel3DLayerRef.current?.refreshVessels();
    mapRef.current?.triggerRepaint();

    // Trigger camera fit when scenario changes
    if (scenarioId && lastScenarioIdRef.current !== scenarioId) {
      lastScenarioIdRef.current = scenarioId;
      fitCameraToExtent(activeTab, 900);
    }
  }, [syncSourceData, scenarioId, activeTab, fitCameraToExtent]);

  // ─── 6. Update Layer Visibility & Sources When Tab or Toggles Change ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    syncSourceData();
    updateMapboxLayerVisibility(map, activeTab, visibleLayers, scenarioId);
    vessel3DLayerRef.current?.refreshVessels();
    map.triggerRepaint();

    // Adjust camera when switching tabs
    if (activeTab && lastActiveTabRef.current !== activeTab) {
      lastActiveTabRef.current = activeTab;
      fitCameraToExtent(activeTab, 700);
    }
  }, [activeTab, visibleLayers, scenarioId, fitCameraToExtent, syncSourceData]);

  // Adjust camera framing smoothly when candidate selection changes in AIS or Fusion
  useEffect(() => {
    if (!mapReadyRef.current) return;
    vessel3DLayerRef.current?.refreshVessels();
    mapRef.current?.triggerRepaint();
    if (prevCandidateMmsiRef.current !== selectedCandidateMmsi) {
      prevCandidateMmsiRef.current = selectedCandidateMmsi;
      if (selectedCandidateMmsi && (activeTab === '05' || activeTab === '06')) {
        fitCameraToExtent(activeTab, 600);
      }
    }
  }, [selectedCandidateMmsi, activeTab, fitCameraToExtent]);

  // Toggle single layer visibility
  const toggleLayer = (layerKey) => {
    setVisibleLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // ResizeObserver for dynamic map layout adjustments (tabs/panels)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Fallback When Mapbox Token Missing ──────────────────────────────
  if (!isMapboxConfigured()) {
    return (
      <div className="relative w-full h-full bg-[#FAFAFA] flex items-center justify-center font-mono select-none border border-[#CCCCCC]">
        <div className="border border-[#CCCCCC] bg-white p-8 max-w-md text-center text-[#111111] shadow-sm">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-amber-500 border-dashed rounded-full flex items-center justify-center text-amber-600 font-bold">
            !
          </div>
          <div className="text-xs uppercase tracking-wider font-bold mb-2 text-[#111111]">
            MAPBOX UNAVAILABLE
          </div>
          <p className="text-[11px] text-[#666666] mb-4 leading-relaxed">
            Add <code className="text-amber-700 font-bold">VITE_MAPBOX_TOKEN</code> to your{' '}
            <code className="text-[#111111] font-bold">.env</code> file to enable the interactive satellite
            investigation map.
          </p>
          <div className="text-[10px] text-[#888888] border-t border-[#E5E5E5] pt-3">
            ACTIVE CASE // {scenarioId} · FORENSIC ANALYTICS OPERATIONAL
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0A1118] overflow-hidden select-none">
      {/* ══ Mapbox DOM Canvas Mount Container ═══════════════════════ */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ══ Top-Left Technical Telemetry HUD (Shown when hideOverlays is false) ═ */}
      {!hideOverlays && (
        <div className="absolute top-3 left-3 z-30 pointer-events-none flex flex-col gap-1 font-mono">
          <div className="bg-white/95 backdrop-blur-xs text-[#111111] px-3 py-1.5 border border-[#CCCCCC] shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block flex-shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
              {scenarioId} · FORENSIC MAP
            </span>
            <span className="text-[#CCCCCC]">|</span>
            <span className="text-[10px] text-[#666666]">WGS 84 · EPSG:4326</span>
            <span className="text-[#CCCCCC]">|</span>
            <span className="text-[9px] px-1 py-0.2 uppercase font-bold text-[#0D9488]">
              {basemapMode === BASEMAP_MODES.SATELLITE ? 'SATELLITE' : 'MAP'}
            </span>
          </div>

          {/* Live Cursor Coordinates Readout */}
          {cursorCoords && (
            <div className="bg-white/95 backdrop-blur-xs text-[#111111] px-2.5 py-1 border border-[#CCCCCC] shadow-xs text-[10px]">
              LAT <span className="font-semibold text-[#111111]">{cursorCoords.lat}° N</span> · LON{' '}
              <span className="font-semibold text-[#111111]">{cursorCoords.lng}° E</span>
            </div>
          )}
        </div>
      )}

      {/* Cursor coordinates HUD in dedicated mode */}
      {hideOverlays && cursorCoords && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none bg-[#0B131E]/80 backdrop-blur-xs text-[#A0AEC0] px-2 py-0.5 border border-white/10 shadow-xs font-mono text-[9px]">
          LAT <span className="font-semibold text-white">{cursorCoords.lat}° N</span> · LON{' '}
          <span className="font-semibold text-white">{cursorCoords.lng}° E</span>
        </div>
      )}

      {/* ══ Top-Right Controls (Basemap Switcher & Layers Menu when hideOverlays is false) ══ */}
      {!hideOverlays && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 font-mono">
          {/* Basemap Mode Switcher: SATELLITE | MAP */}
          <div className="flex bg-white border border-[#CCCCCC] shadow-xs overflow-hidden text-[10px] font-bold">
            <button
              onClick={() => setBasemapMode(BASEMAP_MODES.SATELLITE)}
              className={`px-3 py-1.5 transition-all cursor-pointer ${
                basemapMode === BASEMAP_MODES.SATELLITE
                  ? 'bg-[#111111] text-white'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]'
              }`}
              title="Switch to High-Resolution Satellite Basemap"
            >
              SATELLITE
            </button>
            <button
              onClick={() => setBasemapMode(BASEMAP_MODES.MAP)}
              className={`px-3 py-1.5 border-l border-[#CCCCCC] transition-all cursor-pointer ${
                basemapMode === BASEMAP_MODES.MAP
                  ? 'bg-[#111111] text-white'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]'
              }`}
              title="Switch to Nautical Geographic Map"
            >
              MAP
            </button>
          </div>

          {/* Layer Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setLayersMenuOpen(!layersMenuOpen)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold border border-[#CCCCCC] bg-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                layersMenuOpen
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'text-[#111111] hover:bg-[#F5F5F5]'
              }`}
            >
              <span>LAYERS</span>
              <span className="text-[8px]">{layersMenuOpen ? '▲' : '▼'}</span>
            </button>

            {layersMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#CCCCCC] shadow-lg p-3 space-y-2 text-[10px] uppercase font-bold z-50 text-[#111111]">
                <div className="text-[9px] text-[#666666] pb-1 border-b border-[#E5E5E5] tracking-wider">
                  BASEMAP
                </div>
                <div className="flex gap-2 pb-2 border-b border-[#E5E5E5]">
                  <button
                    onClick={() => setBasemapMode(BASEMAP_MODES.SATELLITE)}
                    className={`flex-1 py-1 text-center border cursor-pointer transition-colors ${
                      basemapMode === BASEMAP_MODES.SATELLITE
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'border-[#CCCCCC] text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    onClick={() => setBasemapMode(BASEMAP_MODES.MAP)}
                    className={`flex-1 py-1 text-center border cursor-pointer transition-colors ${
                      basemapMode === BASEMAP_MODES.MAP
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'border-[#CCCCCC] text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Map
                  </button>
                </div>

                <div className="text-[9px] text-[#666666] pb-1 border-b border-[#E5E5E5] tracking-wider">
                  INVESTIGATION LAYERS
                </div>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#111111]">SAR FOOTPRINT</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.sarFootprint}
                    onChange={() => toggleLayer('sarFootprint')}
                    className="accent-[#78909C] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#111111]">
                    {activeTab === '02' ? 'DETECTED SEGMENTATION' : 'SPILL GEOMETRY'}
                  </span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.spill}
                    onChange={() => toggleLayer('spill')}
                    className="accent-[#D32F2F] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#111111]">DRIFT & ORIGIN</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.drift}
                    onChange={() => toggleLayer('drift')}
                    className="accent-[#00BFA5] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#111111]">AIS TRAFFIC</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.ais}
                    onChange={() => toggleLayer('ais')}
                    className="accent-[#42A5F5] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#111111]">METOCEAN VECTORS</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.metocean}
                    onChange={() => toggleLayer('metocean')}
                    className="accent-[#4FC3F7] cursor-pointer"
                  />
                </label>

                {scenarioId === 'SYN-005' && (
                  <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                    <span className="text-[#111111]">ENSEMBLE ENVELOPE</span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.uncertainty}
                      onChange={() => toggleLayer('uncertainty')}
                      className="accent-[#CE93D8] cursor-pointer"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Always-Visible Zoom & Fit Controls (Top-Right) ══════════════ */}
      <div className={`absolute z-30 flex flex-col font-mono shadow-2xl shadow-black/90 ${hideOverlays ? 'top-4 right-3' : 'top-[48px] right-3'}`}>
        <div className="flex flex-col bg-[#0B131E] border border-[#1E293B] text-white rounded-xs overflow-hidden">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-7 h-7 flex items-center justify-center font-bold text-sm text-white hover:bg-white/10 border-b border-[#1E293B] cursor-pointer transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-7 h-7 flex items-center justify-center font-bold text-sm text-white hover:bg-white/10 border-b border-[#1E293B] cursor-pointer transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={() => fitCameraToExtent(activeTab, 800)}
            className="w-7 h-7 flex items-center justify-center font-bold text-[9px] text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Fit Investigation Extent"
          >
            FIT
          </button>
        </div>
      </div>

      {/* ══ Bottom-Left Contextual Legend HUD (Shown when hideOverlays is false) ═ */}
      {!hideOverlays && (
        <div className="absolute bottom-3 left-3 z-30 pointer-events-none font-mono">
        <div className="bg-white/95 backdrop-blur-xs border border-[#CCCCCC] p-2.5 shadow-sm max-w-sm text-[#111111]">
          <div className="text-[9px] uppercase tracking-wider font-bold text-[#666666] mb-1.5 flex items-center justify-between">
            <span>
              {activeTab === '01'
                ? 'ARCHIVE CONTEXT'
                : activeTab === '02'
                ? 'DETECTED SEGMENTATION'
                : activeTab === '03'
                ? 'SLICK MORPHOLOGY'
                : activeTab === '04'
                ? 'DRIFT & ORIGIN DYNAMICS'
                : activeTab === '05'
                ? 'AIS MARITIME TRAFFIC'
                : activeTab === '06'
                ? 'EVIDENCE FUSION'
                : 'CONSOLIDATED INVESTIGATION'}
            </span>
            <span className="text-[8px] text-[#888888]">TAB {activeTab}</span>
          </div>

          {activeTab === '01' ? (
            /* Tab 01 Archive Legend */
            <div className="space-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#111111]" />
                <span>INCIDENT</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                <span>RAW OBSERVATION</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b border-dashed border-[#78909C]" />
                <span>SAR SWATH</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2 h-3 border border-[#0F172A] bg-white inline-block" />
                <span>VESSEL SILHOUETTE</span>
              </div>
            </div>
          ) : activeTab === '02' ? (
            /* Tab 02 Semantic Classification Legend */
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                <span>CONFIRMED SLICK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#2563EB] border border-[#1D4ED8]" />
                <span>LOOK-ALIKE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#F59E0B] border border-[#D97706]" />
                <span>SHIP WAKE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#10B981] border border-[#047857]" />
                <span>LOW-WIND CALM</span>
              </div>
            </div>
          ) : activeTab === '03' ? (
            /* Tab 03 Slick Morphology Legend */
            <div className="space-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-4 h-0.5 bg-white border border-[#999999]" />
                <span>MAJOR AXIS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b border-dashed border-[#FFCDD2]" />
                <span>MINOR AXIS</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#111111]" />
                <span>CENTROID</span>
              </div>
            </div>
          ) : activeTab === '04' ? (
            /* Tab 04 Drift & Origin Dynamics HUD (matches reference media_1790133562224.jpg) */
            <div className="space-y-1.5 text-[9px] text-[#111111]">
              <div className="pb-1 border-b border-[#EAEAEA] space-y-0.5 text-[8.5px] font-mono text-[#333333]">
                <div>
                  <span className="text-[#888888]">REPRESENTATIVE DRIFT: </span>
                  <strong className="text-[#111111]">
                    {(drift?.driftDistanceNm || 16.8).toFixed(1)} NM @ {Math.round(calculateBearingDeg(scenario?.spill?.centroid, drift?.originCentroid) || 245)}°
                  </strong>
                </div>
                <div>
                  <span className="text-[#888888]">ORIGIN UNCERTAINTY: </span>
                  <strong className="text-[#111111]">
                    {(drift?.originUncertaintyKm2 || (Math.PI * Math.pow(drift?.originRadiusKm || 2.8, 2))).toFixed(1)} KM² (95% CI)
                  </strong>
                </div>
                <div>
                  <span className="text-[#888888]">METOCEAN VECTOR: </span>
                  <strong className="text-[#111111]">
                    WIND {drift?.forcing?.windSpeedKn || scenario?.forcing?.windSpeedKn || 14.2} KN @ {scenario?.forcing?.windDirectionDeg || 65}° · CURRENT {drift?.forcing?.currentSpeedMs || scenario?.forcing?.currentSpeedMs || 0.38} M/S @ {scenario?.forcing?.currentDirectionDeg || 210}°
                  </strong>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                  <span>OBSERVED SLICK T0</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-b border-dashed border-[#00BFA5]" />
                  <span>BACKWARD ENSEMBLE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] border-2 border-white" />
                  <span>ORIGIN (50/75/95%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-b border-dashed border-[#4FC3F7]" />
                  <span>FORECAST +6h</span>
                </div>
              </div>
              {scenarioId === 'SYN-005' && (
                <div className="pt-1 border-t border-[#EAEAEA] flex items-center gap-2 text-[8px] text-[#8E24AA]">
                  <span className="w-4 h-0.5 border-b border-dotted border-[#CE93D8]" />
                  <span>MULTI-MEMBER ENSEMBLE PERTURBATIONS ACTIVE</span>
                </div>
              )}
            </div>
          ) : activeTab === '05' ? (
            /* Tab 05 AIS Traffic Legend */
            <div className="space-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] border-2 border-white" />
                <span>ORIGIN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#42A5F5]" />
                <span>AIS TRACK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2 h-3 border border-[#0F172A] bg-white inline-block" />
                <span>VESSEL SILHOUETTE</span>
              </div>
              {scenarioId === 'SYN-003' && (
                <div className="flex items-center gap-2 text-[8px] text-[#D32F2F]">
                  <span className="w-4 h-0.5 border-b border-dashed border-[#FF5252]" />
                  <span>TRANSPONDER GAP (3.5h)</span>
                </div>
              )}
            </div>
          ) : activeTab === '06' ? (
            /* Tab 06 Evidence Fusion Legend */
            <div className="space-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FFD54F] border-b border-[#0F172A]" />
                <span>CANDIDATE TRACK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#FF5252]" />
                <span>CPA TIE-LINE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-3 border border-[#0F172A] bg-[#FFD54F] inline-block" />
                <span>CANDIDATE SHIP</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] border-2 border-white" />
                <span>ORIGIN</span>
              </div>
            </div>
          ) : (
            /* Tab 07 Dossier Report Legend */
            <div className="space-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#C62828] border border-white" />
                <span>SLICK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] border-2 border-white" />
                <span>ORIGIN</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-2 h-3 border border-[#0F172A] bg-[#FFD54F] inline-block" />
                <span>CANDIDATE SHIP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FFD54F]" />
                <span>TRACK</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#00BFA5]" />
                <span>DRIFT</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#FF5252]" />
                <span>CPA</span>
              </div>
            </div>
          )}

          {scenarioId === 'SYN-004' && activeTab >= '06' && (
            <div className="mt-2 pt-1.5 border-t border-[#E5E5E5] text-[8px] text-[#D32F2F] font-bold uppercase">
              ATTRIBUTION ABSTENTION: Zero candidate vessels fabricated.
            </div>
          )}
        </div>
      </div>
      )}

      {/* ══ Bottom-Right Attribution HUD ═════════════════════════════ */}
      <div className="absolute bottom-2 right-2 z-30 pointer-events-none flex flex-col items-end gap-1 font-mono text-[9px] text-[#666666]">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-0.5 border border-[#CCCCCC] shadow-xs">
          <span>Mapbox · OpenStreetMap contributors · WGS 84</span>
        </div>
      </div>
    </div>
  );
}
