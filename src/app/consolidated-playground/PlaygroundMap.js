"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { Style, Stroke } from "ol/style";
import Overlay from "ol/Overlay";
import wellknown from "wellknown";

// --- Map Constants and Helpers ---
const FLORIDA_EXTENT = [
  -87.8, // Western boundary (slightly west of Pensacola)
  24.2, // Southern boundary (includes the Keys)
  -79.7, // Eastern boundary (past Jacksonville)
  31.2, // Northern boundary (slightly north of the Florida/Georgia border)
];

const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
];

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 9;

function getHeatColor(intensity) {
  // Green-Yellow-Red gradient (adjusted thresholds)
  if (intensity < 0.7) {
    return `rgba(0, 220, 0, 0.8)`; // Green
  } else if (intensity < 0.9) {
    return `rgba(255, 220, 0, 0.8)`; // Yellow
  } else {
    return `rgba(220, 0, 0, 0.8)`; // Red
  }
}

function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function calculateLineLength(coordinates) {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    totalDistance += calculateGeoDistance(lat1, lon1, lat2, lon2);
  }
  return totalDistance * 1000;
}

function calculateBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 };
  }
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  coordinates.forEach((coord) => {
    const [lon, lat] = coord;
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });
  return { minLon, minLat, maxLon, maxLat };
}
// --- End Map Constants and Helpers ---

// --- Data Fetching and Processing ---
async function getMajorRoadSegments(
  supabase,
  startDate,
  endDate,
  startTime,
  endTime,
  progressCallback = null
) {
  if (!supabase) {
    console.error("Supabase client not available in getMajorRoadSegments");
    return [];
  }
  console.log("Fetching major road segments...");
  try {
    const { data: roadData, error: roadError } = await supabase
      .from("major-roads")
      .select("WKT, LINEARID, FULLNAME, RTTYP, MTFCC")
      .limit(1000);

    if (roadError) {
      console.error("Error fetching major roads:", roadError);
      throw roadError;
    }
    console.log(`Fetched ${roadData?.length || 0} major road segments`);
    if (!roadData || roadData.length === 0) return [];

    let query = supabase.from("ultimate-table").select("*");
    if (startDate && endDate) {
      query = query.gte("crashdate", startDate).lte("crashdate", endDate);
    }
    if (startTime && endTime) {
      query = query.gte("crashtime", startTime).lte("crashtime", endTime);
    }
    query = query.limit(10000);
    const { data: accidentData, error: accidentError } = await query;

    if (accidentError) {
      console.error("Error fetching accident data:", accidentError);
      throw accidentError;
    }
    console.log(`Fetched ${accidentData?.length || 0} accidents`);

    const processedSegments = await mapAccidentsToRoadSegments(
      roadData,
      accidentData,
      progressCallback
    );
    return processedSegments;
  } catch (error) {
    console.error("Error in getMajorRoadSegments:", error);
    return [];
  }
}

async function mapAccidentsToRoadSegments(
  roadData,
  accidentData,
  progressCallback
) {
  try {
    const parsedRoadSegments = roadData
      .map((road) => {
        try {
          const geometry = wellknown.parse(road.WKT);
          return {
            id: road.LINEARID,
            name: road.FULLNAME,
            roadType: road.RTTYP,
            mtfcc: road.MTFCC,
            geometry: geometry,
            accidents: [],
            bbox: calculateBoundingBox(geometry.coordinates),
          };
        } catch (e) {
          console.error(`Error parsing WKT for road ${road.LINEARID}:`, e);
          return null;
        }
      })
      .filter(Boolean);

    const batchSize = 100;
    let processedCount = 0;
    const totalRoads = parsedRoadSegments.length;
    if (progressCallback) {
      progressCallback({
        processed: processedCount,
        total: totalRoads,
        message: `Parsed ${totalRoads} road geometries...`,
      });
    }

    for (let i = 0; i < parsedRoadSegments.length; i += batchSize) {
      const batch = parsedRoadSegments.slice(
        i,
        Math.min(i + batchSize, totalRoads)
      );
      batch.forEach((segment) => {
        const matchingAccidents = accidentData.filter((accident) => {
          if (!accident.latitude || !accident.longitude) return false;
          const isOnSameRoad =
            segment.name &&
            accident.onroadname &&
            accident.onroadname
              .toLowerCase()
              .includes(segment.name.toLowerCase());
          if (!isOnSameRoad) {
            const lat = parseFloat(accident.latitude);
            const lon = parseFloat(accident.longitude);
            const padding = 0.001;
            if (
              lon >= segment.bbox.minLon - padding &&
              lon <= segment.bbox.maxLon + padding &&
              lat >= segment.bbox.minLat - padding &&
              lat <= segment.bbox.maxLat + padding
            ) {
              return true;
            }
            return false;
          }
          return isOnSameRoad;
        });
        segment.accidents = matchingAccidents;
      });
      processedCount += batch.length;
      if (progressCallback) {
        progressCallback({
          processed: processedCount,
          total: totalRoads,
          message: `Mapping accidents (${processedCount}/${totalRoads})...`,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const processedRoadSegments = parsedRoadSegments
      .map((segment) => {
        if (segment.accidents.length === 0) return null;
        const segmentLength = calculateLineLength(segment.geometry.coordinates);
        const accidentsPerKm =
          segmentLength > 0
            ? Math.min(segment.accidents.length / (segmentLength / 1000), 20)
            : segment.accidents.length;
        const intensity = Math.min(accidentsPerKm / 20, 1);
        return {
          id: segment.id,
          name: segment.name,
          roadType: segment.roadType,
          count: segment.accidents.length,
          length: segmentLength,
          intensity,
          accidentsPerKm: accidentsPerKm, // Keep this for tooltip
          geometry: {
            type: "LineString",
            coordinates: segment.geometry.coordinates,
          },
        };
      })
      .filter(Boolean);

    return processedRoadSegments.sort((a, b) => b.intensity - a.intensity);
  } catch (error) {
    console.error("Error mapping accidents to road segments:", error);
    return [];
  }
}
// --- End Data Fetching and Processing ---

// --- Map Component ---
export default function PlaygroundMap({
  supabase,
  dateRange,
  onLoadingChange,
  onErrorChange,
  onProgressChange,
}) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const roadLayerRef = useRef(null); // Ref to store the road layer
  const tooltipOverlayRef = useRef(null); // Ref for tooltip overlay
  const tooltipElementRef = useRef(null); // Ref for tooltip DOM element

  // Function to add hover interaction
  const addRoadInfoInteraction = useCallback((map, source) => {
    // Remove existing overlay if it exists
    if (tooltipOverlayRef.current) {
      map.removeOverlay(tooltipOverlayRef.current);
      tooltipOverlayRef.current = null;
    }
    if (tooltipElementRef.current && tooltipElementRef.current.parentNode) {
      tooltipElementRef.current.parentNode.removeChild(
        tooltipElementRef.current
      );
      tooltipElementRef.current = null;
    }

    // Create tooltip element (only once or if removed)
    if (!tooltipElementRef.current) {
      tooltipElementRef.current = document.createElement("div");
      tooltipElementRef.current.className = "ol-tooltip hidden"; // Start hidden
      tooltipElementRef.current.style.position = "absolute";
      tooltipElementRef.current.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      tooltipElementRef.current.style.color = "white";
      tooltipElementRef.current.style.padding = "8px";
      tooltipElementRef.current.style.borderRadius = "4px";
      tooltipElementRef.current.style.pointerEvents = "none";
      tooltipElementRef.current.style.zIndex = "1000";
      tooltipElementRef.current.style.fontSize = "12px";
      tooltipElementRef.current.style.maxWidth = "300px";
      document.body.appendChild(tooltipElementRef.current); // Append to body
    }

    const tooltipElement = tooltipElementRef.current;

    // Create and add overlay
    tooltipOverlayRef.current = new Overlay({
      element: tooltipElement,
      offset: [0, -15],
      positioning: "bottom-center",
    });
    map.addOverlay(tooltipOverlayRef.current);
    const tooltip = tooltipOverlayRef.current;

    // Add pointer move listener
    map.on("pointermove", function (evt) {
      if (evt.dragging) {
        tooltipElement.classList.add("hidden");
        return;
      }
      const pixel = map.getEventPixel(evt.originalEvent);
      const feature = map.forEachFeatureAtPixel(
        pixel,
        function (feature, layer) {
          return layer === roadLayerRef.current ? feature : undefined;
        }
      );

      const targetElement = map.getTargetElement();
      if (targetElement) {
        targetElement.style.cursor = feature ? "pointer" : "";
      }

      if (feature) {
        const properties = {
          name: feature.get("name") || "Unknown Road",
          count: feature.get("count") || 0,
          intensity: feature.get("intensity") || 0,
          length: feature.get("length") || 0,
          accidentsPerKm: feature.get("accidentsPerKm") || 0,
          roadType: feature.get("roadType") || "",
        };

        tooltipElement.innerHTML = `
          <div>
            <strong>${properties.name}</strong>
            ${
              properties.roadType
                ? `<div>Type: ${properties.roadType}</div>`
                : ""
            }
            <div>Accidents: ${properties.count}</div>
            <div>Length: ${(properties.length / 1000).toFixed(2)} km</div>
            <div>Accidents/km: ${properties.accidentsPerKm.toFixed(2)}</div>
            <div>Relative danger: ${Math.round(
              properties.intensity * 100
            )}%</div>
          </div>
        `;
        tooltipElement.classList.remove("hidden");
        tooltip.setPosition(evt.coordinate);
      } else {
        tooltipElement.classList.add("hidden");
      }
    });
  }, []); // Empty dependency array means this runs once

  // Function to load road data and update map
  const loadRoadData = useCallback(async () => {
    if (!supabase || !mapRef.current) {
      console.log("Supabase client or map not ready for loading data.");
      return;
    }

    onErrorChange(null);
    onLoadingChange(true);
    onProgressChange({
      processed: 0,
      total: 0,
      message: "Fetching road data...",
    });

    try {
      const roadSegments = await getMajorRoadSegments(
        supabase,
        dateRange.start || null,
        dateRange.end || null,
        null, // startTime - not used currently
        null, // endTime - not used currently
        (progress) => onProgressChange(progress)
      );

      if (!roadSegments || roadSegments.length === 0) {
        onErrorChange("No road data found for the selected period.");
        // Clear existing road layer if no data found
        if (roadLayerRef.current && mapRef.current) {
          mapRef.current.removeLayer(roadLayerRef.current);
          roadLayerRef.current = null;
        }
        onLoadingChange(false);
        return;
      }

      console.log(
        `Loaded ${roadSegments.length} road segments with accident data`
      );
      onProgressChange({
        message: `Rendering ${roadSegments.length} segments...`,
      });

      const source = new VectorSource();
      roadSegments.forEach((segment) => {
        if (
          segment.geometry &&
          segment.geometry.coordinates &&
          segment.geometry.coordinates.length >= 2
        ) {
          const feature = new Feature({
            geometry: new LineString(
              segment.geometry.coordinates.map((coord) => fromLonLat(coord))
            ),
            intensity: segment.intensity,
            count: segment.count,
            name: segment.name,
            roadType: segment.roadType,
            length: segment.length,
            accidentsPerKm: segment.accidentsPerKm,
          });

          const intensity = segment.intensity;
          const color = getHeatColor(intensity);
          const width = 1.5 + intensity * 3;
          const outlineWidth = width + 2;

          const outlineStyle = new Style({
            stroke: new Stroke({
              color: "rgba(0, 0, 0, 0.7)",
              width: outlineWidth,
            }),
            zIndex: 0.9,
          });

          const lineStyle = new Style({
            stroke: new Stroke({
              color: color,
              width: width,
            }),
            zIndex: 1,
          });

          feature.setStyle([outlineStyle, lineStyle]);
          source.addFeature(feature);
        }
      });

      // Remove old layer if it exists
      if (roadLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(roadLayerRef.current);
      }

      // Create and add the new layer
      roadLayerRef.current = new VectorLayer({
        source: source,
        zIndex: 1,
      });
      mapRef.current.addLayer(roadLayerRef.current);

      // Re-attach hover interaction to the new source/layer
      addRoadInfoInteraction(mapRef.current, source);
    } catch (error) {
      console.error("Error loading road data:", error);
      onErrorChange(
        `Error loading road data: ${error.message || "Please try again."}`
      );
    } finally {
      onLoadingChange(false);
    }
  }, [
    supabase,
    dateRange,
    onErrorChange,
    onLoadingChange,
    onProgressChange,
    addRoadInfoInteraction,
  ]);

  // Initialize map on component mount
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = new Map({
        target: mapContainerRef.current,
        layers: [new TileLayer({ source: new OSM(), zIndex: 0 })],
        view: new View({
          center: fromLonLat([-82.5, 28.1]),
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true,
        }),
      });
      mapRef.current = map;

      // Initial data load
      loadRoadData();
    }

    // Cleanup on unmount
    return () => {
      // Clean up tooltip DOM element
      if (tooltipElementRef.current && tooltipElementRef.current.parentNode) {
        tooltipElementRef.current.parentNode.removeChild(
          tooltipElementRef.current
        );
        tooltipElementRef.current = null;
      }
      // Dispose map
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current.dispose(); // Use dispose for full cleanup
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Reload data when dateRange changes
  useEffect(() => {
    // Only reload if the map is already initialized
    if (mapRef.current) {
      loadRoadData();
    }
  }, [dateRange, loadRoadData]);

  // NOTE: zoomTo function is removed as controls are currently in the parent.
  // If needed, implement using forwardRef or state lifting.

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
// --- End Map Component ---
