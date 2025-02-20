import { createClient } from "@supabase/supabase-js";
import { ACCIDENT_QUERIES } from "./queries";

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
// hey
// Convert 12-hour time (HH:MM AM/PM) to 24-hour format (HHMM)
function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":");

  let hours24 = parseInt(hours, 10);

  if (hours24 === 12) {
    hours24 = modifier === "PM" ? 12 : 0;
  } else if (modifier === "PM") {
    hours24 = hours24 + 12;
  }

  return `${hours24.toString().padStart(2, "0")}${minutes}`;
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

// Add other accident query functions here...
