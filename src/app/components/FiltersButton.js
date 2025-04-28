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
        className="pill-button bg-gradient-to-r from-accent-1 to-accent-1/80 hover:from-accent-1/90 hover:to-accent-1/70 text-white text-sm font-medium shadow-md hover:shadow-lg flex items-center gap-2"
        onClick={toggleFilters}
        aria-expanded={showFilters}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
        </svg>
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
            className="absolute top-[47px] left-0 mt-2 glass-card text-gray-200 rounded-xl shadow-lg p-4 z-[9999]"
            style={{ width: "500px", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing up */}
            <div
              className="absolute -top-2 left-8 w-0 h-0
              border-l-[8px] border-r-[8px] border-b-[8px] 
              border-l-transparent border-r-transparent
              border-b-[rgba(30,41,59,0.8)]"
            />

            {/* Filter content */}
            <FilterTabs
              localFilters={localFilters}
              setLocalFilters={setLocalFilters}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="pill-button bg-gradient-to-r from-danger to-danger/80 text-white flex-1 py-2 shadow-md hover:shadow-lg flex justify-center items-center gap-2"
                onClick={handleReset}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 4.5c1.215 0 2.417.055 3.604.162a.68.68 0 01.615.597c.124 1.038.208 2.088.25 3.15l-1.689-1.69a.75.75 0 00-1.06 1.061l2.999 3a.75.75 0 001.06 0l3.001-3a.75.75 0 10-1.06-1.06l-1.748 1.747a41.31 41.31 0 00-.264-3.386 2.18 2.18 0 00-1.97-1.913 41.512 41.512 0 00-7.477 0 2.18 2.18 0 00-1.969 1.913 41.16 41.16 0 00-.16 1.61.75.75 0 101.495.12c.041-.52.093-1.038.154-1.552a.68.68 0 01.615-.597A40.012 40.012 0 0110 4.5zM5.281 9.22a.75.75 0 00-1.06 0l-3.001 3a.75.75 0 101.06 1.06l1.748-1.747c.042 1.141.13 2.27.264 3.386a2.18 2.18 0 001.97 1.913 41.533 41.533 0 007.477 0 2.18 2.18 0 001.969-1.913c.064-.534.117-1.071.16-1.61a.75.75 0 10-1.495-.12c-.041.52-.093 1.037-.154 1.552a.68.68 0 01-.615.597 40.013 40.013 0 01-7.208 0 .68.68 0 01-.615-.597 39.785 39.785 0 01-.25-3.15l1.689 1.69a.75.75 0 001.06-1.061l-2.999-3z" clipRule="evenodd" />
                </svg>
                Reset All
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="pill-button bg-gradient-to-r from-primary to-accent-2 text-white flex-1 py-2 shadow-md hover:shadow-lg disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 flex justify-center items-center gap-2"
                onClick={handleApply}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Applying...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    Apply Filters
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
