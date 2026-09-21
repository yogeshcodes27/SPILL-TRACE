import React from 'react';

/**
 * WorkflowSection — Visual 7-Stage Maritime Investigation Sequence
 * 
 * Explains the complete forensic chain from satellite radar acquisition
 * to candidate vessel attribution and legal dossier export.
 */
export default function WorkflowSection({ onOpenConsole }) {
  const steps = [
    {
      number: '01',
      title: 'Satellite Observation',
      subtitle: 'Sentinel-1 SAR Ingestion',
      description: 'Ingest calibrated C-SAR level-1 GRD imagery under all-weather and day/night marine conditions.',
      metric: '10m Spatial Resolution',
    },
    {
      number: '02',
      title: 'Oil-Spill Detection',
      subtitle: 'Geospatial Segmentation',
      description: 'Delineate irregular hydrocarbon film boundaries while filtering look-alikes like low-wind calm and ship wakes.',
      metric: '> 92% Rejection Rate',
    },
    {
      number: '03',
      title: 'Slick Characterization',
      subtitle: 'Morphological Aging',
      description: 'Compute 2D dispersion geometry, major/minor spreading axes, orientation, compactness, and aspect ratio.',
      metric: '8 Spatial Descriptors',
    },
    {
      number: '04',
      title: 'Drift Backcast',
      subtitle: 'Lagrangian Hindcasting',
      description: 'Advect virtual particles backward in time driven by coupled ERA5 wind leeway and CMEMS surface ocean currents.',
      metric: '−6h to −24h Windows',
    },
    {
      number: '05',
      title: 'AIS Correlation',
      subtitle: 'Vessel Trajectory Match',
      description: 'Correlate directional historical AIS tracks against the reconstructed origin uncertainty region and release window.',
      metric: 'Transmission Gap Audit',
    },
    {
      number: '06',
      title: 'Evidence Fusion',
      subtitle: 'Explainable Factor Scoring',
      description: 'Synthesize spatial, temporal, trajectory, AIS continuity, and metocean factors into an audited composite score.',
      metric: 'Multi-Factor Ledger',
    },
    {
      number: '07',
      title: 'Investigation Report',
      subtitle: 'Forensic Legal Dossier',
      description: 'Generate standardized forensic dossiers with explicit abstention protection and standard GeoJSON export.',
      metric: 'Zero-False Attribution',
    },
  ];

  return (
    <section id="workflow" className="py-20 lg:py-28 px-6 sm:px-8 bg-white border-b border-[#E5E5E5] scroll-mt-16">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b border-[#E5E5E5]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-label text-[#888888] mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#111111]" />
              <span>FORENSIC WORKFLOW ARCHITECTURE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#111111]">
              The 7-Stage Investigation Pipeline
            </h2>
          </div>
          <div className="mt-4 md:mt-0 max-w-md">
            <p className="text-[13px] text-[#666666] leading-relaxed">
              Every stage preserves full mathematical provenance. The investigation transitions seamlessly from raw orbital radar backscatter to vessel identification.
            </p>
          </div>
        </div>

        {/* 7-Step Sequence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4 mb-10">
          {steps.map((step, idx) => (
            <div
              key={step.number}
              className="p-4 border border-[#E5E5E5] hover:border-[#111111] bg-[#FAFAFA] hover:bg-white transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#111111] group-hover:text-black">
                    {step.number}
                  </span>
                  {idx < steps.length - 1 && (
                    <span className="hidden lg:inline text-[#CCCCCC] group-hover:text-[#111111] font-mono text-xs">
                      →
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-[#111111] mb-1 leading-snug">
                  {step.title}
                </h3>
                <div className="font-mono text-[10px] text-[#888888] uppercase tracking-wider mb-2.5">
                  {step.subtitle}
                </div>
                <p className="text-[11px] text-[#666666] leading-relaxed mb-4 font-normal">
                  {step.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#EAEAEA] font-mono text-[9px] uppercase tracking-wider text-[#111111] font-semibold">
                {step.metric}
              </div>
            </div>
          ))}
        </div>

        {/* Workflow Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-[#FAFAFA] border border-[#E5E5E5]">
          <div className="font-mono text-xs text-[#555555]">
            <span className="font-bold text-[#111111]">CANONICAL EVALUATION:</span> 5 synthetic benchmark scenarios available for full-scale live execution.
          </div>
          <button
            onClick={onOpenConsole}
            className="px-5 py-2.5 bg-[#111111] text-white hover:bg-black transition-all text-xs font-mono uppercase tracking-label font-bold cursor-pointer flex items-center gap-2 shrink-0 shadow-xs"
          >
            <span>Launch Pipeline in Workspace</span>
            <span>→</span>
          </button>
        </div>

      </div>
    </section>
  );
}
