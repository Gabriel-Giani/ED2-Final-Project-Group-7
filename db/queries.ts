// Traffic accident query constants
export const ACCIDENT_QUERIES = {
  // Get accidents within a radius of a point
  ACCIDENTS_IN_RADIUS: `
    SELECT *
    FROM accidents
    WHERE ST_DWithin(
      geography(location),
      ST_MakePoint($1, $2)::geography,
      $3
    )
  `,

  // Get accidents by severity
  ACCIDENTS_BY_SEVERITY: `
    SELECT *
    FROM accidents 
    WHERE severity = $1
  `,

  // Get accidents within a polygon/boundary
  ACCIDENTS_IN_BOUNDARY: `
    SELECT *
    FROM ultimate-table
    WHERE ST_Within(
      location,
      ST_GeomFromGeoJSON($1)
    )
  `,

  // Get accidents by date range
  ACCIDENTS_BY_DATE_RANGE: `
    SELECT *
    FROM ultimate-table
    WHERE crashdate >= $1 
    AND crashdate <= $2
  `,

  // Get accidents for specific date
  ACCIDENTS_BY_DATE: `
    SELECT *
    FROM ultimate-table
    WHERE crashdate = $1
  `,

  // Get accident count by date range
  ACCIDENT_COUNT_BY_DATE_RANGE: `
    SELECT 
      COUNT(*) as accident_count
    FROM 
      ultimate-table
    WHERE 
      crashdate >= $1 
      AND crashdate <= $2
  `,

  // Get accidents by date and time range
  ACCIDENTS_BY_DATE_AND_TIME_RANGE: `
    SELECT *
    FROM ultimate-table
    WHERE crashdate >= $1 
    AND crashdate <= $2
    AND crashtime >= $3
    AND crashtime <= $4
  `,
};
