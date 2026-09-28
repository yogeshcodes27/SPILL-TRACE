import React, { useState } from 'react';
import ForensicTimeline from './ForensicTimeline';
import MiniMap from './MiniMap';

/**
 * SPILLTRACE — Oil Detection / Forensic Map Stage (Reference 2)
 *
 * Implements the dedicated SAR forensic detection workspace:
 * - Map-first full canvas
 * - Left floating "Detected Oil Slick" card with SAR thumbnail & classification
 * - Bottom-left floating legend
 * - Right floating "LAYERS ⌄" control panel
 * - Bottom center 24h forensic timeline
 * - Bottom-right regional mini-map & scale
 */
export default function OilDetectionStage({
  scenario,
  incident,
  visibleLayers,
  onToggleLayer,
  timelineOffset,
  onTimelineChange,
  children, // The Mapbox map component is passed inside as children
}) {
  const [layersOpen, setLayersOpen] = useState(true);

  const s = scenario;
  const spill = s?.spill;
  const scene = s?.scene;

  // Format centroid
  const centroidLat = spill?.centroid ? spill.centroid[1].toFixed(4) : (incident?.lat?.toFixed(4) || '13.4217');
  const centroidLon = spill?.centroid ? spill.centroid[0].toFixed(4) : (incident?.lon?.toFixed(4) || '80.2284');
  const centroidDisplay = `${centroidLat}° N, ${centroidLon}° E`;

  // Format acquisition time
  const acqTime = scene?.acquisitionTime
    ? scene.acquisitionTime.replace('T', ' ').substring(0, 16) + ' UTC'
    : '2024-06-15 05:42 UTC';

  const confidenceVal = spill?.confidence
    ? (spill.confidence).toFixed(2)
    : '0.87';

  const areaVal = spill?.areaKm2 ? `${spill.areaKm2.toFixed(2)} km²` : '4.23 km²';
  const perimeterVal = spill?.perimeterKm ? `${spill.perimeterKm.toFixed(1)} km` : '12.6 km';

  return (
    <div className="relative w-full h-full overflow-hidden select-none font-sans">
      {/* ══ Background Geospatial Map Canvas ═════════════════════════ */}
      <div className="absolute inset-0 z-0">
        {children}
      </div>

      {/* ══ Left Floating Card: Detected Oil Slick ═══════════════════ */}
      <div className="absolute top-4 left-4 z-20 w-[295px] flex flex-col gap-2.5 pointer-events-auto">
        <div className="bg-[#0B131E] border border-[#1E293B] p-3.5 shadow-2xl shadow-black/90 text-white rounded-xs">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <h3 className="font-semibold text-xs text-white tracking-wide">
              Detected Oil Slick
            </h3>
          </div>

          {/* Key-Value Telemetry */}
          <div className="space-y-1.5 font-mono text-[10px] text-[#A0AEC0] mb-3">
            <div className="flex justify-between">
              <span>Acquisition Time</span>
              <span className="font-semibold text-white">{acqTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Satellite</span>
              <span className="font-semibold text-white">{scene?.sensor || 'Sentinel-1 (SAR)'}</span>
            </div>
            <div className="flex justify-between">
              <span>Area</span>
              <span className="font-semibold text-white">{areaVal}</span>
            </div>
            <div className="flex justify-between">
              <span>Perimeter</span>
              <span className="font-semibold text-white">{perimeterVal}</span>
            </div>
            <div className="flex justify-between">
              <span>Centroid</span>
              <span className="font-semibold text-white">{centroidDisplay}</span>
            </div>
          </div>

          {/* Classification Section */}
          <div className="pt-2 border-t border-white/10 mb-3">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-white/70 mb-1.5">
              Classification
            </div>
            <div className="space-y-1 font-mono text-[10px] text-[#A0AEC0]">
              <div className="flex justify-between">
                <span>Confidence</span>
                <span className="font-bold text-white">{confidenceVal}</span>
              </div>
              <div className="flex justify-between">
                <span>Type</span>
                <span className="font-semibold text-emerald-400">
                  {spill?.classification || 'Possible Oil Slick'}
                </span>
              </div>
            </div>
          </div>

          {/* SAR Radar Thumbnail with Red Slick Overlay */}
          <div className="relative w-full h-[120px] bg-black border border-white/20 rounded-xs overflow-hidden">
            <img
              src="/images/layers/layer1_raw_sar.jpg"
              alt="Sentinel-1 SAR Slick"
              className="w-full h-full object-cover grayscale contrast-125"
            />
            {/* SVG Boundary Graphic Overlaid on Thumbnail */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 120">
              <path
                d="M 30,75 Q 60,70 90,62 Q 130,55 165,70 Q 140,82 110,85 Q 70,88 30,75 Z"
                fill="rgba(239, 68, 68, 0.45)"
                stroke="#EF4444"
                strokeWidth="1.8"
              />
              <circle cx="100" cy="72" r="2.5" fill="#FFFFFF" stroke="#000000" strokeWidth="0.8" />
            </svg>
            <div className="absolute bottom-1 left-1.5 text-[8.5px] font-mono text-white/70 bg-black/60 px-1 py-0.5 border border-white/10">
              SAR C-BAND VV · 10m
            </div>
          </div>
        </div>
      </div>

      {/* ══ Bottom-Left Floating Legend ══════════════════════════════ */}
      <div className="absolute bottom-4 left-4 z-20 w-[240px] pointer-events-auto">
        <div className="bg-[#0B131E] border border-[#1E293B] p-3 shadow-2xl shadow-black/90 text-white font-mono text-[10px] rounded-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-2 pb-1 border-b border-[#1E293B]">
            LEGEND
          </div>
          <div className="space-y-1.5 text-[9.5px]">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3 bg-[#EF4444] border border-white/80 inline-block" />
              <span className="text-white/90">Detected Oil Slick</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-2 bg-[#38BDF8] border border-black inline-block" />
              <span className="text-white/90">AIS Vessel (Current)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-0.5 border-b border-dashed border-[#F59E0B]" />
              <span className="text-white/90">Vessel Track (Last 24h)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-black" />
              <span className="text-white/90">Slick Centroid</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Right Floating LAYERS Control Panel ══════════════════════ */}
      <div className="absolute top-4 right-[46px] z-20 w-[220px] pointer-events-auto">
        <div className="bg-[#0B131E] border border-[#1E293B] shadow-2xl shadow-black/90 text-white font-mono rounded-xs overflow-hidden">
          {/* Header with collapsible toggle */}
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer border-b border-[#1E293B]"
          >
            <span>LAYERS</span>
            <svg
              className={`w-3.5 h-3.5 text-white/60 transition-transform ${layersOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Layer Checkboxes */}
          {layersOpen && (
            <div className="p-2.5 space-y-1.5 text-[10px]">
              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#EF4444] border border-white" />
                  <span className="text-white/90">Oil Slick (Detected)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.spill ?? true}
                  onChange={() => onToggleLayer && onToggleLayer('spill')}
                  className="accent-[#EF4444] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#38BDF8] border border-black" />
                  <span className="text-white/90">AIS Vessels (Last 24h)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.ais ?? true}
                  onChange={() => onToggleLayer && onToggleLayer('ais')}
                  className="accent-[#38BDF8] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-0.5 border-b border-dashed border-[#F59E0B]" />
                  <span className="text-white/90">Vessel Tracks</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.vesselTracks ?? true}
                  onChange={() => onToggleLayer && onToggleLayer('vesselTracks')}
                  className="accent-[#F59E0B] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-neutral-600 border border-neutral-400" />
                  <span className="text-white/90">SAR Image (Sentinel-1)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.sarImage ?? true}
                  onChange={() => onToggleLayer && onToggleLayer('sarImage')}
                  className="accent-white cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-white/90">Coastline</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.coastline ?? true}
                  onChange={() => onToggleLayer && onToggleLayer('coastline')}
                  className="accent-white cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-0.5 border-b border-dashed border-[#00BFA5]" />
                  <span className="text-white/90">Ocean Currents</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.oceanCurrents ?? false}
                  onChange={() => onToggleLayer && onToggleLayer('oceanCurrents')}
                  className="accent-[#00BFA5] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-sky-300">→</span>
                  <span className="text-white/90">Wind Vectors</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.windVectors ?? false}
                  onChange={() => onToggleLayer && onToggleLayer('windVectors')}
                  className="accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-1 hover:bg-white/5 rounded cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-0.5 border-b border-dotted border-white/60" />
                  <span className="text-white/90">EEZ Boundary</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleLayers?.eez ?? false}
                  onChange={() => onToggleLayer && onToggleLayer('eez')}
                  className="accent-white cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ══ Bottom-Center Floating Timeline (00:00 to 24:00) ═════════ */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl pointer-events-auto px-4">
        <ForensicTimeline
          variant="detection"
          baseTime={scene?.acquisitionTime || '2024-06-15T05:42:00Z'}
          currentOffset={timelineOffset || 5.7}
          onChange={onTimelineChange}
        />
      </div>

      {/* ══ Bottom-Right Floating Regional Mini-Map & Scale ══════════ */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
        <MiniMap
          incidentCentroid={spill?.centroid || [80.2284, 13.4217]}
          bbox={scene?.bbox || [79.92, 10.95, 80.45, 11.52]}
          scaleKm={20}
        />
      </div>
    </div>
  );
}
