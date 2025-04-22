"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import CaseStudyMap from "@/components/CaseStudyMap";
import { fauAccidentData } from "./temp-data";
import { roadSegmentService } from "@/services/roadSegmentService";

// Coordinates for Glades Rd & I-95 interchange near FAU
const FAU_HOTSPOT_CENTER = [-80.103, 26.374]; // [longitude, latitude]
const FAU_HOTSPOT_ZOOM = 15; // Zoom level to focus on the interchange

// --- Date Filtering Logic ---
const START_DATE = "2010-08-15";
const END_DATE = "2010-08-25";
const DISPLAY_DATE_RANGE = "August 15, 2010 - August 25, 2010"; // Static display string as requested

function filterAccidentsByDate(accidents, startDateStr, endDateStr) {
  if (!accidents) return [];
  const start = new Date(startDateStr + "T00:00:00Z"); // Ensure comparison includes the start day
  const end = new Date(endDateStr + "T23:59:59Z"); // Ensure comparison includes the end day
  return accidents.filter((acc) => {
    try {
      const crashDate = new Date(acc.crashdate);
      return crashDate >= start && crashDate <= end;
    } catch (e) {
      console.warn(
        `Error parsing date for crash ${acc.crashnum}: ${acc.crashdate}`
      );
      return false;
    }
  });
}
// --- End Date Filtering Logic ---

export default function FauCaseStudyPage() {
  const [showRoadLines, setShowRoadLines] = useState(false);
  const [filteredAccidents, setFilteredAccidents] = useState([]);
  const [processedRoadSegments, setProcessedRoadSegments] = useState([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);

  // Define filters for the service call
  const caseStudyFilters = useMemo(
    () => ({
      filterRegion: "city",
      regionName: "BOCA RATON",
      dateRange: { start: START_DATE, end: END_DATE },
      useTimeFilter: false,
    }),
    []
  );

  // Filter accidents from temp data AND fetch/process segments from service
  useEffect(() => {
    console.log(`Filtering accidents between ${START_DATE} and ${END_DATE}...`);
    const filtered = filterAccidentsByDate(
      fauAccidentData,
      START_DATE,
      END_DATE
    );
    setFilteredAccidents(filtered);
    console.log(
      `Filtered down to ${filtered.length} accidents for point display.`
    );

    const fetchAndProcessSegments = async () => {
      setIsLoadingSegments(true);
      console.log(
        "Fetching and processing road segments via service with filters:",
        caseStudyFilters
      );
      try {
        const segments = await roadSegmentService.getMajorRoadLineSegments(
          caseStudyFilters,
          null
        );
        console.log(
          `Service returned ${segments.length} processed road segments.`
        );
        setProcessedRoadSegments(segments);
      } catch (error) {
        console.error("Error fetching/processing road segments:", error);
        setProcessedRoadSegments([]);
      } finally {
        setIsLoadingSegments(false);
      }
    };

    fetchAndProcessSegments();
  }, [caseStudyFilters]);

  // Use the static display date range
  const dateRange = DISPLAY_DATE_RANGE;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-bold">
          Case Study: Glades Road & I-95 (Near FAU)
        </h1>
        <div className="flex items-center gap-3">
          {isLoadingSegments && (
            <span className="text-sm text-gray-400 italic">
              Loading road lines...
            </span>
          )}
          <button
            onClick={() => setShowRoadLines(!showRoadLines)}
            disabled={isLoadingSegments}
            className={`px-3 py-1 rounded-md text-sm text-white transition-colors ${
              isLoadingSegments
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {showRoadLines ? "Hide Road Lines" : "Show Road Lines"}
          </button>
          <Link href="/" passHref legacyBehavior>
            <a className="px-3 py-1 rounded-md text-sm bg-gray-600 hover:bg-gray-500 text-white transition-colors">
              Exit Case Study
            </a>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        <p className="mb-4 text-center text-gray-700 dark:text-gray-300">
          Analysis Period: <span className="font-semibold">{dateRange}</span>
        </p>
        <p className="mb-6 text-lg text-center text-gray-700 dark:text-gray-300">
          This section examines a known traffic accident hotspot located at the
          intersection of Glades Road and the I-95 interchange in Boca Raton,
          Florida, near Florida Atlantic University (FAU). The visualization
          shows the accident hotspots from August 1st, 2010 to September 31st,
          2010. This is a 2 month period where the traffic volume is high due to
          the start of the school year.
        </p>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden mb-8">
          {/* Map Container */}
          <div className="h-96 w-full relative">
            <CaseStudyMap
              center={FAU_HOTSPOT_CENTER}
              zoom={FAU_HOTSPOT_ZOOM}
              accidents={filteredAccidents}
              roadSegments={processedRoadSegments}
              showRoadLines={showRoadLines}
            />
          </div>
        </div>

        {/* Analysis Section Placeholder */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-3">Analysis</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed analysis of accident frequency, types, contributing
            factors, and potential countermeasures for this hotspot will be
            presented here based on the visualized data for the period{" "}
            {dateRange}.
            {/* Add more descriptive text and potentially charts/stats later */}
          </p>
        </div>
      </main>

      {/* Footer (Optional - can be removed if RootLayout has a footer) */}
      <footer className="bg-gray-800 text-gray-400 text-center p-3 text-sm">
        Case Study View
      </footer>
    </div>
  );
}
