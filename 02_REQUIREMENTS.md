# SIH26143 Documentation — Verified Revision 2 (September 2026)

# SIH26143 --- Detailed Requirements Specification

## 1. Purpose

This document converts SIH26143 into implementable requirements.

Requirement IDs use:

-   `FR` --- functional requirement
-   `DR` --- data requirement
-   `MLR` --- machine-learning requirement
-   `GR` --- geospatial requirement
-   `BR` --- drift/hindcast requirement
-   `AIR` --- AIS requirement
-   `NFR` --- non-functional requirement
-   `UIR` --- interface requirement
-   `EVR` --- evaluation requirement

------------------------------------------------------------------------

## 2. Functional Requirements

### FR-001 --- Scene ingestion

The system shall accept a georeferenced satellite scene.

Minimum metadata:

-   acquisition time;
-   CRS;
-   transform;
-   spatial extent;
-   sensor/product type.

### FR-002 --- SAR preprocessing

The system shall prepare Sentinel-1 SAR input for the segmentation
model.

### FR-003 --- Oil-spill segmentation

The system shall produce a pixel-level oil probability/mask.

### FR-004 --- Confidence

The detector shall retain a confidence/probability representation rather
than only a binary output internally.

### FR-005 --- Spill polygon

The system shall convert the final mask into georeferenced vector
geometry.

### FR-006 --- Geometry

The system shall calculate:

-   area;
-   perimeter;
-   centroid;
-   bounding box;
-   orientation;
-   major/minor axis or equivalent shape measurements.

### FR-007 --- Acquisition time

The system shall retain the exact satellite acquisition timestamp.

### FR-008 --- Age estimation

The system may estimate spill age if the available evidence supports it.

Age estimation must be labelled optional and uncertain.

### FR-009 --- Environmental forcing

The system shall accept ocean-current and meteorological forcing.

### FR-010 --- Backward hindcast

The system shall support backward drift estimation from the observed
spill toward possible origin regions.

### FR-011 --- Origin uncertainty

The system shall represent origin uncertainty as a region/distribution
rather than forcing an exact point.

### FR-012 --- Forward forecast

The system shall generate future drift scenarios.

### FR-013 --- AIS ingestion

The system shall ingest historical AIS records.

### FR-014 --- AIS filtering

The system shall filter AIS using the estimated origin region and time
window.

### FR-015 --- Vessel trajectory reconstruction

The system shall reconstruct vessel paths from AIS observations.

### FR-016 --- Candidate generation

The system shall generate a candidate-vessel set.

### FR-017 --- Explainable scoring

The system shall calculate separate evidence components for each
candidate.

### FR-018 --- Evidence display

The system shall display why a candidate was flagged.

### FR-019 --- Map visualization

The system shall visualize spill, origin, drift, vessels and candidate
evidence.

### FR-020 --- Export

The system should export:

-   GeoJSON;
-   CSV;
-   JSON;
-   investigation report.

------------------------------------------------------------------------

## 3. Data Requirements

### DR-001 --- Sentinel-1 training data

Use the referenced Zenodo dataset for detector
training/validation/testing.

The dataset is divided into Parts I, II and III.

Official records:

-   Part I: https://zenodo.org/records/8346860
-   Part II: https://zenodo.org/records/8253899
-   Part III: https://zenodo.org/records/13761290

The Zenodo documentation states that Sentinel-1 Sigma0 images in dB with
VV/VH and dimensions 2048×2048×2 are georeferenced, while the
ground-truth masks are not georeferenced.

### DR-002 --- Operational imagery

The final application should support independently acquired
georeferenced Sentinel-1 scenes.

Copernicus Data Space:
https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-1

### DR-003 --- AIS

The SIH statement references MarineCadastre as the AIS format/sample
source.

MarineCadastre: https://marinecadastre.gov/accessais/

Operational note: AccessAIS availability shall be verified at the time of data acquisition. If the ordering service is unavailable, use appropriate MarineCadastre bulk AIS downloads or another legitimate AIS source.

### DR-004 --- Environmental data

At minimum:

-   surface ocean currents;
-   wind.

Recommended open sources:

-   Copernicus Marine Global Ocean Physics;
-   ERA5.

### DR-005 --- Synthetic AIS

If appropriate historical AIS cannot be obtained for the selected
demonstration scene, synthetic AIS is permitted by the SIH statement.

Synthetic records must be labelled `SYNTHETIC`.

------------------------------------------------------------------------

## 4. ML Requirements

### MLR-001 --- Hard-negative handling

Training/evaluation shall include no-oil and look-alike cases.

The Zenodo Part II record explicitly states that look-alike ground truth
is zero because the dataset focuses on oil-spill segmentation.

### MLR-002 --- Avoid dark-patch shortcut

The model shall not be evaluated only on positive oil examples.

### MLR-003 --- Spatial generalisation

Where possible, train/validation/test splits should avoid leakage from
adjacent or nearly identical scenes.

### MLR-004 --- Reproducibility

Record:

-   model version;
-   dataset version;
-   preprocessing version;
-   seed;
-   threshold;
-   training configuration.

### MLR-005 --- Model selection

The model shall be selected using validation performance, not test-set
tuning.

------------------------------------------------------------------------

## 5. Geospatial Requirements

### GR-001

All final spill geometries shall use a defined CRS.

### GR-002

The application shall distinguish:

-   image coordinates;
-   geographic coordinates;
-   projected coordinates.

### GR-003

Area shall be calculated in an appropriate projected/equal-area CRS or
equivalent geodesic method.

### GR-004

All AIS coordinates shall be normalized to a common reference system.

### GR-005

Drift trajectories shall retain timestamped positions.

------------------------------------------------------------------------

## 6. Drift/Hindcast Requirements

### BR-001

The model shall use time-dependent forcing rather than a static current
vector whenever data availability permits.

### BR-002

The system shall support backward trajectory simulation.

NOAA GNOME documentation confirms backward trajectory capability for
estimating the origin of mystery spills.

### BR-003

The system shall support forward trajectory simulation.

### BR-004

The model shall retain environmental forcing provenance.

### BR-005

The model shall allow sensitivity analysis for wind/current uncertainty.

### BR-006

Origin output shall include:

-   spatial region;
-   time interval/distribution;
-   confidence/coverage metric.

------------------------------------------------------------------------

## 7. AIS Requirements

### AIR-001

AIS records shall contain, when available:

-   vessel identifier/MMSI;
-   timestamp;
-   latitude;
-   longitude;
-   SOG;
-   COG;
-   heading.

### AIR-002

Records shall be sorted chronologically per vessel.

### AIR-003

Invalid coordinates shall be removed.

### AIR-004

Impossible or obviously corrupted speed values shall be flagged/removed
according to a documented rule.

### AIR-005

Trajectory interpolation shall never fabricate evidence across long AIS
gaps without explicitly marking the gap.

### AIR-006

Candidate filtering shall use both space and time.

### AIR-007

AIS gaps shall be treated as evidence requiring context, not automatic
proof of suspicious behaviour.

------------------------------------------------------------------------

## 8. Attribution Requirements

### AR-001 --- Candidate score

The scoring engine shall be explainable.

Example:

``` text
score =
  spatial_component
+ temporal_component
+ trajectory_component
+ behaviour_component
+ model_confidence_component
```

Weights must be configurable and documented.

### AR-002 --- No black-box final verdict

The UI shall show component scores.

### AR-003 --- Uncertainty

The final candidate ranking shall be linked to uncertainty in the origin
reconstruction.

### AR-004 --- Terminology

Use:

-   candidate vessel;
-   candidate vessel;
-   investigation priority;
-   evidence score.

Avoid presenting the output as legal proof of responsibility.

------------------------------------------------------------------------

## 9. Synthetic Data Requirements

Synthetic data should be used for controlled testing, not to disguise
missing real-world evidence.

Each synthetic scenario shall contain:

-   scenario ID;
-   known spill origin;
-   known release time;
-   environmental forcing;
-   known source vessel;
-   known vessel trajectory;
-   AIS gaps if applicable;
-   generated observations;
-   ground-truth labels.

Required scenarios:

1.  single clear candidate;
2.  multiple nearby vessels;
3.  vessel outside origin time;
4.  vessel outside origin region;
5.  AIS gap;
6.  no matching vessel;
7.  dense traffic;
8.  environmental uncertainty.

------------------------------------------------------------------------

## 10. Non-Functional Requirements

### NFR-001 --- Reproducibility

Same inputs + same model/configuration + same seed should produce
reproducible results where stochastic components permit.

### NFR-002 --- Auditability

Every output must identify its data/model provenance.

### NFR-003 --- Performance

The team shall define measurable targets for:

-   segmentation latency;
-   drift simulation time;
-   AIS filtering time;
-   complete investigation time.

Do not invent targets before profiling.

### NFR-004 --- Scalability

The system shall avoid loading an entire global AIS archive into memory.

### NFR-005 --- Failure handling

The system shall report missing:

-   imagery;
-   AIS;
-   wind;
-   current;
-   metadata.

It shall not silently substitute arbitrary values.

------------------------------------------------------------------------

## 11. Interface Requirements

### UIR-001 --- Overview map

Show:

-   satellite footprint;
-   slick;
-   origin region;
-   drift.

### UIR-002 --- Candidate panel

For each candidate:

-   vessel ID;
-   latest/relevant position;
-   score;
-   evidence components;
-   trajectory;
-   AIS gap information.

### UIR-003 --- Evidence timeline

Provide a synchronized timeline:

``` text
T-48h ... T-24h ... origin window ... T0 ... T+24h
```

### UIR-004 --- Uncertainty

Show origin as a region/heatmap/ensemble envelope.

### UIR-005 --- Data provenance

Allow users to inspect data sources and timestamps.

------------------------------------------------------------------------

## 12. Evaluation Requirements

### EVR-001 --- Detector

Report:

-   Dice;
-   IoU;
-   precision;
-   recall;
-   false-positive rate.

### EVR-002 --- Look-alikes

Report performance specifically on look-alike examples.

### EVR-003 --- Origin

Report:

-   median origin error;
-   percentile error;
-   origin containment rate;
-   time error.

### EVR-004 --- Attribution

Report:

-   top-1 recall;
-   top-3 recall;
-   false-attribution rate;
-   rank stability.

### EVR-005 --- End-to-end

Test complete synthetic scenarios where the true source is known.

------------------------------------------------------------------------

## 13. Acceptance Criteria

A minimum credible prototype should:

1.  ingest a real georeferenced Sentinel-1 scene;
2.  detect a spill candidate;
3.  generate a georeferenced polygon;
4.  run a drift simulation;
5.  produce an origin uncertainty region;
6.  ingest AIS;
7.  reconstruct candidate vessel trajectories;
8.  calculate explainable evidence;
9.  visualize the complete chain;
10. clearly distinguish real, simulated and synthetic data.
