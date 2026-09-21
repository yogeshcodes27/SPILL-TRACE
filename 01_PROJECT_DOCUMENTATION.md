# SIH26143 Documentation — Verified Revision 2 (September 2026)

# SIH26143 --- Marine Oil Spill Detection and Vessel Attribution

## Full Project Documentation and Research Baseline

**Problem Statement:** SIH26143\
**Title:** Leveraging satellite imagery to determine Oil spills at sea
along with AIS data correlations to identify vessel responsible for the
spill\
**Organization:** National Technical Research Organisation (NTRO)\
**Category:** Software\
**Theme:** Disaster Management\
**Research baseline date:** 21 September 2026

------------------------------------------------------------------------

## 1. Executive Summary

SIH26143 asks for an automated pipeline that can:

1.  detect and characterise marine oil spills from remote-sensing
    imagery, especially SAR/EO imagery;
2.  estimate the spill's origin location and time by using oceanographic
    and meteorological forcing;
3.  predict the future drift of the slick;
4.  reconstruct historical vessel traffic around the estimated origin
    window using AIS;
5.  filter irrelevant traffic;
6.  score candidate vessels using factors such as proximity,
    trajectory and behavioural anomalies; and
7.  present the results through a suitable visual interface.

The official SIH portal confirms this wording and identifies
MarineCadastre AIS sample/format data and a Zenodo Sentinel-1 SAR
oil-spill dataset as the referenced data resources. The official page
also explicitly allows real AIS where available and synthetic AIS for
demonstration when real AIS is unavailable.

Official SIH source: https://www.sih.gov.in/sih2026PS

The architecture therefore should not be treated as a single
machine-learning model. It is a **multi-source geospatial investigation
pipeline**:

``` text
Sentinel-1 / EO
      |
      v
Oil-spill detection
      |
      v
Spill mask + geometry + acquisition time
      |
      v
Wind + ocean-current forcing
      |
      v
Backward drift hindcast ------> origin probability region + time window
      |
      +-----------------------> forward forecast
      |
      v
Historical AIS reconstruction
      |
      v
Candidate-vessel filtering
      |
      v
Explainable evidence scoring
      |
      v
Investigation dashboard
```

The system should produce **investigative leads**, not a legal
determination of responsibility. A high score means that the vessel
deserves further investigation under the model's evidence criteria; it
does not prove that the vessel caused the spill.

------------------------------------------------------------------------

## 2. What the Problem Statement Actually Requires

### 2.1 Requirement A --- Detect and characterise

The wording requires:

-   oil-spill detection;
-   characterisation;
-   geometric properties;
-   age estimation if feasible.

Therefore, the detector output should not stop at a binary image
classification.

Recommended outputs:

-   oil/no-oil probability;
-   pixel-level segmentation mask;
-   georeferenced spill polygon;
-   centroid;
-   area;
-   perimeter;
-   bounding box;
-   major/minor axis;
-   orientation;
-   compactness/shape descriptors;
-   confidence;
-   acquisition timestamp;
-   optional age estimate with uncertainty.

### 2.2 Requirement B --- Hindcast and forecast

The official description explicitly asks for oceanographic and
meteorological data to:

-   trace the slick toward its origin point and time;
-   predict future flow.

This requires an actual trajectory/drift model, not simply a geometric
line drawn behind the slick.

Suitable model families include:

-   NOAA GNOME / WebGNOME;
-   OpenDrift/OpenOil.

NOAA confirms that GNOME supports backward trajectories for estimating
the origin of a mystery spill. OpenDrift provides an open-source
Lagrangian trajectory framework and an OpenOil module with weathering
functionality.

### 2.3 Requirement C --- AIS attribution

The system must reconstruct vessel traffic around the origin window in
space and time.

This means the system should derive:

-   which vessels were in or near the origin region;
-   when they were there;
-   their movement direction;
-   speed;
-   trajectory consistency;
-   whether AIS was missing or interrupted;
-   whether the vessel's path is consistent with the estimated spill
    origin and timing.

### 2.4 Requirement D --- Visual interface

The UI should show the evidence chain rather than only a final ranked
list.

Recommended map layers:

-   satellite scene;
-   detected slick polygon;
-   slick centroid;
-   backward trajectories;
-   origin uncertainty region;
-   forward forecast cone;
-   AIS vessel tracks;
-   candidate vessel positions;
-   candidate vessel trajectories;
-   evidence/score panel.

------------------------------------------------------------------------

## 3. Research Findings and Existing Landscape

### 3.1 EMSA CleanSeaNet

CleanSeaNet is an operational European satellite-based oil-spill and
vessel-detection service. EMSA states that it supports identifying and
tracing oil pollution, monitoring accidental pollution, and contributing
to identification of polluters. EMSA also documents cases where
satellite imagery was combined with vessel tracking to support
investigations.

Sources: - https://www.emsa.europa.eu/csn-menu.html -
https://www.emsa.europa.eu/csn-menu/csn-faq/item/2215-what-is-cleanseanet-and-what-information-does-the-cleanseanet-provide.html -
https://www.emsa.europa.eu/csn-menu/use-cases/item/1873-satellite-images-as-primary-evidence-in-uk-court.html

Important lesson: satellite detection alone is not enough. Operational
workflows combine remote sensing with vessel information and further
validation.

### 3.2 INCOIS OOSA

India's ESSO-INCOIS operates the Online Oil Spill Advisory System
(OOSA). INCOIS describes it as an oil-spill trajectory prediction system
for the Indian coast. OOSA integrates an oil-spill trajectory model,
ocean circulation models, atmospheric models and GIS. INCOIS documents
GNOME as the oil-spill trajectory model used in OOSA and describes
wind/current forcing.

Sources: - https://oosa.incois.gov.in/ -
https://oosa.incois.gov.in/OOSA/aboutOOSA.jsp

Important lesson: an Indian operational precedent already exists for
physics-based oil-spill trajectory modelling. The differentiating system
should therefore focus on automated detection, automated origin
reconstruction, uncertainty, AIS correlation and an integrated
investigation workflow rather than claiming that oil-drift modelling
itself is novel.

### 3.3 Luo et al. (2024)

Luo et al., *A new ship tracing technology from oil spills based on
multi-source data*, Marine Pollution Bulletin 207 (2024), DOI
10.1016/j.marpolbul.2024.116808, explicitly combines:

-   SAR imagery;
-   AIS;
-   sea-surface current data;
-   wind data;
-   Lagrangian drift modelling;
-   forward and backward drift;
-   similarity between spill-derived and ship trajectories.

Source:
https://www.sciencedirect.com/science/article/pii/S0025326X24007859

This is highly relevant prior art. The project must not claim that the
overall combination of SAR + AIS + drift is unprecedented.

### 3.4 Busler, Wehn & Woodhouse (2015)

The 2015 ISPRS paper describes vessel tracking for illegal pollutant
discharges using multi-source vessel information and notes the
difficulty of associating a vessel with a remotely observed spill unless
the vessel is directly observed during discharge.

Source: https://isprs-archives.copernicus.org/articles/XL-7-W3/927/2015/

This establishes that multi-source vessel/spill attribution is not a new
concept.

------------------------------------------------------------------------

## 4. Defensible Project Contribution

The defensible contribution is the **engineering integration and
investigation workflow**, not invention of the individual components.

Potentially differentiating features:

1.  automated SAR detection -\> geospatial spill polygon;
2.  uncertainty-aware backward origin reconstruction;
3.  ensemble hindcasting rather than a single deterministic origin
    point;
4.  factor-by-factor explainable AIS scoring;
5.  explicit hard-negative/look-alike handling;
6.  optional SAR-based dark-vessel cross-check;
7.  reproducible Indian-waters demonstration;
8.  provenance and evidence-chain reporting.

Do not claim: - that nobody has combined SAR, drift and AIS; - that the
ranked vessel is legally responsible; - that a synthetic AIS scenario is
a real incident; - that a single origin coordinate is exact.

------------------------------------------------------------------------

## 5. Core System Architecture

### 5.1 High-level architecture

``` text
                  DATA INGESTION
                       |
       +---------------+----------------+
       |               |                |
       v               v                v
 Sentinel-1/EO       AIS         Wind + Currents
       |               |                |
       v               |                |
 Preprocessing         |                |
       |               |                |
       v               |                |
 SAR segmentation      |                |
       |               |                |
       v               |                |
 Spill geometry        |                |
       |               |                |
       +---------------+----------------+
                       |
                       v
              Drift/Hindcast Engine
                       |
             +---------+---------+
             |                   |
             v                   v
       Backward run        Forward run
             |                   |
             v                   v
     Origin region/time     Forecast spread
             |
             v
       AIS filtering
             |
             v
     Candidate trajectories
             |
             v
      Evidence scoring
             |
             v
     Investigation report
             |
             v
        Web dashboard
```

### 5.2 Recommended module boundaries

``` text
ingestion/
preprocessing/
segmentation/
geospatial/
drift/
ais/
attribution/
uncertainty/
api/
frontend/
evaluation/
synthetic/
```

Each module should have a stable input/output contract.

------------------------------------------------------------------------

## 6. End-to-End Data Flow

### Stage 1 --- Acquire imagery

Input:

-   georeferenced Sentinel-1 SAR scene;
-   optional optical/EO scene;
-   acquisition timestamp;
-   CRS and geotransform.

### Stage 2 --- Preprocess SAR

Typical processing:

1.  read VV/VH;
2.  calibrate/backscatter handling as appropriate to product;
3.  convert to consistent numeric representation;
4.  handle invalid pixels;
5.  normalize carefully;
6.  tile large scenes;
7.  retain geospatial transform for every tile.

### Stage 3 --- Segment oil

Model output:

``` text
P(oil | pixel)
```

Post-processing:

-   threshold probability;
-   remove tiny isolated regions where justified;
-   connected components;
-   morphology only if validated;
-   convert mask to polygon;
-   retain confidence.

### Stage 4 --- Characterise

Calculate:

-   area;
-   perimeter;
-   centroid;
-   bounding box;
-   principal orientation;
-   major/minor dimensions;
-   shape descriptors.

### Stage 5 --- Estimate origin

Use the observed slick as a set of particles/trajectory points or
another suitable representation.

Run an ensemble of backward trajectories using:

-   ocean current uncertainty;
-   wind uncertainty;
-   model parameter uncertainty;
-   possible spill-age range.

Output:

``` text
origin_probability.geojson
origin_time_distribution.json
```

### Stage 6 --- Forecast

Starting from the observed spill estimate, run forward drift scenarios
to produce:

-   central forecast;
-   uncertainty envelope;
-   time slices.

### Stage 7 --- AIS filtering

Candidate selection should be based on the origin region and origin time
window, not the entire AIS dataset.

Example:

``` text
origin region = 30 km uncertainty region
origin window = 2026-09-18 02:00–10:00 UTC

AIS query:
all vessels within expanded region
during expanded time window
```

### Stage 8 --- Candidate scoring

Use transparent factors such as:

-   distance to origin region;
-   temporal compatibility;
-   trajectory compatibility;
-   forward/backward drift similarity;
-   speed/course consistency;
-   AIS continuity;
-   AIS anomaly indicators;
-   optional vessel class/context.

The score should be decomposable:

``` text
Candidate score
├── spatial evidence
├── temporal evidence
├── trajectory evidence
├── behaviour evidence
└── model confidence
```

### Stage 9 --- Report

For every candidate:

-   vessel identifier;
-   evidence summary;
-   map;
-   trajectory;
-   proximity;
-   timing;
-   anomaly flags;
-   score components;
-   uncertainty;
-   data provenance.

------------------------------------------------------------------------

## 7. Important Scientific Constraints

### 7.1 SAR dark formations are not automatically oil

Possible look-alikes include:

-   low-wind areas;
-   natural films;
-   biogenic slicks;
-   ship wakes;
-   current/weather-related effects;
-   other non-oil dark formations.

Therefore, detection must be evaluated specifically against hard
negatives.

### 7.2 Origin is uncertain

A slick observed at time T is the result of prior transport and
transformation.

The system should therefore prefer:

``` text
origin probability region
```

over:

``` text
exact origin point
```

unless the evidence genuinely supports a tighter estimate.

### 7.3 AIS is not proof of causality

A vessel being near the origin does not establish that it caused the
spill.

### 7.4 Error compounding

The system is a chain:

``` text
detection error
   -> geometry error
   -> drift error
   -> origin error
   -> AIS candidate error
   -> attribution error
```

The evaluation must therefore test the pipeline both component-wise and
end-to-end.

------------------------------------------------------------------------

## 8. Recommended Technology Baseline

### AI / SAR

-   Python
-   PyTorch
-   Rasterio
-   GDAL
-   NumPy
-   SciPy
-   GeoPandas
-   Shapely
-   OpenCV
-   scikit-learn

Model candidates:

-   U-Net / U-Net variants as baselines, with DeepLabV3+ evaluated as a candidate final architecture;
-   DeepLabV3+;
-   SegFormer or another transformer only if computationally justified.

Start with a strong conventional segmentation baseline before adding
complexity.

### Drift

Primary candidates:

-   OpenDrift/OpenOil for an open, Python-oriented pipeline;
-   WebGNOME/GNOME where its input/output and operational assumptions
    fit the use case.

OpenDrift: https://opendrift.github.io/

NOAA GNOME:
https://response.restoration.noaa.gov/oil-and-chemical-spills/oil-spills/response-tools/gnome

### Backend

-   FastAPI
-   Pydantic
-   PostgreSQL/PostGIS
-   GeoJSON for geospatial interchange

### Frontend

-   React
-   Leaflet or MapLibre/Mapbox-compatible mapping stack
-   deck.gl only if high-volume trajectory rendering becomes necessary

### Deployment

-   Docker
-   Docker Compose for development/demo
-   object storage for imagery
-   PostGIS for vector/geospatial metadata

------------------------------------------------------------------------

## 9. Final Product Definition

The final application should behave like an investigation workspace:

``` text
UPLOAD / SELECT SCENE
        |
        v
DETECTION
        |
        v
SPILL CHARACTERISATION
        |
        v
ORIGIN RECONSTRUCTION
        |
        v
AIS RECONSTRUCTION
        |
        v
CANDIDATE VESSELS
        |
        v
EVIDENCE COMPARISON
        |
        v
REPORT
```

The UI should answer five questions:

1.  **Where is the spill?**
2.  **What does the spill look like geometrically?**
3.  **Where/when could it have originated?**
4.  **Which vessels were consistent with that origin?**
5.  **Why did the system flag each candidate?**

------------------------------------------------------------------------

## 10. Validation Strategy

The system needs three validation layers.

### Layer A --- Detection

Metrics:

-   IoU;
-   Dice/F1;
-   precision;
-   recall;
-   false-positive rate;
-   image-level oil/no-oil classification;
-   hard-negative performance.

### Layer B --- Drift/origin

Use synthetic scenarios with known origin:

-   origin distance error;
-   time error;
-   containment rate of true origin inside predicted uncertainty region;
-   sensitivity to wind/current perturbations.

### Layer C --- Attribution

On synthetic ground-truth scenarios:

-   top-k candidate recall;
-   false-attribution rate;
-   rank stability under environmental uncertainty;
-   sensitivity to AIS gaps;
-   performance under dense traffic.

------------------------------------------------------------------------

## 11. Data Provenance Requirement

Every result should retain:

``` text
scene_id
scene_source
scene_timestamp
model_version
model_threshold
drift_model_version
metocean_source
AIS_source
AIS_time_range
AIS_spatial_range
random_seed
processing_timestamp
```

This makes the system reproducible and makes every investigation
auditable.

------------------------------------------------------------------------

## 12. Research Validation Policy

The project documentation should classify claims as:

### Verified primary/official

-   SIH problem statement: official SIH portal.
-   Sentinel-1 availability/specification: Copernicus Data Space.
-   AIS sample/reference source: MarineCadastre/NOAA.
-   Oil-spill training dataset: Zenodo record.
-   OOSA capability: INCOIS.
-   GNOME capability: NOAA.
-   CleanSeaNet capability: EMSA.

### Peer-reviewed prior art

-   Luo et al. 2024.
-   Busler et al. 2015.

### Engineering proposal

Anything we choose to add beyond those sources, such as:

-   a particular segmentation architecture;
-   a particular scoring formula;
-   an uncertainty ensemble design;
-   a database schema.

These should be labelled as **our proposed implementation**, not as
requirements from NTRO.

------------------------------------------------------------------------

## 13. Bottom Line

The project is best understood as:

> **An automated geospatial investigation pipeline that detects an oil
> slick from satellite imagery, reconstructs its probable origin using
> environmental drift modelling, and correlates the resulting space-time
> origin window with historical AIS to generate explainable
> vessel-investigation leads.**

The individual scientific components already exist. The engineering
challenge is making them operate as one reproducible, uncertainty-aware
system.
