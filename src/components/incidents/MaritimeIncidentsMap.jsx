import React, { useState, useMemo } from 'react';

/**
 * MaritimeIncidentsMap — "GEOSPATIAL SITUATION DISPOSITION"
 * 
 * High-precision, editorial maritime intelligence chart representing all registered
 * marine pollution incidents across the Northern Indian Ocean basin (Arabian Sea,
 * Bay of Bengal, Andaman Sea, Lakshadweep, and Malacca Strait).
 * 
 * Projection: Cylindrical Equidistant (EPSG:4326)
 * Bounding Box: 00°00'N – 26°00'N, 54°00'E – 104°00'E
 */

const MIN_LON = 54.0;
const MAX_LON = 104.0;
const MIN_LAT = 0.0;
const MAX_LAT = 26.0;

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;

// Coordinate projection helper
export const geoToSvg = (lat, lon) => {
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * MAP_WIDTH;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * MAP_HEIGHT;
  return { x, y };
};

export default function MaritimeIncidentsMap({
  incidents = [],
  selectedIncident,
  onSelectIncident,
  statusFilter = 'ALL',
  onStatusFilterChange,
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredIncident, setHoveredIncident] = useState(null);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.3).toFixed(1)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.9, +(z - 0.3).toFixed(1)));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filtered incidents for map view
  const visibleIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter === 'ALL') return true;
      return inc.status.toUpperCase() === statusFilter;
    });
  }, [incidents, statusFilter]);

  // Selected incident coordinates in SVG space
  const selectedSvgCoords = useMemo(() => {
    if (!selectedIncident || selectedIncident.lat == null) return null;
    return geoToSvg(selectedIncident.lat, selectedIncident.lon);
  }, [selectedIncident]);

  return (
    <div className="border border-[#E5E5E5] bg-white shadow-2xs font-mono text-xs overflow-hidden mb-12">
      
      {/* ================================================================== */}
      {/* MAP TOP CONTROL BAR */}
      {/* ================================================================== */}
      <div className="bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
        
        {/* Left: Cartographic Geodetic Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-2 h-2 bg-[#111111] inline-block flex-shrink-0" />
          <span className="font-bold text-[#111111] uppercase tracking-wider">
            GEOSPATIAL SITUATION DISPOSITION
          </span>
          <span className="text-[#CCCCCC] hidden md:inline">|</span>
          <span className="text-[#666666] hidden md:inline text-[10px]">
            DATUM: WGS 84 / UTM ZONE 44N
          </span>
          <span className="text-[#CCCCCC] hidden lg:inline">|</span>
          <span className="text-[#888888] hidden lg:inline text-[10px]">
            EXTENT: 00°00'N–26°00'N, 54°00'E–104°00'E
          </span>
        </div>

        {/* Right: Map Status Filters & View Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <div className="flex items-center border border-[#D5D5D5] bg-white">
            {['ALL', 'ACTIVE', 'REVIEW', 'RESOLVED'].map((st) => {
              const count = st === 'ALL'
                ? incidents.length
                : incidents.filter((i) => i.status.toUpperCase() === st).length;
              return (
                <button
                  key={st}
                  onClick={() => onStatusFilterChange && onStatusFilterChange(st)}
                  className={`px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#111111] text-white'
                      : 'text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5]'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center border border-[#D5D5D5] bg-white">
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 hover:bg-[#F0F0F0] text-[#111111] font-bold text-xs border-r border-[#E5E5E5] cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 hover:bg-[#F0F0F0] text-[#111111] font-bold text-xs border-r border-[#E5E5E5] cursor-pointer"
              title="Zoom Out"
            >
              −
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 hover:bg-[#F0F0F0] text-[#555555] hover:text-[#111111] text-[10px] uppercase font-semibold cursor-pointer"
              title="Reset Extent"
            >
              FIT
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SVG INTERACTIVE MAP CANVAS */}
      {/* ================================================================== */}
      <div className="relative w-full aspect-[1000/520] bg-[#F8FAFC] overflow-hidden select-none">
        
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Background Ocean Pattern */}
            <linearGradient id="oceanGradient" x1="0" y1="0" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F9FBFC" />
              <stop offset="50%" stopColor="#F4F6F9" />
              <stop offset="100%" stopColor="#EFF2F6" />
            </linearGradient>

            {/* Tactical Crosshair Marker Filter */}
            <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Ocean Base */}
          <rect width="100%" height="100%" fill="url(#oceanGradient)" />

          {/* Container with Pan & Zoom transform */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: 'center center', transition: 'transform 0.25s ease-out' }}>
            
            {/* ============================================================ */}
            {/* LATITUDE & LONGITUDE NAUTICAL GRATICULE GRID */}
            {/* ============================================================ */}
            <g stroke="#E0E4E8" strokeDasharray="3,4" strokeWidth="0.8">
              {/* Latitude Lines */}
              <line x1="0" x2="1000" y1="20" y2="20" />   {/* 25°N */}
              <line x1="0" x2="1000" y1="120" y2="120" /> {/* 20°N */}
              <line x1="0" x2="1000" y1="220" y2="220" /> {/* 15°N */}
              <line x1="0" x2="1000" y1="320" y2="320" /> {/* 10°N */}
              <line x1="0" x2="1000" y1="420" y2="420" /> {/* 05°N */}

              {/* Longitude Lines */}
              <line x1="120" x2="120" y1="0" y2="520" /> {/* 60°E */}
              <line x1="320" x2="320" y1="0" y2="520" /> {/* 70°E */}
              <line x1="520" x2="520" y1="0" y2="520" /> {/* 80°E */}
              <line x1="720" x2="720" y1="0" y2="520" /> {/* 90°E */}
              <line x1="920" x2="920" y1="0" y2="520" /> {/* 100°E */}
            </g>

            {/* Grid Coordinate Labels */}
            <g fill="#94A3B8" fontFamily="monospace" fontSize="9">
              {/* Latitudes */}
              <text x="8" y="24">25°N</text>
              <text x="8" y="124">20°N</text>
              <text x="8" y="224">15°N</text>
              <text x="8" y="324">10°N</text>
              <text x="8" y="424">05°N</text>

              {/* Longitudes */}
              <text x="122" y="14">60°E</text>
              <text x="322" y="14">70°E</text>
              <text x="522" y="14">80°E</text>
              <text x="722" y="14">90°E</text>
              <text x="918" y="14">100°E</text>

              <text x="122" y="514">60°E</text>
              <text x="322" y="514">70°E</text>
              <text x="522" y="514">80°E</text>
              <text x="722" y="514">90°E</text>
              <text x="918" y="514">100°E</text>
            </g>

            {/* ============================================================ */}
            {/* CARTOGRAPHIC COASTLINES (Northern Indian Ocean) */}
            {/* ============================================================ */}
            
            {/* 1. Indian Subcontinent & Surrounding Landmass */}
            <path
              d="
                M 270,0 
                L 270,30 
                L 285,42 
                L 310,50 
                L 322,66 
                L 300,72 
                L 292,86 
                L 315,102 
                L 345,100 
                L 366,88 
                L 374,136 
                L 384,185 
                L 396,212 
                L 416,260 
                L 444,320 
                L 470,358 
                L 484,342 
                L 504,328 
                L 516,312 
                L 518,280 
                L 528,256 
                L 542,204 
                L 586,166 
                L 632,126 
                L 662,112 
                L 692,88 
                L 720,70 
                L 720,0 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* 2. Sri Lanka */}
            <path
              d="
                M 522,328 
                C 536,334 546,350 546,368 
                C 544,390 534,406 528,404 
                C 516,396 514,374 516,352 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* 3. Arabian Gulf / Oman / Makran Coast */}
            <path
              d="
                M 0,0 
                L 50,0 
                L 60,32 
                L 88,48 
                L 118,72 
                L 132,108 
                L 114,142 
                L 80,180 
                L 0,180 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* Makran & Pakistan Coast */}
            <path
              d="
                M 50,0 
                L 80,24 
                L 140,22 
                L 200,20 
                L 250,22 
                L 270,30 
                L 270,0 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* 4. Myanmar / Bengal / Southeast Asia */}
            <path
              d="
                M 720,0 
                L 720,68 
                L 756,76 
                L 780,132 
                L 818,202 
                L 846,188 
                L 882,280 
                L 888,360 
                L 926,412 
                L 970,476 
                L 996,494 
                L 1000,494 
                L 1000,0 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* 5. Sumatra (North & East) */}
            <path
              d="
                M 826,408 
                C 850,420 890,444 918,460 
                L 960,492 
                L 980,520 
                L 880,520 
                L 814,440 
                Z
              "
              fill="#EAECEF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />

            {/* 6. Andaman & Nicobar Archipelago */}
            <g fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8">
              {/* North / Middle Andaman */}
              <ellipse cx="778" cy="264" rx="4" ry="12" />
              {/* South Andaman / Port Blair */}
              <ellipse cx="774" cy="290" rx="3.5" ry="8" />
              {/* Little Andaman */}
              <ellipse cx="770" cy="308" rx="3" ry="4" />
              {/* Car Nicobar */}
              <circle cx="776" cy="336" r="2.5" />
              {/* Great Nicobar */}
              <ellipse cx="796" cy="382" rx="4" ry="7" />
            </g>

            {/* 7. Lakshadweep & Maldives */}
            <g fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.75">
              <circle cx="374" cy="298" r="2" />
              <circle cx="378" cy="310" r="2" />
              <circle cx="390" cy="436" r="2" />
            </g>

            {/* Geographic Regional Identifiers */}
            <g fill="#94A3B8" fontFamily="sans-serif" fontSize="10" fontWeight="600" letterSpacing="0.12em">
              <text x="210" y="240" opacity="0.6">ARABIAN SEA</text>
              <text x="610" y="240" opacity="0.6">BAY OF BENGAL</text>
              <text x="810" y="310" opacity="0.6">ANDAMAN SEA</text>
              <text x="890" y="470" opacity="0.5" fontSize="8">MALACCA STRAIT</text>
              <text x="440" y="450" opacity="0.5" fontSize="8">NORTH INDIAN OCEAN</text>
            </g>

            {/* ============================================================ */}
            {/* MARITIME SLOC SHIPPING CORRIDORS & TRAFFIC SEPARATION */}
            {/* ============================================================ */}
            <g stroke="#94A3B8" strokeDasharray="4,5" strokeWidth="1" opacity="0.7" fill="none">
              {/* Major SLOC Route Bravo (Eastbound) */}
              <path d="M 120,74 C 280,180 440,360 534,424 C 620,432 730,428 820,424 L 920,448 L 970,480" />
              {/* Westbound Tanker Lane */}
              <path d="M 110,84 C 270,190 430,370 528,436 C 610,444 720,440 812,434 L 912,458" />
              {/* Bombay High - Gujarat Tanker Feeder */}
              <path d="M 374,136 C 360,110 340,90 320,72" />
              {/* Chennai - Port Blair Feeder */}
              <path d="M 528,256 C 610,270 700,282 774,290" />
            </g>

            {/* Navigation Lane Labels */}
            <g fill="#64748B" fontFamily="monospace" fontSize="8" letterSpacing="0.08em">
              <text x="590" y="416">MAJOR SLOC ROUTE BRAVO (EASTBOUND) →</text>
              <text x="760" y="414">SIX DEGREE CHANNEL TRANSIT</text>
              <text x="260" y="118">MUMBAI - GULF CORRIDOR</text>
            </g>

            {/* ============================================================ */}
            {/* PLOTTED INCIDENT PINS & CALLOUT BADGES */}
            {/* ============================================================ */}
            {visibleIncidents.map((inc) => {
              if (inc.lat == null || inc.lon == null) return null;
              const { x, y } = geoToSvg(inc.lat, inc.lon);
              const isSelected = selectedIncident && selectedIncident.id === inc.id;
              const isHovered = hoveredIncident && hoveredIncident.id === inc.id;

              return (
                <g
                  key={inc.id}
                  className="cursor-pointer transition-transform"
                  onClick={() => onSelectIncident(inc)}
                  onMouseEnter={() => setHoveredIncident(inc)}
                  onMouseLeave={() => setHoveredIncident(null)}
                >
                  {/* Pin Selection Animated Ping Ring */}
                  {isSelected && (
                    <g>
                      <circle cx={x} cy={y} r="18" fill="none" stroke="#111111" strokeWidth="1" opacity="0.35" className="animate-ping" />
                      <circle cx={x} cy={y} r="12" fill="none" stroke="#111111" strokeWidth="1.2" strokeDasharray="3,3" />
                      <line x1={x - 18} x2={x + 18} y1={y} y2={y} stroke="#111111" strokeWidth="0.75" />
                      <line x1={x} x2={x} y1={y - 18} y2={y + 18} stroke="#111111" strokeWidth="0.75" />
                    </g>
                  )}

                  {/* Marker Core Shape based on Status */}
                  {inc.status === 'ACTIVE' ? (
                    // Solid Black Square for Active Priority
                    <g>
                      <rect
                        x={x - (isSelected ? 5 : 4)}
                        y={y - (isSelected ? 5 : 4)}
                        width={isSelected ? 10 : 8}
                        height={isSelected ? 10 : 8}
                        fill="#111111"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    </g>
                  ) : inc.status === 'REVIEW' ? (
                    // Inverted Square with Dot for Review
                    <g>
                      <rect
                        x={x - (isSelected ? 5 : 4)}
                        y={y - (isSelected ? 5 : 4)}
                        width={isSelected ? 10 : 8}
                        height={isSelected ? 10 : 8}
                        fill="#FFFFFF"
                        stroke="#111111"
                        strokeWidth="1.5"
                      />
                      <rect x={x - 1.5} y={y - 1.5} width="3" height="3" fill="#111111" />
                    </g>
                  ) : (
                    // Outlined Circle for Resolved
                    <g>
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 5 : 4}
                        fill="#FFFFFF"
                        stroke="#666666"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}

                  {/* Inline Code Label for Non-Selected Pins */}
                  {!isSelected && (
                    <text
                      x={x + 8}
                      y={y + 3}
                      fontFamily="monospace"
                      fontSize="9"
                      fill={inc.status === 'ACTIVE' ? '#111111' : '#666666'}
                      fontWeight={inc.status === 'ACTIVE' ? '700' : '500'}
                    >
                      {inc.code} [{inc.status}]
                    </text>
                  )}
                </g>
              );
            })}

            {/* ============================================================ */}
            {/* PROMINENT TACTICAL CALLOUT BADGE FOR SELECTED INCIDENT */}
            {/* (Authentic Callout matching the Reference Design) */}
            {/* ============================================================ */}
            {selectedSvgCoords && (
              <g
                className="cursor-pointer"
                filter="url(#badgeShadow)"
                transform={`translate(${
                  // Reposition dynamically if close to right edge
                  selectedSvgCoords.x > 750 ? selectedSvgCoords.x - 240 : selectedSvgCoords.x + 35
                }, ${
                  // Reposition dynamically if close to top edge
                  selectedSvgCoords.y < 80 ? selectedSvgCoords.y + 20 : selectedSvgCoords.y - 36
                })`}
              >
                {/* Leader Line to incident point */}
                <line
                  x1={selectedSvgCoords.x > 750 ? 230 : -35}
                  y1={selectedSvgCoords.y < 80 ? -20 : 36}
                  x2={selectedSvgCoords.x > 750 ? 200 : 0}
                  y2={18}
                  stroke="#111111"
                  strokeWidth="1.2"
                />

                {/* Callout Box Background */}
                <rect
                  x="0"
                  y="0"
                  width="210"
                  height="38"
                  fill="#111111"
                  stroke="#111111"
                />

                {/* Left accent marker */}
                <rect x="0" y="0" width="3.5" height="38" fill="#FFFFFF" />

                {/* Callout Text Content */}
                <text x="12" y="15" fill="#FFFFFF" fontFamily="monospace" fontSize="10" fontWeight="700">
                  {selectedIncident.id} [{selectedIncident.status} · {selectedIncident.area}]
                </text>
                <text x="12" y="28" fill="#CCCCCC" fontFamily="monospace" fontSize="8.5">
                  {selectedIncident.coordinates} · {selectedIncident.basin}
                </text>
              </g>
            )}

            {/* Temporary Hover Tooltip for Other Incidents */}
            {hoveredIncident && hoveredIncident.id !== selectedIncident?.id && (
              (() => {
                const hCoords = geoToSvg(hoveredIncident.lat, hoveredIncident.lon);
                return (
                  <g
                    transform={`translate(${hCoords.x + 12}, ${hCoords.y - 32})`}
                    filter="url(#badgeShadow)"
                  >
                    <rect x="0" y="0" width="180" height="30" fill="#FFFFFF" stroke="#111111" strokeWidth="1" />
                    <text x="8" y="13" fill="#111111" fontFamily="monospace" fontSize="9.5" fontWeight="700">
                      {hoveredIncident.id} · {hoveredIncident.status}
                    </text>
                    <text x="8" y="24" fill="#666666" fontFamily="monospace" fontSize="8">
                      {hoveredIncident.coordinates} · {hoveredIncident.area}
                    </text>
                  </g>
                );
              })()
            )}

          </g>

          {/* ============================================================ */}
          {/* STATIC HUD OVERLAYS (Scale bar, Compass, EPSG Datum) */}
          {/* ============================================================ */}
          
          {/* Bottom-Left: Compass, Nautical Scale & Projection Datum */}
          <g transform="translate(16, 470)" fontFamily="monospace" fontSize="8.5" fill="#666666">
            <g transform="translate(0, 0)">
              <rect x="0" y="0" width="16" height="16" fill="#111111" />
              <text x="8" y="11" fill="#FFFFFF" textAnchor="middle" fontWeight="bold" fontSize="8">N</text>
              <line x1="8" x2="8" y1="-3" y2="0" stroke="#111111" strokeWidth="1.5" />
            </g>

            {/* Nautical Scale Indicator */}
            <g transform="translate(24, 8)">
              <line x1="0" x2="100" y1="0" y2="0" stroke="#111111" strokeWidth="2" />
              <line x1="0" x2="0" y1="-4" y2="4" stroke="#111111" strokeWidth="1" />
              <line x1="50" x2="50" y1="-3" y2="3" stroke="#111111" strokeWidth="1" />
              <line x1="100" x2="100" y1="-4" y2="4" stroke="#111111" strokeWidth="1" />
              <text x="0" y="12" textAnchor="start">0</text>
              <text x="50" y="12" textAnchor="middle">50</text>
              <text x="100" y="12" textAnchor="middle">100 NM</text>
            </g>

            {/* Projection Details */}
            <text x="145" y="16" fill="#888888">
              EPSG:4326 · PROJ: CYLINDRICAL EQUIDISTANT
            </text>
          </g>

          {/* Bottom-Right: Tactical Legend */}
          <g transform="translate(710, 484)" fontFamily="monospace" fontSize="8.5" fill="#555555">
            <rect x="0" y="-12" width="275" height="24" fill="#FFFFFF" opacity="0.85" stroke="#E5E5E5" strokeWidth="0.75" />
            
            {/* Active */}
            <rect x="8" y="-4" width="7" height="7" fill="#111111" />
            <text x="19" y="3">ACTIVE</text>

            {/* Review */}
            <rect x="68" y="-4" width="7" height="7" fill="#FFFFFF" stroke="#111111" strokeWidth="1.2" />
            <text x="79" y="3">REVIEW</text>

            {/* Resolved */}
            <circle cx="132" cy="-0.5" r="3.5" fill="#FFFFFF" stroke="#666666" strokeWidth="1" />
            <text x="140" y="3">RESOLVED</text>

            {/* Corridor */}
            <line x1="202" x2="218" y1="-0.5" y2="-0.5" stroke="#94A3B8" strokeDasharray="3,2" strokeWidth="1.2" />
            <text x="222" y="3">SLOC</text>
          </g>

        </svg>

      </div>

      {/* Map Footer Bar with Guidance */}
      <div className="bg-[#FAFAFA] border-t border-[#E5E5E5] px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-[#666666]">
        <div>
          CLICK ANY PIN ON THE CHART TO SELECT INCIDENT DOSSIER &amp; SYNCHRONIZE REGISTER TABLE
        </div>
        <div className="font-semibold text-[#111111]">
          CURRENTLY PLOTTING: {visibleIncidents.length} GEOSPATIAL TARGETS
        </div>
      </div>

    </div>
  );
}
