import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import IncidentMap from './IncidentMap';
import SpilltraceLogo from '../common/SpilltraceLogo';
import { INITIAL_INCIDENTS } from '../../data/incidentsData';
import {
  exportGeoJson,
  exportIncidentRecordGeoJson,
  getScenarioIdForIncident,
} from '../../services/spilltraceService.js';
import { SCENARIOS } from '../../services/scenariosData.js';

export { INITIAL_INCIDENTS } from '../../data/incidentsData';

/**
 * IncidentsArchive — "01 / INCIDENTS"
 * 
 * Dynamic case-entry point for the SPILLTRACE platform.
 * Operational case archive where selecting ANY existing incident dynamically updates
 * the map and all case-related UI.
 * 
 * Answers: "Which spill are we investigating?"
 */

export default function IncidentsArchive({
  selectedIncident,
  onSelectIncident,
  onOpenConsole,
  onNavigateToPipeline,
}) {
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState(null);

  // Derive the linked scenario for the selected incident (null if no synthesized scenario)
  const activeScenario = useMemo(() => {
    const scenarioId = getScenarioIdForIncident(selectedIncident?.id);
    return scenarioId ? SCENARIOS[scenarioId] : null;
  }, [selectedIncident?.id]);

  // Reset selected vessel when selected incident changes (No stale selection)
  useEffect(() => {
    setSelectedVesselMmsi(null);
  }, [selectedIncident?.id]);

  // Unified incident selection handler
  const handleSelectIncident = useCallback((inc) => {
    if (!inc) return;
    setSelectedVesselMmsi(null);
    onSelectIncident(inc);
  }, [onSelectIncident]);

  // Ref for scrolling table row into view
  const tableContainerRef = useRef(null);

  // New incident form state
  const [newBasin, setNewBasin] = useState('Arabian Sea (Gujarat Shelf)');
  const [newCoordinates, setNewCoordinates] = useState('21.140°N, 69.820°E');
  const [newArea, setNewArea] = useState('3.20 km²');
  const [newSensor, setNewSensor] = useState('Sentinel-1 C-SAR (ESA)');

  // Filtered incidents list
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesStatus =
        statusFilter === 'ALL' || inc.status.toUpperCase() === statusFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        inc.id.toLowerCase().includes(query) ||
        inc.basin.toLowerCase().includes(query) ||
        inc.coordinates.toLowerCase().includes(query) ||
        inc.sensor.toLowerCase().includes(query) ||
        inc.leadVessel.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [incidents, statusFilter, searchQuery]);

  // Dynamic incident-specific activity events
  const incidentEvents = useMemo(() => {
    if (!selectedIncident) return [];

    const events = (selectedIncident.timeline || []).map((step, idx) => ({
      time: step.time,
      title: step.title,
      desc: step.desc,
      id: `${selectedIncident.id} // STEP_${String(idx + 1).padStart(2, '0')}`,
      isAnomaly: false,
    }));

    // If active scenario has an AIS transmission gap (e.g. SYN-003), ensure it is surfaced
    if (activeScenario) {
      const gapTrack = activeScenario.aisTraffic?.tracks?.find((t) => t.hasAisGap && t.aisGap);
      if (gapTrack && gapTrack.aisGap) {
        const alreadyHasGap = events.some(
          (e) => e.title.toLowerCase().includes('gap') || e.desc.toLowerCase().includes('gap')
        );
        if (!alreadyHasGap) {
          events.push({
            time: '05:48 UTC',
            title: 'AIS TRANSMISSION GAP DETECTED',
            desc: `Vessel ${gapTrack.vesselName || gapTrack.mmsi} exhibited a ${gapTrack.aisGap.durationMinutes}min transponder outage during corridor transit`,
            id: `${selectedIncident.id} // AIS_GAP_ANOMALY`,
            isAnomaly: true,
          });
        }
      }
    }

    return events;
  }, [selectedIncident, activeScenario]);

  // Create incident handler
  const handleCreateIncident = (e) => {
    e.preventDefault();
    const nextNum = incidents.length + 1;
    const nextId = `INC-2026-${String(nextNum).padStart(3, '0')}`;
    
    // Parse lat and lon from coordinate string
    let lat = 21.140;
    let lon = 69.820;
    const match = newCoordinates.match(/([\d.]+)°([NS]),?\s*([\d.]+)°([EW])/i);
    if (match) {
      lat = parseFloat(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
      lon = parseFloat(match[3]) * (match[4].toUpperCase() === 'W' ? -1 : 1);
    }

    const newInc = {
      id: nextId,
      code: String(nextNum).padStart(4, '0'),
      basin: newBasin,
      subsector: 'Offshore Sector',
      coordinates: newCoordinates,
      lat,
      lon,
      detectionTime: 'JUST NOW · RECENT INGESTION',
      area: newArea,
      volume: '24.0 m³',
      sensor: newSensor,
      currentStage: '02 DETECTION',
      stageProgress: 2,
      status: 'ACTIVE',
      leadVessel: 'SCANNING AIS TRAFFIC...',
      confidence: '95.0% (Illustrative / Demo)',
      axis: '280.0° NW',
      analystLog: 'Manual incident case file created. Automated satellite SAR backscatter ingestion active.',
      timeline: [
        { time: 'RECENT', title: 'CASE CREATED', desc: 'Operational record established in maritime registry' },
        { time: 'PENDING', title: 'RADAR INGESTION', desc: 'Awaiting radar tile alignment' },
      ],
    };

    setIncidents([newInc, ...incidents]);
    handleSelectIncident(newInc);
    setIsCreateModalOpen(false);
  };

  // Case export handler: packages authentic GeoJSON FeatureCollection
  const handleExportCase = async (inc) => {
    const targetInc = inc || selectedIncident;
    if (!targetInc) return;

    try {
      const scenarioId = getScenarioIdForIncident(targetInc.id);
      let geojson = null;
      let filename = '';

      if (scenarioId) {
        geojson = await exportGeoJson(scenarioId);
        filename = `SPILLTRACE_${scenarioId}_${targetInc.id}_dossier.geojson`;
      } else {
        geojson = exportIncidentRecordGeoJson(targetInc);
        filename = `SPILLTRACE_${targetInc.id}_archive_record.geojson`;
      }

      if (geojson) {
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setExportNotice(`Investigation dossier for ${targetInc.id} exported (${filename}).`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setExportNotice(`Export failed for ${targetInc.id}.`);
    }
    setTimeout(() => setExportNotice(''), 4500);
  };

  return (
    <div id="incidents-page" className="py-8 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E5E5E5] text-[#111111]">
      <div className="max-w-7xl mx-auto font-sans">

        {/* Top Operational Breadcrumb & Quick Jump */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-[11px] text-[#777777] border-b border-[#F0F0F0] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#111111] uppercase tracking-wider">PLATFORM DIRECTORY</span>
            <span>/</span>
            <span className="uppercase text-[#888888]">CASE MANAGEMENT</span>
            <span>/</span>
            <span className="text-[#111111] font-bold uppercase">INCIDENTS REGISTER</span>
          </div>
          {onNavigateToPipeline && (
            <button
              onClick={() => onNavigateToPipeline('detect')}
              className="hover:text-black transition-colors uppercase font-medium flex items-center gap-1.5 cursor-pointer text-[#444444]"
            >
              <span>SWITCH TO DETECTION PIPELINE</span>
              <span className="font-bold">→</span>
            </button>
          )}
        </div>

        {/* ================================================================== */}
        {/* HEADER: Operational Directory Label + Telemetric Status Overview */}
        {/* ================================================================== */}
        <div className="border-b border-[#E5E5E5] pb-8 mb-10 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-mega text-[#888888] mb-2 flex items-center gap-2.5">
              <SpilltraceLogo size={20} variant="emblem" />
              01 / INCIDENT ARCHIVE &amp; CASE MANAGEMENT
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight uppercase leading-[0.92] text-[#111111]">
              INCIDENTS
            </h2>
            <p className="font-mono text-xs sm:text-sm text-[#555555] mt-3 leading-relaxed font-light">
              Maritime spill investigations, organized by event. Select an active incident to inspect geographic context, observation footprint, and associated AIS contacts before entering the forensic workspace.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#111111] text-white hover:bg-black transition-all font-mono text-[11px] font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
              >
                <span>+ CREATE INCIDENT</span>
              </button>
              <button
                onClick={() => handleExportCase(selectedIncident)}
                className="px-3.5 py-1.5 border border-[#CCCCCC] hover:border-[#111111] text-[#333333] hover:text-[#111111] transition-all font-mono text-[11px] font-medium uppercase tracking-wider cursor-pointer"
              >
                <span>EXPORT CASE DOSSIER</span>
              </button>
            </div>
          </div>

          {/* Telemetric Summary Status */}
          <div className="w-full lg:w-auto bg-[#FAFAFA] border border-[#E5E5E5] p-4 sm:p-5 font-mono text-xs self-stretch lg:self-auto min-w-[280px] sm:min-w-[340px]">
            <div className="text-[10px] text-[#888888] font-bold uppercase tracking-wider mb-2.5 pb-1.5 border-b border-[#EAEAEA]">
              TELEMETRIC SUMMARY STATUS
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#666666]">ACTIVE CASES:</span>
                <span className="font-bold text-[#111111]">07</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666]">UNDER INVESTIGATION:</span>
                <span className="font-bold text-[#111111]">05</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666]">RESOLVED / ARCHIVED:</span>
                <span className="font-bold text-[#666666]">07</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#EAEAEA]">
                <span className="text-[#666666]">TOTAL REGISTERED SPILLS:</span>
                <span className="font-bold text-[#111111]">{incidents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666]">SURVEILLANCE COVERAGE:</span>
                <span className="font-bold text-[#111111]">1,841,210 NM²</span>
              </div>
            </div>
          </div>
        </div>

        {/* Temporary Export Notification Toast */}
        {exportNotice && (
          <div className="mb-6 p-3 bg-[#111111] text-white font-mono text-xs flex items-center justify-between transition-all">
            <span>✓ {exportNotice}</span>
            <button onClick={() => setExportNotice('')} className="text-white/60 hover:text-white text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* ================================================================== */}
        {/* CURRENTLY SELECTED ACTIVE INCIDENT DOSSIER */}
        {/* ================================================================== */}
        <div className="mb-12 border-2 border-[#111111] bg-white p-5 sm:p-7 shadow-xs">
          
          {/* Top Banner Tag */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E5E5E5] font-mono text-[11px]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#111111] animate-ping" />
              <span className="font-bold uppercase tracking-wider text-[#111111]">
                {activeScenario
                  ? `ACTIVE FORENSIC PRIORITY // ${selectedIncident.id} [${activeScenario.id}]`
                  : `ARCHIVE OBSERVATION RECORD // ${selectedIncident.id}`}
              </span>
              <span className="text-[#CCCCCC]">|</span>
              <span className="text-[#666666]">{selectedIncident.basin}</span>
            </div>
            <div className="flex items-center gap-3">
              {activeScenario ? (
                <span className="text-[10px] px-2 py-0.5 bg-[#111111] text-white font-bold tracking-widest uppercase">
                  INVESTIGATION AVAILABLE // {activeScenario.id}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 bg-[#F0F0F0] text-[#666666] border border-[#CCCCCC] font-bold tracking-widest uppercase">
                  ARCHIVE OBSERVATION // NOT YET SYNTHESIZED
                </span>
              )}
              <span className="text-[#888888]">STATUS: {selectedIncident.status}</span>
            </div>
          </div>

          {/* Dossier Content Grid: 3-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* 1. Left Column: SAR Backscatter Ingest Radar Display (4 cols on lg) */}
            <div className="lg:col-span-4 border border-[#E5E5E5] bg-[#0A0B0D] p-3.5 font-mono text-white flex flex-col justify-between self-stretch shadow-xs">
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#888888] pb-1.5 border-b border-white/10 mb-2">
                  <span className="font-bold text-white uppercase tracking-wider">SAR BACKSCATTER INGEST</span>
                  <span className="text-[#00FFCC] font-semibold">VV_POLARISATION</span>
                </div>
                <div className="text-[10px] text-[#A0AEC0] mb-2">{selectedIncident.coordinates}</div>
                
                {/* Radar Display Screen */}
                <div className="relative w-full aspect-[4/3] bg-[#060709] border border-white/10 overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 240 180">
                    {/* Range Rings & Azimuth Crosshairs */}
                    <g stroke="#1E293B" strokeWidth="0.75" strokeDasharray="2,3" fill="none">
                      <circle cx="120" cy="90" r="28" />
                      <circle cx="120" cy="90" r="56" />
                      <circle cx="120" cy="90" r="82" />
                      <line x1="10" x2="230" y1="90" y2="90" />
                      <line x1="120" x2="120" y1="10" y2="170" />
                    </g>
                    {/* Hydrocarbon Slick Damping Feature */}
                    <path
                      d="M 60,95 C 78,72 115,70 148,82 C 178,94 198,114 186,126 C 165,136 122,126 92,116 C 72,108 52,105 60,95 Z"
                      fill="#000000"
                      stroke="#334155"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M 80,92 C 102,78 132,80 152,90 C 168,98 174,112 164,118 C 144,124 114,118 94,110 C 78,104 72,98 80,92 Z"
                      fill="#020617"
                      stroke="#00FFCC"
                      strokeWidth="0.75"
                      strokeDasharray="2,2"
                    />
                    {/* Reticle Target Crosshair */}
                    <g transform="translate(120, 90)">
                      <line x1="-8" x2="8" y1="0" y2="0" stroke="#FFFFFF" strokeWidth="1" />
                      <line x1="0" x2="0" y1="-8" y2="8" stroke="#FFFFFF" strokeWidth="1" />
                      <circle cx="0" cy="0" r="1.5" fill="#00FFCC" />
                    </g>
                    {/* Radar Sweep Ray */}
                    <line x1="120" y1="90" x2="200" y2="30" stroke="#00FFCC" strokeWidth="0.75" opacity="0.6" />
                  </svg>
                  <div className="absolute bottom-1.5 left-2 bg-black/85 px-1.5 py-0.5 text-[9px] font-bold text-white border border-white/20">
                    SLICK DETECTED · {selectedIncident.sensor.split(' ')[0]}
                  </div>
                  <div className="absolute top-1.5 right-2 text-[9px] font-mono text-[#94A3B8]">
                    {selectedIncident.code ? `OBS_${selectedIncident.code}` : 'PASS_5102'}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-between text-[9px] text-[#94A3B8]">
                <span>SCENE RES: 10m / PIXEL</span>
                <span>INCIDENCE: 34.2°</span>
              </div>
            </div>

            {/* 2. Middle Column: Case File Metadata (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-3 flex flex-col justify-between self-stretch">
              <div>
                <div className="font-mono text-[10px] text-[#888888] uppercase tracking-wider">
                  CASE FILE IDENTIFIER
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111]">
                  {selectedIncident.id}
                </h3>
                <div className="font-mono text-xs text-[#666666] mt-0.5">
                  {selectedIncident.basin} · {selectedIncident.subsector}
                </div>
              </div>

              {/* Data Metrics Strip */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#FAFAFA] border border-[#E5E5E5] font-mono text-xs">
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">ACQUISITION TIME</span>
                  <span className="font-semibold text-[#111111] text-[10px] sm:text-[11px]">
                    {selectedIncident.detectionTime}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">SLICK SURFACE AREA</span>
                  <span className="font-bold text-[#111111] text-[11px] sm:text-xs">
                    {selectedIncident.area}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">EST. VOLUME</span>
                  <span className="font-semibold text-[#111111] text-[10px] sm:text-[11px]">
                    {selectedIncident.volume}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">SENSOR PLATFORM</span>
                  <span className="font-semibold text-[#111111] text-[10px] sm:text-[11px]">
                    {selectedIncident.sensor}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">PRIMARY AXIS</span>
                  <span className="font-semibold text-[#111111] text-[10px] sm:text-[11px]">
                    {selectedIncident.axis}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-[#888888] block uppercase">CONFIDENCE</span>
                  <span className="font-semibold text-[#111111] text-[10px] sm:text-[11px]">
                    {selectedIncident.confidence}
                  </span>
                </div>
              </div>

              {/* Analyst Observation Log */}
              <div className="p-2.5 border border-[#E5E5E5] bg-white font-mono text-[11px] text-[#555555] leading-relaxed">
                <span className="font-bold text-[#111111] block text-[10px] uppercase mb-1">
                  ANALYST OBSERVATION LOG:
                </span>
                {selectedIncident.analystLog}
              </div>
            </div>

            {/* 3. Right Column: Workflow Stage Progression & Actions (4 cols on lg) */}
            <div className="lg:col-span-4 bg-[#FAFAFA] border border-[#E5E5E5] p-4 font-mono flex flex-col justify-between self-stretch">
              {activeScenario ? (
                <div>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#EAEAEA] text-xs">
                    <span className="font-bold text-[#111111] uppercase">INVESTIGATION PROGRESS</span>
                    <span className="text-[#888888]">STAGE {selectedIncident.stageProgress || 2} / 5</span>
                  </div>

                  {/* Progress Steps List */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#111111] font-semibold">01 DETECTION [SAR EXTRACTED]</span>
                      <span className="text-black font-bold">✓ COMPLETE</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#111111] font-semibold">02 CHARACTERISATION [GEOMETRY]</span>
                      <span className="text-black font-bold">✓ COMPLETE</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#111111] font-semibold">03 DRIFT HINDCAST [ORIGIN]</span>
                      <span className={selectedIncident.stageProgress >= 3 ? 'text-[#111111] font-bold' : 'text-[#888888]'}>
                        {selectedIncident.stageProgress > 3 ? '✓ COMPLETE' : '● ACTIVE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={selectedIncident.stageProgress >= 4 ? 'text-[#111111] font-semibold' : 'text-[#888888]'}>
                        04 AIS CORRELATION [CANDIDATES]
                      </span>
                      <span className={selectedIncident.stageProgress >= 4 ? 'font-bold' : 'text-[#888888]'}>
                        {selectedIncident.stageProgress > 4 ? '✓ COMPLETE' : selectedIncident.stageProgress === 4 ? '● ACTIVE' : 'QUEUED'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={selectedIncident.stageProgress >= 5 ? 'text-[#111111] font-semibold' : 'text-[#888888]'}>
                        05 ATTRIBUTION [LEAD DOSSIER]
                      </span>
                      <span className={selectedIncident.stageProgress >= 5 ? 'font-bold' : 'text-[#888888]'}>
                        {selectedIncident.stageProgress >= 5 ? '✓ COMPLETE' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#EAEAEA] text-xs">
                    <span className="font-bold text-[#111111] uppercase">ARCHIVE DOSSIER STATUS</span>
                    <span className="text-[#888888]">CATALOG RECORD</span>
                  </div>
                  <div className="p-3 bg-white border border-[#E5E5E5] space-y-2 text-[11px] text-[#555555]">
                    <div className="font-bold text-[#111111] uppercase text-[10px]">
                      HISTORICAL / OBSERVATIONAL RECORD
                    </div>
                    <p className="leading-relaxed">
                      Satellite SAR observation logged in maritime registry. Hydrocarbon signature cataloged with calibrated surface area ({selectedIncident.area}).
                    </p>
                    <div className="pt-2 border-t border-[#F0F0F0] text-[10px] text-[#888888] uppercase">
                      INVESTIGATION SCENARIO NOT YET SYNTHESIZED
                    </div>
                  </div>
                </div>
              )}

              {/* CTA Buttons to open operational environment */}
              <div className="mt-4 pt-3 border-t border-[#EAEAEA] space-y-2">
                {activeScenario ? (
                  <button
                    onClick={() => onOpenConsole && onOpenConsole(1, selectedIncident)}
                    className="w-full py-2 bg-[#111111] text-white hover:bg-black transition-all font-mono text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>OPEN INVESTIGATION // {activeScenario.id}</span>
                    <span>→</span>
                  </button>
                ) : (
                  <div className="w-full py-2 bg-[#F5F5F5] text-[#888888] border border-[#E5E5E5] font-mono text-xs font-bold uppercase tracking-wider text-center select-none">
                    ARCHIVE RECORD ONLY — NO ACTIVE SCENARIO
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                    className="flex-1 py-1.5 bg-white border border-[#CCCCCC] hover:border-[#111111] text-[#333333] hover:text-[#111111] transition-all font-mono text-[11px] font-medium uppercase tracking-wider cursor-pointer text-center"
                  >
                    {isTimelineExpanded ? 'HIDE SEQUENCE ▲' : 'CHRONOLOGY ▼'}
                  </button>
                  {onNavigateToPipeline && (
                    <button
                      onClick={() => onNavigateToPipeline('detect')}
                      className="py-1.5 px-3 bg-white border border-[#CCCCCC] hover:border-[#111111] text-[#333333] hover:text-[#111111] transition-all font-mono text-[11px] font-medium uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1.5"
                      title="Switch to Detection pipeline on landing page"
                    >
                      <span>PIPELINE</span>
                      <span className="font-bold">→</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Expandable Chronological Audit Trail Sequence */}
          {isTimelineExpanded && (
            <div className="mt-6 pt-5 border-t border-[#E5E5E5] font-mono text-xs animate-fadeIn">
              <div className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mb-3">
                CHRONOLOGICAL AUDIT TRAIL // UTC SEQUENCE FOR {selectedIncident.id}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {incidentEvents.map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 border ${
                      step.isAnomaly ? 'bg-[#FEF2F2] border-[#FCA5A5]' : 'bg-[#FAFAFA] border-[#E5E5E5]'
                    }`}
                  >
                    <div className={`text-[10px] font-bold ${step.isAnomaly ? 'text-[#DC2626]' : 'text-[#111111]'}`}>
                      {step.time}
                    </div>
                    <div className="text-[10px] text-[#555555] font-semibold mt-0.5 uppercase">
                      {step.title}
                    </div>
                    <div className="text-[9px] text-[#888888] mt-1 leading-snug">
                      {step.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ================================================================== */}
        {/* GEOSPATIAL INCIDENT BROWSER (MAPBOX GL JS) */}
        {/* ================================================================== */}
        <IncidentMap
          incidents={incidents}
          selectedIncidentId={selectedIncident?.id}
          scenario={activeScenario}
          onSelectIncident={handleSelectIncident}
          selectedVesselMmsi={selectedVesselMmsi}
          onSelectVessel={setSelectedVesselMmsi}
          getScenarioId={getScenarioIdForIncident}
        />

        {/* ================================================================== */}
        {/* INVESTIGATION REGISTER / CASE CATALOG TABLE */}
        {/* ================================================================== */}
        <div>
          
          {/* Controls Bar: Search + Status Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4 font-mono text-xs">
            
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'ACTIVE', 'REVIEW', 'RESOLVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 uppercase font-semibold text-[11px] border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#FAFAFA] text-[#666666] hover:text-[#111111] border-[#E5E5E5]'
                  }`}
                >
                  {st === 'ALL' ? `ALL CASES (${incidents.length})` : st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search ID, Basin, Coordinates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#CCCCCC] focus:border-[#111111] focus:outline-none bg-white font-mono text-xs text-[#111111]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111] text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

          </div>

          {/* Editorial Table Register */}
          <div className="border border-[#E5E5E5] overflow-x-auto bg-white shadow-2xs">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] text-[#888888] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">GEOGRAPHIC BASIN / COORDINATES</th>
                  <th className="py-3 px-4 font-semibold hidden md:table-cell">DETECTION (UTC)</th>
                  <th className="py-3 px-4 font-semibold">SLICK AREA</th>
                  <th className="py-3 px-4 font-semibold hidden lg:table-cell">SENSOR</th>
                  <th className="py-3 px-4 font-semibold hidden sm:table-cell">CURRENT STAGE</th>
                  <th className="py-3 px-4 font-semibold">STATUS</th>
                  <th className="py-3 px-4 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#888888]">
                      No incident cases matched your filter query.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => {
                    const isSelected = selectedIncident?.id === inc.id;
                    const scenarioId = getScenarioIdForIncident(inc.id);

                    return (
                      <tr
                        key={inc.id}
                        onClick={() => handleSelectIncident(inc)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5F5F5] font-semibold text-[#111111]'
                            : 'hover:bg-[#FAFAFA] text-[#444444]'
                        }`}
                      >
                        {/* ID */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={isSelected ? 'font-bold text-[#111111]' : 'text-[#666666]'}>
                            {inc.code}
                          </span>
                        </td>

                        {/* Geographic Basin */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#111111]">{inc.basin}</div>
                          <div className="text-[10px] text-[#888888] font-normal">{inc.coordinates}</div>
                        </td>

                        {/* Detection UTC */}
                        <td className="py-3 px-4 whitespace-nowrap hidden md:table-cell text-[11px] text-[#555555]">
                          {inc.detectionTime}
                        </td>

                        {/* Slick Area */}
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-[#111111]">
                          {inc.area}
                        </td>

                        {/* Sensor */}
                        <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[#666666] hidden lg:table-cell">
                          {inc.sensor}
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-4 whitespace-nowrap hidden sm:table-cell">
                          <span className="text-[10px] px-1.5 py-0.5 border border-[#DDDDDD] bg-white text-[#555555] uppercase">
                            {inc.currentStage}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {inc.status === 'ACTIVE' ? '■ ACTIVE' : inc.status === 'REVIEW' ? '□ REVIEW' : '○ RESOLVED'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {scenarioId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectIncident(inc);
                                if (onOpenConsole) onOpenConsole(1, inc);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#111111] hover:bg-black text-white shadow-xs'
                                  : 'border border-[#CCCCCC] hover:border-[#111111] text-[#111111] hover:bg-white'
                              }`}
                              title={`Open investigation for ${inc.id} (${scenarioId})`}
                            >
                              <span>INVESTIGATE {scenarioId}</span>
                              <span className="ml-1">→</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectIncident(inc);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#E5E5E5] text-[#111111]'
                                  : 'border border-[#E0E0E0] text-[#777777] hover:border-[#999999] hover:text-[#111111]'
                              }`}
                              title={`Inspect archive record ${inc.id}`}
                            >
                              <span>INSPECT</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#888888]">
            <div>
              SHOWING {filteredIncidents.length} OF {incidents.length} REGISTERED INCIDENTS
            </div>
            <div>
              CLICK ANY ROW OR MAP PIN TO SELECT INCIDENT CONTEXT FOR ANALYSIS
            </div>
          </div>

        </div>

        {/* ================================================================== */}
        {/* AIS / VESSEL CONTACTS TABLE (Scenario-Aware) */}
        {/* ================================================================== */}
        {activeScenario?.aisTraffic?.tracks?.length > 0 ? (
          <div className="mt-8 border border-[#E5E5E5] bg-white shadow-2xs" ref={tableContainerRef}>
            <div className="bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#111111] inline-block flex-shrink-0" />
                <span className="font-bold text-[#111111] uppercase tracking-wider">AIS / VESSEL CONTACTS</span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="text-[#888888]">{selectedIncident.id}</span>
                {selectedVesselMmsi && (
                  <span className="ml-2 px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[10px] font-bold">
                    SELECTED MMSI: {selectedVesselMmsi}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[#666666]">
                <span>{activeScenario.aisTraffic.summary.vesselsInRegion} VESSELS IN REGION</span>
                {selectedVesselMmsi && (
                  <button
                    onClick={() => setSelectedVesselMmsi(null)}
                    className="underline text-[#111111] hover:text-black cursor-pointer font-bold"
                  >
                    RESET SELECTION
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] text-[#888888] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">MMSI</th>
                    <th className="py-2.5 px-4 font-semibold">VESSEL</th>
                    <th className="py-2.5 px-4 font-semibold hidden md:table-cell">TYPE</th>
                    <th className="py-2.5 px-4 font-semibold hidden lg:table-cell">FLAG</th>
                    <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">LENGTH</th>
                    <th className="py-2.5 px-4 font-semibold">AIS GAP</th>
                    <th className="py-2.5 px-4 font-semibold">SPEED / COURSE</th>
                    <th className="py-2.5 px-4 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {activeScenario.aisTraffic.tracks.map((track) => {
                    const isSelected = selectedVesselMmsi === track.mmsi;
                    const lastPos = track.positions?.[track.positions.length - 1];
                    const sog = Math.round((lastPos?.sog || track.avgSpeedKn || 0) * 10) / 10;
                    const cog = Math.round(lastPos?.cog || 0);

                    return (
                      <tr
                        key={track.mmsi}
                        onClick={() => setSelectedVesselMmsi(isSelected ? null : track.mmsi)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FEF9C3] font-semibold text-[#111111]'
                            : 'hover:bg-[#FAFAFA] text-[#444444]'
                        }`}
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          <span className={isSelected ? 'font-bold text-[#854D0E]' : ''}>
                            {track.mmsi}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#111111] text-[11px]">{track.vesselName}</div>
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-[#666666] hidden md:table-cell">{track.vesselType}</td>
                        <td className="py-2.5 px-4 text-[11px] hidden lg:table-cell">{track.flag}</td>
                        <td className="py-2.5 px-4 text-[11px] hidden sm:table-cell">{track.lengthM}m</td>
                        <td className="py-2.5 px-4 text-[11px]">
                          {track.hasAisGap ? (
                            <span className="text-[#EF4444] font-bold">{track.aisGap?.durationMinutes}min GAP</span>
                          ) : (
                            <span className="text-[#888888]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] font-mono">
                          {sog} kn · {cog}°
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                            isSelected
                              ? 'bg-[#111111] text-white'
                              : 'border border-[#CCCCCC] text-[#666666]'
                          }`}>
                            {isSelected ? 'HIGHLIGHTED' : 'INSPECT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-8 border border-[#E5E5E5] bg-[#FAFAFA] p-5 font-mono text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-[#888888] mb-1">
              <span className="w-2 h-2 bg-[#CCCCCC] inline-block" />
              <span>AIS TRAFFIC ARCHIVE // {selectedIncident.id}</span>
            </div>
            <div className="text-[#666666] text-[11px] leading-relaxed">
              No synthesized AIS vessel contacts are correlated for archive record <span className="font-bold text-[#111111]">{selectedIncident.id}</span>.
              Synthesized kinematic vessel tracking and transponder logs are available for active investigation cases <span className="font-bold text-[#111111]">INC-2026-001 through INC-2026-005</span>.
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* LIVE SYSTEM AUDIT & ACTIVITY LOG (Incident-Specific) */}
        {/* ================================================================== */}
        <div className="mt-8 border border-[#E5E5E5] bg-white p-4 font-mono text-xs shadow-2xs">
          <div className="flex flex-wrap items-center justify-between pb-2 mb-3 border-b border-[#EAEAEA] text-[11px]">
            <div>
              <span className="font-bold text-[#111111] uppercase">LIVE SYSTEM AUDIT &amp; ACTIVITY LOG</span>
              <span className="text-[#888888] block sm:inline sm:ml-2">
                Operational event sequence for {selectedIncident.id}
                {activeScenario ? ` (${activeScenario.id})` : ' (Archive Only)'}
              </span>
            </div>
            <div className="text-[10px] text-[#555555]">
              FEED: <span className="font-bold text-[#111111]">LIVE_SOCKET // STAC-API v1.0</span>
            </div>
          </div>
          <div className="space-y-1.5 text-[11px] text-[#444444]">
            {incidentEvents.map((step, idx) => (
              <div key={step.id || idx} className="flex items-start justify-between gap-4">
                <span className={step.isAnomaly ? 'text-[#DC2626] font-semibold' : ''}>
                  ■ {step.time} {step.title} — {step.desc}
                </span>
                <span className="text-[#888888] whitespace-nowrap font-mono text-[10px]">
                  {step.id}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ================================================================== */}
      {/* CREATE INCIDENT MODAL */}
      {/* ================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#111111] max-w-lg w-full p-6 font-mono shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-[#E5E5E5] mb-4">
              <span className="font-bold text-sm uppercase text-[#111111]">
                + REGISTER NEW INCIDENT CASE
              </span>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#888888] hover:text-[#111111] text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                  GEOGRAPHIC BASIN / REGION
                </label>
                <input
                  type="text"
                  required
                  value={newBasin}
                  onChange={(e) => setNewBasin(e.target.value)}
                  className="w-full p-2 border border-[#CCCCCC] focus:border-[#111111] focus:outline-none"
                  placeholder="e.g. Arabian Sea (Gujarat Shelf)"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                  COORDINATES (LAT / LONG)
                </label>
                <input
                  type="text"
                  required
                  value={newCoordinates}
                  onChange={(e) => setNewCoordinates(e.target.value)}
                  className="w-full p-2 border border-[#CCCCCC] focus:border-[#111111] focus:outline-none"
                  placeholder="e.g. 21.140°N, 69.820°E"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                    SLICK ESTIMATED AREA
                  </label>
                  <input
                    type="text"
                    required
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full p-2 border border-[#CCCCCC] focus:border-[#111111] focus:outline-none"
                    placeholder="e.g. 3.20 km²"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                    SENSOR PLATFORM
                  </label>
                  <select
                    value={newSensor}
                    onChange={(e) => setNewSensor(e.target.value)}
                    className="w-full p-2 border border-[#CCCCCC] focus:border-[#111111] focus:outline-none bg-white"
                  >
                    <option value="Sentinel-1 C-SAR (ESA)">Sentinel-1 C-SAR (ESA)</option>
                    <option value="Radarsat-2 (MDA)">Radarsat-2 (MDA)</option>
                    <option value="Cosmo-SkyMed (ASI)">Cosmo-SkyMed (ASI)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-[#CCCCCC] text-[#555555] hover:text-[#111111] text-xs font-semibold uppercase cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#111111] text-white hover:bg-black text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  CREATE CASE &amp; INGEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
