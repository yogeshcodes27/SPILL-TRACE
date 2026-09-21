import React from 'react';

/**
 * Footer — Platform provenance footer with system version & data sources
 */
export default function Footer() {
  return (
    <footer className="py-12 sm:py-14 bg-[#FAFAFA] font-mono text-xs text-[#737373] border-t border-[#E5E5E5]">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <img
            src="/images/spilltrace_logo.png"
            alt="SPILLTRACE Logo"
            className="h-10 sm:h-12 w-auto object-contain flex-shrink-0 drop-shadow-xs"
          />
          <div>
            <div className="font-semibold text-[#111111] tracking-label text-sm uppercase font-sans">SPILLTRACE</div>
            <div className="text-xs font-mono text-[#737373] mt-0.5">Cleaner Oceans · Safer Tomorrows</div>
            <div className="text-[10px] font-mono text-[#888888] tracking-label uppercase mt-0.5">Decision-support system for maritime environmental forensics</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[11px] tracking-label uppercase">
          <span className="text-[#111111] font-medium">DATA PROVENANCE:</span>
          <span>ESA Copernicus (Sentinel-1)</span>
          <span>CMEMS Ocean Currents</span>
          <span>ECMWF ERA5 Winds</span>
          <span>Terrestrial + Satellite AIS</span>
        </div>
        <div className="text-[10px] text-[#888888] tracking-label uppercase">SYS.VER 5.5.0-REACT // 2026</div>
      </div>
    </footer>
  );
}
