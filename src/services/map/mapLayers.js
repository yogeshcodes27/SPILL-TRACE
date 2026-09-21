/**
 * SPILLTRACE — Leaflet Map Layer Renderers
 * 
 * Modular layer rendering engines translating structured investigation state into
 * high-precision, performant Leaflet geometries.
 */
import L from 'leaflet';
import { MAP_STYLES } from './mapStyles.js';
import {
  toLatLng,
  toLatLngs,
  calculateSlickAxes,
  generateUncertaintyEllipse,
  getDeterministicSegmentation,
  generateSimulatedSarOverlay,
  projectPoint,
  haversineDistanceNm,
} from './mapGeometry.js';

// ─── 1. Nautical Grayscale Basemap ──────────────────────────────────
export function initBasemapTileLayer(map) {
  const tileLayer = L.tileLayer(MAP_STYLES.tileLayerUrl, {
    attribution: MAP_STYLES.tileAttribution,
    maxZoom: 19,
    subdomains: 'abc',
    className: 'maritime-basemap-tiles',
  });
  tileLayer.addTo(map);
  return tileLayer;
}

// ─── 2. Technical SAR Footprint Layer (Sentinel-1 Scene Extent) ───────
export function renderSarLayer(layerGroup, scenario, visible = true, isSatellite = true) {
  layerGroup.clearLayers();
  if (!visible || !scenario || !scenario.scene || !scenario.scene.bbox) return;

  const [minLon, minLat, maxLon, maxLat] = scenario.scene.bbox;
  const bounds = [
    [minLat, minLon],
    [maxLat, maxLon],
  ];

  const frameColor = isSatellite
    ? MAP_STYLES.sar.frameColor
    : MAP_STYLES.sar.frameColorMap;

  // Clean technical footprint rectangle
  const frame = L.rectangle(bounds, {
    color: frameColor,
    weight: MAP_STYLES.sar.frameWeight,
    dashArray: MAP_STYLES.sar.frameDashArray,
    fillColor: frameColor,
    fillOpacity: MAP_STYLES.sar.fillOpacity,
    interactive: false,
  });
  layerGroup.addLayer(frame);

  // Corner crosshair markers on the footprint
  const corners = [
    [maxLat, minLon],
    [maxLat, maxLon],
    [minLat, minLon],
    [minLat, maxLon],
  ];
  corners.forEach((pt) => {
    const crosshair = L.circleMarker(pt, {
      radius: 3,
      color: frameColor,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      weight: 1,
      interactive: false,
    });
    layerGroup.addLayer(crosshair);
  });

  // Technical acquisition metadata tag on top-left of the swath
  const sceneTag = L.marker([maxLat, minLon], {
    icon: L.divIcon({
      className: 'sar-scene-footprint-tag',
      html: `<div class="px-2 py-0.5 bg-[#111111]/90 text-white font-mono text-[9px] uppercase tracking-wider border border-white/30 whitespace-nowrap shadow-md flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>${scenario.scene.sensor || 'SENTINEL-1 C-SAR'} // ${scenario.scene.sceneId || 'IW_GRDH'}</span>
      </div>`,
      iconSize: [220, 20],
      iconAnchor: [-8, 20],
    }),
    interactive: false,
  });
  layerGroup.addLayer(sceneTag);
}

// ─── 3. Segmentation Layer (Tab 02 Detection) ───────────────────────
export function renderSegmentationLayer(layerGroup, scenario, visible = true, onSelectFeature) {
  layerGroup.clearLayers();
  if (!visible || !scenario) return;

  const regions = getDeterministicSegmentation(scenario);
  regions.forEach((reg) => {
    const style = MAP_STYLES.segmentation[reg.type] || MAP_STYLES.segmentation.oilSlick;

    const poly = L.polygon(reg.polygon, {
      color: style.color,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      weight: style.weight,
      dashArray: style.dashArray || null,
    });

    // Technical inspection tooltip
    poly.bindTooltip(
      `<div class="font-mono text-[10px] uppercase">
        <span class="font-bold block" style="color: ${style.color}">${reg.label}</span>
        <span>Area: ${reg.areaKm2} km² · Conf: ${reg.confidence}</span>
      </div>`,
      { sticky: true, className: 'technical-map-tooltip' }
    );

    if (onSelectFeature) {
      poly.on('click', () => onSelectFeature(reg.type === 'oilSlick' ? 'spill' : 'classification'));
    }

    layerGroup.addLayer(poly);

    // Centroid marker with technical crosshair
    const marker = L.circleMarker(reg.centroid, {
      radius: reg.type === 'oilSlick' ? 5 : 3.5,
      color: '#FFFFFF',
      fillColor: style.color,
      fillOpacity: 1,
      weight: 1.5,
    });
    layerGroup.addLayer(marker);

    // Classification tag on the primary oil slick
    if (reg.type === 'oilSlick') {
      const tag = L.marker(reg.centroid, {
        icon: L.divIcon({
          className: 'spill-classification-tag',
          html: `<div class="px-1.5 py-0.5 bg-[#111111] text-white font-mono text-[9px] uppercase tracking-wider border border-white/30 whitespace-nowrap shadow-xs">
            DETECTED SLICK · ${reg.areaKm2} km²
          </div>`,
          iconSize: [120, 20],
          iconAnchor: [-10, 10],
        }),
        interactive: false,
      });
      layerGroup.addLayer(tag);
    }
  });
}

// ─── 4. Technical Slick & GIS Geometry Layer (Tabs 03–07) ───────────
export function renderTechnicalSlickLayer(layerGroup, scenario, visible = true, showAxes = false, onSelectFeature) {
  layerGroup.clearLayers();
  if (!visible || !scenario || !scenario.spill) return;

  const spill = scenario.spill;
  const polyCoords = toLatLngs(spill.polygon);
  const centroid = toLatLng(spill.centroid);

  // 1. Crisp technical polygon
  const poly = L.polygon(polyCoords, {
    color: MAP_STYLES.slick.polygon.color,
    fillColor: MAP_STYLES.slick.polygon.fillColor,
    fillOpacity: MAP_STYLES.slick.polygon.fillOpacity,
    weight: MAP_STYLES.slick.polygon.weight,
  });

  poly.bindTooltip(
    `<div class="font-mono text-[10px] uppercase">
      <span class="font-bold text-[#111111] block">SLICK GEOMETRY // ${spill.spillId || 'OBSERVED'}</span>
      <span>Area: ${spill.areaKm2} km² · Major: ${spill.majorAxisKm} km</span>
    </div>`,
    { sticky: true, className: 'technical-map-tooltip' }
  );

  if (onSelectFeature) {
    poly.on('click', () => onSelectFeature('spill'));
  }
  layerGroup.addLayer(poly);

  // 2. Centroid Marker
  const centerMarker = L.circleMarker(centroid, {
    radius: MAP_STYLES.slick.centroid.radius,
    color: MAP_STYLES.slick.centroid.color,
    fillColor: MAP_STYLES.slick.centroid.fillColor,
    fillOpacity: MAP_STYLES.slick.centroid.fillOpacity,
    weight: MAP_STYLES.slick.centroid.weight,
  });
  layerGroup.addLayer(centerMarker);

  // 3. GIS Major & Minor Measurement Axes (Tab 03)
  if (showAxes) {
    const axes = calculateSlickAxes(
      spill.centroid,
      spill.majorAxisKm,
      spill.minorAxisKm,
      spill.orientationDeg
    );

    if (axes) {
      // Major Axis Line
      const majorLine = L.polyline(axes.major, {
        color: MAP_STYLES.slick.majorAxis.color,
        weight: MAP_STYLES.slick.majorAxis.weight,
      });
      layerGroup.addLayer(majorLine);

      // Major Axis Label Badge
      const majorLabel = L.marker(axes.major[1], {
        icon: L.divIcon({
          className: 'axis-dimension-label',
          html: `<div class="px-1.5 py-0.5 bg-white text-[#111111] font-mono text-[9px] uppercase border border-[#111111] whitespace-nowrap shadow-xs">
            MAJOR AXIS: ${spill.majorAxisKm} km · ${spill.orientationDeg}°
          </div>`,
          iconSize: [160, 20],
          iconAnchor: [-8, 10],
        }),
        interactive: false,
      });
      layerGroup.addLayer(majorLabel);

      // Minor Axis Line
      const minorLine = L.polyline(axes.minor, {
        color: MAP_STYLES.slick.minorAxis.color,
        weight: MAP_STYLES.slick.minorAxis.weight,
        dashArray: MAP_STYLES.slick.minorAxis.dashArray,
      });
      layerGroup.addLayer(minorLine);

      // Minor Axis Label Badge
      const minorLabel = L.marker(axes.minor[1], {
        icon: L.divIcon({
          className: 'axis-dimension-label',
          html: `<div class="px-1.5 py-0.5 bg-white text-[#555555] font-mono text-[8px] uppercase border border-[#999999] whitespace-nowrap">
            MINOR AXIS: ${spill.minorAxisKm} km
          </div>`,
          iconSize: [120, 18],
          iconAnchor: [-8, 9],
        }),
        interactive: false,
      });
      layerGroup.addLayer(minorLabel);
    }
  }
}

// ─── 5. Drift & Reconstructed Origin Layer (Tab 04) ─────────────────
export function renderDriftLayer(layerGroup, scenario, driftResult, visible = true, onSelectFeature, highlightedFactor = null) {
  layerGroup.clearLayers();
  if (!visible || !scenario) return;

  const drift = driftResult || scenario.drift?.backward;
  if (!drift) return;

  const isDriftFocus = highlightedFactor === 'drift';
  const isSpatialFocus = highlightedFactor === 'spatial';

  const spillCentroid = toLatLng(scenario.spill?.centroid);
  const originCentroid = toLatLng(drift.originCentroid);

  // 1. Uncertainty Corridor (widening envelope from observed slick to origin uncertainty)
  const radiusKm = drift.originRadiusKm || Math.sqrt((drift.originUncertaintyKm2 || 15) / Math.PI);
  const perpBearing = (scenario.forcing?.currentDirectionDeg || 118) + 90;
  const wStart = 1.0; // km half-width at slick
  const wEnd = Math.max(1.5, radiusKm * 0.9); // km half-width at origin
  const [p1Lat, p1Lon] = projectPoint(spillCentroid[0], spillCentroid[1], wStart, perpBearing);
  const [p2Lat, p2Lon] = projectPoint(spillCentroid[0], spillCentroid[1], wStart, perpBearing + 180);
  const [p3Lat, p3Lon] = projectPoint(originCentroid[0], originCentroid[1], wEnd, perpBearing + 180);
  const [p4Lat, p4Lon] = projectPoint(originCentroid[0], originCentroid[1], wEnd, perpBearing);

  const corridorPoly = L.polygon([[p1Lat, p1Lon], [p2Lat, p2Lon], [p3Lat, p3Lon], [p4Lat, p4Lon]], {
    color: isDriftFocus ? '#2563EB' : '#6B7280',
    fillColor: isDriftFocus ? '#3B82F6' : '#9CA3AF',
    fillOpacity: isDriftFocus ? 0.22 : 0.08,
    weight: isDriftFocus ? 2 : 1,
    dashArray: isDriftFocus ? '4, 4' : '3, 4',
  });
  corridorPoly.bindTooltip(
    `<span class="font-mono text-[9px] uppercase">Lagrangian Drift Uncertainty Corridor ${isDriftFocus ? '// DRIFT FACTOR FOCUS' : ''}</span>`,
    { sticky: true }
  );
  layerGroup.addLayer(corridorPoly);

  // 2. Backward Trajectory Polyline
  let trajectoryCoords = [];
  if (Array.isArray(drift.trajectory) && drift.trajectory.length > 1) {
    trajectoryCoords = toLatLngs(drift.trajectory);
  } else {
    // Generate intermediate advection steps between origin and observed
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      trajectoryCoords.push([
        spillCentroid[0] + frac * (originCentroid[0] - spillCentroid[0]),
        spillCentroid[1] + frac * (originCentroid[1] - spillCentroid[1]),
      ]);
    }
  }

  const trajectoryLine = L.polyline(trajectoryCoords, {
    color: MAP_STYLES.drift.trajectory.color,
    weight: MAP_STYLES.drift.trajectory.weight,
    dashArray: MAP_STYLES.drift.trajectory.dashArray,
  });
  layerGroup.addLayer(trajectoryLine);

  // 3. Historical slick positions & intermediate advection time markers
  trajectoryCoords.forEach((pt, idx) => {
    if (idx > 0 && idx < trajectoryCoords.length - 1) {
      const hoursBack = Math.round((idx / (trajectoryCoords.length - 1)) * (drift.durationHours || 12));
      const scale = 1 - (idx / trajectoryCoords.length) * 0.35;
      const histEllipse = generateUncertaintyEllipse(
        pt[1],
        pt[0],
        (scenario.spill?.majorAxisKm || 5) * 0.35 * scale,
        (scenario.spill?.minorAxisKm || 1.8) * 0.35 * scale,
        scenario.spill?.orientationDeg || 300,
        14
      );
      const histPoly = L.polygon(histEllipse, {
        color: '#4B5563',
        fillColor: '#374151',
        fillOpacity: 0.14,
        weight: 1,
        dashArray: '2, 3',
      });
      histPoly.bindTooltip(
        `<span class="font-mono text-[9px] uppercase">Historical Slick Position // T - ${hoursBack}h</span>`,
        { sticky: true }
      );
      layerGroup.addLayer(histPoly);

      const marker = L.circleMarker(pt, {
        radius: MAP_STYLES.drift.advectionPoint.radius,
        color: MAP_STYLES.drift.advectionPoint.color,
        fillColor: MAP_STYLES.drift.advectionPoint.fillColor,
        fillOpacity: MAP_STYLES.drift.advectionPoint.fillOpacity,
        weight: MAP_STYLES.drift.advectionPoint.weight,
      });
      marker.bindTooltip(
        `<span class="font-mono text-[9px]">T - ${hoursBack}h</span>`,
        { permanent: false, direction: 'top' }
      );
      layerGroup.addLayer(marker);
    }
  });

  // 2. Reconstructed Origin Centroid Marker
  const originMarker = L.circleMarker(originCentroid, {
    radius: MAP_STYLES.drift.originCentroid.radius,
    color: MAP_STYLES.drift.originCentroid.color,
    fillColor: MAP_STYLES.drift.originCentroid.fillColor,
    fillOpacity: MAP_STYLES.drift.originCentroid.fillOpacity,
    weight: MAP_STYLES.drift.originCentroid.weight,
  });

  if (onSelectFeature) {
    originMarker.on('click', () => onSelectFeature('origin'));
  }
  layerGroup.addLayer(originMarker);

  // Origin Centroid Callout Badge
  const originTag = L.marker(originCentroid, {
    icon: L.divIcon({
      className: 'origin-marker-tag',
      html: `<div class="px-1.5 py-0.5 bg-[#111111] text-white font-mono text-[9px] uppercase tracking-wider border border-white/30 whitespace-nowrap shadow-xs">
        RECONSTRUCTED ORIGIN // T - ${drift.durationHours || 12}h
      </div>`,
      iconSize: [160, 20],
      iconAnchor: [-10, 10],
    }),
    interactive: false,
  });
  layerGroup.addLayer(originTag);

  // 3. Origin Uncertainty Region (Elongated Ellipse)
  const uncertaintyPolyCoords = generateUncertaintyEllipse(
    drift.originCentroid[0],
    drift.originCentroid[1],
    radiusKm * 1.35, // Semi-major
    radiusKm * 0.85, // Semi-minor
    scenario.forcing?.currentDirectionDeg || 118,
    28
  );

  const uncertaintyPoly = L.polygon(uncertaintyPolyCoords, {
    color: isSpatialFocus ? '#DC2626' : (isDriftFocus ? '#2563EB' : MAP_STYLES.drift.originUncertainty.color),
    fillColor: isSpatialFocus ? '#EF4444' : MAP_STYLES.drift.originUncertainty.fillColor,
    fillOpacity: isSpatialFocus ? 0.32 : (isDriftFocus ? 0.22 : MAP_STYLES.drift.originUncertainty.fillOpacity),
    weight: isSpatialFocus ? 2.5 : MAP_STYLES.drift.originUncertainty.weight,
    dashArray: MAP_STYLES.drift.originUncertainty.dashArray,
  });

  uncertaintyPoly.bindTooltip(
    `<div class="font-mono text-[10px] uppercase">
      <span class="font-bold text-[#111111] block">ORIGIN UNCERTAINTY ENVELOPE ${isSpatialFocus ? '// SPATIAL FACTOR FOCUS' : ''}</span>
      <span>Dispersion Area: ${(drift.originUncertaintyKm2 || 14.8).toFixed(1)} km²</span>
    </div>`,
    { sticky: true, className: 'technical-map-tooltip' }
  );

  layerGroup.addLayer(uncertaintyPoly);

  // Trajectory distance label midway along the path
  const midIndex = Math.floor(trajectoryCoords.length / 2);
  const midPoint = trajectoryCoords[midIndex];
  if (midPoint) {
    const distanceBadge = L.marker(midPoint, {
      icon: L.divIcon({
        className: 'drift-distance-badge',
        html: `<div class="px-1.5 py-0.5 bg-white/90 text-[#333333] font-mono text-[8px] uppercase border border-[#CCCCCC] whitespace-nowrap shadow-2xs">
          BACKWARD DRIFT: ${drift.driftDistanceNm || 16.8} NM
        </div>`,
        iconSize: [130, 18],
        iconAnchor: [65, -8],
      }),
      interactive: false,
    });
    layerGroup.addLayer(distanceBadge);
  }
}

// ─── 6. Metocean Forcing Vectors (Tab 04 & Background) ──────────────
export function renderMetoceanLayer(layerGroup, scenario, visible = true) {
  layerGroup.clearLayers();
  if (!visible || !scenario || !scenario.forcing) return;

  const forcing = scenario.forcing;
  const spillCentroid = toLatLng(scenario.spill?.centroid);

  // Position vector indicator ~12 km North-East of spill
  const [indLat, indLon] = projectPoint(spillCentroid[0], spillCentroid[1], 12, 45);

  // Wind Vector (length scaled to wind speed)
  const windLengthKm = 4.5;
  const [windEndLat, windEndLon] = projectPoint(indLat, indLon, windLengthKm, forcing.windDirectionDeg);
  const windLine = L.polyline([[indLat, indLon], [windEndLat, windEndLon]], {
    color: MAP_STYLES.metocean.wind.color,
    weight: MAP_STYLES.metocean.wind.weight,
  });
  layerGroup.addLayer(windLine);

  // Wind Label
  const windLabel = L.marker([windEndLat, windEndLon], {
    icon: L.divIcon({
      className: 'metocean-wind-label',
      html: `<div class="px-1 py-0.5 bg-white text-[#4B5563] font-mono text-[8px] uppercase border border-[#9CA3AF] whitespace-nowrap">
        WIND: ${forcing.windSpeedKn} kn · ${forcing.windDirectionDeg}°
      </div>`,
      iconSize: [110, 18],
      iconAnchor: [-5, 9],
    }),
    interactive: false,
  });
  layerGroup.addLayer(windLabel);

  // Current Vector (length scaled to current speed)
  const currentLengthKm = 3.5;
  const [curEndLat, curEndLon] = projectPoint(indLat, indLon, currentLengthKm, forcing.currentDirectionDeg);
  const curLine = L.polyline([[indLat, indLon], [curEndLat, curEndLon]], {
    color: MAP_STYLES.metocean.current.color,
    weight: MAP_STYLES.metocean.current.weight,
  });
  layerGroup.addLayer(curLine);

  // Current Label
  const curLabel = L.marker([curEndLat, curEndLon], {
    icon: L.divIcon({
      className: 'metocean-current-label',
      html: `<div class="px-1 py-0.5 bg-white text-[#1F2937] font-mono text-[8px] uppercase border border-[#1F2937] whitespace-nowrap">
        CURRENT: ${forcing.currentSpeedMs} m/s · ${forcing.currentDirectionDeg}°
      </div>`,
      iconSize: [120, 18],
      iconAnchor: [-5, 9],
    }),
    interactive: false,
  });
  layerGroup.addLayer(curLabel);
}

// ─── 7. AIS Trajectories & Vessel Traffic (Tab 05) ───────────────────
export function renderAisLayer(
  layerGroup,
  aisData,
  scenarioId,
  selectedCandidateMmsi,
  onSelectCandidate,
  visible = true,
  drift = null,
  highlightedFactor = null
) {
  layerGroup.clearLayers();
  if (!visible || !aisData || !aisData.tracks) return;

  const isSyn004 = scenarioId === 'SYN-004';
  const hasSelection = !isSyn004 && !!selectedCandidateMmsi;

  // For SYN-004: strictly maintain abstention without candidate track fabrication
  aisData.tracks.forEach((track) => {
    const isCandidate = !isSyn004 && String(track.mmsi) === String(selectedCandidateMmsi);
    const positions = track.positions || [];
    if (positions.length < 2) return;
    const vName = track.vesselName || track.name || 'VESSEL';

    // Fade unrelated vessel tracks when a candidate is selected
    const trackOpacity = isCandidate ? 1.0 : (hasSelection ? 0.22 : 0.65);
    const trackWeight = isCandidate ? 3.5 : (hasSelection ? 1.2 : 2.0);

    // Split positions into non-gap segments if track has an AIS transmission gap
    if (track.hasAisGap && track.aisGap) {
      // SYN-003 Gulf Navigator: Show continuous track -> gap -> continuous track
      const preGap = [];
      const postGap = [];
      let gapStarted = false;

      positions.forEach((p) => {
        if (p.isGap) {
          gapStarted = true;
        } else if (!gapStarted) {
          preGap.push([p.lat, p.lon]);
        } else {
          postGap.push([p.lat, p.lon]);
        }
      });

      // Pre-gap continuous polyline
      if (preGap.length > 1) {
        layerGroup.addLayer(
          L.polyline(preGap, {
            color: isCandidate ? MAP_STYLES.ais.candidateTrack.color : MAP_STYLES.ais.secondaryTrack.color,
            weight: trackWeight,
            opacity: trackOpacity,
          })
        );
      }

      // Explicit AIS transmission gap segment (red-orange dashed line)
      if (preGap.length > 0 && postGap.length > 0) {
        const isGapFocus = highlightedFactor === 'continuity' && isCandidate;
        const gapConnector = [preGap[preGap.length - 1], postGap[0]];
        const gapLine = L.polyline(gapConnector, {
          ...MAP_STYLES.ais.gapSegment,
          color: isGapFocus ? '#DC2626' : MAP_STYLES.ais.gapSegment.color,
          weight: isGapFocus ? 3.5 : MAP_STYLES.ais.gapSegment.weight,
        });
        layerGroup.addLayer(gapLine);

        // Gap badge callout
        const gapMid = [
          (gapConnector[0][0] + gapConnector[1][0]) / 2,
          (gapConnector[0][1] + gapConnector[1][1]) / 2,
        ];
        const gapHours = ((track.aisGap.durationMinutes || 204) / 60).toFixed(1);
        const gapBadge = L.marker(gapMid, {
          icon: L.divIcon({
            className: 'ais-gap-callout',
            html: `<div class="px-1.5 py-0.5 ${isGapFocus ? 'bg-[#DC2626] ring-2 ring-amber-400' : 'bg-[#DC2626]'} text-white font-mono text-[9px] font-bold uppercase tracking-wider border border-white whitespace-nowrap shadow-xs">
              [ AIS GAP ${gapHours}h ${isGapFocus ? '· FOCUS' : ''} ]
            </div>`,
            iconSize: [isGapFocus ? 140 : 110, 20],
            iconAnchor: [isGapFocus ? 70 : 55, 10],
          }),
        });
        gapBadge.bindPopup(
          `<div class="font-mono text-xs p-1">
            <span class="font-bold text-[#DC2626] block uppercase">[ AIS TRANSMISSION GAP ${gapHours}h ]</span>
            <span class="text-[#666666] text-[11px] block mt-1">Vessel: ${vName} (MMSI: ${track.mmsi})</span>
            <span class="text-[#666666] text-[10px] block mt-0.5">Duration: ${track.aisGap.durationMinutes} min</span>
            <span class="text-[#888888] text-[10px] block mt-1 italic">Contextual disclaimer: AIS transmission gaps occur due to atmospheric, satellite, or transceiver limits and do not alone prove intentional shutdown or discharge.</span>
          </div>`
        );
        layerGroup.addLayer(gapBadge);
      }

      // Post-gap continuous polyline
      if (postGap.length > 1) {
        layerGroup.addLayer(
          L.polyline(postGap, {
            color: isCandidate ? MAP_STYLES.ais.candidateTrack.color : MAP_STYLES.ais.secondaryTrack.color,
            weight: trackWeight,
            opacity: trackOpacity,
          })
        );
      }
    } else {
      // Normal continuous vessel track
      const latLngs = positions.map((p) => [p.lat, p.lon]);
      const style = isCandidate
        ? MAP_STYLES.ais.candidateTrackActive
        : MAP_STYLES.ais.secondaryTrack;

      const polyline = L.polyline(latLngs, {
        color: style.color,
        weight: trackWeight,
        opacity: trackOpacity,
        dashArray: style.dashArray || null,
      });

      polyline.bindTooltip(
        `<div class="font-mono text-[10px]">
          <span class="font-bold block">${vName} (MMSI: ${track.mmsi})</span>
          <span>Speed: ${track.avgSpeedKn || track.sog || 12} kn · Type: ${track.vesselType || track.type || 'Tanker'}</span>
        </div>`,
        { sticky: true }
      );

      if (onSelectCandidate) {
        polyline.on('click', () => onSelectCandidate(track.mmsi));
      }
      layerGroup.addLayer(polyline);
    }

    // Timestamp progression pips along the track
    positions.forEach((p, pIdx) => {
      if (pIdx > 0 && pIdx % 5 === 0 && !p.isGap && pIdx < positions.length - 1) {
        const timeStr = p.timestamp ? p.timestamp.substring(11, 16) + ' UTC' : `+${pIdx * 0.5}h`;
        const pip = L.circleMarker([p.lat, p.lon], {
          radius: isCandidate ? 2.5 : 1.8,
          color: isCandidate ? '#111111' : '#9CA3AF',
          fillColor: '#FFFFFF',
          fillOpacity: trackOpacity,
          weight: 1,
        });
        pip.bindTooltip(
          `<span class="font-mono text-[9px]">${timeStr} · ${Math.round(p.sog || 0)} kn · ${Math.round(p.cog || 0)}°</span>`,
          { direction: 'top' }
        );
        layerGroup.addLayer(pip);
      }
    });

    // Closest Point of Approach (CPA) Tie-Line to Reconstructed Origin for Candidate
    if (isCandidate && drift?.originCentroid) {
      let minDistanceNm = Infinity;
      let closestPos = null;
      positions.forEach((p) => {
        if (!p.isGap) {
          const dist = haversineDistanceNm(p.lat, p.lon, drift.originCentroid[1], drift.originCentroid[0]);
          if (dist < minDistanceNm) {
            minDistanceNm = dist;
            closestPos = p;
          }
        }
      });

      if (closestPos && minDistanceNm < 35) {
        const isSpatialFocus = highlightedFactor === 'spatial';
        const isTemporalFocus = highlightedFactor === 'temporal';
        const cpaLine = L.polyline(
          [[closestPos.lat, closestPos.lon], [drift.originCentroid[1], drift.originCentroid[0]]],
          {
            color: isSpatialFocus ? '#DC2626' : '#111111',
            weight: isSpatialFocus ? 2.5 : 1.5,
            dashArray: isSpatialFocus ? '4, 4' : '3, 4',
          }
        );
        layerGroup.addLayer(cpaLine);

        const cpaMid = [
          (closestPos.lat + drift.originCentroid[1]) / 2,
          (closestPos.lon + drift.originCentroid[0]) / 2,
        ];
        const cpaBadge = L.marker(cpaMid, {
          icon: L.divIcon({
            className: 'cpa-distance-badge',
            html: `<div class="px-1.5 py-0.5 ${isSpatialFocus ? 'bg-[#DC2626]' : 'bg-[#111111]'} text-white font-mono text-[8px] uppercase tracking-wider border border-white/40 whitespace-nowrap shadow-xs font-bold">
              CPA: ${minDistanceNm.toFixed(1)} NM ${isSpatialFocus ? '· SPATIAL FOCUS' : ''}
            </div>`,
            iconSize: [isSpatialFocus ? 130 : 90, 18],
            iconAnchor: [isSpatialFocus ? 65 : 45, 9],
          }),
          interactive: false,
        });
        layerGroup.addLayer(cpaBadge);

        // Highlight transit time when Temporal Compatibility is active
        if (isTemporalFocus) {
          const transitBadge = L.marker([closestPos.lat, closestPos.lon], {
            icon: L.divIcon({
              className: 'temporal-focus-badge',
              html: `<div class="px-1.5 py-0.5 bg-[#111111] text-emerald-400 font-mono text-[8px] uppercase tracking-wider border border-emerald-400 whitespace-nowrap shadow-xs font-bold">
                TRANSIT: ${closestPos.timestamp ? closestPos.timestamp.substring(11, 16) + ' UTC' : 'WINDOW'} [TEMPORAL FOCUS]
              </div>`,
              iconSize: [160, 18],
              iconAnchor: [80, 22],
            }),
            interactive: false,
          });
          layerGroup.addLayer(transitBadge);
        }
      }
    }

    // Directional Vessel Marker at latest position
    const lastPos = positions[positions.length - 1];
    if (lastPos) {
      const cog = Math.round(lastPos.cog != null ? lastPos.cog : 0);
      const sog = Math.round((lastPos.sog != null ? lastPos.sog : (track.avgSpeedKn || 12)) * 10) / 10;
      const vColor = isCandidate ? '#111111' : '#4B5563';
      const vFill = isCandidate ? '#FFFFFF' : '#9CA3AF';
      const vSize = isCandidate ? 24 : 18;

      // Directional vessel SVG icon oriented to COG
      const vesselIcon = L.divIcon({
        className: 'directional-vessel-marker',
        html: `<div style="transform: rotate(${cog}deg); transform-origin: 50% 50%; display: flex; align-items: center; justify-content: center; width: ${vSize}px; height: ${vSize}px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
          <svg width="${vSize}" height="${vSize}" viewBox="0 0 24 24" style="overflow: visible;">
            <polygon points="12,1 21,21 12,16 3,21" fill="${vFill}" stroke="${vColor}" stroke-width="${isCandidate ? 2 : 1.5}" stroke-linejoin="round"/>
            ${isCandidate ? '<circle cx="12" cy="11" r="2.5" fill="#111111"/>' : ''}
          </svg>
        </div>`,
        iconSize: [vSize, vSize],
        iconAnchor: [vSize / 2, vSize / 2],
      });

      const vMarker = L.marker([lastPos.lat, lastPos.lon], { icon: vesselIcon });
      vMarker.bindTooltip(
        `<div class="font-mono text-[10px]">
          <span class="font-bold block text-[#111111]">${vName} // ${track.mmsi}</span>
          <span>SOG: ${sog} kn · COG: ${cog}° · Type: ${track.vesselType || track.type || 'Vessel'}</span>
        </div>`,
        { direction: 'top', sticky: true }
      );

      if (onSelectCandidate) {
        vMarker.on('click', () => onSelectCandidate(track.mmsi));
      }
      layerGroup.addLayer(vMarker);

      // Speed & Heading Predictor Vector ahead of vessel (15-min course lookahead)
      if (sog > 0) {
        const advanceDistKm = (sog * 1.852) * 0.25; // 15 min lookahead in km
        const [projLat, projLon] = projectPoint(lastPos.lat, lastPos.lon, advanceDistKm, cog);
        const headingLine = L.polyline([[lastPos.lat, lastPos.lon], [projLat, projLon]], {
          color: isCandidate ? '#111111' : '#6B7280',
          weight: isCandidate ? 2 : 1.2,
          dashArray: '2, 3',
        });
        layerGroup.addLayer(headingLine);
      }

      // Label on candidate vessel
      if (isCandidate) {
        const vLabel = L.marker([lastPos.lat, lastPos.lon], {
          icon: L.divIcon({
            className: 'candidate-vessel-tag',
            html: `<div class="px-1.5 py-0.5 bg-[#111111] text-white font-mono text-[9px] uppercase tracking-wider border border-white/30 whitespace-nowrap shadow-xs">
              [ CANDIDATE ] ${vName} · ${track.mmsi}
            </div>`,
            iconSize: [180, 20],
            iconAnchor: [-10, 10],
          }),
          interactive: false,
        });
        layerGroup.addLayer(vLabel);
      }
    }
  });
}

// ─── 8. Stability Ensemble Envelopes (SYN-005) ──────────────────────
export function renderEnsembleLayer(layerGroup, ensembleData, scenarioId, visible = true, scenario = null) {
  layerGroup.clearLayers();
  if (!visible || scenarioId !== 'SYN-005' || !ensembleData) return;

  const runs = Array.isArray(ensembleData) ? ensembleData : [];
  if (runs.length === 0) return;

  const spillCentroid = scenario?.spill?.centroid ? toLatLng(scenario.spill.centroid) : [9.582, 75.121];
  const originCentroid = scenario?.drift?.backward?.originCentroid ? toLatLng(scenario.drift.backward.originCentroid) : [9.64, 75.06];

  // 1. Broad Ensemble Origin Uncertainty Envelope
  const ensembleEnvelope = generateUncertaintyEllipse(
    originCentroid[1],
    originCentroid[0],
    7.8, // Major radius km
    5.4, // Minor radius km
    275,
    24
  );
  const ensemblePoly = L.polygon(ensembleEnvelope, {
    color: '#DC2626',
    fillColor: '#EF4444',
    fillOpacity: 0.06,
    weight: 1.2,
    dashArray: '5, 5',
  });
  ensemblePoly.bindTooltip(
    `<div class="font-mono text-[10px] uppercase">
      <span class="font-bold text-[#DC2626] block">ENSEMBLE DISPERSION ENVELOPE (8 PERTURBATIONS)</span>
      <span>Origin Spread: 7.8 km · Model Rank Stability: 52%</span>
    </div>`,
    { sticky: true, className: 'technical-map-tooltip' }
  );
  layerGroup.addLayer(ensemblePoly);

  // 2. Perturbation Member Trajectories and Endpoints
  runs.forEach((run, idx) => {
    const wP = (run.windPerturbation || 0) / 100;
    const cP = (run.currentPerturbation || 0) / 100;
    const isNominal = idx === 0;

    // Shift endpoint based on perturbation
    const timeShift = run.label?.includes('+2h') ? 0.018 : run.label?.includes('-2h') ? -0.018 : 0;
    const offLat = (wP * 0.024) - (cP * 0.018) + timeShift;
    const offLon = (wP * 0.02) + (cP * 0.028) + timeShift;
    const endLat = originCentroid[0] + offLat;
    const endLon = originCentroid[1] + offLon;

    // Realization Trajectory Line
    const runLine = L.polyline([spillCentroid, [endLat, endLon]], {
      color: isNominal ? '#111111' : '#4B5563',
      weight: isNominal ? 2 : 1.2,
      dashArray: isNominal ? null : '3, 4',
      opacity: isNominal ? 0.9 : 0.6,
    });
    layerGroup.addLayer(runLine);

    // Endpoint Marker
    const marker = L.circleMarker([endLat, endLon], {
      radius: isNominal ? 5 : 3.5,
      color: '#FFFFFF',
      fillColor: isNominal ? '#111111' : '#4B5563',
      fillOpacity: 1,
      weight: 1.5,
    });
    marker.bindTooltip(
      `<div class="font-mono text-[9px] uppercase">
        <span class="font-bold block text-[#111111]">${run.label}</span>
        <span>Origin Radius: ${run.originRadiusKm} km · Score: ${run.topCandidateScore}</span>
      </div>`,
      { direction: 'top' }
    );
    layerGroup.addLayer(marker);
  });
}
