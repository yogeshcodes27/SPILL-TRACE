import React, { useState, useEffect, useRef } from 'react';

/**
 * SPILLTRACE — Forensic Timeline Component
 *
 * Interactive timeline scrubber for geospatial forensic maps.
 * Variants:
 * - 'origin': -48h to +72h with Past (yellow), Observed (red), Forecast (blue) markers
 * - 'detection': 00:00 to 24:00 SAR acquisition period
 * - 'attribution': -48h to +48h candidate vessel transit window
 */
export default function ForensicTimeline({
  variant = 'origin',
  baseTime = '2024-06-15T05:42:00Z',
  currentOffset = 0,
  onChange,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [internalOffset, setInternalOffset] = useState(currentOffset);
  const intervalRef = useRef(null);

  // Sync internal offset when prop changes externally
  useEffect(() => {
    setInternalOffset(currentOffset);
  }, [currentOffset]);

  // Determine bounds and ticks based on variant
  let min = -48;
  let max = 72;
  let ticks = [-48, -36, -24, -12, 0, 12, 24, 36, 48, 72];
  let tickLabels = {
    '-48': '-48h',
    '-36': '-36h',
    '-24': '-24h',
    '-12': '-12h',
    '0': '0h',
    '12': '+12h',
    '24': '+24h',
    '36': '+36h',
    '48': '+48h',
    '72': '+72h',
  };

  if (variant === 'detection') {
    min = 0;
    max = 24;
    ticks = [0, 6, 12, 18, 24];
    tickLabels = {
      '0': '00:00',
      '6': '06:00',
      '12': '12:00',
      '18': '18:00',
      '24': '24:00',
    };
  } else if (variant === 'attribution') {
    min = -48;
    max = 48;
    ticks = [-48, -36, -24, -12, 0, 12, 24, 36, 48];
    tickLabels = {
      '-48': '-48h',
      '-36': '-36h',
      '-24': '-24h',
      '-12': '-12h',
      '0': '0h',
      '12': '+12h',
      '24': '+24h',
      '36': '+36h',
      '48': '+48h',
    };
  }

  // Calculate formatted current timestamp
  const calculateDisplayTime = () => {
    try {
      const base = new Date(baseTime);
      if (isNaN(base.getTime())) {
        return '2024-06-15 05:42 UTC';
      }
      const targetTime = new Date(base.getTime() + internalOffset * 3600 * 1000);
      const yyyy = targetTime.getUTCFullYear();
      const mm = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(targetTime.getUTCDate()).padStart(2, '0');
      const hh = String(targetTime.getUTCHours()).padStart(2, '0');
      const minStr = String(targetTime.getUTCMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${minStr} UTC`;
    } catch (e) {
      return '2024-06-15 05:42 UTC';
    }
  };

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setInternalOffset((prev) => {
          let next = prev + (variant === 'detection' ? 0.5 : 1);
          if (next > max) next = min;
          if (onChange) onChange(next);
          return next;
        });
      }, 700);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, min, max, variant, onChange]);

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setInternalOffset(val);
    if (onChange) onChange(val);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Percentage for current thumb position along track
  const progressPercent = ((internalOffset - min) / (max - min)) * 100;

  return (
    <div className="w-full max-w-2xl bg-[#0B131E] border border-[#1E293B] px-4 py-2.5 shadow-2xl shadow-black/90 text-white font-mono select-none">
      {/* Top Legend Pills (Origin Reconstruction variant) */}
      {variant === 'origin' && (
        <div className="flex items-center justify-end gap-3.5 mb-2 text-[10px] text-white/80 font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308] inline-block shadow-xs" />
            <span className="font-medium text-white/90">Past (Backward Drift)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block shadow-xs" />
            <span className="font-medium text-white/90">Observed (Detection)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] inline-block shadow-xs" />
            <span className="font-medium text-white/90">Forecast (Forward Drift)</span>
          </div>
        </div>
      )}

      {/* Main Scrubber Control Row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95"
          title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-white translate-x-0.5" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Current Active Timestamp Display */}
        <div className="text-[12px] font-bold text-white shrink-0 tracking-wide font-mono px-2 py-0.5 bg-black/40 border border-white/10">
          {calculateDisplayTime()}
        </div>

        {/* Track and Slider */}
        <div className="flex-1 relative flex flex-col justify-center">
          <div className="relative w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                variant === 'origin'
                  ? internalOffset < 0
                    ? 'bg-[#EAB308]'
                    : internalOffset === 0
                    ? 'bg-[#EF4444]'
                    : 'bg-[#38BDF8]'
                  : 'bg-[#38BDF8]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={variant === 'detection' ? 0.25 : 0.5}
            value={internalOffset}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {/* Indicator Pip on Track */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-[#0B131E] rounded-full pointer-events-none shadow-md"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>
      </div>

      {/* Tick Labels */}
      <div className="flex justify-between items-center mt-2 px-1 text-[9px] text-white/50 font-mono">
        {ticks.map((t) => (
          <span
            key={t}
            onClick={() => {
              setInternalOffset(t);
              if (onChange) onChange(t);
            }}
            className={`cursor-pointer hover:text-white transition-colors ${
              Math.abs(internalOffset - t) < 3 ? 'text-white font-bold' : ''
            }`}
          >
            {tickLabels[String(t)] || `${t}h`}
          </span>
        ))}
      </div>
    </div>
  );
}
