"use client";

import React, { useEffect, useRef } from "react";
import { useAccidentContext } from "@/context/accidentContext";
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
import { defaults as defaultControls } from "ol/control";

// --- Map Constants (from consolidated-playground) ---
const FLORIDA_EXTENT = [-87.8, 24.2, -79.7, 31.2];
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
];
const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 7; // Slightly zoomed out default

// --- Styling Function (from consolidated-playground) ---
function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
}

// --- Tooltip Interaction (from consolidated-playground) ---
function addRoadInfoInteraction(map, layerId = "roadLayer") {
  const overlayId = "road-info-overlay";
  // Remove any existing overlay first
  const existingOverlay = map.getOverlayById(overlayId);
  if (existingOverlay) {
    map.removeOverlay(existingOverlay);
  }
  const tooltipElement =
    document.getElementById("road-tooltip") || document.createElement("div");
  tooltipElement.id = "road-tooltip"; // Ensure it has an ID
  tooltipElement.className = "ol-tooltip hidden"; // Start hidden
  // Apply necessary styles if not done via CSS
  tooltipElement.style.position = "absolute";
  tooltipElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  tooltipElement.style.color = "white";
  tooltipElement.style.padding = "8px";
  tooltipElement.style.borderRadius = "4px";
  tooltipElement.style.pointerEvents = "none";
  tooltipElement.style.zIndex = "1000";
  tooltipElement.style.fontSize = "12px";
  tooltipElement.style.maxWidth = "300px";

  // Append to body if it's not already there
  if (!document.getElementById(tooltipElement.id)) {
    document.body.appendChild(tooltipElement);
  }

  const tooltip = new Overlay({
    element: tooltipElement,
    id: overlayId,
    offset: [0, -15],
    positioning: "bottom-center",
  });
  map.addOverlay(tooltip);

  map.on("pointermove", function (evt) {
    if (evt.dragging) {
      tooltipElement.classList.add("hidden");
      return;
    }
    const pixel = map.getEventPixel(evt.originalEvent);
    let featureFound = null;
    map.forEachFeatureAtPixel(
      pixel,
      function (feature, layer) {
        // Check if the feature is on the target layer
        if (layer && layer.get("layerId") === layerId) {
          featureFound = feature;
          return true; // Stop iteration
        }
        return false;
      },
      {
        layerFilter: (layer) => layer.get("layerId") === layerId, // Filter layers checked
      }
    );

    const targetElement = map.getTargetElement();
    targetElement.style.cursor = featureFound ? "pointer" : "";

    if (featureFound) {
      const properties = {
        name: featureFound.get("name") || "Unknown Road",
        count: featureFound.get("count") || 0,
        intensity: featureFound.get("intensity") || 0,
        length: featureFound.get("length") || 0,
        accidentsPerKm: featureFound.get("accidentsPerKm") || 0,
        roadType: featureFound.get("roadType") || "",
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
      tooltip.setPosition(evt.coordinate);
      tooltipElement.classList.remove("hidden");
    } else {
      tooltipElement.classList.add("hidden");
    }
  });

  // Hide tooltip on map move start
  map.on("movestart", () => {
    tooltipElement.classList.add("hidden");
  });
}

// --- The Map Component ---
export default function RoadLineMap({ onMapReady }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const { roadLineSegments } = useAccidentContext(); // Get data from context
  const vectorLayerRef = useRef(null); // Ref to hold the vector layer

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
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

      // Create the vector layer initially (empty)
      vectorLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 1,
        layerId: "roadLayer", // Add an identifier for the hover interaction
      });
      map.addLayer(vectorLayerRef.current);

      // Add hover interaction
      addRoadInfoInteraction(map, "roadLayer");

      if (onMapReady) {
        onMapReady(map); // Pass map instance to parent if needed
      }
    }

    // Cleanup
    return () => {
      // Clean up tooltip element if it exists
      const tooltipElement = document.getElementById("road-tooltip");
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
      }
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady]); // Dependency array includes onMapReady

  // Update map features when roadLineSegments data changes
  useEffect(() => {
    if (!mapRef.current || !vectorLayerRef.current) return;

    console.log(
      `RoadLineMap: Updating features with ${
        roadLineSegments?.length || 0
      } segments.`
    );

    const source = vectorLayerRef.current.getSource();
    source.clear(); // Clear existing features

    if (roadLineSegments && roadLineSegments.length > 0) {
      const features = roadLineSegments
        .map((segment) => {
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

            feature.setStyle(
              new Style({
                stroke: new Stroke({
                  color: getHeatColor(segment.intensity),
                  width: 3 + segment.intensity * 6, // Adjust width based on intensity
                }),
              })
            );
            return feature;
          }
          return null;
        })
        .filter(Boolean);

      source.addFeatures(features);
    } else {
      console.log("RoadLineMap: No road segments to display.");
    }
  }, [roadLineSegments]); // Re-run when road segments data changes

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
