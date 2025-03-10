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
  const [activeTab, setActiveTab] = useState("basic"); // "basic" or "advanced"
  const filtersRef = useRef(null);
  
  // Create local state copies to prevent map refreshes while editing filters
  const [localFilterRegion, setLocalFilterRegion] = useState(filterRegion);
  const [localRegionName, setLocalRegionName] = useState(regionName);
  const [localDateRange, setLocalDateRange] = useState(dateRange);
  const [localTimeRange, setLocalTimeRange] = useState(timeRange);
  const [localUseTimeFilter, setLocalUseTimeFilter] = useState(useTimeFilter);
  const [localLocationRadius, setLocalLocationRadius] = useState(locationRadius);
  
  // Additional filter states for basic filters
  const [localDayOfWeek, setLocalDayOfWeek] = useState("");
  const [localRoadName, setLocalRoadName] = useState("");
  const [localIntersectingRoad, setLocalIntersectingRoad] = useState("");
  
  // Additional filter states for advanced filters
  const [localInjuryLevel, setLocalInjuryLevel] = useState("");
  const [localAlcoholDrugs, setLocalAlcoholDrugs] = useState("");
  const [localLightCondition, setLocalLightCondition] = useState("");
  const [localWeatherCondition, setLocalWeatherCondition] = useState("");
  const [localRoadSurfaceCondition, setLocalRoadSurfaceCondition] = useState("");
  const [localAggressiveDriving, setLocalAggressiveDriving] = useState(false);
  const [localPedestrianInvolved, setLocalPedestrianInvolved] = useState(false);
  const [localBicycleInvolved, setLocalBicycleInvolved] = useState(false);
  const [localMotorcycleInvolved, setLocalMotorcycleInvolved] = useState(false);
  const [localTeenInvolved, setLocalTeenInvolved] = useState(false);
  const [localElderlyInvolved, setLocalElderlyInvolved] = useState(false);
  const [localImpaired, setLocalImpaired] = useState(false);
  const [localDirection, setLocalDirection] = useState("");
  const [localDamageMin, setLocalDamageMin] = useState("");
  const [localDamageMax, setLocalDamageMax] = useState("");
  
  // Sync local state with props when menu opens
  useEffect(() => {
    if (showFilters) {
      setLocalFilterRegion(filterRegion);
      setLocalRegionName(regionName);
      setLocalDateRange(dateRange);
      setLocalTimeRange(timeRange);
      setLocalUseTimeFilter(useTimeFilter);
      setLocalLocationRadius(locationRadius);
      // Reset additional filters when opening menu
      // We'll add state preservation for these later if needed
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

  // Toggle filter menu with event propagation stopped
  const toggleFilters = (e) => {
    e.stopPropagation();
    setShowFilters(!showFilters);
  };

  // Handle region change without refreshing map (using local state)
  const handleRegionChange = (region, name) => {
    setLocalFilterRegion(region);
    setLocalRegionName(name);
  };

  // Handle tab change
  const changeTab = (tab) => {
    setActiveTab(tab);
  };

  // Toggle switch component for boolean filters
  const ToggleSwitch = ({ label, isChecked, onChange }) => {
    return (
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(!isChecked);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isChecked ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isChecked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    );
  };

  // Day of week options
  const dayOfWeekOptions = [
    { value: "", label: "Any day" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
    { value: "7", label: "Sunday" }
  ];

  // Injury level options
  const injuryLevelOptions = [
    { value: "", label: "Any injury level" },
    { value: "1", label: "No injury" },
    { value: "2", label: "Possible injury" },
    { value: "3", label: "Non-incapacitating injury" },
    { value: "4", label: "Incapacitating injury" },
    { value: "5", label: "Fatal injury" }
  ];

  // Alcohol/drugs options
  const alcoholDrugsOptions = [
    { value: "", label: "Any" },
    { value: "0", label: "None" },
    { value: "1", label: "Alcohol involved" },
    { value: "2", label: "Drugs involved" },
    { value: "3", label: "Alcohol and drugs involved" }
  ];

  // Light condition options
  const lightConditionOptions = [
    { value: "", label: "Any light condition" },
    { value: "01", label: "Daylight" },
    { value: "02", label: "Dusk" },
    { value: "03", label: "Dawn" },
    { value: "04", label: "Dark (street lights)" },
    { value: "05", label: "Dark (no street lights)" }
  ];

  // Weather condition options
  const weatherConditionOptions = [
    { value: "", label: "Any weather" },
    { value: "01", label: "Clear" },
    { value: "02", label: "Cloudy" },
    { value: "03", label: "Rain" },
    { value: "04", label: "Fog" },
    { value: "77", label: "Other" }
  ];

  // Road surface options
  const roadSurfaceOptions = [
    { value: "", label: "Any road condition" },
    { value: "01", label: "Dry" },
    { value: "02", label: "Wet" },
    { value: "03", label: "Slippery" },
    { value: "04", label: "Icy" },
    { value: "77", label: "Other" }
  ];

  // Direction options
  const directionOptions = [
    { value: "", label: "Any direction" },
    { value: "N", label: "North" },
    { value: "E", label: "East" },
    { value: "S", label: "South" },
    { value: "W", label: "West" },
    { value: "NE", label: "Northeast" },
    { value: "SE", label: "Southeast" },
    { value: "SW", label: "Southwest" },
    { value: "NW", label: "Northwest" }
  ];

  // Handle the Apply button click - update parent state and trigger filter application
  const handleApply = (e) => {
    e.stopPropagation();
    
    // Prepare filter object with all filter values
    const filters = {
      filterRegion: localFilterRegion,
      regionName: localRegionName,
      dateRange: localDateRange,
      timeRange: localTimeRange,
      useTimeFilter: localUseTimeFilter,
      locationRadius: localLocationRadius,
      dayOfWeek: localDayOfWeek,
      roadName: localRoadName,
      intersectingRoad: localIntersectingRoad,
      injuryLevel: localInjuryLevel,
      alcoholDrugs: localAlcoholDrugs,
      lightCondition: localLightCondition,
      weatherCondition: localWeatherCondition,
      roadSurfaceCondition: localRoadSurfaceCondition,
      aggressiveDriving: localAggressiveDriving,
      pedestrianInvolved: localPedestrianInvolved,
      bicycleInvolved: localBicycleInvolved,
      motorcycleInvolved: localMotorcycleInvolved,
      teenInvolved: localTeenInvolved,
      elderlyInvolved: localElderlyInvolved,
      impaired: localImpaired,
      direction: localDirection,
      damageMin: localDamageMin,
      damageMax: localDamageMax
    };
    
    // Update basic parent state
    setFilterRegion(localFilterRegion);
    setRegionName(localRegionName);
    setDateRange(localDateRange);
    setTimeRange(localTimeRange);
    setUseTimeFilter(localUseTimeFilter);
    setLocationRadius(localLocationRadius);
    
    // Now trigger the apply function from parent with the full filters object
    applyFilters(filters);
    setShowFilters(false);
  };

  // Handle the Reset button click
  const handleReset = (e) => {
    e.stopPropagation();
    
    // Reset all local state
    setLocalFilterRegion("state");
    setLocalRegionName("");
    setLocalDateRange({ start: "", end: "" });
    setLocalTimeRange({ start: "", end: "" });
    setLocalUseTimeFilter(false);
    setLocalLocationRadius("");
    setLocalDayOfWeek("");
    setLocalRoadName("");
    setLocalIntersectingRoad("");
    setLocalInjuryLevel("");
    setLocalAlcoholDrugs("");
    setLocalLightCondition("");
    setLocalWeatherCondition("");
    setLocalRoadSurfaceCondition("");
    setLocalAggressiveDriving(false);
    setLocalPedestrianInvolved(false);
    setLocalBicycleInvolved(false);
    setLocalMotorcycleInvolved(false);
    setLocalTeenInvolved(false);
    setLocalElderlyInvolved(false);
    setLocalImpaired(false);
    setLocalDirection("");
    setLocalDamageMin("");
    setLocalDamageMax("");
    
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
            className="absolute top-full left-0 mt-2 bg-gray-100 text-gray-800 rounded-xl shadow-lg p-4 z-50"
            style={{ width: activeTab === "basic" ? "400px" : "600px", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing up */}
            <div
              className="absolute -top-2 left-8 w-0 h-0
              border-l-[8px] border-r-[8px] border-b-[8px] 
              border-l-transparent border-r-transparent
              border-b-gray-100"
            />

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-300 mb-4">
              <button
                className={`py-2 px-4 font-medium ${
                  activeTab === "basic"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => changeTab("basic")}
              >
                Basic
              </button>
              <button
                className={`py-2 px-4 font-medium ${
                  activeTab === "advanced"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => changeTab("advanced")}
              >
                Advanced
              </button>
            </div>

            {/* Basic Filters Tab */}
            {activeTab === "basic" && (
              <div>
                <h2 className="font-bold text-lg mb-3">Location Filters</h2>

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

                {/* Location Radius */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Radius (km):
                  </label>
                  <input
                    type="number"
                    placeholder="Enter radius in kilometers"
                    className="border rounded p-2 w-full"
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
                
                <h2 className="font-bold text-lg mb-3 mt-6">Time Filters</h2>

                {/* Date Range */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Date Range:
                  </label>
                  <div className="flex gap-2">
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
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={localUseTimeFilter}
                      onChange={(e) => {
                        e.stopPropagation();
                        setLocalUseTimeFilter(e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                      id="time-filter-checkbox"
                    />
                    <label htmlFor="time-filter-checkbox" className="font-medium text-gray-700">
                      Time Range:
                    </label>
                  </div>
                  <div className="flex gap-2">
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
                
                {/* Day of Week */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Day of Week:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localDayOfWeek}
                    onChange={(e) => setLocalDayOfWeek(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {dayOfWeekOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <h2 className="font-bold text-lg mb-3 mt-6">Road Filters</h2>
                
                {/* Road Name */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Road Name:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter road name"
                    className="border rounded p-2 w-full"
                    value={localRoadName}
                    onChange={(e) => setLocalRoadName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {/* Intersecting Road */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Intersecting Road:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter intersecting road name"
                    className="border rounded p-2 w-full"
                    value={localIntersectingRoad}
                    onChange={(e) => setLocalIntersectingRoad(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {/* Advanced Filters Tab */}
            {activeTab === "advanced" && (
              <div>
                <h2 className="font-bold text-lg mb-3">Crash Characteristics</h2>
                
                {/* Injury Level */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Highest Injury Level:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localInjuryLevel}
                    onChange={(e) => setLocalInjuryLevel(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {injuryLevelOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Alcohol/Drugs */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Alcohol/Drugs Involvement:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localAlcoholDrugs}
                    onChange={(e) => setLocalAlcoholDrugs(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {alcoholDrugsOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Direction */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Travel Direction:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localDirection}
                    onChange={(e) => setLocalDirection(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {directionOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Total Crash Damage */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Total Crash Damage ($):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="border rounded p-2 flex-1"
                      value={localDamageMin}
                      onChange={(e) => setLocalDamageMin(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      min="0"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      className="border rounded p-2 flex-1"
                      value={localDamageMax}
                      onChange={(e) => setLocalDamageMax(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      min="0"
                    />
                  </div>
                </div>
                
                <h2 className="font-bold text-lg mb-3 mt-6">Environmental Conditions</h2>
                
                {/* Light Condition */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Light Condition:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localLightCondition}
                    onChange={(e) => setLocalLightCondition(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lightConditionOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Weather Condition */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Weather Condition:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localWeatherCondition}
                    onChange={(e) => setLocalWeatherCondition(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {weatherConditionOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Road Surface Condition */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-2">
                    Road Surface Condition:
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={localRoadSurfaceCondition}
                    onChange={(e) => setLocalRoadSurfaceCondition(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {roadSurfaceOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <h2 className="font-bold text-lg mb-3 mt-6">Participant Factors</h2>
                
                {/* Toggle Switches for boolean filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <ToggleSwitch 
                      label="Aggressive Driving" 
                      isChecked={localAggressiveDriving} 
                      onChange={setLocalAggressiveDriving} 
                    />
                    
                    <ToggleSwitch 
                      label="Pedestrian Involved" 
                      isChecked={localPedestrianInvolved} 
                      onChange={setLocalPedestrianInvolved} 
                    />
                    
                    <ToggleSwitch 
                      label="Bicycle Involved" 
                      isChecked={localBicycleInvolved} 
                      onChange={setLocalBicycleInvolved} 
                    />
                  </div>
                  
                  <div>
                    <ToggleSwitch 
                      label="Motorcycle Involved" 
                      isChecked={localMotorcycleInvolved} 
                      onChange={setLocalMotorcycleInvolved} 
                    />
                    
                    <ToggleSwitch 
                      label="Teen Driver Involved" 
                      isChecked={localTeenInvolved} 
                      onChange={setLocalTeenInvolved} 
                    />
                    
                    <ToggleSwitch 
                      label="Elderly Driver Involved" 
                      isChecked={localElderlyInvolved} 
                      onChange={setLocalElderlyInvolved} 
                    />
                    
                    <ToggleSwitch 
                      label="Impaired Driver" 
                      isChecked={localImpaired} 
                      onChange={setLocalImpaired} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons (shown for both tabs) */}
            <div className="flex gap-2 mt-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-red-500 text-white flex-1 py-2 rounded hover:bg-red-600"
                onClick={handleReset}
              >
                Reset All
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-green-500 text-white flex-1 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                onClick={handleApply}
                disabled={isLoading}
              >
                {isLoading ? "Applying..." : "Apply Filters"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}