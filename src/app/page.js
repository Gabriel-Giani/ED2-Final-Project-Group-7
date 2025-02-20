"use client";

import React, { useState, useRef } from "react";
import OpenLayersMap from "./components/map";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAccidentsByDateRange,
  getAccidentsByDateAndTimeRange,
} from "@/utils/db/accidents";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";

export default function HomePage() {
  // States for pop-ups
  const [showFilters, setShowFilters] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Map reference
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // Called by map.js once the map is ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
  };

  // FILTER states
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeRange, setTimeRange] = useState({ start: "", end: "" });
  const [locationRadius, setLocationRadius] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Add new state for time filter toggle
  const [useTimeFilter, setUseTimeFilter] = useState(false);

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

  // FILTERS
  const applyFilters = async () => {
    if (!mapRef.current) return;

    setIsLoading(true);
    try {
      // Check if we have valid dates
      if (dateRange.start && dateRange.end) {
        let accidents;

        // Apply date and time filter if time filter is enabled
        if (useTimeFilter && timeRange.start && timeRange.end) {
          accidents = await getAccidentsByDateAndTimeRange(
            dateRange.start,
            dateRange.end,
            timeRange.start,
            timeRange.end
          );
        } else {
          // Otherwise just filter by date
          accidents = await getAccidentsByDateRange(
            dateRange.start,
            dateRange.end
          );
        }

        // Convert accidents to features and update map
        if (mapRef.current && accidents) {
          const features = accidents
            .map((crash) => {
              if (crash.latitude && crash.longitude) {
                return new Feature({
                  geometry: new Point(
                    fromLonLat([crash.longitude, crash.latitude])
                  ),
                  properties: crash,
                });
              }
              return null;
            })
            .filter(Boolean);

          // Update the vector source with new features
          const vectorSource = mapRef.current.getVectorSource();
          vectorSource.clear();
          vectorSource.addFeatures(features);
        }
      }
    } catch (error) {
      console.error("Error applying filters:", error);
    } finally {
      setIsLoading(false);
      setShowFilters(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    setTimeRange({ start: "", end: "" });
    setUseTimeFilter(false);
    setLocationRadius("");
    if (mapRef.current) {
      mapRef.current.fetchCrashData({});
    }
    setShowFilters(false);
  };

  // ABOUT
  const openAbout = () => setShowAbout(true);
  const closeAbout = () => setShowAbout(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* NAV BAR */}
      <div className="h-14 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-700 relative">
        {/* FILTERS BUTTON */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded relative z-10"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </motion.button>

        {/* TITLE */}
        <h1 className="text-lg font-bold">Don't Drive Here</h1>

        {/* ABOUT BUTTON */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
          onClick={openAbout}
        >
          About
        </motion.button>

        {/* FILTERS POPUP */}
        <AnimatePresence mode="wait">
          {showFilters && (
            <motion.div
              key="filters-popup"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-4 mt-2 w-96 bg-gray-100 text-gray-800 rounded-xl shadow-lg p-4 z-50"
            >
              {/* Arrow pointing up */}
              <div
                className="absolute -top-2 left-8 w-0 h-0
                border-l-[8px] border-r-[8px] border-b-[8px] 
                border-l-transparent border-r-transparent
                border-b-gray-100"
              />

              <h2 className="font-bold text-lg mb-3">Filters</h2>

              {/* Date Range */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700">
                  Date Range:
                </label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    className="border rounded p-2 flex-1"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, start: e.target.value })
                    }
                  />
                  <input
                    type="date"
                    className="border rounded p-2 flex-1"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, end: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Time Range */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useTimeFilter}
                      onChange={(e) => setUseTimeFilter(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Time Range:
                  </div>
                </label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="time"
                    className="border rounded p-2 flex-1"
                    value={timeRange.start}
                    onChange={(e) =>
                      setTimeRange({ ...timeRange, start: e.target.value })
                    }
                    disabled={!useTimeFilter}
                  />
                  <input
                    type="time"
                    className="border rounded p-2 flex-1"
                    value={timeRange.end}
                    onChange={(e) =>
                      setTimeRange({ ...timeRange, end: e.target.value })
                    }
                    disabled={!useTimeFilter}
                  />
                </div>
              </div>

              {/* Location/Radius */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700">
                  Radius (km):
                </label>
                <input
                  type="number"
                  placeholder="Enter radius in kilometers"
                  className="border rounded p-2 w-full mt-2"
                  value={locationRadius}
                  onChange={(e) => setLocationRadius(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>

              <div className="flex gap-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-red-500 text-white flex-1 py-2 rounded hover:bg-red-600"
                  onClick={resetFilters}
                >
                  Reset
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-green-500 text-white flex-1 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                  onClick={applyFilters}
                  disabled={isLoading}
                >
                  {isLoading ? "Applying..." : "Apply"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MAIN CONTENT: MAP + ZOOM BUTTONS */}
      <div className="relative flex-1">
        {/* MAP */}
        <div className="w-full h-full rounded-xl overflow-hidden">
          <OpenLayersMap onMapReady={handleMapReady} />
        </div>

        {/* ZOOM BUTTONS */}
        <div className="absolute top-4 right-4 flex flex-col space-y-1 z-20">
          <motion.button
            type="button"
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

      {/* ABOUT POPUP */}
      <AnimatePresence mode="wait">
        {showAbout && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            {/* Backdrop */}
            <motion.div
              key="about-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50"
              onClick={closeAbout}
            />

            {/* Modal Content */}
            <motion.div
              key="about-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                scale: {
                  type: "spring",
                  damping: 25,
                  stiffness: 400,
                },
              }}
              className="relative bg-gray-800 text-gray-100 rounded-xl shadow-lg p-6 w-80 mx-auto"
            >
              <h2 className="text-xl font-bold mb-4">About Us</h2>
              <p className="mb-4">
                We're here to help you see where accidents most commonly happen
                so you can plan safe routes. Stay safe out there!
              </p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={closeAbout}
              >
                Close
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="h-10 bg-gray-900 border-t border-gray-700 text-gray-400 text-center flex items-center justify-center text-sm">
        Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; Gavin
        West
      </footer>
    </div>
  );
}
