import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../app/supabaseClient";

/**
 * Get road segments with accident data for traffic-style visualization
 * This function ensures segments follow roads precisely and calculates
 * accurate accident density for color coding
 */
export async function getTrafficStyleRoadSegments(
  startDate,
  endDate,
  startTime,
  endTime,
  progressCallback = null
) {
  console.log("Fetching road segments for traffic-style visualization...");

  try {
    // Build the query based on provided filters
    let query = supabase.from("ultimate-table").select("*");

    // Apply date and time filters if provided
    if (startDate && endDate) {
      query = query.gte("crashdate", startDate).lte("crashdate", endDate);
    }

    if (startTime && endTime) {
      query = query.gte("crashtime", startTime).lte("crashtime", endTime);
    }

    // Limit to prevent performance issues
    query = query.limit(8000);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching accident data for road segments:", error);
      throw error;
    }

    console.log(`Fetched ${data?.length || 0} accidents for road segments`);

    if (!data || data.length === 0) {
      return [];
    }

    // Group accidents by road segments
    const roadSegments = await processRoadSegmentsWithOSM(
      data,
      progressCallback
    );

    return roadSegments;
  } catch (error) {
    console.error("Error in getTrafficStyleRoadSegments:", error);
    return [];
  }
}

/**
 * Process accident data into road segments using OpenStreetMap data
 * Creates linestrings that follow actual road geometries
 */
async function processRoadSegmentsWithOSM(accidents, progressCallback = null) {
  try {
    // Group accidents by road names and location
    const roadGroups = {};

    accidents.forEach((accident) => {
      if (!accident.latitude || !accident.longitude || !accident.onroadname) {
        return;
      }

      // Create a key that combines road name, county and city for more precise segments
      const county = accident.dotcounty
        ? getCountyNameFromCode(accident.dotcounty)
        : "unknown";
      const city = accident.townname || "unknown";

      // Create a road segment key with enough specificity to separate segments properly
      const segmentKey = `${accident.onroadname}|${county}|${city}`;

      if (!roadGroups[segmentKey]) {
        roadGroups[segmentKey] = {
          name: accident.onroadname,
          county,
          city,
          accidentPoints: [],
          accidents: [],
          bbox: {
            minLon: Infinity,
            minLat: Infinity,
            maxLon: -Infinity,
            maxLat: -Infinity,
          },
        };
      }

      const lon = parseFloat(accident.longitude);
      const lat = parseFloat(accident.latitude);

      // Add the accident coordinates and update bounding box
      roadGroups[segmentKey].accidentPoints.push({ lon, lat });
      roadGroups[segmentKey].accidents.push(accident);

      // Update bounding box
      roadGroups[segmentKey].bbox.minLon = Math.min(
        roadGroups[segmentKey].bbox.minLon,
        lon
      );
      roadGroups[segmentKey].bbox.minLat = Math.min(
        roadGroups[segmentKey].bbox.minLat,
        lat
      );
      roadGroups[segmentKey].bbox.maxLon = Math.max(
        roadGroups[segmentKey].bbox.maxLon,
        lon
      );
      roadGroups[segmentKey].bbox.maxLat = Math.max(
        roadGroups[segmentKey].bbox.maxLat,
        lat
      );
    });

    // Process each road group to get actual road geometries from OSM
    const processedSegments = [];

    // Process road segments in batches to avoid overwhelming the OSM API
    const roadKeys = Object.keys(roadGroups);
    const batchSize = 5;
    let processedCount = 0;
    const totalRoads = roadKeys.length;

    // Report initial progress
    if (progressCallback) {
      progressCallback({
        processed: processedCount,
        total: totalRoads,
      });
    }

    for (let i = 0; i < roadKeys.length; i += batchSize) {
      const batch = roadKeys.slice(i, i + batchSize);
      const batchPromises = batch.map(async (key) => {
        const group = roadGroups[key];

        // Need at least 2 points to form a line
        if (group.accidentPoints.length < 2) {
          return null;
        }

        try {
          // Get road geometry from OSM using the accident points as reference
          const roadGeometry = await fetchRoadGeometryFromOSM(group);

          if (!roadGeometry || roadGeometry.length < 2) {
            // If no OSM data, fall back to connecting accident points with improved algorithm
            return createSegmentFromAccidentPoints(key, group);
          }

          // Calculate intensity based on accident count and road length
          const accidentCount = group.accidents.length;

          // Calculate road length from the geometry
          const segmentLength = calculateRoadLength(roadGeometry);

          // Calculate accidents per km for intensity - capped at a reasonable maximum
          const accidentsPerKm =
            segmentLength > 0
              ? Math.min(accidentCount / (segmentLength / 1000), 20)
              : accidentCount;

          // Normalize intensity to 0-1 range (with 20 accidents per km as max)
          const intensity = Math.min(accidentsPerKm / 20, 1);

          return {
            id: `road-${key}`,
            name: group.name,
            county: group.county,
            city: group.city,
            count: accidentCount,
            length: segmentLength,
            intensity,
            isRealRoad: true, // Flag indicating this is using actual OSM road data
            geometry: {
              type: "LineString",
              coordinates: roadGeometry,
            },
          };
        } catch (error) {
          console.error(`Error processing road segment ${key}:`, error);
          // Fall back to connecting accident points with improved algorithm
          return createSegmentFromAccidentPoints(key, group);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(Boolean);
      processedSegments.push(...validResults);

      // Update progress
      processedCount += batch.length;
      if (progressCallback) {
        progressCallback({
          processed: processedCount,
          total: totalRoads,
        });
      }

      // Small delay to avoid overwhelming the OSM API
      if (i + batchSize < roadKeys.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Sort segments by intensity for proper rendering (most severe on top)
    return processedSegments.sort((a, b) => b.intensity - a.intensity);
  } catch (error) {
    console.error("Error in processRoadSegmentsWithOSM:", error);
    return [];
  }
}

/**
 * Fetch road geometries from OpenStreetMap for a given road group
 */
async function fetchRoadGeometryFromOSM(roadGroup) {
  try {
    // Expand the bounding box slightly to ensure we get the complete road
    const bbox = roadGroup.bbox;
    const padding = 0.01; // About 1km padding

    // Construct the Overpass API query to get roads
    const query = `
      [out:json];
      (
        way["highway"]["name"~"${roadGroup.name.replace(/[^\w\s]/g, ".")}",i]
          (${bbox.minLat - padding},${bbox.minLon - padding},
           ${bbox.maxLat + padding},${bbox.maxLon + padding});
      );
      out body;
      >;
      out skel qt;
    `;

    // Query the Overpass API
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OSM data: ${response.status}`);
    }

    const osmData = await response.json();

    // Process OSM data to extract road geometries
    const nodes = {};
    osmData.elements.forEach((element) => {
      if (element.type === "node") {
        nodes[element.id] = [element.lon, element.lat];
      }
    });

    // Find the way that best matches our road
    const ways = osmData.elements.filter(
      (element) =>
        element.type === "way" && element.tags && element.tags.highway
    );

    if (ways.length === 0) {
      return null;
    }

    // If multiple ways, find the one that's closest to our accident points
    let bestWay = ways[0];
    let bestScore = -Infinity;

    ways.forEach((way) => {
      // Check if the name matches or is similar
      const nameScore =
        way.tags.name &&
        (way.tags.name.toLowerCase().includes(roadGroup.name.toLowerCase()) ||
          roadGroup.name.toLowerCase().includes(way.tags.name.toLowerCase()))
          ? 10
          : 0;

      // Check if the way is close to our accident points
      let proximityScore = 0;
      roadGroup.accidentPoints.forEach((point) => {
        // Calculate minimum distance from the point to any node in the way
        let minDistance = Infinity;
        way.nodes.forEach((nodeId) => {
          if (nodes[nodeId]) {
            const distance = calculateDistance(
              [point.lon, point.lat],
              nodes[nodeId]
            );
            minDistance = Math.min(minDistance, distance);
          }
        });
        // Add an inverse of the distance to the score (closer is better)
        proximityScore += minDistance < 0.01 ? 1 : 0;
      });

      const score = nameScore + proximityScore;
      if (score > bestScore) {
        bestScore = score;
        bestWay = way;
      }
    });

    // Extract the coordinates for the best way
    const geometry = bestWay.nodes
      .map((nodeId) => nodes[nodeId])
      .filter(Boolean);

    return geometry;
  } catch (error) {
    console.error("Error fetching road geometry from OSM:", error);
    return null;
  }
}

/**
 * Create a road segment from accident points when OSM data is not available
 * Uses an improved algorithm to better follow roads
 */
function createSegmentFromAccidentPoints(key, group) {
  // Convert points array to the format expected by the sort function
  const coordinates = group.accidentPoints.map((point) => [
    point.lon,
    point.lat,
  ]);

  // Use Douglas-Peucker algorithm to simplify the line and reduce noise
  const simplifiedCoordinates = simplifyLine(
    sortCoordinatesForRoadline(coordinates),
    0.0001
  );

  // Calculate intensity for colorization based on accident density
  const accidentCount = group.accidents.length;

  // Estimate segment length in meters
  const segmentLength = estimateRoadLength(simplifiedCoordinates);

  // Calculate accidents per km for intensity - capped at a reasonable maximum
  const accidentsPerKm =
    segmentLength > 0
      ? Math.min(accidentCount / (segmentLength / 1000), 20)
      : accidentCount;

  // Normalize intensity to 0-1 range (with 20 accidents per km as max)
  const intensity = Math.min(accidentsPerKm / 20, 1);

  return {
    id: `road-${key}`,
    name: group.name,
    county: group.county,
    city: group.city,
    count: accidentCount,
    length: segmentLength,
    intensity,
    isRealRoad: false, // Flag indicating this is NOT using actual OSM road data
    geometry: {
      type: "LineString",
      coordinates: simplifiedCoordinates,
    },
  };
}

/**
 * Douglas-Peucker algorithm to simplify a line by removing points
 * that don't contribute significantly to its shape
 */
function simplifyLine(points, epsilon) {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance
  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const firstLine = simplifyLine(points.slice(0, index + 1), epsilon);
    const secondLine = simplifyLine(points.slice(index), epsilon);

    // Concatenate the results
    return firstLine.slice(0, -1).concat(secondLine);
  } else {
    // Return just the endpoints
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculate perpendicular distance from a point to a line defined by two points
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const x = point[0];
  const y = point[1];
  const x1 = lineStart[0];
  const y1 = lineStart[1];
  const x2 = lineEnd[0];
  const y2 = lineEnd[1];

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Sort coordinates to form a coherent line following a road
 * Uses nearest-neighbor algorithm to connect points in sequence
 */
function sortCoordinatesForRoadline(coordinates) {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  // Use a greedy nearest-neighbor approach to order points
  const sortedCoordinates = [coordinates[0]];
  const remainingPoints = [...coordinates.slice(1)];

  while (remainingPoints.length > 0) {
    const currentPoint = sortedCoordinates[sortedCoordinates.length - 1];

    // Find nearest point from remaining points
    let nearestIndex = 0;
    let minDistance = calculateDistance(currentPoint, remainingPoints[0]);

    for (let i = 1; i < remainingPoints.length; i++) {
      const distance = calculateDistance(currentPoint, remainingPoints[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    // Add nearest point to sorted list and remove from remaining points
    sortedCoordinates.push(remainingPoints[nearestIndex]);
    remainingPoints.splice(nearestIndex, 1);
  }

  return sortedCoordinates;
}

/**
 * Calculate road length from coordinates
 */
function calculateRoadLength(coordinates) {
  let totalLength = 0;

  for (let i = 1; i < coordinates.length; i++) {
    totalLength += calculateGeoDistance(
      coordinates[i - 1][1],
      coordinates[i - 1][0],
      coordinates[i][1],
      coordinates[i][0]
    );
  }

  return totalLength;
}

/**
 * Calculate distance between two points (in lon/lat format)
 */
function calculateDistance(point1, point2) {
  // Simple Euclidean distance for sorting (not actual geographic distance)
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate accurate geographic distance between points in meters
 * Uses the Haversine formula
 */
function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // distance in meters

  return d;
}

/**
 * Estimate road length in meters from coordinates
 */
function estimateRoadLength(coordinates) {
  let totalLength = 0;

  for (let i = 1; i < coordinates.length; i++) {
    totalLength += calculateGeoDistance(
      coordinates[i - 1][1],
      coordinates[i - 1][0],
      coordinates[i][1],
      coordinates[i][0]
    );
  }

  return totalLength;
}

/**
 * Convert county code to county name
 */
function getCountyNameFromCode(code) {
  const COUNTY_CODES = {
    "01": "Alachua",
    "02": "Baker",
    "03": "Bay",
    "04": "Bradford",
    "05": "Brevard",
    "06": "Broward",
    "07": "Calhoun",
    "08": "Charlotte",
    "09": "Citrus",
    10: "Clay",
    11: "Collier",
    12: "Columbia",
    13: "Miami-Dade",
    14: "DeSoto",
    15: "Dixie",
    16: "Duval",
    17: "Escambia",
    18: "Flagler",
    19: "Franklin",
    20: "Gadsden",
    21: "Gilchrist",
    22: "Glades",
    23: "Gulf",
    24: "Hamilton",
    25: "Hardee",
    26: "Hendry",
    27: "Hernando",
    28: "Highlands",
    29: "Hillsborough",
    30: "Holmes",
    31: "Indian River",
    32: "Jackson",
    33: "Jefferson",
    34: "Lafayette",
    35: "Lake",
    36: "Lee",
    37: "Leon",
    38: "Levy",
    39: "Liberty",
    40: "Madison",
    41: "Manatee",
    42: "Marion",
    43: "Martin",
    44: "Monroe",
    45: "Nassau",
    46: "Okaloosa",
    47: "Okeechobee",
    48: "Orange",
    49: "Osceola",
    50: "Palm Beach",
    51: "Pasco",
    52: "Pinellas",
    53: "Polk",
    54: "Putnam",
    55: "St. Johns",
    56: "St. Lucie",
    57: "Santa Rosa",
    58: "Sarasota",
    59: "Seminole",
    60: "Sumter",
    61: "Suwannee",
    62: "Taylor",
    63: "Union",
    64: "Volusia",
    65: "Wakulla",
    66: "Walton",
    67: "Washington",
  };

  return COUNTY_CODES[code] || "Unknown";
}
