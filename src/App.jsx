import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_INCIDENTS } from './data/incidentsData';
import { getScenarioIdForIncident, SCENARIO_TO_INCIDENT_MAP, INCIDENT_TO_SCENARIO_MAP } from './services/spilltraceService';
import {
  Navbar,
  Footer,
  HeroSection,
  DetectionLayers3D,
  DetectionWorkspace,
  IncidentsArchive,
  SlickCharacterisationScroll,
  DriftDynamicsSection,
  EvidenceFusionScroll,
  InvestigationWorkspace,
  WorkflowSection,
} from './components';

function resolveRouteIds(rawParam1, rawParam2) {
  if (!rawParam1) return { incidentId: null, scenarioId: null };
  const p1 = rawParam1.toUpperCase();
  const p2 = rawParam2 ? rawParam2.toUpperCase() : null;

  if (p1.startsWith('SYN-')) {
    const scenarioId = p1;
    const incidentId = SCENARIO_TO_INCIDENT_MAP[scenarioId] || p2 || 'INC-2026-001';
    return { incidentId, scenarioId };
  }

  if (p1.startsWith('INC-')) {
    const incidentId = p1;
    const scenarioId = p2 || INCIDENT_TO_SCENARIO_MAP[incidentId] || null;
    return { incidentId, scenarioId };
  }

  return { incidentId: p1, scenarioId: p2 };
}

/**
 * Route parser supporting both HTML5 pathname (/investigation/:incidentId/:scenarioId?)
 * and hash routing (#/investigation/:incidentId, #incidents, #detect, #landing)
 */
function parseRouteFromLocation() {
  if (typeof window === 'undefined') {
    return { view: 'landing', incidentId: null, scenarioId: null };
  }

  const pathname = window.location.pathname;
  const hash = window.location.hash;

  // 1. Pathname check: /investigation/:incidentId/:scenarioId? or /investigation/:scenarioId
  const pathMatch = pathname.match(/^\/investigation(?:\/([^\/]+))?(?:\/([^\/]+))?/i);
  if (pathMatch) {
    const raw1 = pathMatch[1] ? decodeURIComponent(pathMatch[1]) : null;
    const raw2 = pathMatch[2] ? decodeURIComponent(pathMatch[2]) : null;
    const { incidentId, scenarioId } = resolveRouteIds(raw1, raw2);
    return {
      view: 'investigation',
      incidentId,
      scenarioId,
    };
  }

  // 2. Hash check: #/investigation/:incidentId or #investigation/:incidentId
  const hashMatch = hash.match(/^#\/?investigation(?:\/([^\/]+))?(?:\/([^\/]+))?/i);
  if (hashMatch) {
    const raw1 = hashMatch[1] ? decodeURIComponent(hashMatch[1]) : null;
    const raw2 = hashMatch[2] ? decodeURIComponent(hashMatch[2]) : null;
    const { incidentId, scenarioId } = resolveRouteIds(raw1, raw2);
    return {
      view: 'investigation',
      incidentId,
      scenarioId,
    };
  }

  if (hash === '#incidents') return { view: 'incidents', incidentId: null, scenarioId: null };
  if (hash === '#detect') return { view: 'detect', incidentId: null, scenarioId: null };
  return { view: 'landing', incidentId: null, scenarioId: null };
}

/**
 * SPILLTRACE — Platform Root Orchestrator
 * High-level routing, operational workspace management, and narrative scroll assembly.
 */
export default function App() {
  const initialRoute = parseRouteFromLocation();

  // Navigation, Incident & Hero States
  const [activeTab, setActiveTab] = useState(initialRoute.view);
  const [routeScenarioId, setRouteScenarioId] = useState(initialRoute.scenarioId);
  const [previousView, setPreviousView] = useState('incidents');
  const [consoleTab, setConsoleTab] = useState(1); // Default to 02 Detection
  const [isSarActive, setIsSarActive] = useState(false);
  const [driftMode, setDriftMode] = useState('hindcast');

  const [selectedIncident, setSelectedIncident] = useState(() => {
    if (initialRoute.incidentId) {
      const found = INITIAL_INCIDENTS.find(
        (i) => i.id.toUpperCase() === initialRoute.incidentId.toUpperCase()
      );
      if (found) return found;
    }
    return INITIAL_INCIDENTS[0];
  });

  // Open Full-Screen Investigation Page
  const handleOpenInvestigation = useCallback(
    (incident = selectedIncident, tabIndex = 1, scenarioId = null) => {
      const inc = incident || selectedIncident || INITIAL_INCIDENTS[0];
      setSelectedIncident(inc);
      setConsoleTab(tabIndex);
      setPreviousView(activeTab === 'investigation' ? 'incidents' : activeTab);

      const targetScenario = scenarioId || getScenarioIdForIncident(inc.id);
      if (!targetScenario) {
        console.warn(`[SPILLTRACE] Incident ${inc.id} has no synthesized scenario.`);
        return;
      }
      setRouteScenarioId(targetScenario);

      const targetPath = `/investigation/${inc.id}/${targetScenario}`;

      try {
        window.history.pushState(
          { incidentId: inc.id, scenarioId: targetScenario, tabIndex },
          '',
          targetPath
        );
      } catch (e) {
        window.location.hash = `#${targetPath}`;
      }

      setActiveTab('investigation');
    },
    [activeTab, selectedIncident]
  );

  // Close Investigation Page & Return to Previous View (Archive or Detect)
  const handleCloseInvestigation = useCallback(() => {
    const dest = previousView === 'detect' ? 'detect' : 'incidents';
    setActiveTab(dest);
    setRouteScenarioId(null);
    const targetHash = dest === 'detect' ? '#detect' : '#incidents';

    try {
      window.history.pushState(null, '', '/' + targetHash);
    } catch (e) {
      window.location.hash = targetHash;
    }
  }, [previousView]);

  // Sync state with browser URL navigation (popstate & hashchange)
  useEffect(() => {
    const handleLocationChange = () => {
      const route = parseRouteFromLocation();
      if (route.view === 'investigation') {
        if (route.incidentId) {
          const found = INITIAL_INCIDENTS.find(
            (i) => i.id.toUpperCase() === route.incidentId.toUpperCase()
          );
          if (found) setSelectedIncident(found);
        }
        setRouteScenarioId(route.scenarioId);
        setActiveTab('investigation');
      } else {
        setActiveTab(route.view);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Close investigation on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeTab === 'investigation') {
        handleCloseInvestigation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleCloseInvestigation]);

  // Central Navigation Handler: Tab switching vs Section scrolling
  const handleNavClick = (tabKey) => {
    if (tabKey === 'incidents' || tabKey === 'scenarios') {
      setActiveTab('incidents');
      window.location.hash = '#scenarios';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tabKey === 'detect') {
      setActiveTab('detect');
      window.location.hash = '#detect';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (activeTab !== 'landing') {
        setActiveTab('landing');
        window.location.hash = '#' + tabKey;
        setTimeout(() => {
          const el = document.getElementById(tabKey);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 60);
      } else {
        window.location.hash = '#' + tabKey;
        const el = document.getElementById(tabKey);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    if (activeTab !== 'landing') {
      setActiveTab('landing');
      window.location.hash = '';
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // DEDICATED FULL-SCREEN INVESTIGATION APPLICATION (NO MODAL)
  // ══════════════════════════════════════════════════════════════
  if (activeTab === 'investigation') {
    return (
      <InvestigationWorkspace
        selectedIncident={selectedIncident}
        onSelectIncident={setSelectedIncident}
        initialScenarioId={routeScenarioId}
        onSwitchScenario={setRouteScenarioId}
        consoleTab={consoleTab}
        setConsoleTab={setConsoleTab}
        onClose={handleCloseInvestigation}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════
  // STANDARD SPILLTRACE PORTAL VIEWS (LANDING, ARCHIVE, DETECTION)
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="bg-white text-[#111111] font-sans antialiased selection:bg-[#111111] selection:text-white min-h-screen">
      {/* Floating Header */}
      <Navbar
        activeTab={activeTab}
        selectedIncident={selectedIncident}
        onNavClick={handleNavClick}
        onLogoClick={handleLogoClick}
        onOpenConsole={() => handleOpenInvestigation(selectedIncident, 0)}
      />

      {/* Main View Router */}
      {activeTab === 'incidents' ? (
        <main className="pt-16 min-h-[calc(100vh-120px)]">
          <IncidentsArchive
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
            onOpenConsole={(tab = 0, inc = selectedIncident) =>
              handleOpenInvestigation(inc, tab)
            }
            onNavigateToPipeline={(target = 'detect') => handleNavClick(target)}
          />
        </main>
      ) : activeTab === 'detect' ? (
        <main className="pt-16 min-h-[calc(100vh-120px)]">
          <DetectionWorkspace
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
            onNavigateToGeometry={() => handleNavClick('technology')}
            onNavigateToIncidents={() => handleNavClick('scenarios')}
            onOpenConsole={() => handleOpenInvestigation(selectedIncident, 1)}
          />
        </main>
      ) : (
        <main>
          {/* Chapter 01: Overview / 3D Ocean Wave Dynamics & Radar Ingestion */}
          <div id="overview" className="scroll-mt-16">
            <HeroSection
              selectedIncident={selectedIncident}
              isSarActive={isSarActive}
              setIsSarActive={setIsSarActive}
              onNavigateToIncidents={() => handleNavClick('scenarios')}
            />
          </div>

          {/* Chapter 02: Capabilities / 3D Progressive Geospatial Layer Assembly */}
          <section id="capabilities" className="scroll-mt-16">
            <DetectionLayers3D />
          </section>

          {/* Chapter 03: Visual 7-Stage Workflow Architecture */}
          <WorkflowSection
            onOpenConsole={() => handleOpenInvestigation(selectedIncident, 0)}
          />

          {/* Chapter 04: Technology (Slick Morphology, Lagrangian Modeling, Evidence Fusion) */}
          <div id="technology" className="scroll-mt-16">
            <section id="geometry" className="scroll-mt-16 border-b border-[#E5E5E5]">
              <SlickCharacterisationScroll />
            </section>

            <DriftDynamicsSection
              driftMode={driftMode}
              setDriftMode={setDriftMode}
            />

            <section id="attribution" className="scroll-mt-16 border-b border-[#E5E5E5]">
              <EvidenceFusionScroll />
            </section>
          </div>

          {/* Final Call to Action */}
          <section
            className="py-24 lg:py-32 px-6 sm:px-8 bg-[#FAFAFA] border-b border-[#E5E5E5] text-center"
            id="console"
          >
            <div className="max-w-[1440px] mx-auto">
              <div className="max-w-3xl mx-auto">
                <div className="font-mono text-[11px] uppercase tracking-label text-[#737373] mb-3">
                  Forensic Geospatial Intelligence
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] mb-5 text-[#111111]">
                  Investigate the event.<br />
                  <span className="font-semibold text-[#111111]">Follow the evidence.</span>
                </h2>
                <p className="text-[#555555] text-[15px] sm:text-[16px] max-w-xl mx-auto mb-10 leading-[1.55] font-normal">
                  Explore 3D dynamic ocean wave transport, satellite SAR observations, reconstructed drift paths, and candidate-vessel ranking in one forensic geospatial console.
                </p>
                <button
                  onClick={() => handleOpenInvestigation(selectedIncident, 0)}
                  className="px-6 py-3.5 bg-[#111111] text-white hover:bg-black transition-all text-xs font-medium uppercase tracking-label cursor-pointer shadow-xs"
                >
                  <span>Open Investigation Workspace</span>
                  <span className="ml-2 font-semibold">→</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Platform Provenance Footer */}
      <Footer />
    </div>
  );
}
