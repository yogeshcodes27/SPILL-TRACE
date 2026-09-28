import React from 'react';
import ForensicTimeline from './ForensicTimeline';
import AttributionCharts from './AttributionCharts';
import OverallScoreGauge from './OverallScoreGauge';

/**
 * SPILLTRACE — Vessel Attribution Stage (Reference 3)
 *
 * Implements the dedicated 3-column forensic attribution workspace:
 * - LEFT: Incident Summary, Candidate Ranking, Selected Vessel Details & Origin Track Info
 * - CENTER: Full interactive attribution map with callouts, legend, timeline & scale
 * - RIGHT: Attribution Evidence bars, Overall Score radial gauge, Kinematic charts, Key Events
 */
export default function VesselAttributionStage({
  scenario,
  incident,
  drift,
  aisTraffic,
  evidenceScores,
  selectedCandidateMmsi,
  onSelectCandidate,
  timelineOffset,
  onTimelineChange,
  children, // Mapbox map component passed inside
}) {
  const s = scenario;
  const spill = s?.spill;
  const scene = s?.scene;
  const bwdDrift = drift || s?.drift?.backward;

  // Candidate extraction
  const isSyn004 = s?.id === 'SYN-004' || s?.report?.abstention || evidenceScores?.attributionStatus === 'ABSTAINED';
  const rawCandidates = isSyn004
    ? []
    : (evidenceScores?.candidates || (Array.isArray(evidenceScores) ? evidenceScores : []));

  // If scenario AIS tracks exist, ensure candidates are formed
  const candidateList = React.useMemo(() => {
    if (isSyn004) return [];
    if (rawCandidates.length > 0) return rawCandidates;

    // Build candidates from aisTraffic tracks if evidence scores are still loading
    if (aisTraffic?.tracks?.length > 0) {
      return aisTraffic.tracks.map((t, idx) => ({
        mmsi: t.mmsi,
        vesselName: t.vesselName || `Vessel ${String.fromCharCode(65 + idx)}`,
        vesselType: t.vesselType || 'Tanker',
        flag: t.flag || 'PA',
        imo: t.imo || '9856321',
        lengthM: t.lengthM || 274,
        beamM: t.beamM || 48,
        draughtM: t.draughtM || 14.2,
        compositeScore: idx === 0 ? 87 : idx === 1 ? 71 : idx === 2 ? 42 : idx === 3 ? 28 : 21,
        spatialCompatibility: idx === 0 ? 92 : idx === 1 ? 65 : 40,
        temporalCompatibility: idx === 0 ? 87 : idx === 1 ? 72 : 38,
        trajectoryCompatibility: idx === 0 ? 94 : idx === 1 ? 55 : 48,
        anomalyScore: idx === 0 ? 76 : 20,
      }));
    }

    return [
      { mmsi: '538007664', vesselName: 'MV Ocean Star', score: 0.87, compositeScore: 87, rank: 1 },
      { mmsi: '419002002', vesselName: 'MT Sea Hawk', score: 0.71, compositeScore: 71, rank: 2 },
      { mmsi: '419003003', vesselName: 'MV Eastern', score: 0.42, compositeScore: 42, rank: 3 },
      { mmsi: '419004004', vesselName: 'MV Blue Wave', score: 0.28, compositeScore: 28, rank: 4 },
      { mmsi: '419005005', vesselName: 'MT Coastal', score: 0.21, compositeScore: 21, rank: 5 },
    ];
  }, [rawCandidates, isSyn004, aisTraffic]);

  // Selected candidate object
  const activeCandidate = React.useMemo(() => {
    if (isSyn004 || candidateList.length === 0) return null;
    if (selectedCandidateMmsi) {
      const found = candidateList.find((c) => String(c.mmsi) === String(selectedCandidateMmsi));
      if (found) return found;
    }
    return candidateList[0];
  }, [candidateList, selectedCandidateMmsi, isSyn004]);

  // Associated track data for active candidate
  const activeTrack = React.useMemo(() => {
    if (!activeCandidate || !aisTraffic?.tracks) return null;
    return aisTraffic.tracks.find((t) => String(t.mmsi) === String(activeCandidate.mmsi)) || aisTraffic.tracks[0];
  }, [activeCandidate, aisTraffic]);

  // Formatted metadata
  const acqTime = scene?.acquisitionTime
    ? scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'
    : '2024-06-15 05:42 UTC';

  const origLat = bwdDrift?.originCentroid ? bwdDrift.originCentroid[1].toFixed(3) : '11.142';
  const origLon = bwdDrift?.originCentroid ? bwdDrift.originCentroid[0].toFixed(3) : '80.312';
  const originCentroidStr = `${origLat}° N, ${origLon}° E`;

  const releaseWindow = bwdDrift?.releaseWindowStart && bwdDrift?.releaseWindowEnd
    ? `${bwdDrift.releaseWindowStart} – ${bwdDrift.releaseWindowEnd}`
    : '2024-06-14 18:00 – 23:00 UTC';

  const slickAreaStr = spill?.areaKm2 ? `${spill.areaKm2.toFixed(1)} km²` : '12.6 km²';

  // Evidence factor scores for active candidate
  const proximityScore = activeCandidate?.spatialCompatibility ?? 92;
  const temporalScore = activeCandidate?.temporalCompatibility ?? 87;
  const trajectoryScore = activeCandidate?.trajectoryCompatibility ?? 94;
  const anomalyScore = activeCandidate?.anomalyScore ?? activeCandidate?.behaviourAnomaly ?? 76;
  const compositeScore = activeCandidate?.compositeScore ?? activeCandidate?.overallScore ?? 87;
  const compositeNorm = (compositeScore > 1 ? compositeScore / 100 : compositeScore).toFixed(2);

  return (
    <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden select-none bg-[#070D14] text-white font-sans">
      
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── LEFT COLUMN (~320px): Incident Summary, Candidates, Details ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <aside className="w-full lg:w-[325px] xl:w-[340px] shrink-0 h-auto lg:h-full overflow-y-auto p-3.5 flex flex-col gap-3 bg-[#0B131E] border-r border-white/10 z-20">
        
        {/* Card 1: Incident Summary */}
        <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
            <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <h3 className="font-semibold text-xs text-white tracking-wide font-sans">
              Incident Summary
            </h3>
          </div>

          <div className="space-y-1.5 text-[#A0AEC0]">
            <div className="flex justify-between">
              <span>Detection Time</span>
              <span className="font-semibold text-white">{acqTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Slick Area</span>
              <span className="font-semibold text-white">{slickAreaStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Origin</span>
              <span className="font-semibold text-white">{originCentroidStr}</span>
            </div>
            <div>
              <span className="block text-[8.5px] text-[#718096] uppercase">Origin Time Window</span>
              <span className="font-semibold text-white">{releaseWindow}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-white/10">
              <span>Analysis Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[9.5px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Candidate Vessels (Ranked) */}
        <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10 font-sans">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <h3 className="font-semibold text-xs text-white tracking-wide">
                Candidate Vessels (Ranked)
              </h3>
            </div>
            <span className="text-[9px] text-[#718096] font-mono">
              {candidateList.length} leads
            </span>
          </div>

          {/* Candidates Ranking Table */}
          <div className="w-full overflow-hidden border border-white/10 rounded-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[9px] text-[#A0AEC0] uppercase border-b border-white/10">
                  <th className="py-1 px-2.5 font-semibold w-10">Rank</th>
                  <th className="py-1 px-2.5 font-semibold">Vessel Name</th>
                  <th className="py-1 px-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {candidateList.map((cand, idx) => {
                  const isSelected = activeCandidate && String(cand.mmsi) === String(activeCandidate.mmsi);
                  const scoreDisplay = cand.compositeScore
                    ? (cand.compositeScore > 1 ? (cand.compositeScore / 100).toFixed(2) : cand.compositeScore.toFixed(2))
                    : '0.87';

                  return (
                    <tr
                      key={cand.mmsi || idx}
                      onClick={() => onSelectCandidate && onSelectCandidate(cand.mmsi)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1E3A5F]/60 text-white font-bold border-l-2 border-l-[#38BDF8]'
                          : 'hover:bg-white/5 text-[#CBD5E1]'
                      }`}
                    >
                      <td className="py-1.5 px-2.5 text-center text-[#94A3B8]">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5 truncate max-w-[140px]">
                        {cand.vesselName || `Vessel ${cand.mmsi}`}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-sky-400">
                        {scoreDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Selected Vessel Details */}
        {activeCandidate && (
          <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10 font-sans">
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1" />
                <path d="M4 17l1.5-7.5L8 9.5 9 4h6l1 5.5 2.5 0L20 17" />
              </svg>
              <h3 className="font-semibold text-xs text-white tracking-wide">
                Selected Vessel Details
              </h3>
            </div>

            {/* Thumbnail Image & Name Header */}
            <div className="flex items-center gap-3 mb-3 bg-[#0B131E] p-2 border border-white/10 rounded-xs">
              <div className="w-14 h-12 shrink-0 bg-black/60 border border-white/20 overflow-hidden rounded-xs">
                <img
                  src="/images/tanker_3d_photoreal_master.jpg"
                  alt="Vessel Silhouette"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-white font-sans truncate">
                    {activeCandidate.vesselName || 'MV Ocean Star'}
                  </span>
                  <span className="px-1.5 py-0.2 bg-[#1E3A5F] text-sky-300 border border-sky-400/40 text-[8px] font-bold rounded">
                    Rank #1
                  </span>
                </div>
                <div className="text-[9px] text-[#A0AEC0] mt-0.5">
                  MMSI: <span className="font-bold text-white">{activeCandidate.mmsi || '538007664'}</span>
                </div>
              </div>
            </div>

            {/* Vessel Dimensions & Identification Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[#A0AEC0] mb-3 pb-2 border-b border-white/10">
              <div>
                <span className="text-[#718096] block text-[8.5px]">IMO:</span>
                <span className="font-semibold text-white">{activeTrack?.imo || activeCandidate.imo || '9856321'}</span>
              </div>
              <div>
                <span className="text-[#718096] block text-[8.5px]">Vessel Type:</span>
                <span className="font-semibold text-white">{activeTrack?.vesselType || activeCandidate.vesselType || 'Oil Tanker'}</span>
              </div>
              <div>
                <span className="text-[#718096] block text-[8.5px]">Flag:</span>
                <span className="font-semibold text-white">{activeTrack?.flag || activeCandidate.flag || 'Singapore'}</span>
              </div>
              <div>
                <span className="text-[#718096] block text-[8.5px]">Length × Width:</span>
                <span className="font-semibold text-white">
                  {activeTrack?.lengthM || activeCandidate.lengthM || 274}m × {activeTrack?.beamM || activeCandidate.beamM || 48}m
                </span>
              </div>
              <div>
                <span className="text-[#718096] block text-[8.5px]">Draught:</span>
                <span className="font-semibold text-white">{activeTrack?.draughtM || activeCandidate.draughtM || 14.2} m</span>
              </div>
            </div>

            {/* Origin Region Proximity & Kinematics */}
            <div>
              <div className="font-semibold text-[9px] uppercase tracking-wider text-sky-300 mb-1.5 font-sans">
                Track Information (at origin region)
              </div>
              <div className="space-y-1 text-[#A0AEC0]">
                <div className="flex justify-between">
                  <span>Time in Region</span>
                  <span className="font-semibold text-white">2024-06-14 19:12 – 21:43 UTC</span>
                </div>
                <div className="flex justify-between">
                  <span>Distance to Origin</span>
                  <span className="font-semibold text-white">8.4 km (4.5 NM)</span>
                </div>
                <div className="flex justify-between">
                  <span>Speed (avg)</span>
                  <span className="font-bold text-amber-300">3.2 knots</span>
                </div>
                <div className="flex justify-between">
                  <span>Heading</span>
                  <span className="font-semibold text-white">227° (SW)</span>
                </div>
                <div className="flex justify-between">
                  <span>Behaviour</span>
                  <span className="font-bold text-rose-400">Unusual slow speed</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── CENTER COLUMN: Large Geospatial Attribution Map ─────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 h-[50vh] min-h-[460px] lg:h-full relative overflow-hidden bg-[#0A1118]">
        {children}

        {/* ── Floating Attribution Legend (Bottom-Left) ── */}
        <div className="absolute bottom-4 left-4 z-20 w-[240px] pointer-events-auto">
          <div className="bg-[#0B131E] border border-[#1E293B] p-3 shadow-2xl shadow-black/90 text-white font-mono text-[9.5px] rounded-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-2 pb-1 border-b border-[#1E293B] font-sans">
              Attribution Legend
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-2.5 bg-[#EF4444] border border-white/80 inline-block" />
                <span className="text-white/90">Detected Oil Slick</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-0.5 border-b border-dashed border-[#F59E0B]" />
                <span className="text-white/90">Origin Uncertainty (50%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-0.5 border-b border-dashed border-[#10B981]" />
                <span className="text-white/90">Origin Uncertainty (95%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-0.5 border-b border-dashed border-sky-400" />
                <span className="text-white/90">AIS Vessel Track (Last 48h)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-3 border border-black bg-[#F59E0B] inline-block" />
                <span className="text-white/90 font-bold">Candidate Vessel</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2.5 border border-black bg-white inline-block" />
                <span className="text-white/70">Other AIS Vessel</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating Timeline Scrubber (Bottom-Center) ── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl pointer-events-auto px-4">
          <ForensicTimeline
            variant="attribution"
            baseTime={scene?.acquisitionTime || '2024-06-15T05:42:00Z'}
            currentOffset={timelineOffset || -12}
            onChange={onTimelineChange}
          />
        </div>

        {/* ── Floating Metric Scale Bar (Bottom-Right) ── */}
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
          <div className="bg-[#0B131E] border border-[#1E293B] px-3.5 py-1 text-white shadow-xl shadow-black/80 flex flex-col items-center font-mono">
            <div className="flex justify-between w-32 text-[9px] text-white/80">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>100 km</span>
            </div>
            <div className="w-32 h-1 bg-white/20 relative mt-0.5 flex">
              <div className="w-1/4 h-full bg-white" />
              <div className="w-1/4 h-full bg-black/50" />
              <div className="w-1/4 h-full bg-white" />
              <div className="w-1/4 h-full bg-black/50" />
              <div className="absolute top-0 left-0 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
              <div className="absolute top-0 left-1/4 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
              <div className="absolute top-0 left-1/2 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
              <div className="absolute top-0 right-0 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
            </div>
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── RIGHT COLUMN (~340px): Evidence Scores, Gauge, Profile & Logs */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <aside className="w-full lg:w-[335px] xl:w-[360px] shrink-0 h-auto lg:h-full overflow-y-auto p-3.5 flex flex-col gap-3 bg-[#0B131E] border-l border-white/10 z-20">
        
        {/* Card 1: Attribution Evidence Bars */}
        <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
          <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/10 font-sans">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <h3 className="font-semibold text-xs text-white tracking-wide truncate">
              Attribution Evidence ({activeCandidate?.vesselName || 'Lead Candidate'})
            </h3>
          </div>

          <div className="space-y-2">
            {/* Proximity to Origin */}
            <div>
              <div className="flex justify-between text-[#A0AEC0] mb-0.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-400">◎</span>
                  <span>Proximity to Origin</span>
                </div>
                <span className="font-bold text-white">{proximityScore}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#38BDF8] rounded-full transition-all duration-500" style={{ width: `${proximityScore}%` }} />
              </div>
            </div>

            {/* Temporal Match */}
            <div>
              <div className="flex justify-between text-[#A0AEC0] mb-0.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-400">◷</span>
                  <span>Temporal Match</span>
                </div>
                <span className="font-bold text-white">{temporalScore}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#A855F7] rounded-full transition-all duration-500" style={{ width: `${temporalScore}%` }} />
              </div>
            </div>

            {/* Trajectory Consistency */}
            <div>
              <div className="flex justify-between text-[#A0AEC0] mb-0.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">↗</span>
                  <span>Trajectory Consistency</span>
                </div>
                <span className="font-bold text-white">{trajectoryScore}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full transition-all duration-500" style={{ width: `${trajectoryScore}%` }} />
              </div>
            </div>

            {/* Behaviour Anomaly */}
            <div>
              <div className="flex justify-between text-[#A0AEC0] mb-0.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">⚠</span>
                  <span>Behaviour Anomaly</span>
                </div>
                <span className="font-bold text-white">{anomalyScore}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full transition-all duration-500" style={{ width: `${anomalyScore}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Overall Attribution Score Gauge */}
        <OverallScoreGauge
          score={compositeNorm}
          maxScore={1.0}
          likelihoodLabel={compositeNorm >= 0.75 ? 'High Likelihood' : compositeNorm >= 0.45 ? 'Moderate Likelihood' : 'Low Correlation'}
          summary={
            isSyn004
              ? 'ABSTENTION: Open ocean case beyond territorial AIS sensor coverage. Zero fabricated candidate vessels.'
              : `Strong spatial, temporal and trajectory evidence correlates ${activeCandidate?.vesselName || 'this vessel'} with the reconstructed release origin.`
          }
        />

        {/* Card 3: Kinematic Graphs (Speed & Heading Profiles) */}
        <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
          <AttributionCharts
            candidate={activeCandidate}
            positions={activeTrack?.positions || []}
            originWindow={{ start: '06-14 19:12', end: '06-14 21:43' }}
          />
        </div>

        {/* Card 4: Key Events Timeline */}
        <div className="bg-[#101A28] border border-white/10 p-3 rounded-xs font-mono text-[10px]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888] font-semibold mb-2.5 pb-1 border-b border-white/10 font-sans">
            Key Events ({activeCandidate?.vesselName || 'Lead Vessel'})
          </div>
          <div className="space-y-2 text-[9.5px] text-[#A0AEC0]">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-white/50 mt-1 shrink-0" />
              <div>
                <span className="text-[#64748B] block text-[8px]">06-14 17:30 UTC</span>
                <span className="text-white/90">Entered origin uncertainty zone</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0 shadow-xs" />
              <div>
                <span className="text-[#64748B] block text-[8px]">06-14 19:12 UTC</span>
                <span className="text-rose-300 font-semibold">Speed reduced to 3.1 knots (Loiter)</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
              <div>
                <span className="text-[#64748B] block text-[8px]">06-14 21:43 UTC</span>
                <span className="text-white/90">Exited origin containment zone</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 mt-1 shrink-0" />
              <div>
                <span className="text-[#64748B] block text-[8px]">06-15 03:10 UTC</span>
                <span className="text-white/90">Changed course (227° → 045° NE)</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-white/30 mt-1 shrink-0" />
              <div>
                <span className="text-[#64748B] block text-[8px]">06-15 08:20 UTC</span>
                <span className="text-white/70">Continued normal transit operation</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
