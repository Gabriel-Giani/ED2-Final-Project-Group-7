"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

export default function TopRoadSegments({ onSegmentClick }) {
  const { roadLineSegments, filters } = useAccidentContext();
  const limit = filters.topSegmentsLimit || 10;
  const [isCollapsed, setIsCollapsed] = useState(false);

  const topSegments = [...roadLineSegments]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, limit);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-3 rounded-lg shadow-lg max-w-xs z-10"
    >
      <div
        className="flex justify-between items-center mb-2 cursor-pointer"
        onClick={toggleCollapse}
      >
        <h3 className="text-white text-sm font-semibold">
          Top {limit} Dangerous Road Segments
        </h3>
        <button
          className="text-gray-400 hover:text-white transition-colors"
          aria-label={isCollapsed ? "Expand list" : "Collapse list"}
        >
          {isCollapsed ? "▲" : "▼"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.ul
            key="segment-list"
            className="space-y-2 overflow-hidden"
            style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {topSegments.length > 0 ? (
              topSegments.map((segment, index) => (
                <li
                  key={segment.id || index}
                  className="bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSegmentClick(segment);
                  }}
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
                      }}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    Accidents: {segment.count} | Danger:{" "}
                    {Math.round(segment.intensity * 100)}%
                  </div>
                </li>
              ))
            ) : (
              <li className="text-xs text-gray-400 italic py-2">
                No segments found for current filters.
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
}
