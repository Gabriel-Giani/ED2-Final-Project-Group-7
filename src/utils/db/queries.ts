// Traffic accident query constants
export const ACCIDENT_QUERIES = {
  // Get accidents within a radius of a point
  ACCIDENTS_IN_RADIUS: `
    SELECT *
    FROM "ultimate-table"
    WHERE ST_DWithin(
      ST_MakePoint(longitude, latitude)::geography,
      ST_MakePoint($1, $2)::geography,
      $3
    )
  `,

  // Get accidents by severity
  ACCIDENTS_BY_SEVERITY: `
    SELECT *
    FROM "ultimate-table" 
    WHERE highestinj = $1
  `,

  // Get accidents within a polygon/boundary
  ACCIDENTS_IN_BOUNDARY: `
    SELECT *
    FROM "ultimate-table"
    WHERE ST_Within(
      ST_MakePoint(longitude, latitude),
      ST_GeomFromGeoJSON($1)
    )
  `,

  // Get accidents by date range
  ACCIDENTS_BY_DATE_RANGE: `
    SELECT *
    FROM "ultimate-table"
    WHERE crashdate >= $1 
    AND crashdate <= $2
  `,

  // Get accidents for specific date
  ACCIDENTS_BY_DATE: `
    SELECT *
    FROM "ultimate-table"
    WHERE crashdate = $1
  `,

  // Get accident count by date range
  ACCIDENT_COUNT_BY_DATE_RANGE: `
    SELECT 
      COUNT(*) as accident_count
    FROM 
      "ultimate-table"
    WHERE 
      crashdate >= $1 
      AND crashdate <= $2
  `,

  // Get accidents by date and time range
  ACCIDENTS_BY_DATE_AND_TIME_RANGE: `
    SELECT *
    FROM "ultimate-table"
    WHERE crashdate >= $1 
    AND crashdate <= $2
    AND crashtime >= $3
    AND crashtime <= $4
  `,
  
  // Get accidents by day of week
  ACCIDENTS_BY_DAY_OF_WEEK: `
    SELECT *
    FROM "ultimate-table"
    WHERE dayofweek = $1
  `,
  
  // Get accidents by road name
  ACCIDENTS_BY_ROAD_NAME: `
    SELECT *
    FROM "ultimate-table"
    WHERE onroadname ILIKE $1
  `,
  
  // Get accidents at intersection
  ACCIDENTS_AT_INTERSECTION: `
    SELECT *
    FROM "ultimate-table"
    WHERE onroadname ILIKE $1
    AND inroadname ILIKE $2
  `,
  
  // Get accidents by weather condition
  ACCIDENTS_BY_WEATHER: `
    SELECT *
    FROM "ultimate-table"
    WHERE weathcond = $1
  `,
  
  // Get accidents by light condition
  ACCIDENTS_BY_LIGHT: `
    SELECT *
    FROM "ultimate-table"
    WHERE lightcond = $1
  `,
  
  // Get accidents by road surface condition
  ACCIDENTS_BY_ROAD_CONDITION: `
    SELECT *
    FROM "ultimate-table"
    WHERE rdsurfcond = $1
  `,
  
  // Get accidents by alcohol/drug involvement
  ACCIDENTS_BY_ALCOHOL_DRUGS: `
    SELECT *
    FROM "ultimate-table"
    WHERE crshalcdrg = $1
  `,
  
  // Get accidents with damage in range
  ACCIDENTS_BY_DAMAGE_RANGE: `
    SELECT *
    FROM "ultimate-table"
    WHERE totcrshdmg >= $1
    AND totcrshdmg <= $2
  `,
  
  // Get accidents involving pedestrians
  ACCIDENTS_WITH_PEDESTRIANS: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_vru_ped = 'Y'
  `,
  
  // Get accidents involving bicycles
  ACCIDENTS_WITH_BICYCLES: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_vru_bik = 'Y'
  `,
  
  // Get accidents involving motorcycles
  ACCIDENTS_WITH_MOTORCYCLES: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_vru_mot = 'Y'
  `,
  
  // Get accidents with teen drivers
  ACCIDENTS_WITH_TEENS: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_ar_teen = 'Y'
  `,
  
  // Get accidents with elderly drivers
  ACCIDENTS_WITH_ELDERLY: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_ar_ag = 'Y'
  `,
  
  // Get accidents with aggressive driving
  ACCIDENTS_WITH_AGGRESSION: `
    SELECT *
    FROM "ultimate-table"
    WHERE fl_aggrsv = 'Y'
  `,
  
  // Get accidents with impaired driving
  ACCIDENTS_WITH_IMPAIRED: `
    SELECT *
    FROM "ultimate-table"
    WHERE flag_imp = 'Y'
  `,
  
  // Comprehensive filtering query with all possible filters
  // This is a template that should be populated with actual filter values
  FILTERED_ACCIDENTS: `
    SELECT *
    FROM "ultimate-table"
    WHERE 1=1
    /* Region filters */
    [dotcounty_filter]
    [townname_filter]
    
    /* Date and time filters */
    [date_range_filter]
    [time_range_filter]
    [day_of_week_filter]
    
    /* Road filters */
    [road_name_filter]
    [intersecting_road_filter]
    [direction_filter]
    
    /* Crash characteristics */
    [injury_filter]
    [alc_drug_filter]
    [light_filter]
    [weather_filter]
    [road_surface_filter]
    [damage_range_filter]
    
    /* Boolean flags */
    [aggressive_filter]
    [pedestrian_filter]
    [bicycle_filter]
    [motorcycle_filter]
    [teen_filter]
    [elderly_filter]
    [impaired_filter]
    
    /* Query control */
    [limit_offset]
  `
};

// Function to build a comprehensive SQL query with all filters
export function buildFilteredQuery(params: any): string {
  let query = ACCIDENT_QUERIES.FILTERED_ACCIDENTS;
  
  // Region filters
  if (params.dotcounty) {
    query = query.replace('[dotcounty_filter]', `AND dotcounty = '${params.dotcounty}'`);
  } else {
    query = query.replace('[dotcounty_filter]', '');
  }
  
  if (params.townname) {
    query = query.replace('[townname_filter]', `AND townname ILIKE '%${params.townname}%'`);
  } else {
    query = query.replace('[townname_filter]', '');
  }
  
  // Date and time filters
  if (params.dateStart && params.dateEnd) {
    query = query.replace(
      '[date_range_filter]', 
      `AND crashdate >= '${params.dateStart}' AND crashdate <= '${params.dateEnd}'`
    );
  } else {
    query = query.replace('[date_range_filter]', '');
  }
  
  if (params.timeStart && params.timeEnd) {
    query = query.replace(
      '[time_range_filter]', 
      `AND crashtime >= '${params.timeStart}' AND crashtime <= '${params.timeEnd}'`
    );
  } else {
    query = query.replace('[time_range_filter]', '');
  }
  
  if (params.dayofweek) {
    query = query.replace('[day_of_week_filter]', `AND dayofweek = '${params.dayofweek}'`);
  } else {
    query = query.replace('[day_of_week_filter]', '');
  }
  
  // Road filters
  if (params.onroadname) {
    query = query.replace('[road_name_filter]', `AND onroadname ILIKE '%${params.onroadname}%'`);
  } else {
    query = query.replace('[road_name_filter]', '');
  }
  
  if (params.inroadname) {
    query = query.replace('[intersecting_road_filter]', `AND inroadname ILIKE '%${params.inroadname}%'`);
  } else {
    query = query.replace('[intersecting_road_filter]', '');
  }
  
  if (params.refdirect) {
    query = query.replace('[direction_filter]', `AND refdirect = '${params.refdirect}'`);
  } else {
    query = query.replace('[direction_filter]', '');
  }
  
  // Crash characteristics
  if (params.highestinj) {
    query = query.replace('[injury_filter]', `AND highestinj = '${params.highestinj}'`);
  } else {
    query = query.replace('[injury_filter]', '');
  }
  
  if (params.crshalcdrg) {
    query = query.replace('[alc_drug_filter]', `AND crshalcdrg = '${params.crshalcdrg}'`);
  } else {
    query = query.replace('[alc_drug_filter]', '');
  }
  
  if (params.lightcond) {
    query = query.replace('[light_filter]', `AND lightcond = '${params.lightcond}'`);
  } else {
    query = query.replace('[light_filter]', '');
  }
  
  if (params.weathcond) {
    query = query.replace('[weather_filter]', `AND weathcond = '${params.weathcond}'`);
  } else {
    query = query.replace('[weather_filter]', '');
  }
  
  if (params.rdsurfcond) {
    query = query.replace('[road_surface_filter]', `AND rdsurfcond = '${params.rdsurfcond}'`);
  } else {
    query = query.replace('[road_surface_filter]', '');
  }
  
  // Damage range
  if (params.damageMin && params.damageMax) {
    query = query.replace(
      '[damage_range_filter]', 
      `AND totcrshdmg >= ${params.damageMin} AND totcrshdmg <= ${params.damageMax}`
    );
  } else if (params.damageMin) {
    query = query.replace('[damage_range_filter]', `AND totcrshdmg >= ${params.damageMin}`);
  } else if (params.damageMax) {
    query = query.replace('[damage_range_filter]', `AND totcrshdmg <= ${params.damageMax}`);
  } else {
    query = query.replace('[damage_range_filter]', '');
  }
  
  // Boolean flags
  if (params.fl_aggrsv === 'Y') {
    query = query.replace('[aggressive_filter]', `AND fl_aggrsv = 'Y'`);
  } else {
    query = query.replace('[aggressive_filter]', '');
  }
  
  if (params.fl_vru_ped === 'Y') {
    query = query.replace('[pedestrian_filter]', `AND fl_vru_ped = 'Y'`);
  } else {
    query = query.replace('[pedestrian_filter]', '');
  }
  
  if (params.fl_vru_bik === 'Y') {
    query = query.replace('[bicycle_filter]', `AND fl_vru_bik = 'Y'`);
  } else {
    query = query.replace('[bicycle_filter]', '');
  }
  
  if (params.fl_vru_mot === 'Y') {
    query = query.replace('[motorcycle_filter]', `AND fl_vru_mot = 'Y'`);
  } else {
    query = query.replace('[motorcycle_filter]', '');
  }
  
  if (params.fl_ar_teen === 'Y') {
    query = query.replace('[teen_filter]', `AND fl_ar_teen = 'Y'`);
  } else {
    query = query.replace('[teen_filter]', '');
  }
  
  if (params.fl_ar_ag === 'Y') {
    query = query.replace('[elderly_filter]', `AND fl_ar_ag = 'Y'`);
  } else {
    query = query.replace('[elderly_filter]', '');
  }
  
  if (params.flag_imp === 'Y') {
    query = query.replace('[impaired_filter]', `AND flag_imp = 'Y'`);
  } else {
    query = query.replace('[impaired_filter]', '');
  }
  
  // Query control
  const limit = params.limit || 5000;
  const offset = params.offset || 0;
  query = query.replace('[limit_offset]', `LIMIT ${limit} OFFSET ${offset}`);
  
  return query;
}