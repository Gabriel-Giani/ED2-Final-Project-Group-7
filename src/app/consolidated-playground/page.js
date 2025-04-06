"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { Style, Stroke } from "ol/style";
import Overlay from "ol/Overlay";
import { createClient } from "@supabase/supabase-js";
import wellknown from "wellknown";

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL configured:", supabaseUrl ? "Yes" : "No");
console.log("Supabase Anon Key configured:", supabaseAnonKey ? "Yes" : "No");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing!");
}

// Simple in-memory cache
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

// Create a custom fetch function with error handling and retry logic
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
        throw error;
      }
    }
  }
};

// Create the Supabase client with options
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

// Test the connection immediately with a simpler query
(async () => {
  try {
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase
      .from("ultimate-table")
      .select("dotcounty")
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
// --- End Supabase Client ---

// --- Road Data Functions ---

/**
 * Gets major road data from the major-roads table
 * and maps accident data to these road segments
 */
async function getMajorRoadSegments(
  startDate,
  endDate,
  startTime,
  endTime,
  progressCallback = null
) {
  console.log("Fetching major road segments...");

  try {
    // First, get the road segments from the major-roads table
    const { data: roadData, error: roadError } = await supabase
      .from("major-roads")
      .select("WKT, LINEARID, FULLNAME, RTTYP, MTFCC")
      .limit(1000); // Limit for performance, can be adjusted

    if (roadError) {
      console.error("Error fetching major roads:", roadError);
      throw roadError;
    }

    console.log(`Fetched ${roadData?.length || 0} major road segments`);

    if (!roadData || roadData.length === 0) {
      return [];
    }

    // Now, fetch accident data with filters
    let query = supabase.from("ultimate-table").select("*");

    // Apply date and time filters if provided
    if (startDate && endDate) {
      query = query.gte("crashdate", startDate).lte("crashdate", endDate);
    }

    if (startTime && endTime) {
      query = query.gte("crashtime", startTime).lte("crashtime", endTime);
    }

    // Limit to prevent performance issues
    query = query.limit(10000);

    const { data: accidentData, error: accidentError } = await query;

    if (accidentError) {
      console.error("Error fetching accident data:", accidentError);
      throw accidentError;
    }

    console.log(`Fetched ${accidentData?.length || 0} accidents`);

    // Process the road segments with accident data
    const processedSegments = await mapAccidentsToRoadSegments(
      roadData,
      accidentData,
      progressCallback
    );

    return processedSegments;
  } catch (error) {
    console.error("Error in getMajorRoadSegments:", error);
    return [];
  }
}

/**
 * Maps accident data to major road segments
 */
async function mapAccidentsToRoadSegments(
  roadData,
  accidentData,
  progressCallback
) {
  try {
    // Parse WKT data to get actual coordinates of road segments
    const parsedRoadSegments = roadData
      .map((road) => {
        try {
          // Parse WKT to GeoJSON
          const geometry = wellknown.parse(road.WKT);

          return {
            id: road.LINEARID,
            name: road.FULLNAME,
            roadType: road.RTTYP,
            mtfcc: road.MTFCC,
            geometry: geometry,
            // Initialize empty accident data
            accidents: [],
            bbox: calculateBoundingBox(geometry.coordinates),
          };
        } catch (e) {
          console.error(`Error parsing WKT for road ${road.LINEARID}:`, e);
          return null;
        }
      })
      .filter(Boolean);

    // Process in batches for better UI responsiveness
    const batchSize = 100;
    let processedCount = 0;
    const totalRoads = parsedRoadSegments.length;

    // Report initial progress
    if (progressCallback) {
      progressCallback({
        processed: processedCount,
        total: totalRoads,
      });
    }

    // Assign accidents to road segments
    for (let i = 0; i < parsedRoadSegments.length; i += batchSize) {
      const batch = parsedRoadSegments.slice(
        i,
        Math.min(i + batchSize, parsedRoadSegments.length)
      );

      // Process each road segment in batch
      batch.forEach((segment) => {
        // Find accidents that are within a certain distance of this road segment
        const matchingAccidents = accidentData.filter((accident) => {
          if (!accident.latitude || !accident.longitude) return false;

          // Check if this accident is on the same named road
          const isOnSameRoad =
            segment.name &&
            accident.onroadname &&
            accident.onroadname
              .toLowerCase()
              .includes(segment.name.toLowerCase());

          // If not on same road, check if it's geographically close to the road
          if (!isOnSameRoad) {
            // Check if accident is within the expanded bounding box of the road
            const lat = parseFloat(accident.latitude);
            const lon = parseFloat(accident.longitude);

            // Add some padding to the bounding box
            const padding = 0.001; // Approximately 100 meters

            if (
              lon >= segment.bbox.minLon - padding &&
              lon <= segment.bbox.maxLon + padding &&
              lat >= segment.bbox.minLat - padding &&
              lat <= segment.bbox.maxLat + padding
            ) {
              // For better precision, we could also calculate the distance to the line
              // But this approximation works well for our visualization
              return true;
            }
            return false;
          }

          return isOnSameRoad;
        });

        segment.accidents = matchingAccidents;
      });

      // Update progress
      processedCount += batch.length;
      if (progressCallback) {
        progressCallback({
          processed: processedCount,
          total: totalRoads,
        });
      }

      // Small delay to prevent UI freezing
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Calculate intensity based on accident count for each segment
    const processedRoadSegments = parsedRoadSegments
      .map((segment) => {
        // Only keep segments that have accidents
        if (segment.accidents.length === 0) {
          return null;
        }

        // Calculate the length of the road segment
        const segmentLength = calculateLineLength(segment.geometry.coordinates);

        // Calculate accidents per km for intensity - capped at a reasonable maximum
        const accidentsPerKm =
          segmentLength > 0
            ? Math.min(segment.accidents.length / (segmentLength / 1000), 20)
            : segment.accidents.length;

        // Normalize intensity to 0-1 range (with 20 accidents per km as max)
        const intensity = Math.min(accidentsPerKm / 20, 1);

        return {
          id: segment.id,
          name: segment.name,
          roadType: segment.roadType,
          count: segment.accidents.length,
          length: segmentLength,
          intensity,
          geometry: {
            type: "LineString",
            coordinates: segment.geometry.coordinates,
          },
        };
      })
      .filter(Boolean);

    // Sort by intensity (highest first)
    return processedRoadSegments.sort((a, b) => b.intensity - a.intensity);
  } catch (error) {
    console.error("Error mapping accidents to road segments:", error);
    return [];
  }
}

/**
 * Calculates a bounding box for a set of coordinates
 */
function calculateBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return {
      minLon: 0,
      minLat: 0,
      maxLon: 0,
      maxLat: 0,
    };
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  coordinates.forEach((coord) => {
    const [lon, lat] = coord;
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });

  return {
    minLon,
    minLat,
    maxLon,
    maxLat,
  };
}

/**
 * Calculates the length of a line in kilometers
 */
function calculateLineLength(coordinates) {
  let totalDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];

    totalDistance += calculateGeoDistance(lat1, lon1, lat2, lon2);
  }

  return totalDistance * 1000; // Convert to meters
}

/**
 * Calculate great-circle distance between two points using the Haversine formula
 * Returns distance in kilometers
 */
function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 */
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
// --- End Road Data Functions ---

// Florida bounding box coordinates (with small margin)
const FLORIDA_EXTENT = [
  -87.8, // Western boundary (slightly west of Pensacola)
  24.2, // Southern boundary (includes the Keys)
  -79.7, // Eastern boundary (past Jacksonville)
  31.2, // Northern boundary (slightly north of the Florida/Georgia border)
];

// Convert the geographic coordinates to the projection used by OpenLayers
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
];

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 9; // Increased default zoom

// Function to generate a color based on intensity (0-1)
function getHeatColor(intensity) {
  // Google Maps style traffic colors (Green to Yellow to Red)
  if (intensity < 0.33) {
    // Green (low intensity)
    return `rgba(0, 220, 0, 0.8)`;
  } else if (intensity < 0.66) {
    // Yellow (medium intensity)
    return `rgba(255, 220, 0, 0.8)`;
  } else {
    // Red (high intensity)
    return `rgba(220, 0, 0, 0.8)`;
  }
}

export default function ConsolidatedPlaygroundPage() {
  // Renamed component
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [loadedSegments, setLoadedSegments] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  // Initialize map on component mount
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Create the map
      const map = new Map({
        target: mapContainerRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
            zIndex: 0,
          }),
        ],
        view: new View({
          center: fromLonLat([-82.5, 28.1]), // Center of Florida
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true,
        }),
      });

      mapRef.current = map;

      // Load road data initially
      loadRoadData();
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, []);

  // Zoom to specific location
  const zoomTo = (location) => {
    if (!mapRef.current) return;

    let center, zoom;

    switch (location) {
      case "miami":
        center = fromLonLat([-80.1918, 25.7617]);
        zoom = 12;
        break;
      case "orlando":
        center = fromLonLat([-81.3792, 28.5383]);
        zoom = 12;
        break;
      case "tampa":
        center = fromLonLat([-82.4572, 27.9506]);
        zoom = 12;
        break;
      case "jacksonville":
        center = fromLonLat([-81.6557, 30.3322]);
        zoom = 12;
        break;
      default:
        // Default to full Florida view
        center = fromLonLat([-82.5, 28.1]);
        zoom = DEFAULT_ZOOM;
    }

    mapRef.current.getView().animate({
      center: center,
      zoom: zoom,
      duration: 1000,
    });
  };

  // Load road segments with accident data
  async function loadRoadData() {
    setError(null);
    setLoading(true);
    setLoadingMessage("Fetching road data...");
    setLoadedSegments(0);
    setTotalSegments(0);

    try {
      // Get road segments from the major-roads table with accident data
      // Now calls the function defined within this file
      const roadSegments = await getMajorRoadSegments(
        dateRange.start || null,
        dateRange.end || null,
        null,
        null,
        (progress) => {
          // Update progress
          setLoadingMessage(
            `Processing road segments (${progress.processed}/${progress.total})...`
          );
          setLoadedSegments(progress.processed);
          setTotalSegments(progress.total);
        }
      );

      if (!roadSegments || roadSegments.length === 0) {
        setError("No road data found for the selected period.");
        setLoading(false);
        return;
      }

      console.log(
        `Loaded ${roadSegments.length} road segments with accident data`
      );
      setLoadingMessage("Rendering map...");

      // Create a vector source for road segments
      const source = new VectorSource();

      // Convert road segments to OpenLayers features
      roadSegments.forEach((segment) => {
        if (
          segment.geometry &&
          segment.geometry.coordinates &&
          segment.geometry.coordinates.length >= 2
        ) {
          // Create a line feature for the road segment
          const feature = new Feature({
            geometry: new LineString(
              segment.geometry.coordinates.map((coord) => fromLonLat(coord))
            ),
            // Store properties for styling and popups
            intensity: segment.intensity,
            count: segment.count,
            name: segment.name,
            roadType: segment.roadType,
            length: segment.length,
            accidentsPerKm: segment.count / (segment.length / 1000),
          });

          // Set style based on accident intensity
          feature.setStyle(
            new Style({
              stroke: new Stroke({
                color: getHeatColor(segment.intensity),
                width: 3 + segment.intensity * 6, // Width increases with intensity
              }),
            })
          );

          source.addFeature(feature);
        }
      });

      // Create a vector layer for the road segments
      const roadLayer = new VectorLayer({
        source: source,
        zIndex: 1,
      });

      // Add the layer to the map
      if (mapRef.current) {
        // Remove any existing road layers
        mapRef.current.getLayers().forEach((layer) => {
          if (layer.get("name") === "roadLayer") {
            mapRef.current.removeLayer(layer);
          }
        });

        roadLayer.set("name", "roadLayer");
        mapRef.current.addLayer(roadLayer);

        // Add a hover interaction for showing road segment info
        addRoadInfoInteraction(mapRef.current, source);
      }
    } catch (error) {
      console.error("Error loading road data:", error);
      setError("Error loading road data. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  // Add hover interaction to show road segment information
  function addRoadInfoInteraction(map, source) {
    // Remove any existing overlay
    const existingOverlay = map.getOverlayById("road-info");
    if (existingOverlay) {
      map.removeOverlay(existingOverlay);
    }

    // Create tooltip element
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "ol-tooltip hidden";
    tooltipElement.style.position = "absolute";
    tooltipElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    tooltipElement.style.color = "white";
    tooltipElement.style.padding = "8px";
    tooltipElement.style.borderRadius = "4px";
    tooltipElement.style.pointerEvents = "none";
    tooltipElement.style.zIndex = "1000";
    tooltipElement.style.fontSize = "12px";
    tooltipElement.style.maxWidth = "300px";

    // Add tooltip to document
    document.body.appendChild(tooltipElement);

    // Create and add overlay
    const tooltip = new Overlay({
      element: tooltipElement,
      id: "road-info",
      offset: [0, -10],
      positioning: "bottom-center",
    });
    map.addOverlay(tooltip);

    // Variables to track pointer interaction
    let currentFeature = null;

    // Add pointer move listener
    map.on("pointermove", function (evt) {
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);

      map.getTargetElement().style.cursor = hit ? "pointer" : "";

      if (hit) {
        const feature = map.forEachFeatureAtPixel(pixel, function (feature) {
          return feature;
        });

        if (feature) {
          const properties = {
            name: feature.get("name") || "Unknown Road",
            count: feature.get("count") || 0,
            intensity: feature.get("intensity") || 0,
            length: feature.get("length") || 0,
            accidentsPerKm: feature.get("accidentsPerKm") || 0,
            roadType: feature.get("roadType") || "",
          };

          // Format tooltip content
          tooltipElement.innerHTML = `
            <div>
              <strong>${properties.name}</strong>
              ${
                properties.roadType
                  ? `<div>Type: ${properties.roadType}</div>`
                  : ""
              }
              <div>Accidents: ${properties.count}</div>
              <div>Length: ${(properties.length / 1000).toFixed(2)} km</div>
              <div>Accidents/km: ${properties.accidentsPerKm.toFixed(2)}</div>
              <div>Relative danger: ${Math.round(
                properties.intensity * 100
              )}%</div>
            </div>
          `;

          // Show the tooltip
          tooltipElement.classList.remove("hidden");
          const coordinate = evt.coordinate;
          tooltip.setPosition(coordinate);
          currentFeature = feature;
        }
      } else {
        // Hide the tooltip when not hovering over a feature
        tooltipElement.classList.add("hidden");
        currentFeature = null;
      }
    });
  }

  // Handle date change for filters
  const handleDateChange = (e, field) => {
    setDateRange({
      ...dateRange,
      [field]: e.target.value,
    });
  };

  // Apply filters
  const applyFilters = () => {
    loadRoadData();
  };

  // Reset filters
  const resetFilters = () => {
    setDateRange({ start: "", end: "" });
    loadRoadData();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header Bar */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Main
          </Link>
          <h1 className="text-xl font-bold">
            Consolidated Florida Traffic Layer
          </h1>
        </div>

        <div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
      </div>

      {/* Map Container with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`bg-gray-800 ${
            showFilters ? "w-64" : "w-0"
          } transition-all duration-300 overflow-hidden flex flex-col`}
        >
          {showFilters && (
            <div className="p-4 h-full overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>

              {/* Date Range Filter */}
              <div className="mb-4">
                <h3 className="font-medium mb-2">Date Range</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-400">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => handleDateChange(e, "start")}
                      className="w-full bg-gray-700 text-white p-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => handleDateChange(e, "end")}
                      className="w-full bg-gray-700 text-white p-2 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Filter Action Buttons */}
              <div className="space-y-2 mt-4">
                <button
                  onClick={applyFilters}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
                  disabled={loading}
                >
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
                  disabled={loading}
                >
                  Reset Filters
                </button>
              </div>

              {/* Quick City Links */}
              <div className="mt-6">
                <h3 className="font-medium mb-2">Quick Navigate</h3>
                <div className="space-y-2">
                  {["miami", "orlando", "tampa", "jacksonville", "all"].map(
                    (city) => (
                      <button
                        key={city}
                        onClick={() => zoomTo(city)}
                        className="block w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded capitalize"
                      >
                        {city === "all" ? "All of Florida" : city}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Map Content */}
        <div className="flex-1 relative">
          {/* Map */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-gray-800 p-6 rounded-lg max-w-md">
                <h3 className="text-lg font-bold mb-2">Loading</h3>
                <p className="mb-4">{loadingMessage}</p>
                {totalSegments > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{
                        width: `${Math.round(
                          (loadedSegments / totalSegments) * 100
                        )}%`,
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
