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
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);
  const lastScenarioIdRef = useRef(null);
  const lastActiveTabRef = useRef(null);

  // Basemap mode: SATELLITE (default) | MAP (nautical light)
  const [basemapMode, setBasemapMode] = useState(BASEMAP_MODES.SATELLITE);

  // Real-time telemetry HUD state
  const [cursorCoords, setCursorCoords] = useState(null);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    sarFootprint: true,
    spill: true,
    drift: true,
    ais: true,
    metocean: true,
    uncertainty: true,
  });

  const scenario = investigationState?.scenario;
  const scenarioId = investigationState?.scenarioId || scenario?.id || 'SYN-001';
  const detection = investigationState?.detection || scenario?.spill;
  const slick = investigationState?.slick || scenario?.spill;
  const drift = investigationState?.drift || scenario?.drift?.backward;
  const aisTraffic = investigationState?.aisTraffic || scenario?.aisTraffic;
  const ensemble = investigationState?.ensemble || scenario?.ensembleRuns;

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
    } catch (err) {
      console.warn('Error syncing Mapbox investigation sources:', err);
    }
  }, [scenario, scenarioId, detection, slick, drift, aisTraffic, ensemble, activeTab, selectedCandidateMmsi, highlightedFactor]);


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
        const padding = { top: 50, bottom: 50, left: 60, right: 60 };
        const maxZoom = tab === '03' ? 14 : tab === '02' ? 13 : 11;
        map.fitBounds(bounds, {
          padding,
          maxZoom,
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
        ? (MAPBOX_STYLES.STANDARD_SATELLITE || MAPBOX_STYLES.SATELLITE)
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

    const onStyleReady = () => {
      registerInvestigationLayers(map);
      mapReadyRef.current = true;

      // Populate current scenario data
      syncSourceData();

      // Set initial layer visibility for current tab
      updateMapboxLayerVisibility(map, activeTab, visibleLayers, scenarioId);

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

    // Mouseout coordinates clearing
    const onMouseOut = () => setCursorCoords(null);
    map.getCanvas().addEventListener('mouseout', onMouseOut);

    return () => {
      cleanupInteractions();
      map.getCanvas()?.removeEventListener('mouseout', onMouseOut);
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
        ? (MAPBOX_STYLES.STANDARD_SATELLITE || MAPBOX_STYLES.SATELLITE)
        : MAPBOX_STYLES.STREETS;

    mapReadyRef.current = false;
    map.setStyle(targetStyle);

    map.once('style.load', () => {
      registerInvestigationLayers(map);
      mapReadyRef.current = true;
      syncSourceData();
      updateMapboxLayerVisibility(map, activeTab, visibleLayers, scenarioId);
    });
  }, [basemapMode]);

  // ─── 5. Update Sources When Scenario / Parameters Change ─────────────
  useEffect(() => {
    if (!mapReadyRef.current) return;
    syncSourceData();

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

    // Adjust camera when switching tabs
    if (activeTab && lastActiveTabRef.current !== activeTab) {
      lastActiveTabRef.current = activeTab;
      fitCameraToExtent(activeTab, 700);
    }
  }, [activeTab, visibleLayers, scenarioId, fitCameraToExtent, syncSourceData]);

  // Toggle single layer visibility
  const toggleLayer = (layerKey) => {
    setVisibleLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // ─── Fallback When Mapbox Token Missing ──────────────────────────────
  if (!isMapboxConfigured()) {
    return (
      <div className="relative w-full h-full bg-[#0A1118] flex items-center justify-center font-mono select-none">
        <div className="border border-white/20 bg-[#111111]/95 p-8 max-w-md text-center text-white shadow-2xl">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-amber-400 border-dashed rounded-full flex items-center justify-center text-amber-400 font-bold">
            !
          </div>
          <div className="text-xs uppercase tracking-wider font-bold mb-2 text-white">
            MAPBOX UNAVAILABLE
          </div>
          <p className="text-[11px] text-[#888888] mb-4 leading-relaxed">
            Add <code className="text-amber-300 font-bold">VITE_MAPBOX_TOKEN</code> to your{' '}
            <code className="text-white">.env</code> file to enable the interactive satellite
            investigation map.
          </p>
          <div className="text-[10px] text-[#666666] border-t border-white/10 pt-3">
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

      {/* ══ Top-Left Technical Telemetry HUD ════════════════════════ */}
      <div className="absolute top-3 left-3 z-30 pointer-events-none flex flex-col gap-1.5 font-mono">
        <div className="bg-[#111111]/90 backdrop-blur-xs text-white px-3 py-1.5 border border-white/20 shadow-md flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {scenarioId} · FORENSIC MAP
          </span>
          <span className="text-white/40">|</span>
          <span className="text-[10px] text-white/70">WGS 84 · EPSG:4326</span>
          <span className="text-white/40">|</span>
          <span className="text-[9px] px-1 py-0.2 uppercase font-bold text-cyan-300">
            {basemapMode === BASEMAP_MODES.SATELLITE ? 'SATELLITE' : 'MAP'}
          </span>
        </div>

        {/* Live Cursor Coordinates Readout */}
        {cursorCoords && (
          <div className="bg-white/90 backdrop-blur-xs text-[#111111] px-2.5 py-1 border border-[#CCCCCC] shadow-xs text-[10px]">
            LAT: {cursorCoords.lat}° N · LON: {cursorCoords.lng}° E
          </div>
        )}
      </div>

      {/* ══ Top-Right Map Controls & Basemap Switcher ═════════════════ */}
      <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2 font-mono">
        <div className="flex items-center gap-1.5">
          {/* Basemap Mode Switcher: SATELLITE | MAP */}
          <div className="flex bg-white border border-[#111111] shadow-md overflow-hidden text-[10px] font-bold">
            <button
              onClick={() => setBasemapMode(BASEMAP_MODES.SATELLITE)}
              className={`px-3 py-1.5 transition-all cursor-pointer ${
                basemapMode === BASEMAP_MODES.SATELLITE
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#555555] hover:text-[#111111] hover:bg-[#EEEEEE]'
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
                  : 'bg-white text-[#555555] hover:text-[#111111] hover:bg-[#EEEEEE]'
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
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold border border-[#111111] transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                layersMenuOpen
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#111111] hover:bg-[#EEEEEE]'
              }`}
            >
              <span>LAYERS</span>
              <span className="text-[8px]">{layersMenuOpen ? '▲' : '▼'}</span>
            </button>

            {layersMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border-2 border-[#111111] shadow-2xl p-3 space-y-2 text-[10px] uppercase font-bold z-50">
                <div className="text-[9px] text-[#888888] pb-1 border-b border-[#EAEAEA] tracking-wider">
                  BASEMAP
                </div>
                <div className="flex gap-2 pb-2 border-b border-[#EAEAEA]">
                  <button
                    onClick={() => setBasemapMode(BASEMAP_MODES.SATELLITE)}
                    className={`flex-1 py-1 text-center border cursor-pointer ${
                      basemapMode === BASEMAP_MODES.SATELLITE
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'border-[#CCCCCC] text-[#555555]'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    onClick={() => setBasemapMode(BASEMAP_MODES.MAP)}
                    className={`flex-1 py-1 text-center border cursor-pointer ${
                      basemapMode === BASEMAP_MODES.MAP
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'border-[#CCCCCC] text-[#555555]'
                    }`}
                  >
                    Map
                  </button>
                </div>

                <div className="text-[9px] text-[#888888] pb-1 border-b border-[#EAEAEA] tracking-wider">
                  INVESTIGATION LAYERS
                </div>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#333333]">SAR FOOTPRINT</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.sarFootprint}
                    onChange={() => toggleLayer('sarFootprint')}
                    className="accent-[#111111] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#333333]">
                    {activeTab === '02' ? 'DETECTED SEGMENTATION' : 'SPILL GEOMETRY'}
                  </span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.spill}
                    onChange={() => toggleLayer('spill')}
                    className="accent-[#111111] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#333333]">DRIFT & ORIGIN</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.drift}
                    onChange={() => toggleLayer('drift')}
                    className="accent-[#111111] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#333333]">AIS TRAFFIC</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.ais}
                    onChange={() => toggleLayer('ais')}
                    className="accent-[#111111] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                  <span className="text-[#333333]">METOCEAN VECTORS</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers.metocean}
                    onChange={() => toggleLayer('metocean')}
                    className="accent-[#111111] cursor-pointer"
                  />
                </label>

                {scenarioId === 'SYN-005' && (
                  <label className="flex items-center justify-between p-1 hover:bg-[#F5F5F5] cursor-pointer">
                    <span className="text-[#333333]">ENSEMBLE ENVELOPE</span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.uncertainty}
                      onChange={() => toggleLayer('uncertainty')}
                      className="accent-[#111111] cursor-pointer"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Zoom & Fit Controls */}
        <div className="flex flex-col bg-white border border-[#111111] shadow-md">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-8 h-8 flex items-center justify-center font-bold text-sm text-[#111111] hover:bg-[#F5F5F5] border-b border-[#EAEAEA] cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-8 h-8 flex items-center justify-center font-bold text-sm text-[#111111] hover:bg-[#F5F5F5] border-b border-[#EAEAEA] cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={() => fitCameraToExtent(activeTab, 800)}
            className="w-8 h-8 flex items-center justify-center font-bold text-[10px] text-[#111111] hover:bg-[#F5F5F5] cursor-pointer"
            title="Fit Investigation Extent"
          >
            FIT
          </button>
        </div>
      </div>

      {/* ══ Bottom-Left Contextual Legend HUD ════════════════════════ */}
      <div className="absolute bottom-3 left-3 z-30 pointer-events-none font-mono">
        <div className="bg-white/95 backdrop-blur-xs border border-[#111111] p-2.5 shadow-md max-w-sm">
          <div className="text-[9px] uppercase tracking-wider font-bold text-[#888888] mb-1.5 flex items-center justify-between">
            <span>
              {activeTab === '01'
                ? 'ARCHIVE & INTAKE CONTEXT'
                : activeTab === '02'
                ? 'SEGMENTATION CLASSIFICATION'
                : activeTab === '03'
                ? 'SLICK MORPHOLOGY AXES'
                : activeTab === '04'
                ? 'DRIFT & ORIGIN DYNAMICS'
                : activeTab === '05'
                ? 'AIS MARITIME TRAFFIC'
                : activeTab === '06'
                ? 'EVIDENCE FUSION & ATTRIBUTION'
                : 'CONSOLIDATED INVESTIGATION'}
            </span>
            <span className="text-[8px] text-[#666666]">STAGE {activeTab}</span>
          </div>

          {activeTab === '01' ? (
            /* Tab 01 Archive Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#111111]" />
                <span>INCIDENT LOCATION</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#111111]" />
                <span>SAR SWATH EXTENT</span>
              </div>
            </div>
          ) : activeTab === '02' ? (
            /* Tab 02 Semantic Classification Legend */
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#111111]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#DC2626] border border-[#B91C1C]" />
                <span>OIL SLICK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#2563EB] border border-[#1D4ED8]" />
                <span>LOOK-ALIKE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#D97706] border border-[#B45309]" />
                <span>SHIP WAKE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#059669] border border-[#047857]" />
                <span>LOW-WIND CALM</span>
              </div>
            </div>
          ) : activeTab === '03' ? (
            /* Tab 03 Slick Morphology Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 bg-[#111111]" />
                <span>MAJOR AXIS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b border-dashed border-[#888888]" />
                <span>MINOR AXIS</span>
                <span className="text-gray-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border-2 border-white" />
                <span>CENTROID</span>
              </div>
            </div>
          ) : activeTab === '04' ? (
            /* Tab 04 Drift & Origin Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-gray-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#FFFFFF]" />
                <span>RECONSTRUCTED ORIGIN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b border-dashed border-[#3B82F6]" />
                <span>BACKWARD DRIFT</span>
                <span className="text-gray-300">|</span>
                <span className="text-[#9CA3AF] font-bold">↑</span>
                <span>WIND</span>
                <span className="text-gray-300">·</span>
                <span className="text-[#60A5FA] font-bold">→</span>
                <span>CURRENT</span>
              </div>
              {scenarioId === 'SYN-005' && (
                <div className="flex items-center gap-2 text-[8px] text-[#2563EB]">
                  <span className="w-4 h-0.5 border-b border-dotted border-[#2563EB]" />
                  <span>50-MEMBER ENSEMBLE DISPERSION</span>
                </div>
              )}
            </div>
          ) : activeTab === '05' ? (
            /* Tab 05 AIS Traffic Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-gray-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#FFFFFF]" />
                <span>RECONSTRUCTED ORIGIN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#94A3B8]" />
                <span>AIS VESSEL TRACK</span>
                <span className="text-gray-300">|</span>
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                <span>VESSEL CONTACT</span>
              </div>
              {scenarioId === 'SYN-003' && (
                <div className="flex items-center gap-2 text-[8px] text-[#EF4444]">
                  <span className="w-4 h-0.5 border-b border-dashed border-[#EF4444]" />
                  <span>TRANSPONDER GAP (3.5h)</span>
                </div>
              )}
            </div>
          ) : activeTab === '06' ? (
            /* Tab 06 Evidence Fusion Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FACC15]" />
                <span>CANDIDATE TRACK</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#EF4444]" />
                <span>CPA TIE-LINE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#FFFFFF]" />
                <span>ORIGIN</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#3B82F6]" />
                <span>BACKWARD DRIFT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9CA3AF] font-bold">↑</span>
                <span>WIND FORCING</span>
                <span className="text-gray-300">|</span>
                <span className="text-[#60A5FA] font-bold">→</span>
                <span>OCEAN CURRENT</span>
              </div>
            </div>
          ) : (
            /* Tab 07 Dossier Report Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-gray-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#FFFFFF]" />
                <span>RECONSTRUCTED ORIGIN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FACC15]" />
                <span>CANDIDATE TRACK</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#3B82F6]" />
                <span>BACKWARD DRIFT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9CA3AF] font-bold">↑</span>
                <span>WIND FORCING</span>
                <span className="text-gray-300">|</span>
                <span className="text-[#60A5FA] font-bold">→</span>
                <span>OCEAN CURRENT</span>
              </div>
            </div>
          )}

          {scenarioId === 'SYN-004' && activeTab >= '06' && (
            <div className="mt-2 pt-1.5 border-t border-[#EAEAEA] text-[8px] text-[#DC2626] font-bold uppercase">
              ATTRIBUTION ABSTENTION: Zero candidate vessels fabricated.
            </div>
          )}
        </div>
      </div>

      {/* ══ Bottom-Right Attribution HUD ═════════════════════════════ */}
      <div className="absolute bottom-2 right-2 z-30 pointer-events-none flex flex-col items-end gap-1 font-mono text-[9px] text-[#666666]">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-0.5 border border-[#CCCCCC] shadow-2xs">
          <span>Mapbox · OpenStreetMap contributors · WGS 84</span>
        </div>
      </div>
    </div>
  );
}
