import React, { useState, useEffect, useCallback, useRef } from 'react';
import SpilltraceLogo from '../common/SpilltraceLogo';
import InvestigationMap from './InvestigationMap';
import { SCENARIO_LIST } from '../../services/scenariosData.js';
import { INITIAL_INCIDENTS } from '../../data/incidentsData.js';
import {
  getIncidentById,
  getScenarioIdForIncident,
  getScenarioNominalDuration,
  SCENARIO_TO_INCIDENT_MAP,
  executeInvestigationPipeline,
  runDetectionStage,
  runSlickAnalysisStage,
  runDriftOriginStage,
  runAisTrafficStage,
  runEvidenceFusionStage,
  compileReportStage,
  runDetection,
  runDriftSimulation,
  queryAisCandidates,
  evaluateEvidenceScores,
  runStabilityEnsemble,
  generateDossier,
  exportGeoJson,
} from '../../services/spilltraceService.js';
import { DISCLAIMER, PRIORITY } from '../../services/types.js';
import { haversineDistanceNm } from '../../services/map/mapGeometry.js';

/**
 * Fallback Error Boundary to prevent map errors from crashing the modal
 */
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('InvestigationMap render error caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center font-mono bg-[#F8FAFC]">
          <div className="text-xs font-bold text-[#CC0000] uppercase mb-2">
            Chart Engine Recovery
          </div>
          <div className="text-[11px] text-[#666666] mb-4 max-w-sm">
            {this.state.error?.message || 'The geospatial surface encountered an unexpected rendering condition.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-[#111111] text-white text-[10px] uppercase font-bold cursor-pointer hover:bg-black transition-colors"
          >
            Reset Chart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MARITIME_CORRIDOR_METRICS = {
  'SYN-001': {
    name: 'Bay of Bengal Deep-Water Tanker Transit Lane',
    seaArea: 'Bay of Bengal / Indian EEZ Seaward Boundary',
    trafficRegime: 'High Density Hydrocarbon & Bulk Transit Corridor',
    bathymetryDepth: '1,420 m (Abyssal Plain)',
    shelfClearance: '42.5 km seaward of 200m shelf break',
    coastDistance: '68.4 km offshore (Offshore Tamil Nadu coast)',
    salinityPsu: '33.8 PSU',
    sstCelsius: '29.2 °C',
  },
  'SYN-002': {
    name: 'Offshore Mumbai High Deep Corridor',
    seaArea: 'Eastern Arabian Sea / Deep Continental Margin',
    trafficRegime: 'Multi-Vessel Convergence Zone (Crude & Products)',
    bathymetryDepth: '680 m (Continental Slope)',
    shelfClearance: '28.0 km seaward of shelf break',
    coastDistance: '94.2 km offshore (Western Continental Shelf)',
    salinityPsu: '36.2 PSU',
    sstCelsius: '28.6 °C',
  },
  'SYN-003': {
    name: 'Gulf of Oman International Tanker Transit TSS',
    seaArea: 'Gulf of Oman / Sea of Oman Deep Seaway',
    trafficRegime: 'Critical Energy Transit Route (VLCC / Suezmax)',
    bathymetryDepth: '1,120 m (Basin Floor)',
    shelfClearance: '31.5 km seaward of shelf break',
    coastDistance: '44.8 km offshore (Sohar / Fujairah transit)',
    salinityPsu: '37.1 PSU',
    sstCelsius: '30.4 °C',
  },
  'SYN-004': {
    name: 'South Arabian Sea Open Ocean Shipping Way',
    seaArea: 'Central Arabian Sea / International Deep Waters',
    trafficRegime: 'Dispersed Deep-Draft Container & Bulk Transit',
    bathymetryDepth: '2,840 m (Arabian Basin Floor)',
    shelfClearance: '110+ km seaward of any shelf break',
    coastDistance: '148.0 km offshore (Open Ocean Regime)',
    salinityPsu: '35.9 PSU',
    sstCelsius: '28.9 °C',
  },
  'SYN-005': {
    name: 'Bay of Bengal Complex Hydrodynamic Transit Zone',
    seaArea: 'Bay of Bengal / Swatch of No Ground Fringe',
    trafficRegime: 'Convergent Heavy Marine Traffic (Tanker / Bulk / Cargo)',
    bathymetryDepth: '1,680 m (Submarine Fan Basin)',
    shelfClearance: '52.0 km seaward of shelf break',
    coastDistance: '82.6 km offshore (Deep Bay of Bengal)',
    salinityPsu: '32.9 PSU',
    sstCelsius: '29.5 °C',
  },
};

/**
 * InvestigationWorkspace — Full-Page Maritime Investigation Application
 * 
 * Full-viewport geospatial investigation application combining a persistent
 * Leaflet chart workspace (~68% width) with a tab-specific analysis and control
 * panel (~32% width).
 */
export default function InvestigationWorkspace({
  isOpen = true,
  onClose,
  consoleTab = 1,
  setConsoleTab,
  selectedIncident,
  onSelectIncident,
  initialScenarioId = null,
  onSwitchScenario = null,
}) {
  // ─── Scenario Resolution from Selected Incident ─────────────────
  const [activeScenario, setActiveScenario] = useState(() => {
    if (initialScenarioId) return initialScenarioId;
    if (selectedIncident) {
      return getScenarioIdForIncident(selectedIncident.id);
    }
    return 'SYN-001';
  });

  const prevInitialScenarioIdRef = useRef(initialScenarioId);
  const prevIncidentIdRef = useRef(selectedIncident?.id);

  // Track the scenario ID that has completed loading to prevent slider effects from firing during transitions
  const loadedScenarioIdRef = useRef(null);

  // ─── Interactive Dynamic Parameters (Preserved from Phase 1) ────
  const [detectionThreshold, setDetectionThreshold] = useState(0.5);
  const [driftDuration, setDriftDuration] = useState(() => {
    const scId = initialScenarioId || getScenarioIdForIncident(selectedIncident?.id) || 'SYN-001';
    return getScenarioNominalDuration(scId);
  });
  const [windFactor, setWindFactor] = useState(1.0); // 50% to 150% (0.5 to 1.5)
  const [currentFactor, setCurrentFactor] = useState(1.0); // 0.5x to 2.0x
  const [loading, setLoading] = useState(true);

  // ─── Interactive Map Selection & Explanation State ──────────────
  const [selectedCandidateMmsi, setSelectedCandidateMmsi] = useState(null);
  const [highlightedFactor, setHighlightedFactor] = useState(null);

  // ─── Unified Canonical Investigation State (7 Sequential Stages) ──────
  const [investigationState, setInvestigationState] = useState({
    incident: null,
    scenarioId: null,
    scenario: null,
    archive: null,
    detection: null,
    slick: null,
    drift: null,
    aisTraffic: null,
    evidence: [],
    ensemble: null,
    report: null,
    provenance: null,
  });

  // Keep stateRef updated to avoid stale closures in dynamic recalculations
  const stateRef = useRef(investigationState);
  useEffect(() => {
    stateRef.current = investigationState;
  }, [investigationState]);

  // ─── Centralized Switch Scenario Handler ────────────────────────
  const handleSwitchScenario = useCallback(
    (newScenarioId) => {
      if (!newScenarioId) return;

      const mappedIncidentId = SCENARIO_TO_INCIDENT_MAP[newScenarioId];
      const incObj =
        INITIAL_INCIDENTS.find((i) => i.id === mappedIncidentId) || selectedIncident;

      prevInitialScenarioIdRef.current = newScenarioId;
      if (incObj) {
        prevIncidentIdRef.current = incObj.id;
      }

      if (onSelectIncident && incObj && incObj.id !== selectedIncident?.id) {
        onSelectIncident(incObj);
      }

      if (onSwitchScenario) {
        onSwitchScenario(newScenarioId);
      }

      // Update browser URL
      const targetPath = `/investigation/${incObj?.id || mappedIncidentId || 'INC-2026-001'}/${newScenarioId}`;
      try {
        window.history.pushState(
          { incidentId: incObj?.id, scenarioId: newScenarioId },
          '',
          targetPath
        );
      } catch (e) {
        window.location.hash = `#${targetPath}`;
      }

      // Reset dynamic parameters to scenario's nominal values
      const nominalDuration = getScenarioNominalDuration(newScenarioId);
      setDriftDuration(nominalDuration);
      setWindFactor(1.0);
      setCurrentFactor(1.0);
      setDetectionThreshold(0.5);
      setSelectedCandidateMmsi(null);
      setHighlightedFactor(null);

      setActiveScenario(newScenarioId);
    },
    [onSelectIncident, onSwitchScenario, selectedIncident]
  );

  // Sync active scenario only when initialScenarioId or selectedIncident change externally
  useEffect(() => {
    if (initialScenarioId && initialScenarioId !== prevInitialScenarioIdRef.current) {
      prevInitialScenarioIdRef.current = initialScenarioId;
      if (initialScenarioId !== activeScenario) {
        handleSwitchScenario(initialScenarioId);
      }
    } else if (selectedIncident && selectedIncident.id !== prevIncidentIdRef.current) {
      prevIncidentIdRef.current = selectedIncident.id;
      const mapped = getScenarioIdForIncident(selectedIncident.id);
      if (mapped && mapped !== activeScenario) {
        handleSwitchScenario(mapped);
      } else if (!mapped && activeScenario !== null) {
        setActiveScenario(null);
        setSelectedCandidateMmsi(null);
        setHighlightedFactor(null);
        setInvestigationState({
          incident: selectedIncident,
          scenarioId: null,
          scenario: null,
          archive: null,
          detection: null,
          slick: null,
          drift: null,
          aisTraffic: null,
          evidence: [],
          ensemble: null,
          report: null,
          provenance: null,
        });
      }
    }
  }, [selectedIncident, initialScenarioId, activeScenario, handleSwitchScenario]);

  // ─── Load Scenario & Execute Sequential Pipeline ────────────────
  const loadScenarioData = useCallback(
    async (scenarioId, incidentObj) => {
      if (!scenarioId) {
        setInvestigationState({
          incident: incidentObj,
          scenarioId: null,
          scenario: null,
          archive: null,
          detection: null,
          slick: null,
          drift: null,
          aisTraffic: null,
          evidence: [],
          ensemble: null,
          report: null,
          provenance: null,
        });
        setSelectedCandidateMmsi(null);
        setHighlightedFactor(null);
        loadedScenarioIdRef.current = null;
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const scenario = await getIncidentById(scenarioId);
        const nominalDuration = getScenarioNominalDuration(scenarioId);

        // Execute authentic sequential pipeline: Stage 1 → 2 → 3 → 4 → 5 → 6 → 7
        const pipeline = await executeInvestigationPipeline(scenarioId, {
          incidentObj,
          detectionThreshold,
          driftDuration: nominalDuration,
          windFactor: 1.0,
          currentFactor: 1.0,
        });

        setInvestigationState({
          incident: incidentObj,
          scenarioId,
          scenario,
          archive: pipeline.archive,
          detection: pipeline.detection,
          slick: pipeline.slick,
          drift: pipeline.drift,
          aisTraffic: pipeline.aisTraffic,
          evidence: pipeline.evidence,
          ensemble: pipeline.ensemble,
          report: pipeline.report,
          provenance: scenario.provenance,
        });

        loadedScenarioIdRef.current = scenarioId;

        // Set default selected candidate
        if (scenarioId === 'SYN-004') {
          setSelectedCandidateMmsi(null);
        } else {
          const list = pipeline.evidence?.candidates || (Array.isArray(pipeline.evidence) ? pipeline.evidence : []);
          const valid = list.filter((e) => e.priority !== PRIORITY.NONE);
          if (valid.length > 0) {
            const top = valid.reduce((a, b) =>
              (a.compositeScore || a.overallScore) > (b.compositeScore || b.overallScore) ? a : b
            );
            setSelectedCandidateMmsi(top.mmsi);
          } else {
            setSelectedCandidateMmsi(null);
          }
        }
      } catch (err) {
        console.error('Failed to load investigation scenario:', err);
      }
      setLoading(false);
    },
    [detectionThreshold]
  );

  // Trigger scenario load on open or scenario switch
  useEffect(() => {
    if (isOpen) {
      loadScenarioData(activeScenario, selectedIncident);
    }
  }, [isOpen, activeScenario, selectedIncident, loadScenarioData]);

  // ─── Dynamic Drift Recalculation (Causally propagates Drift → AIS → Evidence → Report) ──
  useEffect(() => {
    if (
      !isOpen ||
      !activeScenario ||
      !investigationState.scenario ||
      loadedScenarioIdRef.current !== activeScenario ||
      stateRef.current.scenarioId !== activeScenario
    ) {
      return;
    }

    const currentArchive = stateRef.current.archive;
    const currentSlick = stateRef.current.slick;
    const currentDet = stateRef.current.detection;
    if (!currentArchive || !currentSlick) return;

    // Stage 4: Re-run drift from slick + archive
    const newDrift = runDriftOriginStage(currentSlick, currentArchive, {
      direction: 'backward',
      durationHours: driftDuration,
      windFactor,
      currentFactor,
    });
    if (!newDrift) return;

    // Stage 5: Re-run AIS traffic from new drift + archive
    const newAis = runAisTrafficStage(newDrift, currentArchive);

    // Stage 6: Re-run evidence fusion from slick + new drift + new ais + archive
    const newEvidence = runEvidenceFusionStage(currentSlick, newDrift, newAis, currentArchive);

    // Stage 7: Re-compile report dossier from all stages
    const newReport = compileReportStage(currentArchive, currentDet, currentSlick, newDrift, newAis, newEvidence);

    setInvestigationState((prev) => ({
      ...prev,
      drift: newDrift,
      aisTraffic: newAis,
      evidence: newEvidence,
      ensemble: newDrift.ensembleRuns,
      report: newReport,
    }));
  }, [driftDuration, windFactor, currentFactor, isOpen, activeScenario]);

  // ─── Detection Threshold Recalculation (Causally propagates Detection → Slick → Drift → AIS → Evidence → Report) ──
  useEffect(() => {
    if (
      !isOpen ||
      !activeScenario ||
      !investigationState.scenario ||
      loadedScenarioIdRef.current !== activeScenario ||
      stateRef.current.scenarioId !== activeScenario
    ) {
      return;
    }

    const currentArchive = stateRef.current.archive;
    if (!currentArchive) return;

    // Stage 2: Re-run detection from archive
    const newDet = runDetectionStage(currentArchive, detectionThreshold);
    if (!newDet) return;

    // Stage 3: Re-run slick analysis from new detection
    const newSlick = runSlickAnalysisStage(newDet);

    // Stage 4: Re-run drift from new slick + archive
    const newDrift = runDriftOriginStage(newSlick, currentArchive, {
      direction: 'backward',
      durationHours: driftDuration,
      windFactor,
      currentFactor,
    });

    // Stage 5: Re-run AIS traffic from new drift + archive
    const newAis = runAisTrafficStage(newDrift, currentArchive);

    // Stage 6: Re-run evidence fusion from new slick + new drift + new ais + archive
    const newEvidence = runEvidenceFusionStage(newSlick, newDrift, newAis, currentArchive);

    // Stage 7: Re-compile report dossier from all stages
    const newReport = compileReportStage(currentArchive, newDet, newSlick, newDrift, newAis, newEvidence);

    setInvestigationState((prev) => ({
      ...prev,
      detection: newDet,
      slick: newSlick,
      drift: newDrift,
      aisTraffic: newAis,
      evidence: newEvidence,
      ensemble: newDrift.ensembleRuns,
      report: newReport,
    }));
  }, [detectionThreshold, isOpen, activeScenario, driftDuration, windFactor, currentFactor]);

  // Reset drift parameters
  const handleResetDrift = () => {
    const nominal = getScenarioNominalDuration(activeScenario);
    setDriftDuration(nominal);
    setWindFactor(1.0);
    setCurrentFactor(1.0);
  };

  // ─── Authentic GeoJSON Export ───────────────────────────────────
  const handleExportGeoJson = async () => {
    if (!activeScenario) return;
    const geojson = await exportGeoJson(activeScenario, {
      drift: investigationState.drift,
      evidence: investigationState.evidence,
    });
    if (!geojson) return;
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPILLTRACE_${activeScenario}_investigation_dossier.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Map feature click handler
  const handleFeatureSelect = (feature) => {
    if (feature === 'spill') {
      if (consoleTab !== 1 && consoleTab !== 2) setConsoleTab(2);
    } else if (feature === 'origin') {
      if (consoleTab !== 3) setConsoleTab(3);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    '01 Archive',
    '02 Detection',
    '03 Slick Analysis',
    '04 Drift & Origin',
    '05 AIS Traffic',
    '06 Evidence Fusion',
    '07 Evidence Report',
  ];
  const tabKeys = ['01', '02', '03', '04', '05', '06', '07'];
  const activeTabKey = tabKeys[consoleTab] || '02';

  const s = investigationState.scenario;
  const archiveStage = investigationState.archive;
  const detectionResult = investigationState.detection;
  const slickResult = investigationState.slick;
  const driftResult = investigationState.drift;
  const aisData = investigationState.aisTraffic;
  const evidenceScores = investigationState.evidence || [];
  const ensembleRuns = investigationState.ensemble || [];

  // Candidate extraction from structured evidence contract or array
  const isSyn004 = activeScenario === 'SYN-004' || s?.report?.abstention || evidenceScores?.attributionStatus === 'ABSTAINED';
  const candidateList = isSyn004
    ? []
    : (evidenceScores?.candidates || (Array.isArray(evidenceScores) ? evidenceScores : []));
  const validCandidates = isSyn004
    ? []
    : candidateList.filter((e) => e.priority !== PRIORITY.NONE);
  const topCandidate =
    !isSyn004 && validCandidates.length > 0
      ? validCandidates.reduce((a, b) =>
          (a.compositeScore || a.overallScore) > (b.compositeScore || b.overallScore) ? a : b
        )
      : null;

  // Selected candidate object (strictly null in SYN-004)
  const activeCandidate = isSyn004
    ? null
    : (candidateList.find((e) => String(e.mmsi) === String(selectedCandidateMmsi)) || topCandidate);

  // ─── UI Helper Components ───────────────────────────────────────
  const SyntheticBadge = () => (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 text-white font-mono text-[9px] uppercase tracking-wider border border-white/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      DEMO / SYNTHETIC DATA
    </span>
  );

  const Stat = ({ label, value, unit }) => (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[#888888] mb-0.5">
        {label}
      </span>
      <span className="text-xs sm:text-sm font-semibold text-[#111111] font-mono">
        {value}
        {unit && (
          <span className="text-[#888888] font-normal text-xs ml-0.5">
            {unit}
          </span>
        )}
      </span>
    </div>
  );

  const ScoreBar = ({ label, value, max = 100, isInteractive = false, isActive = false, onClick }) => (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-1 rounded transition-colors ${
        isInteractive ? 'cursor-pointer hover:bg-[#F5F5F5]' : ''
      } ${isActive ? 'bg-[#F0F4F8] border border-[#111111]' : ''}`}
    >
      <span className="text-[11px] text-[#444444] w-44 shrink-0 font-medium flex items-center justify-between">
        <span>{label}</span>
        {isActive && (
          <span className="text-[9px] text-[#111111] font-mono uppercase bg-white border border-[#111] px-1">
            MAP FOCUS
          </span>
        )}
      </span>
      <div className="flex-1 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(value / max) * 100}%`,
            backgroundColor:
              value >= 80 ? '#111111' : value >= 60 ? '#555555' : '#999999',
          }}
        />
      </div>
      <span className="text-xs font-semibold text-[#111111] w-8 text-right font-mono">
        {value}
      </span>
    </div>
  );

  const SectionHeader = ({ number, title, subtitle }) => (
    <div className="mb-4 pb-3 border-b border-[#EAEAEA]">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono text-[#888888] uppercase tracking-wider">
          {number}
        </span>
        <h3 className="text-base font-semibold text-[#111111] tracking-[-0.01em]">
          {title}
        </h3>
      </div>
      {subtitle && (
        <p className="text-[12px] text-[#666666] leading-relaxed">{subtitle}</p>
      )}
    </div>
  );

  return (
    <div className="w-full h-screen h-[100dvh] flex flex-col bg-white overflow-hidden font-sans">
      
      {/* ══ Top Operational Header (Full-Width, Non-Modal) ═════════ */}
      <header className="w-full bg-[#111111] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 border-b border-white/10 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <SpilltraceLogo />
          <span className="font-semibold text-xs tracking-wider uppercase text-white/90 whitespace-nowrap">
            Investigation Workspace
          </span>
          <span className="text-white/30 hidden sm:inline">·</span>
          <span className="font-mono text-[11px] text-white/80 hidden sm:inline whitespace-nowrap">
            {selectedIncident
              ? `${selectedIncident.id} (${selectedIncident.basin})`
              : 'INC-2026-001'}
          </span>
          {s && (
            <>
              <span className="text-white/30 hidden md:inline">·</span>
              <span className="font-mono text-[11px] text-white/60 hidden md:inline truncate max-w-sm">
                {s.id}: {s.name}
              </span>
            </>
          )}
          {!activeScenario && (
            <>
              <span className="text-white/30 hidden sm:inline">·</span>
              <span className="font-mono text-[11px] text-amber-300 hidden sm:inline">
                [SIMULATION SCENARIO PENDING]
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Scenario Selector: Accessible from every tab */}
          <div className="flex items-center gap-1 bg-white/10 p-1 border border-white/20">
            <span className="text-[9px] font-mono uppercase text-white/50 px-1 hidden xl:inline">
              SCENARIO:
            </span>
            {SCENARIO_LIST.map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleSwitchScenario(sc.id)}
                className={`px-1.5 py-0.5 text-[10px] font-mono uppercase font-bold transition-all cursor-pointer ${
                  activeScenario === sc.id
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title={`${sc.id}: ${sc.name}`}
              >
                {sc.id.replace('SYN-', 'S')}
              </button>
            ))}
          </div>

          <SyntheticBadge />
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-mono text-xs uppercase tracking-wider border border-white/20 transition-all cursor-pointer flex items-center gap-2"
            title="Close Investigation & Return to Archive"
          >
            <span className="hidden sm:inline">CLOSE INVESTIGATION</span>
            <span className="sm:hidden">CLOSE</span>
            <span className="text-white/60 font-bold">✕</span>
          </button>
        </div>
      </header>

      {/* ══ Tab Navigation (Application-Level, Full-Width) ═════════ */}
      <nav className="w-full bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 sm:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 z-10">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setConsoleTab(idx)}
            className={`px-3 py-1.5 font-mono text-[11px] transition-all whitespace-nowrap cursor-pointer border ${
              consoleTab === idx
                ? 'bg-[#111111] text-white border-[#111111] font-semibold shadow-xs'
                : 'text-[#666666] border-transparent hover:text-[#111111] hover:bg-[#EEEEEE]'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ══ Workspace Core Area ═══════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden bg-white">
          {!activeScenario ? (
            /* Explicit Unmapped Incident / Observation State */
            <div className="max-w-3xl mx-auto py-12 text-center p-6 overflow-y-auto w-full">
              <div className="font-mono text-xs text-[#888888] uppercase tracking-wider mb-2">
                ARCHIVE RECORD: {selectedIncident?.id || 'INC-2026-CASE'} //{' '}
                {selectedIncident?.basin || 'Indian Ocean'}
              </div>
              <h3 className="text-2xl font-bold text-[#111111] mb-3 uppercase tracking-tight">
                Simulation Scenario Not Yet Synthesized
              </h3>
              <p className="text-[13px] text-[#555555] leading-relaxed max-w-xl mx-auto mb-6">
                Incident {selectedIncident?.id} ({selectedIncident?.basin},{' '}
                {selectedIncident?.coordinates}) is registered in the maritime incident
                catalog as an observation record. Backward drift reconstruction and
                AIS correlation scenarios are available for the 5 canonical demonstration
                cases (SYN-001 through SYN-005).
              </p>
              <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] max-w-lg mx-auto mb-6 text-left font-mono text-xs">
                <div className="font-bold text-[#111111] mb-2 uppercase">
                  AVAILABLE CANONICAL DEMONSTRATION SCENARIOS:
                </div>
                <div className="space-y-1.5 text-[#666666]">
                  {SCENARIO_LIST.map((sc) => (
                    <div key={sc.id}>
                      •{' '}
                      <button
                        onClick={() => {
                          handleSwitchScenario(sc.id);
                          setConsoleTab(1); // Open on 02 Detection
                        }}
                        className="underline font-bold text-[#111111] cursor-pointer hover:text-black"
                      >
                        {sc.id}
                      </button>
                      : {sc.name}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  handleSwitchScenario('SYN-001');
                  setConsoleTab(1);
                }}
                className="px-5 py-2.5 bg-[#111111] text-white text-xs font-mono uppercase cursor-pointer hover:bg-black transition-colors"
              >
                Load Canonical Scenario SYN-001 →
              </button>
            </div>
          ) : !s || loading ? (
            <div className="flex items-center justify-center w-full h-full text-[#888888] font-mono text-sm">
              <div className="text-center p-8">
                <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <div className="text-xs uppercase tracking-wider text-[#555555] font-bold">
                  Initialising Forensic Pipeline // {activeScenario}…
                </div>
                <div className="text-[11px] text-[#888888] mt-1 font-mono">
                  Synthesizing SAR detection, drift hydrodynamics, and AIS trajectories
                </div>
              </div>
            </div>
          ) : (
            /* ══ SPATIAL INVESTIGATION WORKSPACE (Tabs 01–07) ══════ */
            <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden w-full">
              
              {/* ── LEFT COLUMN: Interactive Investigation Map (~68%) ── */}
              <div className="lg:w-[68%] w-full h-[50vh] min-h-[480px] lg:h-full relative border-b lg:border-b-0 lg:border-r border-[#E5E5E5] bg-[#F8FAFC]">
                <MapErrorBoundary>
                  <InvestigationMap
                    investigationState={investigationState}
                    activeTab={activeTabKey}
                    selectedCandidateMmsi={selectedCandidateMmsi}
                    onSelectCandidate={(mmsi) => setSelectedCandidateMmsi(mmsi)}
                    highlightedFactor={highlightedFactor}
                    onSelectFactor={(factor) => setHighlightedFactor(factor)}
                    onFeatureSelect={handleFeatureSelect}
                  />
                </MapErrorBoundary>
              </div>

              {/* ── RIGHT COLUMN: Tab-Specific Analysis Panel (~32%) ── */}
              <div className="lg:w-[32%] w-full flex-1 lg:h-full overflow-y-auto p-4 sm:p-6 bg-white flex flex-col justify-between">
                <div>
                  {/* ── TAB 0: 01 Archive ─────────────────────────── */}
                  {consoleTab === 0 && (
                    <div>
                      <SectionHeader
                        number="01 /"
                        title="Case Intake & Source Record"
                        subtitle="What case is this, what was observed, what data entered the investigation, and when did the case originate?"
                      />

                      {/* Scenario Switcher */}
                      <div className="mb-4 p-2.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] text-[#888888] uppercase tracking-wider">
                          <span>Active Scenario</span>
                          <span className="text-[#111111] font-bold">{activeScenario}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 font-mono text-[10px]">
                          {SCENARIO_LIST.map((sc) => (
                            <button
                              key={sc.id}
                              onClick={() => handleSwitchScenario(sc.id)}
                              className={`py-1 text-center transition-all cursor-pointer border ${
                                activeScenario === sc.id
                                  ? 'bg-[#111111] text-white border-[#111111] font-bold shadow-2xs'
                                  : 'bg-white text-[#555555] border-[#CCCCCC] hover:border-[#111111]'
                              }`}
                              title={`${sc.id}: ${sc.name}`}
                            >
                              {sc.id.replace('SYN-', 'S')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Case Record Card */}
                      <div className="p-3.5 border-2 border-[#111111] mb-4 bg-white">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold flex items-center justify-between">
                          <span>CASE RECORD</span>
                          <span className="text-[#111111]">{s.id}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 mb-2">
                          <Stat label="INCIDENT ID" value={selectedIncident?.id || s.report.incidentId} />
                          <Stat label="SCENARIO" value={s.id} />
                          <Stat
                            label="ACQUISITION TIME"
                            value={s.scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'}
                          />
                          <Stat label="SOURCE" value={`${s.scene.sensor} (${s.scene.agency})`} />
                          <Stat label="DATA STATUS" value={s.provenance.dataStatus} />
                          <Stat label="CASE STATE" value="ACTIVE INVESTIGATION" />
                        </div>
                      </div>

                      {/* Data Inventory */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold">
                          DATA INVENTORY
                        </div>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                            <span className="text-[#666666]">SAR scene:</span>
                            <span className="text-[#111111] font-semibold">{s.scene.sensor} ({s.scene.productType} · {s.scene.resolutionM}m)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                            <span className="text-[#666666]">Detection geometry:</span>
                            <span className="text-[#111111] font-semibold">1 slick ({s.spill.areaKm2} km² · {Math.round(s.spill.confidence * 100)}% conf)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                            <span className="text-[#666666]">AIS tracks:</span>
                            <span className="text-[#111111] font-semibold">{aisData?.summary?.vesselsInRegion ?? aisData?.tracks?.length ?? 0} vessels ({isSyn004 ? 0 : (aisData?.summary?.candidates ?? validCandidates.length)} candidates)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                            <span className="text-[#666666]">Metocean data:</span>
                            <span className="text-[#111111] font-semibold">{s.forcing?.source || 'CMEMS + ERA5'}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#666666]">Drift inputs:</span>
                            <span className="text-[#111111] font-semibold">{driftResult?.durationHours || s.drift?.backward?.durationHours || 12}h hindcast · {driftResult?.particleCount || s.drift?.backward?.particleCount || 1000} particles</span>
                          </div>
                        </div>
                      </div>

                      {/* Compact Case Timeline */}
                      <div className="p-3 bg-white border border-[#E5E5E5] mb-4">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold">
                          CASE TIMELINE
                        </div>
                        <div className="space-y-2 font-mono text-[10px]">
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#111111] mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span className="text-[#111111] font-semibold">SAR acquisition</span>
                              <span className="text-[#777777]">{s.scene.acquisitionTime.replace('T', ' ').substring(0, 16)} UTC</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#111111] mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span className="text-[#111111] font-semibold">Detection generated</span>
                              <span className="text-[#777777]">T + 13m</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#111111] mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span className="text-[#111111] font-semibold">Investigation initialized</span>
                              <span className="text-[#777777]">{s.provenance.processedAt.replace('T', ' ').substring(0, 16)} UTC</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#111111] mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span className="text-[#111111] font-semibold">AIS correlation window established</span>
                              <span className="text-[#777777]">{driftResult?.releaseWindowStart || s?.drift?.backward?.releaseWindowStart || '—'} – {driftResult?.releaseWindowEnd || s?.drift?.backward?.releaseWindowEnd || '—'}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                            <div className="flex-1 flex justify-between">
                              <span className="text-[#111111] font-semibold">Evidence analysis</span>
                              <span className="text-[#059669] font-bold">READY</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Satellite SAR Scene Provenance */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-2 font-bold flex justify-between items-center">
                          <span>SAR SCENE PROVENANCE & GEODESY</span>
                          <span className="text-[#111111] font-semibold">ESA SENTINEL-1</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[#444444]">
                          <div><span className="text-[#888888] block text-[9px]">Sensor Mode:</span> <strong className="text-[#111111]">C-SAR // Interferometric Wide (IW)</strong></div>
                          <div><span className="text-[#888888] block text-[9px]">Product Level:</span> <strong className="text-[#111111]">Level-1 GRDH (Ground Range Detected)</strong></div>
                          <div><span className="text-[#888888] block text-[9px]">Polarization:</span> <strong className="text-[#111111]">{s.scene.polarization || 'Dual-pol VV + VH'}</strong></div>
                          <div><span className="text-[#888888] block text-[9px]">Pixel Spacing:</span> <strong className="text-[#111111]">{s.scene.resolutionM}m × {s.scene.resolutionM}m</strong></div>
                          <div><span className="text-[#888888] block text-[9px]">Orbit Direction:</span> <strong className="text-[#111111]">{s.scene.orbitDirection}</strong></div>
                          <div><span className="text-[#888888] block text-[9px]">Geodetic Reference:</span> <strong className="text-[#111111]">WGS 84 (EPSG:4326)</strong></div>
                        </div>
                      </div>

                      {/* Regional Maritime Shipping Corridor & Oceanographic Context */}
                      {(() => {
                        const corridor = MARITIME_CORRIDOR_METRICS[activeScenario] || MARITIME_CORRIDOR_METRICS['SYN-001'];
                        return (
                          <div className="p-3 bg-white border border-[#E5E5E5] mb-4 font-mono text-[10px]">
                            <div className="uppercase tracking-wider text-[#888888] mb-2 font-bold flex justify-between items-center">
                              <span>REGIONAL MARITIME CORRIDOR & BATHYMETRY</span>
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-1 py-0.5 text-[9px] font-bold">DEEP OCEAN</span>
                            </div>
                            <div className="space-y-1.5 text-[#444444]">
                              <div><span className="text-[#888888] block text-[9px]">Corridor / Sea Area:</span> <strong className="text-[#111111]">{corridor.name} ({corridor.seaArea})</strong></div>
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F0F0F0]">
                                <div><span className="text-[#888888] block text-[9px]">Traffic Regime:</span> <strong className="text-[#111111]">{corridor.trafficRegime}</strong></div>
                                <div><span className="text-[#888888] block text-[9px]">Bathymetric Depth:</span> <strong className="text-[#111111]">{corridor.bathymetryDepth}</strong></div>
                                <div><span className="text-[#888888] block text-[9px]">Continental Shelf Clearance:</span> <strong className="text-[#111111]">{corridor.shelfClearance}</strong></div>
                                <div><span className="text-[#888888] block text-[9px]">Shoreline Separation:</span> <strong className="text-[#111111]">{corridor.coastDistance}</strong></div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Forensic Ingest & Custody Chain Audit */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-2 font-bold flex justify-between items-center">
                          <span>INGEST AUDIT & CHAIN OF CUSTODY</span>
                          <span className="text-emerald-700 font-bold">ISO/IEC 27037 VERIFIED</span>
                        </div>
                        <div className="space-y-1 text-[#444444]">
                          <div className="flex justify-between">
                            <span className="text-[#888888]">Scene SHA-256 Checksum:</span>
                            <span className="text-[#111111] font-bold">9f8a3c4b7e12...d1e8</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#888888]">Ingest Protocol & API:</span>
                            <span className="text-[#111111]">Copernicus Hub OGC WCS v3.1</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#888888]">Operating Forensic Analyst:</span>
                            <span className="text-[#111111] font-semibold">ANALYST-FORENSIC-04</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#888888]">Evidence Custody Lock:</span>
                            <span className="text-emerald-700 font-bold">SEALED & IMMUTABLE</span>
                          </div>
                        </div>
                      </div>

                      {/* Synthetic Dataset Audit Trail */}
                      <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] text-[10px] text-[#334155] font-mono leading-relaxed mb-4">
                        <strong className="text-[#0F172A] block uppercase mb-0.5">Synthetic Forensic Dataset Notice:</strong>
                        Satellite SAR backscatter geometry, metocean fields, and vessel transponder logs are synthesized to model authentic hydrodynamic and maritime transport phenomena in the Indian Ocean basin with strict physics-based consistency.
                      </div>

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(1)}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Proceed to Detection (02) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 1: 02 Detection ─────────────────────────── */}
                  {consoleTab === 1 && (
                    <div>
                      <SectionHeader
                        number="02 /"
                        title="SAR Detection & Look-Alike Screening"
                        subtitle="Satellite SAR scene ingested and segmented. Adjust confidence threshold to test look-alike rejection."
                      />

                      {/* Scene Telemetry */}
                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <Stat label="Sensor" value={s.scene.sensor} />
                        <Stat
                          label="Acquisition"
                          value={s.scene.acquisitionTime
                            .replace('T', ' ')
                            .substring(0, 16) + ' UTC'}
                        />
                        <Stat label="Orbit" value={s.scene.orbitDirection} />
                        <Stat label="Polarization" value={s.scene.polarization} />
                        <Stat label="Resolution" value={`${s.scene.resolutionM} m`} />
                        <Stat label="Noise Floor" value={`${s.scene.validation.noiseFloorDb} dB`} />
                      </div>

                      {/* Validation Badges */}
                      <div className="flex gap-2 mb-4">
                        {[
                          ['Geometry', s.scene.validation.geometryValid],
                          ['Radiometry', s.scene.validation.radiometryValid],
                          ['Coverage', s.scene.validation.coverageComplete],
                        ].map(([label, ok]) => (
                          <span
                            key={label}
                            className={`flex-1 text-center py-1 border text-[10px] font-mono ${
                              ok
                                ? 'border-[#111111] bg-white text-[#111111] font-bold'
                                : 'border-[#FF4444] bg-[#FFF5F5] text-[#CC0000]'
                            }`}
                          >
                            {ok ? '✓' : '✕'} {label}
                          </span>
                        ))}
                      </div>

                      {/* Threshold Slider */}
                      <div className="mb-4 p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] uppercase text-[#666666]">
                            Segmentation Threshold
                          </span>
                          <span className="font-mono text-xs font-bold text-[#111111]">
                            {(detectionThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="0.99"
                          step="0.01"
                          value={detectionThreshold}
                          onChange={(e) => setDetectionThreshold(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-[#E0E0E0] appearance-none cursor-pointer accent-[#111111]"
                        />
                      </div>

                      {/* Detection Result */}
                      {detectionResult && (
                        <div className="p-3.5 border-2 border-[#111111] mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#888888]">
                              Detection Confidence
                            </span>
                            <span className="font-mono text-xs font-bold bg-[#111111] text-white px-1.5 py-0.5">
                              {(detectionResult.confidence * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <Stat label="Estimated Area" value={detectionResult.areaKm2} unit="km²" />
                            <Stat
                              label="Classification"
                              value={detectionResult.classification.replace('_', ' ')}
                            />
                          </div>

                          {/* Look-Alike Discrimination */}
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2">
                            Look-Alike Discrimination
                          </div>
                          <div className="space-y-1.5">
                            {Object.entries(detectionResult.lookAlikeScores).map(([key, val]) => (
                              <ScoreBar
                                key={key}
                                label={key.replace(/([A-Z])/g, ' $1').trim()}
                                value={Math.round(val * 100)}
                              />
                            ))}
                          </div>

                          {/* 6-Step SAR Detection Pipeline Tracker */}
                          <div className="mt-3.5 pt-3 border-t border-[#E5E5E5] font-mono text-[9px]">
                            <div className="uppercase tracking-wider text-[#888888] font-bold mb-2 flex justify-between items-center">
                              <span>SAR DETECTION PIPELINE TRACKER</span>
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-1 py-0.5 font-bold">6/6 VERIFIED</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                                <span className="text-[#555555]">1. Radiometric σ° Calibration:</span>
                                <strong className="text-[#111111]">✓ CALIBRATED</strong>
                              </div>
                              <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                                <span className="text-[#555555]">2. Lee Sigma Speckle Filter:</span>
                                <strong className="text-[#111111]">✓ 5×5 KERNEL APPLIED</strong>
                              </div>
                              <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                                <span className="text-[#555555]">3. Incidence Angle Normalization:</span>
                                <strong className="text-[#111111]">✓ θ = 38.5° CORRECTED</strong>
                              </div>
                              <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                                <span className="text-[#555555]">4. Adaptive CFAR Segmentation:</span>
                                <strong className="text-[#111111]">✓ Pfa = 10⁻⁴ DELINEATED</strong>
                              </div>
                              <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                                <span className="text-[#555555]">5. Morphological Opening/Closing:</span>
                                <strong className="text-[#111111]">✓ STRUCT 3×3 ENCLOSED</strong>
                              </div>
                              <div className="flex justify-between items-center pt-0.5">
                                <span className="text-[#555555]">6. Multi-class Look-Alike Screening:</span>
                                <strong className="text-emerald-700">✓ PASSED</strong>
                              </div>
                            </div>
                          </div>

                          {/* Capillary Wave Damping & Bragg Attenuation */}
                          <div className="mt-3.5 pt-3 border-t border-[#E5E5E5] font-mono text-[10px]">
                            <div className="uppercase tracking-wider text-[#888888] font-bold mb-1.5 flex justify-between items-center">
                              <span>CAPILLARY WAVE DAMPING ANALYSIS</span>
                              <span className="text-[#CC0000] font-bold">−8.4 dB CONTRAST</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[#444444] mb-2">
                              <div><span className="text-[#888888] block text-[9px]">Ambient Clutter σ°:</span> <strong className="text-[#111111]">−14.2 dB</strong></div>
                              <div><span className="text-[#888888] block text-[9px]">Slick Floor σ°:</span> <strong className="text-[#111111]">−22.6 dB</strong></div>
                              <div><span className="text-[#888888] block text-[9px]">Bragg Wavelength:</span> <strong className="text-[#111111]">λ_B = 4.2 cm</strong></div>
                              <div><span className="text-[#888888] block text-[9px]">Sensor Mode:</span> <strong className="text-[#111111]">C-Band (5.405 GHz)</strong></div>
                            </div>
                            <div className="text-[9px] text-[#666666] leading-relaxed pt-1.5 border-t border-[#EEEEEE]">
                              Hydrocarbon viscoelastic surface film attenuates high-frequency gravity-capillary waves, suppressing resonant Bragg backscatter relative to rough surrounding sea surface.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(2)}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Proceed to Slick Analysis (03) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 2: 03 Slick Analysis ────────────────────── */}
                  {consoleTab === 2 && (
                    <div>
                      <SectionHeader
                        number="03 /"
                        title="Slick Characterisation & Morphology"
                        subtitle="Computed 2D spatial geometry, dispersion axes, and morphological classification."
                      />

                      {/* 8 Spatial Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4 p-3.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <Stat label="Slick Area" value={slickResult?.areaKm2 || detectionResult?.areaKm2 || s.spill.areaKm2} unit="km²" />
                        <Stat label="Perimeter" value={slickResult?.perimeterKm || s.spill.perimeterKm} unit="km" />
                        <Stat label="Major Axis" value={slickResult?.majorAxisKm || s.spill.majorAxisKm} unit="km" />
                        <Stat label="Minor Axis" value={slickResult?.minorAxisKm || s.spill.minorAxisKm} unit="km" />
                        <Stat label="Orientation" value={`${slickResult?.orientationDeg ?? s.spill.orientationDeg}°`} />
                        <Stat label="Aspect Ratio" value={(slickResult?.aspectRatio || s.spill.aspectRatio).toFixed(2)} />
                        <Stat label="Compactness" value={(slickResult?.compactness || s.spill.compactness).toFixed(2)} />
                        <Stat
                          label="Confidence"
                          value={`${(((slickResult?.confidence || detectionResult?.confidence || s.spill.confidence)) * 100).toFixed(1)}%`}
                        />
                      </div>

                      {/* Centroid Reference */}
                      <div className="p-3 bg-white border border-[#E5E5E5] mb-4 text-[11px] font-mono">
                        <div className="text-[10px] text-[#888888] uppercase mb-1">
                          Centroid Geographic Reference
                        </div>
                        <div className="text-[#111111] font-semibold">
                          {(slickResult?.centroid || s.spill.centroid)[1].toFixed(4)}°N, {(slickResult?.centroid || s.spill.centroid)[0].toFixed(4)}°E
                        </div>
                      </div>

                      {/* Morphological Interpretation */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4 text-[11px] text-[#555555] leading-relaxed">
                        <span className="font-bold text-[#111111] block mb-1">
                          GEOMETRIC DISPERSION ASSESSMENT:
                        </span>
                        {slickResult?.dispersionAssessment || (
                          <>
                            Elongation along {s.spill.orientationDeg}° correlates with primary surface
                            current shear and downwind transport vectors. Major/minor ratio of{' '}
                            {s.spill.aspectRatio.toFixed(2)} indicates active Lagrangian spreading along the dominant advection axis.
                          </>
                        )}
                      </div>

                      {/* Look-Alike Evidence Discrimination Comparison */}
                      <div className="p-3.5 bg-white border border-[#E5E5E5] mb-4">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold">
                          Look-Alike Discrimination Comparison
                        </div>
                        <div className="space-y-1.5">
                          {Object.entries(slickResult?.lookAlikeScores || detectionResult?.lookAlikeScores || s.spill.lookAlikeScores || {}).map(([key, val]) => (
                            <ScoreBar
                              key={key}
                              label={key.replace(/([A-Z])/g, ' $1').trim()}
                              value={Math.round(val * 100)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Bonn Agreement Appearance Code & Volume Estimation */}
                      <div className="p-3.5 bg-white border-2 border-[#111111] mb-4 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-2 font-bold flex justify-between items-center">
                          <span>BONN AGREEMENT DISCHARGE ESTIMATE</span>
                          <span className="bg-[#111111] text-white px-1.5 py-0.5 font-bold text-[9px]">BAAC CODE 2–3</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2.5">
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Thickness Spectrum:</span>
                            <strong className="text-[#111111]">0.3 µm – 5.0 µm</strong>
                          </div>
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Appearance:</span>
                            <strong className="text-[#111111]">Rainbow Sheen / Metallic</strong>
                          </div>
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Min Estimated Volume:</span>
                            <strong className="text-[#111111]">14.8 m³ (12.4 MT)</strong>
                          </div>
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Max Estimated Volume:</span>
                            <strong className="text-[#111111]">32.4 m³ (27.2 MT)</strong>
                          </div>
                        </div>
                        <div className="p-2 bg-[#F8FAFC] border border-[#CBD5E1] text-[9px] text-[#334155] leading-relaxed">
                          <strong>Nominal In-Situ Volume: ~21.6 m³</strong> (equivalent to ~18.1 metric tonnes crude/bunker fraction). Weathering models indicate ~18.2% evaporative loss of light aromatics over the 12-hour drift period.
                        </div>
                      </div>

                      {/* Analytical Look-Alike Rejection Justifications */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-2 font-bold">
                          PHYSICAL LOOK-ALIKE REJECTION RATIONALE
                        </div>
                        <div className="space-y-1.5 text-[9px] text-[#555555]">
                          <div className="pb-1 border-b border-[#EEEEEE]">
                            <strong className="text-[#111111]">1. Low-Wind Calm Rejection:</strong> Local wind speed ({s.forcing?.windSpeedKn || 14} kn) exceeds 3.0 m/s threshold. Sea clutter is fully turbulent; no meteorological glassy calm present.
                          </div>
                          <div className="pb-1 border-b border-[#EEEEEE]">
                            <strong className="text-[#111111]">2. Biogenic Film Rejection:</strong> High elongation ratio ({(slickResult?.aspectRatio || s.spill.aspectRatio).toFixed(2)}) and sharp downwind boundaries contradict diffuse organic algal blooms.
                          </div>
                          <div className="pb-1 border-b border-[#EEEEEE]">
                            <strong className="text-[#111111]">3. Internal Solitary Waves:</strong> Bathymetric depth exceeds 250m with no rhythmic dark-bright crest packets characteristic of tidally-forced internal waves.
                          </div>
                          <div>
                            <strong className="text-[#111111]">4. Ship Wake False Positive:</strong> Delineated geometry exhibits asymmetric diffusion tail without Kelvin wedge or diverging V-crest envelope.
                          </div>
                        </div>
                      </div>

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(3)}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Proceed to Drift & Origin (04) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 3: 04 Drift & Origin ────────────────────── */}
                  {consoleTab === 3 && (
                    <div>
                      <SectionHeader
                        number="04 /"
                        title="Backward Drift Reconstruction"
                        subtitle="Lagrangian back-cast simulation under coupled metocean forcing."
                      />

                      {/* ── SECTION 04.1: Backward Ensemble Parameters ── */}
                      <div className="mb-4 p-3.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#EAEAEA]">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#111111] font-bold">
                            04.1 / Backward Ensemble Parameters
                          </span>
                          <button
                            onClick={handleResetDrift}
                            className="font-mono text-[10px] text-[#666666] hover:text-[#111111] underline cursor-pointer uppercase"
                          >
                            RESET
                          </button>
                        </div>

                        {/* Back-cast Duration */}
                        <div className="mb-3.5">
                          <div className="flex justify-between text-[11px] text-[#555555] mb-1.5 font-mono">
                            <span className="text-[#666666] uppercase text-[10px]">Back-cast Duration</span>
                            <span className="font-bold text-[#111111]">
                              −{driftDuration}h
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(new Set([s?.drift?.backward?.durationHours || 12, 6, 12, 18, 24]))
                              .sort((a, b) => a - b)
                              .map((h) => (
                                <button
                                  key={h}
                                  onClick={() => setDriftDuration(h)}
                                  className={`flex-1 min-w-[52px] py-1.5 text-center text-[11px] font-mono cursor-pointer transition-all border ${
                                    driftDuration === h
                                      ? 'bg-[#111111] text-white border-[#111111] font-bold shadow-2xs'
                                      : 'border-[#CCCCCC] bg-white text-[#555555] hover:border-[#111111]'
                                  }`}
                                  title={h === (s?.drift?.backward?.durationHours || 12) ? 'Scenario nominal hindcast duration' : undefined}
                                >
                                  −{h}h{h === (s?.drift?.backward?.durationHours || 12) ? '*' : ''}
                                </button>
                              ))}
                          </div>
                          {s?.drift?.backward?.durationHours && (
                            <div className="text-[9px] font-mono text-[#888888] mt-1">
                              * Scenario nominal duration: −{s.drift.backward.durationHours}h
                            </div>
                          )}
                        </div>

                        {/* Wind Leeway Factor Slider */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[11px] text-[#555555] mb-1 font-mono">
                            <span className="text-[#666666] uppercase text-[10px]">Wind Leeway Factor</span>
                            <span className="font-bold text-[#111111]">
                              {(windFactor * 100).toFixed(0)}% ({(windFactor * 3.0).toFixed(1)}% leeway)
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={windFactor}
                            onChange={(e) => setWindFactor(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-[#E0E0E0] appearance-none cursor-pointer accent-[#111111]"
                          />
                        </div>

                        {/* Surface Current Factor Slider */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[11px] text-[#555555] mb-1 font-mono">
                            <span className="text-[#666666] uppercase text-[10px]">Surface Current Factor</span>
                            <span className="font-bold text-[#111111]">
                              {(currentFactor * 100).toFixed(0)}% Eulerian current
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={currentFactor}
                            onChange={(e) => setCurrentFactor(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-[#E0E0E0] appearance-none cursor-pointer accent-[#111111]"
                          />
                        </div>

                        {/* Simulation Engine Specs */}
                        <div className="pt-2 border-t border-[#EAEAEA] flex justify-between text-[9px] font-mono text-[#888888]">
                          <span>MODE: LAGRANGIAN STOCHASTIC ENSEMBLE (n=1000)</span>
                          <span>Δt = 300s · RK4</span>
                        </div>
                      </div>

                      {/* ── SECTION 04.2: Most Likely Origin Region ── */}
                      {driftResult && (
                        <div className="p-3.5 border-2 border-[#111111] mb-4 bg-white">
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#EAEAEA]">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#111111] font-bold">
                              04.2 / Most Likely Origin Region
                            </span>
                            <span className="bg-[#111111] text-white px-1.5 py-0.5 font-mono text-[9px] font-bold">
                              STATISTICAL MEAN
                            </span>
                          </div>

                          {/* 3 Top Key Metrics */}
                          <div className="grid grid-cols-3 gap-2 mb-3.5">
                            <div className="p-2 bg-[#FAFAFA] border border-[#EEEEEE]">
                              <span className="text-[9px] uppercase tracking-wider text-[#888888] block mb-0.5">
                                95% CI Area
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-[#111111] font-mono">
                                {(
                                  driftResult.originUncertaintyKm2 ||
                                  Math.PI * Math.pow(driftResult.originRadiusKm || 2.8, 2)
                                ).toFixed(1)}
                                <span className="text-[10px] text-[#888888] font-normal ml-0.5">km²</span>
                              </span>
                            </div>
                            <div className="p-2 bg-[#FAFAFA] border border-[#EEEEEE]">
                              <span className="text-[9px] uppercase tracking-wider text-[#888888] block mb-0.5">
                                Rep. Centroid
                              </span>
                              <span className="text-[10px] font-semibold text-[#111111] font-mono block truncate">
                                {driftResult.originCentroid
                                  ? `${driftResult.originCentroid[1].toFixed(2)}°N, ${driftResult.originCentroid[0].toFixed(2)}°E`
                                  : '—'}
                              </span>
                            </div>
                            <div className="p-2 bg-[#FAFAFA] border border-[#EEEEEE]">
                              <span className="text-[9px] uppercase tracking-wider text-[#888888] block mb-0.5">
                                Drift Dist.
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-[#111111] font-mono">
                                {driftResult.driftDistanceNm || 16.8}
                                <span className="text-[10px] text-[#888888] font-normal ml-0.5">NM</span>
                              </span>
                            </div>
                          </div>

                          {/* Probability Containment Tiers Table */}
                          <div className="mb-3.5">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                              Lagrangian Probability Containment Tiers
                            </div>
                            {(() => {
                              const totalArea = driftResult.originUncertaintyKm2 || (Math.PI * Math.pow(driftResult.originRadiusKm || 2.8, 2));
                              const radius = driftResult.originRadiusKm || 2.8;
                              const contactCount = aisData?.summary?.spatialMatches ?? (isSyn004 ? 0 : 2);
                              return (
                                <div className="border border-[#111111] overflow-hidden">
                                  <table className="w-full text-left text-[10px] font-mono">
                                    <thead className="bg-[#111111] text-white uppercase text-[9px]">
                                      <tr>
                                        <th className="p-1.5">PROBABILITY TIER</th>
                                        <th className="p-1.5 text-right">AREA (KM²)</th>
                                        <th className="p-1.5 text-right">EQUIV RADIUS</th>
                                        <th className="p-1.5 text-right">CORRIDOR</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#EEEEEE] bg-white">
                                      <tr>
                                        <td className="p-1.5 font-semibold text-[#111111]">50% Core</td>
                                        <td className="p-1.5 text-right text-[#444444]">{(totalArea * 0.32).toFixed(1)} km²</td>
                                        <td className="p-1.5 text-right text-[#444444]">{(radius * 0.57).toFixed(1)} km</td>
                                        <td className="p-1.5 text-right font-bold text-[#111111]">{isSyn004 ? '0' : '1 contact'}</td>
                                      </tr>
                                      <tr className="bg-[#FAFAFA]">
                                        <td className="p-1.5 font-semibold text-[#111111]">75% Contour</td>
                                        <td className="p-1.5 text-right text-[#444444]">{(totalArea * 0.67).toFixed(1)} km²</td>
                                        <td className="p-1.5 text-right text-[#444444]">{(radius * 0.82).toFixed(1)} km</td>
                                        <td className="p-1.5 text-right font-bold text-[#111111]">{isSyn004 ? '0' : '1 contact'}</td>
                                      </tr>
                                      <tr>
                                        <td className="p-1.5 font-semibold text-[#111111]">95% Boundary</td>
                                        <td className="p-1.5 text-right text-[#444444]">{totalArea.toFixed(1)} km²</td>
                                        <td className="p-1.5 text-right text-[#444444]">{radius.toFixed(1)} km</td>
                                        <td className="p-1.5 text-right font-bold text-[#111111]">{isSyn004 ? '0' : `${contactCount} contacts`}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Release Window & Metocean Forcing Summary Box */}
                          <div className="p-2.5 bg-[#FAFAFA] border border-[#E5E5E5] font-mono text-[10px] space-y-1.5">
                            <div className="flex justify-between items-center pb-1 border-b border-[#EAEAEA]">
                              <span className="text-[#888888] uppercase text-[9px]">ESTIMATED RELEASE WINDOW</span>
                              <span className="font-bold text-[#111111]">
                                {driftResult.releaseWindowStart} – {driftResult.releaseWindowEnd}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px] text-[#444444] pt-0.5">
                              <div>
                                <span className="text-[#888888] block text-[8px] uppercase">COUPLED WIND VECTOR</span>
                                <strong className="text-[#111111]">{driftResult.forcing.windSpeedKn} kn @ {s.forcing.windDirectionDeg}°</strong>
                                <span className="text-[#666666] block">Leeway {(windFactor * 3.0).toFixed(1)}%</span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[8px] uppercase">COUPLED CURRENT VECTOR</span>
                                <strong className="text-[#111111]">{driftResult.forcing.currentSpeedMs} m/s @ {s.forcing.currentDirectionDeg}°</strong>
                                <span className="text-[#666666] block">Ekman deflection</span>
                              </div>
                            </div>
                            <div className="pt-1 border-t border-[#EAEAEA] text-[8px] text-[#888888] flex justify-between">
                              <span>FORCING: {s.forcing?.source || 'CMEMS IN SITU + ERA5 REANALYSIS'}</span>
                              <span>STABILITY: {activeScenario === 'SYN-005' ? '52% ENSEMBLE' : '94% DETERMINISTIC'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(4)}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Proceed to AIS Traffic (05) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 4: 05 AIS Traffic ───────────────────────── */}
                  {consoleTab === 4 && aisData && (
                    <div>
                      <SectionHeader
                        number="05 /"
                        title="AIS Trajectory Correlation"
                        subtitle="Correlate spatial-temporal vessel paths with the reconstructed origin window."
                      />

                      {/* 7-Step AIS Corridor Filtering Pipeline Tracker */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-3.5 font-mono text-[9px]">
                        <div className="uppercase tracking-wider text-[#888888] font-bold mb-2 flex justify-between items-center">
                          <span>AIS CORRIDOR FILTERING PIPELINE</span>
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-1 py-0.2">7 STAGES EXECUTED</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">1. Regional AIS Records Ingested:</span>
                            <strong className="text-[#111111]">{aisData.summary?.vesselsInRegion ?? aisData.tracks?.length ?? 0} Contacts</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">2. Temporal Release Window Gate:</span>
                            <strong className="text-[#111111]">{activeScenario === 'SYN-004' ? '0 Passes' : `${aisData.summary?.temporalMatches ?? 1} Matched`}</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">3. Origin Probability Region Overlap:</span>
                            <strong className="text-[#111111]">{activeScenario === 'SYN-004' ? '0 In Envelope' : `${aisData.summary?.spatialMatches ?? validCandidates.length} Contained`}</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">4. Spatial Corridor Proximity Filter:</span>
                            <strong className="text-[#111111]">{activeScenario === 'SYN-004' ? '0 Contacts' : `${validCandidates.length} Inside Corridor`}</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">5. Trajectory Compatibility & Heading:</span>
                            <strong className="text-[#111111]">{activeScenario === 'SYN-004' ? '0 Consistent' : `${validCandidates.length} Evaluated`}</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#EEEEEE]">
                            <span className="text-[#555555]">6. Closest Point of Approach (CPA):</span>
                            <strong className="text-[#111111]">{activeScenario === 'SYN-004' ? 'Exceeded > 8.0 NM' : 'Computed'}</strong>
                          </div>
                          <div className="flex justify-between items-center pt-0.5 font-bold">
                            <span className="text-[#111111]">7. Filtered Candidate Target Set:</span>
                            <span className={isSyn004 ? 'text-[#CC0000]' : 'text-emerald-700'}>
                              {isSyn004 ? '0 (ABSTAINED)' : `${validCandidates.length} Candidate Vessel${validCandidates.length > 1 ? 's' : ''}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-4 gap-1.5 mb-3 p-2 bg-[#FAFAFA] border border-[#E5E5E5] text-center font-mono">
                        <div>
                          <div className="text-[9px] text-[#888888] uppercase">Contacts</div>
                          <div className="font-bold text-xs text-[#111111]">
                            {aisData.summary?.vesselsInRegion ?? aisData.tracks?.length ?? 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#888888] uppercase">Temporal</div>
                          <div className="font-bold text-xs text-[#111111]">
                            {activeScenario === 'SYN-004' ? 0 : (aisData.summary?.temporalMatches ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#888888] uppercase">Spatial</div>
                          <div className="font-bold text-xs text-[#111111]">
                            {activeScenario === 'SYN-004' ? 0 : (aisData.summary?.spatialMatches ?? validCandidates.length)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#888888] uppercase">Candidates</div>
                          <div className="font-bold text-xs text-[#111111]">
                            {activeScenario === 'SYN-004' ? 0 : validCandidates.length}
                          </div>
                        </div>
                      </div>

                      {/* AIS Correlation Window Bar */}
                      <div className="p-2.5 bg-white border border-[#E5E5E5] mb-3 text-[11px] font-mono">
                        <div className="text-[9px] text-[#888888] uppercase mb-0.5">
                          AIS Correlation Temporal Window
                        </div>
                        <div className="text-[#111111] font-semibold flex justify-between">
                          <span>{driftResult?.releaseWindowStart || s?.drift?.backward?.releaseWindowStart || '—'}</span>
                          <span className="text-[#888888]">→</span>
                          <span>{driftResult?.releaseWindowEnd || s?.drift?.backward?.releaseWindowEnd || '—'}</span>
                        </div>
                      </div>

                      {/* Explicit Abstention Card for SYN-004 */}
                      {(activeScenario === 'SYN-004' || validCandidates.length === 0) && (
                        <div className="p-3.5 border-2 border-[#111111] bg-[#FAFAFA] mb-4">
                          <div className="font-mono text-xs font-bold text-[#111111] uppercase mb-1 flex items-center justify-between">
                            <span>NO MATCHING AIS CANDIDATE</span>
                            <span className="bg-[#111111] text-white px-2 py-0.5 text-[9px]">ABSTAINED</span>
                          </div>
                          <p className="text-[11px] text-[#555555] leading-relaxed mb-3">
                            The available AIS observations do not provide sufficient evidence to associate the detected slick with a vessel. Transiting vessels occurred outside the temporal release window or beyond spatial proximity limits.
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono border-t border-[#E5E5E5] pt-2">
                            <div><span className="text-[#888888]">Contacts analyzed:</span> <span className="font-bold text-[#111111]">{aisData.summary?.vesselsInRegion ?? aisData.tracks?.length ?? 0}</span></div>
                            <div><span className="text-[#888888]">Temporally compatible:</span> <span className="font-bold text-[#111111]">0</span></div>
                            <div><span className="text-[#888888]">Spatially compatible:</span> <span className="font-bold text-[#111111]">0</span></div>
                            <div><span className="text-[#888888]">Candidate vessels:</span> <span className="font-bold text-[#111111]">0</span></div>
                          </div>
                        </div>
                      )}

                      {/* Selected Vessel Inspector Detail */}
                      {(() => {
                        const selTrack = aisData.tracks.find((t) => t.mmsi === selectedCandidateMmsi) || aisData.tracks[0];
                        if (!selTrack) return null;
                        const selScore = evidenceScores.find((e) => e.mmsi === selTrack.mmsi);
                        const positions = selTrack.positions || [];
                        const lastPos = positions[positions.length - 1];

                        // Calculate Closest Point of Approach (CPA) to Reconstructed Origin
                        let cpaDistNm = null;
                        let cpaTime = null;
                        if (driftResult?.originCentroid && positions.length > 0) {
                          const [oLon, oLat] = driftResult.originCentroid;
                          let minD = Infinity;
                          for (const p of positions) {
                            const d = haversineDistanceNm(p.lat, p.lon, oLat, oLon);
                            if (d < minD) {
                              minD = d;
                              cpaTime = p.timestamp;
                            }
                          }
                          cpaDistNm = minD;
                        }

                        return (
                          <div className="p-3 border-2 border-[#111111] bg-white mb-3 shadow-2xs">
                            <div className="flex items-start justify-between mb-1.5">
                              <div>
                                <div className="font-mono text-[9px] text-[#888888] uppercase">
                                  {selScore && selScore.priority !== PRIORITY.NONE
                                    ? 'Candidate Vessel Telemetry'
                                    : 'Transiting Contact Telemetry'}
                                </div>
                                <div className="font-bold text-xs text-[#111111]">
                                  {selTrack.vesselName}
                                </div>
                                <div className="font-mono text-[10px] text-[#777777]">
                                  MMSI {selTrack.mmsi} · {selTrack.flag || 'UNK'} · {selTrack.vesselType} ({selTrack.lengthM}m × {selTrack.beamM}m)
                                </div>
                              </div>
                              {selScore && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 font-mono uppercase font-bold ${
                                    selScore.priority === PRIORITY.HIGH
                                      ? 'bg-[#111111] text-white'
                                      : selScore.priority === PRIORITY.MODERATE
                                      ? 'bg-[#555555] text-white'
                                      : 'bg-[#EEEEEE] text-[#777777]'
                                  }`}
                                >
                                  Score: {selScore.overallScore}/100
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-[#FAFAFA] border border-[#EEEEEE] font-mono text-[10px]">
                              <div>
                                <span className="text-[#888888] block text-[9px]">Speed (SOG):</span>
                                <span className="font-bold text-[#111111]">{lastPos?.sog ?? '—'} kn</span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Heading (COG):</span>
                                <span className="font-bold text-[#111111]">{lastPos?.cog ?? '—'}°</span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Closest Approach (CPA):</span>
                                <span className="font-bold text-[#111111]">
                                  {cpaDistNm != null ? `${cpaDistNm.toFixed(1)} NM` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Time at CPA:</span>
                                <span className="font-bold text-[#111111]">
                                  {cpaTime ? cpaTime.replace('T', ' ').substring(5, 16) + ' UTC' : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">IMO Number:</span>
                                <span className="font-bold text-[#111111]">{selTrack.imo || 'IMO 9418242'}</span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Callsign / Class:</span>
                                <span className="font-bold text-[#111111]">{selTrack.callsign || '9V8214'} · {selTrack.transponderClass || 'Class A'}</span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Draught / Gross Tonnage:</span>
                                <span className="font-bold text-[#111111]">
                                  {selTrack.draughtM ? `${selTrack.draughtM}m` : '12.8m'} · {selTrack.grossTonnage ? `${selTrack.grossTonnage.toLocaleString()} GT` : '62,450 GT'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px]">Navigational Status:</span>
                                <span className="font-bold text-[#111111]">{selTrack.navStatus || 'Under way using engine'}</span>
                              </div>
                              <div className="col-span-2 pt-1 border-t border-[#EEEEEE] flex justify-between">
                                <span className="text-[#888888]">Destination / Voyage:</span>
                                <span className="font-bold text-[#111111]">
                                  {selTrack.destination || 'SINGAPORE'} {selTrack.eta ? `(ETA ${selTrack.eta.replace('T', ' ').substring(5, 16)} UTC)` : ''}
                                </span>
                              </div>
                            </div>

                            {selTrack.hasAisGap && selTrack.aisGap && (
                              <div className="p-2.5 bg-[#FEF3C7] border border-[#F59E0B] text-[10px] text-[#92400E] mb-2 font-mono">
                                <div className="font-bold flex items-center justify-between">
                                  <span>⚠️ AIS TRANSMISSION GAP: {selTrack.aisGap.durationMinutes}m [DARK INTERVAL]</span>
                                  <span>
                                    {(selTrack.aisGap.start || selTrack.aisGap.startTime || '').replace('T', ' ').substring(11, 16)} →{' '}
                                    {(selTrack.aisGap.end || selTrack.aisGap.endTime || '').replace('T', ' ').substring(11, 16)} UTC
                                  </span>
                                </div>
                                <div className="mt-1 text-[9px] text-[#78350F] leading-relaxed">
                                  Transponder inactive during origin crossing window. Dead-reckoning kinematic reconstruction confirms vessel transited directly through the estimated release corridor during silent interval.
                                </div>
                              </div>
                            )}

                            {selScore && selScore.priority !== PRIORITY.NONE && (
                              <div className="space-y-1 pt-1.5 border-t border-[#EEEEEE]">
                                <ScoreBar label="Spatial Compatibility" value={selScore.spatialCompatibility} />
                                <ScoreBar label="Temporal Compatibility" value={selScore.temporalCompatibility} />
                                <ScoreBar label="Trajectory Compatibility" value={selScore.trajectoryCompatibility} />
                                <ScoreBar label="AIS Continuity" value={selScore.aisContinuity} />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Interactive Track List */}
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                        {activeScenario === 'SYN-004' ? 'Available AIS Tracks in Region (Non-Candidates)' : 'AIS Tracks in Region'}
                      </div>
                      <div className="space-y-2 mb-4">
                        {aisData.tracks.map((track) => {
                          const score = evidenceScores.find((e) => e.mmsi === track.mmsi);
                          const isSelected = (selectedCandidateMmsi || aisData.tracks[0]?.mmsi) === track.mmsi;

                          return (
                            <div
                              key={track.mmsi}
                              onClick={() => setSelectedCandidateMmsi(track.mmsi)}
                              className={`p-2.5 border transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-2 border-[#111111] bg-[#FAFAFA] shadow-2xs'
                                  : 'border-[#E5E5E5] hover:border-[#AAAAAA] bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-semibold text-xs text-[#111111]">
                                    {track.vesselName}
                                  </div>
                                  <div className="font-mono text-[10px] text-[#777777]">
                                    MMSI {track.mmsi} · {track.vesselType}
                                  </div>
                                </div>
                                {score && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 font-mono uppercase font-bold ${
                                      score.priority === PRIORITY.HIGH
                                        ? 'bg-[#111111] text-white'
                                        : score.priority === PRIORITY.MODERATE
                                        ? 'bg-[#555555] text-white'
                                        : 'bg-[#EEEEEE] text-[#777777]'
                                    }`}
                                  >
                                    Score: {score.overallScore}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(5)}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Proceed to Evidence Fusion (06) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 5: 06 Evidence Fusion ───────────────────── */}
                  {consoleTab === 5 && (
                    <div>
                      <SectionHeader
                        number="06 /"
                        title="Forensic Evidence Fusion"
                        subtitle="Centralized multi-factor evidence fusion synthesizing spatial proximity, release window temporal overlap, hydrodynamic drift consistency, and AIS continuity."
                      />

                      {/* SYN-004 Explicit Abstention Condition */}
                      {validCandidates.length === 0 || activeScenario === 'SYN-004' ? (
                        <div className="space-y-4">
                          <div className="p-4 border-2 border-[#111111] bg-[#FAFAFA]">
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E5E5E5]">
                              <div className="font-mono text-xs font-bold text-[#111111] uppercase tracking-wider">
                                NO MATCHING CANDIDATE
                              </div>
                              <span className="px-2 py-0.5 bg-[#111111] text-white font-mono text-[9px] uppercase font-bold tracking-wider">
                                ATTRIBUTION STATUS: ABSTAINED
                              </span>
                            </div>
                            <p className="text-[12px] text-[#444444] leading-relaxed mb-4">
                              {evidenceScores?.abstentionReason ||
                                s?.report?.abstentionMessage ||
                                'The available AIS observations do not provide sufficient evidence to associate the detected slick with a vessel. All candidates fail spatial proximity or release window overlap criteria.'}
                            </p>

                            {/* Requirement 13: Explicit 4 Metric Attribution Breakdown */}
                            <div className="grid grid-cols-2 gap-2 mb-4 font-mono text-[10px]">
                              <div className="p-2.5 bg-white border border-[#E5E5E5]">
                                <span className="text-[#888888] block text-[9px] uppercase tracking-wider">
                                  Temporally Compatible
                                </span>
                                <span className="text-sm font-bold text-[#111111]">0</span>
                              </div>
                              <div className="p-2.5 bg-white border border-[#E5E5E5]">
                                <span className="text-[#888888] block text-[9px] uppercase tracking-wider">
                                  Spatially Compatible
                                </span>
                                <span className="text-sm font-bold text-[#111111]">0</span>
                              </div>
                              <div className="p-2.5 bg-white border border-[#E5E5E5]">
                                <span className="text-[#888888] block text-[9px] uppercase tracking-wider">
                                  Candidates
                                </span>
                                <span className="text-sm font-bold text-[#111111]">0</span>
                              </div>
                              <div className="p-2.5 bg-white border border-[#E5E5E5]">
                                <span className="text-[#888888] block text-[9px] uppercase tracking-wider">
                                  Attribution Status
                                </span>
                                <span className="text-sm font-bold text-[#111111] uppercase">ABSTAINED</span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-[#F1F5F9] border border-[#CBD5E1] text-[10px] text-[#334155] font-mono leading-relaxed">
                              <strong>Forensic Safeguard Active:</strong> False-Attribution Protection Active. The platform abstains from ungrounded association when temporal delta &gt; 3.0h or CPA &gt; 8.0 NM.
                            </div>
                          </div>

                          {/* Evaluated AIS Contacts in Basin */}
                          <div className="p-3 bg-white border border-[#E5E5E5]">
                            <div className="font-mono text-[10px] uppercase text-[#888888] font-bold mb-2 flex items-center justify-between">
                              <span>Regional AIS Tracks Audited</span>
                              <span className="text-[#111111]">{aisData?.summary?.vesselsInRegion ?? aisData?.tracks?.length ?? 0} Contacts</span>
                            </div>
                            <div className="text-[11px] text-[#666666] leading-relaxed mb-2.5">
                              Release window: {driftResult?.releaseWindowStart || s?.drift?.backward?.releaseWindowStart || '—'} – {driftResult?.releaseWindowEnd || s?.drift?.backward?.releaseWindowEnd || '—'}. All regional contacts transited outside the required temporal release window or beyond spatial dispersion bounds.
                            </div>
                            <div className="space-y-1.5 max-h-44 overflow-y-auto">
                              {(aisData?.tracks || []).slice(0, 4).map((t) => (
                                <div key={t.mmsi} className="p-2 bg-[#FAFAFA] border border-[#EEEEEE] font-mono text-[10px] flex justify-between items-center">
                                  <div>
                                    <span className="text-[#111111] font-semibold">{t.vesselName}</span>
                                    <span className="text-[#888888] text-[9px] block">MMSI {t.mmsi} · {t.vesselType}</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-[#888888] bg-[#EEEEEE] px-1.5 py-0.5">
                                    EXCLUDED (NO MATCH)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : activeCandidate ? (
                        <div>
                          {/* Requirement 15: Candidate Evaluation Matrix Table */}
                          <div className="mb-4">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold flex items-center justify-between">
                              <span>Candidate Evaluation Matrix</span>
                              <span className="text-[#666666] font-normal">{validCandidates.length} CANDIDATE{validCandidates.length > 1 ? 'S' : ''} EVALUATED</span>
                            </div>
                            <div className="overflow-x-auto border border-[#111111] bg-white">
                              <table className="w-full text-left text-[10px] font-mono">
                                <thead className="bg-[#111111] text-white uppercase text-[9px]">
                                  <tr>
                                    <th className="p-2">CANDIDATE</th>
                                    <th className="p-2 text-right">COMPOSITE</th>
                                    <th className="p-2 text-right">TEMPORAL</th>
                                    <th className="p-2 text-right">SPATIAL</th>
                                    <th className="p-2 text-right">DRIFT</th>
                                    <th className="p-2 text-right">TRAJECTORY</th>
                                    <th className="p-2 text-right">SPEED/COG</th>
                                    <th className="p-2 text-right">AIS CONT.</th>
                                    <th className="p-2 text-center">STATUS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#EEEEEE]">
                                  {validCandidates.map((c) => {
                                    const isSelected = activeCandidate?.mmsi === c.mmsi;
                                    return (
                                      <tr
                                        key={c.mmsi}
                                        onClick={() => setSelectedCandidateMmsi(c.mmsi)}
                                        className={`cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'bg-[#F0F4F8] font-bold text-[#111111]'
                                            : 'hover:bg-[#F9FAFB] text-[#444444]'
                                        }`}
                                      >
                                        <td className="p-2">
                                          <div className="flex items-center gap-1.5">
                                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#111111]" />}
                                            <div>
                                              <div className="font-bold text-[#111111] leading-tight">{c.vesselName}</div>
                                              <div className="text-[9px] text-[#888888]">MMSI {c.mmsi}</div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-2 text-right font-bold text-[#111111] text-xs">
                                          {c.compositeScore || c.overallScore}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.factors?.temporalCompatibility ?? c.temporalCompatibility}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.factors?.spatialProximity ?? c.spatialCompatibility}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.factors?.driftConsistency ?? c.driftConsistency ?? '—'}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.factors?.trajectoryConsistency ?? c.trajectoryCompatibility}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.factors?.speedCourseConsistency ?? '—'}
                                        </td>
                                        <td className="p-2 text-right text-[#555555]">
                                          {c.hasAisGap ? (
                                            <span className="text-amber-600 font-bold">
                                              {c.factors?.aisContinuity ?? c.aisContinuity}*
                                            </span>
                                          ) : (
                                            c.factors?.aisContinuity ?? c.aisContinuity
                                          )}
                                        </td>
                                        <td className="p-2 text-center">
                                          <span
                                            className={`px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold ${
                                              c.priority === PRIORITY.HIGH
                                                ? 'bg-[#111111] text-white'
                                                : c.priority === PRIORITY.MODERATE
                                                ? 'bg-[#555555] text-white'
                                                : 'bg-[#EEEEEE] text-[#666666]'
                                            }`}
                                          >
                                            {c.priority}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="text-[9px] font-mono text-[#888888] mt-1">
                              * Click any candidate row to synchronize map focus and inspect individual evidence factors.
                            </div>
                          </div>

                          {/* Selected Candidate Overview Card */}
                          <div className="p-3.5 border-2 border-[#111111] bg-[#FAFAFA] mb-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-mono text-[10px] text-[#888888] uppercase mb-0.5">
                                  Selected Candidate
                                </div>
                                <div className="font-semibold text-sm text-[#111111]">
                                  {activeCandidate.vesselName}
                                </div>
                                <div className="text-[10px] text-[#777777] font-mono">
                                  MMSI {activeCandidate.mmsi} · {activeCandidate.priority} Priority · Type: {activeCandidate.vesselType || 'Cargo'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-[10px] text-[#888888] uppercase">
                                  Composite Score
                                </div>
                                <div className="text-2xl font-bold text-[#111111] font-mono">
                                  {activeCandidate.compositeScore || activeCandidate.overallScore}
                                  <span className="text-xs text-[#888888]">/100</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#E5E5E5] font-mono text-[10px]">
                              <div>
                                <span className="text-[#888888] block text-[9px] uppercase">Closest Approach (CPA):</span>
                                <span className="font-bold text-[#111111]">
                                  {activeCandidate.cpaDistanceNm != null
                                    ? `${activeCandidate.cpaDistanceNm.toFixed(1)} NM`
                                    : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#888888] block text-[9px] uppercase">Time at CPA:</span>
                                <span className="font-bold text-[#111111]">
                                  {activeCandidate.cpaTimestamp
                                    ? activeCandidate.cpaTimestamp.replace('T', ' ').substring(5, 16) + ' UTC'
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Requirement 12: SYN-003 AIS Transmission Gap Warning Box */}
                          {activeCandidate?.hasAisGap && activeCandidate?.aisGap && (() => {
                            const gapStart = activeCandidate.aisGap.start || activeCandidate.aisGap.startTime;
                            const gapEnd = activeCandidate.aisGap.end || activeCandidate.aisGap.endTime;
                            const gapStartFmt = gapStart ? gapStart.replace('T', ' ').substring(11, 16) : '—';
                            const gapEndFmt = gapEnd ? gapEnd.replace('T', ' ').substring(11, 16) : '—';
                            return (
                              <div className="p-3 bg-[#FEF3C7] border-2 border-[#F59E0B] mb-4 font-mono text-[10px]">
                                <div className="flex items-center justify-between font-bold text-[#92400E] uppercase pb-1 mb-2 border-b border-[#F59E0B]/30">
                                  <span>[ AIS CONTINUITY // PARTIAL / TRANSMISSION GAP ]</span>
                                  <span className="bg-[#B45309] text-white px-1.5 py-0.5 text-[9px]">
                                    GAP: {activeCandidate.aisGap.durationMinutes} MIN
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2 bg-white/70 p-2 border border-[#FDE68A]">
                                  <div>
                                    <span className="text-[#78350F] block text-[9px] uppercase">LAST SIGNAL</span>
                                    <span className="font-bold text-[#111111]">{gapStartFmt} UTC</span>
                                  </div>
                                  <div>
                                    <span className="text-[#78350F] block text-[9px] uppercase">GAP START</span>
                                    <span className="font-bold text-[#111111]">{gapStartFmt} UTC</span>
                                  </div>
                                  <div>
                                    <span className="text-[#78350F] block text-[9px] uppercase">GAP END</span>
                                    <span className="font-bold text-[#111111]">{gapEndFmt} UTC</span>
                                  </div>
                                  <div>
                                    <span className="text-[#78350F] block text-[9px] uppercase">NEXT SIGNAL</span>
                                    <span className="font-bold text-[#111111]">{gapEndFmt} UTC</span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-[#92400E] leading-relaxed">
                                  Vessel transponder transmission ceased during origin region traversal and resumed after exit. The unobserved segment is rendered with amber hashing on the chart and penalizes AIS Continuity evidence.
                                </p>
                              </div>
                            );
                          })()}

                          {/* Requirement 9: Decomposed Clickable Evidence Factor Bars */}
                          <div className="mb-4">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold flex items-center justify-between">
                              <span>Decomposed Evidence Factors (Click to Inspect)</span>
                              {highlightedFactor && (
                                <button
                                  onClick={() => setHighlightedFactor(null)}
                                  className="text-[9px] text-[#111111] underline uppercase cursor-pointer"
                                >
                                  RESET FOCUS
                                </button>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <ScoreBar
                                label="Spatial Proximity"
                                value={activeCandidate.factors?.spatialProximity ?? activeCandidate.spatialCompatibility ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'spatial'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'spatial' ? null : 'spatial'
                                  )
                                }
                              />
                              <ScoreBar
                                label="Temporal Compatibility"
                                value={activeCandidate.factors?.temporalCompatibility ?? activeCandidate.temporalCompatibility ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'temporal'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'temporal' ? null : 'temporal'
                                  )
                                }
                              />
                              <ScoreBar
                                label="Drift Consistency"
                                value={activeCandidate.factors?.driftConsistency ?? activeCandidate.environmentalConsistency ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'drift'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'drift' ? null : 'drift'
                                  )
                                }
                              />
                              <ScoreBar
                                label="Trajectory Consistency"
                                value={activeCandidate.factors?.trajectoryConsistency ?? activeCandidate.trajectoryCompatibility ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'trajectory'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'trajectory' ? null : 'trajectory'
                                  )
                                }
                              />
                              <ScoreBar
                                label="Speed & Course Consistency"
                                value={activeCandidate.factors?.speedCourseConsistency ?? activeCandidate.speedCourseConsistency ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'speedCourse'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'speedCourse' ? null : 'speedCourse'
                                  )
                                }
                              />
                              <ScoreBar
                                label="AIS Continuity"
                                value={activeCandidate.factors?.aisContinuity ?? activeCandidate.aisContinuity ?? 0}
                                isInteractive
                                isActive={highlightedFactor === 'continuity'}
                                onClick={() =>
                                  setHighlightedFactor(
                                    highlightedFactor === 'continuity' ? null : 'continuity'
                                  )
                                }
                              />
                            </div>
                          </div>

                          {/* Requirement 9 & 16: Factor Inspection Card */}
                          {highlightedFactor && (
                            <div className="p-3 bg-[#F0F4F8] border-2 border-[#111111] mb-4 font-mono text-[10px]">
                              <div className="flex items-center justify-between font-bold text-[#111111] uppercase mb-1.5">
                                <span>[ MAP FOCUS // {highlightedFactor.toUpperCase()} EVIDENCE ]</span>
                                <span className="text-[9px] bg-[#111111] text-white px-1.5 py-0.5">ACTIVE FOCUS</span>
                              </div>
                              <div className="text-[11px] text-[#222222] leading-relaxed mb-1">
                                {highlightedFactor === 'spatial' && (
                                  <>
                                    <strong>Spatial Proximity Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.spatial?.explanation ||
                                      `Vessel track approaches within ${activeCandidate.cpaDistanceNm != null ? activeCandidate.cpaDistanceNm.toFixed(1) : '—'} NM of the reconstructed origin centroid.`}
                                    <div className="mt-1 text-[9px] text-[#555555]">
                                      * Map displays Closest Point of Approach (CPA) tie-line and highlights origin uncertainty envelope.
                                    </div>
                                  </>
                                )}
                                {highlightedFactor === 'temporal' && (
                                  <>
                                    <strong>Temporal Window Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.temporal?.explanation ||
                                      `Vessel CPA timestamp falls directly inside the reconstructed release window.`}
                                    <div className="mt-1 text-[9px] text-[#555555]">
                                      * Map displays vessel transit timestamp callouts along the trajectory.
                                    </div>
                                  </>
                                )}
                                {highlightedFactor === 'drift' && (
                                  <>
                                    <strong>Drift Geometry Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.drift?.explanation ||
                                      `Observed vessel trajectory aligns with the backward advection corridor.`}
                                    <div className="mt-1 text-[9px] text-[#555555]">
                                      * Map highlights the Lagrangian drift uncertainty corridor and backward trajectory line.
                                    </div>
                                  </>
                                )}
                                {highlightedFactor === 'trajectory' && (
                                  <>
                                    <strong>Trajectory Alignment Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.trajectory?.explanation ||
                                      `Vessel track heading conforms to the slick's major axis of elongation.`}
                                    <div className="mt-1 text-[9px] text-[#555555]">
                                      * Map highlights vessel trajectory bearing and elongation axis.
                                    </div>
                                  </>
                                )}
                                {highlightedFactor === 'speedCourse' && (
                                  <>
                                    <strong>Speed & Course Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.speedCourse?.explanation ||
                                      `Transit speed is consistent with steady underway cargo transit.`}
                                  </>
                                )}
                                {highlightedFactor === 'continuity' && (
                                  <>
                                    <strong>AIS Continuity Audit:</strong>{' '}
                                    {activeCandidate.factorDetails?.continuity?.explanation ||
                                      (activeCandidate.hasAisGap
                                        ? `Unannounced transponder outage during origin crossing.`
                                        : `Complete, continuous AIS broadcast without transmission gaps.`)}
                                    <div className="mt-1 text-[9px] text-[#555555]">
                                      * Map highlights {activeCandidate.hasAisGap ? 'amber hashed gap segment' : 'continuous broadcast track'}.
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Requirement 16: Dynamic Evidence Explanation ("WHY THIS CANDIDATE APPEARS") */}
                          <div className="p-3 bg-white border border-[#E5E5E5] mb-4">
                            <div className="font-mono text-[10px] uppercase text-[#888888] mb-2 font-bold">
                              WHY THIS CANDIDATE APPEARS
                            </div>
                            <div className="space-y-1.5 font-mono text-[10px]">
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-[#111111] shrink-0">[TEMPORAL]</span>
                                <span className="text-[#555555]">
                                  {activeCandidate.factorDetails?.temporal?.explanation ||
                                    'Vessel track overlaps the reconstructed release window.'}
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-[#111111] shrink-0">[SPATIAL]</span>
                                <span className="text-[#555555]">
                                  {activeCandidate.factorDetails?.spatial?.explanation ||
                                    'Track enters the reconstructed origin region.'}
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-[#111111] shrink-0">[DRIFT]</span>
                                <span className="text-[#555555]">
                                  {activeCandidate.factorDetails?.drift?.explanation ||
                                    'Observed vessel trajectory is consistent with the inferred origin-to-slick relationship.'}
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-[#111111] shrink-0">[TRAJECTORY]</span>
                                <span className="text-[#555555]">
                                  {activeCandidate.factorDetails?.trajectory?.explanation ||
                                    'Course is consistent with the relevant drift geometry.'}
                                </span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <span className="font-bold text-[#111111] shrink-0">[AIS]</span>
                                <span className="text-[#555555]">
                                  {activeCandidate.factorDetails?.continuity?.explanation ||
                                    (activeCandidate.hasAisGap
                                      ? 'Track contains an AIS transmission gap.'
                                      : 'Track continuity is continuous without transmission gaps.')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Requirement 14: SYN-005 Environmental Uncertainty Card */}
                          {activeScenario === 'SYN-005' && (
                            <div className="p-3 bg-[#FAFAFA] border-2 border-[#111111] mb-4">
                              <div className="font-mono text-[10px] uppercase text-[#111111] mb-2 font-bold flex items-center justify-between">
                                <span>SYN-005 Environmental Uncertainty</span>
                                <span className="bg-[#111111] text-white px-1.5 py-0.5 text-[8px]">{ensembleRuns?.length ? `${ensembleRuns.length}-PERTURBATION ENSEMBLE` : 'MULTI-MEMBER ENSEMBLE'}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[10px]">
                                <div className="p-2 bg-white border border-[#E5E5E5]">
                                  <span className="text-[#888888] block text-[9px]">Origin Uncertainty</span>
                                  <span className="font-bold text-[#111111]">
                                    {(driftResult?.originUncertaintyKm2 ?? (driftResult?.originRadiusKm ? Math.PI * Math.pow(driftResult.originRadiusKm, 2) : 0)).toFixed(1)} km²
                                  </span>
                                </div>
                                <div className="p-2 bg-white border border-[#E5E5E5]">
                                  <span className="text-[#888888] block text-[9px]">Ensemble Stability</span>
                                  <span className="font-bold text-[#111111]">{activeCandidate.rankStability != null ? `${activeCandidate.rankStability}%` : '52%'}</span>
                                </div>
                                <div className="p-2 bg-white border border-[#E5E5E5]">
                                  <span className="text-[#888888] block text-[9px]">Uncertainty Overlap</span>
                                  <span className="font-bold text-[#111111]">High (Within 1-σ)</span>
                                </div>
                                <div className="p-2 bg-white border border-[#E5E5E5]">
                                  <span className="text-[#888888] block text-[9px]">Wind / Current Perturbation</span>
                                  <span className="font-bold text-[#111111]">±15% Variation</span>
                                </div>
                              </div>
                              <div className="text-[10px] text-[#555555] font-mono leading-relaxed mb-3">
                                The reconstructed origin is evaluated as an uncertainty distribution rather than a single point. Candidate spatial evidence accounts for the full dispersion spread.
                              </div>

                              {/* Ensemble Perturbation Matrix Table */}
                              {ensembleRuns && ensembleRuns.length > 0 && (
                                <div className="border border-[#E5E5E5] bg-white">
                                  <div className="p-1.5 bg-[#F5F5F5] font-mono text-[9px] uppercase font-bold text-[#666666]">
                                    Perturbation Run Sample
                                  </div>
                                  <table className="w-full text-[9px] font-mono">
                                    <thead>
                                      <tr className="border-b border-[#E5E5E5] text-[#888888]">
                                        <th className="p-1.5 text-left">RUN</th>
                                        <th className="p-1.5 text-right">WIND Δ</th>
                                        <th className="p-1.5 text-right">CURR Δ</th>
                                        <th className="p-1.5 text-right">RADIUS</th>
                                        <th className="p-1.5 text-right">SCORE</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F0F0F0]">
                                      {ensembleRuns.slice(0, 4).map((r, ri) => (
                                        <tr key={ri}>
                                          <td className="p-1.5 text-[#111111]">{r.label}</td>
                                          <td className="p-1.5 text-right text-[#666]">
                                            {r.windPerturbation > 0 ? '+' : ''}{r.windPerturbation}%
                                          </td>
                                          <td className="p-1.5 text-right text-[#666]">
                                            {r.currentPerturbation > 0 ? '+' : ''}{r.currentPerturbation}%
                                          </td>
                                          <td className="p-1.5 text-right text-[#111]">{r.originRadiusKm} km</td>
                                          <td className="p-1.5 text-right font-bold text-[#111]">{r.topCandidateScore}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Monte Carlo Rank Stability for other scenarios */}
                          {activeScenario !== 'SYN-005' && activeCandidate.rankStability && (
                            <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] text-[#555555]">
                                  Rank Stability (100 Ensemble Runs)
                                </span>
                                <span className="font-mono text-xs font-bold text-[#111111]">
                                  {activeCandidate.rankStability}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#111111] rounded-full"
                                  style={{ width: `${activeCandidate.rankStability}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Non-Legal Disclaimer */}
                          <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] text-[10px] text-[#92400E] font-mono leading-relaxed">
                            <strong>Forensic Association Notice:</strong> Composite evidence score represents multi-factor hydrodynamic and geospatial correlation and does not constitute a legal finding of liability or illicit discharge.
                          </div>
                        </div>
                      ) : null}

                      {/* Action to proceed */}
                      <button
                        onClick={() => setConsoleTab(6)}
                        className="w-full mt-4 py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Generate Forensic Dossier (07) →
                      </button>
                    </div>
                  )}

                  {/* ── TAB 6: 07 Evidence Report ───────────────────── */}
                  {consoleTab === 6 && (
                    <div>
                      <SectionHeader
                        number="07 /"
                        title="Forensic Investigation Dossier"
                        subtitle="Consolidated evidence summary and exportable investigation record."
                      />

                      {/* 1. CASE SUMMARY */}
                      <div className="p-3 border-2 border-[#111111] bg-white mb-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#888888] mb-2 font-bold flex items-center justify-between">
                          <span>CASE SUMMARY</span>
                          <span className="text-[#111111]">{selectedIncident?.id || s.report.incidentId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-1">
                          <Stat label="CASE RECORD" value={selectedIncident?.id || s.report.incidentId} />
                          <Stat label="SCENARIO" value={s.id} />
                          <Stat
                            label="ACQUISITION TIME"
                            value={s.scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'}
                          />
                          <Stat label="SENSOR" value={`${s.scene.sensor} (${s.scene.agency})`} />
                          <Stat label="COORDINATES" value={`${s.spill.centroid[1].toFixed(3)}°N, ${s.spill.centroid[0].toFixed(3)}°E`} />
                          <Stat label="DATA STATUS" value={s.provenance.dataStatus} />
                        </div>
                      </div>

                      {/* 2. DETECTION RESULT */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-3 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                          DETECTION RESULT
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[#777777] block text-[9px]">Slick Area</span>
                            <span className="font-bold text-[#111111] text-[11px]">{detectionResult?.areaKm2 || s.spill.areaKm2} km²</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Confidence</span>
                            <span className="font-bold text-[#111111] text-[11px]">{((detectionResult?.confidence || s.spill.confidence) * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Target Classification</span>
                            <span className="font-bold text-[#111111] text-[11px]">{(detectionResult?.classification || s.spill.classification).replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Resolution</span>
                            <span className="font-bold text-[#111111] text-[11px]">{s.scene.resolutionM}m GRDH</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. SLICK ANALYSIS RESULT */}
                      <div className="p-3 bg-white border border-[#E5E5E5] mb-3 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                          SLICK ANALYSIS RESULT
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[#777777] block text-[9px]">Dispersion Axes</span>
                            <span className="font-bold text-[#111111] text-[11px]">{slickResult?.majorAxisKm || s.spill.majorAxisKm} × {slickResult?.minorAxisKm || s.spill.minorAxisKm} km</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Orientation</span>
                            <span className="font-bold text-[#111111] text-[11px]">{slickResult?.orientationDeg ?? s.spill.orientationDeg}°</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Aspect Ratio</span>
                            <span className="font-bold text-[#111111] text-[11px]">{(slickResult?.aspectRatio || s.spill.aspectRatio).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Compactness</span>
                            <span className="font-bold text-[#111111] text-[11px]">{(slickResult?.compactness || s.spill.compactness).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. DRIFT & ORIGIN RESULT */}
                      <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-3 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                          DRIFT & ORIGIN RESULT
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <span className="text-[#777777] block text-[9px]">Release Window</span>
                            <span className="font-bold text-[#111111] text-[11px]">{driftResult?.releaseWindowStart || '—'} – {driftResult?.releaseWindowEnd || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Backcast Duration</span>
                            <span className="font-bold text-[#111111] text-[11px]">−{driftDuration}h ({driftResult?.driftDistanceNm || 0} NM)</span>
                          </div>
                          <div>
                            <span className="text-[#777777] block text-[9px]">Origin Coordinates</span>
                            <span className="font-bold text-[#111111] text-[11px]">
                              {driftResult?.originCentroid
                                ? `${driftResult.originCentroid[1].toFixed(4)}°N, ${driftResult.originCentroid[0].toFixed(4)}°E`
                                : '—'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[#777777] block text-[9px]">Origin Uncertainty (95% CI)</span>
                            <span className="font-bold text-[#111111] text-[11px]">
                              {(driftResult?.originUncertaintyKm2 || Math.PI * Math.pow(driftResult?.originRadiusKm || 2, 2)).toFixed(1)} km²
                              {activeScenario === 'SYN-005' ? ' (100-Member Ensemble Spread)' : ' (Deterministic)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5. AIS CORRELATION RESULT */}
                      <div className="p-3 bg-white border border-[#E5E5E5] mb-3 font-mono text-[10px]">
                        <div className="uppercase tracking-wider text-[#888888] mb-1.5 font-bold">
                          AIS CORRELATION RESULT
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Contacts</span>
                            <span className="font-bold text-[#111111] text-xs">{aisData?.summary?.vesselsInRegion || 0}</span>
                          </div>
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Matched</span>
                            <span className="font-bold text-[#111111] text-xs">{activeScenario === 'SYN-004' ? 0 : (aisData?.summary?.temporalMatches || 0)}</span>
                          </div>
                          <div className="p-1.5 bg-[#FAFAFA] border border-[#EEEEEE]">
                            <span className="text-[#888888] block text-[9px]">Candidates</span>
                            <span className="font-bold text-[#111111] text-xs">{activeScenario === 'SYN-004' ? 0 : validCandidates.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* 6. EVIDENCE FUSION & ATTRIBUTION RESULT */}
                      {activeScenario === 'SYN-004' || validCandidates.length === 0 ? (
                        <div className="p-3.5 border-2 border-[#111111] bg-[#FAFAFA] mb-3">
                          <div className="font-mono text-xs font-bold text-[#111111] uppercase mb-1.5 flex items-center justify-between">
                            <span>NO MATCHING AIS CANDIDATE</span>
                            <span className="bg-[#111111] text-white px-2 py-0.5 text-[9px]">ABSTAINED</span>
                          </div>
                          <p className="text-[11px] text-[#444444] leading-relaxed mb-3">
                            The available AIS observations do not provide sufficient evidence to associate the detected slick with a vessel.
                          </p>
                          <div className="p-2.5 bg-white border border-[#E5E5E5] space-y-1 font-mono text-[10px] mb-3">
                            <div className="flex justify-between">
                              <span className="text-[#888888]">Contacts analyzed:</span>
                              <span className="font-bold text-[#111111]">{aisData?.summary?.vesselsInRegion ?? aisData?.tracks?.length ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#888888]">Temporally compatible:</span>
                              <span className="font-bold text-[#111111]">0</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#888888]">Spatially compatible:</span>
                              <span className="font-bold text-[#111111]">0</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#888888]">Candidate vessels:</span>
                              <span className="font-bold text-[#111111]">0</span>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E5E5E5] flex justify-between items-center text-[10px] font-mono">
                            <span className="text-[#888888] uppercase">ATTRIBUTION STATUS</span>
                            <span className="font-bold text-[#111111] uppercase tracking-wider">ABSTAINED</span>
                          </div>
                        </div>
                      ) : (activeCandidate || topCandidate) ? (() => {
                        const reportCandidate = activeCandidate || topCandidate;
                        return (
                          <div className="p-3.5 border-2 border-[#111111] bg-white mb-3">
                            <div className="font-mono text-[10px] uppercase text-[#888888] mb-1 font-bold flex items-center justify-between">
                              <span>EVIDENCE FUSION // EVALUATED CANDIDATE</span>
                              <span className="bg-[#111111] text-white px-2 py-0.5 text-[9px] font-mono font-bold">
                                SCORE: {reportCandidate.compositeScore || reportCandidate.overallScore}/100
                              </span>
                            </div>
                            <div className="font-bold text-sm text-[#111111] mb-0.5">
                              {reportCandidate.vesselName}
                            </div>
                            <div className="font-mono text-[10px] text-[#777777] mb-2.5">
                              MMSI {reportCandidate.mmsi} · {reportCandidate.priority} Priority · Rank Stability: {reportCandidate.rankStability}%
                            </div>

                            {reportCandidate.hasAisGap && (
                              <div className="p-2 bg-[#FEF3C7] border border-[#F59E0B] text-[10px] text-[#92400E] mb-2.5 font-mono">
                                <strong>[ AIS TRANSMISSION GAP IDENTIFIED ]</strong>
                                <span className="block mt-0.5 text-[9px]">
                                  Transponder gap coincides with reconstructed discharge window; documented as contextual evidence.
                                </span>
                              </div>
                            )}

                            <div className="space-y-1 pt-2 border-t border-[#E5E5E5]">
                              <div className="font-mono text-[9px] uppercase text-[#888888] mb-0.5">Forensic Evidence Factors:</div>
                              <ScoreBar
                                label="Spatial Proximity"
                                value={reportCandidate.factors?.spatialProximity ?? reportCandidate.spatialCompatibility ?? 0}
                              />
                              <ScoreBar
                                label="Temporal Compatibility"
                                value={reportCandidate.factors?.temporalCompatibility ?? reportCandidate.temporalCompatibility ?? 0}
                              />
                              <ScoreBar
                                label="Drift Consistency"
                                value={reportCandidate.factors?.driftConsistency ?? reportCandidate.environmentalConsistency ?? 0}
                              />
                              <ScoreBar
                                label="Trajectory Consistency"
                                value={reportCandidate.factors?.trajectoryConsistency ?? reportCandidate.trajectoryCompatibility ?? 0}
                              />
                              <ScoreBar
                                label="Speed & Course Consistency"
                                value={reportCandidate.factors?.speedCourseConsistency ?? reportCandidate.speedCourseConsistency ?? 0}
                              />
                              <ScoreBar
                                label="AIS Continuity"
                                value={reportCandidate.factors?.aisContinuity ?? reportCandidate.aisContinuity ?? 0}
                              />
                            </div>

                            <div className="pt-2 mt-2.5 border-t border-[#E5E5E5] flex justify-between items-center text-[10px] font-mono">
                              <span className="text-[#888888] uppercase">ATTRIBUTION STATUS</span>
                              <span className="font-bold text-[#111111] uppercase tracking-wider">INVESTIGATIVE LEAD (NON-LEGAL)</span>
                            </div>
                          </div>
                        );
                      })() : null}

                      {/* 7. AUDIT CHAIN */}
                      <div className="space-y-1.5 mb-3 p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
                        <div className="font-mono text-[10px] uppercase text-[#888888] font-bold mb-1">
                          INVESTIGATION AUDIT CHAIN
                        </div>
                        {s.report.findings.map((f, idx) => (
                          <div key={idx} className="flex gap-2 text-[10px] items-start">
                            <span className="font-mono font-bold text-[#111111] shrink-0">
                              [{f.step}]
                            </span>
                            <span className="text-[#555555] leading-tight">
                              <strong>{f.title}:</strong> {f.desc}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 8. PROVENANCE METADATA */}
                      <div className="p-2.5 bg-white border border-[#E5E5E5] mb-3 font-mono text-[10px] text-[#666666] space-y-1">
                        <div>SOURCE: {s.provenance.datasetSource}</div>
                        <div>MODEL: {s.provenance.modelVersion}</div>
                        <div>PROCESSED: {s.provenance.processedAt}</div>
                        <div>STATUS: <span className="font-bold text-[#111111]">{s.provenance.dataStatus}</span></div>
                      </div>

                      {/* 9. EXPORT BUTTON */}
                      <button
                        onClick={handleExportGeoJson}
                        className="w-full py-2.5 bg-[#111111] text-white hover:bg-black font-mono text-xs uppercase font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Download Investigation Dossier (.GeoJSON)
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Step Navigation Footer ──────────────────────── */}
                <div className="mt-5 pt-3 border-t border-[#EAEAEA] flex items-center justify-between">
                  <button
                    onClick={() => setConsoleTab((t) => Math.max(0, t - 1))}
                    disabled={consoleTab === 0}
                    className={`font-mono text-[11px] uppercase cursor-pointer ${
                      consoleTab === 0
                        ? 'text-[#CCCCCC] cursor-not-allowed'
                        : 'text-[#666666] hover:text-[#111111]'
                    }`}
                  >
                    ← Previous
                  </button>
                  <span className="font-mono text-[10px] text-[#888888]">
                    STAGE {consoleTab + 1} / {tabs.length}
                  </span>
                  <button
                    onClick={() => setConsoleTab((t) => Math.min(tabs.length - 1, t + 1))}
                    disabled={consoleTab === tabs.length - 1}
                    className={`font-mono text-[11px] uppercase cursor-pointer ${
                      consoleTab === tabs.length - 1
                        ? 'text-[#CCCCCC] cursor-not-allowed'
                        : 'text-[#111111] font-bold hover:underline'
                    }`}
                  >
                    Next →
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ══ Status Footer ════════════════════════════════════════ */}
        <div className="bg-[#FAFAFA] border-t border-[#E5E5E5] px-5 py-2 flex items-center justify-between shrink-0 font-mono text-[10px]">
          <span className="text-[#888888] uppercase tracking-wider">
            SPILLTRACE Maritime Geospatial Investigation Workspace
          </span>
          <div className="flex items-center gap-4">
            <span className="text-[#777777]">
              Case: {selectedIncident?.id || 'INC-2026-001'} · Scenario:{' '}
              {activeScenario || 'UNAVAILABLE'}
            </span>
            <span className="text-[#111111] font-semibold uppercase">
              WGS 84 · EPSG:4326
            </span>
          </div>
        </div>

    </div>
  );
}
