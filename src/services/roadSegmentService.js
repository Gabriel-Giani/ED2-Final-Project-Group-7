import { supabase } from "@/app/supabaseClient"; // Corrected Supabase client path
import wellknown from "wellknown";
import { accidentDataService } from "./accidentDataService"; // Import only the service object

// --- Helper Functions (Copied from consolidated-playground) ---

/**
 * Calculates a bounding box for a set of coordinates
 */
function calculateBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 };
  }
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  coordinates.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Converts degrees to radians
 */
function deg2rad(deg) {
  return deg * (Math.PI / 180);
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
 * Calculates the length of a line in meters
 */
function calculateLineLength(coordinates) {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    totalDistance += calculateGeoDistance(lat1, lon1, lat2, lon2);
  }
  return totalDistance * 1000; // Convert km to meters
}

// Copied Helper function to convert time to database format (HHMM) number
const convertTimeToDbFormat = (timeString) => {
  if (!timeString || !timeString.includes(":")) return NaN; // Return NaN if format is invalid
  const [hours, minutes] = timeString.split(":");
  const hhmmString = `${hours.padStart(2, "0")}${minutes.padStart(2, "0")}`;
  const timeInt = parseInt(hhmmString, 10);
  return isNaN(timeInt) ? NaN : timeInt; // Return NaN if parsing fails
};

/**
 * Maps accident data to major road segments
 * (Internal function, adapted from consolidated-playground)
 */
async function mapAccidentsToRoadSegments(
  roadData,
  accidentData,
  progressCallback
) {
  try {
    const parsedRoadSegments = roadData
      .map((road) => {
        try {
          const geometry = wellknown.parse(road.WKT);
          if (
            !geometry ||
            !geometry.coordinates ||
            geometry.type !== "LineString"
          ) {
            console.warn(
              `Skipping road ${road.LINEARID} due to invalid geometry:`,
              road.WKT
            );
            return null;
          }
          return {
            id: road.LINEARID,
            name: road.FULLNAME,
            roadType: road.RTTYP,
            mtfcc: road.MTFCC,
            geometry: geometry,
            accidents: [],
            bbox: calculateBoundingBox(geometry.coordinates),
          };
        } catch (e) {
          console.error(
            `Error parsing WKT for road ${road.LINEARID}:`,
            e,
            road.WKT
          );
          return null;
        }
      })
      .filter(Boolean);

    const batchSize = 100;
    let processedCount = 0;
    const totalRoads = parsedRoadSegments.length;

    if (progressCallback) {
      progressCallback({
        processed: processedCount,
        total: totalRoads,
        message: "Mapping accidents to roads...",
      });
    }

    for (let i = 0; i < parsedRoadSegments.length; i += batchSize) {
      const batch = parsedRoadSegments.slice(
        i,
        Math.min(i + batchSize, parsedRoadSegments.length)
      );

      batch.forEach((segment) => {
        const matchingAccidents = accidentData.filter((accident) => {
          if (!accident.latitude || !accident.longitude) return false;
          const lat = parseFloat(accident.latitude);
          const lon = parseFloat(accident.longitude);
          const padding = 0.001; // Approx 100m BBox padding

          // Primary Check: Accident within the segment's padded bounding box
          if (
            lon >= segment.bbox.minLon - padding &&
            lon <= segment.bbox.maxLon + padding &&
            lat >= segment.bbox.minLat - padding &&
            lat <= segment.bbox.maxLat + padding
          ) {
            // Secondary Check (Optional but good): Check if accident mentions the road name
            const isOnSameRoad =
              segment.name &&
              accident.onroadname &&
              accident.onroadname
                .toLowerCase()
                .includes(segment.name.toLowerCase());

            // Consider it a match if it's in the bbox, prioritizing those on the same named road
            // This is a simplification; true point-to-line distance is more accurate but expensive
            return true; // Keeping it simple based on playground logic for now
          }
          return false;
        });
        segment.accidents = matchingAccidents;
      });

      processedCount += batch.length;
      if (progressCallback) {
        progressCallback({
          processed: processedCount,
          total: totalRoads,
          message: `Mapping accidents (${processedCount}/${totalRoads})...`,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0)); // Prevent UI freeze
    }

    const processedRoadSegments = parsedRoadSegments
      .map((segment) => {
        if (segment.accidents.length === 0) return null;

        const segmentLength = calculateLineLength(segment.geometry.coordinates);
        // Avoid division by zero for very short segments or single points
        if (segmentLength <= 0) {
          console.warn(`Segment ${segment.id} has zero or negative length.`);
          // Assign a high intensity if accidents exist but length is zero? Or handle differently?
          // For now, treat as high intensity based on count alone.
          const intensity = Math.min(segment.accidents.length / 5, 1); // Cap intensity based purely on count (e.g., 5 accidents = max intensity)
          return {
            id: segment.id,
            name: segment.name,
            roadType: segment.roadType,
            count: segment.accidents.length,
            length: 0,
            intensity,
            accidentsPerKm: Infinity, // Or handle differently
            geometry: {
              type: "LineString",
              coordinates: segment.geometry.coordinates,
            },
          };
        }

        const accidentsPerKmRaw =
          segment.accidents.length / (segmentLength / 1000);
        // Cap accidentsPerKm at a reasonable max (e.g., 20) to prevent extreme outliers
        const accidentsPerKmCapped = Math.min(accidentsPerKmRaw, 20);
        // Normalize intensity to 0-1 range based on the cap
        const intensity = accidentsPerKmCapped / 20;

        return {
          id: segment.id,
          name: segment.name,
          roadType: segment.roadType,
          count: segment.accidents.length,
          length: segmentLength, // length in meters
          intensity,
          accidentsPerKm: accidentsPerKmRaw, // Store the raw value for info
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

// --- Main Exported Function ---

/**
 * Gets major road data from the major-roads table
 * and maps accident data (filtered) to these road segments.
 */
export async function getMajorRoadLineSegments(
  filters,
  progressCallback = null
) {
  console.log("Fetching major road line segments with filters:", filters);

  try {
    // 1. Fetch major road geometries (limiting for now, consider fetching based on viewport/filters later)
    if (progressCallback)
      progressCallback({ message: "Fetching road geometries..." });
    const { data: roadData, error: roadError } = await supabase
      .from("major-roads")
      .select("WKT, LINEARID, FULLNAME, RTTYP, MTFCC")
      // TODO: Ideally, filter roads based on current view or filters if possible
      .limit(1000); // Keep limit from playground for now

    if (roadError) {
      console.error("Error fetching major roads:", roadError);
      throw roadError;
    }
    if (!roadData || roadData.length === 0) {
      console.log("No major road geometries found.");
      return [];
    }
    console.log(`Fetched ${roadData.length} major road base geometries`);
    if (progressCallback)
      progressCallback({
        message: `Fetched ${roadData.length} road geometries. Fetching accidents...`,
      });

    // 2. Fetch accident data based on filters
    let query = supabase
      .from("ultimate-table")
      .select(
        "latitude, longitude, onroadname, crashdate, crashtime, dotcounty, townname, highestinj, lightcond, weathcond, rdsurfcond, refdirect, fl_aggrsv, fl_ar_teen"
      );

    // Apply Date Filters
    if (filters?.dateRange?.start) {
      query = query.gte("crashdate", filters.dateRange.start);
    }
    if (filters?.dateRange?.end) {
      query = query.lte("crashdate", filters.dateRange.end);
    }

    // Apply Time Filters (if useTimeFilter is true)
    if (filters?.useTimeFilter && filters?.timeRange?.start) {
      const timeIntStart = convertTimeToDbFormat(filters.timeRange.start); // Now returns integer or NaN
      if (!isNaN(timeIntStart)) {
        console.log(
          `Applying time filter: crashtime >= ${timeIntStart} (from ${filters.timeRange.start})`
        );
        query = query.gte("crashtime", timeIntStart);
      } else {
        console.warn(`Could not parse start time: ${filters.timeRange.start}`);
      }
    }
    if (filters?.useTimeFilter && filters?.timeRange?.end) {
      const timeIntEnd = convertTimeToDbFormat(filters.timeRange.end); // Now returns integer or NaN
      if (!isNaN(timeIntEnd)) {
        console.log(
          `Applying time filter: crashtime <= ${timeIntEnd} (from ${filters.timeRange.end})`
        );
        query = query.lte("crashtime", timeIntEnd);
      } else {
        console.warn(`Could not parse end time: ${filters.timeRange.end}`);
      }
    }

    // Apply Region Filters
    if (filters?.filterRegion === "county" && filters?.regionName) {
      const countyCodeStr = accidentDataService.getCountyCodeFromName(
        filters.regionName
      );
      if (countyCodeStr) {
        const countyCodeInt = parseInt(countyCodeStr, 10);
        if (!isNaN(countyCodeInt)) {
          console.log(
            `Applying filter: dotcounty EQ ${countyCodeInt} (Type: ${typeof countyCodeInt})`
          );
          query = query.eq("dotcounty", countyCodeInt);
        } else {
          console.warn(
            `Failed to parse county code string: ${countyCodeStr} for name: ${filters.regionName}. Skipping county filter.`
          );
        }
      } else {
        console.warn(
          `Could not find county code for name: ${filters.regionName}. Skipping county filter.`
        );
      }
    } else if (filters?.filterRegion === "city" && filters?.regionName) {
      // Use ilike for case-insensitive matching of city names
      console.log(`Applying filter: townname ILIKE ${filters.regionName}`);
      query = query.ilike("townname", filters.regionName);
    }

    // Apply Day of Week Filter
    if (filters?.dayOfWeek) {
      // Assuming filters.dayOfWeek is the number 1-7
      const dayOfWeekInt = parseInt(filters.dayOfWeek, 10);
      if (!isNaN(dayOfWeekInt) && dayOfWeekInt >= 1 && dayOfWeekInt <= 7) {
        console.log(`Applying filter: dayofweek EQ ${dayOfWeekInt}`);
        query = query.eq("dayofweek", dayOfWeekInt);
      } else {
        console.warn(
          `Invalid dayOfWeek filter value: ${filters.dayOfWeek}. Skipping filter.`
        );
      }
    }

    // Apply Highest Injury Level Filter
    if (filters?.injuryLevel) {
      const injuryLevelInt = parseInt(filters.injuryLevel, 10);
      // Check if it's a valid number (0-6 according to documentation, adjust if needed)
      if (
        !isNaN(injuryLevelInt) &&
        injuryLevelInt >= 0 &&
        injuryLevelInt <= 6
      ) {
        console.log(`Applying filter: highestinj EQ ${injuryLevelInt}`);
        query = query.eq("highestinj", injuryLevelInt);
      } else {
        console.warn(
          `Invalid injuryLevel filter value: ${filters.injuryLevel}. Skipping filter.`
        );
      }
    }

    // Apply Light Condition Filter
    if (filters?.lightCondition) {
      console.log(`Applying filter: lightcond EQ ${filters.lightCondition}`);
      query = query.eq("lightcond", filters.lightCondition);
    }

    // Apply Weather Condition Filter
    if (filters?.weatherCondition) {
      console.log(`Applying filter: weathcond EQ ${filters.weatherCondition}`);
      query = query.eq("weathcond", filters.weatherCondition);
    }

    // Apply Road Surface Condition Filter
    if (filters?.roadSurfaceCondition) {
      console.log(
        `Applying filter: rdsurfcond EQ ${filters.roadSurfaceCondition}`
      );
      query = query.eq("rdsurfcond", filters.roadSurfaceCondition);
    }

    // Apply Direction Filter
    const validDirections = ["N", "S", "E", "W"];
    if (filters?.direction && validDirections.includes(filters.direction)) {
      console.log(`Applying filter: refdirect EQ ${filters.direction}`);
      query = query.eq("refdirect", filters.direction);
    }

    // Apply Aggressive Driving Filter (Boolean Toggle)
    if (filters?.aggressiveDriving === true) {
      console.log(`Applying filter: fl_aggrsv EQ 'Y'`);
      query = query.eq("fl_aggrsv", "Y");
    }

    // Apply Teen Driver Involved Filter (Boolean Toggle)
    if (filters?.teenInvolved === true) {
      console.log(`Applying filter: fl_ar_teen EQ 'Y'`);
      query = query.eq("fl_ar_teen", "Y"); // Filter for 'Y' when toggle is true
    }

    // Add other filters as needed (e.g., roadName, injuryLevel etc.)
    // Be mindful of performance impact with many filters.

    // Apply limit (essential for performance)
    query = query.limit(10000); // Keep limit from playground

    const { data: accidentData, error: accidentError } = await query;

    if (accidentError) {
      console.error("Error fetching filtered accident data:", accidentError);
      throw accidentError;
    }
    console.log(
      `Fetched ${accidentData?.length || 0} accidents based on filters`
    );
    if (progressCallback)
      progressCallback({
        message: `Fetched ${
          accidentData?.length || 0
        } accidents. Processing...`,
      });

    // 3. Map accidents to road segments
    const processedSegments = await mapAccidentsToRoadSegments(
      roadData,
      accidentData || [], // Ensure accidentData is an array
      progressCallback // Pass callback down
    );

    console.log(
      `Processed ${processedSegments.length} road segments with accidents`
    );
    return processedSegments;
  } catch (error) {
    console.error("Error in getMajorRoadLineSegments:", error);
    if (progressCallback)
      progressCallback({
        error: true,
        message: "Failed to load road segments.",
      });
    return []; // Return empty array on error
  }
}

// Service object structure (optional, but good practice)
export const roadSegmentService = {
  getMajorRoadLineSegments,
};
