"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RegionSelector from "./RegionSelector";

export default function FiltersButton({
  filterRegion,
  setFilterRegion,
  regionName,
  setRegionName,
  dateRange,
  setDateRange,
  timeRange,
  setTimeRange,
  useTimeFilter,
  setUseTimeFilter,
  locationRadius,
  setLocationRadius,
  applyFilters,
  resetFilters,
  isLoading
}) {
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);
  
  // Create local state copies to prevent map refreshes
  const [localFilterRegion, setLocalFilterRegion] = useState(filterRegion);
  const [localRegionName, setLocalRegionName] = useState(regionName);
  const [localDateRange, setLocalDateRange] = useState(dateRange);
  const [localTimeRange, setLocalTimeRange] = useState(timeRange);
  const [localUseTimeFilter, setLocalUseTimeFilter] = useState(useTimeFilter);
  const [localLocationRadius, setLocalLocationRadius] = useState(locationRadius);
  
  // Sync local state with props when menu opens
  useEffect(() => {
    if (showFilters) {
      setLocalFilterRegion(filterRegion);
      setLocalRegionName(regionName);
      setLocalDateRange(dateRange);
      setLocalTimeRange(timeRange);
      setLocalUseTimeFilter(useTimeFilter);
      setLocalLocationRadius(locationRadius);
    }
  }, [showFilters, filterRegion, regionName, dateRange, timeRange, useTimeFilter, locationRadius]);

  // Handle clicks outside of filters menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (showFilters && filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters]);

  // Open filter menu with event propagation stopped
  const toggleFilters = (e) => {
    e.stopPropagation();
    setShowFilters(!showFilters);
  };

  // Handle region change without refreshing map (using local state)
  const handleRegionChange = (region, name) => {
    setLocalFilterRegion(region);
    setLocalRegionName(name);
  };

  // Handle the Apply button click - only now do we update parent state
  const handleApply = (e) => {
    e.stopPropagation();
    
    // Update all parent state at once
    setFilterRegion(localFilterRegion);
    setRegionName(localRegionName);
    setDateRange(localDateRange);
    setTimeRange(localTimeRange);
    setUseTimeFilter(localUseTimeFilter);
    setLocationRadius(localLocationRadius);
    
    // Now trigger the apply function from parent
    applyFilters();
    setShowFilters(false);
  };

  // Handle the Reset button click
  const handleReset = (e) => {
    e.stopPropagation();
    resetFilters();
    setShowFilters(false);
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded relative z-10"
        onClick={toggleFilters}
      >
        Filters
      </motion.button>

      {/* FILTERS POPUP */}
      <AnimatePresence mode="wait">
        {showFilters && (
          <motion.div
            key="filters-popup"
            ref={filtersRef}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-96 bg-gray-100 text-gray-800 rounded-xl shadow-lg p-4 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing up */}
            <div
              className="absolute -top-2 left-8 w-0 h-0
              border-l-[8px] border-r-[8px] border-b-[8px] 
              border-l-transparent border-r-transparent
              border-b-gray-100"
            />

            <h2 className="font-bold text-lg mb-3">Filters</h2>

            {/* Region Selection */}
            <div className="mb-4">
              <label className="block font-medium text-gray-700 mb-2">
                Region:
              </label>
              <div className="flex space-x-2 mb-2">
                <button
                  className={`px-3 py-1 rounded ${
                    localFilterRegion === "state"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRegionChange("state", "");
                  }}
                >
                  State
                </button>
                <button
                  className={`px-3 py-1 rounded ${
                    localFilterRegion === "county"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRegionChange("county", "");
                  }}
                >
                  County
                </button>
                <button
                  className={`px-3 py-1 rounded ${
                    localFilterRegion === "city"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRegionChange("city", "");
                  }}
                >
                  City
                </button>
              </div>

              {localFilterRegion !== "state" && (
                <RegionSelector
                  onRegionChange={handleRegionChange}
                  initialRegion={localFilterRegion}
                  initialRegionName={localRegionName}
                  inFiltersMenu={true}
                />
              )}
            </div>

            {/* Date Range */}
            <div className="mb-4">
              <label className="block font-medium text-gray-700">
                Date Range:
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  className="border rounded p-2 flex-1"
                  value={localDateRange.start}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLocalDateRange({ ...localDateRange, start: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="date"
                  className="border rounded p-2 flex-1"
                  value={localDateRange.end}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLocalDateRange({ ...localDateRange, end: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Time Range */}
            <div className="mb-4">
              <label className="block font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localUseTimeFilter}
                    onChange={(e) => {
                      e.stopPropagation();
                      setLocalUseTimeFilter(e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300"
                  />
                  Time Range:
                </div>
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  type="time"
                  className="border rounded p-2 flex-1"
                  value={localTimeRange.start}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLocalTimeRange({ ...localTimeRange, start: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!localUseTimeFilter}
                />
                <input
                  type="time"
                  className="border rounded p-2 flex-1"
                  value={localTimeRange.end}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLocalTimeRange({ ...localTimeRange, end: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!localUseTimeFilter}
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
                value={localLocationRadius}
                onChange={(e) => {
                  e.stopPropagation();
                  setLocalLocationRadius(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
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
                onClick={handleReset}
              >
                Reset
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-green-500 text-white flex-1 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                onClick={handleApply}
                disabled={isLoading}
              >
                {isLoading ? "Applying..." : "Apply"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}