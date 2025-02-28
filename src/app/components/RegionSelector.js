"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, getUniqueColumnValues } from "../supabaseClient";

// County code mapping
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
        console.log("Fetching unique county codes...");
        try {
          // Get unique county codes
          const uniqueCountyCodes = await getUniqueColumnValues(
            "ultimate-table",
            "dotcounty",
            {
              limit: 100, // We don't need too many, there are only 67 counties in Florida
              cacheTTL: 3600000, // Cache for 1 hour
            }
          );

          console.log("Unique county codes:", uniqueCountyCodes);

          // Map codes to county names
          const countyNames = uniqueCountyCodes
            .map((code) => COUNTY_CODES[code])
            .filter(Boolean)
            .sort();

          console.log("Mapped county names:", countyNames.length);
          setCounties(countyNames);
        } catch (countyFetchError) {
          console.error("County fetch failed:", countyFetchError);
          // Set default counties using the mapping
          const defaultCounties = Object.values(COUNTY_CODES)
            .slice(0, 10)
            .sort();
          console.log("Using default counties:", defaultCounties);
          setCounties(defaultCounties);
        }

        // Fetch cities
        console.log("Fetching unique city names...");
        try {
          // Get unique city names
          const uniqueCities = await getUniqueColumnValues(
            "ultimate-table",
            "townname",
            {
              limit: 500, // Get a reasonable number of cities
              cacheTTL: 3600000, // Cache for 1 hour
            }
          );

          console.log("Unique cities:", uniqueCities.length);
          setCities(uniqueCities.sort());
        } catch (cityFetchError) {
          console.error("City fetch failed:", cityFetchError);
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
          console.log("Using default cities:", defaultCities);
          setCities(defaultCities);
        }
      } catch (error) {
        console.error("Error fetching regions:", error);
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

        console.log("Using default values for counties and cities");
        setCounties(defaultCounties);
        setCities(defaultCities);
      } finally {
        setLoading(false);
      }
    }

    fetchRegions();
  }, []);

  // Handle region type change
  const handleRegionTypeChange = (regionType) => {
    setSelectedRegion(regionType);
    setSelectedRegionName("");
    onRegionChange(regionType, "");
  };

  // Handle region name selection
  const handleRegionNameChange = (name) => {
    setSelectedRegionName(name);

    // If it's a county, pass the county code instead of the name
    if (selectedRegion === "county") {
      const countyCode = COUNTY_NAMES_TO_CODES[name];
      console.log(`Selected county: ${name}, code: ${countyCode}`);
      onRegionChange(selectedRegion, countyCode);
    } else {
      onRegionChange(selectedRegion, name);
    }

    setExpanded(false);
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

  return (
    <div className="absolute top-16 left-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden"
      >
        <div
          className="p-3 font-bold border-b border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <h3>
            {selectedRegion === "state"
              ? "Florida State"
              : selectedRegionName
              ? `${selectedRegionName} ${selectedRegion}`
              : `Select ${selectedRegion}`}
          </h3>
          <button className="text-gray-400 hover:text-white">
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
                    onClick={() => handleRegionTypeChange("state")}
                  >
                    State
                  </button>
                  <button
                    className={`px-3 py-1 rounded ${
                      selectedRegion === "county"
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={() => handleRegionTypeChange("county")}
                  >
                    County
                  </button>
                  <button
                    className={`px-3 py-1 rounded ${
                      selectedRegion === "city"
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={() => handleRegionTypeChange("city")}
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
                      onChange={(e) => setSearchTerm(e.target.value)}
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
                            onClick={() => handleRegionNameChange(name)}
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
