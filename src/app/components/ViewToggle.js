"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

export default function ViewToggle() {
  const { showPoints, togglePointsView } = useAccidentContext();

  return (
    <div className="absolute top-16 right-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden p-3"
      >
        <div className="flex items-center justify-between">
          <span className="mr-3 font-medium">View Mode:</span>
          <button
            onClick={togglePointsView}
            className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none"
          >
            <span
              className={`${
                showPoints ? "bg-blue-600" : "bg-gray-700"
              } absolute h-6 w-11 rounded-full transition-colors`}
            />
            <span
              className={`${
                showPoints ? "translate-x-6" : "translate-x-1"
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {showPoints ? "Individual Points" : "Hotspot Heatmap"}
        </div>
      </motion.div>
    </div>
  );
}