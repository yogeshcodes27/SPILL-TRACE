import React, { useState } from 'react';
import ForensicTimeline from './ForensicTimeline';

/**
 * SPILLTRACE — Origin Reconstruction Stage (Reference 1)
 *
 * Implements the dedicated geospatial forensic origin reconstruction workspace:
 * - Map-first full canvas
 * - Left floating "Slick Information" card with SAR thumbnail
 * - Left floating "Origin Reconstruction" card with uncertainty ellipses thumbnail & legend
 * - Right floating collapsible Environmental Layers, Model Overlays, Vessels (AIS), and Metocean color scales
 * - Bottom center -48h to +72h forensic timeline with Past/Observed/Forecast pills
 * - Bottom right 100km scale bar
 */
export default function OriginReconstructionStage({
  scenario,
  incident,
  drift,
  visibleLayers,
  onToggleLayer,
  timelineOffset,
  onTimelineChange,
  children, // Mapbox map component passed inside
}) {
  const [envOpen, setEnvOpen] = useState(true);
  const [modelOpen, setModelOpen] = useState(true);
  const [vesselsOpen, setVesselsOpen] = useState(true);

  const s = scenario;
  const spill = s?.spill;
  const scene = s?.scene;
  const bwdDrift = drift || s?.drift?.backward;

  // Format slick centroid
  const slickLat = spill?.centroid ? spill.centroid[1].toFixed(4) : (incident?.lat?.toFixed(4) || '11.2580');
  const slickLon = spill?.centroid ? spill.centroid[0].toFixed(4) : (incident?.lon?.toFixed(4) || '80.5314');
  const slickCentroidStr = `${slickLat}° N, ${slickLon}° E`;

  // Format origin centroid
  const origLat = bwdDrift?.originCentroid ? bwdDrift.originCentroid[1].toFixed(3) : '11.142';
  const origLon = bwdDrift?.originCentroid ? bwdDrift.originCentroid[0].toFixed(3) : '80.312';
  const originCentroidStr = `${origLat}° N, ${origLon}° E`;

  // Format release time
  const releaseTimeWindow = bwdDrift?.releaseWindowStart && bwdDrift?.releaseWindowEnd
    ? `${bwdDrift.releaseWindowStart} – ${bwdDrift.releaseWindowEnd}`
    : '2024-06-14 18:00 – 23:00 UTC';

  // Uncertainty radius
  const uncertaintyRadiusKm = bwdDrift?.originRadiusKm ? Math.round(bwdDrift.originRadiusKm * 12) : 34;

  const acqTime = scene?.acquisitionTime
    ? scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'
    : '2024-06-15 05:42 UTC';

  const areaStr = spill?.areaKm2 ? `${spill.areaKm2.toFixed(1)} km²` : '12.6 km²';

  return (
    <div className="relative w-full h-full overflow-hidden select-none font-sans">
      {/* ══ Background Geospatial Map Canvas ═════════════════════════ */}
      <div className="absolute inset-0 z-0">
        {children}
      </div>

      {/* ══ Left Floating Column: Slick & Origin Cards ═══════════════ */}
      <div className="absolute top-4 left-4 z-20 w-[295px] flex flex-col gap-2.5 pointer-events-auto">
        
        {/* Card 1: Slick Information */}
        <div className="bg-[#0B131E] border border-[#1E293B] p-3.5 shadow-2xl shadow-black/90 text-white rounded-xs">
          <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-[#1E293B]">
            <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 className="font-semibold text-xs text-white tracking-wide uppercase">
              Slick Information
            </h3>
          </div>

          <div className="space-y-1.5 font-mono text-[10px] text-[#94A3B8] mb-2.5">
            <div className="flex justify-between">
              <span>Detection Time</span>
              <span className="font-semibold text-white">{acqTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Slick Area</span>
              <span className="font-semibold text-white">{areaStr}</span>
            </div>
            <div className="flex justify-between">
              <span>Centroid</span>
              <span className="font-semibold text-white">{slickCentroidStr}</span>
            </div>
          </div>

          {/* Forensic SAR Crop with Red Detection Outline & Coordinates */}
          <div className="relative w-full h-[95px] bg-[#070D14] border border-[#1E293B] rounded-xs overflow-hidden">
            <img
              src="/images/layers/layer1_raw_sar.jpg"
              alt="Sentinel-1 SAR Slick"
              className="w-full h-full object-cover grayscale contrast-150 brightness-90"
            />
            {/* Graticule Crosshair Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 100">
              <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,4" />
              {/* Slick polygon outline */}
              <path
                d="M 45,62 Q 75,52 105,48 Q 145,44 172,58 Q 148,70 115,73 Q 75,76 45,62 Z"
                fill="rgba(239, 68, 68, 0.25)"
                stroke="#EF4444"
                strokeWidth="2"
              />
              <circle cx="108" cy="58" r="3" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1" />
            </svg>
            <div className="absolute top-1 left-1.5 px-1 py-0.5 bg-[#070D14]/90 border border-white/10 font-mono text-[7.5px] text-[#94A3B8]">
              SENTINEL-1 C-SAR // IW_GRDH
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[8.5px] font-mono text-[#94A3B8]">
            <span className="w-2.5 h-1.5 border border-[#EF4444] bg-[#EF4444]/30 inline-block" />
            <span>Detected Oil Slick (Confidence: {((spill?.confidence || 0.88) * 100).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Card 2: Origin Reconstruction */}
        <div className="bg-[#0B131E] border border-[#1E293B] p-3.5 shadow-2xl shadow-black/90 text-white rounded-xs">
          <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-[#1E293B]">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <h3 className="font-semibold text-xs text-white tracking-wide uppercase">
              Origin Reconstruction
            </h3>
          </div>

          <div className="space-y-1.5 font-mono text-[10px] text-[#94A3B8] mb-2.5">
            <div>
              <span className="block text-[8.5px] text-[#64748B] uppercase font-bold">Estimated Release Region</span>
              <span className="font-semibold text-white">{originCentroidStr}</span>
            </div>
            <div>
              <span className="block text-[8.5px] text-[#64748B] uppercase font-bold">Estimated Release Time</span>
              <span className="font-semibold text-white">{releaseTimeWindow}</span>
            </div>
            <div className="flex justify-between">
              <span>Uncertainty (95% CI)</span>
              <span className="font-bold text-emerald-400">± {uncertaintyRadiusKm} km</span>
            </div>
          </div>

          {/* Origin Uncertainty Rings Tactical Thumbnail */}
          <div className="relative w-full h-[95px] bg-[#070D14] border border-[#1E293B] rounded-xs overflow-hidden">
            <img
              src="/images/layers/layer4_verified_mask.jpg"
              alt="Satellite Basemap"
              className="w-full h-full object-cover opacity-40 brightness-50"
            />
            {/* Concentric Ellipses Graphic */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 100">
              <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="0" y1="52" x2="200" y2="52" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3,3" />
              {/* 95% Green dashed contour */}
              <ellipse cx="100" cy="52" rx="68" ry="36" fill="rgba(16, 185, 129, 0.16)" stroke="#10B981" strokeWidth="1.8" strokeDasharray="4,3" />
              {/* 50% Yellow dashed contour */}
              <ellipse cx="100" cy="52" rx="35" ry="19" fill="rgba(234, 179, 8, 0.18)" stroke="#EAB308" strokeWidth="1.8" strokeDasharray="4,3" />
              {/* Red centroid */}
              <circle cx="100" cy="52" r="4.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
            <div className="absolute top-1 left-1.5 px-1 py-0.5 bg-[#070D14]/90 border border-white/10 font-mono text-[7.5px] text-[#94A3B8]">
              LAGRANGIAN MONTE CARLO // 1,000 RUNS
            </div>
          </div>

          {/* Origin Legend Items */}
          <div className="mt-2 space-y-1 font-mono text-[9px] text-[#CBD5E1]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white inline-block shadow-xs" />
              <span>Most Likely Origin (Centroid)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-[#EAB308]" />
              <span>50% Containment Core</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-[#10B981]" />
              <span>95% Uncertainty Boundary</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Right Floating Column: Layers & Scales ═══════════════════ */}
      <div className="absolute top-4 right-[46px] z-20 w-[240px] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[#0B131E] border border-[#1E293B] p-3 shadow-2xl shadow-black/90 text-white font-mono rounded-xs">
          
          {/* Section 1: Environmental Layers */}
          <div className="border-b border-[#1E293B] pb-2 mb-2">
            <button
              onClick={() => setEnvOpen(!envOpen)}
              className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white hover:text-sky-300 transition-colors cursor-pointer"
            >
              <span>Environmental Layers</span>
              <span className="text-[10px] text-white/50">{envOpen ? '▲' : '▼'}</span>
            </button>
            {envOpen && (
              <div className="mt-2 space-y-1.5 text-[9.5px]">
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Wind Vectors (10 m)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.windVectors ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('windVectors')}
                    className="accent-sky-400 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Ocean Currents</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.oceanCurrents ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('oceanCurrents')}
                    className="accent-rose-400 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Wave Height</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.waveHeight ?? false}
                    onChange={() => onToggleLayer && onToggleLayer('waveHeight')}
                    className="accent-white cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Sea Surface Temperature</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.sst ?? false}
                    onChange={() => onToggleLayer && onToggleLayer('sst')}
                    className="accent-white cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Section 2: Model Overlays */}
          <div className="border-b border-[#1E293B] pb-2 mb-2">
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white hover:text-sky-300 transition-colors cursor-pointer"
            >
              <span>Model Overlays</span>
              <span className="text-[10px] text-white/50">{modelOpen ? '▲' : '▼'}</span>
            </button>
            {modelOpen && (
              <div className="mt-2 space-y-1.5 text-[9.5px]">
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Backward Drift (Particles)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.drift ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('drift')}
                    className="accent-emerald-400 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Forward Drift (Forecast)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.forecast ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('forecast')}
                    className="accent-sky-400 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Uncertainty Cone (95%)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.uncertainty ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('uncertainty')}
                    className="accent-emerald-400 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Section 3: Vessels (AIS) */}
          <div className="pb-1 mb-2">
            <button
              onClick={() => setVesselsOpen(!vesselsOpen)}
              className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white hover:text-sky-300 transition-colors cursor-pointer"
            >
              <span>Vessels (AIS)</span>
              <span className="text-[10px] text-white/50">{vesselsOpen ? '▲' : '▼'}</span>
            </button>
            {vesselsOpen && (
              <div className="mt-2 space-y-1.5 text-[9.5px]">
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Vessel Tracks (Last 48h)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.vesselTracks ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('vesselTracks')}
                    className="accent-amber-400 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between hover:bg-white/5 p-0.5 rounded cursor-pointer">
                  <span className="text-white/90">Candidate Vessels (Filtered)</span>
                  <input
                    type="checkbox"
                    checked={visibleLayers?.candidateVessels ?? true}
                    onChange={() => onToggleLayer && onToggleLayer('candidateVessels')}
                    className="accent-emerald-400 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Environmental Color Scales */}
          <div className="pt-2 border-t border-[#1E293B] space-y-2 text-[8.5px]">
            {/* Ocean Current Scale */}
            <div>
              <div className="flex justify-between text-white/80 mb-1">
                <span>Ocean Current (m/s)</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600" />
              <div className="flex justify-between text-white/50 mt-0.5 font-mono">
                <span>0</span>
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Wind Speed Scale */}
            <div>
              <div className="flex justify-between text-white/80 mb-1">
                <span>Wind Speed (m/s)</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-slate-600 via-amber-300 to-yellow-500" />
              <div className="flex justify-between text-white/50 mt-0.5 font-mono">
                <span>0</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Bottom-Center Floating Timeline (-48h to +72h) ═══════════ */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl pointer-events-auto px-4">
        <ForensicTimeline
          variant="origin"
          baseTime={scene?.acquisitionTime || '2024-06-15T05:42:00Z'}
          currentOffset={timelineOffset || -12}
          onChange={onTimelineChange}
        />
      </div>

      {/* ══ Bottom-Right Floating Scale Bar (100 km) ═════════════════ */}
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
    </div>
  );
}
