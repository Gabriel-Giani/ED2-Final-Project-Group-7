"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

// Convert intensity (0-1) to rating (0-5)
function getRiskRating(intensity) {
  return Math.round(intensity * 10) / 2;
}

function RiskRating({ rating, showTooltip = false }) {
  const totalSymbols = 5;
  const fullSymbols = Math.floor(rating);
  const hasHalfSymbol = rating % 1 !== 0;
  const emptySymbols = totalSymbols - fullSymbols - (hasHalfSymbol ? 1 : 0);

  return (
    <div className="flex items-center gap-1 group relative">
      {[...Array(fullSymbols)].map((_, i) => (
        <svg
          key={`full-${i}`}
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#ef4444"
            strokeWidth="3"
            fill="none"
          />
          <line
            x1="5"
            y1="19"
            x2="19"
            y2="5"
            stroke="#ef4444"
            strokeWidth="3"
          />
        </svg>
      ))}
      {hasHalfSymbol && (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient
              id="half-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#9CA3AF" />
            </linearGradient>
          </defs>
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="url(#half-gradient)"
            strokeWidth="3"
            fill="none"
          />
          <line
            x1="5"
            y1="19"
            x2="19"
            y2="5"
            stroke="url(#half-gradient)"
            strokeWidth="3"
          />
        </svg>
      )}
      {[...Array(emptySymbols)].map((_, i) => (
        <svg
          key={`empty-${i}`}
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#9CA3AF"
            strokeWidth="3"
            fill="none"
          />
          <line
            x1="5"
            y1="19"
            x2="19"
            y2="5"
            stroke="#9CA3AF"
            strokeWidth="3"
          />
        </svg>
      ))}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          Risk Rating: {rating.toFixed(1)} out of 5
        </div>
      )}
    </div>
  );
}

// Calculate a composite score that considers both crashes and risk
function getCompositeScore(segment) {
  const normalizedCount = Math.min(segment.count / 100, 1);
  return normalizedCount * 0.5 + segment.intensity * 0.5;
}

function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
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
      const rightSnap = Math.max(
        margin,
        Math.min(windowWidth - (panelWidth + margin), windowWidth - panelWidth)
      );

      setDimensions({
        windowWidth,
        leftSnap,
        rightSnap,
      });

      // If current position would put panel out of bounds, adjust it
      if (position === "right" && getTargetX() > windowWidth - panelWidth) {
        setPosition("left");
      }
    };

    // Initial update
    if (typeof window !== "undefined") {
      updateDimensions();
    }

    // Update on window resize
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
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
    } else if (
      currentX > windowWidth - panelWidth - margin ||
      Math.abs(currentX - rightSnap) < snapThreshold
    ) {
      // Only allow right position if there's enough space
      if (windowWidth >= panelWidth + 2 * margin) {
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
      right: Math.max(margin, windowWidth - (panelWidth + margin)),
    };
  };

  return (
    <motion.div
      drag="x"
      dragMomentum={false}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      animate={{
        x: getTargetX(),
      }}
      initial={{ x: margin }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 35,
        mass: 1,
      }}
      dragConstraints={getDragConstraints()}
      className="fixed bottom-[54px] glass-card rounded-lg shadow-xl w-80 z-10 cursor-move"
    >
      <div className="flex flex-col">
        <div
          className="flex justify-between items-center cursor-pointer p-3"
          onClick={toggleCollapse}
        >
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-risk-high"
            >
              <path
                fillRule="evenodd"
                d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
            Top {limit} High Risk Road Segments
          </h3>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700/50"
            aria-label={isCollapsed ? "Expand list" : "Collapse list"}
          >
            {isCollapsed ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </motion.button>
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              key="segment-list"
              className="space-y-2 overflow-hidden px-3 pb-3"
              style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Legend */}
              <div className="text-xs text-gray-300 pb-2 border-b border-gray-700/50 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-gray-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                    clipRule="evenodd"
                  />
                </svg>
                More symbols indicate higher risk (scale: 0-5)
              </div>

              <ul className="space-y-2 pt-1">
                {topSegments.length > 0 ? (
                  topSegments.map((segment, index) => (
                    <motion.li
                      key={segment.id || index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm p-3 rounded-lg cursor-pointer border border-gray-700/50 transition-all shadow-md hover:shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSegmentClick(segment);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white font-medium truncate pr-2 flex-1">
                          {segment.name || "Unknown Road"}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-1 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: getHeatColor(segment.intensity),
                            color: segment.intensity > 0.5 ? "white" : "black",
                            minWidth: "1.75rem",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        >
                          #{index + 1}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 mt-2 flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path d="M9.378 1.094c.484-.051.835.195 1.046.412.212.218 1.495 1.706 1.495 1.706.159.193.196.328.148.415-.148.87-1.857 11.316-1.857 11.316-.043.272-.264.487-.564.487-.3 0-.521-.215-.564-.487 0 0-1.71-10.446-1.856-11.316-.05-.087-.012-.222.148-.415 0 0 1.282-1.488 1.495-1.706.21-.217.562-.463 1.046-.412.001 0 .001 0 .002 0s.001 0 .002 0" />
                          </svg>
                          Accidents: {segment.count}
                        </span>
                        <RiskRating
                          rating={getRiskRating(segment.intensity)}
                          showTooltip={true}
                        />
                      </div>
                    </motion.li>
                  ))
                ) : (
                  <li className="text-xs text-gray-400 italic py-4 text-center">
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
