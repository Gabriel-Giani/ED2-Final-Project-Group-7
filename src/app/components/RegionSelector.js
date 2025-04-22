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
    <div className="border border-gray-700 rounded p-3 bg-[#252b3b]" onClick={(e) => e.stopPropagation()}>
      {/* Show the selected region name or prompt to select one */}
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium text-gray-200">
          {regionName
            ? `${regionName}`
            : `Select a ${regionType}`}
        </div>
        <button
          className="text-gray-400 hover:text-white"
          onClick={toggleExpanded}
        >
          {expanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 011.06 0l4.25 4.25a.75.75 0 11-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 01-1.06-1.06l4.25-4.25z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 13.5a.75.75 0 01-.75-.75V6.69l-1.22 1.22a.75.75 0 11-1.06-1.06l2.5-2.5a.75.75 0 011.06 0l2.5 2.5a.75.75 0 11-1.06 1.06l-1.22-1.22v6.06a.75.75 0 01-.75.75z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Search box and results */}
      {expanded && (
        <div>
          <input
            type="text"
            placeholder={`Search ${regionType}...`}
            className="w-full p-2 mb-2 bg-[#1e2330] border border-gray-700 rounded text-white placeholder-gray-400"
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={(e) => e.stopPropagation()}
          />

          <div className="max-h-40 overflow-y-auto bg-[#1e2330] rounded border border-gray-700">
            {options.length === 0 ? (
              <div className="p-2 text-center text-gray-400">Loading...</div>
            ) : filteredRegions().length > 0 ? (
              <ul>
                {filteredRegions().map((name, index) => (
                  <li
                    key={index}
                    className={`p-2 hover:bg-[#2d3748] cursor-pointer ${
                      name === regionName ? "bg-blue-900/50 text-white" : "text-gray-200"
                    }`}
                    onClick={(e) => handleRegionSelect(name, e)}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-2 text-center text-gray-400">
                No {regionType} found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}