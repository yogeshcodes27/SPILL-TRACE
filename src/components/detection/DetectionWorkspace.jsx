import React, { useState } from 'react';
import { INITIAL_INCIDENTS } from '../../data/incidentsData';
import SpilltraceLogo from '../common/SpilltraceLogo';

/**
 * DetectionWorkspace — "02 / DETECTION // FIND THE SIGNAL"
 * 
 * Operational satellite-analysis workspace inside the SPILLTRACE maritime intelligence application.
 * Processes Sentinel-1 SAR imagery through the oil-spill detection pipeline:
 * RAW SAR → PREPROCESSING → SEGMENTATION → LOOK-ALIKE CHECK → VERIFIED SLICK
 */

const ANALYSIS_STATES = [
  {
    id: 'raw',
    number: '01',
    label: 'RAW SAR',
    title: 'SATELLITE ACQUISITION',
    image: '/images/layers/layer1_raw_sar.jpg',
    annotation: 'DARK SIGNATURE DETECTED',
    annotationDetail: 'Pre-classification // σ₀ backscatter depression: -8.2 dB (VV). Surface ripple damping observed.',
    quality: 'NOMINAL · NO IONOSPHERIC DISTORTION',
  },
  {
    id: 'segmentation',
    number: '02',
    label: 'SEGMENTATION',
    title: 'CANDIDATE SLICK EXTRACTION',
    image: '/images/layers/layer2_segmentation.jpg',
    annotation: 'OIL-LIKE REGION',
    annotationDetail: 'Atrous Spatial Pyramid Pooling isolated 3 anomalous candidate depressions in radar tile.',
    confidence: '87%',
    candidateArea: '18.4 km²',
  },
  {
    id: 'lookalike',
    number: '03',
    label: 'LOOK-ALIKE CHECK',
    title: 'POLARIMETRIC & CONTEXTUAL SCREENING',
    image: '/images/layers/layer3_lookalike_check.jpg',
    annotation: 'MULTI-TARGET SCREENING',
    annotationDetail: 'Dark does not automatically mean oil. Atmospheric calm shadows and vessel wake shear screened out.',
    classifications: [
      { id: 'R01', name: 'REGION 01', type: 'CANDIDATE OIL', status: 'VERIFIED', conf: '87%' },
      { id: 'R02', name: 'REGION 02', type: 'LOW-WIND SHADOW', status: 'REJECTED', conf: 'ERA5 < 2.5 kn' },
      { id: 'R03', name: 'REGION 03', type: 'VESSEL WAKE SHEAR', status: 'REJECTED', conf: 'Collinear with track' },
    ],
  },
  {
    id: 'verified',
    number: '04',
    label: 'VERIFIED SLICK',
    title: 'CONFIRMED FORENSIC MASK',
    image: '/images/layers/layer4_verified_mask.jpg',
    annotation: 'VERIFIED SLICK',
    annotationDetail: 'False positives discarded. Calibrated hydrocarbon footprint ready for hydrodynamic hindcast.',
    confidence: '87%',
    area: '18.4 km²',
    status: 'READY FOR CHARACTERISATION',
  },
];

export default function DetectionWorkspace({
  selectedIncident,
  onSelectIncident,
  onNavigateToGeometry,
  onNavigateToIncidents,
  onOpenConsole,
}) {
  const [analysisStateIndex, setAnalysisStateIndex] = useState(0);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [imageZoom, setImageZoom] = useState(false);

  const activeState = ANALYSIS_STATES[analysisStateIndex];
  const incident = selectedIncident || INITIAL_INCIDENTS[0];
  const detectionConfidence = incident?.confidence ? incident.confidence.split(' ')[0] : '96.4%';
  const slickArea = incident?.area || '18.42 km²';

  return (
    <div className="py-8 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-8 bg-white text-[#111111] font-sans border-b border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto">

        {/* ================================================================== */}
        {/* TOP OPERATIONAL BREADCRUMB & METADATA STRIP */}
        {/* ================================================================== */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-[11px] border-b border-[#EAEAEA] pb-3 text-[#666666]">
          
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToIncidents ? (
              <button
                onClick={onNavigateToIncidents}
                className="hover:text-black transition-colors uppercase font-medium cursor-pointer text-[#444444]"
              >
                01 / INCIDENTS
              </button>
            ) : (
              <span className="uppercase text-[#888888]">01 / INCIDENTS</span>
            )}
            <span>/</span>
            <span className="text-[#111111] font-bold uppercase">02 / DETECTION WORKSPACE</span>
            <span>/</span>
            <span className="text-[#888888]">CASE: {incident.id} ({incident.basin})</span>
          </div>

          {/* Upper Telemetric Metadata Strip */}
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] flex-wrap">
            <div>
              <span className="text-[#888888] mr-1">SATELLITE:</span>
              <span className="font-semibold text-[#111111]">Sentinel-1A</span>
            </div>
            <span className="text-[#D0D0D0]">|</span>
            <div>
              <span className="text-[#888888] mr-1">SENSOR:</span>
              <span className="font-semibold text-[#111111]">C-SAR</span>
            </div>
            <span className="text-[#D0D0D0]">|</span>
            <div>
              <span className="text-[#888888] mr-1">ACQUISITION:</span>
              <span className="font-semibold text-[#111111]">08:42 UTC</span>
            </div>
            <span className="text-[#D0D0D0]">|</span>
            <div>
              <span className="text-[#888888] mr-1">POLARISATION:</span>
              <span className="font-semibold text-[#111111]">VV</span>
            </div>
            <span className="text-[#D0D0D0]">|</span>
            <div>
              <span className="text-[#888888] mr-1">LOCATION:</span>
              <span className="font-semibold text-[#111111]">{incident.coordinates}</span>
            </div>
            <span className="text-[#D0D0D0]">|</span>
            <div>
              <span className="text-[#888888] mr-1">STATUS:</span>
              <span className="font-bold text-[#111111] bg-[#EFEFEF] px-1.5 py-0.5">ANALYSIS READY</span>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* HEADER: Title & Technical Summary */}
        {/* ================================================================== */}
        <div className="mb-8 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E5E5]">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-mega text-[#888888] mb-2 flex items-center gap-2.5">
              <SpilltraceLogo size={20} variant="emblem" />
              02 / DETECTION
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight uppercase leading-[0.92] text-[#111111]">
              FIND THE SIGNAL.
            </h1>
            <p className="font-mono text-xs sm:text-sm text-[#555555] mt-3 leading-relaxed font-light">
              Detect oil-like signatures in satellite imagery, reject look-alikes, and isolate the verified slick.
            </p>
          </div>

          {/* Workflow Stage Sequence Indicator */}
          <div className="font-mono text-[10px] sm:text-[11px] bg-[#FAFAFA] border border-[#E5E5E5] p-3 w-full lg:w-auto">
            <div className="text-[#888888] uppercase text-[9px] font-bold mb-1.5">
              DETECTION PIPELINE SEQUENCE:
            </div>
            <div className="flex items-center gap-1.5 text-[#555555] flex-wrap">
              <span className={analysisStateIndex >= 0 ? 'text-[#111111] font-bold' : ''}>ACQUIRE</span>
              <span>→</span>
              <span className={analysisStateIndex >= 1 ? 'text-[#111111] font-bold' : ''}>PROCESS</span>
              <span>→</span>
              <span className={analysisStateIndex >= 2 ? 'text-[#111111] font-bold' : ''}>DETECT</span>
              <span>→</span>
              <span className={analysisStateIndex >= 2 ? 'text-[#111111] font-bold' : ''}>VERIFY</span>
              <span>→</span>
              <span className={analysisStateIndex >= 3 ? 'text-black font-bold bg-[#E5E5E5] px-1' : ''}>CONFIRM</span>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MAIN SATELLITE ANALYSIS VIEW (DOMINATES THE PAGE) */}
        {/* ================================================================== */}
        <div className="mb-10 border border-[#E5E5E5] bg-white shadow-xs">
          
          {/* Analysis State Selector Toolbar */}
          <div className="bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-xs">
            
            {/* 4 Discrete Analysis States */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider mr-2 hidden sm:inline">
                PIPELINE STATE:
              </span>
              {ANALYSIS_STATES.map((st, idx) => (
                <button
                  key={st.id}
                  onClick={() => setAnalysisStateIndex(idx)}
                  className={`px-3 py-1.5 uppercase font-semibold text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                    analysisStateIndex === idx
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#555555] hover:text-[#111111] border-[#CCCCCC] hover:border-[#999999]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 ${analysisStateIndex === idx ? 'bg-white' : 'bg-[#888888]'}`} />
                  <span>{st.number} // {st.label}</span>
                </button>
              ))}
            </div>

            {/* View Utility Controls */}
            <div className="flex items-center gap-3 text-[11px] self-end md:self-auto text-[#666666]">
              <button
                onClick={() => setImageZoom(!imageZoom)}
                className="px-2.5 py-1 border border-[#CCCCCC] bg-white hover:border-[#111111] text-[#333333] hover:text-[#111111] text-[10px] uppercase tracking-wider cursor-pointer"
              >
                {imageZoom ? '100% EXTENT' : '150% MAGNIFY'}
              </button>
              <span className="text-[#CCCCCC]">|</span>
              <span className="text-[#888888] text-[10px]">
                PASS 148 · DESCENDING · C-SAR
              </span>
            </div>
          </div>

          {/* Large Satellite SAR Image Viewer */}
          <div className="relative w-full bg-[#0C0D0E] overflow-hidden min-h-[460px] sm:min-h-[580px] lg:min-h-[640px] flex items-center justify-center select-none">
            
            {/* The Authentic Sentinel-1 SAR Imagery Texture */}
            <div className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${imageZoom ? 'scale-125' : 'scale-100'}`}>
              <img
                src={activeState.image}
                alt={activeState.title}
                className="w-full h-auto max-h-[720px] object-contain block mx-auto brightness-95 contrast-105"
              />

              {/* Spatial Graticule Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 600" preserveAspectRatio="none">
                <g stroke="#333A42" strokeDasharray="3,6" strokeWidth="0.75" opacity="0.45">
                  <line x1="200" x2="200" y1="0" y2="600" />
                  <line x1="500" x2="500" y1="0" y2="600" />
                  <line x1="800" x2="800" y1="0" y2="600" />
                  <line x1="0" x2="1000" y1="150" y2="150" />
                  <line x1="0" x2="1000" y1="300" y2="300" />
                  <line x1="0" x2="1000" y1="450" y2="450" />
                </g>
                <text x="20" y="30" fill="#667085" fontFamily="monospace" fontSize="10">11°15'00"N / 79°48'00"E</text>
                <text x="830" y="30" fill="#667085" fontFamily="monospace" fontSize="10">ORBIT 6102 · FRAME 048</text>
              </svg>
            </div>

            {/* Overlaid Annotation: State 01 (RAW SAR) */}
            {analysisStateIndex === 0 && (
              <div className="absolute top-4 left-4 max-w-sm bg-[#111111]/90 backdrop-blur-xs border border-white/20 p-3.5 text-white font-mono text-xs shadow-lg">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                  <span className="text-[#00FFCC] font-bold tracking-wider text-[10px] uppercase">
                    [01] SAR PREPROCESSING
                  </span>
                  <span className="text-[#AAAAAA] text-[9px]">RAW RADIOMETRIC TILE</span>
                </div>
                <div className="text-white font-semibold text-sm tracking-tight mb-1">
                  DARK SIGNATURE DETECTED
                </div>
                <p className="text-[#B0B7C3] text-[11px] leading-relaxed mb-2 font-light">
                  Capillary ocean wave damping observed in backscatter profile. Pre-classification anomaly: atmospheric calm, biogenic film, or hydrocarbon discharge.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/10 text-[9px] text-[#888888]">
                  <div>σ₀ DEPRESSION: <span className="text-white font-bold">-8.2 dB</span></div>
                  <div>SCENE QUALITY: <span className="text-white font-bold">NOMINAL</span></div>
                </div>
              </div>
            )}

            {/* Overlaid Annotation: State 02 (SEGMENTATION) */}
            {analysisStateIndex === 1 && (
              <div className="absolute top-4 left-4 max-w-sm bg-[#111111]/90 backdrop-blur-xs border border-white/20 p-3.5 text-white font-mono text-xs shadow-lg">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                  <span className="text-cyan-400 font-bold tracking-wider text-[10px] uppercase">
                    [02] MODEL SEGMENTATION
                  </span>
                  <span className="text-[#AAAAAA] text-[9px]">RESNET-101 / ASPP</span>
                </div>
                <div className="text-white font-semibold text-sm tracking-tight mb-1">
                  OIL-LIKE REGION EXTRACTED
                </div>
                <div className="grid grid-cols-2 gap-2 my-2 p-2 bg-black/50 border border-white/10 text-[10px]">
                  <div>
                    <span className="text-[#888888] block text-[9px]">DETECTION CONFIDENCE</span>
                    <span className="font-bold text-white text-base">{detectionConfidence}</span>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[9px]">CANDIDATE AREA</span>
                    <span className="font-bold text-white text-base">{slickArea}</span>
                  </div>
                </div>
                <div className="text-[10px] text-[#A0AEC0] leading-tight">
                  Multiscale boundary isolation confirmed across primary anomaly. Secondary patches flagged for look-alike verification.
                </div>
              </div>
            )}

            {/* Overlaid Annotation: State 03 (LOOK-ALIKE CHECK) */}
            {analysisStateIndex === 2 && (
              <div className="absolute top-4 left-4 max-w-md bg-[#111111]/90 backdrop-blur-xs border border-white/20 p-3.5 text-white font-mono text-xs shadow-lg">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                  <span className="text-amber-400 font-bold tracking-wider text-[10px] uppercase">
                    [03] LOOK-ALIKE VERIFICATION
                  </span>
                  <span className="text-[#AAAAAA] text-[9px]">DUAL-POL ENTROPY H</span>
                </div>
                <div className="text-white font-semibold text-xs uppercase mb-2">
                  DARK DOES NOT AUTOMATICALLY MEAN OIL
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between p-1.5 bg-white/5 border border-white/10">
                    <span className="text-white font-bold">REGION 01 · CANDIDATE OIL</span>
                    <span className="text-emerald-400 font-bold">✓ VERIFIED ({detectionConfidence})</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-white/5 opacity-60">
                    <span className="text-[#CCCCCC]">REGION 02 · LOW-WIND SIGNATURE</span>
                    <span className="text-rose-400 font-semibold">✕ REJECTED (CALM)</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-white/5 opacity-60">
                    <span className="text-[#CCCCCC]">REGION 03 · VESSEL WAKE SHEAR</span>
                    <span className="text-rose-400 font-semibold">✕ REJECTED (TRACK)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Overlaid Annotation: State 04 (VERIFIED SLICK) */}
            {analysisStateIndex === 3 && (
              <div className="absolute top-4 left-4 max-w-sm bg-[#111111]/95 backdrop-blur-xs border-2 border-white/30 p-4 text-white font-mono text-xs shadow-2xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                  <span className="text-emerald-400 font-bold tracking-wider text-[10px] uppercase">
                    [04] CONFIRMED RESULT
                  </span>
                  <span className="text-white/60 text-[9px]">GEOMETRY INPUT READY</span>
                </div>
                <div className="text-white font-bold text-lg tracking-tight uppercase">
                  VERIFIED SLICK
                </div>
                <div className="grid grid-cols-2 gap-2 my-2.5 p-2 bg-black/60 border border-white/10">
                  <div>
                    <span className="text-[#888888] block text-[9px] uppercase">CONFIDENCE</span>
                    <span className="font-bold text-white text-base">{detectionConfidence}</span>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[9px] uppercase">VERIFIED AREA</span>
                    <span className="font-bold text-white text-base">{slickArea}</span>
                  </div>
                </div>
                <div className="text-[10px] text-[#AAAAAA] mb-3">
                  STATUS: <span className="text-white font-bold">READY FOR CHARACTERISATION</span>
                </div>
                {onNavigateToGeometry && (
                  <button
                    onClick={onNavigateToGeometry}
                    className="w-full py-2 bg-white text-[#111111] hover:bg-[#EAEAEA] transition-all uppercase tracking-wider font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>CONTINUE TO GEOMETRY</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            )}

            {/* Bottom In-Image Telemetry Bar */}
            <div className="absolute bottom-3 left-4 right-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-[10px] text-[#A0AEC0] bg-[#0A0B0D]/85 backdrop-blur-xs p-2.5 border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold uppercase">{activeState.title}</span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span className="hidden sm:inline">{activeState.annotationDetail}</span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto text-[9px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-semibold">SENTINEL-1 C-SAR INTERFEROMETRIC WIDE</span>
              </div>
            </div>

          </div>

          {/* Image Caption & Stage Description Strip */}
          <div className="p-4 bg-white border-t border-[#E5E5E5] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs">
            <div className="max-w-2xl">
              <span className="font-bold text-[#111111] uppercase mr-2">
                ANALYSIS STAGE {activeState.number} // {activeState.label}:
              </span>
              <span className="text-[#555555]">
                {analysisStateIndex === 0 && 'Original Sentinel-1-style SAR scene. Dark backscatter depression detected, unclassified.'}
                {analysisStateIndex === 1 && 'Model-generated candidate segmentation mask applied over anomalous depression.'}
                {analysisStateIndex === 2 && 'Contextual and polarimetric screening of candidate regions: dark does not automatically mean oil.'}
                {analysisStateIndex === 3 && 'Final verified hydrocarbon slick mask isolated. Look-alike false positives discarded.'}
              </span>
            </div>
            
            {/* Step forward button */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              {analysisStateIndex < ANALYSIS_STATES.length - 1 ? (
                <button
                  onClick={() => setAnalysisStateIndex((s) => s + 1)}
                  className="px-3.5 py-1.5 bg-[#111111] text-white hover:bg-black transition-all uppercase tracking-wider font-bold text-[11px] cursor-pointer flex items-center gap-1.5"
                >
                  <span>NEXT STAGE</span>
                  <span>→</span>
                </button>
              ) : onNavigateToGeometry ? (
                <button
                  onClick={onNavigateToGeometry}
                  className="px-4 py-1.5 bg-[#111111] text-white hover:bg-black transition-all uppercase tracking-wider font-bold text-[11px] cursor-pointer flex items-center gap-1.5"
                >
                  <span>CONTINUE TO GEOMETRY</span>
                  <span>→</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* DETECTION + VERIFICATION RESULTS & LOOK-ALIKE AUDIT (2 COLUMNS) */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-start">
          
          {/* Left / Result Panel: DETECTION RESULT (5 cols on lg) */}
          <div className="lg:col-span-5 border border-[#E5E5E5] bg-[#FAFAFA] p-5 font-mono text-xs shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAEAEA] mb-4">
              <div>
                <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
                  SUMMARY ASSESSMENT
                </span>
                <h3 className="text-xl font-bold uppercase text-[#111111]">
                  DETECTION RESULT
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-[#111111] text-white font-bold text-[10px] uppercase tracking-wider">
                VERIFIED SLICK
              </span>
            </div>

            {/* Metrics List */}
            <div className="space-y-2.5 text-[11px]">
              <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                <span className="text-[#666666]">CONFIDENCE:</span>
                <span className="font-bold text-[#111111]">{detectionConfidence} (High Probability)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                <span className="text-[#666666]">CANDIDATE REGIONS SCREENED:</span>
                <span className="font-bold text-[#111111]">03</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                <span className="text-[#666666]">VERIFIED OIL REGIONS:</span>
                <span className="font-bold text-[#111111]">01 (Region 01)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                <span className="text-[#666666]">DERIVED SLICK AREA:</span>
                <span className="font-bold text-[#111111]">{slickArea}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EAEAEA]">
                <span className="text-[#666666]">LOOK-ALIKE CHECK:</span>
                <span className="font-bold text-[#111111]">PASSED (2 False Positives Rejected)</span>
              </div>
              <div className="flex justify-between pt-1 text-[#666666]">
                <span>DOWNSTREAM STAGE:</span>
                <span className="font-bold text-[#111111]">02 / GEOMETRY CHARACTERISATION</span>
              </div>
            </div>

            {/* Bottom Next Action */}
            <div className="mt-5 pt-4 border-t border-[#EAEAEA] space-y-2">
              {onNavigateToGeometry && (
                <button
                  onClick={onNavigateToGeometry}
                  className="w-full py-2.5 bg-[#111111] text-white hover:bg-black transition-all uppercase tracking-wider font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>TRANSFER VERIFIED SLICK TO GEOMETRY</span>
                  <span>→</span>
                </button>
              )}
              {onOpenConsole && (
                <button
                  onClick={onOpenConsole}
                  className="w-full py-2.5 bg-white border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-all uppercase tracking-wider font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>LAUNCH INVESTIGATION CONSOLE</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>

          {/* Right / Secondary: LOOK-ALIKE VERIFICATION LEDGER (7 cols on lg) */}
          <div className="lg:col-span-7 border border-[#E5E5E5] bg-white p-5 font-mono text-xs shadow-2xs">
            <div className="pb-3 border-b border-[#EAEAEA] mb-3">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
                POLARIMETRIC FALSE POSITIVE REJECTION
              </span>
              <h3 className="text-xl font-bold uppercase text-[#111111]">
                LOOK-ALIKE VERIFICATION
              </h3>
              <p className="text-[11px] text-[#666666] mt-1 leading-relaxed font-light">
                Dark SAR signatures can also arise from low wind, natural films, rain effects, and vessel wakes. Candidate regions are screened before final confirmation.
              </p>
            </div>

            {/* Candidate Region Comparison Table */}
            <div className="border border-[#E5E5E5] overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-[9px] text-[#888888] uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">CANDIDATE REGION</th>
                    <th className="py-2.5 px-3 font-semibold">ANALYSIS PROFILE</th>
                    <th className="py-2.5 px-3 font-semibold text-right">VERIFICATION RESULT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA] text-[11px]">
                  {/* Region 01: Verified Oil */}
                  <tr className="bg-[#F9FBF9] font-medium">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-[#111111]">REGION 01</div>
                      <div className="text-[10px] text-[#777777]">{incident.coordinates}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#111111]">Candidate mineral oil</div>
                      <div className="text-[10px] text-[#666666] leading-tight">
                        Sharp damping boundary, major axis 21.8 km, high spatial contrast.
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-[#111111] text-white text-[10px] font-bold uppercase">
                        ✓ VERIFIED ({detectionConfidence})
                      </span>
                    </td>
                  </tr>

                  {/* Region 02: Low-Wind Shadow */}
                  <tr className="text-[#666666] opacity-80">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-[#555555]">REGION 02</div>
                      <div className="text-[10px] text-[#888888]">11.295°N, 79.710°E</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[#444444]">Low-wind calm shadow</div>
                      <div className="text-[10px] text-[#777777] leading-tight">
                        Wind speed &lt; 2.5 kn. Diffuse boundaries, lack of localized apex.
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 border border-[#CCCCCC] text-[#666666] text-[10px] font-bold uppercase">
                        ✕ REJECTED
                      </span>
                    </td>
                  </tr>

                  {/* Region 03: Vessel Wake Shear */}
                  <tr className="text-[#666666] opacity-80">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-[#555555]">REGION 03</div>
                      <div className="text-[10px] text-[#888888]">11.190°N, 79.880°E</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[#444444]">Vessel wake / shear line</div>
                      <div className="text-[10px] text-[#777777] leading-tight">
                        Linear narrow stripe collinear with container shipping corridor.
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 border border-[#CCCCCC] text-[#666666] text-[10px] font-bold uppercase">
                        ✕ REJECTED
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-[10px] text-[#888888] flex items-center justify-between">
              <span>ALGORITHM: ATROUS RECEPTIVE FIELD + POLARIMETRIC ENTROPY FILTER</span>
              <span className="font-semibold text-[#111111]">CONFIDENCE THRESHOLD: 75%</span>
            </div>
          </div>

        </div>

        {/* ================================================================== */}
        {/* COLLAPSIBLE SATELLITE METADATA & DATA PROVENANCE */}
        {/* ================================================================== */}
        <div className="border border-[#E5E5E5] bg-[#FAFAFA] font-mono text-xs">
          <div
            onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#F0F0F0] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#111111] uppercase tracking-wider text-[11px]">
                SATELLITE TELEMETRY &amp; PROVENANCE METADATA
              </span>
              <span className="text-[10px] text-[#888888]">
                [SENTINEL-1A · ESA COPERNICUS]
              </span>
            </div>
            <span className="text-[11px] text-[#555555] font-bold">
              {isMetadataExpanded ? 'HIDE METADATA ▲' : 'EXPAND DETAILS ▼'}
            </span>
          </div>

          {isMetadataExpanded && (
            <div className="p-4 border-t border-[#E5E5E5] bg-white grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-[11px]">
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">SATELLITE PLATFORM</span>
                <span className="font-bold text-[#111111]">Sentinel-1A (ESA)</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">SENSOR SYSTEM</span>
                <span className="font-bold text-[#111111]">C-Band SAR (5.405 GHz)</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">ACQUISITION TIME</span>
                <span className="font-bold text-[#111111]">08:42 UTC (17 SEP 2026)</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">POLARISATION MODE</span>
                <span className="font-bold text-[#111111]">VV Dual-Pol</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">SCENE IDENTIFIER</span>
                <span className="font-bold text-[#111111] break-all">S1A_IW_GRDH_1SDV_20260917T064218</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">SPATIAL RESOLUTION</span>
                <span className="font-bold text-[#111111]">10m / pixel (IW Mode)</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">CENTROID COORDINATES</span>
                <span className="font-bold text-[#111111]">{incident.coordinates}</span>
              </div>
              <div>
                <span className="text-[9px] text-[#888888] block uppercase">IMAGE CALIBRATION</span>
                <span className="font-bold text-emerald-700">GOOD (Nominal Sigma-0)</span>
              </div>
            </div>
          )}

          {/* REST API Contract Guidance for Backend Integration */}
          <div className="px-4 py-2 bg-[#F4F4F4] border-t border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-[#777777]">
            <div>
              EXPECTED CONTRACT: <span className="text-[#111111] font-semibold">GET /incidents/{incident.id}/detection</span> · <span className="text-[#111111] font-semibold">POST /detect-slick</span>
            </div>
            <div className="text-[9px] font-bold text-[#999999] uppercase">
              DEMO DATA · SYNTHETIC RADAR MOCK (STAC-API READY)
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
