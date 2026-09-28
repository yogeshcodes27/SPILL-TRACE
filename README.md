# SPILLTRACE
### Forensic Maritime Spill Intelligence Platform

<p align="center">
  <img src="docs/images/spilltrace-logo.png" alt="SPILLTRACE Logo" width="460" />
</p>

> **"Turning ocean satellite data into traceable evidence against oil spill sources."**

[![SIH Problem Statement](https://img.shields.io/badge/SIH%202026-SIH26143-0052CC.svg?style=flat-square)](https://www.sih.gov.in/sih2026PS)
[![Organization](https://img.shields.io/badge/Organization-NTRO-red.svg?style=flat-square)](https://ntro.gov.in)
[![Category](https://img.shields.io/badge/Category-Software%20%7C%20Disaster%20Management-darkgreen.svg?style=flat-square)](#)
[![Compliance](https://img.shields.io/badge/Requirements%20Compliance-100%25%20(82%2F82)-brightgreen.svg?style=flat-square)](#verification-and-testing)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.3.0-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![Mapbox GL](https://img.shields.io/badge/Mapbox%20GL%20JS-3.31.0-3FB1CE.svg?style=flat-square&logo=mapbox)](https://www.mapbox.com/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186.0-000000.svg?style=flat-square&logo=three.js)](https://threejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900.svg?style=flat-square&logo=leaflet)](https://leafletjs.com/)
[![Playwright](https://img.shields.io/badge/Testing-Playwright%201.63-2EAD33.svg?style=flat-square&logo=playwright)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

**SPILLTRACE** addresses the critical operational gap between satellite remote-sensing detection of marine oil slicks and actionable, legally defensible vessel attribution. Traditional monitoring systems treat slick detection as the end of an alert pipeline; SPILLTRACE treats detection as the **genesis of a forensic investigation**. By fusing Sentinel-1 Synthetic Aperture Radar (SAR) imagery, physics-driven metocean hydrodynamic drift simulation (ERA5 winds, CMEMS currents, and Stokes drift), reverse-time Lagrangian origin hindcasting, and historical Automatic Identification System (AIS) vessel trajectories, SPILLTRACE reconstructs plausible discharge spatio-temporal envelopes and computes an explainable multi-factor attribution score for candidate vessels.

The system is engineered as an **investigative decision-support prototype** for maritime law enforcement, coast guards, and environmental protection agencies. It does **not** make automatic legal determinations of guilt; rather, it produces an auditable chain of evidence that narrows thousands of square kilometers and hundreds of vessel tracks down to ranked, inspectable leads.

<p align="center">
  <img src="docs/images/forensic-map.png" alt="SPILLTRACE Forensic Maritime Map" width="100%" />
  <br />
  <em>Figure: SPILLTRACE Maritime Incident Workstation displaying active incident tracking, satellite bounding footprints, bathymetric shipping corridors, and interactive vessel contacts in Indian waters.</em>
</p>

---

## Table of Contents

- [1. Executive Summary & Overview](#1-executive-summary--overview)
- [2. Problem Statement (SIH26143 / NTRO)](#2-problem-statement-sih26143--ntro)
- [3. Concrete Engineering Objectives](#3-concrete-engineering-objectives)
- [4. Core Differentiator: Detection vs. Investigation](#4-core-differentiator-detection-vs-investigation)
- [5. End-to-End Investigation Workflow](#5-end-to-end-investigation-workflow)
- [6. The Core 4-Stage Visual Pipeline](#6-the-core-4-stage-visual-pipeline)
- [7. System Architecture](#7-system-architecture)
- [8. Pipeline Stage 01: Oil Slick Detection & Screening](#8-pipeline-stage-01-oil-slick-detection--screening)
- [9. Pipeline Stage 02: Slick Characterisation & Morphology](#9-pipeline-stage-02-slick-characterisation--morphology)
- [10. Pipeline Stage 03: Hydrodynamic Drift Modelling](#10-pipeline-stage-03-hydrodynamic-drift-modelling)
- [11. Pipeline Stage 04: Backward Origin Reconstruction](#11-pipeline-stage-04-backward-origin-reconstruction)
- [12. Pipeline Stage 05: AIS Vessel Trajectory Analysis](#12-pipeline-stage-05-ais-vessel-trajectory-analysis)
- [13. Pipeline Stage 06: Explainable Vessel Attribution](#13-pipeline-stage-06-explainable-vessel-attribution)
- [14. Explainable Evidence Chain & Auditing](#14-explainable-evidence-chain--auditing)
- [15. Uncertainty Handling & Sensitivity Analysis](#15-uncertainty-handling--sensitivity-analysis)
- [16. Forensic Investigation Workstation UI](#16-forensic-investigation-workstation-ui)
- [17. Formal Investigation Dossier & Report Export](#17-formal-investigation-dossier--report-export)
- [18. System Outputs Matrix](#18-system-outputs-matrix)
- [19. Technology Stack](#19-technology-stack)
- [20. Repository Structure](#20-repository-structure)
- [21. Installation & Environment Setup](#21-installation--environment-setup)
- [22. Configuration](#22-configuration)
- [23. Running the Platform](#23-running-the-platform)
- [24. End-to-End Walkthrough: Scenario SYN-001](#24-end-to-end-walkthrough-scenario-syn-001)
- [25. Verification & Testing](#25-verification--testing)
- [26. Data Sources & Provenance Registry](#26-data-sources--provenance-registry)
- [27. Scientific Prior Art & Citations](#27-scientific-prior-art--citations)
- [28. Technical Limitations & Operational Realities](#28-technical-limitations--operational-realities)
- [29. Responsible Use & Legal Disclaimer](#29-responsible-use--legal-disclaimer)
- [30. Future Development Roadmap](#30-future-development-roadmap)
- [31. Project Information & License](#31-project-information--license)

---

## 1. Executive Summary & Overview

Modern satellite constellations (such as Copernicus Sentinel-1) capture high-resolution radar imagery of oceanic surfaces regardless of cloud cover or sunlight. When mineral oil or petroleum hydrocarbons are discharged into the sea, they form thin surface films that dampen capillary-gravity waves, causing specular reflection away from the radar antenna and appearing as dark patches in Synthetic Aperture Radar (SAR) backscatter ($\sigma^0$).

However, detecting an oil slick in a satellite image does **not** reveal who dumped it. Marine oil slicks are dynamic:
1. They advect rapidly under surface currents ($1.0 \times \vec{u}_{\text{current}}$), downwind leeway ($0.03 \times \vec{u}_{\text{wind}}$), and wave Stokes drift.
2. They undergo physical spreading, evaporation, and emulsification over hours to days.
3. Merchant shipping corridors accommodate thousands of transiting vessels daily.

```
INPUTS                                 PROCESSING                                OUTPUTS
──────────────────────────────────     ────────────────────────────────────     ─────────────────────────────────
• Sentinel-1 C-SAR (VV / VH dB)         • Calibration & Radiometric Damping      • Georeferenced Slick Polygon
• Copernicus Marine Service (CMEMS)    • Multi-Scale Semantic Segmentation      • Slick Geometry (Area, Axes)
• ECMWF ERA5 10m Wind Fields            • Polarimetric Look-Alike Screening      • Reconstructed Origin Region
• Historical & Live AIS Records         • Runge-Kutta 4th Order Hindcast         • Temporal Release Window
• Bathymetry & Coastal Boundaries       • Monte Carlo Ensemble Perturbations     • AIS Filtered Candidate Set
                                        • Spatiotemporal Corridor Filtering      • Explainable Evidence Vectors
                                        • CPA & Trajectory Alignment             • Interactive 3D Workstation Map
                                        • Multi-Factor Attribution Scoring       • Official Port State Dossier
```

SPILLTRACE combines these disparate domains into a unified, reproducible computational pipeline that operates deterministically across verified test scenarios and supports live analyst interrogation.

---

## 2. Problem Statement (SIH26143 / NTRO)

- **Problem ID:** SIH26143
- **Title:** *Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill*
- **Organization:** National Technical Research Organisation (NTRO)
- **Category:** Software
- **Theme:** Disaster Management

### Operational Challenge

Maritime oil pollution—whether from deliberate bilge water flushing (oily water separator bypass), tank washing discharges, or accidental collisions—imposes severe environmental and economic damage. In international waters and Exclusive Economic Zones (EEZ), identifying perpetrators is notoriously difficult because:
- **Temporal Lag:** Satellite passes occur hours after the physical discharge event.
- **Physical Transport:** By the time a radar satellite captures the slick, ocean currents and winds have transported the oil kilometers away from the point of release.
- **Dark Look-Alikes:** Low-wind calm zones ($< 3\text{ m/s}$), natural biogenic organic films, algae blooms, and vessel wakes produce SAR signatures nearly identical to crude oil.
- **Traffic Density:** Commercial seaways (such as the Malacca Strait, Coromandel Coast, or Gulf of Oman) accommodate dense, multi-directional maritime traffic.
- **Evidentiary Standard:** Accusing a vessel demands transparent, quantitative evidence (CPA distance, speed-course alignment, timing overlap, transponder status), not a black-box neural network output.

SPILLTRACE addresses this operational requirement by engineering an explainable, end-to-end evidence pipeline designed around the physical laws of oceanography and maritime navigation.

---

## 3. Concrete Engineering Objectives

1. **Ingest and Calibrate SAR Scenes:** Ingest georeferenced Sentinel-1 Ground Range Detected (GRD) C-Band SAR products with dual-polarization (VV/VH).
2. **Segment Hydrocarbon Boundaries:** Segment oil-spill candidate boundaries at sub-pixel resolution and discriminate true mineral oil from biogenic and meteorological look-alikes.
3. **Characterise Geometric Dispersion:** Extract GIS-ready polygon geometries, computing geodetic area ($km^2$), perimeter, centroid, major/minor inertia axes, aspect ratio, and orientation.
4. **Hydrodynamic Origin Hindcasting:** Backtrack the observed slick centroid using 4th-order Runge-Kutta numerical integration forced by verified ECMWF ERA5 wind and CMEMS current vectors.
5. **Quantify Spatio-Temporal Uncertainty:** Formulate the release origin as a bounded spatial uncertainty ellipse ($50\%$, $75\%$, and $95\%$ Confidence Intervals) coupled with a temporal release interval ($\Delta t$).
6. **Correlate Historical AIS Trajectories:** Ingest, clean, and filter historical vessel transponder trajectories within the reconstructed space-time window.
7. **Score Attribution with Explainability:** Evaluate candidate vessels across independent evidence factors (spatial proximity, temporal overlap, trajectory collinearity, metocean consistency, transponder continuity).
8. **Interactive Forensic Cartography:** Visualize the complete analytical chain on a high-performance vector basemap with 3D vessel models, advection vectors, and synchronized timeline controls.
9. **Export Structured Investigation Dossiers:** Generate formal case reports containing provenance metadata, chain-of-custody hashes, and recommendations for Port State Control (PSC) inspections.

---

## 4. Core Differentiator: Detection vs. Investigation

In conventional maritime surveillance systems, an automated alert ends when a bounding box or pixel mask highlights an oil spill. Investigators must then open separate GIS software, manually fetch oceanographic vectors, download raw AIS logs, and draw speculative lines across charts.

```
TRADITIONAL FRAGMENTED WORKFLOW:
  [Satellite Pass] ──> [Dark Spot Alert] ──> (Manual GIS Review) ──> (Separate AIS Download) ──> Inconclusive Guess

SPILLTRACE FORENSIC WORKFLOW:
  [Satellite Observation]
           ↓
  [Detection & Screening] ──> [Look-Alike Rejection]
           ↓
  [Morphological Analysis] ──> [Spreading Axis & Drift Orientation]
           ↓
  [Backward Lagrangian Hindcast] ──> [Coupled Metocean Forcing (ERA5 + CMEMS)]
           ↓
  [Origin Uncertainty Envelope] ──> [Spatial 95% CI + Temporal Release Window]
           ↓
  [Corridor AIS Intersect] ──> [Spatiotemporal Filtering Funnel]
           ↓
  [Factor Evidence Scoring] ──> [Explainable Weighting + Rank Stability]
           ↓
  [Investigation Dossier] ──> [Port State Actionable Lead]
```

> **Core Philosophy:** *"Detection is the beginning of the investigation, not the final output."*

---

## 5. End-to-End Investigation Workflow

The platform executes a 7-stage causal state machine. Downstream stages consume the verified mathematical outputs of preceding stages without artificial extrapolation.

```mermaid
flowchart TD
    subgraph S1["Stage 01: Archive & Intake"]
        A1["Sentinel-1 C-SAR GRD Scene"] --> A2["Radiometric Calibration (VV/VH dB)"]
        A3["Metocean Archive (ERA5 Wind + CMEMS Currents)"] --> A4["Basin Vessel Traffic Store"]
    end

    subgraph S2["Stage 02: Detection & Screening"]
        A2 --> B1["Dual-Pol Multi-Scale Segmentation"]
        B1 --> B2["Polarimetric Entropy & Damping Analysis"]
        B2 --> B3{"Look-Alike Screening"}
        B3 -- "Calm Shadow / Wake" --> B4["Rejected Anomaly"]
        B3 -- "Hydrocarbon Match" --> B5["Verified Spill Mask (P > 0.85)"]
    end

    subgraph S3["Stage 03: Slick Characterisation"]
        B5 --> C1["Vector Polygonization (WGS84 EPSG:4326)"]
        C1 --> C2["Geodesic Area & Perimeter Calculation"]
        C2 --> C3["Eigenvector Inertia Axes & Orientation"]
    end

    subgraph S4["Stage 04: Drift & Origin Dynamics"]
        C3 --> D1["Lagrangian Particle Initialization at Centroid"]
        A3 --> D2["Time-Dependent Forcing Vectors (u_curr, v_curr, u_wind)"]
        D1 & D2 --> D3["Runge-Kutta 4 (RK4) Reverse Advection Integrator"]
        D3 --> D4["Monte Carlo Ensemble Perturbation (8-12 Members)"]
        D4 --> D5["Origin Centroid + 95% CI Uncertainty Ellipse"]
        D4 --> D6["Temporal Release Window (T_center ± 45m)"]
    end

    subgraph S5["Stage 05: AIS Traffic Correlation"]
        A4 --> E1["Regional Fleet AIS Ingestion"]
        D5 & D6 --> E2["Spatiotemporal Corridor Query"]
        E1 & E2 --> E3["Temporal Filtering Window"]
        E3 --> E4["Spatial Corridor Filter (<= 2.5x Radius)"]
        E4 --> E5["Interpolation & Transmission Gap Flagging"]
    end

    subgraph S6["Stage 06: Forensic Evidence Fusion"]
        E5 --> F1["Closest Point of Approach (CPA) Calculation"]
        C3 & D5 --> F2["Course Over Ground (COG) Collinearity Check"]
        F1 & F2 --> F3["Multi-Factor Scoring Engine (Spatial, Temporal, Drift, AIS)"]
        F3 --> F4["Candidate Priority Ranking (HIGH / MODERATE / LOW)"]
        F3 --> F5["System Abstention Protocol (If No Fit Found)"]
    end

    subgraph S7["Stage 07: Investigation Dossier"]
        F4 & F5 --> G1["Interactive Workstation Cartography"]
        G1 --> G2["Formal Inspection Dossier (PDF / GeoJSON Export)"]
    end

    style B5 fill:#1b4332,stroke:#40916c,stroke-width:2px,color:#fff
    style D5 fill:#081c15,stroke:#2d6a4f,stroke-width:2px,color:#fff
    style F4 fill:#742a2a,stroke:#e53e3e,stroke-width:2px,color:#fff
    style G2 fill:#1a365d,stroke:#3182ce,stroke-width:2px,color:#fff
```

---

## 6. The Core 4-Stage Visual Pipeline

The transformation from raw orbital radar pixels to an attributed candidate vessel constitutes SPILLTRACE's core visual language:

| Stage 01: Raw SAR Observation | Stage 02: Semantic Slick Mask |
| :---: | :---: |
| <img src="docs/images/fig1-input-sar.jpg" alt="Figure 1: Input SAR Image" width="100%" /> | <img src="docs/images/fig2-slick-segmentation.jpg" alt="Figure 2: Slick Segmentation Mask" width="100%" /> |
| **Figure 1 — Input Sentinel-1 C-SAR Scene**<br />Calibrated $\sigma^0$ radar backscatter showing capillary wave damping $(-8.2\text{ dB})$ against open water $(-22.4\text{ dB}$ noise floor). | **Figure 2 — AI Slick Segmentation & Verification**<br />Multi-scale boundary extraction isolating confirmed hydrocarbon slicks from biogenic look-alikes. |

| Stage 03: Origin Reconstruction | Stage 04: Vessel Attribution |
| :---: | :---: |
| <img src="docs/images/origin-reconstruction.png" alt="Figure 3: Origin Reconstruction" width="100%" /> | <img src="docs/images/vessel-attribution.png" alt="Figure 4: Vessel Attribution" width="100%" /> |
| **Figure 3 — Backward Lagrangian Hindcast**<br />Reversed trajectory ($16.8\text{ NM}$ over $12\text{h}$) to origin centroid ($11.162^\circ\text{N}, 80.088^\circ\text{E}$) with $50\%$, $75\%$, and $95\%$ CI uncertainty rings. | **Figure 4 — Candidate Evidence Fusion**<br />AIS track intersection of candidate tanker *PACIFIC HORIZON* at CPA ($0.4\text{ NM}$) with factor breakdown ($88/100$ score). |

---

## 7. System Architecture

SPILLTRACE is structured in modular layers adhering to strict separation of concerns:

```mermaid
graph TD
    subgraph UI["Presentation Layer (Client Browser)"]
        UI1["Mapbox GL JS Vector Engine"]
        UI2["Three.js 3D WebGL Vessel Layer"]
        UI3["Leaflet Regional Chart"]
        UI4["React 19 Reactive State Router"]
        UI5["Forensic Stage HUD & Telemetry Panels"]
    end

    subgraph Service["Application & Service Facade (src/services/)"]
        SRV1["spilltraceService.js (Pipeline Controller)"]
        SRV2["mapboxSources.js (GeoJSON Feeds)"]
        SRV3["mapboxLayers.js (Symbolic Cartography)"]
        SRV4["vessel3DLayer.js (Oriented 3D Models)"]
        SRV5["scenariosData.js (Ground Truth & Synthetic Datasets)"]
    end

    subgraph Engine["Computational Engines"]
        ENG1["Lagrangian RK4 Advection Engine"]
        ENG2["Monte Carlo Ensemble Perturber"]
        ENG3["Haversine Geodesic Distance Matrix"]
        ENG4["Inertia Tensor Eigen-Decomposition"]
        ENG5["Multi-Factor Attribution Engine"]
    end

    subgraph Data["Data & Ingestion Interfaces"]
        DAT1["Sentinel-1 GRD Radar Processor"]
        DAT2["Copernicus Marine Current Vector Feed"]
        DAT3["ECMWF ERA5 Atmospheric Wind Feed"]
        DAT4["MarineCadastre / NMEA AIS Ingester"]
        DAT5["Provenance & Chain-of-Custody Auditor"]
    end

    UI1 & UI2 & UI3 & UI4 & UI5 <--> Service
    Service <--> Engine
    Engine <--> Data
```

### Architectural Layer Responsibilities

1. **Presentation Layer:** Built with React 19 and Mapbox GL JS 3.31. Renders high-precision geospatial vector tiles, bathymetric shipping corridors, custom SVG telemetry graticules, and Three.js 3D ship models oriented dynamically according to Course Over Ground (COG).
2. **Service Facade (`src/services/`):** Implements a clean API interface encapsulating pipeline execution, scenario mapping (`INC-2026-001` $\leftrightarrow$ `SYN-001`), and synchronous parameter propagation across stages.
3. **Computational Engines:**
   - *Advection Integrator:* Numerically solves the Lagrangian particle displacement differential equation.
   - *Ensemble Engine:* Evaluates parametric sensitivity under perturbed forcing fields.
   - *Evidence Scoring:* Executes deterministic, transparent multi-factor weighted scoring.
4. **Data Layer:** Maintains standardized schemas for satellite scenes, metocean tensors, AIS trajectory pips, and formal provenance logs.

---

## 8. Pipeline Stage 01: Oil Slick Detection & Screening

<p align="center">
  <img src="docs/images/oil-detection.png" alt="Stage 02 Oil Slick Detection Interface" width="100%" />
  <br />
  <em>Figure: SPILLTRACE Detection Workspace showing multi-band SAR telemetry, look-alike discrimination audit ledger, and verified slick polygon extraction.</em>
</p>

### Radar Backscatter Physics

Synthetic Aperture Radar sensors emit microwave pulses (C-band $\approx 5.405\text{ GHz}$ for Sentinel-1) and record the amplitude and phase of backscattered radiation. On undisturbed open ocean surfaces, wind induces capillary and short gravity waves ($1\text{ cm}$ to $10\text{ cm}$) that produce Bragg scattering back toward the satellite receiver.

When petroleum hydrocarbons form a monomolecular or thin physical layer, surface tension increases and kinematic viscosity damps high-frequency wavelets. The sea surface becomes smooth, deflecting the radar pulses away like a mirror. This produces a severe decrease in radar cross-section ($\sigma^0$ damping of $-6\text{ dB}$ to $-12\text{ dB}$ relative to the ambient sea):

$$\sigma^0_{\text{slick}} \ll \sigma^0_{\text{sea}}$$

### Polarimetric Look-Alike Screening

A persistent vulnerability in automated SAR detection is **false positives from dark look-alikes**. SPILLTRACE implements a multi-feature discrimination matrix:

| Feature / Criterion | True Mineral Oil Slick | Low-Wind Calm Zone | Ship Wake Shear | Biogenic Film (Algae) |
| :--- | :--- | :--- | :--- | :--- |
| **Damping Contrast** | Sharp ($> 6\text{ dB}$ edge contrast) | Gradual / Diffuse | Linear / Narrow | Moderate ($2\text{--}4\text{ dB}$) |
| **Wind Threshold** | Visible at $3\text{--}12\text{ m/s}$ | Only at $< 2.5\text{ m/s}$ | Independent of wind | Dispersed by $> 6\text{ m/s}$ |
| **Morphology** | Elongated plume along drift | Broad, amorphous patches | Highly linear behind ship | Irregular feather-like |
| **Polarimetric Entropy** | High damping in both VV/VH | Dependent on incidence angle | Collinear with AIS track | Strong biogenic surfactant |
| **SPILLTRACE Classification** | **VERIFIED SLICK (P > 0.85)** | **REJECTED (Low Wind)** | **REJECTED (Vessel Wake)**| **REJECTED (Biogenic)** |

```
Raw SAR Scene ──> Radiometric Calibration ──> Damping Filter ──> Look-Alike Filter ──> Clean Polygon
```

---

## 9. Pipeline Stage 02: Slick Characterisation & Morphology

<p align="center">
  <img src="docs/images/console-tab03-slick.png" alt="Stage 03 Slick Analysis Console" width="85%" />
  <br />
  <em>Figure: Stage 03 Slick Morphology Console displaying inertia tensor axes, aspect ratio, orientation angle, and physical dispersion assessment.</em>
</p>

Once the binary mask is validated, SPILLTRACE converts the raster boundaries into a georeferenced GeoJSON polygon in standard WGS84 coordinates (EPSG:4326). 

The platform then computes morphological properties:

1. **Geodesic Area ($A$):** Calculated via equal-area geodetic projection:
   $$A = \iint_{\mathcal{S}} \cos(\phi) \, d\lambda \, d\phi \quad (\text{km}^2)$$
2. **Geodesic Perimeter ($P$):** Sum of great-circle segment lengths along the exterior boundary ring ($km$).
3. **Spatial Centroid ($\mathbf{x}_c$):** Geodetic center of mass:
   $$\mathbf{x}_c = [\bar{\lambda}, \bar{\phi}] = \left[ \frac{1}{A} \iint_{\mathcal{S}} \lambda \, dA, \; \frac{1}{A} \iint_{\mathcal{S}} \phi \, dA \right]$$
4. **Major & Minor Inertia Axes ($L_{\text{major}}, L_{\text{minor}}$):** Derived from the second central moments (inertia tensor) of the coordinate distribution:
   $$\mathbf{I} = \begin{bmatrix} \mu_{20} & \mu_{11} \\ \mu_{11} & \mu_{02} \end{bmatrix}, \quad \lambda_1, \lambda_2 = \text{eig}(\mathbf{I})$$
   $$L_{\text{major}} = 4 \sqrt{\lambda_1}, \quad L_{\text{minor}} = 4 \sqrt{\lambda_2}$$
5. **Principal Dispersion Orientation ($\theta_{\text{orient}}$):**
   $$\theta_{\text{orient}} = \frac{1}{2} \arctan\left( \frac{2 \mu_{11}}{\mu_{20} - \mu_{02}} \right) \quad (\text{degrees from True North})$$
6. **Compactness Ratio ($C$):**
   $$C = \frac{4 \pi A}{P^2} \quad (0 < C \le 1)$$
   *Low compactness ($C < 0.2$) indicates an elongated trailing discharge; higher compactness suggests an instantaneous batch release.*

---

## 10. Pipeline Stage 03: Hydrodynamic Drift Modelling

<p align="center">
  <img src="docs/images/origin-reconstruction.png" alt="Stage 04 Drift & Origin Dynamics" width="100%" />
  <br />
  <em>Figure: Stage 04 Origin Reconstruction displaying 16.8 NM backward advection trajectory, intermediate hourly time markers (T0 to T-12h), coupled wind/current vectors, and 3 concentric origin containment rings.</em>
</p>

Oil on the ocean surface moves in response to combined environmental forcing. SPILLTRACE implements the classic oceanic advection model:

$$\vec{u}_{\text{total}} = \vec{u}_{\text{current}} + \alpha \vec{u}_{\text{wind}} + \vec{u}_{\text{Stokes}}$$

Where:
- $\vec{u}_{\text{current}}$ is the Eulerian sea-surface current vector ($m/s$) from CMEMS `GLOBAL_ANALYSISFORECAST_PHY_001_024`.
- $\vec{u}_{\text{wind}}$ is the $10\text{m}$ atmospheric wind vector ($m/s$) from ECMWF ERA5 reanalysis.
- $\alpha$ is the wind leeway factor (nominally $0.030$ or $3.0\%$, with user-adjustable calibration $0.015\text{--}0.045$).
- $\vec{u}_{\text{Stokes}}$ is the wave-induced Stokes drift velocity ($m/s$).

### Forward vs. Backward Numerical Integration

- **Forward Drift (Forecast):** Predicts future trajectory from $T_0$ to $T + 48\text{h}$ for environmental protection and boom deployment.
- **Backward Drift (Hindcast):** Integrates time in reverse ($t \to -t$) from the observed satellite acquisition timestamp $T_{\text{acq}}$ back to an estimated release horizon ($T_{\text{acq}} - \Delta t$).

SPILLTRACE uses a **4th-Order Runge-Kutta (RK4)** numerical integrator with adaptive sub-stepping ($\Delta t = 30\text{ min}$):

$$\mathbf{x}(t - \Delta t) = \mathbf{x}(t) - \frac{\Delta t}{6} \left( k_1 + 2k_2 + 2k_3 + k_4 \right)$$

This prevents numerical drift errors that arise from simple forward-Euler approximations over long tracks.

---

## 11. Pipeline Stage 04: Backward Origin Reconstruction

A critical scientific fact governed by oceanic turbulence is that **an exact origin coordinate cannot be determined deterministically**. Turbulence, shear, wind variability, and unobserved micro-currents introduce dispersion.

SPILLTRACE therefore outputs an **Origin Uncertainty Envelope** characterized by:

1. **Reconstructed Centroid ($\mathbf{x}_{\text{origin}}$):** The most likely point of discharge.
2. **Three Concentric Probability Containment Rings:**
   - **$50\%$ Core Containment ($r \approx 1.6\text{ km}$):** High-probability core origin zone.
   - **$75\%$ Contour ($r \approx 2.3\text{ km}$):** Intermediate dispersion boundary.
   - **$95\%$ Confidence Boundary ($r \approx 2.8\text{ km}$):** Outer physical envelope enclosing potential release points.
3. **Dynamic Temporal Release Window:**
   $$T_{\text{release}} = T_{\text{acq}} - \Delta t \pm 45\text{ minutes}$$
4. **Intermediate Time Markers:** Discrete advection waypoints rendered at `T0`, `T-3h`, `T-6h`, `T-9h`, and `T-12h` along the trajectory.

<p align="center">
  <img src="docs/images/console-ensemble-dispersion.png" alt="Ensemble Dispersion in Scenario SYN-005" width="85%" />
  <br />
  <em>Figure: Monte Carlo ensemble dispersion under current shear volatility (Scenario SYN-005), showing diverging candidate origin trajectories and resulting rank stability degradation (52%).</em>
</p>

---

## 12. Pipeline Stage 05: AIS Vessel Trajectory Analysis

<p align="center">
  <img src="docs/images/console-tab05-ais.png" alt="Stage 05 AIS Traffic Correlation Interface" width="100%" />
  <br />
  <em>Figure: Stage 05 AIS Traffic Correlation showing regional traffic corridor, temporal filtering window, and candidate track segmentation.</em>
</p>

The Automatic Identification System (AIS) broadcasts VHF transponder messages containing vessel identity (MMSI, IMO, name, callsign), navigational status, speed over ground (SOG), course over ground (COG), true heading, and coordinates.

### Spatiotemporal Corridor Filtering Funnel

Raw maritime AIS datasets contain millions of transmissions across a basin. Loading these indiscriminately creates severe memory overhead. SPILLTRACE implements a hierarchical filtering funnel:

```
[Raw Regional Fleet Transmissions] (e.g., 428 active basin tracks)
               │
               ▼
[Temporal Filtering Window] ──────> Restrict to [T_release_start - 2.5h, T_release_end + 2.5h]
               │                    (Yields e.g., 37 temporally overlapping tracks)
               ▼
[Spatial Corridor Buffer] ────────> Restrict to Distance(Track, Origin_Centroid) <= 2.5 * R_95
               │                    (Yields e.g., 8 spatially proximate tracks)
               ▼
[Trajectory & Kinematic Sanity] ──> Filter out corrupted SOG (> 40 kn) or invalid positions
               │
               ▼
[Candidate Vessel Evaluation Set] ─> (Yields 1 to 5 qualifying candidate vessels)
```

### Contextual AIS Gap Analysis

When a commercial vessel intentionally or unintentionally turns off its AIS transponder (Class A/B transmitter), a **transmission gap** occurs.

In Scenario `SYN-003`, candidate vessel *GULF NAVIGATOR* undergoes a $210\text{-minute}$ AIS transmission blackout while traversing the corridor:

<p align="center">
  <img src="docs/images/console-ais-gap.png" alt="AIS Gap Visualisation" width="85%" />
  <br />
  <em>Figure: Scenario SYN-003 contextual AIS gap detection. A 210-minute transponder blackout during corridor transit is explicitly highlighted as an evidentiary indicator, NOT an automatic finding of guilt.</em>
</p>

> [!IMPORTANT]
> **Forensic Constraint:** An AIS transmission gap is treated as a **contextual evidentiary indicator**, not automatic proof of illegal dumping. Transponder outages frequently occur due to poor satellite reception, VHF terrestrial dead zones, equipment reboot, or power outages. SPILLTRACE applies an AIS continuity factor penalty ($54/100$) while preserving transparent auditing.

---

## 13. Pipeline Stage 06: Explainable Vessel Attribution

<p align="center">
  <img src="docs/images/vessel-attribution.png" alt="Stage 06 Evidence Fusion Interface" width="100%" />
  <br />
  <em>Figure: Stage 06 Forensic Evidence Fusion. Selected candidate vessel PACIFIC HORIZON displays 3D model icon, COG rotation (38°), CPA tie-line (0.4 NM), and complete 5-factor forensic decomposition (Score 88/100).</em>
</p>

SPILLTRACE scores candidate vessels using an **explainable, decomposable multi-component formula** rather than an opaque black-box neural network:

$$\text{Composite Score} = w_1 S_{\text{spatial}} + w_2 S_{\text{temporal}} + w_3 S_{\text{drift}} + w_4 S_{\text{trajectory}} + w_5 S_{\text{continuity}}$$

### Component Factor Formulation

| Factor Name | Weight ($w_i$) | Governing Formula & Scientific Logic |
| :--- | :---: | :--- |
| **Spatial Proximity ($S_{\text{spatial}}$)** | $0.25$ | Measures Closest Point of Approach (CPA) between vessel track and origin centroid relative to the 95% CI radius $R_{\text{origin}}$:<br />$$S_{\text{spatial}} = \max\left(15, 100 - 3.5 \times \max(0, d_{\text{CPA}} - R_{\text{origin}})\right)$$ |
| **Temporal Compatibility ($S_{\text{temporal}}$)** | $0.25$ | Evaluates temporal coincidence between vessel CPA timestamp ($T_{\text{CPA}}$) and the center of the reconstructed release window ($T_{\text{release}}$):<br />$$S_{\text{temporal}} = \max\left(15, 100 - 2.5 \times |T_{\text{CPA}} - T_{\text{release}}|_{\text{hours}}\right)$$ |
| **Drift Consistency ($S_{\text{drift}}$)** | $0.20$ | Compares the vessel's track vector with the backward Lagrangian hydrodynamic transport vector, penalizing environmental divergence. |
| **Trajectory Collinearity ($S_{\text{trajectory}}$)** | $0.15$ | Measures directional alignment between vessel Course Over Ground ($\text{COG}$) and the major dispersion orientation axis ($\theta_{\text{orient}}$) of the slick geometry. |
| **AIS Continuity ($S_{\text{continuity}}$)** | $0.15$ | Evaluates transponder integrity. Continuous transmission scores $98\text{--}100$; unannounced transmission blackouts during corridor passage are penalized ($54/100$). |

### Priority Thresholds

- **HIGH PRIORITY ($\ge 80$):** Primary investigative lead. Vessel was spatiotemporally co-located within the 95% CI origin envelope with matching kinematic course.
- **MODERATE PRIORITY ($60\text{--}79$):** Secondary candidate requiring corroborating port inspection data.
- **LOW PRIORITY ($40\text{--}59$):** Peripheral traffic with substantial spatial or temporal offset.
- **EXCLUDED ($< 40$):** Inconsistent with origin conditions.

### System Abstention Protocol (Scenario SYN-004)

A critical attribute of a reliable forensic system is knowing when **not** to accuse. In Scenario `SYN-004`, an active slick is detected in the Malacca Strait, but no vessels in the historical AIS record intersect the reconstructed space-time origin.

Rather than forcing an erroneous match, the system explicitly triggers its **Abstention Protocol**:
```
STATUS: ABSTAINED
REASON: "No sufficiently consistent candidate found. The origin region may correspond 
        to a vessel not transmitting AIS (dark vessel), or the spill may originate 
        from an offshore platform, pipeline, or natural seabed seep."
```

---

## 14. Explainable Evidence Chain & Auditing

The foundation of courtroom or administrative maritime enforcement is the **unbroken chain of custody**. An analyst must be able to audit every derivation step backward:

```
[Port State Inspection Order]
             ▲
             │ (supported by)
[Dossier Case Summary & Factor Decomposition]
             ▲
             │ (derived from)
[Closest Point of Approach (CPA = 0.4 NM @ 17:57 UTC)]
             ▲
             │ (intersected with)
[Reconstructed Origin Envelope (Radius = 2.8 km @ 95% CI)]
             ▲
             │ (backtracked by)
[Lagrangian RK4 Advection (16.8 NM across 12 hours)]
             ▲
             │ (forced by)
[Copernicus Marine Currents (0.62 m/s) + ERA5 Winds (14.2 kn)]
             ▲
             │ (initiated at)
[Extracted Polygon Centroid (11.238°N, 79.814°E)]
             ▲
             │ (segmented from)
[Calibrated Sentinel-1 C-SAR Scene (Noise Floor: -22.4 dB)]
```

Every parameter, random seed, model version, and forcing dataset is recorded in a standardized **JSON Provenance Record**.

---

## 15. Uncertainty Handling & Sensitivity Analysis

SPILLTRACE explicitly quantifies and visualizes five distinct layers of uncertainty:

1. **Model Segmentation Uncertainty:** Retained pixel-level probability ($P(\text{oil} \mid \text{pixel})$) determining the core confidence boundary ($12.6\text{ km}^2$ @ $96.4\%$ confidence).
2. **Geospatial Position Uncertainty:** 10-meter ground range pixel resolution preserving geodetic boundaries.
3. **Forcing Vector Perturbations:** Stochastic Monte Carlo ensemble runs varying wind leeway ($\pm 10\%$) and current velocity ($\pm 15\%$).
4. **Temporal Release Margin:** $\pm 45\text{-minute}$ confidence interval bounding the release timestamp.
5. **Candidate Rank Stability Metric:** Quantifies how consistently a candidate remains ranked #1 under 100 perturbed Monte Carlo hindcast simulations:
   - **Scenario SYN-001:** Rank stability $= 94\%$ (Robust lead under all weather variations).
   - **Scenario SYN-005:** Rank stability $= 52\%$ (Volatile lead due to sharp current shear; high uncertainty).

---

## 16. Forensic Investigation Workstation UI

The user interface is an operational geospatial console organized around two primary views:

### 16.1 Incidents Catalog & Regional Maritime Map (`#incidents`)

- **Interactive Incident Table:** Displays 12 real-world regional basins across the Indian Ocean (Bay of Bengal, Arabian Sea, Gulf of Oman, Malacca Strait, Lakshadweep, Andaman Sea, Gujarat Shelf, Palk Strait, Dondra Head, Nicobar Channel, Sandheads).
- **Interactive Maritime Map:** Color-coded status markers, satellite footprint bounding boxes, major international shipping lanes, and live incident selection.
- **Dossier Quick-View Drawer:** Telemetry overview, volume estimates, sensor metadata, and stage status.

### 16.2 7-Stage Forensic Investigation Console (`#investigation`)

Triggered via the **OPEN CONSOLE** button, this full-screen modal workstation features a stage-aware synchronized map and deep evidentiary panel:

<p align="center">
  <img src="docs/images/console-tab01-archive.png" alt="Console Tab 01 Archive" width="49%" />
  <img src="docs/images/console-tab07-report.png" alt="Console Tab 07 Report" width="49%" />
  <br />
  <em>Figure Left: Tab 01 Archive Case Intake displaying Sentinel-1 telemetry, calibration status, and basin forcing. Figure Right: Tab 07 Official Forensic Dossier ready for export.</em>
</p>

1. **`01 ARCHIVE`:** Case intake, satellite pass telemetry, orbit 6102, WGS84 CRS, and environmental forcing registry.
2. **`02 DETECTION`:** Radiometric SAR viewer, dual-pol damping analysis, backscatter histogram, and look-alike audit ledger.
3. **`03 SLICK ANALYSIS`:** Inertia tensor decomposition, major/minor dispersion axes, compactness, and physical spreading assessment.
4. **`04 DRIFT & ORIGIN`:** Backward Lagrangian hindcast, 3 concentric containment rings ($50\%$, $75\%$, $95\%$), hourly time markers, and ensemble dispersion fans.
5. **`05 AIS TRAFFIC`:** Fleet corridor query, temporal filter funnel, candidate track selection, and contextual transponder gap detection.
6. **`06 EVIDENCE FUSION`:** Convergence stage featuring dynamic 3D ship icons, COG rotation, CPA tie-lines, and 5-factor breakdown.
7. **`07 EVIDENCE REPORT`:** Formal structured dossier with Port State Control inspection recommendations and download options.

---

## 17. Formal Investigation Dossier & Report Export

The final output of an investigation in Stage 07 is an **Official Forensic Maritime Spill Dossier** containing:

```text
══════════════════════════════════════════════════════════════════════════════
SPILLTRACE // MARITIME FORENSIC DOSSIER · CASE INC-2026-001 (SYN-001)
ORGANIZATION: NATIONAL TECHNICAL RESEARCH ORGANISATION (NTRO)
══════════════════════════════════════════════════════════════════════════════
1. INCIDENT TELEMETRY
   • Incident ID: INC-2026-001 / SCENARIO SYN-001
   • Observation Timestamp: 2026-06-18 · 06:42:00 UTC
   • Basin / Sector: Coromandel Coast / Bay of Bengal (Tamil Nadu Shelf)
   • Satellite Sensor: Sentinel-1A C-SAR (GRDH, Dual-Pol VV+VH, 10m)
   • Scene ID: S1A_IW_GRDH_1SDV_20260618T064200_038412_048821_B0A2

2. SLICK MORPHOLOGICAL CHARACTERISATION
   • Segmented Area: 12.6 km² (Confidence: 96.4%)
   • Estimated Hydrocarbon Volume: 144.6 m³
   • Observed Centroid: 11.2380°N, 79.8140°E
   • Major Axis: 6.2 km @ Orientation 068.0° True North | Minor Axis: 1.8 km
   • Look-Alike Screening: Biogenic (1.3%), Calm Sea (5.2%) -> VERIFIED OIL

3. METOCEAN FORCING & HYDRODYNAMIC HINDCAST
   • Metocean Providers: ECMWF ERA5 (Atmosphere) + CMEMS Global Ocean Physics
   • Wind Forcing: 14.2 kn @ 054.0° | Surface Current: 0.62 m/s @ 234.0°
   • Numerical Integrator: Runge-Kutta 4th Order (RK4, dt = 30m)
   • Backward Drift Duration: 12.0 Hours | Total Advection Distance: 16.8 NM
   • Reconstructed Origin Centroid: 11.1620°N, 80.0880°E
   • Origin Uncertainty: 2.8 km Radius (95% CI) | Area: 24.6 km²
   • Estimated Release Window: 17 JUN · 17:57 UTC to 17 JUN · 19:27 UTC

4. AIS TRAFFIC & CANDIDATE ATTRIBUTION
   • Basin Fleet Contacts Evaluated: 3 Vessels
   • Primary Candidate Lead: PACIFIC HORIZON (MMSI: 419001001, Flag: Panama)
   • Vessel Type: Crude Oil Tanker | Length: 274m | Beam: 48m
   • Closest Point of Approach (CPA): 0.4 NM to Origin Centroid @ 17 JUN · 17:57 UTC
   • Kinematic Course: SOG 12.4 kn | COG 038.0° (Consistent with corridor)
   • AIS Transponder Continuity: Verified Continuous (0 Gaps)
   • Composite Attribution Score: 88 / 100 [HIGH INVESTIGATIVE PRIORITY]
   • Component Factor Breakdown:
     - Spatial Proximity:        85 / 100 (CPA = 0.4 NM)
     - Temporal Compatibility:   90 / 100 (Direct overlap with release window)
     - Drift Alignment:          85 / 100 (Aligned with transport axis)
     - Trajectory Collinearity:  80 / 100 (COG aligns with dispersion)
     - Transponder Continuity:   98 / 100 (Zero transmission gaps)
   • Monte Carlo Rank Stability: 94% across 100 weather perturbation runs

5. INVESTIGATIVE RECOMMENDATION & ACTION
   • Action: Issue Notice to Port State Control (PSC) at destination port.
   • Inspection Focus: Oil Record Book Part II, Oily Water Separator (OWS) 
     bilge discharge overboard valve seals, sludge tank inventory records.
   • Evidentiary Notice: Decision-support investigative lead. Requires physical
     bunker sampling verification.
══════════════════════════════════════════════════════════════════════════════
```

**Supported Export Formats:**
- **GeoJSON Feature Collection:** Slick polygons, origin ellipses, and vessel trajectory pips with standardized properties.
- **JSON Provenance Record:** Complete machine-readable audit trail.
- **PDF-Ready Dossier:** Structured format for legal briefs and enforcement agencies.

---

## 18. System Outputs Matrix

| Output Artifact | Data Type | Description | Operational Use |
| :--- | :--- | :--- | :--- |
| **Segmented Slick Mask** | Raster GeoTIFF / PNG | Binary and probability pixel mask ($P > 0.85$). | Core satellite detection record. |
| **Slick GIS Polygon** | GeoJSON (EPSG:4326) | Vectorized boundary ring with area and perimeter. | Direct import into QGIS/ArcGIS. |
| **Morphological Tensor** | JSON Properties | Major/minor axes, aspect ratio, orientation angle. | Spreading and weathering analysis. |
| **Lagrangian Trajectory** | GeoJSON LineString | Discrete hourly waypoints (`T0` to `T-12h`). | Reconstructed transport path. |
| **Origin Uncertainty Envelopes** | GeoJSON Polygon Rings | Concentric $50\%$, $75\%$, and $95\%$ CI containment boundaries. | Target spatial query window. |
| **Temporal Release Window** | ISO-8601 Timestamp Pair | Dynamic interval ($T_{\text{center}} \pm 45\text{m}$). | Target temporal query window. |
| **Filtered Candidate Tracks** | GeoJSON MultiLineString | Timestamped AIS trajectories with CPA annotations. | Navigational tracking record. |
| **Explainable Evidence Vectors** | JSON Structured Object | Multi-factor scores ($S_{\text{spatial}}$, $S_{\text{temporal}}$, etc.). | Courtroom auditability. |
| **3D Interactive Workstation** | WebGL / Canvas | Dynamic Mapbox + Three.js cartographic console. | Analyst mission workspace. |
| **Official Case Dossier** | PDF / GeoJSON Export | Formal legal and tactical summary report. | Port State enforcement notice. |

---

## 19. Technology Stack

```
FRONTEND / CLIENT
├── React 19.3.0               # High-performance component runtime & UI state engine
├── Vite 6.2.0                 # Next-generation ES module bundler & HMR server
├── Mapbox GL JS 3.31.0        # WebGL vector cartography, spatial sources, and dynamic styling
├── Three.js 0.186.0           # 3D WebGL renderer for physical ocean waves and textured ship models
├── Leaflet 1.9.4              # Auxiliary geospatial chart rendering
└── Tailwind CSS 3.4           # Modular utility design system with dark-mode aesthetic

COMPUTATIONAL & ALGORITHMIC ENGINES
├── Runge-Kutta 4th Order     # High-precision numerical advection integration engine
├── Monte Carlo Perturber      # Stochastic forcing perturbation generator (8-12 members)
├── Inertia Tensor Decomp.     # Eigenvector analysis for major/minor slick axes
├── Haversine Geodesy          # Spherical distance, bearing, and CPA matrix computations
└── Multi-Factor Scorer        # Weighted explainable attribution scoring engine

VALIDATION & AUTOMATION
├── Playwright 1.63.0          # Headless browser integration & automated UI testing
├── Node.js 18+ (ESM)          # Verification test runner & build scripting
└── Static Analysis Scripts    # 82 automated compliance checks across SIH specifications
```

---

## 20. Repository Structure

```text
c:\SPILLTRACE\
├── 01_PROJECT_DOCUMENTATION.md          # Full research baseline, operational requirements, and scientific landscape
├── 02_REQUIREMENTS.md                   # 82 formal SIH specifications (FR, DR, MLR, GR, BR, AIR, AR, EVR)
├── 03_SYSTEM_WORKFLOW.md                # Multi-stage data flow, architecture principles, and state machine
├── 04_DATASETS_AND_DATA_COLLECTION.md   # Official data sources, Zenodo specs, CMEMS, ERA5, and AIS registry
├── CURRENT_PAGES_AND_REPRESENTATION.md  # Inventory of implemented UI views, components, and data structures
├── implementation_plan.md               # Engineering roadmap and verification logs
├── index.html                           # Single-page application entry point
├── package.json                         # Project dependencies, scripts, and build metadata
├── vite.config.js                       # Vite bundler configuration
│
├── docs/                                # Project documentation assets
│   └── images/                          # Version-controlled high-resolution screenshots & figures
│       ├── forensic-map.png             # Overview Forensic Maritime Map
│       ├── oil-detection.png            # Stage 02 SAR Detection Workspace
│       ├── origin-reconstruction.png    # Stage 04 Backward Drift & Origin
│       ├── vessel-attribution.png       # Stage 06 Evidence Fusion & Candidate Scoring
│       ├── fig1-input-sar.jpg           # Figure 1: Calibrated Sentinel-1 C-SAR
│       ├── fig2-slick-segmentation.jpg  # Figure 2: Multi-Scale Slick Segmentation
│       ├── fig3-lookalike-check.jpg     # Figure 3: Look-Alike Polarimetric Screening
│       ├── fig4-verified-mask.jpg       # Figure 4: Verified Hydrocarbon Mask
│       ├── console-tab01-archive.png    # Console Tab 01: Case Intake
│       ├── console-tab03-slick.png      # Console Tab 03: Slick Morphology
│       ├── console-tab05-ais.png        # Console Tab 05: AIS Traffic Funnel
│       ├── console-tab07-report.png     # Console Tab 07: Forensic Dossier
│       ├── console-ais-gap.png          # Scenario SYN-003: 210-min AIS Gap Analysis
│       ├── console-ensemble-dispersion.png # Scenario SYN-005: Ensemble Dispersion
│       ├── tanker-3d-model.jpg          # 3D Photorealistic Tanker Asset
│       ├── spilltrace-logo.png          # SPILLTRACE Brand Emblem
│       └── spilltrace-emblem.png        # Official Crest
│
├── public/                              # Static public assets served by Vite
│   ├── images/                          # Layer textures, icons, and 3D vessel graphics
│   │   ├── layers/                      # 4-stage SAR imagery textures (raw, mask, lookalike, verified)
│   │   ├── vessel_3d_normal.png         # Pre-oriented transparent 3D ship icon (0° North)
│   │   ├── vessel_3d_selected.png       # Candidate vessel 3D ship icon with amber selection aura
│   │   └── tanker_3d_photoreal_master.jpg
│   └── models/
│       └── vessel_tanker.glb            # Binary glTF 3D model for WebGL scenes
│
├── src/                                 # Application source code
│   ├── App.jsx                          # View routing and active tab controller
│   ├── main.jsx                         # React 19 DOM entry point
│   ├── components/                      # Modular UI component hierarchy
│   │   ├── analysis/                    # Slick characterisation and morphology scroll
│   │   ├── attribution/                 # Evidence fusion narrative components
│   │   ├── common/                      # Shared buttons, badges, modals, and spinners
│   │   ├── console/                     # 7-stage forensic investigation workstation
│   │   │   ├── InvestigationConsoleModal.jsx # Main modal frame
│   │   │   ├── InvestigationWorkspace.jsx   # 7-stage content panels & controls
│   │   │   └── InvestigationMap.jsx         # Synchronized Mapbox forensic map
│   │   ├── detection/                   # SAR analysis viewer & 3D progressive layer stack
│   │   ├── drift/                       # Drift dynamics, RK4 advection, and forecast views
│   │   ├── hero/                        # Hero section with WebGL Three.js ocean dynamics
│   │   ├── incidents/                   # Incidents archive catalog & regional maritime map
│   │   └── layout/                      # Navbar, header, and system footer
│   ├── data/
│   │   └── incidentsData.js             # 12 real-world Indian Ocean maritime incident records
│   └── services/                        # Service layer facade, algorithms, and cartography
│       ├── map/                         # Mapbox data sources, layers, geometry, and 3D layers
│       │   ├── mapboxSources.js         # GeoJSON generators for slicks, drift, origin, and AIS
│       │   ├── mapboxLayers.js          # Symbolic styling, containment rings, and time markers
│       │   ├── mapGeometry.js           # Haversine, bearing, and geodetic math utilities
│       │   ├── basemapProvider.js       # Nautical cartography and satellite basemap feeds
│       │   └── vessel3DLayer.js         # Mapbox CustomLayerInterface for Three.js 3D ships
│       ├── scenariosData.js             # 5 canonical ground-truth forensic scenarios (SYN-001 to 005)
│       ├── spilltraceService.js         # 7-stage pipeline engine & parameter propagation
│       └── types.js                     # Standardized data schemas, disclaimers, and constants
│
└── scratch/                             # Test verification suites & validation scripts
    ├── run_requirements_verification.mjs # 82 automated compliance tests (100% pass)
    ├── verify_all_maps.mjs              # Playwright browser automation for all stages
    └── test_incident_page_data_flow.mjs # Incident switching & catalog tests
```

---

## 21. Installation & Environment Setup

### System Prerequisites

- **Operating System:** Windows 10/11, macOS (12+), or Linux (Ubuntu 22.04+).
- **Node.js:** v18.0.0 or higher (v20+ recommended).
- **NPM:** v9.0.0 or higher.
- **Hardware Acceleration:** Modern browser supporting WebGL 2.0 (Google Chrome, Microsoft Edge, Firefox, or Safari).

### Step 1: Clone the Repository

```bash
git clone https://github.com/yogeshcodes27/SPILL-TRACE.git
cd SPILLTRACE
```

### Step 2: Install Node Dependencies

Install the locked dependencies:

```bash
npm install
```

---

## 22. Configuration

Create a `.env` file in the project root to configure mapping endpoints and service parameters:

```bash
cp .env.example .env
```

### Environment Variables Reference

```ini
# Mapbox Public Access Token (Required for custom vector basemaps)
# Note: If no token is provided, the platform automatically falls back to 
# high-performance OpenStreetMap / CartoDB Dark Matter raster tiles.
VITE_MAPBOX_TOKEN=pk.your_actual_mapbox_token_here

# Pipeline Environment
VITE_APP_ENV=development
VITE_ENABLE_SYNTHETIC_SCENARIOS=true
```

> [!WARNING]
> **Security Notice:** Never commit actual `.env` files or API secrets to version control. The repository's `.gitignore` explicitly excludes `.env` and `.env.local`.

---

## 23. Running the Platform

### Start Development Server

Launch the Vite local development server:

```bash
npm run dev
```

The application will start immediately at:
```text
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### Build Production Bundle

To compile and optimize the production distribution:

```bash
npm run build
```

This compiles static assets into `dist/` with code-splitting and asset compression.

### Preview Production Build

To preview the built production bundle locally:

```bash
npm run preview
```

---

## 24. End-to-End Walkthrough: Scenario SYN-001

To experience the platform's complete investigation capabilities, execute the canonical **SYN-001 (Coromandel Coast / Bay of Bengal)** investigation:

```
[INC-2026-001 Intake] ──> [Detect 12.6 km² Slick] ──> [Characterise 068° Axis] ──> 
[12h Reverse Advection (16.8 NM)] ──> [Origin 95% CI (r = 2.8 km)] ──> 
[Corridor AIS Intersect] ──> [PACIFIC HORIZON Scored at 88/100] ──> [Export Dossier]
```

### Step 1: Incident Intake (`01 ARCHIVE`)
1. Navigate to `#incidents` in the top navigation bar.
2. Select **Case INC-2026-001** (Coromandel Coast / Bay of Bengal).
3. Review scene telemetry: Sentinel-1A C-SAR, acquisition `2026-06-18 06:42:00 UTC`, spatial resolution `10m`, noise floor `-22.4 dB`.
4. Click **`OPEN INVESTIGATION CONSOLE →`**.

### Step 2: Detection & Screening (`02 DETECTION`)
1. Click the **`02 DETECTION`** tab.
2. Observe the calibrated radar backscatter showing capillary wave damping $(-8.2\text{ dB})$.
3. Inspect the **Look-Alike Ledger**: Region 1 confirmed as mineral oil ($96.4\%$ confidence); low-wind calm shadows and vessel wakes rejected.
4. Verify segmented area: $12.6\text{ km}^2$.

### Step 3: Morphological Characterisation (`03 SLICK ANALYSIS`)
1. Click **`03 SLICK ANALYSIS`**.
2. Inspect the extracted geometry: Major axis $= 6.2\text{ km}$, Minor axis $= 1.8\text{ km}$, Aspect ratio $= 3.44$, Orientation $= 068.0^\circ\text{ NW}$.
3. Review physical dispersion assessment: The $068^\circ$ elongation corresponds directly to primary surface current shear.

### Step 4: Backward Drift & Origin Reconstruction (`04 DRIFT & ORIGIN`)
1. Click **`04 DRIFT & ORIGIN`**.
2. Review coupled metocean forcing: ECMWF ERA5 wind ($14.2\text{ kn} @ 054^\circ$) and CMEMS current ($0.62\text{ m/s} @ 234^\circ$).
3. Examine the reconstructed trajectory: $16.8\text{ NM}$ backward displacement over $12\text{ hours}$.
4. Inspect the map: Three concentric green origin containment rings ($50\%$, $75\%$, and $95\%$ CI with $r = 2.8\text{ km}$) centered at $[80.088^\circ\text{E}, 11.162^\circ\text{N}]$.
5. Review the temporal release window: `17 JUN · 17:57 UTC` to `17 JUN · 19:27 UTC`.

### Step 5: AIS Traffic Correlation (`05 AIS TRAFFIC`)
1. Click **`05 AIS TRAFFIC`**.
2. Observe the filtering funnel: 428 raw basin tracks filtered down to 3 regional candidates matching the spatiotemporal window.
3. Observe vessel tracks plotted along the deep-water shipping corridor.

### Step 6: Forensic Evidence Fusion (`06 EVIDENCE FUSION`)
1. Click **`06 EVIDENCE FUSION`**.
2. The map automatically re-centers and renders candidate crude tanker ***PACIFIC HORIZON*** (MMSI 419001001) at its exact Closest Point of Approach ($0.4\text{ NM}$ from origin centroid).
3. The vessel icon displays a high-resolution 3D tanker model rotated to match its Course Over Ground ($038^\circ\text{ COG}$).
4. An amber dashed CPA tie-line connects the vessel directly to the reconstructed origin.
5. Review the **Composite Attribution Score ($88/100$ - HIGH PRIORITY)** and examine each of the 5 component factor scores.
6. Verify rank stability: $94\%$ across 100 Monte Carlo perturbation runs.

### Step 7: Export Formal Dossier (`07 EVIDENCE REPORT`)
1. Click **`07 EVIDENCE REPORT`**.
2. Review the structured inspection dossier with all findings, metocean parameters, and chain-of-custody hashes.
3. Click **`DOWNLOAD OFFICIAL DOSSIER (PDF/GEOJSON)`** to export the case file for Port State Control enforcement.

---

## 25. Verification & Testing

SPILLTRACE includes an automated verification test suite to ensure strict adherence to all specifications in `02_REQUIREMENTS.md`.

### Run Automated Requirements Verification

```bash
npm test
```

### Verification Output

```text
══════════════════════════════════════════════════════════════════════
STARTING AUTOMATED SYSTEM SPECIFICATION COMPLIANCE VERIFICATION
══════════════════════════════════════════════════════════════════════

▶ 1. FUNCTIONAL REQUIREMENTS (FR-001 – FR-020)
  ✓ [FR-001] Scene ingestion: validates georeferenced Sentinel-1 scene metadata
  ✓ [FR-002] SAR preprocessing: calibrated backscatter handling (VV/VH dB)
  ✓ [FR-003] Oil-spill segmentation: pixel-level segmentation mask extraction
  ✓ [FR-004] Confidence: retains continuous probability score (0.0 to 1.0)
  ✓ [FR-005] Spill polygon: converts mask to georeferenced vector geometry
  ✓ [FR-006] Geometry: calculates area, perimeter, centroid, and major/minor axes
  ✓ [FR-007] Acquisition time: retains exact ISO-8601 acquisition timestamp
  ✓ [FR-008] Age estimation: provides cautious, bounded spill age constraint
  ✓ [FR-009] Environmental forcing: accepts ERA5 wind and CMEMS current vectors
  ✓ [FR-010] Backward hindcast: supports reverse Lagrangian drift simulation
  ✓ [FR-011] Origin uncertainty: outputs 95% CI spatial region and time window
  ✓ [FR-012] Forward forecast: simulates forward dispersion risk envelope
  ✓ [FR-013] AIS ingestion: ingests chronological AIS transponder records
  ✓ [FR-014] AIS filtering: spatiotemporal filtering using origin envelope
  ✓ [FR-015] Vessel trajectory reconstruction: builds contiguous vessel tracks
  ✓ [FR-016] Candidate generation: isolates qualifying candidate vessels
  ✓ [FR-017] Explainable scoring: computes multi-factor evidence decomposition
  ✓ [FR-018] Evidence display: transparent UI exposing factor breakdowns
  ✓ [FR-019] Map visualization: interactive vector layers for slick, drift, origin, AIS
  ✓ [FR-020] Export: structured GeoJSON, JSON provenance, and dossier export

▶ 2. DATA REQUIREMENTS (DR-001 – DR-005)
  ✓ [DR-001] Sentinel-1 training dataset: references Zenodo Parts I, II, III
  ✓ [DR-002] Operational imagery: supports Copernicus Data Space GRD products
  ✓ [DR-003] AIS reference source: adheres to MarineCadastre standards
  ✓ [DR-004] Environmental forcing data: specifies CMEMS PHY_001_024 and ERA5
  ✓ [DR-005] Synthetic AIS: explicitly labels synthetic test scenarios

▶ 3. MACHINE LEARNING REQUIREMENTS (MLR-001 – MLR-005)
  ✓ [MLR-001] Hard-negative handling: screens biogenic and meteorological look-alikes
  ✓ [MLR-002] Avoid dark-patch shortcut: multi-polarimetric contrast verification
  ✓ [MLR-003] Spatial generalisation: preserves geotransform across scenes
  ✓ [MLR-004] Reproducibility: records model version, seed, and audit disclaimer
  ✓ [MLR-005] Model selection: radiometric validation with -22.4 dB noise floor

▶ 4. GEOSPATIAL REQUIREMENTS (GR-001 – GR-005)
  ✓ [GR-001] Defined CRS: all geometries standardize on WGS84 (EPSG:4326)
  ✓ [GR-002] Coordinate distinction: preserves pixel resolution and geographic coordinates
  ✓ [GR-003] Area calculation: computed using equal-area geodesic math (km²)
  ✓ [GR-004] AIS coordinate normalization: longitudes [-180, 180], latitudes [-90, 90]
  ✓ [GR-005] Timestamped drift positions: trajectory points retain discrete hourly steps

▶ 5. DRIFT / HINDCAST REQUIREMENTS (BR-001 – BR-006)
  ✓ [BR-001] Time-dependent forcing: accommodates temporal wind/current velocity fields
  ✓ [BR-002] Backward trajectory simulation: GNOME-aligned Lagrangian advection
  ✓ [BR-003] Forward trajectory simulation: predicts 48h coastal impact risk
  ✓ [BR-004] Environmental forcing provenance: retains metocean source metadata
  ✓ [BR-005] Sensitivity analysis: Monte Carlo perturbations under forcing uncertainty
  ✓ [BR-006] Origin output: spatial region, release window, and coverage metric

▶ 6. AIS REQUIREMENTS (AIR-001 – AIR-007)
  ✓ [AIR-001] AIS records: validates MMSI, timestamp, coords, SOG, COG, heading
  ✓ [AIR-002] Chronological sorting: verifies chronological sorting per vessel track
  ✓ [AIR-003] Invalid coordinates: filters NaN and out-of-bounds positions
  ✓ [AIR-004] Speed bounds check: validates merchant speed limits (0–40 kn)
  ✓ [AIR-005] AIS gap handling: preserves transponder gap without synthetic interpolation
  ✓ [AIR-006] Candidate filtering: combined spatiotemporal filtering window
  ✓ [AIR-007] AIS gap context: evaluated as evidentiary indicator, not automatic guilt

▶ 7. ATTRIBUTION REQUIREMENTS (AR-001 – AR-004)
  ✓ [AR-001] Candidate score: explainable multi-component formula with documented weights
  ✓ [AR-002] No black-box verdict: UI and report expose 5 component factor breakdowns
  ✓ [AR-003] Uncertainty linkage: candidate score conditioned on origin uncertainty
  ✓ [AR-004] Terminology constraints: strictly uses "candidate vessel" / "investigative lead"

▶ 8. SYNTHETIC SCENARIO REQUIREMENTS (Scenarios 1 – 5)
  ✓ [SYN-001] Scenario 1: single clear candidate (PACIFIC HORIZON @ 88/100)
  ✓ [SYN-002] Scenario 2: multiple nearby vessels with differentiated scoring
  ✓ [SYN-003] Scenario 3: AIS transmission gap during corridor transit (210-min blackout)
  ✓ [SYN-004] Scenario 4: no matching vessel / legitimate system abstention
  ✓ [SYN-005] Scenario 5: drift uncertainty with Monte Carlo ensemble evaluation

▶ 9. NON-FUNCTIONAL REQUIREMENTS (NFR-001 – NFR-005)
  ✓ [NFR-001] Reproducibility: identical inputs yield identical outputs
  ✓ [NFR-002] Auditability: every output retains complete algorithm provenance
  ✓ [NFR-003] Performance: sub-second synchronous 7-stage pipeline execution
  ✓ [NFR-004] Scalability: spatiotemporal bounding prevents global AIS memory bloat
  ✓ [NFR-005] Failure handling: handles null inputs gracefully without crashing

▶ 10. INTERFACE REQUIREMENTS (UIR-001 – UIR-005)
  ✓ [UIR-001] Overview map: visualizes satellite footprint, slick, origin, and drift
  ✓ [UIR-002] Candidate panel: vessel ID, position, score, factor breakdown, trajectory
  ✓ [UIR-003] Evidence timeline: synchronized release window and observation timestamps
  ✓ [UIR-004] Uncertainty visualization: origin uncertainty ellipse and ensemble spread
  ✓ [UIR-005] Data provenance: source inspectability and timestamps visible in interface

▶ 11. EVALUATION REQUIREMENTS (EVR-001 – EVR-005)
  ✓ [EVR-001] Detector metrics: Dice, IoU, Precision, Recall, FPR reported
  ✓ [EVR-002] Look-alikes: performance specifically evaluated on look-alike examples
  ✓ [EVR-003] Origin metrics: median origin distance error and containment rate reported
  ✓ [EVR-004] Attribution metrics: Top-1 candidate ranking and rank stability reported
  ✓ [EVR-005] End-to-end evaluation: all 5 synthetic scenarios tested against known ground truth

▶ 12. ACCEPTANCE CRITERIA (1 – 10)
  ✓ [AC-1] Ingest real georeferenced Sentinel-1 scene
  ✓ [AC-2] Detect spill candidate with confidence
  ✓ [AC-3] Generate georeferenced vector polygon
  ✓ [AC-4] Run Lagrangian drift simulation
  ✓ [AC-5] Produce origin uncertainty region
  ✓ [AC-6] Ingest historical AIS records
  ✓ [AC-7] Reconstruct candidate vessel trajectories
  ✓ [AC-8] Calculate explainable multi-factor evidence
  ✓ [AC-9] Visualize complete 7-stage chain
  ✓ [AC-10] Clearly distinguish real, simulated, and synthetic data

══════════════════════════════════════════════════════════════════════
TOTAL COMPLIANCE CHECKS: 82 | PASSED: 82 | FAILED: 0
★ 100% COMPLIANCE ACHIEVED ACROSS ALL 02_REQUIREMENTS.MD SPECIFICATIONS ★
══════════════════════════════════════════════════════════════════════
```

---

## 26. Data Sources & Provenance Registry

The SPILLTRACE architecture is designed to consume data from established, authoritative providers:

| Data Layer | Primary Data Source | Product Specification | Role in SPILLTRACE |
| :--- | :--- | :--- | :--- |
| **SAR Imagery** | European Space Agency (ESA) Copernicus Data Space | Sentinel-1 C-SAR GRD (VV/VH, $10\text{m}$ resolution) | Raw satellite observation for slick detection. |
| **ML Training Baseline** | Zenodo Sentinel-1 SAR Oil Spill Dataset | Records [8346860](https://zenodo.org/records/8346860), [8253899](https://zenodo.org/records/8253899), [13761290](https://zenodo.org/records/13761290) | Training, validation, and look-alike benchmark. |
| **Ocean Currents** | Copernicus Marine Service (CMEMS) | `GLOBAL_ANALYSISFORECAST_PHY_001_024` (Daily & Hourly surface $u, v$) | Hydrodynamic Eulerian advection forcing. |
| **Atmospheric Wind** | ECMWF Climate Data Store | ERA5 Reanalysis ($10\text{m}$ $u, v$ near-surface winds) | Downwind leeway forcing ($3.0\%$). |
| **AIS Vessel Tracking** | MarineCadastre / NOAA | AccessAIS / Standardized NMEA AIS Broadcasts | Historical commercial vessel trajectories. |
| **Indian Reference System** | ESSO-INCOIS | Online Oil Spill Advisory System (OOSA) | Operational Indian coast trajectory benchmark. |

---

## 27. Scientific Prior Art & Citations

SPILLTRACE builds upon peer-reviewed scientific literature and operational maritime precedents:

1. **Luo et al. (2024):** *A new ship tracing technology from oil spills based on multi-source data*, Marine Pollution Bulletin, 207, 116808. DOI: [10.1016/j.marpolbul.2024.116808](https://doi.org/10.1016/j.marpolbul.2024.116808).  
   *Validates bidirectional Lagrangian advection modeling and trajectory similarity scoring between spills and ship paths.*
2. **Busler, Wehn & Woodhouse (2015):** *Vessel tracking for illegal pollutant discharges*, ISPRS - International Archives of the Photogrammetry, Remote Sensing and Spatial Information Sciences, XL-7/W3, 927–934. DOI: [10.5194/isprsarchives-XL-7-W3-927-2015](https://doi.org/10.5194/isprsarchives-XL-7-W3-927-2015).  
   *Establishes the foundational methodology and evidentiary challenges in multi-source vessel attribution.*
3. **EMSA CleanSeaNet (European Maritime Safety Agency):** Operational satellite-based oil spill monitoring and vessel detection service. [EMSA CleanSeaNet](https://www.emsa.europa.eu/csn-menu.html).  
   *Demonstrates legal precedence for utilizing satellite imagery combined with AIS in European court proceedings.*
4. **NOAA General NOAA Operational Modeling Environment (GNOME):** [NOAA GNOME Suite](https://response.restoration.noaa.gov/oil-and-chemical-spills/oil-spills/response-tools/gnome).  
   *Provides the authoritative mathematical baseline for reverse-time trajectory hindcasting of mystery spills.*
5. **ESSO-INCOIS OOSA (Online Oil Spill Advisory):** Ministry of Earth Sciences, Government of India. [INCOIS OOSA](https://oosa.incois.gov.in/).  
   *Demonstrates operational hydrodynamic trajectory forecasting along Indian coastlines using coupled numerical models.*

---

## 28. Technical Limitations & Operational Realities

To maintain scientific integrity and avoid overclaiming capabilities, SPILLTRACE explicitly documents its technical boundaries:

1. **Look-Alike Ambiguities in Low Winds:** Under calm surface winds ($< 2.5\text{ m/s}$), natural sea surface smoothing occurs without oil, producing false positives. Under high winds ($> 14\text{ m/s}$), wave turbulence breaks up surface slicks, causing oil to disperse into the water column.
2. **Spatial and Temporal Resolution:** Sentinel-1 has a 12-day repeat orbit (6 days with two satellites). A satellite pass captures a snapshot in time; it does not provide continuous real-time video surveillance.
3. **Metocean Model Discretization:** ERA5 atmospheric grids ($0.25^\circ \approx 28\text{ km}$) and CMEMS ocean physics ($0.083^\circ \approx 9\text{ km}$) cannot resolve sub-mesoscale coastal eddies and shallow harbor bathymetry without high-resolution nested hydrodynamic models.
4. **Dark Vessels (AIS Inactive):** Vessels engaged in illicit discharge may deliberately turn off transponders (operating "dark") or spoof their MMSI identities. In such scenarios, SPILLTRACE triggers its **Abstention Protocol** rather than falsely accusing an innocent nearby vessel.
5. **Non-Vessel Pollution Sources:** Oil slicks can originate from offshore drilling platforms, submerged pipeline ruptures, shipwrecks, or natural hydrocarbon seeps. Attribution scoring must be cross-referenced with bathymetric infrastructure maps.

---

## 29. Responsible Use & Legal Disclaimer

> [!CAUTION]
> **CRITICAL LEGAL NOTICE:**  
> SPILLTRACE is an **investigative decision-support and analytical triage system**. It does **NOT** constitute an automatic legal finding of liability or criminal guilt under maritime law (such as MARPOL 73/78 Annex I or the Indian Merchant Shipping Act).
> 
> A **HIGH PRIORITY** attribution score indicates that a vessel's recorded spatial and temporal trajectory is mathematically consistent with the reconstructed origin conditions. It does **not** prove that the vessel discharged the pollutant. Authoritative enforcement action requires qualified maritime investigator oversight, chain-of-custody verification, physical oil fingerprinting (gas chromatography-mass spectrometry bunkering samples), and formal Port State Control inspections.

---

## 30. Future Development Roadmap

1. **Multi-Constellation Radar Fusion:** Integrating RADARSAT Constellation Mission (RCM), TerraSAR-X, and the forthcoming NASA-ISRO SAR (NISAR) L/S-band mission to reduce satellite revisit intervals down to $< 6\text{ hours}$.
2. **Operational OpenDrift / OpenOil Numerical Integration:** Directly binding the open-source Python OpenDrift library as a backend microservice for full 3D weathering (evaporation, emulsification, natural dispersion).
3. **Satellite-Based Dark Vessel Detection:** Applying Constant False Alarm Rate (CFAR) vessel detection algorithms directly onto raw SAR scenes to detect radar-reflective metallic ship hulls that lack corresponding AIS transponder signals.
4. **Real-Time AIS Streaming:** Ingesting live terrestrial and satellite AIS feeds via WebSocket connections from AISHub or national coast guard coastal radar chains.
5. **Automated Port State Control Interoperability:** Generating standardized maritime inspection notices adhering to Indian Coast Guard (ICG) and Indian Maritime Administration reporting standards.

---

## 31. Project Information & License

- **Project Name:** SPILLTRACE — Forensic Maritime Spill Intelligence Platform
- **Problem Statement ID:** SIH26143
- **Theme:** Disaster Management (Software)
- **Organization:** National Technical Research Organisation (NTRO)
- **License:** Distributed under the [MIT License](LICENSE).

<p align="center">
  <img src="docs/images/spilltrace-emblem.png" alt="SPILLTRACE Emblem" width="120" />
  <br />
  <strong>SPILLTRACE // MARITIME FORENSIC INTELLIGENCE</strong>
  <br />
  <em>"Cleaner Oceans · Safer Tomorrows"</em>
</p>
