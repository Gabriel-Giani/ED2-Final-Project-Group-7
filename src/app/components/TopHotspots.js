"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopHotspots } from "@/utils/db/hotspots";
import { getFilteredAccidents } from "@/utils/db/accidents";

export default function TopHotspots({
  dateRange = null,
  timeRange = null,
  advancedFilters = {},
  limit = 10,
  onHotspotClick = null,
}) {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fetch top hotspots based on all filters
  useEffect(() => {
    async function fetchTopHotspots() {
      setLoading(true);
      try {
        console.log("Fetching top hotspots with all filters");
        
        // Build filter parameters
        const filterParams = {
          // Basic filters
          dateStart: dateRange?.start,
          dateEnd: dateRange?.end,
          timeStart: timeRange?.start,
          timeEnd: timeRange?.end,
          
          // Add all advanced filters
          ...advancedFilters,
          
          // Set limit for the query
          limit: limit * 2 // Fetch extra to handle potential filtering on the client side
        };

        console.log("Filter params:", filterParams);
        
        let data;
        
        // If we have advanced filters, we need to process results differently
        if (hasAdvancedFilters(advancedFilters)) {
          // Get filtered accidents first
          const accidents = await getFilteredAccidents(filterParams);
          console.log(`Fetched ${accidents?.length || 0} filtered accidents`);
          
          // Process accidents to find hotspots
          data = processAccidentsToHotspots(accidents, limit);
        } else {
          // Use existing function for basic filters
          data = await getTopHotspots(
            limit,
            dateRange?.start,
            dateRange?.end,
            timeRange?.start,
            timeRange?.end
          );
        }

        console.log(`Successfully processed ${data?.length || 0} top hotspots`);
        setHotspots(data || []);
      } catch (error) {
        console.error("Error fetching top hotspots:", error);
        // Set empty array in case of error
        setHotspots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTopHotspots();
  }, [limit, dateRange, timeRange, advancedFilters]);

  // Helper to check if any advanced filters are active
  function hasAdvancedFilters(filters) {
    if (!filters) return false;
    
    const advancedKeys = [
      'dayOfWeek', 'roadName', 'intersectingRoad', 'injuryLevel',
      'alcoholDrugs', 'lightCondition', 'weatherCondition', 'roadSurfaceCondition',
      'direction', 'damageMin', 'damageMax'
    ];
    
    const booleanKeys = [
      'aggressiveDriving', 'pedestrianInvolved', 'bicycleInvolved',
      'motorcycleInvolved', 'teenInvolved', 'elderlyInvolved', 'impaired'
    ];
    
    // Check if any advanced filter has a value
    for (const key of advancedKeys) {
      if (filters[key]) return true;
    }
    
    // Check if any boolean filter is true
    for (const key of booleanKeys) {
      if (filters[key] === true) return true;
    }
    
    return false;
  }

  // Process accidents into hotspots
  function processAccidentsToHotspots(accidents, limitCount) {
    if (!accidents || accidents.length === 0) return [];
    
    // Create grid to group accidents into hotspots
    const gridSize = 0.01; // Grid size in degrees
    const grid = {};
    
    accidents.forEach(accident => {
      if (!accident.latitude || !accident.longitude) return;
      
      // Round coordinates to create grid cells
      const lat = Math.round(accident.latitude / gridSize) * gridSize;
      const lng = Math.round(accident.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;
      
      if (!grid[key]) {
        grid[key] = {
          count: 0,
          lats: [],
          lngs: [],
          county: accident.dotcounty,
          city: accident.townname,
          road_names: [],
        };
      }
      
      grid[key].count++;
      grid[key].lats.push(accident.latitude);
      grid[key].lngs.push(accident.longitude);
      
      // Track road names if available
      if (accident.onroadname && !grid[key].road_names.includes(accident.onroadname)) {
        grid[key].road_names.push(accident.onroadname);
      }
    });
    
    // Convert grid cells to hotspots
    const counts = Object.values(grid).map(cell => cell.count);
    const maxCount = Math.max(...counts, 1); // Prevent division by zero
    
    const hotspots = Object.entries(grid).map(([key, cell], index) => {
      // Calculate center as average of all points in the cell
      const avgLat = cell.lats.reduce((sum, lat) => sum + lat, 0) / cell.lats.length;
      const avgLng = cell.lngs.reduce((sum, lng) => sum + lng, 0) / cell.lngs.length;
      
      // Calculate intensity based on count
      const intensity = cell.count / maxCount;
      
      // Get the most common road name
      const roadNameCounts = {};
      cell.road_names.forEach(name => {
        roadNameCounts[name] = (roadNameCounts[name] || 0) + 1;
      });
      
      const road_name = cell.road_names.length > 0
        ? Object.entries(roadNameCounts).sort((a, b) => b[1] - a[1])[0][0]
        : undefined;
      
      return {
        id: `hotspot-${index}`,
        center: [avgLng, avgLat],
        intensity,
        count: cell.count,
        road_name,
        county: cell.county,
        city: cell.city
      };
    });
    
    // Sort hotspots by intensity (highest first) and limit the results
    return hotspots
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, limitCount);
  }

  // Handle hotspot click
  const handleHotspotClick = (hotspot) => {
    if (onHotspotClick) {
      onHotspotClick(hotspot);
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden"
      >
        <div
          className="p-3 font-bold border-b border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <h3>Top Accident Hotspots</h3>
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
              {loading ? (
                <div className="p-4 text-center text-gray-400">
                  Loading hotspots...
                </div>
              ) : hotspots.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  No hotspots found with current filters
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {hotspots.map((hotspot, index) => (
                    <li
                      key={hotspot.id || index}
                      className="p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
                      onClick={() => handleHotspotClick(hotspot)}
                    >
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{
                            backgroundColor: getIntensityColor(
                              hotspot.intensity
                            ),
                          }}
                        />
                        <div>
                          <div className="font-medium">
                            {hotspot.road_name || `Hotspot #${index + 1}`}
                          </div>
                          <div className="text-sm text-gray-400">
                            {hotspot.county || ""}{" "}
                            {hotspot.city ? `- ${hotspot.city}` : ""}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {hotspot.count} accidents | Intensity:{" "}
                            {(hotspot.intensity * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Helper function to get color based on intensity
function getIntensityColor(intensity) {
  // Green to yellow to red gradient
  if (intensity < 0.5) {
    // Green to yellow (0.0 - 0.5)
    const r = Math.floor(255 * (intensity * 2));
    const g = 255;
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to red (0.5 - 1.0)
    const r = 255;
    const g = Math.floor(255 * (1 - (intensity - 0.5) * 2));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
}