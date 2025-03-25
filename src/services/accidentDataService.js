"use client";

// src/services/accidentDataService.js
import { supabase } from "@/app/supabaseClient";

// County code mapping - centralized here to avoid duplication
export const COUNTY_CODES = {
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

// Simple cache implementation for data
const cache = {
  data: new Map(),
  set: (key, value, ttl = 300000) => { // Default TTL: 5 minutes
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
  }
};

// Centralized accident data service
export const accidentDataService = {
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

  // Abbreviation mapping for search purposes
  ABBREVIATION_MAPPING: {
    // Word-by-word mappings
    "FORT": ["FT", "FT."],
    "SAINT": ["ST", "ST."],
    "SAINTE": ["STE", "STE."],
    "NORTH": ["N", "N."],
    "SOUTH": ["S", "S."],
    "EAST": ["E", "E."],
    "WEST": ["W", "W."],
    "MOUNT": ["MT", "MT."],
    "POINT": ["PT", "PT."],
    "BEACH": ["BCH"],
    "SPRING": ["SPG"],
    "SPRINGS": ["SPGS"],
    "JUNCTION": ["JCT"],
    "HEIGHTS": ["HTS"],
    "PARK": ["PK"],
    
    // Full city name mappings for standardization
    "FT LAUDERDALE": "FORT LAUDERDALE",
    "FT. LAUDERDALE": "FORT LAUDERDALE",
    "S BAY": "SOUTH BAY",
    "S. BAY": "SOUTH BAY",
    "N MIAMI": "NORTH MIAMI",
    "N. MIAMI": "NORTH MIAMI",
    "ST PETERSBURG": "SAINT PETERSBURG",
    "ST. PETERSBURG": "SAINT PETERSBURG",
    "ST AUGUSTINE": "SAINT AUGUSTINE",
    "ST. AUGUSTINE": "SAINT AUGUSTINE"
  },
  
  // Reverse mapping to get standard city names from variations
  CITY_VARIATIONS_MAP: null, // Will be initialized
  
  /**
   * Initialize the city variations map (one time operation)
   */
  initCityVariationsMap() {
    if (this.CITY_VARIATIONS_MAP !== null) return;
    
    this.CITY_VARIATIONS_MAP = {};
    
    // Add full name mappings
    Object.entries(this.ABBREVIATION_MAPPING).forEach(([variant, standard]) => {
      if (typeof standard === 'string') {
        this.CITY_VARIATIONS_MAP[variant] = standard;
      }
    });
  },

  /**
   * Standardize a city name to its canonical form
   * @param {string} cityName - City name to standardize
   * @returns {string} - Standardized city name
   */
  standardizeCityName(cityName) {
    if (!cityName) return '';
    
    // Initialize variations map if needed
    this.initCityVariationsMap();
    
    // Convert to uppercase for consistent comparison
    const upperCity = cityName.toUpperCase();
    
    // Check for exact matches in the full city mapping
    if (this.CITY_VARIATIONS_MAP[upperCity]) {
      return this.toTitleCase(this.CITY_VARIATIONS_MAP[upperCity]);
    }
    
    // Handle word-by-word replacements for complex city names
    const words = upperCity.split(' ');
    let standardized = true;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check if this word has abbreviations
      Object.entries(this.ABBREVIATION_MAPPING).forEach(([standard, abbrevs]) => {
        if (Array.isArray(abbrevs) && abbrevs.includes(word)) {
          words[i] = standard;
          standardized = true;
        }
      });
    }
    
    if (standardized) {
      return this.toTitleCase(words.join(' '));
    }
    
    // If no standardization was needed, format correctly and return
    return this.toTitleCase(upperCity);
  },
  
  /**
   * Convert a string to Title Case
   * @param {string} str - String to convert
   * @returns {string} - Title-cased string
   */
  toTitleCase(str) {
    return str.split(' ')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  },

  /**
   * Fetch region options (counties or cities)
   * @param {string} regionType - Type of region ('county' or 'city')
   * @returns {Promise<Array>} - Array of region names
   */
  async getRegionOptions(regionType) {
    const cacheKey = `region_options_${regionType}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
      if (regionType === 'county') {
        // For counties, we already have the mapping
        const counties = Object.values(COUNTY_CODES).sort();
        cache.set(cacheKey, counties);
        return counties;
      } else if (regionType === 'city') {
        // Predefined list of Florida cities (from provided list)
        const predefinedCities = [
          "Alachua", "Altamonte Springs", "Anna Maria", "Apalachicola", "Apopka", 
          "Arcadia", "Archer", "Astalula", "Atlantic Beach", "Atlantis", 
          "Auburndale", "Aventura", "Avon Park", "Bal Harbour", "Baldwin", 
          "Bartow", "Bay Harbor Islands", "Bay Lake", "Bell", "Belle Glade", 
          "Belle Isle", "Belleair", "Belleair Beach", "Belleair Bluffs", 
          "Belleair Shore", "Belleview", "Beverley Beach", "Biscayne Park", 
          "Blountstown", "Boca Raton", "Boynton Beach", "Bradenton", 
          "Bradenton Beach", "Branford", "Bristol", "Bronson", "Brooker", 
          "Brooksville", "Bunnell", "Bushnell", "Callahan", "Callaway", 
          "Cape Canaveral", "Cape Coral", "Casselberry", "Cedar Key", 
          "Center Hill", "Century", "Chattahoochee", "Chiefland", "Chipley", 
          "Cinco Bayou", "Clearwater", "Clermont", "Clewiston", "Cocoa", 
          "Cocoa Beach", "Coconut Creek", "Coleman", "Cooper City", 
          "Coral Gables", "Coral Springs", "Cottondale", "Crescent City", 
          "Crestview", "Cross City", "Crystal River", "Cutler Bay", "Dade City", 
          "Dania Beach", "Davenport", "Davie", "Daytona Beach", 
          "Daytona Beach Shores", "De Bary", "DeFuniak Springs", 
          "Deerfield Beach", "Deland", "Delray Beach", "Deltona", "Destin", 
          "Doral", "Dunedin", "Dunnellon", "Edgewater", "Edgewood", "El Portal", 
          "Estero", "Esto", "Eustis", "Everglades City", "Fanning Springs", 
          "Fellsmere", "Fernandina Beach", "Flagler Beach", "Florida City", 
          "Fort Lauderdale", "Fort Meade", "Fort Myers", "Fort Myers Beach", 
          "Fort Pierce", "Fort Walton Beach", "Fort White", "Freeport", 
          "Frostproof", "Fruitland Park", "Gainesville", "Glen Saint Mary", 
          "Golden Beach", "Golf", "Grant-Valkaria", "Green Cove Springs", 
          "Greenacres", "Greensboro", "Greenville", "Gretna", "Groveland", 
          "Gulf Breeze", "Gulfport", "Haines City", "Hallandale Beach", 
          "Hampton", "Havana", "Haverhill", "Hawthorne", "Hialeah", 
          "Hialeah Gardens", "High Springs", "Highland Beach", "Highland Park", 
          "Hilliard", "Hillsboro Beach", "Holly Hill", "Hollywood", 
          "Holmes Beach", "Homestead", "Howey-in-the-Hills", "Hypoluxo", 
          "Indialantic", "Indian Creek", "Indian Harbour Beach", 
          "Indian River Shores", "Indian Shores", "Indiantown", "Inglis", 
          "Interlachen", "Inverness", "Islamorada", "Jacksonville", 
          "Jacksonville Beach", "Jasper", "Jay", "Juno Beach", "Jupiter", 
          "Jupiter Inlet Colony", "Jupiter Island", "Kenneth City", 
          "Key Biscayne", "Key Colony Beach", "Key West", "Keystone Heights", 
          "Kissimmee", "La Crosse", "LaBelle", "Lady Lake", "Lake Alfred", 
          "Lake Buena Vista", "Lake Butler", "Lake City", "Lake Clark Shores", 
          "Lake Hamilton", "Lake Helen", "Lake Mary", "Lake Park", "Lake Placid", 
          "Lake Wales", "Lake Worth Beach", "Lakeland", "Lantana", "Largo", 
          "Lauderdale Lakes", "Lauderdale-By-The-Sea", "Lauderhill", "Layton", 
          "Lazy Lake", "Lee", "Leesburg", "Lighthouse Point", "Live Oak", 
          "Longboat Key", "Longwood", "Loxahatchee Groves", "Lynn Haven", 
          "Macclenny", "Madeira Beach", "Madison", "Maitland", "Malabar", 
          "Manalapan", "Mangonia Park", "Marathon", "Marco Island", "Margate", 
          "Marianna", "Mary Esther", "Mascotte", "McIntosh", "Medley", 
          "Melbourne", "Melbourne Beach", "Melbourne Village", "Mexico Beach", 
          "Miami", "Miami Beach", "Miami Gardens", "Miami Lakes", "Miami Shores", 
          "Miami Springs", "Micanopy", "Midway", "Milton", "Minneola", "Miramar", 
          "Monticello", "Montverde", "Moore Haven", "Mount Dora", "Mulberry", 
          "Naples", "Neptune Beach", "New Port Richey", "New Smyrna Beach", 
          "Newberry", "Niceville", "North Bay Village", "North Lauderdale", 
          "North Miami", "North Miami Beach", "North Palm Beach", "North Port", 
          "North Redington Beach", "Oak Hill", "Oakland", "Oakland Park", 
          "Ocala", "Ocean Breeze", "Ocean Ridge", "Ocoee", "Okeechobee", 
          "Oldsmar", "Opa-locka", "Orange City", "Orange Park", "Orchid", 
          "Orlando", "Ormond Beach", "Oviedo", "Pahokee", "Palatka", "Palm Bay", 
          "Palm Beach", "Palm Beach Gardens", "Palm Beach Shores", "Palm Coast", 
          "Palm Shores", "Palm Springs", "Palmetto", "Palmetto Bay", 
          "Panama City", "Panama City Beach", "Parker", "Parkland", "Paxton", 
          "Pembroke Park", "Pembroke Pines", "Penney Farms", "Pensacola", 
          "Perry", "Pierson", "Pinecrest", "Pinellas Park", "Plant City", 
          "Plantation", "Polk City", "Pomona Park", "Pompano Beach", 
          "Ponce Inlet", "Port Orange", "Port Richey", "Port St. Joe", 
          "Port St. Lucie", "Punta Gorda", "Quincy", "Reddick", 
          "Redington Beach", "Redington Shores", "Riviera Beach", "Rockledge", 
          "Royal Palm Beach", "Safety Harbor", "San Antonio", "Sanford", 
          "Sanibel", "Sarasota", "Satellite Beach", "Sebastian", "Sebring", 
          "Sewall's Point", "Shalimar", "Sneads", "Sopchoppy", "South Bay", 
          "South Daytona", "South Miami", "South Palm Beach", "South Pasadena", 
          "Southwest Ranches", "Springfield", "Saint Augustine", 
          "Saint Augustine Beach", "Saint Cloud", "Saint Leo", "Saint Lucie Village", 
          "Saint Marks", "Saint Pete Beach", "Saint Petersburg", "Starke", "Stuart", 
          "Sunny Isles Beach", "Sunrise", "Surfside", "Sweetwater", 
          "Tallahassee", "Tamarac", "Tampa", "Tarpon Springs", "Tavares", 
          "Temple Terrace", "Tequesta", "Titusville", "Treasure Island", 
          "Trenton", "Umatilla", "Valparaiso", "Venice", "Vero Beach", 
          "Virginia Gardens", "Waldo", "Wachula", "Webster", "Welaka", 
          "Wellington", "West Melbourne", "West Miami", "West Palm Beach", 
          "West Park", "Westlake", "Weston", "Wewahitchka", "White Springs", 
          "Wildwood", "Wilton Manors", "Windermere", "Winter Garden", 
          "Winter Haven", "Winter Park", "Winter Springs", "Yankeetown", 
          "Zephyrhills", "Zolfo Springs"
        ];

        // Also fetch towns from database to catch any missing from the predefined list
        const { data, error } = await supabase
          .from("ultimate-table")
          .select("townname")
          .not("townname", "is", null)
          .limit(1000);
          
        if (error) throw error;
        
        // Set to track standardized city names to avoid duplicates
        const standardizedCities = new Set();
        
        // Process database towns - get unique standardized names
        if (data && data.length > 0) {
          data.forEach(item => {
            if (item.townname) {
              const standardized = this.standardizeCityName(item.townname);
              if (standardized) {
                standardizedCities.add(standardized);
              }
            }
          });
        }
        
        // Add predefined cities to the set
        predefinedCities.forEach(city => {
          standardizedCities.add(city);
        });
        
        // Convert to array and sort
        const uniqueCities = [...standardizedCities].sort();
        
        cache.set(cacheKey, uniqueCities);
        return uniqueCities;
      }
      
      return [];
    } catch (error) {
      console.error(`Error getting ${regionType} options:`, error);
      return [];
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
      const countyCode = this.getCountyCodeFromName(filters.regionName);
      if (countyCode) {
        params.dotcounty = countyCode;
      }
    } else if (filters.filterRegion === "city" && filters.regionName) {
      // For city filtering, we'll add variations to handle in query
      params.cityFilter = {
        name: filters.regionName,
        variations: this.getCityNameVariations(filters.regionName)
      };
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
    // Removed intersectingRoad filter
    if (filters.injuryLevel) params.highestinj = filters.injuryLevel;
    // Removed alcoholDrugs filter
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
    
    // Modified: Impaired driver filter now includes alcohol and drugs
    if (filters.impaired) {
      params.impaired = true; // This is a special flag to handle multiple cases
    }
    
    return params;
  },
  
  /**
   * Generate all possible variations of a city name for comprehensive searching
   * @param {string} cityName - The standardized city name selected by the user
   * @returns {Array} - Array of possible variations of the city name for database searching
   */
  getCityNameVariations(cityName) {
    if (!cityName) return [];
    
    // Always include the original name
    const variations = [cityName];
    const upperCity = cityName.toUpperCase();
    
    // Words that need abbreviation variations
    const wordVariations = {
      "FORT": ["FT", "FT."],
      "SAINT": ["ST", "ST."],
      "SAINTE": ["STE", "STE."],
      "NORTH": ["N", "N."],
      "SOUTH": ["S", "S."],
      "EAST": ["E", "E."],
      "WEST": ["W", "W."],
      "MOUNT": ["MT", "MT."],
      "POINT": ["PT", "PT."],
      "BEACH": ["BCH"],
      "SPRINGS": ["SPGS"],
      "HEIGHTS": ["HTS"],
      "JUNCTION": ["JCT"]
    };
    
    // Split the city name into words
    const words = upperCity.split(' ');
    
    // Generate variations based on abbreviating different parts
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      const abbrevs = wordVariations[currentWord];
      
      if (abbrevs) {
        // For each possible abbreviation of this word
        abbrevs.forEach(abbrev => {
          // Create a new array with the abbreviation substituted
          const newWords = [...words];
          newWords[i] = abbrev;
          
          // Add the variation (in Title Case)
          const variation = newWords.map(word => 
            word.charAt(0) + word.slice(1).toLowerCase()
          ).join(' ');
          
          variations.push(variation);
        });
      }
    }
    
    // Special case handling for specific cities
    if (upperCity === "SAINT PETERSBURG") {
      variations.push("Saint Petersburg");
      variations.push("St Petersburg");
      variations.push("St. Petersburg");
    } else if (upperCity === "SAINT AUGUSTINE") {
      variations.push("Saint Augustine");
      variations.push("St Augustine");
      variations.push("St. Augustine");
    } else if (upperCity === "FORT LAUDERDALE") {
      variations.push("Fort Lauderdale");
      variations.push("Ft Lauderdale");
      variations.push("Ft. Lauderdale");
    } else if (upperCity === "NORTH MIAMI") {
      variations.push("North Miami");
      variations.push("N Miami");
      variations.push("N. Miami");
    } else if (upperCity === "SOUTH BAY") {
      variations.push("South Bay");
      variations.push("S Bay");
      variations.push("S. Bay");
    }
    
    // Remove any duplicates that might have been generated
    return [...new Set(variations)];
  },

  /**
   * Fetch accidents based on filter parameters
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Array>} - Array of accident records
   */
  async getFilteredAccidents(filters = {}) {
    try {
      // Generate a deterministic cache key based on filters
      // Sort keys to ensure consistent cache keys
      const filterKeys = Object.keys(filters).sort();
      const orderedFilters = {};
      filterKeys.forEach(key => {
        if (key === 'cityFilter' && filters[key]) {
          // For city filter, only use the name for caching to avoid variation differences
          orderedFilters[key] = { name: filters[key].name };
        } else {
          orderedFilters[key] = filters[key];
        }
      });
      
      const cacheKey = `filtered_accidents_${JSON.stringify(orderedFilters)}`;
      const cachedData = cache.get(cacheKey);
      if (cachedData) return cachedData;

      // Start a base query
      let query = supabase.from("ultimate-table").select("*");
      
      // Apply region filters
      if (filters.dotcounty) {
        query = query.eq("dotcounty", filters.dotcounty);
      }
      
      // Handle city filtering with variations
      if (filters.cityFilter) {
        const { name } = filters.cityFilter;
        
        if (name) {
          // Get standardized city name
          const standardizedName = this.standardizeCityName(name);
          
          // Generate variations for database search
          const variations = this.getCityNameVariations(standardizedName);
          
          if (variations && variations.length > 0) {
            // Build filter to match any of the variations
            query = query.or(
              variations.map(variant => `townname.ilike.%${variant}%`).join(',')
            );
          } else {
            // Fallback to simple filter
            query = query.ilike("townname", `%${standardizedName}%`);
          }
        }
      } else if (filters.townname) {
        // Legacy support for old filter style
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
      
      // Removed intersecting road filter
      
      // Apply direction filter
      if (filters.refdirect) {
        query = query.eq("refdirect", filters.refdirect);
      }
      
      // Apply injury level filter
      if (filters.highestinj) {
        query = query.eq("highestinj", filters.highestinj);
      }
      
      // Modified: Handle the enhanced impaired filter that combines alcohol and drugs
      if (filters.impaired) {
        // If impaired is true, we want to match any record where:
        // - flag_imp is "Y" OR
        // - crshalcdrg is 1 (Alcohol involved) OR
        // - crshalcdrg is 2 (Drugs involved) OR
        // - crshalcdrg is 3 (Alcohol and drugs involved)
        query = query.or('flag_imp.eq.Y,crshalcdrg.eq.1,crshalcdrg.eq.2,crshalcdrg.eq.3');
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
      
      // Apply limit with a reasonable default
      query = query.limit(filters.limit || 2000);
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) throw error;

      // Process the data to standardize city names
      const processedData = (data || []).map(item => {
        // If there's a town name, ensure it's in a consistent format
        if (item.townname) {
          item.townname = this.standardizeCityName(item.townname);
        }
        return item;
      });

      // Cache the processed result for future use
      cache.set(cacheKey, processedData);
      
      return processedData;
    } catch (error) {
      console.error("Error fetching filtered accidents:", error);
      throw error;
    }
  },

  /**
   * Helper function to sort coordinates for road segments to create a continuous line
   * @param {Array} coords - Array of coordinate pairs [lon, lat]
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
      
      // If the closest point is too far away (likely a different road segment),
      // stop connecting points
      if (minDistance > 0.05) { // ~5km threshold
        break;
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
    const gridSize = 0.01; // Adjust based on desired cluster size
    const grid = {};
    
    accidents.forEach(accident => {
      if (!accident.latitude || !accident.longitude) return;
      
      // Process for hotspots (grid-based)
      const lat = Math.round(accident.latitude / gridSize) * gridSize;
      const lng = Math.round(accident.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;
      
      if (!grid[key]) {
        const countyName = accident.dotcounty 
          ? this.getCountyNameFromCode(accident.dotcounty) 
          : 'Unknown';
          
        grid[key] = {
          count: 0,
          lats: [],
          lngs: [],
          road_names: [],
          county: countyName,
          city: accident.townname || 'Unknown'
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
        const countyName = accident.dotcounty 
          ? this.getCountyNameFromCode(accident.dotcounty) 
          : 'Unknown';
        const city = accident.townname || 'Unknown';
        const roadKey = `${accident.onroadname}|${countyName}|${city}`;
        
        if (!roadGroups.has(roadKey)) {
          roadGroups.set(roadKey, {
            name: accident.onroadname,
            county: countyName,
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
   * Clear the data cache
   */
  clearCache() {
    cache.clear();
  }
};