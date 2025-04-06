"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAccidentContext } from "@/context/accidentContext";

export default function ViewToggle() {
  const { mapViewType, setMapViewType } = useAccidentContext();

  const handleViewChange = (view) => {
    setMapViewType(view);
  };

  return (
    <div className="absolute top-16 right-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden p-2"
      >
        <div className="flex items-center space-x-2">
          <span className="mr-2 font-medium text-sm">View:</span>

          <button
            onClick={() => handleViewChange("hotspots")}
            className={`px-3 py-1 rounded text-sm transition-colors focus:outline-none ${
              mapViewType === "hotspots"
                ? "bg-blue-600 text-white font-semibold"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Hotspots
          </button>

          <button
            onClick={() => handleViewChange("roadLines")}
            className={`px-3 py-1 rounded text-sm transition-colors focus:outline-none ${
              mapViewType === "roadLines"
                ? "bg-blue-600 text-white font-semibold"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Road Lines
          </button>
        </div>
      </motion.div>
    </div>
  );
}
