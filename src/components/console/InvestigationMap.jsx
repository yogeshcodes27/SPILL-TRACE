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
  const prevCandidateMmsiRef = useRef(selectedCandidateMmsi);

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

    if (typeof window !== 'undefined') {
      window._investigationMap = map;
    }

    // Mouseout coordinates clearing
    const onMouseOut = () => setCursorCoords(null);
    map.getCanvas().addEventListener('mouseout', onMouseOut);

    return () => {
      cleanupInteractions();
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

  // Adjust camera framing smoothly when candidate selection changes in AIS or Fusion
  useEffect(() => {
    if (!mapReadyRef.current) return;
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
    <div className="relative w-full h-full bg-[#FAFAFA] overflow-hidden select-none">
      {/* ══ Mapbox DOM Canvas Mount Container ═══════════════════════ */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ══ Top-Left Technical Telemetry HUD (Minimal Map Card) ═════ */}
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

      {/* ══ Top-Right Map Controls & Basemap Switcher ═════════════════ */}
      <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2 font-mono">
        <div className="flex items-center gap-1.5">
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

        {/* Zoom & Fit Controls */}
        <div className="flex flex-col bg-white border border-[#CCCCCC] shadow-xs text-[#111111]">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-8 h-8 flex items-center justify-center font-bold text-sm text-[#111111] hover:bg-[#F5F5F5] border-b border-[#E5E5E5] cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-8 h-8 flex items-center justify-center font-bold text-sm text-[#111111] hover:bg-[#F5F5F5] border-b border-[#E5E5E5] cursor-pointer"
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

      {/* ══ Bottom-Left Contextual Legend HUD (Light, Compact, Stage-Aware) ═ */}
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

      {/* ══ Bottom-Right Attribution HUD ═════════════════════════════ */}
      <div className="absolute bottom-2 right-2 z-30 pointer-events-none flex flex-col items-end gap-1 font-mono text-[9px] text-[#666666]">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-0.5 border border-[#CCCCCC] shadow-xs">
          <span>Mapbox · OpenStreetMap contributors · WGS 84</span>
        </div>
      </div>
    </div>
  );
}
