# Graph Report - SPILLTRACE  (2026-09-21)

## Corpus Check
- 53 files · ~137,756 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 172 nodes · 340 edges · 17 communities (6 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Geospatial & Map Visualization
- Core Module Group 7
- Core Module Group 8
- Core Module Group 9
- Core Module Group 10
- Core Module Group 11
- Core Module Group 12
- Core Module Group 13
- Core Module Group 14
- Core Module Group 15
- Core Module Group 16

## God Nodes (most connected - your core abstractions)
1. `react` - 19 edges
2. `InvestigationWorkspace()` - 14 edges
3. `InvestigationMap()` - 13 edges
4. `delay()` - 12 edges
5. `toLatLng()` - 9 edges
6. `toLatLngs()` - 8 edges
7. `haversineDistanceNm()` - 7 edges
8. `projectPoint()` - 7 edges
9. `getDeterministicSegmentation()` - 7 edges
10. `renderDriftLayer()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `getScenarioIdForIncident()`  [EXTRACTED]
  src/App.jsx → src/services/spilltraceService.js
- `InvestigationWorkspace()` --calls--> `getScenarioIdForIncident()`  [EXTRACTED]
  src/components/console/InvestigationWorkspace.jsx → src/services/spilltraceService.js
- `IncidentsArchive()` --calls--> `exportGeoJson()`  [EXTRACTED]
  src/components/incidents/IncidentsArchive.jsx → src/services/spilltraceService.js
- `renderAisLayer()` --calls--> `haversineDistanceNm()`  [EXTRACTED]
  src/services/map/mapLayers.js → src/services/map/mapGeometry.js
- `InvestigationMap()` --calls--> `getSatelliteBasemap()`  [EXTRACTED]
  src/components/console/InvestigationMap.jsx → src/services/map/basemapProvider.js

## Import Cycles
- None detected.

## Communities (17 total, 11 thin omitted)

### Community 0 - "Geospatial & Map Visualization"
Cohesion: 0.13
Nodes (28): InvestigationWorkspace(), haversineDistanceNm(), scenario1, scenario2, scenario3, scenario4, scenario5, SCENARIO_LIST (+20 more)

### Community 1 - "Geospatial & Map Visualization"
Cohesion: 0.18
Nodes (25): leaflet, ref_leaflet_dist_leaflet_css, InvestigationMap(), BASEMAP_MODES, getSatelliteBasemap(), getStreetBasemap(), isSatelliteConfigured(), bboxToLatLngBounds() (+17 more)

### Community 2 - "Geospatial & Map Visualization"
Cohesion: 0.11
Nodes (11): react, three, SlickCharacterisationScroll(), STAGES, EvidenceFusionScroll(), SpilltraceLogo(), DetectionLayers3D(), LAYER_IMAGES (+3 more)

### Community 3 - "Geospatial & Map Visualization"
Cohesion: 0.08
Nodes (23): dependencies, leaflet, react, react-dom, three, @vitejs/plugin-react, description, devDependencies (+15 more)

### Community 4 - "Geospatial & Map Visualization"
Cohesion: 0.09
Nodes (22): ref_react_dom_client, App(), parseRouteFromLocation(), resolveRouteIds(), DetectionWorkspace(), DriftDynamicsSection(), HeroSection(), src_components_index_detectionlayers3d (+14 more)

### Community 5 - "Geospatial & Map Visualization"
Cohesion: 0.27
Nodes (6): IncidentsArchive(), geoToSvg(), MaritimeIncidentsMap(), INITIAL_INCIDENTS, exportIncidentRecordGeoJson(), getScenarioIdForIncident()

## Knowledge Gaps
- **37 isolated node(s):** `name`, `version`, `description`, `type`, `dev` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 68 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Geospatial & Map Visualization` to `Geospatial & Map Visualization`, `Geospatial & Map Visualization`, `Geospatial & Map Visualization`, `Geospatial & Map Visualization`, `Geospatial & Map Visualization`?**
  _High betweenness centrality (0.343) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Geospatial & Map Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.12762762762762764 - nodes in this community are weakly interconnected._
- **Should `Geospatial & Map Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.11083743842364532 - nodes in this community are weakly interconnected._
- **Should `Geospatial & Map Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Geospatial & Map Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.09420289855072464 - nodes in this community are weakly interconnected._