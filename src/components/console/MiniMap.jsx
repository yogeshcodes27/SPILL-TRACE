import React from 'react';

/**
 * SPILLTRACE — Regional Overview Mini-Map Component
 *
 * Dedicated maritime inset map for the Oil Detection / Forensic Map workspace (Reference 2).
 * Displays Southern Indian coastline, Sri Lanka, and the active scene bounding box.
 */
export default function MiniMap({
  incidentCentroid = [80.2284, 13.4217],
  bbox = [79.92, 10.95, 80.45, 11.52],
  scaleKm = 20,
}) {
  // Regional bounding area for SVG projection:
  // Lon: 75.0°E to 85.0°E, Lat: 5.0°N to 17.0°N
  const minLon = 75.0;
  const maxLon = 85.0;
  const minLat = 5.0;
  const maxLat = 17.0;

  const project = (lon, lat) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 140;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 120;
    return [x, y];
  };

  // Convert scenario bbox to SVG rectangle
  const bMinLon = bbox ? bbox[0] : incidentCentroid[0] - 0.5;
  const bMinLat = bbox ? bbox[1] : incidentCentroid[1] - 0.4;
  const bMaxLon = bbox ? bbox[2] : incidentCentroid[0] + 0.5;
  const bMaxLat = bbox ? bbox[3] : incidentCentroid[1] + 0.4;

  const [bx1, by1] = project(bMinLon, bMaxLat);
  const [bx2, by2] = project(bMaxLon, bMinLat);
  const rectW = Math.max(12, Math.abs(bx2 - bx1));
  const rectH = Math.max(10, Math.abs(by2 - by1));

  const [cx, cy] = project(incidentCentroid[0], incidentCentroid[1]);

  return (
    <div className="flex flex-col items-end gap-1.5 font-mono select-none">
      {/* Inset Mini-Map Card */}
      <div className="w-[140px] h-[120px] bg-[#0B131E] border border-[#1E293B] p-1 relative shadow-2xl shadow-black/90 overflow-hidden rounded-xs">
        <svg
          viewBox="0 0 140 120"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Deep Ocean Background */}
          <rect width="140" height="120" fill="#070D14" />

          {/* Graticule lines */}
          <line x1="35" y1="0" x2="35" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
          <line x1="70" y1="0" x2="70" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
          <line x1="105" y1="0" x2="105" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
          <line x1="0" y1="30" x2="140" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
          <line x1="0" y1="60" x2="140" y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />
          <line x1="0" y1="90" x2="140" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="2,2" />

          {/* Southern Indian Coastline Polygon (Approximate regional geography) */}
          <path
            d="M 0,0 L 25,0 L 28,15 L 32,32 L 38,50 L 48,68 L 52,78 L 48,92 L 36,105 L 32,108 L 22,100 L 16,85 L 12,65 L 8,35 L 0,25 Z"
            fill="#1E293B"
            stroke="#475569"
            strokeWidth="0.8"
          />

          {/* Coromandel Coast & Tamil Nadu / Andhra Pradesh */}
          <path
            d="M 52,78 Q 62,65 65,45 Q 68,25 78,5 L 140,5 L 140,0 L 0,0 Z"
            fill="#1E293B"
            stroke="#475569"
            strokeWidth="0.8"
          />

          {/* Sri Lanka Landmass */}
          <path
            d="M 68,90 Q 76,82 82,90 Q 86,100 80,110 Q 72,114 66,104 Q 64,96 68,90 Z"
            fill="#1E293B"
            stroke="#475569"
            strokeWidth="0.8"
          />

          {/* Scenario Viewport Red Bounding Box */}
          <rect
            x={Math.min(bx1, bx2)}
            y={Math.min(by1, by2)}
            width={rectW}
            height={rectH}
            fill="rgba(239, 68, 68, 0.15)"
            stroke="#EF4444"
            strokeWidth="1.2"
          />

          {/* Centroid Pip */}
          <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" stroke="#000000" strokeWidth="0.5" />

          {/* North Arrow */}
          <g transform="translate(126, 12)">
            <polygon points="0,-7 3,0 0,-2 -3,0" fill="#FFFFFF" />
            <text x="0" y="8" fontSize="6" fill="#FFFFFF" textAnchor="middle" fontFamily="monospace">N</text>
          </g>
        </svg>
      </div>

      {/* Metric Scale Bar */}
      <div className="bg-[#0B131E] border border-[#1E293B] px-3 py-1 text-white shadow-2xl shadow-black/90 flex flex-col items-center rounded-xs">
        <div className="flex justify-between w-28 text-[9px] text-white/80">
          <span>0</span>
          <span>10</span>
          <span>{scaleKm} km</span>
        </div>
        <div className="w-28 h-1 bg-white/20 relative mt-0.5 flex">
          <div className="w-1/2 h-full bg-white" />
          <div className="w-1/2 h-full bg-black/40" />
          <div className="absolute top-0 left-0 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
          <div className="absolute top-0 left-1/2 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
          <div className="absolute top-0 right-0 w-0.5 h-1.5 -translate-y-0.5 bg-white" />
        </div>
      </div>
    </div>
  );
}
