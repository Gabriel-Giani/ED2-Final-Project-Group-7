"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AccidentDetailsPopup({ accident, onClose, position }) {
  if (!accident) return null;

  console.log("Rendering AccidentDetailsPopup with:", { accident, position });

  // Format date from YYYY-MM-DD to more readable format
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time from 24hr to 12hr format with better error handling
  const formatTime = (timeStr) => {
    if (!timeStr) return "Unknown time";
    try {
      // Handle 4-digit format (e.g., "1840")
      if (typeof timeStr === "string" && timeStr.length === 4) {
        const hours = parseInt(timeStr.substring(0, 2), 10);
        const minutes = timeStr.substring(2, 4);
        const ampm = hours >= 12 ? "PM" : "AM";
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }

      // Handle HH:MM format
      if (typeof timeStr === "string" && timeStr.includes(":")) {
        const [hours, minutes] = timeStr.split(":");
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }

      // If it's a number, convert to string and handle as 4-digit format
      if (typeof timeStr === "number") {
        const timeString = timeStr.toString().padStart(4, "0");
        const hours = parseInt(timeString.substring(0, 2), 10);
        const minutes = timeString.substring(2, 4);
        const ampm = hours >= 12 ? "PM" : "AM";
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }

      return timeStr.toString();
    } catch (e) {
      console.warn("Error formatting time:", e);
      return timeStr?.toString() || "Unknown time";
    }
  };

  // Map injury level codes to readable descriptions
  const getInjuryLevelText = (code) => {
    const injuryLevels = {
      1: "No injury",
      2: "Possible injury",
      3: "Non-incapacitating injury",
      4: "Incapacitating injury",
      5: "Fatal injury",
    };
    return injuryLevels[code] || "Unknown injury level";
  };

  // Map weather condition codes to readable descriptions
  const getWeatherText = (code) => {
    const weatherConditions = {
      "01": "Clear",
      "02": "Cloudy",
      "03": "Rain",
      "04": "Fog",
      77: "Other",
    };
    return weatherConditions[code] || "Unknown weather";
  };

  // Map road surface condition codes to readable descriptions
  const getRoadSurfaceText = (code) => {
    const roadConditions = {
      "01": "Dry",
      "02": "Wet",
      "03": "Slippery",
      "04": "Icy",
      77: "Other",
    };
    return roadConditions[code] || "Unknown road condition";
  };

  // Map light condition codes to readable descriptions
  const getLightConditionText = (code) => {
    const lightConditions = {
      "01": "Daylight",
      "02": "Dusk",
      "03": "Dawn",
      "04": "Dark (street lights)",
      "05": "Dark (no street lights)",
    };
    return lightConditions[code] || "Unknown light condition";
  };

  // Get day of week text
  const getDayOfWeekText = (code) => {
    const days = [
      "",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return days[parseInt(code)] || "Unknown day";
  };

  return (
    <AnimatePresence>
      <div className="fixed top-20 right-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden pointer-events-auto"
          style={{
            maxWidth: "400px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          {/* Triangle pointer for the popup */}
          {position && (
            <div
              className="absolute w-4 h-4 bg-white dark:bg-gray-800 rotate-45 transform"
              style={{
                bottom: "-8px",
                left: "50%",
                marginLeft: "-8px",
              }}
            />
          )}

          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Accident Details
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* Location */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Location
                </h3>
                <p className="text-gray-900 dark:text-white">
                  {accident.onroadname || "Unknown road"}
                  {accident.inroadname ? ` at ${accident.inroadname}` : ""}
                </p>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {accident.townname ? `${accident.townname}, ` : ""}
                  {accident.dotcounty || "Unknown county"}, FL
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Coordinates: {accident.latitude?.toFixed(6) || "N/A"},{" "}
                  {accident.longitude?.toFixed(6) || "N/A"}
                </div>
              </div>

              {/* Date and Time */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Date & Time
                </h3>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(accident.crashdate)}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  {formatTime(accident.crashtime)} (
                  {getDayOfWeekText(accident.dayofweek)})
                </p>
              </div>

              {/* Severity */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Severity
                </h3>
                <p className="text-gray-900 dark:text-white">
                  {getInjuryLevelText(accident.highestinj)}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Injuries:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {accident.cntofinj || "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Fatalities:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {accident.cntoffatl || "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Conditions
                </h3>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Weather:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {getWeatherText(accident.weathcond)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Light:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {getLightConditionText(accident.lightcond)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Road Surface:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {getRoadSurfaceText(accident.rdsurfcond)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Participants
                </h3>
                <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Vehicles:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {accident.cntofveh || "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Pedestrians:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {accident.cntofpedes || "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Cyclists:{" "}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {accident.cntofcycls || "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Damage */}
              {accident.totcrshdmg && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Estimated Damage
                  </h3>
                  <p className="text-gray-900 dark:text-white">
                    ${parseInt(accident.totcrshdmg).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Case Information */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                <p>Case #: {accident.casenumber || "N/A"}</p>
                <p>Crash #: {accident.crashnum || "N/A"}</p>
                <p>Agency: {accident.agency || "N/A"}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
