"use client";

import React, { useEffect, useRef } from "react";
import "ol/ol.css";
import { Map, View, Overlay } from "ol";
import { defaults as defaultControls } from "ol/control";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Circle, Style, Fill, Stroke, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import { useAccidentContext } from "@/context/accidentContext";
import "../styles/map.css";

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = MIN_ZOOM;

// Florida bounding box coordinates (with small margin)
const FLORIDA_EXTENT = [
  -87.8, // Western boundary (slightly west of Pensacola)
  24.2, // Southern boundary (includes the Keys)
  -79.7, // Eastern boundary (past Jacksonville)
  31.2, // Northern boundary (slightly north of the Florida/Georgia border)
];

// Convert the geographic coordinates to the projection used by OpenLayers
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
];

// Crash point style
const crashPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 0, 0, 0.6)" }),
    stroke: new Stroke({ color: "#ff0000", width: 1 }),
  }),
});

// Cluster style function
function getClusterStyle(feature) {
  const size = feature.get("features").length;
  if (size === 1) return crashPointStyle;

  return new Style({
    image: new Circle({
      radius: Math.min(size * 3, 30),
      fill: new Fill({ color: "rgba(255, 0, 0, 0.6)" }),
      stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
    text: new Text({
      text: size.toString(),
      fill: new Fill({ color: "#fff" }),
      font: "bold 12px Arial",
    }),
  });
}

// Function to generate a color based on intensity (0-1)
function getHeatColor(intensity) {
  // Google Maps style traffic colors (Green to Yellow to Red)
  if (intensity < 0.33) {
    // Green (low intensity)
    return `rgba(0, 220, 0, 0.8)`;
  } else if (intensity < 0.66) {
    // Yellow (medium intensity)
    return `rgba(255, 220, 0, 0.8)`;
  } else {
    // Red (high intensity)
    return `rgba(220, 0, 0, 0.8)`;
  }
}

// Road segment style function based on intensity
function getRoadSegmentStyle(feature) {
  const intensity = feature.get("intensity") || 0;
  const color = getHeatColor(intensity);
  const width = Math.max(3, 3 + intensity * 6); // Width increases with intensity, minimum 3px
  const isRealRoad = feature.get("isRealRoad") || false;

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
      // Use a smoother line style for real road geometries
      lineCap: isRealRoad ? "round" : "square",
      lineJoin: isRealRoad ? "round" : "miter",
    }),
  });
}

export default function HotspotMap({ onMapReady }) {
  const { accidents, hotspots, roadSegments, showPoints, loading } =
    useAccidentContext();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipOverlayRef = useRef(null);

  // Create sources for different layers
  const pointsSource = useRef(new VectorSource());
  const clusterSource = useRef(
    new Cluster({
      distance: 40,
      source: pointsSource.current,
    })
  );
  const roadSegmentsSource = useRef(new VectorSource());

  // Create layers
  const crashesLayer = useRef(
    new VectorLayer({
      source: clusterSource.current,
      style: getClusterStyle,
      zIndex: 2,
      visible: showPoints,
    })
  );

  const roadSegmentsLayer = useRef(
    new VectorLayer({
      source: roadSegmentsSource.current,
      style: getRoadSegmentStyle,
      zIndex: 1,
    })
  );

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]), // Center of Florida
    zoom: DEFAULT_ZOOM,
  });

  // Update map layers with accident data from context
  useEffect(() => {
    // Only update if the map is initialized
    if (!mapRef.current) return;

    // Clear existing features
    roadSegmentsSource.current.clear();

    // Filter segments to only include those with real geometry
    const realRoadSegments = roadSegments.filter(
      (segment) => segment.isRealRoad
    );

    // Add road segments as features
    if (realRoadSegments && realRoadSegments.length > 0) {
      console.log(
        `Adding ${realRoadSegments.length} real road segments to map (out of ${roadSegments.length} total)`
      );

      // Count real roads vs simple lines for logging (should only be real now)
      let realRoadCount = 0;
      let simpleLineCount = 0; // This should remain 0

      // Process in batches to improve performance
      const batchSize = 20;
      const processBatch = (startIndex) => {
        const endIndex = Math.min(
          startIndex + batchSize,
          realRoadSegments.length
        );

        for (let i = startIndex; i < endIndex; i++) {
          const segment = realRoadSegments[i];

          // Skip segments with less than 2 points (shouldn't happen for real roads, but safety check)
          if (!segment.coordinates || segment.coordinates.length < 2) {
            console.warn(
              `Skipping segment with invalid coordinates:`,
              segment.name
            );
            continue;
          }

          try {
            const coordinates = segment.coordinates.map((coord) =>
              fromLonLat([coord[0], coord[1]])
            );

            const feature = new Feature({
              geometry: new LineString(coordinates),
              intensity: segment.intensity,
              name: segment.name,
              count: segment.count,
              isRealRoad: segment.isRealRoad || false,
              county: segment.county,
              city: segment.city,
            });

            roadSegmentsSource.current.addFeature(feature);

            // Count for logging
            if (segment.isRealRoad) {
              realRoadCount++;
            } else {
              simpleLineCount++;
            }
          } catch (err) {
            console.error(
              `Error creating feature for road segment ${segment.name}:`,
              err
            );
          }
        }

        // Process next batch if there are more segments
        if (endIndex < realRoadSegments.length) {
          setTimeout(() => processBatch(endIndex), 0);
        } else {
          console.log(
            `Added road segments to map: ${realRoadCount} real roads, ${simpleLineCount} simple lines`
          );

          // Force map refresh after all batches are processed
          if (mapRef.current) {
            mapRef.current.render();
          }
        }
      };

      // Start processing batches
      processBatch(0);
    }
  }, [roadSegments]);

  // Update point features when accidents change
  useEffect(() => {
    // Only update if showing points and the map is initialized
    if (!showPoints || !mapRef.current) return;

    // Clear existing points
    pointsSource.current.clear();

    // Add individual accident points
    if (accidents && accidents.length > 0) {
      console.log(
        `Adding ${accidents.length} individual accident points to map`
      );

      const features = accidents
        .map((accident) => {
          if (accident.latitude && accident.longitude) {
            return new Feature({
              geometry: new Point(
                fromLonLat([accident.longitude, accident.latitude])
              ),
              properties: accident,
            });
          }
          return null;
        })
        .filter(Boolean);

      pointsSource.current.addFeatures(features);
    }

    // Force map refresh
    mapRef.current.render();
  }, [accidents, showPoints]);

  // Update crashes layer visibility when showPoints changes
  useEffect(() => {
    if (crashesLayer.current) {
      crashesLayer.current.setVisible(showPoints);

      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
      }
    }
  }, [showPoints]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Create tooltip element if it doesn't exist yet
      if (!tooltipRef.current) {
        const tooltipElement = document.createElement("div");
        tooltipElement.className = "tooltip-overlay hidden";
        tooltipElement.style.position = "absolute";
        tooltipElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
        tooltipElement.style.color = "white";
        tooltipElement.style.padding = "8px";
        tooltipElement.style.borderRadius = "4px";
        tooltipElement.style.pointerEvents = "none";
        tooltipElement.style.zIndex = "1000";
        tooltipElement.style.fontSize = "12px";
        tooltipElement.style.maxWidth = "300px";
        document.body.appendChild(tooltipElement);
        tooltipRef.current = tooltipElement;
      }

      const mapInstance = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [
          new TileLayer({ source: new OSM(), zIndex: 0 }),
          roadSegmentsLayer.current,
          crashesLayer.current,
        ],
        view: new View({
          center: viewStateRef.current.center,
          zoom: viewStateRef.current.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true,
        }),
      });

      // Add tooltip overlay
      tooltipOverlayRef.current = new Overlay({
        element: tooltipRef.current,
        offset: [0, -10],
        positioning: "bottom-center",
      });
      mapInstance.addOverlay(tooltipOverlayRef.current);

      // Add pointer move interaction to show tooltip on hover
      mapInstance.on("pointermove", (evt) => {
        const pixel = mapInstance.getEventPixel(evt.originalEvent);
        const hit = mapInstance.hasFeatureAtPixel(pixel);
        mapInstance.getTargetElement().style.cursor = hit ? "pointer" : "";

        const tooltipElement = tooltipRef.current;

        if (hit && tooltipElement) {
          const feature = mapInstance.forEachFeatureAtPixel(
            pixel,
            (feature) => feature
          );

          if (feature && feature.getGeometry().getType() === "LineString") {
            // It's a road segment
            const name = feature.get("name") || "Unknown Road";
            const intensity = feature.get("intensity") || 0;
            const count = feature.get("count") || 0;
            const county = feature.get("county") || "Unknown";
            const city = feature.get("city") || "Unknown";
            const isRealRoad = feature.get("isRealRoad");

            tooltipElement.innerHTML = `
              <div>
                <strong>${name}</strong>
                <div>County: ${county}, City: ${city}</div>
                <div>Accidents: ${count}</div>
                <div>Danger level: ${Math.round(intensity * 100)}%</div>
                ${
                  isRealRoad
                    ? "<div><small>Using precise road geometry</small></div>"
                    : ""
                }
              </div>
            `;

            tooltipElement.classList.remove("hidden");
            tooltipOverlayRef.current.setPosition(evt.coordinate);
          } else if (feature && feature.get("features")) {
            // It's a cluster
            const size = feature.get("features").length;

            tooltipElement.innerHTML = `
              <div>
                <strong>${size} accident${size > 1 ? "s" : ""}</strong>
                <div>Click to zoom to this area</div>
              </div>
            `;

            tooltipElement.classList.remove("hidden");
            tooltipOverlayRef.current.setPosition(evt.coordinate);
          } else {
            tooltipElement.classList.add("hidden");
          }
        } else if (tooltipElement) {
          tooltipElement.classList.add("hidden");
        }
      });

      mapRef.current = mapInstance;

      if (onMapReady) {
        onMapReady({
          getView: () => mapInstance.getView(),
          getZoom: () => mapInstance.getView().getZoom(),
          zoomTo: (zoom) => {
            mapInstance.getView().animate({ zoom, duration: 250 });
          },
          zoomBy: (delta) => {
            const view = mapInstance.getView();
            view.animate({ zoom: view.getZoom() + delta, duration: 250 });
          },
          getVectorSource: () => pointsSource.current,
        });
      }
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }

      // Remove tooltip element when component unmounts
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [onMapReady]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute top-0 left-0"
      />
      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full z-10">
          Loading data...
        </div>
      )}
    </div>
  );
}
