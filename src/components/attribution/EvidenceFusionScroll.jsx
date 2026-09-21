import React, { useEffect, useRef, useState } from 'react';

/**
 * EvidenceFusionScroll — "04 / EXPLAINABLE EVIDENCE FUSION"
 * 
 * Editorial minimal maritime visualization:
 * “VESSELS ARE NOT JUST FOUND. THEY ARE CORRELATED WITH EVIDENCE.”
 * 
 * Oil spill origin + Vessel movement + Time / proximity = Investigative lead.
 * 
 * Minimal, quiet, precise, and confident diagrammatic layout.
 * Breathes directly on the white background without cards or dashboards.
 */

export default function EvidenceFusionScroll() {
  const sectionRef = useRef(null);
  const pathRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [markerPos, setMarkerPos] = useState({ x: 840, y: 490 });

  // Scroll-triggered entry detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Micro-interaction: historical vessel marker moving slowly along highlighted trajectory
  useEffect(() => {
    if (!inView) return;

    let animFrameId;
    let startTime = null;
    const duration = 14000; // 14s for slow, calm historical progression

    const animateMarker = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;

      if (pathRef.current) {
        const pathLength = pathRef.current.getTotalLength();
        const point = pathRef.current.getPointAtLength(progress * pathLength);
        setMarkerPos({ x: point.x, y: point.y });
      }

      animFrameId = requestAnimationFrame(animateMarker);
    };

    animFrameId = requestAnimationFrame(animateMarker);
    return () => cancelAnimationFrame(animFrameId);
  }, [inView]);

  return (
    <div ref={sectionRef} className="py-24 lg:py-32 px-6 sm:px-8 bg-white text-[#111111]">
      <div className="max-w-[1440px] mx-auto">
        
        {/* ================================================================== */}
        {/* ASYMMETRICAL EDITORIAL LAYOUT (Left Content + Right Spatial Field) */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* ---------------------------------------------------------------- */}
          {/* LEFT: Heading & Analytical Statement */}
          {/* ---------------------------------------------------------------- */}
          <div className="lg:col-span-4 max-w-lg">
            <div className="font-mono text-[11px] uppercase tracking-label text-[#737373] mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#111111] inline-block" />
              <span>04 / Explainable Evidence Fusion</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#111111]">
              From tracks<br />
              <span className="font-semibold text-[#111111]">to leads.</span>
            </h2>

            <p className="text-[#555555] text-[15px] sm:text-[16px] leading-[1.55] mt-4 font-normal">
              Relevant vessel movement is correlated with the estimated spill origin and time window to generate transparent investigative leads.
            </p>

            {/* Analytical Metadata Strip */}
            <div className="mt-8 pt-6 border-t border-[#E5E5E5] font-mono text-[11px] text-[#737373] space-y-2.5 tracking-label uppercase">
              <div className="flex justify-between">
                <span>SEAWAY CORRIDOR:</span>
                <span className="text-[#111111] font-medium">TAMIL NADU SHELF</span>
              </div>
              <div className="flex justify-between">
                <span>ESTIMATED ORIGIN:</span>
                <span className="text-[#111111] font-medium">11.182°N, 79.742°E</span>
              </div>
              <div className="flex justify-between">
                <span>ORIGIN WINDOW:</span>
                <span className="text-[#111111] font-medium">08:40 – 09:05 UTC</span>
              </div>
              <div className="flex justify-between">
                <span>POTENTIAL ASSOCIATION:</span>
                <span className="text-[#111111] font-medium">HIGH ASSOCIATION (DEMO)</span>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* RIGHT / CENTER: Clean Diagrammatic Maritime Visualization */}
          {/* ---------------------------------------------------------------- */}
          <div className="lg:col-span-8 relative flex flex-col justify-center">
            
            {/* SVG Nautical Field (Breathes directly on white page) */}
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] select-none">
              <svg
                className="w-full h-full object-contain"
                viewBox="0 0 1000 580"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {/* Subtle Direction Arrowhead */}
                  <marker
                    id="trackArrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#111111" />
                  </marker>
                </defs>

                {/* Subtle Nautical Chart Graticules */}
                <g stroke="#F2F2F2" strokeWidth="0.75" strokeDasharray="3,6">
                  <line x1="200" y1="20" x2="200" y2="560" />
                  <line x1="470" y1="20" x2="470" y2="560" />
                  <line x1="750" y1="20" x2="750" y2="560" />
                  <line x1="40" y1="160" x2="960" y2="160" />
                  <line x1="40" y1="280" x2="960" y2="280" />
                  <line x1="40" y1="420" x2="960" y2="420" />
                </g>

                {/* Chart Coordinate Annotations */}
                <text x="205" y="32" fill="#CCCCCC" fontFamily="monospace" fontSize="9">79°40'00"E</text>
                <text x="475" y="32" fill="#999999" fontFamily="monospace" fontSize="9">79°44'31"E (ORIGIN)</text>
                <text x="755" y="32" fill="#CCCCCC" fontFamily="monospace" fontSize="9">79°52'00"E</text>
                <text x="45" y="155" fill="#CCCCCC" fontFamily="monospace" fontSize="9">11°22'00"N</text>
                <text x="45" y="275" fill="#999999" fontFamily="monospace" fontSize="9">11°10'55"N (ORIGIN)</text>
                <text x="45" y="415" fill="#CCCCCC" fontFamily="monospace" fontSize="9">11°02'00"N</text>

                {/* Shipping Seaway Orientation Axis (Very Faint) */}
                <line x1="90" y1="520" x2="890" y2="110" stroke="#F5F5F5" strokeWidth="32" strokeLinecap="round" />
                <text x="760" y="90" fill="#D8D8D8" fontFamily="monospace" fontSize="8" letterSpacing="0.1em">
                  SHIPPING TRANSIT CORRIDOR // BAY OF BENGAL
                </text>

                {/* ------------------------------------------------------------ */}
                {/* 4–6 THIN IRRELEVANT AIS TRACKS (Light Gray) */}
                {/* ------------------------------------------------------------ */}
                <g
                  className="transition-opacity duration-1000"
                  style={{ opacity: inView ? 0.7 : 0 }}
                >
                  {/* Irrelevant Track 1: Coastal Transit (West) */}
                  <path
                    d="M 120,40 C 140,180 170,350 210,540"
                    fill="none"
                    stroke="#D8D8D8"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <circle cx="170" cy="350" r="2" fill="#CCCCCC" />
                  <text x="180" y="354" fill="#BBBBBB" fontFamily="monospace" fontSize="8">AIS 31024</text>

                  {/* Irrelevant Track 2: Southern Passage (Crossing south of origin) */}
                  <path
                    d="M 60,470 Q 320,490 600,470 T 940,440"
                    fill="none"
                    stroke="#DCDCDC"
                    strokeWidth="1"
                    strokeDasharray="3,5"
                  />
                  <circle cx="600" cy="470" r="2" fill="#CCCCCC" />
                  <text x="610" y="474" fill="#BBBBBB" fontFamily="monospace" fontSize="8">AIS 49210</text>

                  {/* Irrelevant Track 3: Northern Inshore Seaway */}
                  <path
                    d="M 360,50 L 880,170"
                    fill="none"
                    stroke="#D6D6D6"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <circle cx="620" cy="110" r="2" fill="#CCCCCC" />
                  <text x="630" y="105" fill="#BBBBBB" fontFamily="monospace" fontSize="8">AIS 18452</text>

                  {/* Irrelevant Track 4: Southbound Cargo Track (East of origin) */}
                  <path
                    d="M 910,70 Q 860,260 790,410 T 720,530"
                    fill="none"
                    stroke="#DCDCDC"
                    strokeWidth="1"
                    strokeDasharray="3,5"
                  />
                  <circle cx="790" cy="410" r="2" fill="#CCCCCC" />
                  <text x="800" y="414" fill="#BBBBBB" fontFamily="monospace" fontSize="8">AIS 57180</text>
                </g>

                {/* ------------------------------------------------------------ */}
                {/* RELEVANT HIGHLIGHTED TRACK: CANDIDATE VESSEL A */}
                {/* ------------------------------------------------------------ */}
                <g>
                  {/* The Highlighted Trajectory Path */}
                  <path
                    ref={pathRef}
                    d="M 840,490 C 660,390 490,290 280,180 L 160,115"
                    fill="none"
                    stroke="#111111"
                    strokeWidth="2.2"
                    markerEnd="url(#trackArrow)"
                    style={{
                      strokeDasharray: 920,
                      strokeDashoffset: inView ? 0 : 920,
                      transition: 'stroke-dashoffset 2.2s cubic-bezier(0.25, 1, 0.5, 1)',
                    }}
                  />

                  {/* Waypoint Markers Along Track */}
                  <g
                    className="transition-opacity duration-700"
                    style={{ opacity: inView ? 1 : 0, transitionDelay: '1.2s' }}
                  >
                    {/* Waypoint 1 */}
                    <circle cx="780" cy="455" r="2.5" fill="#111111" />
                    <text x="760" y="475" fill="#888888" fontFamily="monospace" fontSize="8">08:15 UTC</text>

                    {/* Waypoint 2 */}
                    <circle cx="620" cy="368" r="2.5" fill="#111111" />
                    <text x="605" y="390" fill="#888888" fontFamily="monospace" fontSize="8">08:35 UTC</text>

                    {/* Waypoint 3 — Coincident with estimated origin time */}
                    <circle cx="474" cy="278" r="4" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
                    <text x="470" y="260" fill="#111111" fontFamily="monospace" fontSize="9" fontWeight="700" textAnchor="middle">
                      08:52 UTC
                    </text>

                    {/* Waypoint 4 */}
                    <circle cx="310" cy="195" r="2.5" fill="#111111" />
                    <text x="315" y="190" fill="#888888" fontFamily="monospace" fontSize="8">09:10 UTC</text>
                  </g>

                  {/* Micro-interaction: Historical Moving Vessel Marker */}
                  {inView && (
                    <g transform={`translate(${markerPos.x}, ${markerPos.y})`}>
                      <circle cx="0" cy="0" r="3.5" fill="#111111" />
                      <circle cx="0" cy="0" r="8" fill="none" stroke="#111111" strokeWidth="0.75" opacity="0.4" />
                    </g>
                  )}

                  {/* Vessel Label at Trajectory Head */}
                  <g
                    transform="translate(145, 95)"
                    className="transition-opacity duration-700"
                    style={{ opacity: inView ? 1 : 0, transitionDelay: '1.8s' }}
                  >
                    <text x="0" y="0" fill="#111111" fontFamily="monospace" fontSize="11" fontWeight="700">
                      CANDIDATE VESSEL: VESSEL A
                    </text>
                    <text x="0" y="14" fill="#111111" fontFamily="monospace" fontSize="9" fontWeight="600" letterSpacing="0.05em">
                      HIGH ASSOCIATION
                    </text>
                    <text x="0" y="27" fill="#888888" fontFamily="monospace" fontSize="8" letterSpacing="0.08em">
                      SPATIO-TEMPORAL EVIDENCE (ILLUSTRATIVE / DEMO)
                    </text>
                  </g>
                </g>

                {/* ------------------------------------------------------------ */}
                {/* SUBTLE SPILL ORIGIN POINT & CONNECTING CORRELATION LINE */}
                {/* ------------------------------------------------------------ */}
                <g
                  className="transition-opacity duration-700"
                  style={{ opacity: inView ? 1 : 0, transitionDelay: '1.4s' }}
                >
                  {/* Connecting Line between Origin Point and Candidate CPA */}
                  <line
                    x1="470"
                    y1="288"
                    x2="474"
                    y2="278"
                    stroke="#111111"
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                  />

                  {/* Origin Point Target Ring & Dot */}
                  <g transform="translate(470, 288)">
                    <circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#111111" strokeWidth="1" strokeDasharray="2,2" />
                    <circle cx="0" cy="0" r="2.5" fill="#111111" />
                    <line x1="-12" y1="0" x2="-6" y2="0" stroke="#111111" strokeWidth="0.8" />
                    <line x1="6" y1="0" x2="12" y2="0" stroke="#111111" strokeWidth="0.8" />
                    <line x1="0" y1="-12" x2="0" y2="-6" stroke="#111111" strokeWidth="0.8" />
                    <line x1="0" y1="6" x2="0" y2="12" stroke="#111111" strokeWidth="0.8" />

                    {/* Origin Tag */}
                    <text x="0" y="22" fill="#111111" fontFamily="monospace" fontSize="8" fontWeight="700" textAnchor="middle">
                      ESTIMATED ORIGIN
                    </text>
                    <text x="0" y="33" fill="#888888" fontFamily="monospace" fontSize="7" textAnchor="middle">
                      T−6H · 08:40–09:05 UTC
                    </text>
                  </g>
                </g>

                {/* ------------------------------------------------------------ */}
                {/* 3 SUBTLE EVIDENCE ANNOTATIONS (Minimal, No Cards) */}
                {/* ------------------------------------------------------------ */}
                <g
                  className="transition-opacity duration-700 font-mono"
                  style={{ opacity: inView ? 1 : 0, transitionDelay: '1.6s' }}
                >
                  {/* 1. Proximity Annotation */}
                  <g transform="translate(520, 310)">
                    <line x1="-8" y1="-4" x2="-2" y2="-4" stroke="#111111" strokeWidth="0.8" />
                    <text x="0" y="0" fill="#888888" fontSize="8" letterSpacing="0.08em">PROXIMITY</text>
                    <text x="0" y="11" fill="#111111" fontSize="9" fontWeight="700">MATCH · 0.4 km</text>
                  </g>

                  {/* 2. Temporal Annotation */}
                  <g transform="translate(420, 210)">
                    <text x="0" y="0" fill="#888888" fontSize="8" letterSpacing="0.08em" textAnchor="end">TIME</text>
                    <text x="0" y="11" fill="#111111" fontSize="9" fontWeight="700" textAnchor="end">ALIGNED · 08:52 UTC</text>
                    <line x1="4" y1="-4" x2="10" y2="-4" stroke="#111111" strokeWidth="0.8" />
                  </g>

                  {/* 3. Trajectory Annotation */}
                  <g transform="translate(230, 140)">
                    <line x1="-8" y1="-4" x2="-2" y2="-4" stroke="#111111" strokeWidth="0.8" />
                    <text x="0" y="0" fill="#888888" fontSize="8" letterSpacing="0.08em">TRAJECTORY</text>
                    <text x="0" y="11" fill="#111111" fontSize="9" fontWeight="700">CONSISTENT · 298.4°</text>
                  </g>
                </g>

                {/* Nautical Distance Scale Bar (Bottom Left) */}
                <g transform="translate(50, 535)" stroke="#111111" strokeWidth="1">
                  <line x1="0" y1="-3" x2="0" y2="3" />
                  <line x1="0" y1="0" x2="80" y2="0" />
                  <line x1="80" y1="-3" x2="80" y2="3" />
                  <text x="90" y="3" stroke="none" fill="#888888" fontFamily="monospace" fontSize="8">
                    5 NAUTICAL MILES
                  </text>
                </g>
              </svg>
            </div>

          </div>

        </div>

        {/* ================================================================== */}
        {/* BOTTOM EDITORIAL STATEMENT */}
        {/* ================================================================== */}
        <div className="mt-16 pt-8 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-xs sm:text-sm font-bold text-[#111111] uppercase tracking-wider">
              SPATIO-TEMPORAL EVIDENCE. CANDIDATE-VESSEL RANKING.
            </div>
            <p className="font-mono text-[11px] text-[#888888] mt-1">
              Spatio-temporal evidence supports investigation; potential association does not establish legal responsibility.
            </p>
          </div>
          <div className="font-mono text-[10px] text-[#AAAAAA] uppercase tracking-widest">
            TAMIL NADU SHELF // CASE 2026-BB-01 (ILLUSTRATIVE / DEMO)
          </div>
        </div>

      </div>
    </div>
  );
}
