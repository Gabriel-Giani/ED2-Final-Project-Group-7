"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccidentContext,
  initialState as accidentInitialState,
} from "@/context/accidentContext";
import FilterTabs from "./FilterTabs";

export default function FiltersButton() {
  const { filters, setFilters, loading: isLoading } = useAccidentContext();

  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState({ ...filters });
  const filtersRef = useRef(null);

  // Sync local state with context filters when menu opens or context changes
  useEffect(() => {
    if (showFilters) {
      setLocalFilters({ ...filters });
    } else {
      // Also sync if the menu is closed and context filters change externally
      setLocalFilters({ ...filters });
    }
  }, [showFilters, filters]);

  // Handle clicks outside of filters menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showFilters &&
        filtersRef.current &&
        !filtersRef.current.contains(event.target)
      ) {
        setShowFilters(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilters]);

  // Toggle filter menu
  const toggleFilters = (e) => {
    e.stopPropagation();
    setShowFilters(!showFilters);
  };

  // Handle the Apply button click
  const handleApply = (e) => {
    e.stopPropagation();
    setFilters(localFilters);
    setShowFilters(false);
  };

  // Handle the Reset button click
  const handleReset = (e) => {
    e.stopPropagation();
    setFilters(accidentInitialState.filters);
    setShowFilters(false);
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded relative z-10"
        onClick={toggleFilters}
      >
        Filters
      </motion.button>

      {/* FILTERS POPUP */}
      <AnimatePresence mode="wait">
        {showFilters && (
          <motion.div
            key="filters-popup"
            ref={filtersRef}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-[47px] left-0 mt-2 bg-gray-100 text-gray-800 rounded-xl shadow-lg p-4 z-[9999]"
            style={{ width: "500px", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing up */}
            <div
              className="absolute -top-2 left-8 w-0 h-0
              border-l-[8px] border-r-[8px] border-b-[8px] 
              border-l-transparent border-r-transparent
              border-b-gray-100"
            />

            {/* Filter content */}
            <FilterTabs
              localFilters={localFilters}
              setLocalFilters={setLocalFilters}
            />

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-red-500 text-white flex-1 py-2 rounded hover:bg-red-600"
                onClick={handleReset}
              >
                Reset All
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-green-500 text-white flex-1 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                onClick={handleApply}
                disabled={isLoading}
              >
                {isLoading ? "Applying..." : "Apply Filters"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
