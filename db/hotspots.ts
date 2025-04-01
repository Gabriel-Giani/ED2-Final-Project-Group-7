import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../app/supabaseClient";

// Define hotspot types
export interface Hotspot {
  id: string;
  center: [number, number]; // [longitude, latitude]
  intensity: number; // 0-1 scale representing hotspot intensity
  radius: number; // in meters
  count: number; // number of accidents in this hotspot
  road_name?: string;
  county?: string;
  city?: string;
}

export interface RoadSegment {
  id: string;
  name: string;
  geometry: any; // GeoJSON LineString
  county?: string;
  city?: string;
}

// County code mapping
const COUNTY_CODES: Record<string, string> = {
  "01": "Charlotte",
  "02": "Citrus",
  "03": "Collier",
  "04": "Desoto",
  "05": "Glades",
  "06": "Hardee",
  "07": "Hendry",
  "08": "Hernando",
  "09": "Highlands",
  "10": "Hillsborough",
  "11": "Lake",
  "12": "Lee",
  "13": "Manatee",
  "14": "Pasco",
  "15": "Pinellas",
  "16": "Polk",
  "17": "Sarasota",
  "18": "Sumter",
  "26": "Alachua",
  "27": "Baker",
  "28": "Bradford",
  "29": "Columbia",
  "30": "Dixie",
  "31": "Gilchrist",
  "32": "Hamilton",
  "33": "Lafayette",
  "34": "Levy",
  "35": "Madison",
  "36": "Marion",
  "37": "Suwannee",
  "38": "Taylor",
  "39": "Union",
  "46": "Bay",
  "47": "Calhoun",
  "48": "Escambia",
  "49": "Franklin",
  "50": "Gadsden",
  "51": "Gulf",
  "52": "Holmes",
  "53": "Jackson",
  "54": "Jefferson",
  "55": "Leon",
  "56": "Liberty",
  "57": "Okaloosa",
  "58": "Santa Rosa",
  "59": "Wakulla",
  "60": "Walton",
  "61": "Washington",
  "70": "Brevard",
  "71": "Clay",
  "72": "Duval",
  "73": "Flagler",
  "74": "Nassau",
  "75": "Orange",
  "76": "Putnam",
  "77": "Seminole",
  "78": "St Johns",
  "79": "Volusia",
  "86": "Broward",
  "87": "Miami-Dade",
  "88": "Indian River",
  "89": "Martin",
  "90": "Monroe",
  "91": "Okeechobee",
  "92": "Osceola",
  "93": "Palm Beach",
  "94": "St Lucie",
};

// Reverse mapping for county names to codes
const COUNTY_NAMES_TO_CODES: { [key: string]: string } = {};
Object.entries(COUNTY_CODES).forEach(([code, name]) => {
  COUNTY_NAMES_TO_CODES[name] = code;
});

// Helper function to get county code from name
export function getCountyCodeFromName(countyName: string): string | null {
  return COUNTY_NAMES_TO_CODES[countyName] || null;
}

// Helper function to get county name from code
export function getCountyNameFromCode(countyCode: string): string | null {
  return COUNTY_CODES[countyCode] || null;
}

// Helper function to calculate hotspots from accident data
function calculateHotspots(
  accidents: any[],
  gridSize: number = 0.01
): Hotspot[] {
  if (!accidents || accidents.length === 0) return [];

  // Create a grid to count accidents
  const grid: Record<
    string,
    {
      count: number;
      lats: number[];
      lngs: number[];
      county?: string;
      city?: string;
      road_names: string[];
    }
  > = {};

  // Group accidents by grid cell
  accidents.forEach((accident) => {
    if (!accident.latitude || !accident.longitude) return;

    // Round coordinates to create grid cells
    const lat = Math.round(accident.latitude / gridSize) * gridSize;
    const lng = Math.round(accident.longitude / gridSize) * gridSize;
    const key = `${lat},${lng}`;

    if (!grid[key]) {
      // Get county name from dotcounty code
      const countyName = accident.dotcounty
        ? getCountyNameFromCode(accident.dotcounty)
        : undefined;

      grid[key] = {
        count: 0,
        lats: [],
        lngs: [],
        county: countyName,
        city: accident.townname,
        road_names: [],
      };
    }

    grid[key].count++;
    grid[key].lats.push(accident.latitude);
    grid[key].lngs.push(accident.longitude);

    // Track road names if available
    if (
      accident.onroadname &&
      !grid[key].road_names.includes(accident.onroadname)
    ) {
      grid[key].road_names.push(accident.onroadname);
    }
  });

  // Find the max count for normalization
  const counts = Object.values(grid).map((cell) => cell.count);
  const maxCount = Math.max(...counts);

  // Convert grid cells to hotspots
  const hotspots: Hotspot[] = Object.entries(grid).map(([key, cell], index) => {
    // Calculate center as average of all points in the cell
    const avgLat =
      cell.lats.reduce((sum, lat) => sum + lat, 0) / cell.lats.length;
    const avgLng =
      cell.lngs.reduce((sum, lng) => sum + lng, 0) / cell.lngs.length;

    // Calculate intensity as normalized count (0-1)
    const intensity = cell.count / maxCount;

    // Calculate radius based on count and grid size
    const radius = Math.max(500, Math.min(5000, cell.count * 50));

    // Get the most common road name
    const roadNameCounts: Record<string, number> = {};
    cell.road_names.forEach((name) => {
      roadNameCounts[name] = (roadNameCounts[name] || 0) + 1;
    });

    const road_name =
      cell.road_names.length > 0
        ? Object.entries(roadNameCounts).sort((a, b) => b[1] - a[1])[0][0]
        : undefined;

    return {
      id: `hotspot-${index}`,
      center: [avgLng, avgLat],
      intensity,
      radius,
      count: cell.count,
      road_name,
      county: cell.county,
      city: cell.city,
    };
  });

  // Sort hotspots by intensity (descending)
  return hotspots.sort((a, b) => b.intensity - a.intensity);
}

// Process data to generate hotspots and road segments
function processAccidentData(data: any[]) {
  console.log(`Processing ${data.length} accident records`);

  // Group accidents by road
  const roadGroups = new Map();

  data.forEach((accident) => {
    if (!accident.onroadname || !accident.longitude || !accident.latitude) {
      return;
    }

    // Create a key that includes county and city for more specific grouping
    const county = accident.dotcounty
      ? COUNTY_CODES[accident.dotcounty] || "Unknown"
      : "Unknown";
    const city = accident.townname || "Unknown";
    const roadKey = `${accident.onroadname}|${county}|${city}`;

    if (!roadGroups.has(roadKey)) {
      roadGroups.set(roadKey, {
        name: accident.onroadname,
        county: county,
        city: city,
        coordinates: [],
        count: 0,
      });
    }

    const group = roadGroups.get(roadKey);
    group.coordinates.push([
      parseFloat(accident.longitude),
      parseFloat(accident.latitude),
    ]);
    group.count += 1;
  });

  // Filter out road groups with too few points
  const filteredRoadGroups = Array.from(roadGroups.values()).filter(
    (group) => group.coordinates.length >= 3
  );

  console.log(
    `Found ${filteredRoadGroups.length} road groups with sufficient points`
  );

  // Generate road segments
  const roadSegments = filteredRoadGroups.map((group) => {
    // Sort coordinates to form a reasonable line
    const sortedCoordinates = sortCoordinatesForLine(group.coordinates);

    // Calculate intensity based on accident count
    const intensity = Math.min(1, group.count / 20); // Cap at 1.0

    return {
      name: group.name,
      county: group.county,
      city: group.city,
      coordinates: sortedCoordinates,
      count: group.count,
      intensity: intensity,
    };
  });

  // Sort by intensity (highest first)
  roadSegments.sort((a, b) => b.intensity - a.intensity);

  // Generate hotspots (clusters of accidents)
  const hotspots = calculateHotspots(data);

  return {
    hotspots,
    roadSegments,
  };
}

// Get county hotspots
export async function getCountyHotspots(
  countyCode: string,
  prefetchedData?: any[]
) {
  try {
    console.log(`Getting hotspots for county code: ${countyCode}`);

    let data = prefetchedData;

    // If no prefetched data, fetch from Supabase
    if (!data || data.length === 0) {
      console.log("No prefetched data, fetching from Supabase...");
      const { data: fetchedData, error } = await supabase
        .from("ultimate-table")
        .select("*")
        .eq("dotcounty", countyCode)
        .limit(1000);

      if (error) {
        console.error("Error fetching county data:", error);
        return { hotspots: [], roadSegments: [] };
      }

      data = fetchedData;
    }

    console.log(`Processing ${data.length} county accident records`);
    return processAccidentData(data);
  } catch (error) {
    console.error("Error in getCountyHotspots:", error);
    return { hotspots: [], roadSegments: [] };
  }
}

// Get city hotspots
export async function getCityHotspots(
  cityName: string,
  prefetchedData?: any[]
) {
  try {
    console.log(`Getting hotspots for city: ${cityName}`);

    let data = prefetchedData;

    // If no prefetched data, fetch from Supabase
    if (!data || data.length === 0) {
      console.log("No prefetched data, fetching from Supabase...");
      const { data: fetchedData, error } = await supabase
        .from("ultimate-table")
        .select("*")
        .ilike("townname", `%${cityName.toUpperCase()}%`)
        .limit(1000);

      if (error) {
        console.error("Error fetching city data:", error);
        return { hotspots: [], roadSegments: [] };
      }

      data = fetchedData;
    }

    console.log(`Processing ${data.length} city accident records`);
    return processAccidentData(data);
  } catch (error) {
    console.error("Error in getCityHotspots:", error);
    return { hotspots: [], roadSegments: [] };
  }
}

// Get state-wide hotspots
export async function getStateHotspots(prefetchedData?: any[]) {
  try {
    console.log("Getting state-wide hotspots");

    // Validate prefetchedData
    let data: any[] = [];
    if (prefetchedData && Array.isArray(prefetchedData)) {
      data = prefetchedData;
    }

    // If no valid prefetched data, fetch from Supabase
    if (data.length === 0) {
      console.log("No prefetched data, fetching from Supabase...");
      const { data: fetchedData, error } = await supabase
        .from("ultimate-table")
        .select("*")
        .limit(2000);

      if (error) {
        console.error("Error fetching state data:", error);
        return { hotspots: [], roadSegments: [] };
      }

      if (!fetchedData || !Array.isArray(fetchedData)) {
        console.error("Invalid data received from Supabase:", fetchedData);
        return { hotspots: [], roadSegments: [] };
      }

      data = fetchedData;
    }

    console.log(`Processing ${data.length} state-wide accident records`);
    return processAccidentData(data);
  } catch (error) {
    console.error("Error in getStateHotspots:", error);
    return { hotspots: [], roadSegments: [] };
  }
}

// Generate hotspots from accident data
function generateHotspots(data: any[]) {
  // For now, return an empty array as a placeholder
  // This will be implemented later with actual hotspot generation logic
  return calculateHotspots(data);
}

// Function to get top N hotspots
export async function getTopHotspots(
  limit: number = 10,
  prefetchedData?: any[]
) {
  try {
    // Validate prefetchedData before passing it
    let validPrefetchedData: any[] | undefined;
    if (prefetchedData && Array.isArray(prefetchedData)) {
      validPrefetchedData = prefetchedData;
    }

    // Get state hotspots and return only the top N by intensity
    const result = await getStateHotspots(validPrefetchedData);

    // Sort hotspots by intensity (highest first)
    const sortedHotspots = [...result.hotspots].sort(
      (a, b) => b.intensity - a.intensity
    );

    // Return only the top N
    return sortedHotspots.slice(0, limit);
  } catch (error) {
    console.error("Error in getTopHotspots:", error);
    return [];
  }
}

// Function to get road segments with accident data
export async function getRoadSegmentsWithAccidents(
  startDate?: string,
  endDate?: string,
  startTime?: string,
  endTime?: string
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  console.log("Fetching road segments with accidents...");

  // Build the query based on provided filters
  let query = supabase.from("ultimate-table").select("*");

  // Apply date and time filters if provided
  if (startDate && endDate) {
    query = query.gte("crashdate", startDate).lte("crashdate", endDate);
  }

  if (startTime && endTime) {
    query = query.gte("crashtime", startTime).lte("crashtime", endTime);
  }

  // Limit to a reasonable number to prevent performance issues
  query = query.limit(5000);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching accident data for road segments:", error);
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} accidents for road segments`);

  // Group accidents by road and county/city to create more accurate segments
  const roadGroups: Record<
    string,
    {
      accidents: any[];
      coordinates: [number, number][];
      county?: string;
      city?: string;
    }
  > = {};

  data?.forEach((accident) => {
    if (!accident.latitude || !accident.longitude || !accident.onroadname)
      return;

    // Create a more specific key that includes county and city to separate road segments better
    const countyName = accident.dotcounty
      ? getCountyNameFromCode(accident.dotcounty)
      : undefined;
    const roadKey = `${accident.onroadname}|${countyName || ""}|${
      accident.townname || ""
    }`;

    if (!roadGroups[roadKey]) {
      roadGroups[roadKey] = {
        accidents: [],
        coordinates: [],
        county: countyName,
        city: accident.townname,
      };
    }

    roadGroups[roadKey].accidents.push(accident);
    roadGroups[roadKey].coordinates.push([
      accident.longitude,
      accident.latitude,
    ]);
  });

  // Filter out groups with too few points (likely noise)
  const filteredRoadGroups = Object.entries(roadGroups).filter(
    ([_, data]) => data.coordinates.length >= 3
  );

  console.log(
    `Created ${filteredRoadGroups.length} road segments after filtering`
  );

  // Convert to road segments
  const roadSegments = filteredRoadGroups.map(([name, data], index) => {
    // Calculate intensity based on number of accidents
    const count = data.accidents.length;
    const maxCount = Math.max(
      ...Object.values(roadGroups).map((g) => g.accidents.length)
    );
    const intensity = count / maxCount;

    // Extract the actual road name from the composite key
    const actualRoadName = name.split("|")[0];

    // Sort coordinates to form a line
    const sortedCoords = sortCoordinatesForLine(data.coordinates);

    return {
      id: `road-${index}`,
      name: actualRoadName,
      count,
      intensity,
      county: data.county,
      city: data.city,
      geometry: {
        type: "LineString",
        coordinates: sortedCoords,
      },
    };
  });

  // Sort by intensity (highest first) to ensure most important segments are rendered on top
  return roadSegments.sort((a, b) => b.intensity - a.intensity);
}

// Improved helper function to sort coordinates to form a reasonable line
function sortCoordinatesForLine(
  coords: [number, number][]
): [number, number][] {
  if (coords.length <= 2) return coords;

  // Use a more sophisticated approach for connecting points
  // Start with the first point
  const sorted: [number, number][] = [coords[0]];
  const remaining = new Set(coords.slice(1).map((c) => JSON.stringify(c)));

  // Keep adding the closest point
  while (remaining.size > 0) {
    const lastPoint = sorted[sorted.length - 1];
    let closestPoint: [number, number] | null = null;
    let closestPointStr: string | null = null;
    let minDistance = Infinity;

    // Find the closest remaining point
    // Convert Set to Array to avoid TypeScript iteration issues
    Array.from(remaining).forEach((pointStr) => {
      const point = JSON.parse(pointStr) as [number, number];
      const distance = Math.sqrt(
        Math.pow(point[0] - lastPoint[0], 2) +
          Math.pow(point[1] - lastPoint[1], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
        closestPointStr = pointStr;
      }
    });

    // If the closest point is too far away (likely a different road segment),
    // stop connecting points
    if (minDistance > 0.05) {
      // ~5km threshold
      break;
    }

    if (closestPoint && closestPointStr) {
      sorted.push(closestPoint);
      remaining.delete(closestPointStr);
    } else {
      break;
    }
  }

  // If we've used less than half the points, there are likely multiple segments
  // In that case, return just this segment and let the other points form their own segments
  return sorted;
}
