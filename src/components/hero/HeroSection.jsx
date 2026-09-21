import React from 'react';
import HeroOcean3D from './HeroOcean3D';
import SpilltraceLogo from '../common/SpilltraceLogo';

/**
 * HeroSection — Chapter 01: 3D Animated Hero Banner & Radar Ingestion
 * Renders real-time Three.js physical ocean wave dynamics or Sentinel-1 SAR radar visualization.
 */
export default function HeroSection({
  selectedIncident,
  isSarActive,
  setIsSarActive,
  onNavigateToIncidents,
}) {
  return (
    <section id="hero" className="relative min-h-screen pt-16 flex flex-col justify-between border-b border-[#E5E5E5] overflow-hidden bg-[#0A0A0A] text-white">
      {/* Main Hero Content */}
      <div className="relative z-20 max-w-[1440px] w-full mx-auto px-6 sm:px-8 flex-1 flex flex-col justify-center py-20 lg:py-28 pointer-events-none">
        <div className="pointer-events-auto max-w-3xl">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-white/5 border border-white/15 text-white/90 font-mono text-[11px] tracking-label uppercase mb-6">
            <SpilltraceLogo size={18} variant="emblem" inverted />
            <span>Maritime Incident // Case {selectedIncident?.code ? `2026-BB-${selectedIncident.code}` : selectedIncident?.id}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-semibold tracking-[-0.03em] leading-[0.98] text-white">
            An oil spill<br />
            <span className="text-white/95">is detected at sea.</span>
          </h1>

          <p className="text-[#A3A3A3] text-[15px] sm:text-[16px] leading-[1.55] mt-6 max-w-2xl font-normal">
            Real-time physical wave dynamics transport and deform the spreading hydrocarbon film. Reconstruct its drift backward in time, isolate origin uncertainty, and rank potentially associated vessels using spatio-temporal evidence.
          </p>

          {/* Pipeline Sequence Breadcrumb Strip */}
          <div className="mt-8 flex flex-wrap items-center gap-2.5 font-mono text-[11px] tracking-label text-white/50 uppercase">
            <span className="text-white font-medium">Observe</span>
            <span>→</span>
            <span className="text-white font-medium">Detect</span>
            <span>→</span>
            <span>Drift</span>
            <span>→</span>
            <span>Origin</span>
            <span>→</span>
            <span>AIS</span>
            <span>→</span>
            <span className="text-white font-semibold">Attribution</span>
          </div>

          {/* View Mode Toggle & Action Buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-4 text-[12px] font-medium tracking-label">
            <button
              onClick={() => setIsSarActive(false)}
              className={`px-4 py-2.5 uppercase transition-all cursor-pointer flex items-center gap-2.5 ${
                !isSarActive
                  ? 'bg-white text-[#111111] font-semibold border border-white'
                  : 'bg-black/60 text-white/75 hover:text-white border border-white/20 hover:border-white/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${!isSarActive ? 'bg-[#111111]' : 'bg-white/40'}`} />
              3D Physical Simulation
            </button>
            <button
              onClick={() => setIsSarActive(true)}
              className={`px-4 py-2.5 uppercase transition-all cursor-pointer flex items-center gap-2.5 ${
                isSarActive
                  ? 'bg-white text-[#111111] font-semibold border border-white'
                  : 'bg-black/60 text-white/75 hover:text-white border border-white/20 hover:border-white/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSarActive ? 'bg-[#111111]' : 'bg-white/40'}`} />
              Sentinel-1 SAR (Radar)
            </button>
            <a
              href="#detect"
              className="px-4 py-2.5 text-white/80 hover:text-white border border-white/20 hover:border-white/40 transition-all uppercase flex items-center gap-2 cursor-pointer"
            >
              <span>Investigate Detection</span>
              <span>↓</span>
            </a>
          </div>
        </div>
      </div>

      {/* 3D OCEAN WAVE SIMULATION (Three.js WebGL) OR SAR RADAR VIEW */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {!isSarActive ? (
          <HeroOcean3D onToggleSar={() => setIsSarActive(true)} isSarActive={false} />
        ) : (
          <div className="relative w-full h-full bg-[#0A0A0A]">
            <svg className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1600 900">
              <defs>
                <linearGradient id="oceanShade" x1="0" x2="100%" y1="0" y2="100%">
                  <stop offset="0%" stopColor="#141414" />
                  <stop offset="50%" stopColor="#0E0E0E" />
                  <stop offset="100%" stopColor="#050505" />
                </linearGradient>
              </defs>
              <rect fill="url(#oceanShade)" width="100%" height="100%" />
              <g stroke="#262626" strokeDasharray="4,8" strokeWidth="0.75">
                <line x1="200" x2="200" y1="0" y2="900" />
                <line x1="550" x2="550" y1="0" y2="900" />
                <line x1="900" x2="900" y1="0" y2="900" />
                <line x1="1250" x2="1250" y1="0" y2="900" />
                <line x1="0" x2="1600" y1="200" y2="200" />
                <line x1="0" x2="1600" y1="450" y2="450" />
                <line x1="0" x2="1600" y1="700" y2="700" />
              </g>
              <text fill="#666666" fontFamily="monospace" fontSize="11" x="50" y="80">11°20'00"N / 79°40'00"E · BAY OF BENGAL</text>
              <text fill="#666666" fontFamily="monospace" fontSize="11" x="1320" y="80">DESCENDING PASS 148</text>
              <text fill="#666666" fontFamily="monospace" fontSize="11" x="50" y="860">SIGMA-0 DEPRESSION: -8.2 dB (VV/VH)</text>
              <text fill="#666666" fontFamily="monospace" fontSize="11" x="1320" y="860">INCIDENCE ANGLE: 38.4°</text>
              
              {/* Detected Oil Slick Plume */}
              <g transform="translate(180, 120)">
                <path d="M 450,480 C 530,450 630,420 740,360 C 850,300 970,220 1080,170 C 1100,160 1105,175 1075,190 C 960,250 830,340 720,410 C 600,480 500,530 430,510 C 400,500 420,490 450,480 Z" fill="#000000" opacity="0.98" />
                <path d="M 490,480 C 580,440 680,395 780,340 C 870,290 960,230 1040,185 C 1030,200 940,260 850,320 C 740,390 630,450 540,485 C 500,495 480,490 490,480 Z" fill="#050505" stroke="#222" strokeWidth="0.8" />
                <ellipse cx="1020" cy="190" fill="#000000" rx="30" ry="12" stroke="#444" strokeWidth="0.8" transform="rotate(-28 1020 190)" />
                <line stroke="#777777" strokeDasharray="2,2" strokeWidth="0.75" x1="1020" x2="1020" y1="190" y2="100" />
                <circle cx="1020" cy="190" fill="#FFFFFF" r="3" />
                <rect fill="#111111" height="24" stroke="#333333" strokeWidth="0.75" width="170" x="935" y="70" />
                <text fill="#EEEEEE" fontFamily="monospace" fontSize="10" textAnchor="middle" x="1020" y="86">OBSERVED APEX · 14:32</text>
                <line stroke="#777777" strokeDasharray="2,2" strokeWidth="0.75" x1="520" x2="520" y1="480" y2="580" />
                <circle cx="520" cy="480" fill="#FFFFFF" r="3" />
                <rect fill="#111111" height="24" stroke="#333333" strokeWidth="0.75" width="170" x="435" y="580" />
                <text fill="#EEEEEE" fontFamily="monospace" fontSize="10" textAnchor="middle" x="520" y="596">TAIL ADVECTION · 21.8 km</text>
              </g>
              <g className="animate-sar-beam">
                <line opacity="0.6" stroke="#FFFFFF" strokeWidth="1.5" x1="0" x2="1600" y1="0" y2="0" />
                <rect fill="white" height="40" opacity="0.04" width="1600" x="0" y="-40" />
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Incident Data Bar */}
      <div className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-8 lg:px-12 py-5 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold tracking-wider">ACQUISITION METRICS</span>
          <span className="text-white/30">|</span>
          <span className="text-[#888888]">
            {selectedIncident?.basin?.toUpperCase()} · {selectedIncident?.coordinates}
          </span>
        </div>
        <div className="flex items-center gap-6 text-[#888888]">
          <span>AREA: {selectedIncident?.area}</span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <button
            onClick={onNavigateToIncidents}
            className="text-white hover:text-cyan-300 transition-colors flex items-center gap-2 font-medium cursor-pointer"
          >
            <span>CASE MANAGEMENT</span>
            <span className="font-bold">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
