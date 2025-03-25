"use client";

import React, { useState, useRef } from "react";
import HotspotMap from "./components/HotspotMap";
import TopHotspots from "./components/TopHotspots";
import ViewToggle from "./components/ViewToggle";
import FiltersButton from "./components/FiltersButton";
import AboutButton from "./components/AboutButton";
import { motion } from "framer-motion";
import {
  getAccidentsByDateRange,
  getAccidentsByDateAndTimeRange,
} from "../utils/db/accidents";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import Link from "next/link";

export default function HomePage() {
  // Map reference
  const mapRef = useRef(null);
  const zoomIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

  // View mode state
  const [showPoints, setShowPoints] = useState(false);

  // Region filter state
  const [filterRegion, setFilterRegion] = useState("state");
  const [regionName, setRegionName] = useState("");

  // Add map refresh control state
  const [mapShouldRefresh, setMapShouldRefresh] = useState(false);

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

  // FILTERS - Modified to control map refresh
  const applyFilters = async () => {
    if (!mapRef.current) return;

    setIsLoading(true);
    try {
      // Set map refresh flag to true
      setMapShouldRefresh(true);

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

      // Reset the refresh flag after a short delay
      setTimeout(() => {
        setMapShouldRefresh(false);
      }, 100);
    }
  };

  // Reset filters - Modified to control map refresh
  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    setTimeRange({ start: "", end: "" });
    setUseTimeFilter(false);
    setLocationRadius("");
    setFilterRegion("state");
    setRegionName("");

    // Set map refresh flag to true
    setMapShouldRefresh(true);

    if (mapRef.current) {
      mapRef.current.fetchCrashData({});
    }

    // Reset the refresh flag after a short delay
    setTimeout(() => {
      setMapShouldRefresh(false);
    }, 100);
  };

  // Handle view mode toggle
  const handleViewToggle = () => {
    setShowPoints(!showPoints);
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
        {/* FILTERS BUTTON - Now a separate component */}
        <FiltersButton
          filterRegion={filterRegion}
          setFilterRegion={setFilterRegion}
          regionName={regionName}
          setRegionName={setRegionName}
          dateRange={dateRange}
          setDateRange={setDateRange}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          useTimeFilter={useTimeFilter}
          setUseTimeFilter={setUseTimeFilter}
          locationRadius={locationRadius}
          setLocationRadius={setLocationRadius}
          applyFilters={applyFilters}
          resetFilters={resetFilters}
          isLoading={isLoading}
        />

        {/* TITLE */}
        <h1 className="text-lg font-bold">Don&apos;t Drive Here</h1>

        {/* ABOUT BUTTON - Now a separate component */}
        <AboutButton />
      </div>

      {/* MAIN CONTENT: MAP + ZOOM BUTTONS */}
      <div className="relative flex-1">
        {/* MAP */}
        <div className="w-full h-full rounded-xl overflow-hidden">
          <HotspotMap
            onMapReady={handleMapReady}
            showPoints={showPoints}
            filterRegion={filterRegion}
            regionName={regionName}
            dateRange={dateRange.start && dateRange.end ? dateRange : null}
            timeRange={
              useTimeFilter && timeRange.start && timeRange.end
                ? timeRange
                : null
            }
            shouldRefresh={mapShouldRefresh}
          />
        </div>

        {/* View Toggle */}
        <ViewToggle showPoints={showPoints} onToggle={handleViewToggle} />

        {/* Top Hotspots */}
        <TopHotspots
          dateRange={dateRange.start && dateRange.end ? dateRange : null}
          timeRange={
            useTimeFilter && timeRange.start && timeRange.end ? timeRange : null
          }
          onHotspotClick={handleHotspotClick}
        />

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

      {/* FOOTER */}
      <footer className="h-10 bg-gray-900 border-t border-gray-700 text-gray-400 text-center flex items-center justify-center text-sm">
        <div className="flex items-center">
          <span>
            Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; Gavin
            West
          </span>
          <span className="mx-2">|</span>
          <Link href="/playground" className="text-blue-400 hover:underline">
            Traffic Heatmap Playground
          </Link>
          <span className="mx-2">|</span>
          <Link href="/playground3" className="text-blue-400 hover:underline">
            Road Segments Traffic
          </Link>
        </div>
      </footer>
    </div>
  );
}
