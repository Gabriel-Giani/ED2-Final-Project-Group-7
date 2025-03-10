"use client";

import React, { useState } from "react";

export default function RegionSelector({ 
  regionType, 
  regionName, 
  onRegionChange, 
  options = [] 
}) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Toggle expanded state
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
    return options.filter(region => 
      region.toLowerCase().includes(searchTermLower)
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