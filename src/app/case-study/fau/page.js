"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { fauAccidentData } from "./temp-data";

// --- Date Filtering Logic (kept for display text) ---
const START_DATE = "2010-08-15";
const END_DATE = "2010-08-25";
const DISPLAY_DATE_RANGE = "August 15, 2010 - August 25, 2010"; // Static display string as requested

export default function FauCaseStudyPage() {
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
          Analysis Period: Aug 1st, 2010 - Sep 31st, 2010
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
          <div className="w-full relative">
            <Image
              src="/caseStudyImage.png"
              alt="Case Study Map Visualization - Glades Rd & I-95"
              layout="responsive"
              width={1600}
              height={900}
              priority
            />
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-400 text-center p-3 text-sm">
        Case Study View
      </footer>
    </div>
  );
}
