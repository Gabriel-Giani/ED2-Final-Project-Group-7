"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, getUniqueColumnValues } from "../supabaseClient";

const COUNTY_CODES = {
  "01": "Charlotte",
  "02": "Citrus",
  "03": "Collier",
  "04": "Desoto",
  "05": "Glades",
  "06": "Hardee",
  "07": "Hendry",
  "08": "Hernando",
  "09": "Highlands",
  10: "Hillsborough",
  11: "Lake",
  12: "Lee",
  13: "Manatee",
  14: "Pasco",
  15: "Pinellas",
  16: "Polk",
  17: "Sarasota",
  18: "Sumter",
  26: "Alachua",
  27: "Baker",
  28: "Bradford",
  29: "Columbia",
  30: "Dixie",
  31: "Gilchrist",
  32: "Hamilton",
  33: "Lafayette",
  34: "Levy",
  35: "Madison",
  36: "Marion",
  37: "Suwannee",
  38: "Taylor",
  39: "Union",
  46: "Bay",
  47: "Calhoun",
  48: "Escambia",
  49: "Franklin",
  50: "Gadsden",
  51: "Gulf",
  52: "Holmes",
  53: "Jackson",
  54: "Jefferson",
  55: "Leon",
  56: "Liberty",
  57: "Okaloosa",
  58: "Santa Rosa",
  59: "Wakulla",
  60: "Walton",
  61: "Washington",
  70: "Brevard",
  71: "Clay",
  72: "Duval",
  73: "Flagler",
  74: "Nassau",
  75: "Orange",
  76: "Putnam",
  77: "Seminole",
  78: "St Johns",
  79: "Volusia",
  86: "Broward",
  87: "Miami-Dade",
  88: "Indian River",
  89: "Martin",
  90: "Monroe",
  91: "Okeechobee",
  92: "Osceola",
  93: "Palm Beach",
  94: "St Lucie",
};

// Reverse mapping for lookup by name
const COUNTY_NAMES_TO_CODES = Object.entries(COUNTY_CODES).reduce(
  (acc, [code, name]) => {
    acc[name] = code;
    return acc;
  },
  {}
);

export default function RegionSelector({
  onRegionChange = () => {},
  initialRegion = null,
  initialRegionName = null,
  inFiltersMenu = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(
    initialRegion || "state"
  );
  const [selectedRegionName, setSelectedRegionName] = useState(
    initialRegionName || ""
  );
  const [counties, setCounties] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch counties and cities on component mount
  useEffect(() => {
    async function fetchRegions() {
      setLoading(true);
      try {
        console.log("Fetching regions...");

        // Fetch counties using dotcounty codes
        try {
          // Get unique county codes
          const uniqueCountyCodes = await getUniqueColumnValues(
            "ultimate-table",
            "dotcounty",
            {
              limit: 100,
              cacheTTL: 3600000, // Cache for 1 hour
            }
          );

          // Map codes to county names
          const countyNames = uniqueCountyCodes
            .map((code) => COUNTY_CODES[code])
            .filter(Boolean)
            .sort();

          setCounties(countyNames);
        } catch (countyFetchError) {
          // Set default counties using the mapping
          const defaultCounties = Object.values(COUNTY_CODES)
            .slice(0, 10)
            .sort();
          setCounties(defaultCounties);
        }

        // Fetch cities
        try {
          // Get unique city names
          const uniqueCities = await getUniqueColumnValues(
            "ultimate-table",
            "townname",
            {
              limit: 500,
              cacheTTL: 3600000, // Cache for 1 hour
            }
          );

          setCities(uniqueCities.sort());
        } catch (cityFetchError) {
          // Set default cities
          const defaultCities = [
            "Miami",
            "Orlando",
            "Tampa",
            "Jacksonville",
            "Fort Lauderdale",
            "Tallahassee",
            "Gainesville",
            "Pensacola",
            "Sarasota",
            "Naples",
          ];
          setCities(defaultCities);
        }
      } catch (error) {
        // Set some default values in case of error
        const defaultCounties = Object.values(COUNTY_CODES).slice(0, 10).sort();
        const defaultCities = [
          "Miami",
          "Orlando",
          "Tampa",
          "Jacksonville",
          "Fort Lauderdale",
          "Tallahassee",
          "Gainesville",
          "Pensacola",
          "Sarasota",
          "Naples",
        ];

        setCounties(defaultCounties);
        setCities(defaultCities);
      } finally {
        setLoading(false);
      }
    }

    fetchRegions();
  }, []);

  // Update local state when props change
  useEffect(() => {
    if (initialRegion) {
      setSelectedRegion(initialRegion);
    }
    if (initialRegionName) {
      setSelectedRegionName(initialRegionName);
    }
  }, [initialRegion, initialRegionName]);
  
  // Handle region type change - ONLY update local state
  const handleRegionTypeChange = (regionType, e) => {
    if (e) e.stopPropagation();
    setSelectedRegion(regionType);
    setSelectedRegionName("");
    
    // Pass to parent (which is using local state)
    onRegionChange(regionType, "");
  };

  // Handle region name selection - ONLY update local state
  const handleRegionNameChange = (name, e) => {
    if (e) e.stopPropagation();
    setSelectedRegionName(name);

    // Get county code if needed
    let valueToPass = name;
    if (selectedRegion === "county") {
      valueToPass = COUNTY_NAMES_TO_CODES[name] || name;
    }
    
    // Pass to parent (which is using local state)
    onRegionChange(selectedRegion, valueToPass);
    setExpanded(false);
  };

  // Toggle expanded state with propagation stopped
  const toggleExpanded = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  // Handle search input with propagation stopped
  const handleSearchChange = (e) => {
    e.stopPropagation();
    setSearchTerm(e.target.value);
  };

  // Filter regions based on search term
  const filteredRegions = () => {
    const searchTermLower = searchTerm.toLowerCase();
    if (selectedRegion === "county") {
      return counties.filter((county) =>
        county.toLowerCase().includes(searchTermLower)
      );
    } else if (selectedRegion === "city") {
      return cities.filter((city) =>
        city.toLowerCase().includes(searchTermLower)
      );
    }
    return [];
  };

  // If in filters menu, render a simplified version
  if (inFiltersMenu) {
    return (
      <div className="bg-gray-200 rounded p-3" onClick={(e) => e.stopPropagation()}>
        {/* Show the selected region name or prompt to select one */}
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium">
            {selectedRegionName
              ? `${selectedRegionName}`
              : `Select a ${selectedRegion}`}
          </div>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={toggleExpanded}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {/* Search box and results */}
        {expanded && (
          <div>
            <input
              type="text"
              placeholder={`Search ${selectedRegion}...`}
              className="w-full p-2 mb-2 bg-white border border-gray-300 rounded"
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
            />

            <div className="max-h-40 overflow-y-auto bg-white rounded border border-gray-300">
              {loading ? (
                <div className="p-2 text-center text-gray-500">Loading...</div>
              ) : filteredRegions().length > 0 ? (
                <ul>
                  {filteredRegions().map((name, index) => (
                    <li
                      key={index}
                      className={`p-2 hover:bg-gray-100 cursor-pointer ${
                        name === selectedRegionName ? "bg-blue-100" : ""
                      }`}
                      onClick={(e) => handleRegionNameChange(name, e)}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-2 text-center text-gray-500">
                  No {selectedRegion} found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Otherwise, render the original standalone version
  return (
    <div className="absolute top-16 left-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-3 font-bold border-b border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={toggleExpanded}
        >
          <h3>
            {selectedRegion === "state"
              ? "Florida State"
              : selectedRegionName
              ? `${selectedRegionName} ${selectedRegion}`
              : `Select ${selectedRegion}`}
          </h3>
          <button className="text-gray-400 hover:text-white" onClick={toggleExpanded}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-3 border-b border-gray-700">
                <div className="flex space-x-2">
                  <button
                    className={`px-3 py-1 rounded ${
                      selectedRegion === "state"
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={(e) => handleRegionTypeChange("state", e)}
                  >
                    State
                  </button>
                  <button
                    className={`px-3 py-1 rounded ${
                      selectedRegion === "county"
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={(e) => handleRegionTypeChange("county", e)}
                  >
                    County
                  </button>
                  <button
                    className={`px-3 py-1 rounded ${
                      selectedRegion === "city"
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={(e) => handleRegionTypeChange("city", e)}
                  >
                    City
                  </button>
                </div>
              </div>

              {selectedRegion !== "state" && (
                <>
                  <div className="p-3 border-b border-gray-700">
                    <input
                      type="text"
                      placeholder={`Search ${selectedRegion}...`}
                      className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-center text-gray-400">
                        Loading regions...
                      </div>
                    ) : filteredRegions().length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        No {selectedRegion} found
                      </div>
                    ) : (
                      <ul>
                        {filteredRegions().map((name, index) => (
                          <li
                            key={index}
                            className={`p-3 hover:bg-gray-800 cursor-pointer ${
                              name === selectedRegionName ? "bg-gray-800" : ""
                            }`}
                            onClick={(e) => handleRegionNameChange(name, e)}
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}