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
} from "@/utils/db/accidents";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";

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

  // BASIC FILTER states
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeRange, setTimeRange] = useState({ start: "", end: "" });
  const [useTimeFilter, setUseTimeFilter] = useState(false);
  const [locationRadius, setLocationRadius] = useState("");

  // ADVANCED FILTER states - will be populated by the FiltersButton component
  const [advancedFilters, setAdvancedFilters] = useState({
    dayOfWeek: "",
    roadName: "",
    intersectingRoad: "",
    injuryLevel: "",
    alcoholDrugs: "",
    lightCondition: "",
    weatherCondition: "",
    roadSurfaceCondition: "",
    aggressiveDriving: false,
    pedestrianInvolved: false,
    bicycleInvolved: false,
    motorcycleInvolved: false,
    teenInvolved: false,
    elderlyInvolved: false,
    impaired: false,
    direction: "",
    damageMin: "",
    damageMax: ""
  });

  const [isLoading, setIsLoading] = useState(false);

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

  // Build Supabase query params based on all filters
  const buildQueryParams = (filters) => {
    const params = {};
    
    // Only add non-empty filters to params
    if (filters.filterRegion && filters.regionName) {
      if (filters.filterRegion === "county") {
        params.dotcounty = filters.regionName;
      } else if (filters.filterRegion === "city") {
        params.townname = filters.regionName;
      }
    }
    
    if (filters.dateRange?.start && filters.dateRange?.end) {
      params.dateStart = filters.dateRange.start;
      params.dateEnd = filters.dateRange.end;
    }
    
    if (filters.useTimeFilter && filters.timeRange?.start && filters.timeRange?.end) {
      params.timeStart = filters.timeRange.start;
      params.timeEnd = filters.timeRange.end;
    }
    
    if (filters.dayOfWeek) {
      params.dayofweek = filters.dayOfWeek;
    }
    
    if (filters.roadName) {
      params.onroadname = filters.roadName;
    }
    
    if (filters.intersectingRoad) {
      params.inroadname = filters.intersectingRoad;
    }
    
    if (filters.injuryLevel) {
      params.highestinj = filters.injuryLevel;
    }
    
    if (filters.alcoholDrugs) {
      params.crshalcdrg = filters.alcoholDrugs;
    }
    
    if (filters.lightCondition) {
      params.lightcond = filters.lightCondition;
    }
    
    if (filters.weatherCondition) {
      params.weathcond = filters.weatherCondition;
    }
    
    if (filters.roadSurfaceCondition) {
      params.rdsurfcond = filters.roadSurfaceCondition;
    }
    
    if (filters.direction) {
      params.refdirect = filters.direction;
    }
    
    if (filters.damageMin) {
      params.damageMin = filters.damageMin;
    }
    
    if (filters.damageMax) {
      params.damageMax = filters.damageMax;
    }
    
    // Boolean filters - only add if true
    if (filters.aggressiveDriving) {
      params.fl_aggrsv = "Y";
    }
    
    if (filters.pedestrianInvolved) {
      params.fl_vru_ped = "Y";
    }
    
    if (filters.bicycleInvolved) {
      params.fl_vru_bik = "Y";
    }
    
    if (filters.motorcycleInvolved) {
      params.fl_vru_mot = "Y";
    }
    
    if (filters.teenInvolved) {
      params.fl_ar_teen = "Y";
    }
    
    if (filters.elderlyInvolved) {
      params.fl_ar_ag = "Y";
    }
    
    if (filters.impaired) {
      params.flag_imp = "Y";
    }
    
    return params;
  };

  // FILTERS - Modified to handle all the new filters
  const applyFilters = async (filters) => {
    if (!mapRef.current) return;

    setIsLoading(true);
    try {
      // Update advanced filters state with values from FiltersButton component
      if (filters) {
        setAdvancedFilters({
          dayOfWeek: filters.dayOfWeek || "",
          roadName: filters.roadName || "",
          intersectingRoad: filters.intersectingRoad || "",
          injuryLevel: filters.injuryLevel || "",
          alcoholDrugs: filters.alcoholDrugs || "",
          lightCondition: filters.lightCondition || "",
          weatherCondition: filters.weatherCondition || "",
          roadSurfaceCondition: filters.roadSurfaceCondition || "",
          aggressiveDriving: filters.aggressiveDriving || false,
          pedestrianInvolved: filters.pedestrianInvolved || false,
          bicycleInvolved: filters.bicycleInvolved || false,
          motorcycleInvolved: filters.motorcycleInvolved || false,
          teenInvolved: filters.teenInvolved || false,
          elderlyInvolved: filters.elderlyInvolved || false,
          impaired: filters.impaired || false,
          direction: filters.direction || "",
          damageMin: filters.damageMin || "",
          damageMax: filters.damageMax || ""
        });
      }

      // Set map refresh flag to true
      setMapShouldRefresh(true);

      // Build query params from all filters
      const queryParams = buildQueryParams(filters || {
        filterRegion,
        regionName,
        dateRange,
        timeRange,
        useTimeFilter,
        ...advancedFilters
      });

      // Pass the query params to the map for fetching data
      if (mapRef.current.fetchFilteredData) {
        await mapRef.current.fetchFilteredData(queryParams);
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

  // Reset filters - Modified to reset all filters
  const resetFilters = () => {
    // Reset basic filters
    setDateRange({ start: "", end: "" });
    setTimeRange({ start: "", end: "" });
    setUseTimeFilter(false);
    setLocationRadius("");
    setFilterRegion("state");
    setRegionName("");
    
    // Reset advanced filters
    setAdvancedFilters({
      dayOfWeek: "",
      roadName: "",
      intersectingRoad: "",
      injuryLevel: "",
      alcoholDrugs: "",
      lightCondition: "",
      weatherCondition: "",
      roadSurfaceCondition: "",
      aggressiveDriving: false,
      pedestrianInvolved: false,
      bicycleInvolved: false,
      motorcycleInvolved: false,
      teenInvolved: false,
      elderlyInvolved: false,
      impaired: false,
      direction: "",
      damageMin: "",
      damageMax: ""
    });

    // Set map refresh flag to true
    setMapShouldRefresh(true);

    if (mapRef.current && mapRef.current.fetchCrashData) {
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
        {/* FILTERS BUTTON */}
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

        {/* ABOUT BUTTON */}
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
            advancedFilters={advancedFilters}
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
          advancedFilters={advancedFilters}
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
        Created by: Chris Medrano, Gabriel Giani, Leonardo Silva &amp; Gavin
        West
      </footer>
    </div>
  );
}