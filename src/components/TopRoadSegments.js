"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

// Convert intensity (0-1) to rating (0-5)
function getRiskRating(intensity) {
  return Math.round(intensity * 10) / 2; // Convert to 0-5 scale with 0.5 increments
}

function RiskRating({ rating, showTooltip = false }) {
  const totalSymbols = 5;
  const fullSymbols = Math.floor(rating);
  const hasHalfSymbol = rating % 1 !== 0;
  const emptySymbols = totalSymbols - fullSymbols - (hasHalfSymbol ? 1 : 0);

  return (
    <div className="flex items-center gap-1 group relative">
      {[...Array(fullSymbols)].map((_, i) => (
        <svg key={`full-${i}`} className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#FF0000" strokeWidth="3" fill="none" />
          <line x1="5" y1="19" x2="19" y2="5" stroke="#FF0000" strokeWidth="3" />
        </svg>
      ))}
      {hasHalfSymbol && (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="half-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="#FF0000" />
              <stop offset="50%" stopColor="#9CA3AF" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="9" stroke="url(#half-gradient)" strokeWidth="3" fill="none" />
          <line x1="5" y1="19" x2="19" y2="5" stroke="url(#half-gradient)" strokeWidth="3" />
        </svg>
      )}
      {[...Array(emptySymbols)].map((_, i) => (
        <svg key={`empty-${i}`} className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#9CA3AF" strokeWidth="3" fill="none" />
          <line x1="5" y1="19" x2="19" y2="5" stroke="#9CA3AF" strokeWidth="3" />
        </svg>
      ))}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Risk Rating: {rating.toFixed(1)} out of 5
        </div>
      )}
    </div>
  );
}

// Calculate a composite score that considers both crashes and risk
function getCompositeScore(segment) {
  // Normalize crash count (assuming max of 100 crashes for normalization)
  const normalizedCount = Math.min(segment.count / 100, 1);
  // Weight both factors equally (0.5 each)
  return (normalizedCount * 0.5) + (segment.intensity * 0.5);
}

export default function TopRoadSegments({ onSegmentClick }) {
  const { roadLineSegments, filters } = useAccidentContext();
  const limit = filters.topSegmentsLimit || 10;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState("left");
  const [dimensions, setDimensions] = useState({
    windowWidth: 1920,
    leftSnap: 16,
    rightSnap: 1584,
  });
  
  const margin = 16;
  const panelWidth = 320; // w-80 = 320px
  const snapThreshold = 100; // Distance from snap point to trigger snap

  // Update dimensions when window resizes or position changes
  useEffect(() => {
    const updateDimensions = () => {
      const windowWidth = window.innerWidth;
      const leftSnap = margin;
      const rightSnap = Math.max(margin, Math.min(windowWidth - (panelWidth + margin), windowWidth - panelWidth));

      setDimensions({
        windowWidth,
        leftSnap,
        rightSnap
      });

      // If current position would put panel out of bounds, adjust it
      if (position === "right" && getTargetX() > windowWidth - panelWidth) {
        setPosition("left");
      }
    };

    // Initial update
    if (typeof window !== 'undefined') {
      updateDimensions();
    }

    // Update on window resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [position]);

  const topSegments = [...roadLineSegments]
    .sort((a, b) => getCompositeScore(b) - getCompositeScore(a))
    .slice(0, limit);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleDragEnd = (event, info) => {
    const currentX = info.point.x;
    const { leftSnap, rightSnap, windowWidth } = dimensions;

    // Ensure we stay within bounds
    if (currentX < leftSnap || Math.abs(currentX - leftSnap) < snapThreshold) {
      setPosition("left");
    } else if (currentX > windowWidth - panelWidth - margin || Math.abs(currentX - rightSnap) < snapThreshold) {
      // Only allow right position if there's enough space
      if (windowWidth >= panelWidth + (2 * margin)) {
        setPosition("right");
      } else {
        setPosition("left");
      }
    } else {
      // If in the middle, snap to the nearest valid position
      const distanceToLeft = Math.abs(currentX - leftSnap);
      const distanceToRight = Math.abs(currentX - rightSnap);
      setPosition(distanceToLeft < distanceToRight ? "left" : "right");
    }
  };

  // Calculate current target position
  const getTargetX = () => {
    return position === "left" ? dimensions.leftSnap : dimensions.rightSnap;
  };

  // Calculate drag constraints
  const getDragConstraints = () => {
    const { windowWidth } = dimensions;
    return {
      left: margin,
      right: Math.max(margin, windowWidth - (panelWidth + margin))
    };
  };

  return (
    <motion.div
      drag="x"
      dragMomentum={false}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      animate={{
        x: getTargetX()
      }}
      initial={{ x: margin }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 35,
        mass: 1
      }}
      dragConstraints={getDragConstraints()}
      className="fixed bottom-[56px] bg-gray-800 bg-opacity-90 p-3 rounded-lg shadow-lg w-80 z-10 cursor-move"
    >
      <div className="flex flex-col gap-2">
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={toggleCollapse}
        >
          <h3 className="text-white text-sm font-semibold">
            Top {limit} High Risk Road Segments
          </h3>
          <button
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={isCollapsed ? "Expand list" : "Collapse list"}
          >
            {isCollapsed ? "▲" : "▼"}
          </button>
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              key="segment-list"
              className="space-y-2 overflow-hidden"
              style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Legend */}
              <div className="text-xs text-gray-300 pb-2 border-b border-gray-700">
                More symbols indicate higher risk (scale: 0-5)
              </div>

              <ul className="space-y-2">
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
                      <div className="text-xs text-gray-300 mt-1 flex justify-between items-center">
                        <span>Accidents: {segment.count}</span>
                        <RiskRating rating={getRiskRating(segment.intensity)} showTooltip={true} />
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-gray-400 italic py-2">
                    No segments found for current filters.
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
}
