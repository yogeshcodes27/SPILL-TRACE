# SIH26143 Documentation — Verified Revision 2 (September 2026)

# SIH26143 --- Detailed End-to-End Workflow and Architecture

## 1. Architecture Principle

The system is a **multi-stage geospatial inference pipeline**, not one
monolithic ML model.

The core chain is:

``` text
Satellite observation
        ↓
Oil-spill detection
        ↓
Spill geometry
        ↓
Environmental forcing
        ↓
Backward drift
        ↓
Origin space-time uncertainty
        ↓
AIS reconstruction
        ↓
Candidate filtering
        ↓
Evidence scoring
        ↓
Investigation interface
```

------------------------------------------------------------------------

## 2. Logical Architecture

``` text
┌──────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                         │
├────────────────┬─────────────────┬───────────────────────────┤
│ Sentinel-1/EO  │ Historical AIS  │ Wind + Ocean Currents     │
└───────┬────────┴────────┬────────┴─────────────┬─────────────┘
        │                 │                      │
        v                 v                      v
┌───────────────┐  ┌───────────────┐   ┌──────────────────────┐
│ EO Processor  │  │ AIS Processor │   │ Metocean Processor   │
└──────┬────────┘  └──────┬────────┘   └──────────┬───────────┘
       │                  │                       │
       v                  │                       │
┌───────────────┐         │                       │
│ SAR Detector  │         │                       │
└──────┬────────┘         │                       │
       v                  │                       │
┌───────────────┐         │                       │
│ Spill Geometry│         │                       │
└──────┬────────┘         │                       │
       └──────────────────┼───────────────────────┘
                          v
                 ┌────────────────┐
                 │ Drift Engine   │
                 │ Backward/      │
                 │ Forward        │
                 └───────┬────────┘
                         v
                ┌──────────────────┐
                │ Origin Inference │
                └────────┬─────────┘
                         v
                ┌──────────────────┐
                │ AIS Candidate    │
                │ Filtering        │
                └────────┬─────────┘
                         v
                ┌──────────────────┐
                │ Attribution /    │
                │ Evidence Engine  │
                └────────┬─────────┘
                         v
                ┌──────────────────┐
                │ Dashboard +      │
                │ Report           │
                └──────────────────┘
```

------------------------------------------------------------------------

## 3. Stage 0 --- Input Validation

Before processing:

-   verify file integrity;
-   verify CRS;
-   verify timestamp;
-   verify sensor;
-   verify spatial extent;
-   verify polarization;
-   verify required environmental data;
-   verify AIS time coverage.

If a mandatory input is missing, return a clear state:

``` text
READY
PARTIAL
BLOCKED
```

Never silently proceed with fabricated environmental data.

------------------------------------------------------------------------

## 4. Stage 1 --- SAR Processing

### Input

Preferred operational input:

-   Sentinel-1 GRD;
-   VV;
-   VH;
-   acquisition time;
-   geolocation metadata.

Copernicus confirms Sentinel-1 is C-band SAR with day/night and
all-weather capability.

Source:
https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-1

### Processing

``` text
GRD
 ↓
read VV/VH
 ↓
quality/NoData handling
 ↓
consistent backscatter representation
 ↓
normalization
 ↓
tiling if required
 ↓
model
```

Do not destroy the geospatial transform during tiling.

------------------------------------------------------------------------

## 5. Stage 2 --- Oil Detection

### Model

Start with:

-   U-Net or DeepLabV3+ baseline, with final selection based on validation performance, computational cost, and hard-negative robustness.

Only add more complex architectures if validation justifies them.

### Output

``` text
oil_probability.tif
oil_mask.tif
```

Then:

``` text
mask
 ↓
connected components
 ↓
validated filtering
 ↓
polygonization
 ↓
spill.geojson
```

------------------------------------------------------------------------

## 6. Stage 3 --- Spill Characterisation

For each spill object:

``` text
spill_id
acquisition_time
area_km2
perimeter_km
centroid
bbox
orientation
major_axis
minor_axis
compactness
confidence
```

The system should support multiple detected spill objects in one scene.

------------------------------------------------------------------------

## 7. Stage 4 --- Origin Reconstruction

### Core idea

The observed slick is a set of possible oil particles that have been
transported by:

-   ocean currents;
-   wind;
-   diffusion;
-   weathering processes.

Therefore:

``` text
Observed position at T0
        |
        | reverse simulation
        v
possible positions at T0-Δt
```

Repeat this for multiple environmental scenarios.

### Ensemble

Example conceptual ensemble:

``` text
Wind:
- nominal
- -10%
- +10%
- directional perturbation

Current:
- nominal
- uncertainty perturbation

Release age:
- 6h
- 12h
- 18h
- 24h
- 36h
- 48h
```

These values are **example scenario settings**, not scientific
constants. They must be calibrated for the chosen region and experiment.

### Output

``` text
origin_probability.geojson
origin_time_distribution.json
```

------------------------------------------------------------------------

## 8. Stage 5 --- Forward Forecast

From the observed slick:

``` text
T0
 ↓
T+6h
 ↓
T+12h
 ↓
T+24h
 ↓
T+48h
```

Display an ensemble envelope.

The forecast should be explicitly labelled as model output.

------------------------------------------------------------------------

## 9. Stage 6 --- AIS Reconstruction

AIS should be processed into trajectories:

``` text
MMSI
 └── sorted observations
       ├── timestamp
       ├── lat
       ├── lon
       ├── SOG
       ├── COG
       └── heading
```

### Spatial filter

First filter to an expanded origin region.

### Temporal filter

Then filter to an expanded origin time window.

### Why expand?

The origin estimate is uncertain.

Therefore:

``` text
origin region
+
uncertainty buffer
```

rather than an exact point query.

------------------------------------------------------------------------

## 10. Stage 7 --- Candidate Scoring

Recommended evidence model:

``` text
                   Candidate Vessel
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
   Spatial          Temporal         Trajectory
   evidence         evidence         evidence
        |                |                |
        +----------------+----------------+
                         |
                         v
                  Behavioural evidence
                         |
                         v
                  Model confidence
                         |
                         v
                  Final evidence score
```

### Example factors

#### Spatial

Distance from vessel trajectory to origin probability region.

#### Temporal

How closely the vessel's passage overlaps the estimated release window.

#### Trajectory

Whether the vessel's path is consistent with a source position from
which drift could reach the observed slick.

#### Behaviour

Possible AIS anomalies:

-   gap;
-   unusual stop;
-   unusual course change;
-   speed change.

These are signals, not proof.

------------------------------------------------------------------------

## 11. Stronger Attribution Architecture

A useful design is to evaluate each candidate in two directions.

### Backward path

``` text
slick
 ↓
backward drift
 ↓
origin region
 ↓
candidate vessel
```

### Forward candidate path

``` text
candidate vessel position
 ↓
release hypothesis
 ↓
forward drift
 ↓
predicted slick
 ↓
compare with observed slick
```

This bidirectional design is supported by the 2024 Luo et al. research,
so it should be described as a prior-art-informed approach, not as a
completely novel algorithm.

------------------------------------------------------------------------

## 12. Uncertainty Engine

The uncertainty engine should combine:

``` text
Detection uncertainty
+
Environmental uncertainty
+
Release-time uncertainty
+
Model parameter uncertainty
+
AIS observation uncertainty
```

Output:

``` text
origin heatmap
confidence contours
time distribution
candidate rank stability
```

### Rank stability

Run the attribution repeatedly under perturbed environmental
assumptions.

If:

``` text
Vessel A = rank 1
in 95/100 runs
```

that is more informative than:

``` text
Vessel A = score 92
```

This is a proposed engineering feature and should be validated
experimentally.

------------------------------------------------------------------------

## 13. Dashboard Architecture

### Page 1 --- Incident Overview

``` text
Incident ID
Detection time
Location
Spill area
Confidence
```

### Page 2 --- Detection

Show:

-   SAR;
-   segmentation;
-   polygon;
-   geometry.

### Page 3 --- Drift

Show:

-   backward trajectories;
-   origin probability;
-   forward forecast.

### Page 4 --- AIS

Show:

-   all nearby vessels;
-   filtered candidates;
-   trajectories.

### Page 5 --- Attribution

Show:

``` text
Candidate A
Spatial:      High
Temporal:     High
Trajectory:   High
Behaviour:    Medium
Stability:    High
```

### Page 6 --- Evidence Report

Provide:

-   source data;
-   processing timestamps;
-   model versions;
-   environmental data;
-   AIS coverage;
-   assumptions;
-   limitations.

------------------------------------------------------------------------

## 14. Backend Architecture

Recommended:

``` text
React frontend
      |
      v
FastAPI
      |
      +------------------+
      |                  |
      v                  v
PostGIS             Job Queue
      |                  |
      |                  +--> SAR inference
      |                  +--> drift simulation
      |                  +--> AIS processing
      |
      v
Object storage
```

Long-running drift simulations should not block the HTTP request thread.

Use job IDs:

``` text
POST /incidents
        ↓
job_id
        ↓
GET /jobs/{job_id}
```

------------------------------------------------------------------------

## 15. Database Architecture

### incidents

``` text
id
scene_id
created_at
status
```

### satellite_scenes

``` text
id
sensor
product_type
acquisition_time
crs
bbox
source
```

### spills

``` text
id
incident_id
geometry
area_km2
confidence
```

### drift_runs

``` text
id
incident_id
model
forcing_source
start_time
end_time
direction
parameters
```

### origin_regions

``` text
id
drift_run_id
geometry
probability
time_start
time_end
```

### ais_points

``` text
mmsi
timestamp
geometry
sog
cog
heading
source
```

### candidate_vessels

``` text
incident_id
mmsi
score
spatial_score
temporal_score
trajectory_score
behaviour_score
stability
```

------------------------------------------------------------------------

## 16. Failure Handling

### Detection failure

``` text
No confident slick
```

Do not continue automatically to attribution.

### Missing current data

``` text
Drift unavailable
```

Do not use a static guessed current.

### Missing AIS

``` text
Attribution unavailable / incomplete
```

### Sparse AIS

Display coverage limitation.

### Multiple spills

Process separately unless a scientifically justified merge is performed.

------------------------------------------------------------------------

## 17. End-to-End State Machine

``` text
NEW
 ↓
SCENE_VALIDATED
 ↓
DETECTED
 ↓
CHARACTERISED
 ↓
DRIFT_READY
 ↓
HINDCAST_COMPLETE
 ↓
ORIGIN_ESTIMATED
 ↓
AIS_FILTERED
 ↓
CANDIDATES_GENERATED
 ↓
ATTRIBUTION_COMPLETE
 ↓
REPORT_READY
```

Any stage can enter:

``` text
FAILED
```

with a machine-readable error.

------------------------------------------------------------------------

## 18. Recommended Development Order

### Phase 1

SAR dataset + segmentation.

### Phase 2

Georeferenced spill polygon.

### Phase 3

Synthetic spill + drift engine.

### Phase 4

Synthetic AIS + attribution.

### Phase 5

Real AIS integration.

### Phase 6

Real Indian/coastal test case.

### Phase 7

Dashboard and evidence report.

This order isolates failures instead of trying to build the whole
pipeline simultaneously.

------------------------------------------------------------------------

## 19. Final Architecture Rule

The most important architectural rule is:

> **Every downstream stage must consume an explicit, uncertainty-aware
> output from the previous stage.**

For example:

``` text
Detector
  ↓
spill geometry + confidence
  ↓
Drift
  ↓
origin distribution + time distribution
  ↓
AIS
  ↓
candidate evidence
  ↓
investigation result
```

Do not pass unexplained scalar values between modules.
