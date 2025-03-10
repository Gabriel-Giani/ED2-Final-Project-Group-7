"use client";

// src/services/dataService.js
import { supabase } from "@/app/supabaseClient";

// County code mapping
const COUNTY_CODES = {
  "01": "Charlotte", "02": "Citrus", "03": "Collier", "04": "Desoto",
  "05": "Glades", "06": "Hardee", "07": "Hendry", "08": "Hernando",
  "09": "Highlands", "10": "Hillsborough", "11": "Lake", "12": "Lee",
  "13": "Manatee", "14": "Pasco", "15": "Pinellas", "16": "Polk",
  "17": "Sarasota", "18": "Sumter", "26": "Alachua", "27": "Baker",
  "28": "Bradford", "29": "Columbia", "30": "Dixie", "31": "Gilchrist",
  "32": "Hamilton", "33": "Lafayette", "34": "Levy", "35": "Madison",
  "36": "Marion", "37": "Suwannee", "38": "Taylor", "39": "Union",
  "46": "Bay", "47": "Calhoun", "48": "Escambia", "49": "Franklin",
  "50": "Gadsden", "51": "Gulf", "52": "Holmes", "53": "Jackson",
  "54": "Jefferson", "55": "Leon", "56": "Liberty", "57": "Okaloosa",
  "58": "Santa Rosa", "59": "Wakulla", "60": "Walton", "61": "Washington",
  "70": "Brevard", "71": "Clay", "72": "Duval", "73": "Flagler",
  "74": "Nassau", "75": "Orange", "76": "Putnam", "77": "Seminole",
  "78": "St Johns", "79": "Volusia", "86": "Broward", "87": "Miami-Dade",
  "88": "Indian River", "89": "Martin", "90": "Monroe", "91": "Okeechobee",
  "92": "Osceola", "93": "Palm Beach", "94": "St Lucie"
};

// Reverse mapping for county names to codes
const COUNTY_NAMES_TO_CODES = {};
Object.entries(COUNTY_CODES).forEach(([code, name]) => {
  COUNTY_NAMES_TO_CODES[name] = code;
});

// Helper function to convert time to database format (HHMM)
const convertTimeToDbFormat = (timeString) => {
  if (!timeString || !timeString.includes(':')) return '';
  const [hours, minutes] = timeString.split(':');
  return `${hours}${minutes}`;
};

// Data service for accident data
export const accidentService = {
  /**
   * Fetch accidents based on filter parameters
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array>} - Array of accident records
   */
  async getFilteredAccidents(filters = {}) {
    try {
      // Start a base query
      let query = supabase.from("ultimate-table").select("*");
      
      // Apply region filters
      if (filters.dotcounty) {
        query = query.eq("dotcounty", filters.dotcounty);
      }
      
      if (filters.townname) {
        query = query.ilike("townname", `%${filters.townname}%`);
      }
      
      // Apply date range filters
      if (filters.dateStart && filters.dateEnd) {
        query = query.gte("crashdate", filters.dateStart)
                     .lte("crashdate", filters.dateEnd);
      }
      
      // Apply time range filters
      if (filters.timeStart && filters.timeEnd) {
        const timeStart = convertTimeToDbFormat(filters.timeStart);
        const timeEnd = convertTimeToDbFormat(filters.timeEnd);
        
        if (timeStart && timeEnd) {
          query = query.gte("crashtime", timeStart)
                     .lte("crashtime", timeEnd);
        }
      }
      
      // Apply day of week filter
      if (filters.dayofweek) {
        query = query.eq("dayofweek", filters.dayofweek);
      }
      
      // Apply road name filter
      if (filters.onroadname) {
        query = query.ilike("onroadname", `%${filters.onroadname}%`);
      }
      
      // Apply intersecting road filter
      if (filters.inroadname) {
        query = query.ilike("inroadname", `%${filters.inroadname}%`);
      }
      
      // Apply direction filter
      if (filters.refdirect) {
        query = query.eq("refdirect", filters.refdirect);
      }
      
      // Apply injury level filter
      if (filters.highestinj) {
        query = query.eq("highestinj", filters.highestinj);
      }
      
      // Apply alcohol/drugs filter
      if (filters.crshalcdrg) {
        query = query.eq("crshalcdrg", filters.crshalcdrg);
      }
      
      // Apply light condition filter
      if (filters.lightcond) {
        query = query.eq("lightcond", filters.lightcond);
      }
      
      // Apply weather condition filter
      if (filters.weathcond) {
        query = query.eq("weathcond", filters.weathcond);
      }
      
      // Apply road surface condition filter
      if (filters.rdsurfcond) {
        query = query.eq("rdsurfcond", filters.rdsurfcond);
      }
      
      // Apply damage range filters
      if (filters.damageMin) {
        query = query.gte("totcrshdmg", filters.damageMin);
      }
      
      if (filters.damageMax) {
        query = query.lte("totcrshdmg", filters.damageMax);
      }
      
      // Apply boolean filters (Y/N values)
      if (filters.fl_aggrsv) {
        query = query.eq("fl_aggrsv", filters.fl_aggrsv);
      }
      
      if (filters.fl_vru_ped) {
        query = query.eq("fl_vru_ped", filters.fl_vru_ped);
      }
      
      if (filters.fl_vru_bik) {
        query = query.eq("fl_vru_bik", filters.fl_vru_bik);
      }
      
      if (filters.fl_vru_mot) {
        query = query.eq("fl_vru_mot", filters.fl_vru_mot);
      }
      
      if (filters.fl_ar_teen) {
        query = query.eq("fl_ar_teen", filters.fl_ar_teen);
      }
      
      if (filters.fl_ar_ag) {
        query = query.eq("fl_ar_ag", filters.fl_ar_ag);
      }
      
      if (filters.flag_imp) {
        query = query.eq("flag_imp", filters.flag_imp);
      }
      
      // Apply limit
      query = query.limit(filters.limit || 5000);
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error("Error fetching filtered accidents:", error);
      throw error;
    }
  },

  /**
   * Build query parameters from filter objects
   * @param {Object} filters - Filter objects containing UI filter values
   * @returns {Object} - Query parameters for the data service
   */
  buildQueryParams(filters) {
    const params = {};
    
    // Region filters
    if (filters.filterRegion === "county" && filters.regionName) {
      params.dotcounty = filters.regionName;
    } else if (filters.filterRegion === "city" && filters.regionName) {
      params.townname = filters.regionName;
    }
    
    // Date and time filters
    if (filters.dateRange?.start && filters.dateRange?.end) {
      params.dateStart = filters.dateRange.start;
      params.dateEnd = filters.dateRange.end;
    }
    
    if (filters.useTimeFilter && filters.timeRange?.start && filters.timeRange?.end) {
      params.timeStart = filters.timeRange.start;
      params.timeEnd = filters.timeRange.end;
    }
    
    // Other filters
    if (filters.dayOfWeek) params.dayofweek = filters.dayOfWeek;
    if (filters.roadName) params.onroadname = filters.roadName;
    if (filters.intersectingRoad) params.inroadname = filters.intersectingRoad;
    if (filters.injuryLevel) params.highestinj = filters.injuryLevel;
    if (filters.alcoholDrugs) params.crshalcdrg = filters.alcoholDrugs;
    if (filters.lightCondition) params.lightcond = filters.lightCondition;
    if (filters.weatherCondition) params.weathcond = filters.weatherCondition;
    if (filters.roadSurfaceCondition) params.rdsurfcond = filters.roadSurfaceCondition;
    if (filters.direction) params.refdirect = filters.direction;
    if (filters.damageMin) params.damageMin = filters.damageMin;
    if (filters.damageMax) params.damageMax = filters.damageMax;
    
    // Boolean filters
    if (filters.aggressiveDriving) params.fl_aggrsv = "Y";
    if (filters.pedestrianInvolved) params.fl_vru_ped = "Y";
    if (filters.bicycleInvolved) params.fl_vru_bik = "Y";
    if (filters.motorcycleInvolved) params.fl_vru_mot = "Y";
    if (filters.teenInvolved) params.fl_ar_teen = "Y";
    if (filters.elderlyInvolved) params.fl_ar_ag = "Y";
    if (filters.impaired) params.flag_imp = "Y";
    
    return params;
  },
  
  /**
   * Process accident data into hotspots and road segments
   * @param {Array} accidents - Array of accident records
   * @returns {Object} - Object containing hotspots and road segments
   */
  processAccidentData(accidents) {
    if (!accidents || accidents.length === 0) {
      return { hotspots: [], roadSegments: [] };
    }
    
    // Group accidents by road name for road segments
    const roadGroups = new Map();
    
    // Create grid for hotspots
    const gridSize = 0.01;
    const grid = {};
    
    accidents.forEach(accident => {
      if (!accident.latitude || !accident.longitude) return;
      
      // Process for hotspots (grid-based)
      const lat = Math.round(accident.latitude / gridSize) * gridSize;
      const lng = Math.round(accident.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;
      
      if (!grid[key]) {
        grid[key] = {
          count: 0,
          lats: [],
          lngs: [],
          road_names: [],
          county: accident.dotcounty,
          city: accident.townname
        };
      }
      
      grid[key].count++;
      grid[key].lats.push(accident.latitude);
      grid[key].lngs.push(accident.longitude);
      
      if (accident.onroadname && !grid[key].road_names.includes(accident.onroadname)) {
        grid[key].road_names.push(accident.onroadname);
      }
      
      // Process for road segments
      if (accident.onroadname) {
        const county = accident.dotcounty || "Unknown";
        const city = accident.townname || "Unknown";
        const roadKey = `${accident.onroadname}|${county}|${city}`;
        
        if (!roadGroups.has(roadKey)) {
          roadGroups.set(roadKey, {
            name: accident.onroadname,
            county: county,
            city: city,
            coordinates: [],
            count: 0
          });
        }
        
        const group = roadGroups.get(roadKey);
        group.coordinates.push([
          parseFloat(accident.longitude),
          parseFloat(accident.latitude)
        ]);
        group.count += 1;
      }
    });
    
    // Calculate hotspots from grid cells
    const counts = Object.values(grid).map(cell => cell.count);
    const maxCount = Math.max(...counts, 1); // Prevent division by zero
    
    const hotspots = Object.entries(grid).map(([key, cell], index) => {
      const avgLat = cell.lats.reduce((sum, lat) => sum + lat, 0) / cell.lats.length;
      const avgLng = cell.lngs.reduce((sum, lng) => sum + lng, 0) / cell.lngs.length;
      const intensity = cell.count / maxCount;
      const radius = Math.max(500, Math.min(5000, cell.count * 50));
      
      // Find most common road name
      const roadNameCounts = {};
      cell.road_names.forEach(name => {
        roadNameCounts[name] = (roadNameCounts[name] || 0) + 1;
      });
      
      const roadName = cell.road_names.length > 0
        ? Object.entries(roadNameCounts).sort((a, b) => b[1] - a[1])[0][0]
        : undefined;
      
      return {
        id: `hotspot-${index}`,
        center: [avgLng, avgLat],
        intensity,
        radius,
        count: cell.count,
        road_name: roadName,
        county: cell.county,
        city: cell.city
      };
    });
    
    // Process road segments
    const filteredRoadGroups = Array.from(roadGroups.values()).filter(
      group => group.coordinates.length >= 3
    );
    
    const roadSegments = filteredRoadGroups.map((group, index) => {
      // Sort coordinates to form a reasonable line
      const sortedCoordinates = this.sortCoordinatesForLine(group.coordinates);
      
      // Calculate intensity based on accident count
      const maxGroupCount = Math.max(...filteredRoadGroups.map(g => g.count), 1);
      const intensity = Math.min(1, group.count / maxGroupCount);
      
      return {
        id: `road-${index}`,
        name: group.name,
        county: group.county,
        city: group.city,
        coordinates: sortedCoordinates,
        count: group.count,
        intensity: intensity
      };
    });
    
    return { hotspots, roadSegments };
  },
  
  /**
   * Get top hotspots from a set of accidents
   * @param {Array} accidents - Array of accident records
   * @param {number} limit - Number of hotspots to return
   * @returns {Array} - Array of top hotspots
   */
  getTopHotspots(accidents, limit = 10) {
    const { hotspots } = this.processAccidentData(accidents);
    
    // Sort by intensity and limit the results
    return hotspots
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, limit);
  },
  
  /**
   * Helper function to sort coordinates for road segments
   * @param {Array} coords - Array of coordinate pairs
   * @returns {Array} - Sorted coordinates
   */
  sortCoordinatesForLine(coords) {
    if (coords.length <= 2) return coords;
    
    // Start with first point
    const sorted = [coords[0]];
    const remaining = new Set(coords.slice(1).map(c => JSON.stringify(c)));
    
    while (remaining.size > 0) {
      const lastPoint = sorted[sorted.length - 1];
      let closestPoint = null;
      let closestPointStr = null;
      let minDistance = Infinity;
      
      Array.from(remaining).forEach(pointStr => {
        const point = JSON.parse(pointStr);
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
      
      if (minDistance > 0.05) {
        break; // Too far away, likely different road segment
      }
      
      if (closestPoint && closestPointStr) {
        sorted.push(closestPoint);
        remaining.delete(closestPointStr);
      } else {
        break;
      }
    }
    
    return sorted;
  },
  
  /**
   * Get county name from code
   * @param {string} countyCode - County code
   * @returns {string|null} - County name or null if not found
   */
  getCountyNameFromCode(countyCode) {
    return COUNTY_CODES[countyCode] || null;
  },
  
  /**
   * Get county code from name
   * @param {string} countyName - County name
   * @returns {string|null} - County code or null if not found
   */
  getCountyCodeFromName(countyName) {
    return COUNTY_NAMES_TO_CODES[countyName] || null;
  },
  
  /**
   * Fetch unique region values (counties or cities)
   * @param {string} regionType - Type of region ('county' or 'city')
   * @returns {Promise<Array>} - Array of region names
   */
  async getRegionOptions(regionType) {
    try {
      if (regionType === 'county') {
        // For counties, we already have the mapping
        return Object.values(COUNTY_CODES).sort();
      } else if (regionType === 'city') {
        // For cities, we need to fetch from the database
        const { data, error } = await supabase
          .from("ultimate-table")
          .select("townname")
          .not("townname", "is", null)
          .limit(1000);
          
        if (error) throw error;
        
        // Extract unique values and format properly
        const uniqueCities = [...new Set(data.map(item => item.townname))]
          .filter(Boolean)
          .map(town => 
            town.split(" ")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(" ")
          )
          .sort();
          
        return uniqueCities;
      }
      
      return [];
    } catch (error) {
      console.error(`Error getting ${regionType} options:`, error);
      return [];
    }
  }
};