import { supabase } from "@/app/supabaseClient";
import wellknown from "wellknown";
import { accidentDataService } from "./accidentDataService";

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

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Calculate great-circle distance using Haversine (km)
function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

// Calculate line length in meters
function calculateLineLength(coordinates) {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    totalDistance += calculateGeoDistance(lat1, lon1, lat2, lon2);
  }
  return totalDistance * 1000;
}

// Convert time string HH:MM to database format HHMM number
const convertTimeToDbFormat = (timeString) => {
  if (!timeString || !timeString.includes(":")) return NaN;
  const [hours, minutes] = timeString.split(":");
  const hhmmString = `${hours.padStart(2, "0")}${minutes.padStart(2, "0")}`;
  const timeInt = parseInt(hhmmString, 10);
  return isNaN(timeInt) ? NaN : timeInt;
};

// Split LineString into segments of max length (km)
function splitLineString(coordinates, maxSegmentLengthKm) {
  if (!coordinates || coordinates.length <= 1) {
    return [coordinates];
  }

  const splitSegments = [];
  let currentSegment = [coordinates[0]];
  let currentSegmentLengthKm = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    const stepDistanceKm = calculateGeoDistance(lat1, lon1, lat2, lon2);

    if (currentSegmentLengthKm + stepDistanceKm > maxSegmentLengthKm) {
      if (currentSegment.length > 1) {
        splitSegments.push(currentSegment);
      }
      // Start new segment with overlap for continuity
      currentSegment = [coordinates[i - 1], coordinates[i]];
      currentSegmentLengthKm = stepDistanceKm;
    } else {
      currentSegment.push(coordinates[i]);
      currentSegmentLengthKm += stepDistanceKm;
    }
  }

  if (currentSegment.length > 1) {
    splitSegments.push(currentSegment);
  }

  if (splitSegments.length === 0 && coordinates.length > 1) {
    return [coordinates];
  }

  return splitSegments;
}

// Map accident data to road segments
async function mapAccidentsToRoadSegments(
  roadData,
  accidentData,
  progressCallback,
  maxSegmentLengthKm = 5
) {
  try {
    let allSplitSegments = [];

    roadData.forEach((road) => {
      try {
        const geometry = wellknown.parse(road.WKT);
        if (
          !geometry ||
          !geometry.coordinates ||
          geometry.coordinates.length < 2 ||
          geometry.type !== "LineString"
        ) {
          return;
        }

        const splitCoordinates = splitLineString(
          geometry.coordinates,
          maxSegmentLengthKm
        );

        splitCoordinates.forEach((coords, index) => {
          if (coords && coords.length >= 2) {
            allSplitSegments.push({
              originalId: road.LINEARID,
              splitIndex: index,
              id: `${road.LINEARID}-part-${index}`,
              name: road.FULLNAME,
              roadType: road.RTTYP,
              mtfcc: road.MTFCC,
              geometry: { type: "LineString", coordinates: coords },
              accidents: [],
              bbox: calculateBoundingBox(coords),
            });
          }
        });
      } catch (e) {
        console.error(
          `Error parsing WKT or splitting road ${road.LINEARID}:`,
          e,
          road.WKT
        );
      }
    });

    const totalSegments = allSplitSegments.length;
    let processedSegmentCount = 0;
    const batchSize = 200;

    if (progressCallback) {
      progressCallback({
        processed: processedSegmentCount,
        total: totalSegments,
        message: "Mapping accidents to road segments...",
      });
    }

    for (let i = 0; i < totalSegments; i += batchSize) {
      const batch = allSplitSegments.slice(
        i,
        Math.min(i + batchSize, totalSegments)
      );

      batch.forEach((segment) => {
        const matchingAccidents = accidentData.filter((accident) => {
          if (!accident.latitude || !accident.longitude) return false;
          const lat = parseFloat(accident.latitude);
          const lon = parseFloat(accident.longitude);
          const padding = 0.0005; // Approx 50m BBox padding

          if (
            lon >= segment.bbox.minLon - padding &&
            lon <= segment.bbox.maxLon + padding &&
            lat >= segment.bbox.minLat - padding &&
            lat <= segment.bbox.maxLat + padding
          ) {
            return true;
          }
          return false;
        });
        segment.accidents = matchingAccidents;
      });

      processedSegmentCount += batch.length;
      if (progressCallback) {
        progressCallback({
          processed: processedSegmentCount,
          total: totalSegments,
          message: `Mapping accidents (${processedSegmentCount}/${totalSegments})...`,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const processedRoadSegments = allSplitSegments
      .map((segment) => {
        if (segment.accidents.length === 0) return null;

        const segmentLength = calculateLineLength(segment.geometry.coordinates);

        if (segmentLength <= 0) {
          const intensity = Math.min(segment.accidents.length / 5, 1); // Intensity based on count if length is zero
          return {
            id: segment.id,
            name: segment.name,
            roadType: segment.roadType,
            count: segment.accidents.length,
            length: 0,
            intensity: intensity,
            accidentsPerKm: Infinity,
            geometry: segment.geometry,
          };
        }

        const accidentsPerKmRaw =
          segment.accidents.length / (segmentLength / 1000);
        const accidentsPerKmCapped = Math.min(accidentsPerKmRaw, 20); // Cap accidents/km
        const intensity = Math.min(accidentsPerKmCapped / 20, 1); // Normalize intensity 0-1

        if (intensity <= 0) return null;

        return {
          id: segment.id,
          name: segment.name,
          roadType: segment.roadType,
          count: segment.accidents.length,
          length: segmentLength,
          intensity: intensity,
          accidentsPerKm: accidentsPerKmRaw,
          geometry: segment.geometry,
        };
      })
      .filter(Boolean);

    return processedRoadSegments.sort((a, b) => b.intensity - a.intensity);
  } catch (error) {
    console.error("Error mapping accidents to road segments:", error);
    return [];
  }
}

export async function getMajorRoadLineSegments(
  filters,
  progressCallback = null
) {
  try {
    if (progressCallback)
      progressCallback({ message: "Fetching road geometries..." });
    const { data: roadData, error: roadError } = await supabase
      .from("major-roads")
      .select("WKT, LINEARID, FULLNAME, RTTYP, MTFCC")
      .limit(1000);

    if (roadError) {
      console.error("Error fetching major roads:", roadError);
      throw roadError;
    }
    if (!roadData || roadData.length === 0) {
      return [];
    }
    if (progressCallback)
      progressCallback({
        message: `Fetched ${roadData.length} road geometries. Fetching accidents...`,
      });

    let query = supabase
      .from("ultimate-table")
      .select(
        "latitude, longitude, onroadname, crashdate, crashtime, dotcounty, townname, highestinj, lightcond, weathcond, rdsurfcond, refdirect, fl_aggrsv, fl_ar_teen, fl_vru_ped, fl_vru_bik, flag_imp, fl_vru_mot, totcrshdmg"
      );

    if (filters?.dateRange?.start) {
      query = query.gte("crashdate", filters.dateRange.start);
    }
    if (filters?.dateRange?.end) {
      query = query.lte("crashdate", filters.dateRange.end);
    }

    if (filters?.useTimeFilter && filters?.timeRange?.start) {
      const timeIntStart = convertTimeToDbFormat(filters.timeRange.start);
      if (!isNaN(timeIntStart)) {
        query = query.gte("crashtime", timeIntStart);
      } else {
        console.warn(`Could not parse start time: ${filters.timeRange.start}`);
      }
    }
    if (filters?.useTimeFilter && filters?.timeRange?.end) {
      const timeIntEnd = convertTimeToDbFormat(filters.timeRange.end);
      if (!isNaN(timeIntEnd)) {
        query = query.lte("crashtime", timeIntEnd);
      } else {
        console.warn(`Could not parse end time: ${filters.timeRange.end}`);
      }
    }

    if (filters?.filterRegion === "county" && filters?.regionName) {
      const countyCodeStr = accidentDataService.getCountyCodeFromName(
        filters.regionName
      );
      if (countyCodeStr) {
        const countyCodeInt = parseInt(countyCodeStr, 10);
        if (!isNaN(countyCodeInt)) {
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
      query = query.ilike("townname", filters.regionName);
    }

    if (filters?.dayOfWeek) {
      const dayOfWeekInt = parseInt(filters.dayOfWeek, 10);
      if (!isNaN(dayOfWeekInt) && dayOfWeekInt >= 1 && dayOfWeekInt <= 7) {
        query = query.eq("dayofweek", dayOfWeekInt);
      } else {
        console.warn(
          `Invalid dayOfWeek filter value: ${filters.dayOfWeek}. Skipping filter.`
        );
      }
    }

    if (filters?.injuryLevel) {
      const injuryLevelInt = parseInt(filters.injuryLevel, 10);
      if (
        !isNaN(injuryLevelInt) &&
        injuryLevelInt >= 0 &&
        injuryLevelInt <= 6
      ) {
        query = query.eq("highestinj", injuryLevelInt);
      } else {
        console.warn(
          `Invalid injuryLevel filter value: ${filters.injuryLevel}. Skipping filter.`
        );
      }
    }

    if (filters?.lightCondition) {
      query = query.eq("lightcond", filters.lightCondition);
    }

    if (filters?.weatherCondition) {
      query = query.eq("weathcond", filters.weatherCondition);
    }

    if (filters?.roadSurfaceCondition) {
      query = query.eq("rdsurfcond", filters.roadSurfaceCondition);
    }

    const validDirections = ["N", "S", "E", "W"];
    if (filters?.direction && validDirections.includes(filters.direction)) {
      query = query.eq("refdirect", filters.direction);
    }

    if (filters?.aggressiveDriving === true) {
      query = query.eq("fl_aggrsv", "Y");
    }

    if (filters?.teenInvolved === true) {
      query = query.eq("fl_ar_teen", "Y");
    }

    if (filters?.pedestrianInvolved === true) {
      query = query.eq("fl_vru_ped", "Y");
    }

    if (filters?.bicycleInvolved === true) {
      query = query.eq("fl_vru_bik", "Y");
    }

    if (filters?.impaired === true) {
      query = query.eq("flag_imp", "Y");
    }

    if (filters?.motorcycleInvolved === true) {
      query = query.eq("fl_vru_mot", "Y");
    }

    if (filters?.damageMin !== null && filters?.damageMin !== "") {
      const damageMinNum = parseFloat(filters.damageMin);
      if (!isNaN(damageMinNum) && damageMinNum >= 0) {
        query = query.gte("totcrshdmg", damageMinNum);
      } else {
        console.warn(
          `Invalid damageMin filter value: ${filters.damageMin}. Skipping min damage filter.`
        );
      }
    }
    if (filters?.damageMax !== null && filters?.damageMax !== "") {
      const damageMaxNum = parseFloat(filters.damageMax);
      if (!isNaN(damageMaxNum) && damageMaxNum >= 0) {
        query = query.lte("totcrshdmg", damageMaxNum);
      } else {
        console.warn(
          `Invalid damageMax filter value: ${filters.damageMax}. Skipping max damage filter.`
        );
      }
    }

    query = query.limit(300000);

    const { data: accidentData, error: accidentError } = await query;

    if (accidentError) {
      console.error("Error fetching filtered accident data:", accidentError);
      throw accidentError;
    }
    if (progressCallback)
      progressCallback({
        message: `Fetched ${
          accidentData?.length || 0
        } accidents. Processing...`,
      });

    const processedSegments = await mapAccidentsToRoadSegments(
      roadData,
      accidentData || [],
      progressCallback,
      5
    );

    return processedSegments;
  } catch (error) {
    console.error("Error in getMajorRoadLineSegments:", error);
    if (progressCallback)
      progressCallback({
        error: true,
        message: "Failed to load road segments.",
      });
    return [];
  }
}

export const roadSegmentService = {
  getMajorRoadLineSegments,
};
