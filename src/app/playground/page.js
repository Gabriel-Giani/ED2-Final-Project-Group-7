"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
import { getTrafficStyleRoadSegments } from "@/utils/db/road-segments";

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

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 9; // Increased default zoom

// Function to generate a color based on intensity (0-1)
function getHeatColor(intensity) {
  // Green to yellow to red gradient for traffic visualization
  if (intensity < 0.33) {
    // Green (low intensity)
    return `rgba(0, 255, 0, 0.8)`;
  } else if (intensity < 0.66) {
    // Yellow (medium intensity)
    return `rgba(255, 255, 0, 0.8)`;
  } else {
    // Red (high intensity)
    return `rgba(255, 0, 0, 0.8)`;
  }
}

export default function PlaygroundPage() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [loadedSegments, setLoadedSegments] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  // Zoom to specific location
  const zoomTo = (location) => {
    if (!mapRef.current) return;

    let center, zoom;

    switch (location) {
      case "miami":
        center = fromLonLat([-80.1918, 25.7617]);
        zoom = 12;
        break;
      case "orlando":
        center = fromLonLat([-81.3792, 28.5383]);
        zoom = 12;
        break;
      case "tampa":
        center = fromLonLat([-82.4572, 27.9506]);
        zoom = 12;
        break;
      case "jacksonville":
        center = fromLonLat([-81.6557, 30.3322]);
        zoom = 12;
        break;
      default:
        // Default to full Florida view
        center = fromLonLat([-82.5, 28.1]);
        zoom = DEFAULT_ZOOM;
    }

    mapRef.current.getView().animate({
      center: center,
      zoom: zoom,
      duration: 1000,
    });
  };

  // Load road segments with accident data
  async function loadRoadAccidents() {
    setError(null);
    setLoading(true);
    setLoadingMessage("Fetching accident data...");
    setLoadedSegments(0);
    setTotalSegments(0);

    try {
      // Get road segments with accident data using our new function
      const roadSegments = await getTrafficStyleRoadSegments(
        dateRange.start || null,
        dateRange.end || null,
        null,
        null,
        (progress) => {
          // Update progress
          setLoadingMessage(
            `Processing road segments (${progress.processed}/${progress.total})...`
          );
          setLoadedSegments(progress.processed);
          setTotalSegments(progress.total);
        }
      );

      if (!roadSegments || roadSegments.length === 0) {
        setError("No accident data found for the selected period.");
        setLoading(false);
        return;
      }

      console.log(
        `Loaded ${roadSegments.length} road segments with accident data`
      );
      setLoadingMessage("Rendering map...");

      // Create a vector source for road segments
      const source = new VectorSource();

      // Convert road segments to OpenLayers features
      roadSegments.forEach((segment) => {
        if (
          segment.geometry &&
          segment.geometry.coordinates &&
          segment.geometry.coordinates.length >= 2
        ) {
          // Create a line feature for the road segment
          const feature = new Feature({
            geometry: new LineString(
              segment.geometry.coordinates.map((coord) => fromLonLat(coord))
            ),
            // Store properties for styling and popups
            intensity: segment.intensity,
            count: segment.count,
            name: segment.name,
            county: segment.county,
            city: segment.city,
            length: segment.length,
            accidentsPerKm: segment.count / (segment.length / 1000),
            isRealRoad: segment.isRealRoad,
          });

          // Set style based on accident intensity
          feature.setStyle(
            new Style({
              stroke: new Stroke({
                color: getHeatColor(segment.intensity),
                width: 3 + segment.intensity * 6, // Width increases with intensity
              }),
            })
          );

          source.addFeature(feature);
        }
      });

      // Create a vector layer for the road segments
      const roadLayer = new VectorLayer({
        source: source,
        zIndex: 1,
      });

      // Add the layer to the map
      if (mapRef.current) {
        // Remove any existing road layers
        mapRef.current.getLayers().forEach((layer) => {
          if (layer.get("name") === "roadLayer") {
            mapRef.current.removeLayer(layer);
          }
        });

        roadLayer.set("name", "roadLayer");
        mapRef.current.addLayer(roadLayer);

        // Add a hover interaction for showing road segment info
        addRoadInfoInteraction(mapRef.current, source);
      }
    } catch (error) {
      console.error("Error loading road accidents:", error);
      setError("Error loading accident data. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  // Add hover interaction to show road segment information
  function addRoadInfoInteraction(map, source) {
    // Remove any existing overlay
    const existingOverlay = map.getOverlayById("road-info");
    if (existingOverlay) {
      map.removeOverlay(existingOverlay);
    }

    // Create tooltip element
    const tooltipElement = document.createElement("div");
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

    // Add tooltip to document
    document.body.appendChild(tooltipElement);

    // Create and add overlay
    const tooltip = new Overlay({
      element: tooltipElement,
      id: "road-info",
      offset: [0, -10],
      positioning: "bottom-center",
    });
    map.addOverlay(tooltip);

    // Variables to track pointer interaction
    let currentFeature = null;

    // Add pointer move listener
    map.on("pointermove", function (evt) {
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);

      map.getTargetElement().style.cursor = hit ? "pointer" : "";

      if (hit) {
        const feature = map.forEachFeatureAtPixel(pixel, function (feature) {
          return feature;
        });

        if (feature && feature !== currentFeature) {
          currentFeature = feature;

          // Get feature properties
          const name = feature.get("name") || "Unknown Road";
          const county = feature.get("county") || "Unknown County";
          const city = feature.get("city") || "Unknown City";
          const count = feature.get("count") || 0;
          const length = feature.get("length") || 0;
          const accidentsPerKm = feature.get("accidentsPerKm") || 0;
          const isRealRoad = feature.get("isRealRoad");

          // Format tooltip content
          tooltipElement.innerHTML = `
            <div>
              <strong>${name}</strong><br>
              ${city}, ${county}<br>
              <span style="color: ${getHeatColor(feature.get("intensity"))}">
                ■ ${count} accidents
              </span><br>
              ${(length / 1000).toFixed(2)} km segment<br>
              ${accidentsPerKm.toFixed(2)} accidents/km<br>
              ${
                isRealRoad
                  ? '<span style="color: #8F8">✓ Exact road path</span>'
                  : ""
              }
            </div>
          `;

          tooltipElement.classList.remove("hidden");
          tooltip.setPosition(evt.coordinate);
        }
      } else {
        currentFeature = null;
        tooltipElement.classList.add("hidden");
      }
    });
  }

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = new Map({
        target: mapContainerRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
            zIndex: 0,
          }),
        ],
        view: new View({
          center: fromLonLat([-82.5, 28.1]), // Center of Florida
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true,
        }),
      });

      mapRef.current = map;

      // Load road accidents data
      loadRoadAccidents();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, []);

  // Handle date range changes
  const handleDateChange = (e, field) => {
    setDateRange({
      ...dateRange,
      [field]: e.target.value,
    });
  };

  // Apply date filters
  const applyFilters = () => {
    loadRoadAccidents();
    setShowFilters(false);
  };

  // Reset filters
  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    loadRoadAccidents();
    setShowFilters(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-700">
        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="text-lg font-bold">Traffic Accident Heatmap</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-gray-800 p-4 shadow-md border-b border-gray-700">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateChange(e, "start")}
                className="bg-gray-700 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateChange(e, "end")}
                className="bg-gray-700 rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={applyFilters}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
              disabled={loading}
            >
              Apply
            </button>
            <button
              onClick={resetFilters}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
              disabled={loading}
            >
              Reset
            </button>

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => zoomTo("miami")}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
              >
                Miami
              </button>
              <button
                onClick={() => zoomTo("orlando")}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
              >
                Orlando
              </button>
              <button
                onClick={() => zoomTo("tampa")}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
              >
                Tampa
              </button>
              <button
                onClick={() => zoomTo("jacksonville")}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
              >
                Jacksonville
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content - Map */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="w-full h-full"></div>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-3 rounded-lg z-10 flex flex-col items-center">
            <div className="flex items-center mb-2">
              <svg
                className="animate-spin h-5 w-5 mr-2 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>{loadingMessage}</span>
            </div>
            {totalSegments > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full"
                  style={{
                    width: `${Math.round(
                      (loadedSegments / totalSegments) * 100
                    )}%`,
                  }}
                ></div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && !loading && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-900 bg-opacity-80 text-white px-4 py-2 rounded-lg z-10">
            {error}
          </div>
        )}

        {/* Reload button */}
        <button
          onClick={loadRoadAccidents}
          disabled={loading}
          className={`absolute bottom-4 right-4 px-4 py-2 rounded shadow z-10 ${
            loading
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Refresh Data
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 p-3 rounded z-10">
        <h3 className="text-white font-bold mb-2">Accident Density</h3>
        <div className="flex items-center space-x-2">
          <div
            className="w-6 h-3"
            style={{ backgroundColor: getHeatColor(0.1) }}
          ></div>
          <span className="text-sm">Low</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="w-6 h-3"
            style={{ backgroundColor: getHeatColor(0.5) }}
          ></div>
          <span className="text-sm">Medium</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="w-6 h-3"
            style={{ backgroundColor: getHeatColor(0.9) }}
          ></div>
          <span className="text-sm">High</span>
        </div>
      </div>
    </div>
  );
}
