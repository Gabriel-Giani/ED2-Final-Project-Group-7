"use client";

import React, { useRef } from "react";
import HotspotMap from "./components/HotspotMap";
import TopHotspots from "./components/TopHotspots";
import ViewToggle from "./components/ViewToggle";
import FiltersButton from "./components/FiltersButton";
import AboutButton from "./components/AboutButton";
import { motion } from "framer-motion";
import { fromLonLat } from "ol/proj";
import { useAccidentContext } from "@/context/accidentContext";

export default function HomePage() {
  // Map reference
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // Called by map.js once the map is ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
  };

  // Single step zoom (for clicks)
  const handleSingleZoom = (direction) => {
    if (!mapRef.current) return;
    mapRef.current.zoomBy(direction === "in" ? 1 : -1);
  };

  // Continuous zoom (for hold)
  const startContinuousZoom = (direction) => {
    if (!mapRef.current) return;
    const zoomStep = direction === "in" ? 0.1 : -0.1;

    zoomIntervalRef.current = setInterval(() => {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.zoomTo(currentZoom + zoomStep);
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

  // Pointer event handlers
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

  // Handle hotspot click
  const handleHotspotClick = (hotspot) => {
    if (mapRef.current && hotspot.center) {
      // Center map on hotspot
      const view = mapRef.current.getView();
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
      <div className="h-14 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-700 relative">
        {/* FILTERS BUTTON */}
        <FiltersButton />

        {/* TITLE */}
        <h1 className="text-lg font-bold">Don&apos;t Drive Here</h1>

        {/* ABOUT BUTTON */}
        <AboutButton />
      </div>

      {/* MAIN CONTENT: MAP + ZOOM BUTTONS */}
      <div className="relative flex-1">
        {/* MAP */}
        <div className="w-full h-full rounded-xl overflow-hidden">
          <HotspotMap onMapReady={handleMapReady} />
        </div>

        {/* View Toggle */}
        <ViewToggle />

        {/* Top Hotspots */}
        <TopHotspots onHotspotClick={handleHotspotClick} />

        {/* ZOOM BUTTONS */}
        <div className="absolute top-4 right-4 flex flex-col space-y-1 z-20">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="bg-white text-black rounded p-2 shadow hover:bg-gray-100"
            onPointerDown={() => handlePointerDown("in")}
            onPointerUp={() => handlePointerUp("in")}
            onPointerLeave={() => stopAllZooming()}
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
            onPointerLeave={() => stopAllZooming()}
          >
            -
          </motion.button>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="h-10 bg-gray-900 border-t border-gray-700 text-gray-400 text-center flex items-center justify-center text-sm">
        Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; Gavin
        West
      </footer>
    </div>
  );
}
