import { createClient } from "@supabase/supabase-js";
import { ACCIDENT_QUERIES } from "./queries";

// Interface for filter parameters
export interface AccidentFilterParams {
  // Region filters
  dotcounty?: string;
  townname?: string;
  
  // Date and time filters
  dateStart?: string;
  dateEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  dayofweek?: string;
  
  // Location filters
  lat?: number;
  lng?: number;
  radius?: number;
  
  // Road filters
  onroadname?: string;
  inroadname?: string;
  refdirect?: string;
  srrouteid?: string;
  
  // Crash characteristics
  highestinj?: string;
  crshalcdrg?: string;
  lightcond?: string;
  weathcond?: string;
  rdsurfcond?: string;
  totcrshdmg?: number;
  damageMin?: number;
  damageMax?: number;
  
  // Boolean flags
  fl_aggrsv?: string;
  fl_vru_ped?: string;
  fl_vru_bik?: string;
  fl_vru_mot?: string;
  fl_ar_teen?: string;
  fl_ar_ag?: string;
  flag_imp?: string;
  
  // Query control
  limit?: number;
  offset?: number;
}

export async function getAccidentsInRadius(
  lat: number,
  lng: number,
  radiusMeters: number
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.rpc("query_accidents_in_radius", {
    query: ACCIDENT_QUERIES.ACCIDENTS_IN_RADIUS,
    params: [lng, lat, radiusMeters],
  });

  if (error) throw error;
  return data;
}

export async function getAccidentsByDateRange(
  startDate: string,
  endDate: string
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("ultimate-table")
    .select("*")
    .gte("crashdate", startDate)
    .lte("crashdate", endDate);

  if (error) throw error;
  return data;
}

export async function getAccidentsByDate(date: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("ultimate-table")
    .select("*")
    .eq("crashdate", date);

  if (error) throw error;
  return data;
}

export async function getAccidentCountByDateRange(
  startDate: string,
  endDate: string
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("ultimate-table")
    .select("*", { count: "exact" })
    .gte("crashdate", startDate)
    .lte("crashdate", endDate);

  if (error) throw error;
  return data.length;
}

// Convert 12-hour time (HH:MM) to 24-hour format (HHMM)
function convertTo24Hour(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return '';
  
  const [hours, minutes] = timeStr.split(":");
  const hoursNum = parseInt(hours, 10);
  
  // Simple conversion assuming input is 24-hour format already
  return `${hoursNum.toString().padStart(2, "0")}${minutes}`;
}

export async function getAccidentsByDateAndTimeRange(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Convert times to 24-hour format
  const startTime24 = convertTo24Hour(startTime);
  const endTime24 = convertTo24Hour(endTime);

  const { data, error } = await supabase
    .from("ultimate-table")
    .select("*")
    .gte("crashdate", startDate)
    .lte("crashdate", endDate)
    .gte("crashtime", startTime24)
    .lte("crashtime", endTime24);

  if (error) throw error;
  return data;
}

// New comprehensive filter method
export async function getFilteredAccidents(filters: AccidentFilterParams) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase.from("ultimate-table").select("*");
  
  // Region filters
  if (filters.dotcounty) {
    query = query.eq("dotcounty", filters.dotcounty);
  }
  
  if (filters.townname) {
    query = query.ilike("townname", `%${filters.townname}%`);
  }
  
  // Date and time filters
  if (filters.dateStart && filters.dateEnd) {
    query = query.gte("crashdate", filters.dateStart)
               .lte("crashdate", filters.dateEnd);
  }
  
  if (filters.timeStart && filters.timeEnd) {
    const startTime24 = convertTo24Hour(filters.timeStart);
    const endTime24 = convertTo24Hour(filters.timeEnd);
    
    if (startTime24 && endTime24) {
      query = query.gte("crashtime", startTime24)
                 .lte("crashtime", endTime24);
    }
  }
  
  if (filters.dayofweek) {
    query = query.eq("dayofweek", filters.dayofweek);
  }
  
  // Road filters
  if (filters.onroadname) {
    query = query.ilike("onroadname", `%${filters.onroadname}%`);
  }
  
  if (filters.inroadname) {
    query = query.ilike("inroadname", `%${filters.inroadname}%`);
  }
  
  if (filters.refdirect) {
    query = query.eq("refdirect", filters.refdirect);
  }
  
  if (filters.srrouteid) {
    query = query.eq("srrouteid", filters.srrouteid);
  }
  
  // Crash characteristics
  if (filters.highestinj) {
    query = query.eq("highestinj", filters.highestinj);
  }
  
  if (filters.crshalcdrg) {
    query = query.eq("crshalcdrg", filters.crshalcdrg);
  }
  
  if (filters.lightcond) {
    query = query.eq("lightcond", filters.lightcond);
  }
  
  if (filters.weathcond) {
    query = query.eq("weathcond", filters.weathcond);
  }
  
  if (filters.rdsurfcond) {
    query = query.eq("rdsurfcond", filters.rdsurfcond);
  }
  
  // Damage amount range
  if (filters.damageMin) {
    query = query.gte("totcrshdmg", filters.damageMin);
  }
  
  if (filters.damageMax) {
    query = query.lte("totcrshdmg", filters.damageMax);
  }
  
  // Boolean flags (Y/N values)
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
  
  // Radius-based filtering requires a custom SQL query or RPC function
  // This would need to be implemented on the Supabase backend
  if (filters.lat && filters.lng && filters.radius) {
    // Assuming an RPC function is available:
    // return supabase.rpc("get_accidents_in_radius", { 
    //   lat: filters.lat, 
    //   lng: filters.lng, 
    //   radius: filters.radius 
    // });
    
    // For now, we'll fetch all data and filter on the client side
    console.warn("Radius filtering not implemented in this query");
  }
  
  // Apply limit and offset if provided
  if (filters.limit) {
    query = query.limit(filters.limit);
  } else {
    // Default limit to prevent huge result sets
    query = query.limit(5000);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 5000) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data;
}

// Get accidents with all filters in a single call
export async function getAccidentsWithAllFilters(
  filterParams: AccidentFilterParams
) {
  try {
    return await getFilteredAccidents(filterParams);
  } catch (error) {
    console.error("Error fetching filtered accidents:", error);
    throw error;
  }
}