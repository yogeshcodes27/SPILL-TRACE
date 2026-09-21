import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BASEMAP_MODES,
  getSatelliteBasemap,
  getStreetBasemap,
} from '../../services/map/basemapProvider.js';
import {
  toLatLng,
  toLatLngs,
} from '../../services/map/mapGeometry.js';
import {
  renderSarLayer,
  renderSegmentationLayer,
  renderTechnicalSlickLayer,
  renderDriftLayer,
  renderMetoceanLayer,
  renderAisLayer,
  renderEnsembleLayer,
} from '../../services/map/mapLayers.js';

/**
 * SPILLTRACE — Forensic Investigation Map Component
 * 
 * Interactive maritime geospatial investigation surface powered by Leaflet.
 * Features:
 * - High-resolution global satellite basemap (Esri World Imagery) as primary visual mode
 * - Nautical grayscale geographic basemap (OpenStreetMap)
 * - Offshore geographic alignment for all spills, drift trajectories, and AIS corridors
 * - Sentinel-1 SAR scene footprint with technical metadata
 * - Tab 02 semantic segmentation overlay (oil slick, look-alike, ship wake, low-wind calm)
 * - Tab 03 GIS measurement axes (aligned major/minor axes)
 * - Tab 04 dynamic backward drift trajectory, intermediate advection points, origin uncertainty
 * - Tab 05 AIS candidate tracking, SYN-003 AIS gap callout, SYN-004 abstention
 * - SYN-005 stability ensemble perturbation envelopes
 */
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
  const layerGroupsRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const streetLayerRef = useRef(null);

  const lastScenarioIdRef = useRef(null);

  // Basemap mode: SATELLITE is default for maritime remote sensing
  const [basemapMode, setBasemapMode] = useState(BASEMAP_MODES.SATELLITE);

  // HUD and Layers UI state
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
  const scenarioId = investigationState?.scenarioId;
  const spill = scenario?.spill;
  const drift = investigationState?.drift || scenario?.drift?.backward;
  const aisTraffic = investigationState?.aisTraffic || scenario?.aisTraffic;
  const ensemble = investigationState?.ensemble || scenario?.ensembleRuns;

  // ─── 1. Initialize Map & Basemap Providers ───────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Safety: ensure container doesn't have an orphaned Leaflet ID
    if (mapContainerRef.current._leaflet_id && !mapRef.current) {
      delete mapContainerRef.current._leaflet_id;
    }

    if (mapRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        maxZoom: 18,
        minZoom: 3,
      });
      mapRef.current = map;

      // Instantiate both basemaps via provider service
      const satLayer = getSatelliteBasemap(L);
      const streetLayer = getStreetBasemap(L);
      satelliteLayerRef.current = satLayer;
      streetLayerRef.current = streetLayer;

      // Add default satellite basemap
      if (satLayer) {
        satLayer.addTo(map);
      } else if (streetLayer) {
        streetLayer.addTo(map);
      }

      // Instantiate fresh forensic layer groups
      const layers = {
        sarFootprint: L.layerGroup().addTo(map),
        segmentation: L.layerGroup().addTo(map),
        slick: L.layerGroup().addTo(map),
        drift: L.layerGroup().addTo(map),
        metocean: L.layerGroup().addTo(map),
        ais: L.layerGroup().addTo(map),
        ensemble: L.layerGroup().addTo(map),
      };
      layerGroupsRef.current = layers;

      // Cursor position readout
      map.on('mousemove', (e) => {
        setCursorCoords({
          lat: e.latlng.lat.toFixed(4),
          lng: e.latlng.lng.toFixed(4),
        });
      });

      map.on('mouseout', () => {
        setCursorCoords(null);
      });

      // Default initial view centered offshore Tamil Nadu shelf in Bay of Bengal
      map.setView([11.238, 80.184], 10);
    } catch (err) {
      console.error('Failed to initialize Leaflet investigation map:', err);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('Map cleanup warning:', e);
        }
        mapRef.current = null;
        layerGroupsRef.current = null;
        satelliteLayerRef.current = null;
        streetLayerRef.current = null;
      }
      if (mapContainerRef.current?._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }
    };
  }, []);

  // ─── 2. Basemap Mode Switcher ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sat = satelliteLayerRef.current;
    const street = streetLayerRef.current;

    if (basemapMode === BASEMAP_MODES.SATELLITE) {
      if (street && map.hasLayer(street)) map.removeLayer(street);
      if (sat && !map.hasLayer(sat)) map.addLayer(sat);
    } else {
      if (sat && map.hasLayer(sat)) map.removeLayer(sat);
      if (street && !map.hasLayer(street)) map.addLayer(street);
    }
  }, [basemapMode]);

  // ─── 3. Tight Camera Fit to Investigation Extent ─────────────────────
  const fitInvestigation = useCallback(() => {
    const map = mapRef.current;
    if (!map || !scenario) return;

    try {
      const bounds = L.latLngBounds([]);

      // Include slick centroid and polygon
      if (scenario.spill?.centroid) {
        bounds.extend(toLatLng(scenario.spill.centroid));
      }
      if (scenario.spill?.polygon) {
        toLatLngs(scenario.spill.polygon).forEach((pt) => bounds.extend(pt));
      }

      // Include reconstructed origin
      if (drift?.originCentroid) {
        bounds.extend(toLatLng(drift.originCentroid));
      }

      // Include candidate vessel positions
      if (aisTraffic?.tracks) {
        const cand =
          aisTraffic.tracks.find((t) => t.mmsi === selectedCandidateMmsi) ||
          aisTraffic.tracks[0];
        if (cand?.positions) {
          cand.positions.forEach((p) => bounds.extend([p.lat, p.lon]));
        }
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13,
          animate: true,
        });
      }
    } catch (err) {
      console.warn('fitInvestigation error:', err);
    }
  }, [scenario, drift, aisTraffic, selectedCandidateMmsi]);

  // Trigger camera fit ONLY on scenario change or initial load (not tab toggle)
  useEffect(() => {
    if (!scenarioId || !scenario) return;

    if (lastScenarioIdRef.current !== scenarioId) {
      lastScenarioIdRef.current = scenarioId;
      const timer = setTimeout(() => {
        fitInvestigation();
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [scenarioId, scenario, fitInvestigation]);

  // ─── 4. Stage-Specific Forensic Layer Rendering ───────────────────────
  useEffect(() => {
    const layers = layerGroupsRef.current;
    if (!layers || !scenario) return;

    const isSat = basemapMode === BASEMAP_MODES.SATELLITE;

    try {
      // 1. Technical SAR Footprint (Clean frame over satellite imagery, no opaque box)
      renderSarLayer(
        layers.sarFootprint,
        scenario,
        visibleLayers.sarFootprint,
        isSat
      );

      // 2. Tab 02: Semantic Segmentation Visualization
      if (activeTab === '02') {
        renderSegmentationLayer(
          layers.segmentation,
          scenario,
          visibleLayers.spill,
          onFeatureSelect
        );
        layers.slick.clearLayers();
      } else {
        layers.segmentation.clearLayers();
        // 3. Tabs 03–07: Technical Slick Geometry (with measurement axes on Tab 03)
        renderTechnicalSlickLayer(
          layers.slick,
          scenario,
          visibleLayers.spill,
          activeTab === '03',
          onFeatureSelect
        );
      }

      // 4. Drift & Origin Uncertainty (Tabs 04–07)
      const showDrift = visibleLayers.drift && (activeTab === '04' || activeTab === '05' || activeTab === '06' || activeTab === '07');
      renderDriftLayer(
        layers.drift,
        scenario,
        drift,
        showDrift,
        onFeatureSelect,
        highlightedFactor
      );

      // 5. Metocean Vectors (Wind & Current) (Tabs 04 & 06)
      renderMetoceanLayer(
        layers.metocean,
        scenario,
        visibleLayers.metocean && (activeTab === '04' || activeTab === '06')
      );

      // 6. AIS Vessel Trajectories (Tabs 05–07)
      const showAis = visibleLayers.ais && (activeTab === '05' || activeTab === '06' || activeTab === '07');
      renderAisLayer(
        layers.ais,
        aisTraffic,
        scenarioId,
        selectedCandidateMmsi,
        onSelectCandidate,
        showAis,
        drift,
        highlightedFactor
      );

      // 7. Ensemble Envelopes (SYN-005) (Tabs 04 & 06)
      renderEnsembleLayer(
        layers.ensemble,
        ensemble,
        scenarioId,
        visibleLayers.uncertainty && (activeTab === '04' || activeTab === '06'),
        scenario
      );
    } catch (err) {
      console.error('Error rendering forensic map layers:', err);
    }
  }, [
    scenario,
    scenarioId,
    activeTab,
    drift,
    aisTraffic,
    ensemble,
    selectedCandidateMmsi,
    highlightedFactor,
    visibleLayers,
    basemapMode,
    onSelectCandidate,
    onFeatureSelect,
  ]);

  // Toggle single layer visibility
  const toggleLayer = (layerKey) => {
    setVisibleLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  return (
    <div className="relative w-full h-full bg-[#0A1118] overflow-hidden select-none">
      {/* ══ Leaflet DOM Mount Container ═════════════════════════════ */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ══ Top-Left Technical HUD ══════════════════════════════════ */}
      <div className="absolute top-3 left-3 z-[400] pointer-events-none flex flex-col gap-1.5 font-mono">
        <div className="bg-[#111111]/90 backdrop-blur-xs text-white px-3 py-1.5 border border-white/20 shadow-md flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {scenarioId || 'SYN-001'} · FORENSIC MAP
          </span>
          <span className="text-white/40">|</span>
          <span className="text-[10px] text-white/70">WGS 84 · EPSG:4326</span>
          <span className="text-white/40">|</span>
          <span className="text-[9px] px-1 py-0.2 uppercase font-bold text-cyan-300">
            {basemapMode === BASEMAP_MODES.SATELLITE ? 'SATELLITE' : 'MAP'}
          </span>
        </div>

        {/* Cursor Coordinates Readout */}
        {cursorCoords && (
          <div className="bg-white/90 backdrop-blur-xs text-[#111111] px-2.5 py-1 border border-[#CCCCCC] shadow-xs text-[10px]">
            LAT: {cursorCoords.lat}° N · LON: {cursorCoords.lng}° E
          </div>
        )}
      </div>

      {/* ══ Top-Right Map Controls & Basemap Switcher ═════════════════ */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col items-end gap-2 font-mono">
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
            onClick={fitInvestigation}
            className="w-8 h-8 flex items-center justify-center font-bold text-[10px] text-[#111111] hover:bg-[#F5F5F5] cursor-pointer"
            title="Fit Investigation Extent"
          >
            FIT
          </button>
        </div>
      </div>

      {/* ══ Bottom-Left Contextual Legend HUD ════════════════════════ */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none font-mono">
        <div className="bg-white/95 backdrop-blur-xs border border-[#111111] p-2.5 shadow-md max-w-sm">
          <div className="text-[9px] uppercase tracking-wider font-bold text-[#888888] mb-1.5 flex items-center justify-between">
            <span>
              {activeTab === '02' ? 'SEGMENTATION CLASSIFICATION' : 'INVESTIGATION LEGEND'}
            </span>
            <span className="text-[8px] text-[#666666]">STAGE {activeTab}</span>
          </div>

          {activeTab === '02' ? (
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
          ) : (
            /* Standard Technical Investigation Legend */
            <div className="space-y-1 text-[9px] text-[#333333]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#111111] border border-white" />
                <span>OBSERVED SLICK</span>
                <span className="text-gray-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#111111]" />
                <span>RECONSTRUCTED ORIGIN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#111111]" />
                <span>CANDIDATE TRACK</span>
                <span className="text-gray-300">|</span>
                <span className="w-4 h-0.5 border-b border-dashed border-[#111111]" />
                <span>BACKWARD DRIFT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#4B5563] font-bold">↑</span>
                <span>WIND FORCING</span>
                <span className="text-gray-300">|</span>
                <span className="text-[#1F2937] font-bold">→</span>
                <span>OCEAN CURRENT</span>
              </div>
            </div>
          )}

          {scenarioId === 'SYN-004' && (
            <div className="mt-2 pt-1.5 border-t border-[#EAEAEA] text-[8px] text-[#888888]">
              ATTRIBUTION ABSTENTION: Zero candidate vessels fabricated.
            </div>
          )}
        </div>
      </div>

      {/* ══ Bottom-Right Attribution HUD ═════════════════════════════ */}
      <div className="absolute bottom-2 right-2 z-[400] pointer-events-none flex flex-col items-end gap-1 font-mono text-[9px] text-[#666666]">
        <div className="bg-white/90 backdrop-blur-xs px-2.5 py-0.5 border border-[#CCCCCC] shadow-2xs">
          {basemapMode === BASEMAP_MODES.SATELLITE ? (
            <span>Tiles © Esri · WGS 84</span>
          ) : (
            <span>
              ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#111111] pointer-events-auto"
              >
                OpenStreetMap
              </a>{' '}
              contributors · WGS 84
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
