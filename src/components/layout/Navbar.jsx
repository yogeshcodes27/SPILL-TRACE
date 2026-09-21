import React from 'react';

/**
 * Navbar — Minimal Floating Navigation Bar
 * Provides responsive branding, section / view switching, and open console CTA.
 */
export default function Navbar({
  activeTab,
  selectedIncident,
  onNavClick,
  onLogoClick,
  onOpenConsole,
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5] transition-all shadow-xs">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        
        {/* Logo Brand */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <button
            onClick={onLogoClick}
            className="group flex items-center gap-3 transition-opacity hover:opacity-90 cursor-pointer text-left py-0.5"
          >
            <img
              src="/images/spilltrace_logo.png"
              alt="SPILLTRACE Logo"
              className="h-10 sm:h-11 w-auto object-contain flex-shrink-0 drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="text-[#111111] font-semibold text-sm tracking-[0.14em] font-sans">
                  SPILLTRACE
                </span>
                <span className="text-[#D8D8D8] hidden sm:inline text-xs font-light">|</span>
                <span className="text-[#666666] font-mono text-[11px] tracking-label uppercase hidden sm:inline font-medium">
                  MARITIME INTELLIGENCE
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#888888] tracking-label uppercase hidden md:block mt-0.5">
                Cleaner Oceans · Safer Tomorrows
              </span>
            </div>
          </button>
        </div>

        {/* Nav Items — Lightweight Landing Page Navigation */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-[12px] font-medium tracking-label">
          <button
            onClick={() => onNavClick('overview')}
            className={`transition-all uppercase py-1 cursor-pointer relative ${
              activeTab === 'landing'
                ? 'text-[#111111] hover:text-black font-semibold'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            OVERVIEW
          </button>
          <button
            onClick={() => onNavClick('capabilities')}
            className="hover:text-black text-[#666666] transition-colors uppercase py-1 cursor-pointer"
          >
            CAPABILITIES
          </button>
          <button
            onClick={() => onNavClick('workflow')}
            className="hover:text-black text-[#666666] transition-colors uppercase py-1 cursor-pointer"
          >
            WORKFLOW
          </button>
          <button
            onClick={() => onNavClick('technology')}
            className="hover:text-black text-[#666666] transition-colors uppercase py-1 cursor-pointer"
          >
            TECHNOLOGY
          </button>
          <button
            onClick={() => onNavClick('scenarios')}
            className={`transition-all uppercase py-1 cursor-pointer relative ${
              activeTab === 'incidents'
                ? 'text-[#111111] font-semibold border-b-2 border-[#111111]'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            SCENARIOS
          </button>
        </nav>

        {/* Primary Action: OPEN INVESTIGATION WORKSPACE */}
        <div className="flex items-center pl-2 sm:pl-4">
          <button
            onClick={onOpenConsole}
            className="px-3.5 sm:px-4 py-2 border border-[#111111] text-[#111111] bg-white hover:bg-[#111111] hover:text-white transition-all uppercase tracking-label text-[11px] font-medium flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap"
            title={`Open operational workspace for ${selectedIncident?.id || 'case'}`}
          >
            <span>OPEN INVESTIGATION WORKSPACE</span>
            <span className="font-semibold">→</span>
          </button>
        </div>
      </div>
    </header>
  );
}
