"use client";

import React, { useState } from "react";

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

// Comprehensive list of Florida cities
const FLORIDA_CITIES = [
  "Alachua",
  "Altamonte Springs",
  "Anna Maria",
  "Apalachicola",
  "Apopka",
  "Atlantic Beach",
  "Auburndale",
  "Aventura",
  "Avon Park",
  "Bal Harbour",
  "Bartow",
  "Bay Harbor Islands",
  "Boca Raton",
  "Bonita Springs",
  "Boynton Beach",
  "Bradenton",
  "Brooksville",
  "Cape Canaveral",
  "Cape Coral",
  "Casselberry",
  "Celebration",
  "Chipley",
  "Cinco Bayou",
  "Clearwater",
  "Clermont",
  "Clewiston",
  "Cocoa",
  "Cocoa Beach",
  "Coconut Creek",
  "Coral Gables",
  "Coral Springs",
  "Crystal River",
  "Dania Beach",
  "Davie",
  "Daytona Beach",
  "Deerfield Beach",
  "DeFuniak Springs",
  "DeLand",
  "Delray Beach",
  "Deltona",
  "Destin",
  "Dunedin",
  "Eagle Lake",
  "Edgewater",
  "Edgewood",
  "Eustis",
  "Fort Lauderdale",
  "Fort Meade",
  "Fort Myers",
  "Fort Myers Beach",
  "Fort Pierce",
  "Fort Walton Beach",
  "Fruitland Park",
  "Gainesville",
  "Greenacres",
  "Green Cove Springs",
  "Gulf Breeze",
  "Gulfport",
  "Haines City",
  "Hallandale Beach",
  "Hawthorne",
  "Hialeah",
  "Hialeah Gardens",
  "Highland Beach",
  "Hollywood",
  "Holly Hill",
  "Holmes Beach",
  "Homestead",
  "Hypoluxo",
  "Indialantic",
  "Jacksonville",
  "Juno Beach",
  "Jupiter",
  "Key Biscayne",
  "Key West",
  "Kissimmee",
  "LaBelle",
  "Lady Lake",
  "Lake Alfred",
  "Lakeland",
  "Lake Mary",
  "Lake Park",
  "Lake Wales",
  "Lake Worth",
  "Lantana",
  "Largo",
  "Lauderdale By The Sea",
  "Lauderhill",
  "Leesburg",
  "Lighthouse Point",
  "Longboat Key",
  "Longwood",
  "Maitland",
  "Marco Island",
  "Margate",
  "Melbourne",
  "Melbourne Beach",
  "Miami",
  "Miami Beach",
  "Milton",
  "Minneola",
  "Miramar",
  "Mount Dora",
  "Naples",
  "Neptune Beach",
  "New Port Richey",
  "New Smyrna Beach",
  "Niceville",
  "North Miami",
  "North Miami Beach",
  "North Port",
  "Oakland Park",
  "Ocala",
  "Ocean Ridge",
  "Ocoee",
  "Okeechobee",
  "Oldsmar",
  "Orange Park",
  "Orlando",
  "Ormond Beach",
  "Oviedo",
  "Palatka",
  "Palm Bay",
  "Palm Beach",
  "Palm Beach Gardens",
  "Palm Coast",
  "Palmetto",
  "Panama City",
  "Panama City Beach",
  "Pembroke Pines",
  "Pensacola",
  "Pinecrest",
  "Pinellas Park",
  "Plant City",
  "Plantation",
  "Pompano Beach",
  "Ponce Inlet",
  "Port Orange",
  "Port St. Lucie",
  "Punta Gorda",
  "Rockledge",
  "Royal Palm Beach",
  "St. Augustine",
  "St. Augustine Beach",
  "St. Cloud",
  "St. Pete Beach",
  "St. Petersburg",
  "Safety Harbor",
  "Sanford",
  "Sanibel",
  "Sarasota",
  "Satellite Beach",
  "Seaside",
  "Sebastian",
  "Sewall's Point",
  "Shalimar",
  "Stuart",
  "Surfside",
  "Tallahassee",
  "Tamarac",
  "Tampa",
  "Tarpon Springs",
  "Tavares",
  "Temple Terrace",
  "Titusville",
  "Treasure Island",
  "Valparaiso",
  "Venice",
  "Vero Beach",
  "Wellington",
  "West Melbourne",
  "West Palm Beach",
  "Weston",
  "Wilton Manors",
  "Winter Garden",
  "Winter Haven",
  "Winter Park",
  "Winter Springs",
];

export default function RegionSelector({
  onRegionChange = () => {},
  initialRegion = null,
  initialRegionName = null,
  inFiltersMenu = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch counties and cities on component mount
  useEffect(() => {
    async function fetchRegions() {
      setLoading(true);
      try {
        console.log("Fetching regions...");

        // Set all Florida counties from COUNTY_CODES
        const allCounties = Object.values(COUNTY_CODES).sort();
        setCounties(allCounties);

        // Set cities from our predefined list
        setCities(FLORIDA_CITIES);
      } catch (error) {
        console.error("Error in fetchRegions:", error);
        setCounties([]);
        setCities([]);
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
  
  // Handle search input
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
      <div
        className="bg-gray-200 rounded p-3"
        onClick={(e) => e.stopPropagation()}
      >
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
  };
  
  // Handle region selection
  const handleRegionSelect = (name, e) => {
    if (e) e.stopPropagation();
    onRegionChange(regionType, name);
    setExpanded(false);
  };
  
  return (
    <div className="bg-gray-200 rounded p-3" onClick={(e) => e.stopPropagation()}>
      {/* Show the selected region name or prompt to select one */}
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium">
          {regionName
            ? `${regionName}`
            : `Select a ${regionType}`}
        </div>
        <button
          className="text-gray-500 hover:text-gray-700"
          onClick={toggleExpanded}
        >
          <h3>
            {selectedRegion === "state"
              ? "Florida State"
              : selectedRegionName
              ? `${selectedRegionName} ${selectedRegion}`
              : `Select ${selectedRegion}`}
          </h3>
          <button
            className="text-gray-400 hover:text-white"
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
            placeholder={`Search ${regionType}...`}
            className="w-full p-2 mb-2 bg-white border border-gray-300 rounded"
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={(e) => e.stopPropagation()}
          />

          <div className="max-h-40 overflow-y-auto bg-white rounded border border-gray-300">
            {options.length === 0 ? (
              <div className="p-2 text-center text-gray-500">Loading...</div>
            ) : filteredRegions().length > 0 ? (
              <ul>
                {filteredRegions().map((name, index) => (
                  <li
                    key={index}
                    className={`p-2 hover:bg-gray-100 cursor-pointer ${
                      name === regionName ? "bg-blue-100" : ""
                    }`}
                    onClick={(e) => handleRegionSelect(name, e)}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-2 text-center text-gray-500">
                No {regionType} found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
