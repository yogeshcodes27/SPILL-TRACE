import React from 'react';

/**
 * SpilltraceLogo — Official Brand Logo for SPILLTRACE
 * 
 * Renders the project's official brand logo:
 * - Orbital SAR satellite with sensor beam
 * - Maritime vessel tracking oil slick waters
 * - Stylized ocean fluid waves
 * - Custom SPILLTRACE typography with marine wave in 'A'
 * - Tagline: "CLEANER OCEANS SAFER TOMORROWS"
 * 
 * Supports:
 * - variant='full' (default): complete brand logo with typography & tagline
 * - variant='emblem': circular satellite-vessel-waves emblem only (ideal for icons/badges)
 */
export default function SpilltraceLogo({
  size = 44,
  variant = 'full',
  className = '',
  withText = false,
  subtitle = 'MARITIME INTELLIGENCE',
  inverted = false,
}) {
  const imgSrc = variant === 'emblem' 
    ? '/images/spilltrace_emblem.png' 
    : '/images/spilltrace_logo.png';

  const pixelHeight = typeof size === 'number' ? `${size}px` : size;

  const imageElement = (
    <img
      src={imgSrc}
      alt="SPILLTRACE — Cleaner Oceans Safer Tomorrows"
      style={{ height: pixelHeight, width: 'auto' }}
      className={`object-contain flex-shrink-0 transition-transform duration-200 group-hover:scale-105 select-none ${
        inverted ? 'brightness-110 drop-shadow-[0_2px_10px_rgba(56,189,248,0.35)]' : 'drop-shadow-xs'
      } ${className}`}
      loading="eager"
    />
  );

  if (!withText) {
    return imageElement;
  }

  const fgColor = inverted ? 'text-white' : 'text-[#111111]';
  const subColor = inverted ? 'text-white/70' : 'text-[#666666]';
  const dividerColor = inverted ? 'text-white/30' : 'text-[#D8D8D8]';

  return (
    <div className={`group inline-flex items-center gap-3 cursor-pointer select-none ${className}`}>
      {imageElement}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={`tracking-[0.18em] font-bold uppercase text-xs sm:text-sm font-sans ${fgColor}`}>
          SPILLTRACE
        </span>
        {subtitle && (
          <>
            <span className={`hidden md:inline text-xs font-light ${dividerColor}`}>|</span>
            <span className={`font-mono text-[11px] tracking-wider uppercase hidden md:inline font-medium ${subColor}`}>
              {subtitle}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
