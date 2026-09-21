# SIH26143 Documentation — Verified Revision 2 (September 2026)

# SIH26143 --- Datasets, Data Collection, Synthetic Data and Provenance

## 1. Dataset Strategy

SIH26143 does not provide one end-to-end dataset containing:

``` text
SAR image
+
oil mask
+
wind/current
+
spill origin
+
AIS
+
source vessel (if independently documented)
```

Instead, the official SIH page references separate data resources and
explicitly allows synthetic AIS where real AIS is unavailable.

Therefore the project should maintain four data layers:

``` text
Layer 1 — SAR training data
Layer 2 — Operational satellite scenes
Layer 3 — Metocean forcing
Layer 4 — AIS
```

Synthetic data should be an additional controlled testing layer.

------------------------------------------------------------------------

# 2. Official SIH Data References

The official SIH portal entry for SIH26143 lists:

1.  AIS format/sample data via MarineCadastre.
2.  Real AIS may be used if available.
3.  Synthetic AIS may be prepared for the spill region if real AIS is
    unavailable.
4.  Zenodo Sentinel-1 SAR Oil Spill Dataset.

Official SIH portal: https://www.sih.gov.in/sih2026PS

The relevant official entry identifies the problem as SIH26143 and NTRO
as the organisation.

------------------------------------------------------------------------

# 3. Dataset A --- Zenodo Sentinel-1 Oil-Spill Dataset

## 3.1 Purpose

Use this dataset primarily for:

-   oil-spill segmentation;
-   oil/no-oil discrimination;
-   look-alike robustness;
-   model training;
-   model validation;
-   model testing.

Do not treat it as an end-to-end vessel-attribution dataset.

------------------------------------------------------------------------

## 3.2 Dataset parts

The Zenodo records identify three parts.

### Part I

Official record:

https://zenodo.org/records/8346860

Contains training/validation oil-spill imagery and masks.

The record reports approximately 40.7 GB of files:

-   oil-spill images;
-   oil-spill masks.

### Part II

Official record:

https://zenodo.org/records/8253899

Contains:

-   look-alike images;
-   no-oil images;
-   corresponding masks.

The dataset documentation states that look-alike ground truth is zero
because the dataset is focused on oil-spill segmentation.

### Part III

Official record:

https://zenodo.org/records/13761290

Contains the test images and ground truth.

The record reports approximately 9.9 GB.

------------------------------------------------------------------------

## 3.3 Image structure

Zenodo explicitly states that the relevant Sentinel-1 Sigma0 images:

-   are in decibels;
-   contain VV and VH;
-   are 2048×2048×2;
-   are georeferenced.

The masks are not georeferenced and were treated as matrices for ML

**Operational geospatial caution:** these training/test masks must not be treated as georeferenced ground truth for operational polygon generation. Operational spill polygons must be derived from the model prediction on a georeferenced Sentinel-1 scene while preserving that scene's spatial transform/CRS.
training/validation/testing.

This distinction is critical.

### Training dataset

Use:

``` text
VV + VH
      ↓
segmentation model
      ↓
mask
```

### Operational system

Use a separately acquired georeferenced scene where the output mask can
be projected back into geographic coordinates.

------------------------------------------------------------------------

## 3.4 Important dataset limitation

The masks are not georeferenced.

Therefore:

``` text
Zenodo mask
≠
ready-to-use GIS polygon
```

The training dataset teaches the model the segmentation task.

For operational geospatial output, the model must run on a georeferenced
satellite product while preserving its spatial transform.

------------------------------------------------------------------------

# 4. Dataset B --- Operational Sentinel-1

## 4.1 Official source

Copernicus Data Space Ecosystem:

https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-1

Sentinel-1 provides C-band SAR and can acquire day/night and in cloudy
conditions.

The current Copernicus Data Space documentation lists Sentinel-1 GRD
products worldwide from October 2014 to present, with VV/VH among the
available polarization bands.

------------------------------------------------------------------------

## 4.2 Recommended product

For the prototype, use:

``` text
Sentinel-1 GRD
```

Prefer scenes that provide:

-   VV;
-   VH;
-   acquisition time;
-   georeferencing;
-   suitable maritime coverage.

------------------------------------------------------------------------

## 4.3 Acquisition procedure

1.  Create a Copernicus Data Space account if required.
2.  Define AOI.
3.  Select Sentinel-1.
4.  Select GRD.
5.  Select acquisition date range.
6.  Filter by polarization.
7.  Download the scene.
8.  Preserve original metadata.
9.  Process the scene.
10. Record source/product ID.

------------------------------------------------------------------------

# 5. Dataset C --- AIS

## 5.1 SIH reference

The official SIH statement references:

https://marinecadastre.gov/accessais/

The NOAA/MarineCadastre AccessAIS tool provides U.S. vessel traffic data
across user-defined areas and time periods.

NOAA documentation: https://coast.noaa.gov/digitalcoast/tools/ais.html

------------------------------------------------------------------------

## 5.2 Current operational caveat

The current MarineCadastre documentation should be checked at acquisition time because ordering-service availability can change. MarineCadastre also provides bulk AIS download options.

https://marinecadastre.gov/ais

Therefore the project should not hard-code dependence on the interactive
ordering workflow.

------------------------------------------------------------------------

## 5.3 MarineCadastre geographic limitation

NOAA describes AccessAIS as covering:

-   contiguous U.S. coastal areas;
-   Alaska;
-   Hawaii;
-   U.S. territories.

This means MarineCadastre is an excellent **AIS format/reference source
and U.S.-coverage data source**, but it is not automatically a global or
Indian-ocean AIS feed.

For an Indian-waters demonstration, use a legitimate AIS source with
appropriate geographic coverage or use synthetic AIS as explicitly
permitted by the SIH statement.

------------------------------------------------------------------------

## 5.4 AIS fields

At minimum, normalize to:

``` text
mmsi
timestamp
latitude
longitude
sog
cog
heading
```

Additional useful fields where legitimately available:

``` text
imo
ship_type
length
width
destination
draught
navigation_status
```

Do not assume every provider supplies all fields.

------------------------------------------------------------------------

# 6. AIS Alternatives for Indian-Waters Demonstration

The team should investigate legitimate data access options such as:

-   government/authorized AIS sources;
-   research datasets with explicit licensing;
-   commercial AIS APIs if available to the team;
-   public research datasets;
-   synthetic AIS.

Do not scrape or redistribute restricted AIS data without checking the
provider's terms.

The system architecture should make the AIS provider replaceable:

``` text
AISProvider interface
   ├── MarineCadastreProvider
   ├── ResearchAISProvider
   ├── CommercialAISProvider
   └── SyntheticAISProvider
```

------------------------------------------------------------------------

# 7. Dataset D --- Ocean Currents

## 7.1 Recommended source

Copernicus Marine Global Ocean Physics Analysis and Forecast:

Product ID:

``` text
GLOBAL_ANALYSISFORECAST_PHY_001_024
```

Official product:
https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description

The product provides global ocean physics fields and includes
eastward/northward water velocity. Current datasets are available at
multiple temporal resolutions.

The service documentation currently lists 6-hourly current data and
hourly surface-current products.

------------------------------------------------------------------------

## 7.2 Recommended use

For a first implementation:

``` text
surface u current
+
surface v current
```

matched to:

``` text
latitude
longitude
timestamp
```

Use the surface layer unless the selected oil model requires a different
depth.

------------------------------------------------------------------------

# 8. Dataset E --- Wind

## 8.1 Recommended source

Copernicus Climate Data Store ERA5:

https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels

ERA5 provides hourly reanalysis data from 1940 to present.

For the drift system, use appropriate near-surface wind variables and
retain the exact variable name/configuration in the experiment metadata.

------------------------------------------------------------------------

# 9. Optional Dataset --- Waves

Wave forcing can matter for oil transport/weathering.

Copernicus Marine provides a Global Ocean Waves Analysis and Forecast
product:

https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description

For the first prototype, waves can remain optional.

Do not introduce them unless the selected drift model and experiment
justify them.

------------------------------------------------------------------------

# 10. Indian Reference System --- INCOIS OOSA

Official source:

https://oosa.incois.gov.in/

INCOIS describes OOSA as an operational online oil-spill advisory system
for the Indian coast.

Its documentation states that it integrates:

-   an oil-spill trajectory model;
-   ocean circulation models;
-   atmospheric models;
-   GIS.

INCOIS also states that GNOME is used as the oil-spill trajectory model
and that the model is forced with wind and current data.

This is an important Indian technical reference.

------------------------------------------------------------------------

# 11. Drift Engine Options

## Option A --- OpenDrift/OpenOil

OpenDrift: https://opendrift.github.io/

OpenOil documentation:
https://opendrift.github.io/autoapi/opendrift/models/openoil/openoil/index.html

Advantages:

-   open source;
-   Python;
-   Lagrangian trajectory framework;
-   OpenOil module;
-   suitable for integration into a software pipeline.

## Option B --- NOAA GNOME/WebGNOME

NOAA:
https://response.restoration.noaa.gov/oil-and-chemical-spills/oil-spills/response-tools/gnome

GNOME documentation confirms backward trajectory capability for
estimating where a mystery spill may have originated.

NOAA states that the desktop GNOME version is no longer maintained and has been superseded by the WebGNOME/GNOME suite. The NOAA documentation also states that the desktop
version is no longer maintained and has been superseded by WebGNOME.
Therefore, do not build a new architecture around an obsolete
desktop-only workflow without checking the current WebGNOME/tooling
path.

------------------------------------------------------------------------

# 12. Dataset F --- Historical Incident Validation

A strong final evaluation should use at least one documented real spill
where independent information exists.

Candidate sources for incident discovery:

-   EMSA CleanSeaNet publications;
-   national maritime/environmental agencies;
-   coast guards;
-   peer-reviewed case studies;
-   documented Indian incidents.

Do not choose an incident merely because a news article mentions an oil
spill.

Prefer cases where there is enough evidence to establish:

``` text
date
location
satellite observation
independent incident information
```

If a source vessel (if independently documented) is independently documented, keep that
information separate from model inputs so it can be used as an
evaluation reference rather than leaked into the model.

------------------------------------------------------------------------

# 13. Synthetic Data Strategy

Synthetic data is **recommended**, especially for integration testing.

Why?

Real datasets rarely provide:

``` text
known origin
+
known release time
+
known source vessel
+
known AIS
+
known environmental forcing
```

Synthetic scenarios let you test the entire chain.

------------------------------------------------------------------------

# 14. Synthetic AIS Generator

Generate vessel trajectories from predefined motion models.

Example fields:

``` text
mmsi
timestamp
lat
lon
sog
cog
heading
scenario_id
is_source_vessel
```

Example vessel classes:

``` text
Vessel A — source vessel
Vessel B — nearby innocent vessel
Vessel C — crosses area later
Vessel D — passes outside origin region
Vessel E — AIS gap
```

------------------------------------------------------------------------

# 15. Synthetic Scenario 1 --- Single Candidate

Ground truth:

``` text
Origin:
Lat = X
Lon = Y

Release:
T = T0

Source vessel:
MMSI = SYN001
```

Generate:

1.  vessel trajectory;
2.  release;
3.  drift;
4.  observed slick;
5.  AIS observations.

Expected result:

``` text
SYN001
```

should be identified as a high-priority candidate.

------------------------------------------------------------------------

# 16. Synthetic Scenario 2 --- Dense Traffic

Generate:

``` text
Source vessel
+
5 nearby vessels
+
multiple crossing tracks
```

This tests whether the algorithm can distinguish:

``` text
nearby
```

from:

``` text
spatio-temporally consistent
```

------------------------------------------------------------------------

# 17. Synthetic Scenario 3 --- AIS Gap

Source vessel:

``` text
AIS visible
    ↓
GAP
    ↓
AIS visible
```

The system should not automatically conclude:

``` text
AIS gap = illegal discharge
```

Instead:

``` text
AIS gap = behavioural/contextual evidence
```

------------------------------------------------------------------------

# 18. Synthetic Scenario 4 --- No Matching Vessel

Create a spill whose origin has no vessel in the AIS dataset.

Expected result:

``` text
No sufficiently consistent candidate found.
```

This is an important false-positive/abstention test.

------------------------------------------------------------------------

# 19. Synthetic Scenario 5 --- Environmental Uncertainty

Run the same release under several forcing perturbations.

Example:

``` text
Run 1 — nominal
Run 2 — altered wind
Run 3 — altered current
Run 4 — altered release age
...
```

Measure:

-   origin spread;
-   candidate rank stability.

------------------------------------------------------------------------

# 20. Synthetic Data Should Not Fake Reality

Every synthetic record should carry:

``` text
data_status = "synthetic"
```

The UI should show:

``` text
DEMO / SYNTHETIC DATA
```

Never present a synthetic vessel or spill as a real NTRO/Indian
incident.

------------------------------------------------------------------------

# 21. Recommended Storage Layout

``` text
data/
├── raw/
│   ├── sentinel1/
│   ├── ais/
│   ├── wind/
│   └── currents/
│
├── processed/
│   ├── sar/
│   ├── masks/
│   ├── spills/
│   ├── drift/
│   └── ais/
│
├── synthetic/
│   ├── scenarios/
│   ├── ais/
│   ├── spills/
│   └── forcing/
│
└── metadata/
    ├── dataset_registry.csv
    └── provenance.json
```

------------------------------------------------------------------------

# 22. Dataset Registry

Maintain a registry such as:

``` text
dataset_id
name
provider
url
version/date
coverage
format
license
download_date
checksum
purpose
status
notes
```

Example:

``` text
S1-ZEN-P1
Sentinel-1 SAR Oil Spill Dataset Part I
Zenodo
10.5281/zenodo.8346860
training
```

------------------------------------------------------------------------

# 23. Data Provenance

For every derived file record:

``` text
source_file
source_dataset
processing_script
processing_version
parameters
timestamp
software_version
```

For ML:

``` text
dataset_version
train_split
val_split
test_split
random_seed
model_commit
```

For drift:

``` text
forcing_dataset
forcing_time_range
model
parameters
random_seed
```

For AIS:

``` text
provider
coverage
download_time
filter
interpolation_rule
```

------------------------------------------------------------------------

# 24. Licensing and Attribution

Before redistribution:

-   check dataset licence;
-   retain required attribution;
-   do not redistribute restricted AIS;
-   distinguish government/public-domain material from third-party
    datasets;
-   keep raw restricted data outside public repositories where required.

MarineCadastre's FAQ states that derived AIS products can be provided on
public websites provided the MarineCadastre data are cited, while also
referring users to applicable terms/copyright notices.

Source: https://coast.noaa.gov/data/marinecadastre/ais/faq.pdf

------------------------------------------------------------------------

# 25. Dataset Selection for the First Prototype

Recommended minimum:

``` text
1. Zenodo Sentinel-1 dataset
2. One real georeferenced Sentinel-1 scene
3. ERA5 wind
4. Copernicus Marine surface currents
5. Synthetic AIS
6. Synthetic controlled spill scenarios
```

Then add:

``` text
7. Real AIS
8. Indian validation incident
9. Optional waves
10. Optional optical imagery
```

------------------------------------------------------------------------

# 26. Data Acquisition Priority

### Priority 1

Zenodo Part I + II + III.

### Priority 2

Copernicus Sentinel-1.

### Priority 3

Copernicus Marine currents.

### Priority 4

ERA5 wind.

### Priority 5

Synthetic AIS.

### Priority 6

Legitimate real AIS for the chosen test region.

### Priority 7

Real documented incident validation.

------------------------------------------------------------------------

# 27. Key Dataset Reality

The most important fact is:

> **The Zenodo dataset trains the SAR detector; it does not provide the
> AIS or environmental data needed to reconstruct the spill source.**

The SIH statement itself anticipates this multi-source design by
separately referencing AIS and satellite data and by allowing synthetic
AIS when real AIS is unavailable.

------------------------------------------------------------------------

# 28. Recommended First Demonstration Dataset

For a controlled engineering demonstration:

``` text
Synthetic source vessel
       ↓
Known release time/location
       ↓
Known environmental forcing
       ↓
OpenDrift/OpenOil
       ↓
Synthetic observed slick
       ↓
Detection/geometry pipeline
       ↓
Backward reconstruction
       ↓
Synthetic AIS
       ↓
Candidate ranking
```

Then replace one synthetic component at a time with real data:

``` text
Synthetic SAR → Real Sentinel-1
Synthetic AIS → Real AIS
Synthetic forcing → Real reanalysis
```

This creates a scientifically traceable development path.
