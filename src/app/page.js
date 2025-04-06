"use client";

import React, { useRef } from "react";
import RoadLineMap from "../components/RoadLineMap";
import TopRoadSegments from "../components/TopRoadSegments";
import FiltersButton from "./components/FiltersButton";
import AboutButton from "./components/AboutButton";
import { motion } from "framer-motion";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { getExtent } from "ol/extent";
import { useAccidentContext } from "@/context/accidentContext";

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

export default function HomePage() {
  // Map reference for RoadLineMap
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // Get state from context
  const { loading, loadingMessage } = useAccidentContext();

  // Called by RoadLineMap when the map instance is ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
  };

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
        <AboutButton />
      </div>

      {/* MAIN CONTENT: MAP + UI ELEMENTS */}
      <div className="relative flex-1">
        {/* MAP CONTAINER */}
        <div className="w-full h-full rounded-xl overflow-hidden">
          <RoadLineMap onMapReady={handleMapReady} />
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
        Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; Gavin
        West
      </footer>
    </div>
  );
}
