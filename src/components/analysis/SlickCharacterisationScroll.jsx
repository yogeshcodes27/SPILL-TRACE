import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * SlickCharacterisationScroll — "02 / CHARACTERISATION"
 * 
 * Editorial scroll-driven analytical experience:
 * SEE IT → MEASURE IT → INTERPRET IT → TRACE IT
 * “THE SHAPE OF THE SLICK BECOMES EVIDENCE.”
 * 
 * Stages:
 * - STAGE 01 (0–25%):   DETECTED FORM (Verified Mask, 18.42 km², clean silhouette)
 * - STAGE 02 (25–50%):  MEASURE THE SHAPE (Major Axis 21.8 km, 298° Orientation line)
 * - STAGE 03 (50–75%):  READ THE SPREAD (Centroid, Directional Vector, Environmental Flow)
 * - STAGE 04 (75–100%): TEMPORAL CONSTRAINT (Origin-to-Observation Time ~6–12h, Timeline, Drift Transition)
 */

const STAGES = [
  { id: 0, number: '01', title: 'DETECTED FORM', step: 'SEE IT' },
  { id: 1, number: '02', title: 'MEASURE THE SHAPE', step: 'MEASURE IT' },
  { id: 2, number: '03', title: 'READ THE SPREAD', step: 'INTERPRET IT' },
  { id: 3, number: '04', title: 'TEMPORAL CONSTRAINT', step: 'TRACE IT' },
];

export default function SlickCharacterisationScroll() {
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(0);

  // Handle scroll-linked progress calculation
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    if (totalScrollable <= 0) return;

    const currentScrolled = -rect.top;
    const progress = Math.max(0, Math.min(1, currentScrolled / totalScrollable));
    setScrollProgress(progress);

    // Map progress to stage 0, 1, 2, 3
    if (progress < 0.25) setActiveStage(0);
    else if (progress < 0.50) setActiveStage(1);
    else if (progress < 0.75) setActiveStage(2);
    else setActiveStage(3);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Click-to-jump stage handler
  const scrollToStage = (stageIndex) => {
    if (!containerRef.current) return;
    const targetY = containerRef.current.offsetTop + [0.05, 0.35, 0.65, 0.92][stageIndex] * (containerRef.current.offsetHeight - window.innerHeight);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  // Stage interpolation weights (0.0 to 1.0 for each stage)
  const stage1Weight = Math.max(0, Math.min(1, scrollProgress / 0.25));
  const stage2Weight = Math.max(0, Math.min(1, (scrollProgress - 0.25) / 0.25));
  const stage3Weight = Math.max(0, Math.min(1, (scrollProgress - 0.50) / 0.25));
  const stage4Weight = Math.max(0, Math.min(1, (scrollProgress - 0.75) / 0.25));

  return (
    <div ref={containerRef} className="relative h-[400vh] bg-white text-[#111111]">
      
      {/* Pinned Sticky Viewport (Full Screen Pinned Track) */}
      <div className="sticky top-0 h-screen w-full relative flex flex-col justify-between p-6 sm:p-8 overflow-hidden select-none bg-white">

        {/* ------------------------------------------------------------------ */}
        {/* TOP CONTENT: Section Header (Left) + Layer Content (Right) */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative z-20 max-w-[1440px] w-full mx-auto flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 border-b border-[#E5E5E5] pb-5">
          
          {/* Left Column: Section Title & Technical Statement */}
          <div className="max-w-xl">
            <div className="font-mono text-[11px] uppercase tracking-label text-[#737373] mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#111111] inline-block" />
              <span>02 / Slick Characterisation</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#111111]">
              From pixels<br />
              <span className="font-semibold text-[#111111]">to geometry.</span>
            </h2>
            <div className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] font-medium text-[#111111] bg-[#F5F5F5] px-2.5 py-1 border border-[#E5E5E5] tracking-label uppercase">
              Shape becomes evidence
            </div>
          </div>

          {/* Right Column: Active Stage/Layer Content Card */}
          <div className="w-full lg:max-w-xl bg-[#FAFAFA] border border-[#E5E5E5] p-5 font-mono shadow-xs transition-all duration-300">
            {activeStage === 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-2.5 font-semibold text-xs tracking-label uppercase text-[#111111]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#111111]" />
                    <span>Stage 01 // Detected Form</span>
                  </div>
                  <span className="text-[11px] text-[#737373] uppercase tracking-label font-medium">
                    Verified Mask
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
                      18.42 km²
                    </div>
                    <div className="text-[11px] text-[#666666] mt-0.5">
                      Calibrated hydrocarbon boundary extracted from Sentinel-1 radar backscatter.
                    </div>
                  </div>
                  <div className="text-[10px] text-[#888888] whitespace-nowrap uppercase">
                    FOOTPRINT RESOLVED
                  </div>
                </div>
              </div>
            )}

            {activeStage === 1 && (
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm tracking-wider uppercase text-[#111111]">
                    <span className="w-2 h-2 rounded-full bg-[#111111]" />
                    <span>STAGE 02 // MEASURE THE SHAPE</span>
                  </div>
                  <span className="text-[10px] text-[#3B5066] uppercase tracking-wider font-semibold">
                    AXIS REGRESSION
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
                      21.8 km <span className="text-sm font-normal text-[#666666]">MAJOR AXIS</span>
                    </div>
                    <div className="text-[11px] text-[#666666] mt-0.5">
                      Linear orientation aligned along <span className="text-[#111111] font-semibold">298° AZIMUTH</span> across dominant elongation.
                    </div>
                  </div>
                  <div className="text-[10px] text-[#3B5066] font-semibold whitespace-nowrap uppercase">
                    ASPECT RATIO 10.4:1
                  </div>
                </div>
              </div>
            )}

            {activeStage === 2 && (
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm tracking-wider uppercase text-[#111111]">
                    <span className="w-2 h-2 rounded-full bg-[#3B5066]" />
                    <span>STAGE 03 // READ THE SPREAD</span>
                  </div>
                  <span className="text-[10px] text-[#3B5066] uppercase tracking-wider font-bold">
                    GEOMETRY → MOVEMENT
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
                      CENTROID: 11.238°N, 79.814°E
                    </div>
                    <div className="text-[11px] text-[#555555] mt-0.5">
                      Asymmetric elongation couples directly to surface shear vector heading <span className="text-[#111111] font-semibold">298° NW</span>.
                    </div>
                  </div>
                  <div className="text-[10px] text-[#3B5066] font-semibold whitespace-nowrap uppercase">
                    ADVECTION INPUT
                  </div>
                </div>
              </div>
            )}

            {activeStage === 3 && (
              <div>
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm tracking-wider uppercase text-[#111111]">
                    <span className="w-2 h-2 rounded-full bg-[#111111]" />
                    <span>STAGE 04 // TEMPORAL CONSTRAINT</span>
                  </div>
                  <span className="text-[10px] text-[#888888] uppercase tracking-wider font-semibold">
                    NON-DETERMINISTIC PROXY
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-[#111111]">
                      ORIGIN-TO-OBSERVATION TIME: ~6–12 h
                    </div>
                    <div className="text-[10px] text-[#888888] mt-0.5">
                      *Derived where feasible from observed geometry and spreading characteristics.
                    </div>
                  </div>
                  <div className="min-w-[180px] sm:max-w-[210px] w-full bg-white p-2 border border-[#E5E5E5]">
                    <div className="flex justify-between text-[9px] text-[#888888] font-mono mb-1">
                      <span>0h</span>
                      <span className="font-bold text-[#111111]">6h</span>
                      <span className="font-bold text-[#111111]">12h</span>
                      <span>18h</span>
                      <span>24h</span>
                    </div>
                    <div className="relative w-full h-1.5 bg-[#EEEEEE] rounded-xs overflow-hidden">
                      <div className="absolute left-[25%] right-[50%] h-full bg-[#111111]" />
                    </div>
                    <div className="text-center text-[8px] text-[#3B5066] font-bold mt-1 uppercase">
                      ▲ ESTIMATED SPREADING INTERVAL
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ------------------------------------------------------------------ */}
        {/* LEFT STAGE NAVIGATION RAIL (SEE IT → MEASURE IT → INTERPRET IT → TRACE IT) */}
        {/* ------------------------------------------------------------------ */}
        <div className="absolute left-6 sm:left-10 lg:left-12 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-5 font-mono pointer-events-auto">
          <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-[#E5E5E5] -z-10" />

          {STAGES.map((s) => {
            const isActive = activeStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => scrollToStage(s.id)}
                className="group flex items-center gap-3 text-left cursor-pointer outline-none transition-all"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-[#111111] border-[#111111] scale-110 shadow-sm'
                      : 'bg-white border-[#CCCCCC] group-hover:border-[#111111]'
                  }`}
                >
                  {isActive && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>

                <div className="flex flex-col">
                  <span
                    className={`text-[11px] uppercase tracking-wider font-semibold transition-colors duration-200 ${
                      isActive ? 'text-[#111111]' : 'text-[#888888] group-hover:text-[#444444]'
                    }`}
                  >
                    {s.number} {s.title}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-widest transition-colors duration-200 ${
                      isActive ? 'text-[#3B5066] font-bold' : 'text-[#AAAAAA]'
                    }`}
                  >
                    {s.step}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT VERTICAL PROGRESS INDICATOR */}
        {/* ------------------------------------------------------------------ */}
        <div className="absolute right-6 sm:right-10 lg:right-12 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2.5 font-mono text-[9px] pointer-events-none text-[#888888]">
          <span>01</span>
          <div className="w-[1px] h-32 bg-[#E5E5E5] relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full bg-[#111111] transition-all duration-150"
              style={{ height: `${Math.round(scrollProgress * 100)}%` }}
            />
          </div>
          <span>04</span>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* CENTRAL CINEMATIC VISUALIZATION: LARGE MONOCHROME SLICK GEOMETRY */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative flex-1 flex items-center justify-center my-2 sm:my-4 pointer-events-auto min-h-0">
          <div className="w-full max-w-5xl h-full max-h-[58vh] lg:max-h-[64vh] relative flex items-center justify-center">
            
            <svg
              className="w-full h-full max-h-[56vh] object-contain overflow-visible select-none"
              viewBox="0 0 1000 560"
            >
              <defs>
                {/* Clean Marker Arrowhead for directional vector */}
                <marker
                  id="geoArrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0,1 L 7,4 L 0,7 Z" fill="#3B5066" />
                </marker>
              </defs>

              {/* -------------------------------------------------- */}
              {/* LAYER 0: Subtle Geodetic Graticule Background Grid */}
              {/* -------------------------------------------------- */}
              <g stroke="#F0F0F0" strokeWidth="1">
                <line x1="100" y1="100" x2="900" y2="100" strokeDasharray="3,6" />
                <line x1="100" y1="280" x2="900" y2="280" strokeDasharray="3,6" />
                <line x1="100" y1="460" x2="900" y2="460" strokeDasharray="3,6" />
                <line x1="300" y1="60" x2="300" y2="500" strokeDasharray="3,6" />
                <line x1="500" y1="60" x2="500" y2="500" strokeDasharray="3,6" />
                <line x1="700" y1="60" x2="700" y2="500" strokeDasharray="3,6" />
              </g>

              {/* Geodetic Grid Coordinate Labels */}
              <text x="110" y="90" fill="#AAAAAA" fontFamily="monospace" fontSize="9">11°30'N</text>
              <text x="110" y="270" fill="#AAAAAA" fontFamily="monospace" fontSize="9">11°20'N</text>
              <text x="110" y="450" fill="#AAAAAA" fontFamily="monospace" fontSize="9">11°10'N</text>
              <text x="305" y="80" fill="#AAAAAA" fontFamily="monospace" fontSize="9">79°30'E</text>
              <text x="505" y="80" fill="#AAAAAA" fontFamily="monospace" fontSize="9">79°40'E</text>
              <text x="705" y="80" fill="#AAAAAA" fontFamily="monospace" fontSize="9">79°50'E</text>

              {/* -------------------------------------------------- */}
              {/* LAYER 3 (STAGE 03): Subtle Environmental Vector Flow */}
              {/* -------------------------------------------------- */}
              {stage3Weight > 0.05 && (
                <g opacity={stage3Weight * 0.75} stroke="#3B5066" strokeWidth="1" fill="none">
                  {/* Array of restrained hydrodynamic streamlines */}
                  <g strokeDasharray="4,8">
                    <line x1="280" y1="190" x2="420" y2="135" markerEnd="url(#geoArrow)" />
                    <line x1="420" y1="135" x2="560" y2="80" markerEnd="url(#geoArrow)" />
                    <line x1="200" y1="360" x2="340" y2="305" markerEnd="url(#geoArrow)" />
                    <line x1="360" y1="305" x2="500" y2="250" markerEnd="url(#geoArrow)" />
                    <line x1="520" y1="245" x2="660" y2="190" markerEnd="url(#geoArrow)" />
                    <line x1="320" y1="460" x2="460" y2="405" markerEnd="url(#geoArrow)" />
                    <line x1="480" y1="405" x2="620" y2="350" markerEnd="url(#geoArrow)" />
                    <line x1="640" y1="350" x2="780" y2="295" markerEnd="url(#geoArrow)" />
                  </g>
                </g>
              )}

              {/* -------------------------------------------------- */}
              {/* LAYER 1 (ALL STAGES): THE CENTRAL SLICK GEOMETRY */}
              {/* -------------------------------------------------- */}
              {/* Authentic Sentinel-1 SAR Extracted Polygon Silhouette */}
              <g>
                <path
                  d="M 165,418 
                     C 215,408 265,378 335,352 
                     C 405,326 475,296 545,262 
                     C 615,228 695,182 765,142 
                     C 805,120 840,124 835,148 
                     C 830,163 800,193 750,233 
                     C 695,278 630,328 560,368 
                     C 490,408 420,438 340,463 
                     C 260,488 185,478 160,448 
                     C 145,431 150,421 165,418 Z"
                  fill="#111111"
                  stroke="#111111"
                  strokeWidth="1.2"
                />

                {/* Subtle boundary inspection nodes in Stage 03+ */}
                {stage3Weight > 0.1 && (
                  <g opacity={stage3Weight} stroke="#888888" strokeWidth="0.8" fill="none">
                    <circle cx="165" cy="418" r="3" stroke="#3B5066" strokeDasharray="1,1" />
                    <circle cx="335" cy="352" r="2" />
                    <circle cx="545" cy="262" r="2" />
                    <circle cx="765" cy="142" r="2" />
                    <circle cx="835" cy="148" r="3" stroke="#3B5066" strokeDasharray="1,1" />
                    <circle cx="750" cy="233" r="2" />
                    <circle cx="560" cy="368" r="2" />
                    <circle cx="340" cy="463" r="2" />
                  </g>
                )}
              </g>

              {/* -------------------------------------------------- */}
              {/* LAYER 2 (STAGE 02+): CLEAN MEASUREMENT MAJOR AXIS */}
              {/* -------------------------------------------------- */}
              {stage2Weight > 0.05 && (
                <g opacity={stage2Weight}>
                  {/* Axis Line expanding across the length */}
                  <line
                    x1="160"
                    y1="428"
                    x2={160 + (840 - 160) * stage2Weight}
                    y2={428 + (122 - 428) * stage2Weight}
                    stroke="#111111"
                    strokeWidth="1.5"
                  />

                  {/* Tail Endpoint Terminal */}
                  <circle cx="160" cy="428" r="3.5" fill="#111111" />
                  <line x1="152" y1="410" x2="168" y2="446" stroke="#111111" strokeWidth="1.2" />

                  {/* Apex Endpoint Terminal (Appears as line reaches end) */}
                  {stage2Weight > 0.85 && (
                    <>
                      <circle cx="840" cy="122" r="3.5" fill="#111111" />
                      <line x1="832" y1="104" x2="848" y2="140" stroke="#111111" strokeWidth="1.2" />
                    </>
                  )}

                  {/* Clean Angled Metric Label along the axis */}
                  {stage2Weight > 0.4 && (
                    <g transform="translate(515, 235) rotate(-24.2)">
                      <rect x="-115" y="-22" width="230" height="20" fill="white" opacity="0.95" />
                      <text
                        x="0"
                        y="-8"
                        fill="#111111"
                        fontFamily="monospace"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        letterSpacing="0.05em"
                      >
                        MAJOR AXIS: 21.8 km · 298°
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* -------------------------------------------------- */}
              {/* LAYER 3 (STAGE 03+): CENTROID & ADVECTION VECTOR */}
              {/* -------------------------------------------------- */}
              {stage3Weight > 0.1 && (
                <g opacity={stage3Weight} transform="translate(500, 275)">
                  {/* Centroid Ring Reticle */}
                  <circle cx="0" cy="0" r="14" fill="none" stroke="#3B5066" strokeWidth="1" strokeDasharray="3,3" />
                  <circle cx="0" cy="0" r="3.5" fill="#111111" />
                  <line x1="-18" y1="0" x2="18" y2="0" stroke="#3B5066" strokeWidth="0.8" />
                  <line x1="0" y1="-18" x2="0" y2="18" stroke="#3B5066" strokeWidth="0.8" />

                  {/* Directional Advection Arrow pointing towards 298° NW */}
                  <line
                    x1="0"
                    y1="0"
                    x2="-130"
                    y2="-60"
                    stroke="#3B5066"
                    strokeWidth="1.8"
                    strokeDasharray="6,4"
                    markerEnd="url(#geoArrow)"
                  />

                  {/* Centroid Coordinate Readout */}
                  <rect x="22" y="-18" width="180" height="28" fill="white" opacity="0.95" />
                  <text x="26" y="-4" fill="#111111" fontFamily="monospace" fontSize="10" fontWeight="700">
                    CENTROID (11.238°N, 79.814°E)
                  </text>
                  <text x="26" y="8" fill="#3B5066" fontFamily="monospace" fontSize="9">
                    ADVECTION HEADING: 298° NW
                  </text>
                </g>
              )}
            </svg>



          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* BOTTOM SYNTHESIS & CONTINUOUS INVESTIGATION TRANSITION */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative z-20 max-w-[1440px] w-full mx-auto pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[11px] text-[#737373]">
          
          {activeStage < 3 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[#111111] uppercase tracking-label">
                  ACTIVE PHASE: {STAGES[activeStage].number} {STAGES[activeStage].title}
                </span>
                <span className="text-[#CCCCCC]">|</span>
                <span className="text-[11px] text-[#737373] uppercase">
                  {activeStage === 0 && 'Observed slick footprint · Area calibrated'}
                  {activeStage === 1 && 'Linear regression axis aligned to 298.4°'}
                  {activeStage === 2 && 'Physical surface forcing coupled to centroid'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[#737373] uppercase tracking-label text-[10px]">
                <span>Scroll to advance</span>
                <span>↓</span>
              </div>
            </>
          ) : (
            /* FINAL TRANSITION TO DRIFT PIPELINE (Stage 04+) */
            <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#111111] font-medium tracking-label uppercase">
                <span>18.42 km² Area</span>
                <span className="text-[#CCCCCC]">→</span>
                <span>21.8 km Major Axis</span>
                <span className="text-[#CCCCCC]">→</span>
                <span>298° Orientation</span>
                <span className="text-[#CCCCCC]">→</span>
                <span>~6–12 h Origin Time</span>
              </div>

              <a
                href="#reconstruction"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-white hover:bg-black font-medium uppercase tracking-label transition-all text-xs cursor-pointer shadow-xs"
              >
                <span>Where did it come from? Trace drift</span>
                <span>↓</span>
              </a>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
