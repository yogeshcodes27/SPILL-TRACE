import React from 'react';

/**
 * DriftDynamicsSection — Chapter 04: NOAA PyGNOME Drift Dynamics & Origin Reconstruction
 * Interactive Lagrangian particle advection with backward hindcast & forward spread prediction.
 */
export default function DriftDynamicsSection({ driftMode, setDriftMode }) {
  return (
    <section
      className="relative min-h-[92vh] bg-[#0A0A0A] text-white flex flex-col justify-between border-b border-[#E5E5E5] overflow-hidden scroll-mt-16"
      id="reconstruction"
    >
      <div className="relative z-20 max-w-[1440px] w-full mx-auto px-6 sm:px-8 pt-20 lg:pt-28 pb-12 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
        <div className="max-w-2xl">
          <div className="font-mono text-[11px] uppercase tracking-label text-white/50 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-white inline-block" />
            <span>03 / Drift Modelling (PyGNOME)</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-white">
            The slick moves.<br />
            <span className="font-semibold text-white/95">
              {driftMode === 'hindcast' ? 'Trace it back.' : 'Forecast ahead.'}
            </span>
          </h2>
          <p className="text-[#A3A3A3] text-[15px] sm:text-[16px] max-w-xl mt-4 leading-[1.55] font-normal">
            {driftMode === 'hindcast'
              ? 'Lagrangian particle tracking advected by Copernicus Marine (CMEMS) currents and ERA5 wind shear (3% factor). Reverse the particles to isolate origin uncertainty.'
              : 'Forward trajectory simulation projecting slick spreading, weathering, and coastal landfall vulnerability over the next 24 hours.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 font-mono text-[11px] tracking-label">
            <button
              onClick={() => setDriftMode('hindcast')}
              className={`px-4 py-2.5 uppercase transition-all cursor-pointer font-medium ${
                driftMode === 'hindcast'
                  ? 'bg-white text-[#111111] border border-white'
                  : 'bg-black/60 text-white/70 hover:text-white border border-white/20 hover:border-white/40'
              }`}
            >
              ← 6h Backward Hindcast (Estimated Origin)
            </button>
            <button
              onClick={() => setDriftMode('forecast')}
              className={`px-4 py-2.5 uppercase transition-all cursor-pointer font-medium ${
                driftMode === 'forecast'
                  ? 'bg-white text-[#111111] border border-white'
                  : 'bg-black/60 text-white/70 hover:text-white border border-white/20 hover:border-white/40'
              }`}
            >
              +24h Forward Forecast (Response) →
            </button>
          </div>
        </div>

        {/* Metocean Forcing Telemetry Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-[#0A0A0A] border border-white/15 font-mono text-xs self-start shadow-sm w-full lg:w-auto">
          <div>
            <span className="text-white/50 text-[10px] block uppercase tracking-label mb-1">ERA5 10M WIND</span>
            <span className="font-semibold text-white text-[14px]">14.2 kn @ 054°</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] block uppercase tracking-label mb-1">CMEMS CURRENT</span>
            <span className="font-semibold text-white text-[14px]">0.62 m/s @ 234°</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] block uppercase tracking-label mb-1">STOKES DRIFT</span>
            <span className="font-semibold text-white text-[14px]">0.11 m/s (WAVE)</span>
          </div>
          <div>
            <span className="text-white/50 text-[10px] block uppercase tracking-label mb-1">INTEGRATOR</span>
            <span className="font-semibold text-white text-[14px]">RK4 (Δt = 30m)</span>
          </div>
        </div>
      </div>

      {/* Drift Map SVG */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1400 800">
          <defs>
            <style>{`
              @keyframes smoothMarchHindcast {
                0% {
                  stroke-dashoffset: 32px;
                }
                100% {
                  stroke-dashoffset: 0px;
                }
              }
              @keyframes smoothMarchForecast {
                0% {
                  stroke-dashoffset: 0px;
                }
                100% {
                  stroke-dashoffset: -48px;
                }
              }
              @keyframes smoothRotateClockwise {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }
              @keyframes smoothRotateCounter {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(-360deg);
                }
              }
              .smooth-line-hindcast {
                stroke-dasharray: 8px 8px;
                animation: smoothMarchHindcast 1.4s linear infinite;
                will-change: stroke-dashoffset;
              }
              .smooth-line-forecast {
                stroke-dasharray: 12px 12px;
                animation: smoothMarchForecast 1.6s linear infinite;
                will-change: stroke-dashoffset;
              }
              .smooth-spin-ring {
                transform-box: fill-box;
                transform-origin: center;
                animation: smoothRotateClockwise 9s linear infinite;
                will-change: transform;
              }
              .smooth-spin-ellipse {
                transform-box: fill-box;
                transform-origin: center;
                animation: smoothRotateCounter 12s linear infinite;
                will-change: transform;
              }
            `}</style>
          </defs>
          <rect fill="#0F0F0F" height="100%" width="100%" />
          {driftMode === 'hindcast' ? (
            <g>
              <polygon fill="#222222" opacity="0.5" points="1080,280 720,410 380,530 360,560 700,450 1080,310" />
              
              {/* Smooth Flowing Dotted Line */}
              <path
                className="smooth-line-hindcast"
                d="M 1080,295 C 880,360 620,440 370,545"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
              />

              <g transform="translate(1080, 295)">
                <circle cx="0" cy="0" fill="#FFFFFF" r="4" />
                <text fill="#FFFFFF" fontFamily="monospace" fontSize="9" x="-50" y="-15">OBSERVED 14:32</text>
              </g>

              {/* Smooth Rotating Circles & Estimated Origin */}
              <g transform="translate(370, 545)">
                <circle
                  className="smooth-spin-ring"
                  cx="0"
                  cy="0"
                  r="28"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeDasharray="4px 4px"
                  opacity="0.8"
                />
                <ellipse
                  className="smooth-spin-ellipse"
                  cx="0"
                  cy="0"
                  rx="36"
                  ry="20"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeDasharray="4px 4px"
                />
                <circle cx="0" cy="0" fill="#FFFFFF" r="4" />
                <text fill="#111" fontFamily="monospace" fontSize="9" fontWeight="700" textAnchor="middle" x="0" y="36">
                  ESTIMATED ORIGIN (T−6H)
                </text>
              </g>
            </g>
          ) : (
            <g>
              <polygon fill="#2A2A2A" opacity="0.6" points="1080,295 820,410 420,580 180,680 260,740 650,560 1080,315" />

              {/* Smooth Flowing Dotted Line (Forecast) */}
              <path
                className="smooth-line-forecast"
                d="M 1080,295 C 820,410 520,560 220,700"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />

              <g transform="translate(1080, 295)">
                <circle cx="0" cy="0" fill="#FFFFFF" r="4" />
                <text fill="#FFFFFF" fontFamily="monospace" fontSize="9" x="-50" y="-15">OBSERVED 14:32</text>
              </g>

              {/* Smooth Rotating Circles & Projected Landfall */}
              <g transform="translate(220, 700)">
                <circle
                  className="smooth-spin-ring"
                  cx="0"
                  cy="0"
                  r="26"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeDasharray="5px 5px"
                  opacity="0.8"
                />
                <ellipse
                  className="smooth-spin-ellipse"
                  cx="0"
                  cy="0"
                  rx="36"
                  ry="20"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeDasharray="4px 4px"
                  opacity="0.9"
                />
                <circle cx="0" cy="0" fill="#FFFFFF" r="6" />
                <text fill="#FFF" fontFamily="monospace" fontSize="9" fontWeight="700" textAnchor="middle" x="0" y="-18">
                  PROJECTED LANDFALL (+24H)
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="relative z-20 max-w-7xl w-full mx-auto px-6 py-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs text-white/60">
        <div>LAGRANGIAN ADVECTION ENGINE: NOAA GNOME / PYGNOME INTEGRATION</div>
        <div className="text-white">BACKWARD DRIFT DISTANCE: 16.8 NAUTICAL MILES (T−5h 52m)</div>
      </div>
    </section>
  );
}
