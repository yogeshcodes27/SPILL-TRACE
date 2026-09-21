/**
 * SPILLTRACE — Service Layer Type Contracts
 * 
 * Standardised data shapes consumed by UI components and produced by service providers.
 * These contracts define the interface between the frontend and the backend service layer.
 * Mock providers return data conforming to these shapes; real providers will do the same.
 */

// ─── Satellite Scene ────────────────────────────────────────────────
/**
 * @typedef {Object} SatelliteScene
 * @property {string} sceneId          - Unique scene identifier (e.g., 'S1A_IW_GRDH_20260617_064200')
 * @property {string} sensor           - Sensor platform (e.g., 'Sentinel-1 C-SAR')
 * @property {string} agency           - Operating agency (e.g., 'ESA')
 * @property {string} acquisitionTime  - ISO-8601 UTC timestamp
 * @property {string} orbitDirection   - 'ASCENDING' | 'DESCENDING'
 * @property {string} polarization     - 'VV' | 'VH' | 'VV+VH'
 * @property {string} productType      - 'GRDH' | 'SLC' | 'OCN'
 * @property {string} crs              - Coordinate reference system (e.g., 'EPSG:4326')
 * @property {number[]} bbox           - [minLon, minLat, maxLon, maxLat]
 * @property {number} resolutionM      - Ground resolution in metres
 * @property {string} calibrationStatus - 'CALIBRATED' | 'RAW'
 * @property {Object} validation       - Scene validation report
 * @property {boolean} validation.geometryValid
 * @property {boolean} validation.radiometryValid
 * @property {boolean} validation.coverageComplete
 * @property {number} validation.noiseFloorDb
 */

// ─── Spill Geometry ─────────────────────────────────────────────────
/**
 * @typedef {Object} SpillGeometry
 * @property {string} spillId          - Unique spill polygon identifier
 * @property {number[][]} polygon      - GeoJSON-style coordinate ring [[lon, lat], ...]
 * @property {number} areaKm2          - Computed area in km²
 * @property {number} perimeterKm      - Perimeter in km
 * @property {number[]} centroid       - [lon, lat]
 * @property {number} majorAxisKm      - Major axis length in km
 * @property {number} minorAxisKm      - Minor axis length in km
 * @property {number} orientationDeg   - Orientation of major axis in degrees from north
 * @property {number} compactness      - Compactness index (4π·area / perimeter²)
 * @property {number} aspectRatio      - majorAxis / minorAxis
 * @property {number} confidence       - Detection confidence 0–1
 * @property {string} classification   - 'MINERAL_OIL' | 'LOOK_ALIKE' | 'UNCLASSIFIED'
 * @property {Object} lookAlikeScores
 * @property {number} lookAlikeScores.mineralOil
 * @property {number} lookAlikeScores.lowWindCalm
 * @property {number} lookAlikeScores.shipWake
 * @property {number} lookAlikeScores.biogenic
 */

// ─── Metocean Forcing ───────────────────────────────────────────────
/**
 * @typedef {Object} MetoceanForcing
 * @property {string} source           - Data source (e.g., 'CMEMS', 'ERA5')
 * @property {number} windSpeedKn      - Wind speed in knots
 * @property {number} windDirectionDeg - Wind direction (from) in degrees
 * @property {number} currentSpeedMs   - Surface current speed in m/s
 * @property {number} currentDirectionDeg - Current direction (towards) in degrees
 * @property {number} stokesDriftMs    - Stokes drift component in m/s
 * @property {string} timestamp        - ISO-8601 UTC timestamp
 */

// ─── Drift Run ──────────────────────────────────────────────────────
/**
 * @typedef {Object} DriftRun
 * @property {string} runId
 * @property {'backward'|'forward'} direction
 * @property {number} durationHours
 * @property {number} particleCount
 * @property {number[][]} originRegion       - Estimated origin polygon [[lon, lat], ...]
 * @property {number[]} originCentroid       - [lon, lat]
 * @property {number} originRadiusKm         - 95% CI radius in km
 * @property {string} releaseWindowStart     - ISO-8601 or 'HH:MM UTC' string
 * @property {string} releaseWindowEnd
 * @property {number} driftDistanceNm        - Drift distance in nautical miles
 * @property {Object[]} particles            - Array of particle trajectory points
 * @property {Object[]} forwardEnvelope      - Forward forecast cone coordinates
 * @property {MetoceanForcing} forcing       - Environmental forcing used
 */

// ─── AIS Track ──────────────────────────────────────────────────────
/**
 * @typedef {Object} AisTrack
 * @property {string} mmsi
 * @property {string} vesselName
 * @property {string} vesselType       - e.g., 'CARGO VESSEL', 'CRUDE OIL TANKER'
 * @property {string} flag
 * @property {number} lengthM
 * @property {number} beamM
 * @property {Object[]} positions      - Chronological AIS positions
 * @property {number} positions[].lat
 * @property {number} positions[].lon
 * @property {number} positions[].sog  - Speed over ground (knots)
 * @property {number} positions[].cog  - Course over ground (degrees)
 * @property {string} positions[].timestamp
 * @property {boolean} positions[].isGap - True if this is an interpolated gap
 * @property {boolean} hasAisGap       - Whether vessel has a transmission gap
 * @property {Object|null} aisGap      - Gap details if present
 * @property {string} aisGap.start
 * @property {string} aisGap.end
 * @property {number} aisGap.durationMinutes
 */

// ─── Evidence Score ─────────────────────────────────────────────────
/**
 * @typedef {Object} EvidenceScore
 * @property {string} mmsi
 * @property {string} vesselName
 * @property {number} spatialCompatibility    - 0–100
 * @property {number} temporalCompatibility   - 0–100
 * @property {number} trajectoryCompatibility - 0–100
 * @property {number} aisContinuity           - 0–100
 * @property {number} environmentalConsistency - 0–100
 * @property {number} overallScore            - Weighted composite 0–100
 * @property {number} rankStability           - % of Monte Carlo runs where this vessel ranks #1
 * @property {string} priority                - 'HIGH' | 'MODERATE' | 'LOW' | 'NONE'
 * @property {string[]} reasons               - Human-readable evidence explanations
 */

// ─── Provenance Record ──────────────────────────────────────────────
/**
 * @typedef {Object} ProvenanceRecord
 * @property {string} datasetSource
 * @property {string} modelVersion
 * @property {string} processedAt        - ISO-8601 UTC timestamp
 * @property {string} seed               - Random seed for reproducibility
 * @property {string} dataStatus         - 'synthetic' | 'operational'
 * @property {string} disclaimer
 */

// ─── Investigation Dossier ──────────────────────────────────────────
/**
 * @typedef {Object} InvestigationDossier
 * @property {string} incidentId
 * @property {string} scenarioId
 * @property {SatelliteScene} scene
 * @property {SpillGeometry} spill
 * @property {DriftRun} driftBackward
 * @property {DriftRun} driftForward
 * @property {AisTrack[]} candidates
 * @property {EvidenceScore[]} scores
 * @property {ProvenanceRecord} provenance
 */

export const DATA_STATUS = {
  SYNTHETIC: 'synthetic',
  OPERATIONAL: 'operational',
};

export const CLASSIFICATION = {
  MINERAL_OIL: 'MINERAL_OIL',
  LOOK_ALIKE: 'LOOK_ALIKE',
  UNCLASSIFIED: 'UNCLASSIFIED',
};

export const PRIORITY = {
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  NONE: 'NONE',
};

export const DISCLAIMER = 
  'DEMO / SYNTHETIC DATA — This output is generated from simulated data for demonstration purposes. ' +
  'All results are investigative leads only and do not constitute legal determinations of responsibility.';
