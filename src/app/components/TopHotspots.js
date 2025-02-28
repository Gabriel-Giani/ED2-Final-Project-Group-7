"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopHotspots } from "@/utils/db/hotspots";

export default function TopHotspots({
  dateRange = null,
  timeRange = null,
  limit = 10,
  onHotspotClick = null,
}) {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fetch top hotspots
  useEffect(() => {
    async function fetchTopHotspots() {
      setLoading(true);
      try {
        console.log("Fetching top hotspots with limit:", limit);
        console.log("Date range:", dateRange);
        console.log("Time range:", timeRange);

        const data = await getTopHotspots(
          limit,
          dateRange?.start,
          dateRange?.end,
          timeRange?.start,
          timeRange?.end
        );

        console.log(`Successfully fetched ${data?.length || 0} top hotspots`);
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
  }, [limit, dateRange, timeRange]);

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
                  No hotspots found
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
