import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../app/supabaseClient";
import { getCountyNameFromCode } from "./hotspots";
import wellknown from "wellknown";

/**
 * Gets major road data from the major-roads table
 * and maps accident data to these road segments
 */
export async function getMajorRoadSegments(
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
