"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AboutButton() {
  const [showAbout, setShowAbout] = useState(false);

  const toggleAbout = () => {
    setShowAbout(!showAbout);
  };
  
  // Handle clicks outside the about modal
  useEffect(() => {
    function handleClickOutside(event) {
      const aboutContent = document.getElementById("about-content");
      if (showAbout && aboutContent && !aboutContent.contains(event.target)) {
        setShowAbout(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAbout]);

  // Prevent scrolling when the modal is open
  useEffect(() => {
    if (showAbout) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showAbout]);

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="pill-button bg-gray-700/80 hover:bg-gray-600 text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
        onClick={toggleAbout}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        About
      </motion.button>

      <AnimatePresence>
        {showAbout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100vw',
              height: '100vh',
              position: 'fixed',
              top: 0,
              left: 0,
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)'
            }}
          >
            <motion.div
              id="about-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-5 rounded-xl shadow-xl max-w-md w-11/12 md:w-auto"
            >
              <div className="text-lg font-bold mb-3 pb-2 border-b border-gray-700/50 flex items-center justify-between">
                About This Project
                <button 
                  onClick={toggleAbout}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm text-gray-300">
                <p>
                  <span className="font-semibold text-white">Don't Drive Here</span> is an interactive map-based application that visualizes accident hotspots across Florida. Using data from the Florida Department of Highway Safety and Motor Vehicles, the application identifies and displays high-risk road segments to help users make informed decisions about their travel routes.
                </p>
                
                <div>
                  <h3 className="text-white font-semibold mb-1">Key Features:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Interactive heat map of accident-prone road segments</li>
                    <li>Detailed filtering by date, time, location, and crash factors</li>
                    <li>View individual accident data points</li>
                    <li>Risk rating system that considers frequency and severity</li>
                    <li>Top high-risk road segments ranking</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-1">Data Sources:</h3>
                  <p>Crash data from the Florida Department of Highway Safety and Motor Vehicles (FLHSMV) - Signal Four Analytics</p>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-1">Developed By:</h3>
                  <p>Chris Medrano, Gabriel Giani, Leonardo Silva, and William West as part of the FAU Computer Engineering Design 2 course.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}