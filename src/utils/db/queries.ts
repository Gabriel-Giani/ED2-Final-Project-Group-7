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
    FROM accidents
    WHERE ST_Within(
      location,
      ST_GeomFromGeoJSON($1)
    )
  `,

  // Get accidents by date range
  ACCIDENTS_BY_DATE_RANGE: `
    SELECT *
    FROM florida_crashes_2006
    WHERE crashdate >= $1 
    AND crashdate <= $2
  `,

  // Get accidents for specific date
  ACCIDENTS_BY_DATE: `
    SELECT *
    FROM florida_crashes_2006
    WHERE crashdate = $1
  `,

  // Get accident count by date range
  ACCIDENT_COUNT_BY_DATE_RANGE: `
    SELECT 
      COUNT(*) as accident_count
    FROM 
      florida_crashes_2006
    WHERE 
      crashdate >= $1 
      AND crashdate <= $2
  `,
};
