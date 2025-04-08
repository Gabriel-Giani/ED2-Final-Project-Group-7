"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AboutButton() {
  const [showAbout, setShowAbout] = useState(false);
  const aboutRef = useRef(null);

  // Handle clicks outside of about menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (showAbout && aboutRef.current && !aboutRef.current.contains(event.target)) {
        setShowAbout(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAbout]);

  // Open about menu with event propagation stopped
  const openAbout = (e) => {
    e.stopPropagation();
    setShowAbout(true);
  };
  
  // Close about menu with event propagation stopped
  const closeAbout = (e) => {
    if (e) e.stopPropagation();
    setShowAbout(false);
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
        onClick={openAbout}
      >
        About
      </motion.button>

      {/* ABOUT POPUP */}
      <AnimatePresence mode="wait">
        {showAbout && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            {/* Backdrop */}
            <motion.div
              key="about-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                closeAbout();
              }}
            />

            {/* Modal Content */}
            <motion.div
              key="about-content"
              ref={aboutRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                scale: {
                  type: "spring",
                  damping: 25,
                  stiffness: 400,
                },
              }}
              className="relative bg-gray-800 text-gray-100 rounded-xl shadow-lg p-6 w-80 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">About Us</h2>
              <p className="mb-4">
                We&apos;re here to help you see where accidents most commonly
                happen so you can plan safe routes. Stay safe out there!
              </p>
              <p className="mb-4">
                The heatmap shows accident hotspots on road segments, with
                colors ranging from green (low intensity) to red (high
                intensity).
              </p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={(e) => {
                  e.stopPropagation();
                  closeAbout();
                }}
              >
                Close
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}