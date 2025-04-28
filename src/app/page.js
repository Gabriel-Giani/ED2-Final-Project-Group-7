"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import RoadLineMap from "../components/RoadLineMap";
import TopRoadSegments from "../components/TopRoadSegments";
import FiltersButton from "./components/FiltersButton";
import AboutButton from "./components/AboutButton";
import { motion } from "framer-motion";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { getExtent } from "ol/extent";
import { useAccidentContext } from "@/context/accidentContext";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Style, Fill, Stroke, Text } from "ol/style";
import GeoJSON from "ol/format/GeoJSON";
import Link from "next/link";

// Helper to calculate bounding box from LonLat coordinates
function calculateLonLatBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  coordinates.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });
  return [minLon, minLat, maxLon, maxLat];
}

// County style
const countyStyle = new Style({
  stroke: new Stroke({
    color: "rgba(0, 0, 0, 0.6)",
    width: 1.5,
  }),
  fill: new Fill({
    color: "rgba(255, 255, 255, 0.1)",
  }),
});

// Selected county style
const selectedCountyStyle = new Style({
  stroke: new Stroke({
    color: "rgba(0, 0, 255, 0.8)",
    width: 2.5,
  }),
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.1)",
  }),
});

// City boundary style
const cityBoundaryStyle = new Style({
  stroke: new Stroke({
    color: "rgba(41, 122, 37, 0.88)",
    width: 2,
  }),
  fill: new Fill({
    color: "rgba(0, 128, 0, 0.1)",
  }),
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "#000",
    }),
    stroke: new Stroke({
      color: "#fff",
      width: 3,
    }),
    offsetY: -15,
    overflow: true,
  }),
});

export default function HomePage() {
  // Map reference for RoadLineMap
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // Get state from context, including showPoints and setShowPoints
  const {
    loading,
    loadingMessage,
    filters,
    showPoints, // Get showPoints from context
    setShowPoints, // Get setShowPoints from context
  } = useAccidentContext();
  const { filterRegion, regionName } = filters || {};

  // Add refs for vector sources
  const countiesSource = useRef(new VectorSource());
  const cityBoundariesSource = useRef(new VectorSource());

  // Add refs for vector layers
  const countiesLayer = useRef(
    new VectorLayer({
      source: countiesSource.current,
      style: function (feature) {
        const countyName = feature.get("NAME");
        if (
          regionName &&
          filterRegion === "county" &&
          countyName === regionName
        ) {
          return selectedCountyStyle;
        }
        return countyStyle;
      },
      zIndex: 0.5,
    })
  );

  const cityBoundariesLayer = useRef(
    new VectorLayer({
      source: cityBoundariesSource.current,
      style: function (feature) {
        return cityBoundaryStyle;
      },
      zIndex: 0.8, // Above counties but below road segments
    })
  );

  // Called by RoadLineMap when the map instance is ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;

    // Add county and city layers to the map
    mapRef.current.addLayer(countiesLayer.current);
    mapRef.current.addLayer(cityBoundariesLayer.current);

    // Load geographic data
    try {
      loadCounties();
      loadCityBoundaries();
    } catch (error) {
      console.error("Error loading geographic data:", error);
    }
  };

  // Load Florida counties GeoJSON data
  const loadCounties = useCallback(async () => {
    try {
      const response = await fetch("/floridaCountyOutline.geojson");
      const geojsonData = await response.json();

      // Filter features based on selected county or filter settings
      let featuresToShow;

      if (filterRegion === "county" && regionName) {
        // Use the county from filters if set
        featuresToShow = geojsonData.features.filter(
          (feature) => feature.properties.NAME === regionName
        );
      } else if (filterRegion === "state") {
        // Show all counties for state-level view
        featuresToShow = geojsonData.features;
      } else if (filterRegion === "city" && regionName) {
        // For city view, we might want to show the containing county
        // This would require knowing which county contains each city
        // For now, don't show county boundaries for city-specific views
        featuresToShow = [];
      } else {
        // Default: show all counties if no specific filter is set
        featuresToShow = geojsonData.features;
      }

      // Create a filtered GeoJSON
      const filteredGeoJSON = {
        type: "FeatureCollection",
        features: featuresToShow,
      };

      // Parse GeoJSON using OpenLayers format
      const format = new GeoJSON();
      const features = format.readFeatures(filteredGeoJSON, {
        featureProjection: "EPSG:3857", // Web Mercator projection used by OpenLayers
        dataProjection: "EPSG:4326", // WGS84 coordinates for GeoJSON
      });

      // Clear existing features and add filtered ones
      countiesSource.current.clear();
      countiesSource.current.addFeatures(features);

      console.log(`Added ${features.length} county features to map`);

      // Fit view to selected county if there's only one
      if (features.length === 1 && mapRef.current) {
        const extent = countiesSource.current.getExtent();
        mapRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 500,
        });
      }

      // Force map refresh if it exists
      if (mapRef.current) {
        mapRef.current.render();
      }
    } catch (error) {
      console.error("Error loading Florida counties GeoJSON:", error);
    }
  }, [filterRegion, regionName]);

  // Load city boundaries GeoJSON data
  const loadCityBoundaries = useCallback(async () => {
    try {
      console.log(
        "Loading city boundaries with filterRegion:",
        filterRegion,
        "regionName:",
        regionName
      );

      // Load the city boundaries GeoJSON file
      const response = await fetch("/par_citylm_2021.geojson");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch city boundaries: ${response.status} ${response.statusText}`
        );
      }

      const geojsonData = await response.json();
      console.log(
        "City GeoJSON loaded, features count:",
        geojsonData.features?.length || 0
      );

      // Parse GeoJSON using OpenLayers format
      const format = new GeoJSON();
      const features = format.readFeatures(geojsonData, {
        featureProjection: "EPSG:3857", // Web Mercator projection used by OpenLayers
        dataProjection: "EPSG:4326", // WGS84 coordinates for GeoJSON
      });

      console.log("Parsed features count:", features.length);

      // Filter features based on selection criteria
      let filteredFeatures = [];

      if (filterRegion === "city" && regionName) {
        // If a specific city is selected in filters, only show that city
        console.log("Filtering for specific city:", regionName);
        filteredFeatures = features.filter((feature) => {
          const name = feature.get("NAME") || "";
          const matches = name.toLowerCase() === regionName.toLowerCase();
          return matches;
        });
        console.log(
          `Found ${filteredFeatures.length} features matching city name: ${regionName}`
        );
      } else if (filterRegion === "state") {
        // For state-level view, don't show any cities to avoid clutter
        console.log("State-level view, not showing city boundaries");
      } else {
        console.log("No specific city or county filter active");
      }

      // Clear existing features
      cityBoundariesSource.current.clear();

      // Add filtered features if we have any
      if (filteredFeatures.length > 0) {
        cityBoundariesSource.current.addFeatures(filteredFeatures);
        console.log(
          `Added ${filteredFeatures.length} city boundary features to map`
        );

        // If a specific city is selected, fit the view to that city
        if (filterRegion === "city" && regionName && mapRef.current) {
          const extent = cityBoundariesSource.current.getExtent();
          mapRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500,
          });
        }
      } else {
        console.log("No city boundaries to display based on current filters");
      }

      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
      }
    } catch (error) {
      console.error("Error loading or processing city boundaries:", error);
    }
  }, [filterRegion, regionName]);

  // Update geographic data when filters change
  useEffect(() => {
    if (mapRef.current) {
      try {
        loadCounties();
        loadCityBoundaries();
      } catch (error) {
        console.error("Error updating geographic data:", error);
      }
    }
  }, [loadCounties, loadCityBoundaries, filters]);

  // --- Zoom Logic ---
  const getCurrentView = () => {
    return mapRef.current?.getView();
  };

  const handleSingleZoom = (direction) => {
    const view = getCurrentView();
    if (!view) return;
    const currentZoom = view.getZoom();
    view.animate({
      zoom: currentZoom + (direction === "in" ? 1 : -1),
      duration: 250,
    });
  };

  const startContinuousZoom = (direction) => {
    const view = getCurrentView();
    if (!view) return;
    const zoomStep = direction === "in" ? 0.1 : -0.1;

    zoomIntervalRef.current = setInterval(() => {
      const currentZoom = view.getZoom();
      const newZoom = Math.max(
        view.getMinZoom() || 0,
        Math.min(view.getMaxZoom() || 28, currentZoom + zoomStep)
      );
      view.setZoom(newZoom);
    }, 50);
  };

  const stopAllZooming = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
    isHoldingRef.current = false;
  };

  const handlePointerDown = (direction) => {
    isHoldingRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      startContinuousZoom(direction);
    }, 200);
  };

  const handlePointerUp = (direction) => {
    if (!isHoldingRef.current) {
      handleSingleZoom(direction);
    }
    stopAllZooming();
  };

  // Handle segment click from the list
  const handleSegmentClick = (segment) => {
    const view = getCurrentView();
    if (!view || !segment?.geometry?.coordinates) return;

    try {
      // Calculate bounding box (extent) of the segment in LonLat
      const lonLatExtent = calculateLonLatBoundingBox(
        segment.geometry.coordinates
      );
      if (!lonLatExtent) return;

      // Transform extent to the map's projection (likely EPSG:3857)
      const mapProjection = view.getProjection();
      const transformedExtent = transformExtent(
        lonLatExtent,
        "EPSG:4326", // Input is WGS84
        mapProjection // Output is map projection
      );

      // Zoom the map to fit this extent
      view.fit(transformedExtent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
        maxZoom: 16,
      });
    } catch (error) {
      console.error("Error zooming to segment:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-900 to-slate-900 text-white">
      {/* NAV BAR */}
      <header className="h-[var(--header-height)] flex items-center justify-between px-5 bg-opacity-70 backdrop-blur-md border-b border-gray-700/50 relative z-20 shadow-lg">
        <div className="flex items-center gap-4">
          <FiltersButton />
          <div className="h-6 border-r border-gray-600 hidden sm:block"></div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPoints(!showPoints)}
            className="pill-button bg-gray-700/80 hover:bg-gray-600 text-sm font-medium hidden sm:flex items-center gap-2"
          >
            {showPoints ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
                </svg>
                Show Hotspots
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.5 3.528v4.644c0 .729-.29 1.428-.805 1.944l-1.217 1.216a8.75 8.75 0 013.55.621l.502.201a7.25 7.25 0 004.178.365l-2.403-2.403a2.75 2.75 0 01-.805-1.944V3.528a40.205 40.205 0 00-3 0zm4.5.084l.19.015a.75.75 0 10.12-1.495 41.364 41.364 0 00-6.62 0 .75.75 0 00.12 1.495L7 3.612v4.56c0 .331-.132.649-.366.883L2.6 13.09c-1.496 1.496-.817 4.15 1.403 4.475C5.961 17.852 7.963 18 10 18s4.039-.148 5.997-.436c2.22-.325 2.9-2.979 1.403-4.475l-4.034-4.034A1.25 1.25 0 0113 8.172v-4.56z"
                    clipRule="evenodd"
                  />
                </svg>
                Show Points
              </>
            )}
          </motion.button>
        </div>

        <h1 className="text-xl font-bold tracking-tight absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6 text-red-500"
          >
            <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h8.25c1.035 0 1.875-.84 1.875-1.875V15z" />
            <path d="M8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM15.75 6.75a.75.75 0 00-.75.75v11.25c0 .087.015.17.042.248a3 3 0 015.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 00-3.732-10.104 1.837 1.837 0 00-1.47-.725H15.75z" />
            <path d="M19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
          Don&apos;t Drive Here
        </h1>

        <div className="flex items-center gap-2">
          <Link href="/case-study/fau" passHref legacyBehavior>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="pill-button bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
            >
              FAU Case Study
            </motion.a>
          </Link>

          <AboutButton />
        </div>
      </header>

      {/* MAIN CONTENT: MAP + UI ELEMENTS */}
      <main className="relative flex-1 overflow-hidden">
        {/* MAP CONTAINER */}
        <div className="w-full h-full">
          <RoadLineMap onMapReady={handleMapReady} />
        </div>

        {/* Mobile Toggle Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowPoints(!showPoints)}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 pill-button bg-gray-700/80 hover:bg-gray-600 text-sm font-medium sm:hidden flex items-center gap-2 z-20 shadow-lg"
        >
          {showPoints ? "Show Hotspots" : "Show Points"}
        </motion.button>

        {/* Top Road Segments List */}
        <TopRoadSegments onSegmentClick={handleSegmentClick} />

        {/* ZOOM BUTTONS */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-20">
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="glass-card w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg"
            onPointerDown={() => handlePointerDown("in")}
            onPointerUp={() => handlePointerUp("in")}
            onPointerLeave={stopAllZooming}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              +
            </div>
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="glass-card w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg"
            onPointerDown={() => handlePointerDown("out")}
            onPointerUp={() => handlePointerUp("out")}
            onPointerLeave={stopAllZooming}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              -
            </div>
          </motion.button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="glass-card p-6 max-w-sm w-full text-center shadow-xl">
              <div className="flex justify-center mb-4">
                <svg
                  className="animate-spin h-10 w-10 text-blue-500"
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
              </div>
              <h3 className="text-lg font-bold mb-3">Loading Data...</h3>
              <p className="text-sm text-gray-300">
                {loadingMessage ||
                  "Please wait while we fetch the latest accident data..."}
              </p>
            </div>
          </motion.div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="h-[var(--footer-height)] bg-gray-900/90 backdrop-blur-md border-t border-gray-700/50 text-gray-400 text-center flex items-center justify-center text-sm z-20">
        <div className="flex items-center gap-1 sm:gap-2">
          <span>Created by:</span>
          <span className="font-medium text-gray-300">
            Chris Medrano, Gabriel Giani, Leonardo Silva &amp; William West
          </span>
        </div>
      </footer>
    </div>
  );
}
