"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL configured:", supabaseUrl ? "Yes" : "No");
console.log("Supabase Anon Key configured:", supabaseAnonKey ? "Yes" : "No");

let supabase; // Define supabase client variable

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing!");
  // Handle the error appropriately, maybe show a message to the user
  // For now, we'll let it proceed, but operations requiring Supabase will fail.
} else {
  // Simple in-memory cache - keep this if needed elsewhere, or move if only for map
  const cache = {
    data: new Map(),
    set: (key, value, ttl = 300000) => {
      // Default TTL: 5 minutes
      const expiry = Date.now() + ttl;
      cache.data.set(key, { value, expiry });
      console.log(`Cached data for key: ${key}`);
    },
    get: (key) => {
      const item = cache.data.get(key);
      if (!item) return null;

      if (Date.now() > item.expiry) {
        cache.data.delete(key);
        console.log(`Cache expired for key: ${key}`);
        return null;
      }

      console.log(`Cache hit for key: ${key}`);
      return item.value;
    },
    clear: () => {
      cache.data.clear();
      console.log("Cache cleared");
    },
  };

  // Create a custom fetch function with error handling and retry logic - keep if used elsewhere
  const customFetch = async (url, options) => {
    // Simple retry logic
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        console.log(
          `Supabase request to: ${url.split("?")[0]} (attempt ${
            retries + 1
          }/${maxRetries})`
        );
        const response = await fetch(url, options);

        if (!response.ok) {
          console.error(
            `Supabase fetch error: ${response.status} ${response.statusText}`
          );
          // Log response details for debugging
          try {
            const errorData = await response.clone().text();
            console.error("Error response:", errorData);
          } catch (e) {
            console.error("Could not read error response");
          }

          // For 429 (Too Many Requests), wait longer before retrying
          if (response.status === 429) {
            const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
            console.log(`Rate limited, waiting ${waitTime}ms before retry`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }
        }

        return response;
      } catch (error) {
        console.error(
          `Supabase fetch exception (attempt ${retries + 1}/${maxRetries}):`,
          error
        );

        if (retries < maxRetries - 1) {
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`Waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error; // Rethrow after max retries
        }
      }
    }
    // Should not reach here if fetch succeeded or error was thrown
    throw new Error("Supabase fetch failed after multiple retries.");
  };

  // Create the Supabase client with options
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: customFetch,
    },
    db: {
      schema: "public",
    },
  });

  // Test the connection immediately with a simpler query - Keep for debugging if needed
  (async () => {
    try {
      console.log("Testing Supabase connection...");
      const { data, error } = await supabase
        .from("ultimate-table") // Use a known table
        .select("dotcounty") // Select a simple column
        .limit(1);

      if (error) {
        console.error("Supabase connection test failed:", error);
      } else {
        console.log("Supabase connection test successful:", data);
      }
    } catch (e) {
      console.error("Supabase connection test exception:", e);
    }
  })();
}
// --- End Supabase Client ---

// Dynamically import the map component, disable SSR
const PlaygroundMap = dynamic(() => import("./PlaygroundMap"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-96">
      <p>Loading map...</p>
    </div>
  ), // Optional loading indicator
});

export default function ConsolidatedPlaygroundPage() {
  // Keep state needed for filters and loading/error display
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [loadedSegments, setLoadedSegments] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  // Ref for the PlaygroundMap component instance to call methods like zoomTo
  const playgroundMapRef = useRef(null); // This ref might not be needed if zoom controls are local

  // Keep filter handling functions
  const handleDateChange = (e, field) => {
    setDateRange((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const applyFilters = () => {
    // The dateRange state update will trigger the useEffect in PlaygroundMap
    // to reload the data. No explicit call needed here.
    setShowFilters(false); // Close filter panel after applying
    console.log("Applying filters:", dateRange);
  };

  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    // Similar to apply, state change triggers reload in child component
    setShowFilters(false);
  };

  // Callback for progress updates from PlaygroundMap
  const handleProgressChange = (progress) => {
    setLoadingMessage(progress.message);
    setLoadedSegments(progress.processed);
    setTotalSegments(progress.total);
  };

  // Render the main page layout
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          Consolidated Road Segment Playground
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
          <Link href="/">
            <span className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors cursor-pointer">
              Back to Home
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col relative">
        {/* Filter Panel (Conditional Rendering) */}
        {showFilters && (
          <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-700 p-4 shadow-lg z-20 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">
              Filter Road Segments
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={dateRange.start}
                  onChange={(e) => handleDateChange(e, "start")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={dateRange.end}
                  onChange={(e) => handleDateChange(e, "end")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors dark:bg-gray-500 dark:text-gray-100 dark:hover:bg-gray-400"
              >
                Reset
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-lg z-30 text-center shadow-xl">
            <p className="font-semibold">Loading Data...</p>
            <p className="text-sm mt-1">{loadingMessage}</p>
            {totalSegments > 0 && (
              <p className="text-xs mt-1">
                ({loadedSegments} / {totalSegments})
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-30 shadow-md">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <svg
                className="fill-current h-6 w-6 text-red-500"
                role="button"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <title>Close</title>
                <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
              </svg>
            </button>
          </div>
        )}

        {/* Map Container - Render the dynamically imported component */}
        <div className="flex-grow w-full h-full mt-0">
          {" "}
          {/* Adjust margin-top if filters are shown */}
          {/* Pass Supabase client, dateRange, and callbacks */}
          {supabase ? ( // Only render map if Supabase client is available
            <PlaygroundMap
              supabase={supabase}
              dateRange={dateRange}
              onLoadingChange={setLoading}
              onErrorChange={setError}
              onProgressChange={handleProgressChange}
              // ref={playgroundMapRef} // Add ref if needed for zoom controls etc.
            />
          ) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-red-600 font-semibold">
                Supabase client failed to initialize. Map cannot be loaded.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
