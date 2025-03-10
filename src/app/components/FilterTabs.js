"use client";

import React, { useState } from "react";
import { useAccidentContext } from "@/context/accidentContext";
import RegionSelector from "./RegionSelector";

export default function FilterTabs({ localFilters, setLocalFilters }) {
  const [activeTab, setActiveTab] = useState("basic");
  const { counties, cities } = useAccidentContext();

  // Update a single filter value
  const updateLocalFilter = (name, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle region type change
  const handleRegionChange = (region, name) => {
    setLocalFilters(prev => ({
      ...prev,
      filterRegion: region,
      regionName: name
    }));
  };

  // Data for filter options
  const filterOptions = {
    dayOfWeek: [
      { value: "", label: "Any day" },
      { value: "1", label: "Monday" },
      { value: "2", label: "Tuesday" },
      { value: "3", label: "Wednesday" },
      { value: "4", label: "Thursday" },
      { value: "5", label: "Friday" },
      { value: "6", label: "Saturday" },
      { value: "7", label: "Sunday" }
    ],
    injuryLevel: [
      { value: "", label: "Any injury level" },
      { value: "1", label: "No injury" },
      { value: "2", label: "Possible injury" },
      { value: "3", label: "Non-incapacitating injury" },
      { value: "4", label: "Incapacitating injury" },
      { value: "5", label: "Fatal injury" }
    ],
    alcoholDrugs: [
      { value: "", label: "Any" },
      { value: "0", label: "None" },
      { value: "1", label: "Alcohol involved" },
      { value: "2", label: "Drugs involved" },
      { value: "3", label: "Alcohol and drugs involved" }
    ],
    lightCondition: [
      { value: "", label: "Any light condition" },
      { value: "01", label: "Daylight" },
      { value: "02", label: "Dusk" },
      { value: "03", label: "Dawn" },
      { value: "04", label: "Dark (street lights)" },
      { value: "05", label: "Dark (no street lights)" }
    ],
    weatherCondition: [
      { value: "", label: "Any weather" },
      { value: "01", label: "Clear" },
      { value: "02", label: "Cloudy" },
      { value: "03", label: "Rain" },
      { value: "04", label: "Fog" },
      { value: "77", label: "Other" }
    ],
    roadSurfaceCondition: [
      { value: "", label: "Any road condition" },
      { value: "01", label: "Dry" },
      { value: "02", label: "Wet" },
      { value: "03", label: "Slippery" },
      { value: "04", label: "Icy" },
      { value: "77", label: "Other" }
    ],
    direction: [
      { value: "", label: "Any direction" },
      { value: "N", label: "North" },
      { value: "E", label: "East" },
      { value: "S", label: "South" },
      { value: "W", label: "West" },
      { value: "NE", label: "Northeast" },
      { value: "SE", label: "Southeast" },
      { value: "SW", label: "Southwest" },
      { value: "NW", label: "Northwest" }
    ]
  };

  // Toggle switch component for boolean filters
  const ToggleSwitch = ({ label, name }) => {
    const isChecked = localFilters[name];
    
    return (
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateLocalFilter(name, !isChecked);
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

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-300 mb-4">
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "basic"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("basic")}
        >
          Basic
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === "advanced"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("advanced")}
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
                  localFilters.filterRegion === "state"
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
                  localFilters.filterRegion === "county"
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
                  localFilters.filterRegion === "city"
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

            {localFilters.filterRegion !== "state" && (
              <RegionSelector
                regionType={localFilters.filterRegion}
                regionName={localFilters.regionName}
                onRegionChange={handleRegionChange}
                options={localFilters.filterRegion === "county" ? counties : cities}
              />
            )}
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-2">
              Date Range:
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                className="border rounded p-2 flex-1"
                value={localFilters.dateRange.start}
                onChange={(e) => {
                  const newDateRange = {
                    ...localFilters.dateRange,
                    start: e.target.value
                  };
                  updateLocalFilter("dateRange", newDateRange);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="date"
                className="border rounded p-2 flex-1"
                value={localFilters.dateRange.end}
                onChange={(e) => {
                  const newDateRange = {
                    ...localFilters.dateRange,
                    end: e.target.value
                  };
                  updateLocalFilter("dateRange", newDateRange);
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
                checked={localFilters.useTimeFilter}
                onChange={(e) => updateLocalFilter("useTimeFilter", e.target.checked)}
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
                value={localFilters.timeRange.start}
                onChange={(e) => {
                  const newTimeRange = {
                    ...localFilters.timeRange,
                    start: e.target.value
                  };
                  updateLocalFilter("timeRange", newTimeRange);
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={!localFilters.useTimeFilter}
              />
              <input
                type="time"
                className="border rounded p-2 flex-1"
                value={localFilters.timeRange.end}
                onChange={(e) => {
                  const newTimeRange = {
                    ...localFilters.timeRange,
                    end: e.target.value
                  };
                  updateLocalFilter("timeRange", newTimeRange);
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={!localFilters.useTimeFilter}
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
              value={localFilters.dayOfWeek}
              onChange={(e) => updateLocalFilter("dayOfWeek", e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {filterOptions.dayOfWeek.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Road Name */}
          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-2">
              Road Name:
            </label>
            <input
              type="text"
              placeholder="Enter road name"
              className="border rounded p-2 w-full"
              value={localFilters.roadName}
              onChange={(e) => updateLocalFilter("roadName", e.target.value)}
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
              value={localFilters.intersectingRoad}
              onChange={(e) => updateLocalFilter("intersectingRoad", e.target.value)}
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
              value={localFilters.injuryLevel}
              onChange={(e) => updateLocalFilter("injuryLevel", e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {filterOptions.injuryLevel.map(option => (
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
              value={localFilters.alcoholDrugs}
              onChange={(e) => updateLocalFilter("alcoholDrugs", e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {filterOptions.alcoholDrugs.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Environmental Conditions */}
          <h2 className="font-bold text-lg mb-3 mt-6">Environmental Conditions</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* Light Condition */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700 mb-2">Light:</label>
                <select
                  className="border rounded p-2 w-full"
                  value={localFilters.lightCondition}
                  onChange={(e) => updateLocalFilter("lightCondition", e.target.value)}
                >
                  {filterOptions.lightCondition.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              {/* Weather Condition */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700 mb-2">Weather:</label>
                <select
                  className="border rounded p-2 w-full"
                  value={localFilters.weatherCondition}
                  onChange={(e) => updateLocalFilter("weatherCondition", e.target.value)}
                >
                  {filterOptions.weatherCondition.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Road Surface + Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* Road Surface */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700 mb-2">Road Surface:</label>
                <select
                  className="border rounded p-2 w-full"
                  value={localFilters.roadSurfaceCondition}
                  onChange={(e) => updateLocalFilter("roadSurfaceCondition", e.target.value)}
                >
                  {filterOptions.roadSurfaceCondition.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              {/* Direction */}
              <div className="mb-4">
                <label className="block font-medium text-gray-700 mb-2">Direction:</label>
                <select
                  className="border rounded p-2 w-full"
                  value={localFilters.direction}
                  onChange={(e) => updateLocalFilter("direction", e.target.value)}
                >
                  {filterOptions.direction.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Participant Factors */}
          <h2 className="font-bold text-lg mb-3 mt-6">Participant Factors</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ToggleSwitch label="Aggressive Driving" name="aggressiveDriving" />
              <ToggleSwitch label="Pedestrian Involved" name="pedestrianInvolved" />
              <ToggleSwitch label="Bicycle Involved" name="bicycleInvolved" />
              <ToggleSwitch label="Motorcycle Involved" name="motorcycleInvolved" />
            </div>
            
            <div>
              <ToggleSwitch label="Teen Driver Involved" name="teenInvolved" />
              <ToggleSwitch label="Elderly Driver Involved" name="elderlyInvolved" />
              <ToggleSwitch label="Impaired Driver" name="impaired" />
            </div>
          </div>
          
          {/* Damage amount */}
          <h2 className="font-bold text-lg mb-3 mt-6">Damage</h2>
          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-2">
              Total Crash Damage ($):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                className="border rounded p-2 flex-1"
                value={localFilters.damageMin}
                onChange={(e) => updateLocalFilter("damageMin", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                min="0"
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                className="border rounded p-2 flex-1"
                value={localFilters.damageMax}
                onChange={(e) => updateLocalFilter("damageMax", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                min="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}