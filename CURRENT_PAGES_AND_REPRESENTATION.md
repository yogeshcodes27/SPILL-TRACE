# SPILLTRACE — Current Pages, Views, and UI Representations

This document is an exhaustive inventory of the pages, views, sections, modals, and data structures currently implemented in the **SPILLTRACE** codebase. It reflects strictly what is present in the code today.

---

## 1. Top-Level View Routing (`src/App.jsx`)

The application root implements a client-side view router controlled by `activeTab` state and URL hash matching:

| View Key | URL Hash | Component Rendered | Role / Description |
| :--- | :--- | :--- | :--- |
| `'landing'` | Default / `#` | `<HeroSection />`, `<DetectionLayers3D />`, `<SlickCharacterisationScroll />`, `<DriftDynamicsSection />`, `<EvidenceFusionScroll />` | Long-form editorial investigation narrative with 3D and scrollytelling visual chapters. |
| `'incidents'` | `#incidents` | `<IncidentsArchive />` | Full-page maritime incident catalog, interactive map, and case dossier viewer. |
| `'detect'` | `#detect` | `<DetectionWorkspace />` | Operational satellite SAR analysis workspace with 4-stage imagery inspection. |
| **Global Overlay** | N/A (Modal) | `<InvestigationConsoleModal />` | 7-tab full-screen forensic investigation console triggered by "OPEN CONSOLE" buttons. |

---

## 2. View 1: Landing Page (`activeTab === 'landing'`)

The landing page is assembled sequentially as a vertical narrative scroll divided into distinct operational chapters:

### 2.1 Navigation Header (`src/components/layout/Navbar.jsx`)
- **Representation**: Fixed top navigation bar (`h-16`), semi-transparent white with backdrop blur (`bg-white/95 backdrop-blur-md`) and bottom border (`border-[#E5E5E5]`).
- **Elements Present**:
  - **Brand Emblem & Typography**: Embedded logo image (`/images/spilltrace_logo.png`), uppercase text `SPILLTRACE | MARITIME INTELLIGENCE`, tagline `CLEANER OCEANS · SAFER TOMORROWS`.
  - **Navigation Links**:
    - `INCIDENTS` (switches view to `#incidents`)
    - `DETECTION` (switches view to `#detect`)
    - `GEOMETRY` (smooth-scrolls to `#geometry`)
    - `DRIFT` (smooth-scrolls to `#reconstruction`)
    - `ATTRIBUTION` (smooth-scrolls to `#attribution`)
  - **Action Button**: `OPEN CONSOLE →` (opens the 7-tab `InvestigationConsoleModal`).

---

### 2.2 Chapter 01: Hero Ocean Dynamics (`src/components/hero/HeroSection.jsx` & `HeroOcean3D.jsx`)
- **Representation**: Dark-themed full-viewport section (`min-h-screen`, `bg-[#0A0A0A]`, white typography).
- **Elements Present**:
  - Case metadata badge: `MARITIME INCIDENT // CASE 2026-BB-0001` (or active incident ID).
  - Main headline: `AN OIL SPILL / IS DETECTED AT SEA.`
  - Editorial description of physical wave damping and spatio-temporal tracking.
  - Linear pipeline sequence breadcrumb: `OBSERVE → DETECT → DRIFT → ORIGIN → AIS → ATTRIBUTION`.
  - **Interactive Mode Switcher**:
    - **`3D PHYSICAL SIMULATION`**: Mounts `HeroOcean3D.jsx` using **Three.js WebGL**. Renders an animated 3D ocean mesh (`PlaneGeometry` with custom sinusoidal wave displacements, specular lighting, and camera orbit).
    - **`SENTINEL-1 SAR (RADAR)`**: Renders an SVG satellite radar graticule with coordinate axes, orbital frame metadata, and backscatter damping patterns.
  - Anchor button: `INVESTIGATE DETECTION ↓` (scrolls to `#detect`).

---

### 2.3 Chapter 02: 3D Progressive Layer Assembly (`src/components/detection/DetectionLayers3D.jsx`)
- **Representation**: Sticky 3D scrollytelling container (`h-[400vh]` scroll track with a pinned full-screen viewport).
- **Elements Present**:
  - **Three.js 3D Perspective Animation**: Renders 4 separate textured image planes along the Z-axis in 3D space:
    1. `01 RAW SAR` (`/images/layers/layer1_raw_sar.jpg`): Sentinel-1 C-SAR VV/VH tile in 3D diamond isometric angle.
    2. `02 SEGMENTATION` (`/images/layers/layer2_segmentation.jpg`): AI segmentation mask elevated in 3D above the base.
    3. `03 LOOK-ALIKE CHECK` (`/images/layers/layer3_lookalike_check.jpg`): Polarimetric entropy filtering layer showing candidate vs false positive classifications.
    4. `04 VERIFIED MASK` (`/images/layers/layer4_verified_mask.jpg`): The 3D diamond perspective straightens flat into a top-down projection, merging layers onto the exact 18.42 km² green slick polygon with centroid coordinates.
  - **Left Rail**: Vertical stage selector with clickable indicators (01, 02, 03, 04) that smooth-scroll to exact stage heights.
  - **Dynamic Stage Cards**: Displaying technical specifications (sensor, orbit 6102, 10m resolution, ResNet-101 ASPP backbone, polarimetric entropy H).

---

### 2.4 Chapter 03: Slick Characterisation (`src/components/analysis/SlickCharacterisationScroll.jsx`)
- **Representation**: Sticky scroll-driven geometric analysis view (`h-[400vh]`) on a crisp white background.
- **Elements Present**:
  - **Pinned Central Viewport**: Renders an SVG vector projection of the segmented oil spill polygon.
  - **4 Scroll Progression Stages**:
    - **Stage 01 (0–25%) `DETECTED FORM`**: Displays clean silhouette polygon, area = 18.42 km², perimeter = 48.6 km.
    - **Stage 02 (25–50%) `MEASURE THE SHAPE`**: Overlays major axis dimension line (21.8 km @ 298.4° NW orientation), minor axis (2.4 km), and orthogonal bounding box.
    - **Stage 03 (50–75%) `READ THE SPREAD`**: Marks centroid coordinates (11.238°N, 79.814°E), directional spread vectors, and coupled CMEMS environmental surface flow.
    - **Stage 04 (75–100%) `TEMPORAL CONSTRAINT`**: Displays estimated release age constraint (~6–12 hours), slick diffusion timeline, and transition callout to hydrodynamic drift.
  - **Dynamic Stage HUD Card**: Updates live as the user scrolls, showing metrics and stage labels.

---

### 2.5 Chapter 04: Drift Dynamics (`src/components/drift/DriftDynamicsSection.jsx`)
- **Representation**: Full-width dark section (`min-h-[92vh]`, `bg-[#0F0F0F]`, white text and line art).
- **Elements Present**:
  - Headline: `THE SLICK MOVES. / TRACE IT BACK.` (or `FORECAST AHEAD.`).
  - **Drift Mode Toggle Buttons**:
    - `← 6H BACKWARD HINDCAST (ESTIMATED ORIGIN)`
    - `+24H FORWARD FORECAST (RESPONSE) →`
  - **Environmental Forcing Card**:
    - `ERA5 10M WIND`: 14.2 kn @ 054°
    - `CMEMS CURRENT`: 0.62 m/s @ 234°
    - `STOKES DRIFT`: 0.11 m/s (Wave)
    - `INTEGRATOR`: RK4 (Δt = 30m)
  - **Animated Nautical SVG**:
    - **Hindcast Mode**: Animated dashed line (`smooth-line-hindcast`) flowing backward from observed location (14:32) to estimated origin (08:52), with spinning concentric uncertainty rings (`smooth-spin-ring`, `smooth-spin-ellipse`).
    - **Forecast Mode**: Expanding dispersion cone projecting future trajectory at +6h, +12h, and +24h landfall risk horizons.

---

### 2.6 Chapter 05: Explainable Evidence Fusion (`src/components/attribution/EvidenceFusionScroll.jsx`)
- **Representation**: Editorial white section with an asymmetrical 2-column layout (4 cols editorial text, 8 cols nautical chart).
- **Elements Present**:
  - Headline: `FROM TRACKS / TO LEADS.`
  - Analytical statement: "Relevant vessel movement is correlated with the estimated spill origin and time window."
  - Metadata strip: Seaway Corridor (Tamil Nadu Shelf), Estimated Origin (11.182°N, 79.742°E), Origin Window (08:40–09:05 UTC), Potential Association (High).
  - **Nautical Vector Field (SVG)**:
    - Nautical chart graticule lines and coordinate annotations.
    - Origin uncertainty region with dashed buffer zone.
    - 4 vessel tracks:
      - `Vessel A` (Crude Oil Tanker) highlighted in solid black with course vector 298.4° and speed 13.8 kn.
      - `Vessel B`, `C`, `D` rendered as faded background tracks outside time/space correlation.
    - **Live Animated Marker**: Real-time micro-interaction using `requestAnimationFrame` moving an indicator slowly along Vessel A's track.
    - Association callout tag: Proximity 0.4 km, Time Match 08:52 UTC, Trajectory alignment.

---

### 2.7 Platform Footer & CTA (`src/components/layout/Footer.jsx` & `#console`)
- **Representation**: Full-width gray call-to-action banner (`#FAFAFA`) with "OPEN INVESTIGATION CONSOLE →" button, followed by structured footer with legal/technical disclaimers, data citations (Copernicus, NOAA, INCOIS, Zenodo), and system status.

---

## 3. View 2: Incidents Archive Page (`src/components/incidents/IncidentsArchive.jsx`)

Activated when navigating to `#incidents` (or clicking `INCIDENTS` in the navbar):

### 3.1 Top Filter & Search Toolbar
- **Search input**: Filters incidents in real time across ID, basin, coordinates, sensor, and candidate vessel.
- **Status pills**: `ALL`, `ACTIVE`, `REVIEW`, `RESOLVED`.
- **Case Creation CTA**: `+ NEW INCIDENT CASE` (opens a modal to add a manual case).

### 3.2 Two-Column Operational Layout
- **Left Column — Incident Registry Table**:
  - Interactive table displaying all 12 incidents with:
    - Case ID (`INC-2026-001` through `INC-2026-012`)
    - Basin / Sector (`Bay of Bengal`, `Arabian Sea`, `Gulf of Oman`, etc.)
    - Coordinates (`Lat, Lon`)
    - Detection Timestamp (e.g. `17 SEP 2026 · 06:42 UTC`)
    - Area & Volume (`18.42 km²`, `144.6 m³`)
    - Sensor Platform (`Sentinel-1 C-SAR`, `Radarsat-2`, `Cosmo-SkyMed`)
    - Stage Progress bar (Stage 01 to Stage 06)
    - Lead Candidate Vessel
    - Action buttons: Select row, Export GeoJSON/PDF notice.
- **Right Column — Case Detail Dossier & Map**:
  - **Interactive Maritime Map (`src/components/incidents/MaritimeIncidentsMap.jsx`)**:
    - SVG-based chart depicting the Indian Ocean, Arabian Sea, Bay of Bengal, and littoral shipping corridors.
    - Pinned interactive markers for all 12 incidents with active incident highlighted in cyan.
    - Clicking any pin selects that incident.
  - **Selected Incident Header**: Case code, status, confidence score, volume, sensor.
  - **Analyst Assessment Log**: Narrative tactical description.
  - **Incident Timeline**: Expandable chronological sequence (Observed → Verified → Characterised → Hindcast → AIS Intersection → Attribution Dossier).
  - **Action Buttons**:
    - `OPEN INVESTIGATION CONSOLE →` (opens modal for selected case).
    - `ANALYSE IN DETECTION PIPELINE →` (switches view to `#detect`).

---

## 4. View 3: Detection Workspace (`src/components/detection/DetectionWorkspace.jsx`)

Activated when navigating to `#detect` (or clicking `DETECTION` in the navbar):

### 4.1 Telemetric Breadcrumb & Status Bar
- Breadcrumb: `01 / INCIDENTS / 02 / DETECTION WORKSPACE / CASE: {id} ({basin})`.
- Satellite telemetry strip: Platform (Sentinel-1A), Sensor (C-SAR), Acquisition (08:42 UTC), Polarisation (VV), Location, Status (`ANALYSIS READY`).

### 4.2 Main Satellite SAR Analysis Viewer
- **Pipeline State Selector Buttons**:
  1. `01 // RAW SAR`: Pre-classification radiometric tile showing capillary wave damping (-8.2 dB).
  2. `02 // SEGMENTATION`: DeepLabV3+ multiscale boundary extraction (87% confidence, 18.4 km² candidate area).
  3. `03 // LOOK-ALIKE CHECK`: Contextual and polarimetric screening of candidate regions.
  4. `04 // VERIFIED SLICK`: Final confirmed hydrocarbon slick mask ready for characterisation.
- **Zoom Toggle**: Switch between `100% EXTENT` and `150% MAGNIFY`.
- **Large Satellite Viewer**: Displays high-resolution radar imagery textures (`/images/layers/layer*.jpg`) with overlaid coordinate graticule (`11°15'00"N / 79°48'00"E`, `ORBIT 6102 · FRAME 048`).
- **Dynamic Heads-Up Display (HUD)**: Overlays on top of the satellite image, changing content per pipeline state.

### 4.3 Look-Alike Verification Ledger
- **Candidate Region Comparison Table**:
  - `REGION 01` (11.238°N, 79.814°E): Candidate mineral oil → `✓ VERIFIED (87%)` (sharp damping boundary, 21.8 km major axis).
  - `REGION 02` (11.295°N, 79.710°E): Low-wind calm shadow → `✕ REJECTED` (ERA5 wind < 2.5 kn, diffuse boundaries).
  - `REGION 03` (11.190°N, 79.880°E): Vessel wake shear line → `✕ REJECTED` (collinear with container shipping track).

### 4.4 Collapsible Telemetry & Metadata Drawer
- Expandable panel showing: Satellite platform, Sensor system (5.405 GHz), Acquisition time, Polarisation mode, Scene ID (`S1A_IW_GRDH_1SDV_20260917T064218`), Spatial resolution (10m), Centroid coordinates, Calibration status.
- Expected API contracts documentation: `GET /incidents/{id}/detection`, `POST /detect-slick`.

---

## 5. Overlay Workspace: Investigation Console Modal (`src/components/console/InvestigationConsoleModal.jsx`)

Triggered from the navbar or any "OPEN CONSOLE" button as a modal overlay (`fixed inset-0 z-[100] bg-black/80 backdrop-blur-md`):

### 5.1 Modal Frame
- Header: Emblem logo, `SPILLTRACE // FORENSIC INVESTIGATION CONSOLE · {incident.id}`, basin and coordinates, `✕ CLOSE` button.
- Status Footer: `SPILLTRACE MARITIME INTELLIGENCE PLATFORM | BUILT WITH REACT & THREE.JS`.

### 5.2 7 Operational Tabs Present:
1. **`01 ARCHIVE`**:
   - Case summary card (ID, status, basin, slick area, estimated volume, sensor platform, top candidate vessel).
   - Quick action buttons: `INVESTIGATE DETECTION →`, `HINDCAST ORIGIN →`.
2. **`02 DETECTION`**:
   - Sentinel-1 C-Band dual-pol GRDH scene metadata.
   - Satellite radar placeholder frame displaying incident coordinates and extracted slick area.
3. **`03 SLICK ANALYSIS`**:
   - Mineral oil probability: `91.4% (Illustrative / Demo)`.
   - Low-wind shadow probability: `5.2%`.
   - Major axis: `21.8 km @ 298.4° NW`.
   - Origin-to-observation time: `6–12 hours`.
4. **`04 DRIFT & ORIGIN`**:
   - Estimated origin: `{coordinates} (±2.8 km 95% CI · Origin Uncertainty)`.
   - Plausible release window: `08:40 – 09:20 UTC`.
   - Drift distance reversed: `16.8 Nautical Miles`.
5. **`05 AIS TRAFFIC`**:
   - Traffic filtering funnel: `428 raw tracks → 37 spatial intersections → 8 temporal co-locations → 3 candidate vessels`.
   - Top candidate vessel callout (`VESSEL A — HIGH ASSOCIATION`).
   - Anomaly profile: Behavioural anomaly & AIS transmission-gap anomaly logged.
6. **`06 EVIDENCE FUSION`**:
   - Composite association score: `94.2 / 100` (`HIGH ASSOCIATION · ILLUSTRATIVE / DEMO`).
   - Spatio-temporal breakdown: Proximity `0.4 km`, Time match `08:52 UTC`, Trajectory `298.4° aligned`, Speed `13.8 kn`.
7. **`07 EVIDENCE REPORT`**:
   - Official investigative summary report for the active case.
   - Recommendation for port state inspection.
   - `DOWNLOAD OFFICIAL DOSSIER (PDF/GEOJSON)` action button.

---

## 6. Current Data Catalog (`src/data/incidentsData.js`)

Contains 12 predefined incidents representing different Indian Ocean and regional maritime basins:

| ID | Basin / Sector | Coordinates | Area | Sensor | Status | Current Stage | Lead Candidate Vessel |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INC-2026-001** | Bay of Bengal (Tamil Nadu) | 11.238°N, 79.814°E | 18.42 km² | Sentinel-1 C-SAR | ACTIVE | 03 DRIFT HINDCAST | VESSEL A (Crude Oil Tanker) |
| **INC-2026-002** | Arabian Sea Deep (Mumbai High) | 18.421°N, 70.114°E | 2.14 km² | Sentinel-1 C-SAR | REVIEW | 04 AIS CORRELATION | VESSEL D (Bulk Carrier) |
| **INC-2026-003** | Gulf of Oman (Hormuz Ingress) | 24.305°N, 57.852°E | 7.31 km² | Radarsat-2 | REVIEW | 05 ATTRIBUTION | VESSEL E (Product Tanker) |
| **INC-2026-004** | Malacca Strait North | 03.150°N, 100.220°E | 1.88 km² | Sentinel-1 C-SAR | RESOLVED | 06 DOSSIER ARCHIVED | VESSEL K (Container Ship) |
| **INC-2026-005** | Lakshadweep Basin (9° Channel) | 09.582°N, 75.121°E | 3.45 km² | Cosmo-SkyMed | RESOLVED | 06 DOSSIER ARCHIVED | VESSEL M (Bulk Carrier) |
| **INC-2026-006** | Andaman Sea Basin (10° Channel)| 12.103°N, 93.451°E | 5.12 km² | Sentinel-1 C-SAR | RESOLVED | 06 DOSSIER ARCHIVED | VESSEL P (Chemical Tanker) |
| **INC-2026-007** | Coromandel Coast (Karaikal) | 11.231°N, 79.814°E | 4.82 km² | Sentinel-1 C-SAR | RESOLVED | 06 ATTR COMPLETE | VESSEL B (Bulk Carrier) |
| **INC-2026-008** | Gujarat Shelf (Saurashtra) | 21.140°N, 69.820°E | 3.90 km² | Sentinel-1 C-SAR | ACTIVE | 02 DETECTION | VESSEL H (Chemical Carrier) |
| **INC-2026-009** | Palk Strait Corridor | 09.840°N, 79.920°E | 1.45 km² | Cosmo-SkyMed | ACTIVE | 03 DRIFT HINDCAST | VESSEL R (Coastal Feeder) |
| **INC-2026-010** | South Sri Lanka (Dondra Head) | 05.780°N, 80.520°E | 6.20 km² | Sentinel-1 C-SAR | ACTIVE | 04 AIS CORRELATION | VESSEL T (VLCC Crude Tanker) |
| **INC-2026-011** | Great Nicobar (6° Channel) | 06.920°N, 94.100°E | 4.15 km² | Radarsat-2 | ACTIVE | 05 ATTRIBUTION | VESSEL W (Container Carrier) |
| **INC-2026-012** | Northern Bay of Bengal (Sandheads)| 20.450°N, 88.200°E | 8.60 km² | Sentinel-1 C-SAR | RESOLVED | 06 DOSSIER ARCHIVED | VESSEL Z (Ore Carrier) |
