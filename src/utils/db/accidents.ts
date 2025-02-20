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
    .from("florida_crashes_2006")
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
    .from("florida_crashes_2006")
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
    .from("florida_crashes_2006")
    .select("*", { count: "exact" })
    .gte("crashdate", startDate)
    .lte("crashdate", endDate);

  if (error) throw error;
  return data.length;
}

// Add other accident query functions here...
