# SPILLTRACE — Oil Spill Investigation System

SPILLTRACE is an AI-assisted system for detecting marine oil spills and tracing them back to their possible source vessels.

The system combines satellite imagery, ocean and weather information, and vessel movement data to create a single investigation workflow:

**Detect the spill → Understand its movement → Estimate where it originated → Identify vessels that may be linked to it**

---

## Problem

When an oil spill occurs at sea, finding the responsible source is difficult.

A satellite image can show that an oil-like slick exists, but the image alone does not tell investigators:

- Where the spill started
- When the release may have occurred
- How the slick moved after release
- Which vessels were present near the possible origin
- Which vessel has the strongest evidence of being associated with the spill

Ocean currents, wind, vessel movement and the time between the release and satellite observation all affect the final location of the slick.

Therefore, simply detecting an oil slick is not enough. An investigation needs to connect **spatial, temporal and vessel evidence**.

---

## Our Solution

SPILLTRACE connects these steps into one end-to-end investigation workflow.

### 1. Oil Spill Detection

The system starts with Sentinel-1 SAR satellite imagery.

An ML-based segmentation model identifies regions that may represent an oil slick and extracts the detected slick as a geographic region.

The system provides:

- Slick location
- Slick area
- Perimeter
- Centroid
- Detection confidence
- Detection time

This converts a satellite observation into a measurable geospatial object.

---

### 2. Slick Characterisation

After detecting the slick, SPILLTRACE analyses its geographic properties.

The detected region can be represented as a polygon instead of only a highlighted image.

This allows the system to calculate measurements such as:

- Area
- Perimeter
- Centroid
- Geographic extent

These measurements are then used by the following investigation stages.

---

### 3. Origin Reconstruction

The detected slick is not necessarily located at the point where the oil was released.

Wind and ocean currents can transport the slick over time.

SPILLTRACE therefore performs backward drift analysis to estimate where the slick could have originated.

The system produces:

- Estimated origin region
- Estimated release time window
- Backward drift trajectories
- Origin uncertainty region
- Confidence/uncertainty information

Instead of producing one exact point without uncertainty, the system represents the origin as a region with an associated uncertainty.

---

### 4. Vessel Attribution

Once a possible origin region and time window are estimated, SPILLTRACE analyses vessel movement data.

AIS (Automatic Identification System) tracks are compared with the reconstructed origin.

Candidate vessels are evaluated using evidence such as:

- Distance from the estimated origin
- Time spent near the origin
- Trajectory consistency
- Vessel movement behaviour
- Compatibility with the reconstructed spill timeline

The system then produces a ranked list of candidate vessels.

The ranking is intended to support investigation and prioritisation — not to establish legal responsibility by itself.

---

## End-to-End Workflow

```text
Sentinel-1 SAR Image
        ↓
Oil Slick Detection
        ↓
Slick Polygon & Measurements
        ↓
Backward Drift Reconstruction
        ↓
Estimated Origin + Time Window
        ↓
AIS Vessel Filtering
        ↓
Evidence-Based Vessel Attribution
        ↓
Investigation Report
