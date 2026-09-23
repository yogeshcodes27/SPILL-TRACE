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
    frameColor: '#78909C',
    frameColorMap: '#546E7A',
    frameWeight: 1.5,
    frameDashArray: '6, 4',
    fillOpacity: 0.04,
  },

  // ── Tab 02 Segmentation Classes (Controlled Semantic Palette) ─────
  segmentation: {
    oilSlick: {
      color: '#B71C1C', // Deep red border
      fillColor: '#C62828',
      fillOpacity: 0.45,
      weight: 2,
      label: 'OIL SLICK (CONFIRMED)',
      badgeBg: '#B71C1C',
    },
    lookAlike: {
      color: '#1D4ED8', // Deep blue
      fillColor: '#2563EB',
      fillOpacity: 0.38,
      weight: 1.8,
      dashArray: '4, 4',
      label: 'LOOK-ALIKE (BIOGENIC)',
      badgeBg: '#1E40AF',
    },
    shipWake: {
      color: '#D97706', // Amber
      fillColor: '#F59E0B',
      fillOpacity: 0.38,
      weight: 1.8,
      label: 'SHIP WAKE (TURBULENT)',
      badgeBg: '#B45309',
    },
    lowWindCalm: {
      color: '#047857', // Emerald
      fillColor: '#10B981',
      fillOpacity: 0.32,
      weight: 1.8,
      dashArray: '6, 3',
      label: 'LOW-WIND CALM REGION',
      badgeBg: '#065F46',
    },
  },

  // ── Standard Technical Slick (Tabs 03–07) ─────────────────────────
  slick: {
    polygon: {
      color: '#FFFFFF',
      fillColor: '#C62828',
      fillOpacity: 0.40,
      weight: 2.0,
    },
    centroid: {
      radius: 4.5,
      color: '#0A1118',
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      weight: 2,
    },
    majorAxis: {
      color: '#FFFFFF',
      weight: 2.2,
      dashArray: null,
    },
    minorAxis: {
      color: '#FFCDD2',
      weight: 1.5,
      dashArray: '3, 3',
    },
  },

  // ── Drift & Reconstructed Origin (Tab 04) ─────────────────────────
  drift: {
    trajectory: {
      color: '#00BFA5',
      weight: 2.2,
      dashArray: '6, 4',
    },
    advectionPoint: {
      radius: 3.5,
      color: '#00BFA5',
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      weight: 1.5,
    },
    originCentroid: {
      radius: 5.5,
      color: '#0A1118',
      fillColor: '#00BFA5',
      fillOpacity: 1,
      weight: 2.0,
    },
    originUncertainty: {
      color: '#00BFA5',
      fillColor: '#4DB6AC',
      fillOpacity: 0.18,
      weight: 1.6,
      dashArray: '5, 4',
    },
  },

  // ── Metocean Forcing Vectors ──────────────────────────────────────
  metocean: {
    wind: {
      color: '#B0BEC5',
      weight: 2,
    },
    current: {
      color: '#4FC3F7',
      weight: 2,
    },
  },

  // ── AIS Vessels & Trajectories (Tab 05) ───────────────────────────
  ais: {
    candidateTrack: {
      color: '#FFD54F',
      weight: 2.8,
      opacity: 1.0,
    },
    candidateTrackActive: {
      color: '#FFD54F',
      weight: 2.8,
      opacity: 1.0,
    },
    candidateVessel: {
      radius: 6,
      color: '#000000',
      fillColor: '#FFD54F',
      fillOpacity: 1,
      weight: 2,
    },
    secondaryTrack: {
      color: '#42A5F5',
      weight: 1.5,
      opacity: 0.55,
      dashArray: null,
    },
    secondaryVessel: {
      radius: 4,
      color: '#0F172A',
      fillColor: '#FFFFFF',
      fillOpacity: 0.9,
      weight: 1.5,
    },
    gapSegment: {
      color: '#FF5252',
      weight: 2.8,
      dashArray: '4, 4',
      opacity: 0.95,
    },
  },

  // ── Stability Ensemble Envelopes (SYN-005) ─────────────────────────
  ensemble: {
    nominal: { color: '#CE93D8', weight: 2.0, dashArray: null },
    windPlus: { color: '#BA68C8', weight: 1.2, dashArray: '4, 4' },
    windMinus: { color: '#AB47BC', weight: 1.2, dashArray: '4, 4' },
    currentPlus: { color: '#9C27B0', weight: 1.2, dashArray: '3, 3' },
    currentMinus: { color: '#E1BEE7', weight: 1.2, dashArray: '3, 3' },
    envelope: {
      color: '#CE93D8',
      fillColor: '#CE93D8',
      fillOpacity: 0.12,
      weight: 1.8,
      dashArray: '5, 4',
    },
  },
};
