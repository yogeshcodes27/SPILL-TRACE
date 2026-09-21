/**
 * SPILLTRACE — Forensic Map Styling Definitions
 * 
 * Centralized cartographic and forensic layer styles adhering strictly to
 * the technical, restrained maritime investigation visual language.
 */

export const MAP_STYLES = {
  // ── Basemap Tile Styling ─────────────────────────────────────────
  tileLayerUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  tileFilter: 'grayscale(100%) contrast(92%) brightness(102%)',

  // ── SAR Scene Footprint (Sentinel-1 Swath Frame) ─────────────────
  sar: {
    frameColor: '#FFFFFF',
    frameColorMap: '#222222',
    frameWeight: 1.5,
    frameDashArray: '6, 4',
    fillOpacity: 0.04,
  },

  // ── Tab 02 Segmentation Classes (Controlled Semantic Palette) ─────
  segmentation: {
    oilSlick: {
      color: '#B91C1C', // Deep red border
      fillColor: '#DC2626',
      fillOpacity: 0.45,
      weight: 2,
      label: 'OIL SLICK (CONFIRMED)',
      badgeBg: '#991B1B',
    },
    lookAlike: {
      color: '#1D4ED8', // Deep blue
      fillColor: '#2563EB',
      fillOpacity: 0.35,
      weight: 1.5,
      dashArray: '4, 4',
      label: 'LOOK-ALIKE (BIOGENIC)',
      badgeBg: '#1E40AF',
    },
    shipWake: {
      color: '#B45309', // Deep amber
      fillColor: '#D97706',
      fillOpacity: 0.35,
      weight: 1.5,
      label: 'SHIP WAKE (TURBULENT)',
      badgeBg: '#92400E',
    },
    lowWindCalm: {
      color: '#047857', // Emerald
      fillColor: '#059669',
      fillOpacity: 0.30,
      weight: 1.5,
      dashArray: '6, 3',
      label: 'LOW-WIND CALM REGION',
      badgeBg: '#065F46',
    },
  },

  // ── Standard Technical Slick (Tabs 03–07) ─────────────────────────
  slick: {
    polygon: {
      color: '#111111',
      fillColor: '#1A1A1A',
      fillOpacity: 0.55,
      weight: 2,
    },
    centroid: {
      radius: 5,
      color: '#FFFFFF',
      fillColor: '#111111',
      fillOpacity: 1,
      weight: 2,
    },
    majorAxis: {
      color: '#111111',
      weight: 2,
      dashArray: null,
    },
    minorAxis: {
      color: '#666666',
      weight: 1.5,
      dashArray: '3, 3',
    },
  },

  // ── Drift & Reconstructed Origin (Tab 04) ─────────────────────────
  drift: {
    trajectory: {
      color: '#111111',
      weight: 2.5,
      dashArray: '6, 5',
    },
    advectionPoint: {
      radius: 4,
      color: '#FFFFFF',
      fillColor: '#111111',
      fillOpacity: 1,
      weight: 1.5,
    },
    originCentroid: {
      radius: 6,
      color: '#111111',
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      weight: 2.5,
    },
    originUncertainty: {
      color: '#333333',
      fillColor: '#555555',
      fillOpacity: 0.18,
      weight: 1.5,
      dashArray: '5, 4',
    },
  },

  // ── Metocean Forcing Vectors ──────────────────────────────────────
  metocean: {
    wind: {
      color: '#4B5563',
      weight: 2,
    },
    current: {
      color: '#1F2937',
      weight: 2,
    },
  },

  // ── AIS Vessels & Trajectories (Tab 05) ───────────────────────────
  ais: {
    candidateTrack: {
      color: '#111111',
      weight: 2.5,
      opacity: 0.95,
    },
    candidateTrackActive: {
      color: '#000000',
      weight: 3.5,
      opacity: 1,
    },
    candidateVessel: {
      radius: 6,
      color: '#FFFFFF',
      fillColor: '#111111',
      fillOpacity: 1,
      weight: 2,
    },
    secondaryTrack: {
      color: '#888888',
      weight: 1.5,
      opacity: 0.55,
      dashArray: '3, 3',
    },
    secondaryVessel: {
      radius: 4,
      color: '#FFFFFF',
      fillColor: '#888888',
      fillOpacity: 0.8,
      weight: 1,
    },
    gapSegment: {
      color: '#DC2626',
      weight: 2.5,
      dashArray: '4, 4',
      opacity: 0.9,
    },
  },

  // ── Stability Ensemble Envelopes (SYN-005) ─────────────────────────
  ensemble: {
    nominal: { color: '#111111', weight: 1.5, dashArray: null },
    windPlus: { color: '#4B5563', weight: 1.2, dashArray: '4, 4' },
    windMinus: { color: '#6B7280', weight: 1.2, dashArray: '4, 4' },
    currentPlus: { color: '#374151', weight: 1.2, dashArray: '3, 3' },
    currentMinus: { color: '#9CA3AF', weight: 1.2, dashArray: '3, 3' },
    envelope: {
      color: '#111111',
      fillColor: '#111111',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '5, 4',
    },
  },
};
