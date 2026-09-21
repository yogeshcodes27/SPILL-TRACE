/**
 * SPILLTRACE — Basemap Provider Service
 * 
 * Clean abstraction decoupling tile layer providers from map presentation.
 * Provides high-resolution global satellite imagery (Esri World Imagery)
 * and restrained nautical street/coastline basemap (OpenStreetMap).
 */

export const BASEMAP_MODES = {
  SATELLITE: 'satellite',
  MAP: 'map',
};

// Configuration verification: Satellite imagery endpoint
const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

const STREET_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/**
 * Returns true if a valid satellite imagery provider is configured.
 */
export function isSatelliteConfigured() {
  return Boolean(SATELLITE_TILE_URL);
}

/**
 * Creates and returns the high-resolution satellite imagery Leaflet tile layer.
 */
export function getSatelliteBasemap(L) {
  if (!L || !isSatelliteConfigured()) return null;

  return L.tileLayer(SATELLITE_TILE_URL, {
    attribution: SATELLITE_ATTRIBUTION,
    maxZoom: 19,
    subdomains: ['server', 'services'],
    className: 'satellite-basemap-tiles',
  });
}

/**
 * Creates and returns the restrained nautical grayscale geographic basemap.
 */
export function getStreetBasemap(L) {
  if (!L) return null;

  return L.tileLayer(STREET_TILE_URL, {
    attribution: STREET_ATTRIBUTION,
    maxZoom: 19,
    subdomains: 'abc',
    className: 'maritime-basemap-tiles',
  });
}
