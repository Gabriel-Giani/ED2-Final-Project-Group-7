"use client";

import React, { useRef } from "react";
import HotspotMap from "./components/HotspotMap";
import RoadLineMap from "../components/RoadLineMap";
import TopHotspots from "./components/TopHotspots";
import ViewToggle from "./components/ViewToggle";
import FiltersButton from "./components/FiltersButton";
import AboutButton from "./components/AboutButton";
import { motion } from "framer-motion";
import { fromLonLat } from "ol/proj";
import { useAccidentContext } from "@/context/accidentContext";

export default function HomePage() {
  // Map reference (potentially used by both map types)
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // Get state from context
  const { mapViewType, loading, loadingMessage, getTopHotspots } =
    useAccidentContext();

  // Called by map components once the map instance is ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
  };

  // --- Zoom Logic (Applies to the currently displayed map) ---
  const getCurrentView = () => {
    return mapRef.current?.getView();
  };

  // Single step zoom
  const handleSingleZoom = (direction) => {
    const view = getCurrentView();
    if (!view) return;
    const currentZoom = view.getZoom();
    view.animate({
      zoom: currentZoom + (direction === "in" ? 1 : -1),
      duration: 250,
    });
  };

  // Continuous zoom
  const startContinuousZoom = (direction) => {
    const view = getCurrentView();
    if (!view) return;
    const zoomStep = direction === "in" ? 0.1 : -0.1;

    zoomIntervalRef.current = setInterval(() => {
      const currentZoom = view.getZoom();
      // Ensure zoom stays within map limits if defined
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

  // Pointer event handlers for zoom buttons
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

  // Handle hotspot click (only relevant when hotspots are shown)
  const handleHotspotClick = (hotspot) => {
    const view = getCurrentView();
    if (view && hotspot.center) {
      view.animate({
        center: fromLonLat(hotspot.center),
        zoom: 14,
        duration: 500,
      });
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
          {mapViewType === "hotspots" && (
            <HotspotMap onMapReady={handleMapReady} />
          )}
          {mapViewType === "roadLines" && (
            <RoadLineMap onMapReady={handleMapReady} />
          )}
        </div>

        {/* View Toggle */}
        <ViewToggle />

        {/* Top Hotspots (Only show if in hotspots view?) */}
        {mapViewType === "hotspots" && (
          <TopHotspots onHotspotClick={handleHotspotClick} />
        )}

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
