"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

export default function TopRoadSegments({ onSegmentClick }) {
  const { roadLineSegments, filters } = useAccidentContext();
  const limit = filters.topSegmentsLimit || 10; // Use limit from context, default 10

  // Sort segments by intensity (descending) and take the top N
  const topSegments = [...roadLineSegments] // Create a copy before sorting
    .sort((a, b) => b.intensity - a.intensity) // Highest intensity first
    .slice(0, limit);

  if (!topSegments || topSegments.length === 0) {
    // Optionally render something if no segments are available or loaded yet
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-3 rounded-lg shadow-lg max-w-xs z-10"
      style={{ maxHeight: "calc(100vh - 10rem)", overflowY: "auto" }} // Limit height and allow scroll
    >
      <h3 className="text-white text-sm font-semibold mb-2">
        Top {limit} Dangerous Road Segments
      </h3>
      <ul className="space-y-2">
        {topSegments.map((segment, index) => (
          <li
            key={segment.id || index} // Use unique ID if available, fallback to index
            className="bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-600 transition-colors"
            onClick={() => onSegmentClick(segment)} // Call handler on click
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-white font-medium truncate pr-2">
                {segment.name || "Unknown Road"}
              </span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: getHeatColor(segment.intensity),
                  color: "black",
                }} // Use heat color for badge
              >
                #{index + 1}
              </span>
            </div>
            <div className="text-xs text-gray-300 mt-1">
              Accidents: {segment.count} | Danger:{" "}
              {Math.round(segment.intensity * 100)}%
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// Helper function to get color (ensure consistency with map)
function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
}
