"use client";

import React, { useEffect, useRef, useState } from "react";
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
import Point from "ol/geom/Point";
import { Circle, Fill, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import AccidentDetailsPopup from "@/app/components/AccidentDetailsPopup";

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

// Point style for individual accidents
const accidentPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 0, 0, 0.6)" }),
    stroke: new Stroke({ color: "#ff0000", width: 1 }),
  }),
});

// Cluster styles for accident points
function getClusterStyle(feature) {
  const size = feature.get("features").length;
  const radius = Math.min(Math.max(8, Math.sqrt(size) * 3), 20);

  return new Style({
    image: new Circle({
      radius: radius,
      fill: new Fill({
        color: size > 1 ? "rgba(255, 0, 0, 0.7)" : "rgba(255, 0, 0, 0.5)",
      }),
      stroke: new Stroke({
        color: "#fff",
        width: 2,
      }),
    }),
    text:
      size > 1
        ? new Text({
            text: size.toString(),
            fill: new Fill({
              color: "#fff",
            }),
            font: "12px Arial",
          })
        : null,
  });
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

// Add after the existing addRoadInfoInteraction function
function addAccidentInfoInteraction(map, layerId = "pointsLayer") {
  const overlayId = "accident-info-overlay";
  // Remove any existing overlay first
  const existingOverlay = map.getOverlayById(overlayId);
  if (existingOverlay) {
    map.removeOverlay(existingOverlay);
  }

  const tooltipElement =
    document.getElementById("accident-tooltip") ||
    document.createElement("div");
  tooltipElement.id = "accident-tooltip";
  tooltipElement.className = "ol-tooltip hidden";
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
        if (layer && layer.get("layerId") === layerId) {
          // For clusters, get the individual features
          const features = feature.get("features");
          if (features && features.length === 1) {
            // Only show tooltip for individual points, not clusters
            featureFound = features[0];
            return true;
          }
        }
        return false;
      },
      {
        layerFilter: (layer) => layer.get("layerId") === layerId,
      }
    );

    const targetElement = map.getTargetElement();
    targetElement.style.cursor = featureFound ? "pointer" : "";

    if (featureFound) {
      const properties = featureFound.getProperties();

      // Format date and time
      const date = properties.crashdate
        ? new Date(properties.crashdate).toLocaleDateString()
        : "Unknown";
      const time = properties.crashtime
        ? `${properties.crashtime.slice(0, 2)}:${properties.crashtime.slice(2)}`
        : "Unknown";

      tooltipElement.innerHTML = `
        <div>
          <strong>${properties.onroadname || "Unknown Road"}</strong>
          ${
            properties.inroadname
              ? `<div>at ${properties.inroadname}</div>`
              : ""
          }
          <div>Date: ${date}</div>
          <div>Time: ${time}</div>
          <div>Injuries: ${properties.cntofinj || 0}</div>
          <div>Fatalities: ${properties.cntoffatl || 0}</div>
          ${
            properties.weathcond
              ? `<div>Weather: ${properties.weathcond}</div>`
              : ""
          }
          ${
            properties.lightcond
              ? `<div>Lighting: ${properties.lightcond}</div>`
              : ""
          }
          ${
            properties.rdsurfcond
              ? `<div>Road Surface: ${properties.rdsurfcond}</div>`
              : ""
          }
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
export default function RoadLineMap({ onMapReady, viewMode }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const { roadLineSegments, accidents } = useAccidentContext();
  const vectorLayerRef = useRef(null);
  const pointsLayerRef = useRef(null);
  const clusterSourceRef = useRef(null);

  // Add state for selected accident
  const [selectedAccident, setSelectedAccident] = useState(null);

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

      // Create vector layers
      vectorLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 1,
        layerId: "roadLayer",
      });

      // Create points layer with clustering
      const pointsSource = new VectorSource();
      clusterSourceRef.current = new Cluster({
        distance: 40,
        source: pointsSource,
      });

      pointsLayerRef.current = new VectorLayer({
        source: clusterSourceRef.current,
        style: getClusterStyle,
        zIndex: 2,
        layerId: "pointsLayer",
      });

      // Add layers to map
      map.addLayer(vectorLayerRef.current);
      map.addLayer(pointsLayerRef.current);

      // Add hover interaction for road segments only
      addRoadInfoInteraction(map, "roadLayer");

      // Add click handler for accidents
      map.on("click", function (evt) {
        const feature = map.forEachFeatureAtPixel(
          evt.pixel,
          function (feature) {
            return feature;
          },
          {
            layerFilter: function (layer) {
              return layer === pointsLayerRef.current;
            },
            hitTolerance: 10,
          }
        );

        if (feature) {
          const features = feature.get("features");
          if (features && features.length === 1) {
            // Single accident - show details
            const singleFeature = features[0];
            const props = singleFeature.getProperties();
            setSelectedAccident(props.properties);
          } else if (features && features.length > 1) {
            // Cluster - zoom in
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 500,
              maxZoom: 15,
            });
            setSelectedAccident(null);
          }
        } else {
          setSelectedAccident(null);
        }
      });

      if (onMapReady) {
        onMapReady(map);
      }
    }

    // Cleanup
    return () => {
      const roadTooltip = document.getElementById("road-tooltip");
      if (roadTooltip && roadTooltip.parentNode) {
        roadTooltip.parentNode.removeChild(roadTooltip);
      }

      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady]);

  // Update map features based on view mode
  useEffect(() => {
    if (!mapRef.current || !vectorLayerRef.current || !pointsLayerRef.current)
      return;

    // Toggle layer visibility based on view mode
    vectorLayerRef.current.setVisible(viewMode === "hotspots");
    pointsLayerRef.current.setVisible(viewMode === "points");

    // Update appropriate layer based on view mode
    if (viewMode === "hotspots") {
      updateHotspotLayer();
    } else {
      updatePointsLayer();
    }
  }, [viewMode, roadLineSegments, accidents]);

  // Function to update hotspot layer
  const updateHotspotLayer = () => {
    if (!vectorLayerRef.current) return;

    const source = vectorLayerRef.current.getSource();
    source.clear();

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
                  width: 3 + segment.intensity * 6,
                }),
              })
            );
            return feature;
          }
          return null;
        })
        .filter(Boolean);

      source.addFeatures(features);
    }
  };

  // Function to update points layer
  const updatePointsLayer = () => {
    if (!clusterSourceRef.current) return;

    const source = clusterSourceRef.current.getSource();
    source.clear();

    if (accidents && accidents.length > 0) {
      const features = accidents
        .map((accident) => {
          if (accident.longitude && accident.latitude) {
            return new Feature({
              geometry: new Point(
                fromLonLat([
                  parseFloat(accident.longitude),
                  parseFloat(accident.latitude),
                ])
              ),
              properties: accident,
            });
          }
          return null;
        })
        .filter(Boolean);

      source.addFeatures(features);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {selectedAccident && (
        <AccidentDetailsPopup
          accident={selectedAccident}
          onClose={() => setSelectedAccident(null)}
        />
      )}
    </div>
  );
}
