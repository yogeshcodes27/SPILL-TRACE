/**
 * SPILLTRACE — Mapbox GL JS Configuration
 *
 * Centralized Mapbox access token and style constants.
 * The token is read from VITE_MAPBOX_TOKEN and is NEVER hardcoded.
 */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const MAPBOX_STYLES = {
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v12',
  STANDARD_SATELLITE: 'mapbox://styles/mapbox/standard-satellite',
  STREETS: 'mapbox://styles/mapbox/light-v11',
};

/** Default initial bounds: Northern Indian Ocean (fallback when no incidents have valid coordinates) */
export const DEFAULT_BOUNDS = {
  sw: [54.0, 0.0],   // [lon, lat]
  ne: [104.0, 26.0],  // [lon, lat]
};

/** Reasonable zoom constraints */
export const ZOOM_LIMITS = {
  MIN: 2,
  MAX: 18,
  INCIDENT_FLY_TO: 10,
  INCIDENT_WITH_GEOMETRY: 9,
};

/**
 * Returns true if a valid Mapbox token is configured.
 */
export function isMapboxConfigured() {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.'));
}
