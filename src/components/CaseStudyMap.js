"use client";

import React, { useEffect, useRef } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { OSM, Vector as VectorSource } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Circle, Style, Fill, Stroke } from "ol/style";
import { defaults as defaultControls } from "ol/control";
import "@/app/styles/map.css"; // Reuse existing map styles if needed

// Simple style for accident points
const accidentPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 0, 0, 0.7)" }), // Red, slightly transparent
    stroke: new Stroke({ color: "#b30000", width: 1 }), // Darker red border
  }),
});

// --- Road Segment Styling (Adapted from HotspotMap.js) ---
// Function to generate a color based on intensity (0-1)
function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(255, 255, 0, 0.7)`; // Yellow
  if (intensity < 0.66) return `rgba(255, 165, 0, 0.7)`; // Orange
  return `rgba(255, 0, 0, 0.7)`; // Red
}

// Road segment style function based on intensity
function getRoadSegmentStyle(feature) {
  const intensity = feature.get("intensity") || 0;
  const color = getHeatColor(intensity);
  const width = 3 + intensity * 7; // Width increases with intensity (max 10)

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
    }),
  });
}
// --- End of Road Segment Styling ---

// Expects props: center (array [lon, lat]), zoom (number), accidents (array), roadSegments (array), showRoadLines (boolean)
export default function CaseStudyMap({
  center,
  zoom,
  accidents,
  roadSegments,
  showRoadLines,
}) {
  const mapContainerRef = useRef(null); // Use useRef without type hint
  const mapRef = useRef(null); // Use useRef without type hint
  const accidentsSource = useRef(new VectorSource()); // Source for accident points
  const roadSegmentsSource = useRef(new VectorSource()); // Source for road segments
  const roadSegmentsLayerRef = useRef(null); // Ref to access the road layer

  // Update accident features when 'accidents' prop changes
  useEffect(() => {
    if (!accidentsSource.current) return; // Don't run if source doesn't exist

    console.log(
      "Updating accidents on case study map:",
      accidents?.length || 0
    );
    accidentsSource.current.clear(); // Clear previous points

    if (accidents && accidents.length > 0) {
      const features = accidents
        .filter((acc) => acc.longitude && acc.latitude)
        .map((acc) => {
          return new Feature({
            geometry: new Point(fromLonLat([acc.longitude, acc.latitude])),
            // Add data for potential popups
            crashnum: acc.crashnum,
            crashdate: acc.crashdate,
            onroadname: acc.onroadname,
          });
        });

      if (features.length > 0) {
        accidentsSource.current.addFeatures(features);
      }
      console.log(`Added ${features.length} accident features to the map.`);
    }

    // Trigger a re-render of the map if it exists
    if (mapRef.current) {
      mapRef.current.render();
    }
  }, [accidents]); // Dependency on the accidents prop

  // Update road segment features
  useEffect(() => {
    if (!roadSegmentsSource.current) return;
    console.log(
      "Updating road segments on case study map:",
      roadSegments?.length || 0
    );
    roadSegmentsSource.current.clear();

    if (
      roadSegments &&
      Array.isArray(roadSegments) &&
      roadSegments.length > 0
    ) {
      const features = roadSegments
        .map((segment) => {
          // **Corrected validation to check segment.geometry.coordinates**
          if (
            !segment ||
            !segment.geometry || // Check if geometry exists
            !segment.geometry.coordinates || // Check if coordinates exist within geometry
            !Array.isArray(segment.geometry.coordinates) ||
            segment.geometry.coordinates.length < 2
          ) {
            console.warn("Skipping invalid road segment structure:", segment);
            return null; // Skip this invalid segment
          }
          try {
            // **Corrected mapping to use segment.geometry.coordinates**
            const coordinates = segment.geometry.coordinates.map((coord) => {
              if (
                !Array.isArray(coord) ||
                coord.length < 2 ||
                typeof coord[0] !== "number" ||
                typeof coord[1] !== "number"
              ) {
                throw new Error(
                  `Invalid coordinate pair: ${JSON.stringify(coord)}`
                );
              }
              return fromLonLat([coord[0], coord[1]]);
            });

            return new Feature({
              geometry: new LineString(coordinates),
              intensity: segment.intensity,
              name: segment.name,
              count: segment.count,
              // Add other properties from the segment if needed for tooltips later
              roadType: segment.roadType,
              length: segment.length,
              accidentsPerKm: segment.accidentsPerKm,
            });
          } catch (error) {
            console.error(
              "Error processing coordinates for segment:",
              segment,
              error
            );
            return null; // Skip segment if coordinate processing fails
          }
        })
        .filter(Boolean); // Filter out any nulls from skipped segments

      if (features.length > 0) {
        roadSegmentsSource.current.addFeatures(features);
      }
      console.log(`Added ${features.length} valid road segment features.`);
    } else {
      console.log(
        "No valid road segments received or segments array is empty."
      );
    }
    mapRef.current?.render();
  }, [roadSegments]);

  // Update road segment layer visibility
  useEffect(() => {
    if (roadSegmentsLayerRef.current) {
      console.log("Setting road segment visibility to:", showRoadLines);
      roadSegmentsLayerRef.current.setVisible(showRoadLines);
    }
  }, [showRoadLines]);

  // Initialize map
  useEffect(() => {
    // Initialize map only if the container exists and map isn't already initialized
    if (mapContainerRef.current && !mapRef.current) {
      // Create the layer for accident points
      const accidentLayer = new VectorLayer({
        source: accidentsSource.current,
        style: accidentPointStyle,
        zIndex: 2, // Points slightly above road lines
      });

      // Create the road segments layer but control visibility via state
      roadSegmentsLayerRef.current = new VectorLayer({
        source: roadSegmentsSource.current,
        style: getRoadSegmentStyle, // Use the adapted style function
        zIndex: 1,
        visible: showRoadLines, // Initial visibility based on prop
      });

      const mapInstance = new Map({
        target: mapContainerRef.current,
        // Disable default zoom controls for a static view, can be enabled if needed
        controls: defaultControls({ zoom: false, rotate: false }),
        layers: [
          new TileLayer({
            source: new OSM(), // Base map layer
            zIndex: 0,
          }),
          roadSegmentsLayerRef.current, // Add road segments layer
          accidentLayer, // Add the accident layer
        ],
        view: new View({
          center: fromLonLat(center), // Use center prop
          zoom: zoom, // Use zoom prop
          // Optional: Set min/max zoom if needed for this specific view
          // minZoom: 13,
          // maxZoom: 18,
        }),
      });

      mapRef.current = mapInstance;
    }

    // Cleanup function to dispose of the map instance when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [center, zoom, showRoadLines]); // Re-run effect if center or zoom props change, and add showRoadLines dependency here too for initial state setting

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full map-container" // Ensure this matches your CSS for height/width
    />
  );
}
