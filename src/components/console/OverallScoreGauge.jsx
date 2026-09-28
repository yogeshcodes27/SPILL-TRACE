import React from 'react';

/**
 * SPILLTRACE — Overall Attribution Score Radial Gauge
 *
 * Reproduces the circular score gauge and evidentiary likelihood badge from Reference 3.
 */
export default function OverallScoreGauge({
  score = 0.87,
  maxScore = 1.0,
  likelihoodLabel = 'High Likelihood',
  summary = 'Strong spatial, temporal and behavioural evidence that this vessel is linked to the oil spill.',
}) {
  const normScore = Math.max(0, Math.min(1.0, score / maxScore));
  const radius = 32;
  const strokeWidth = 5.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - normScore * circumference;

  const getStatusColor = () => {
    if (normScore >= 0.75) return '#10B981'; // emerald
    if (normScore >= 0.45) return '#F59E0B'; // amber
    return '#EF4444'; // rose/red
  };

  const statusColor = getStatusColor();

  return (
    <div className="bg-[#0B131E]/60 border border-white/10 p-3 rounded-xs font-mono">
      <div className="text-[10px] uppercase tracking-wider text-[#888888] font-semibold mb-2.5 pb-1 border-b border-white/10">
        Overall Attribution Score
      </div>

      <div className="flex items-center gap-3.5">
        {/* Circular SVG Donut Gauge */}
        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
          <svg className="w-20 h-20 -rotate-90 transform" viewBox="0 0 80 80">
            {/* Background Track */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke={statusColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Centered Score Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-bold text-white font-mono leading-none tracking-tight">
              {normScore.toFixed(2)}
            </span>
            <span className="text-[9px] text-white/50 font-mono mt-0.5">
              /1.00
            </span>
          </div>
        </div>

        {/* Likelihood Classification & Summary */}
        <div className="flex-1 space-y-1.5 font-sans">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono uppercase tracking-wider"
            style={{
              backgroundColor: `${statusColor}18`,
              borderColor: `${statusColor}50`,
              color: statusColor,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
            <span>{likelihoodLabel}</span>
          </div>

          <p className="text-[11px] text-[#A0AEC0] leading-snug font-normal line-clamp-3">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}
