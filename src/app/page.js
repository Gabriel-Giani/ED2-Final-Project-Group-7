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
  // Return extent in [minLon, minLat, maxLon, maxLat] format
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
        console.log(
          `Filtering to show only county from filters: ${regionName}`
        );
      } else if (filterRegion === "state") {
        // Show all counties for state-level view
        featuresToShow = geojsonData.features;
        console.log("Showing all counties for state-level view");
      } else if (filterRegion === "city" && regionName) {
        // For city view, we might want to show the containing county
        // This would require knowing which county contains each city
        // For now, don't show county boundaries for city-specific views
        featuresToShow = [];
        console.log("City view active, not showing county boundaries");
      } else {
        // Default: show all counties if no specific filter is set
        featuresToShow = geojsonData.features;
        console.log("No specific filter set, showing all counties");
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
        dataProjection: "EPSG:4326", // Assuming the GeoJSON is in WGS84 coordinates
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
        dataProjection: "EPSG:4326", // Assuming the GeoJSON is in WGS84 coordinates
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
        // } else if (filterRegion === "county" && regionName) {
        //   // If a county is selected, show all cities in that county
        //   console.log("Filtering for cities in county:", regionName);
        //   filteredFeatures = features.filter((feature) => {
        //     const county = feature.get("COUNTY") || "";
        //     const matches = county.toLowerCase() === regionName.toLowerCase();
        //     return matches;
        //   });
        //   console.log(
        //     `Found ${filteredFeatures.length} features in county: ${regionName}`
        //   );
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
      // 1. Calculate the bounding box (extent) of the segment in LonLat
      const lonLatExtent = calculateLonLatBoundingBox(
        segment.geometry.coordinates
      );
      if (!lonLatExtent) return;

      // 2. Transform the extent to the map's projection (likely EPSG:3857)
      const mapProjection = view.getProjection(); // Get map projection
      const transformedExtent = transformExtent(
        lonLatExtent,
        "EPSG:4326",
        mapProjection
      );

      // 3. Zoom the map to fit this extent with some padding
      view.fit(transformedExtent, {
        padding: [50, 50, 50, 50], // Add padding around the segment
        duration: 1000, // Animation duration
        maxZoom: 16, // Optional: Limit max zoom level
      });
    } catch (error) {
      console.error("Error zooming to segment:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* NAV BAR */}
      <div className="h-14 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-700 relative z-20">
        <FiltersButton />
        <h1 className="text-lg font-bold">Don&apos;t Drive Here</h1>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={
              () => setShowPoints(!showPoints) // Use setShowPoints from context
            }
            className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm hover:bg-gray-600 transition-colors"
          >
            {/* Update button text based on showPoints from context */}
            {showPoints ? "Show Hotspots" : "Show Points"}
          </motion.button>

          <Link href="/case-study/fau" passHref legacyBehavior>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-500 transition-colors"
            >
              FAU Case Study
            </motion.a>
          </Link>

          <AboutButton />
        </div>
      </div>

      {/* MAIN CONTENT: MAP + UI ELEMENTS */}
      <div className="relative flex-1">
        {/* MAP CONTAINER - Pass showPoints instead of viewMode */}
        <div className="w-full h-full rounded-xl overflow-hidden">
          {/* Pass showPoints to RoadLineMap if it needs it, or remove prop if not used */}
          <RoadLineMap onMapReady={handleMapReady} />
          {/* Assuming RoadLineMap uses showPoints from context directly now */}
        </div>

        {/* Top Road Segments List */}
        <TopRoadSegments onSegmentClick={handleSegmentClick} />

        {/* ZOOM BUTTONS */}
        <div className="absolute top-4 right-4 flex flex-col space-y-1 z-20">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="bg-white text-black rounded p-2 shadow hover:bg-gray-100"
            onPointerDown={() => handlePointerDown("in")}
            onPointerUp={() => handlePointerUp("in")}
            onPointerLeave={stopAllZooming}
          >
            +
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="bg-white text-black rounded p-2 shadow hover:bg-gray-100"
            onPointerDown={() => handlePointerDown("out")}
            onPointerUp={() => handlePointerUp("out")}
            onPointerLeave={stopAllZooming}
          >
            -
          </motion.button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-sm text-center shadow-xl">
              <h3 className="text-lg font-bold mb-3">Loading Data...</h3>
              <p className="text-sm text-gray-300">
                {loadingMessage || "Please wait..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="h-10 bg-gray-900 border-t border-gray-700 text-gray-400 text-center flex items-center justify-center text-sm z-20">
        Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; William
        West
      </footer>
    </div>
  );
}
