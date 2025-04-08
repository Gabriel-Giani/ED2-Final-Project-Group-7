// filepath: /src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log Supabase configuration for debugging (without exposing full keys)
console.log("Supabase URL configured:", supabaseUrl ? "Yes" : "No");
console.log("Supabase Anon Key configured:", supabaseAnonKey ? "Yes" : "No");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing!");
}

// Simple in-memory cache
const cache = {
  data: new Map(),
  set: (key, value, ttl = 300000) => {
    // Default TTL: 5 minutes
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
  },
};

// Create a custom fetch function with error handling and retry logic
const customFetch = async (url, options) => {
  // Simple retry logic
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(
        `Supabase request to: ${url.split("?")[0]} (attempt ${
          retries + 1
        }/${maxRetries})`
      );
      const response = await fetch(url, options);

      if (!response.ok) {
        console.error(
          `Supabase fetch error: ${response.status} ${response.statusText}`
        );
        // Log response details for debugging
        try {
          const errorData = await response.clone().text();
          console.error("Error response:", errorData);
        } catch (e) {
          console.error("Could not read error response");
        }

        // For 429 (Too Many Requests), wait longer before retrying
        if (response.status === 429) {
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
      }

      return response;
    } catch (error) {
      console.error(
        `Supabase fetch exception (attempt ${retries + 1}/${maxRetries}):`,
        error
      );

      if (retries < maxRetries - 1) {
        const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
        console.log(`Waiting ${waitTime}ms before retry`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        retries++;
      } else {
        throw error;
      }
    }
  }
};

// Create the Supabase client with options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: customFetch,
  },
  db: {
    schema: "public",
  },
});

// Batch fetching helper
export async function batchFetchData(tableName, options = {}) {
  const {
    pageSize = 1000,
    maxPages = 5,
    cacheKey = null,
    cacheTTL = 300000, // 5 minutes
    select = "*",
    filters = [],
    orderBy = null,
  } = options;

  // Check cache first
  if (cacheKey) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) return cachedData;
  }

  console.log(
    `Batch fetching data from ${tableName} with page size ${pageSize}, max pages ${maxPages}`
  );

  let allData = [];
  let page = 0;
  let hasMore = true;

  try {
    while (hasMore && page < maxPages) {
      // Build query
      let query = supabase
        .from(tableName)
        .select(select)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      filters.forEach((filter) => {
        const { column, operator = "eq", value } = filter;

        if (operator === "eq") {
          query = query.eq(column, value);
        } else if (operator === "neq") {
          query = query.neq(column, value);
        } else if (operator === "gt") {
          query = query.gt(column, value);
        } else if (operator === "gte") {
          query = query.gte(column, value);
        } else if (operator === "lt") {
          query = query.lt(column, value);
        } else if (operator === "lte") {
          query = query.lte(column, value);
        } else if (operator === "like") {
          query = query.like(column, value);
        } else if (operator === "ilike") {
          query = query.ilike(column, value);
        } else if (operator === "is") {
          query = query.is(column, value);
        } else if (operator === "in") {
          query = query.in(column, value);
        } else if (operator === "not") {
          query = query.not(column, value);
        } else {
          // Default to equality if operator not recognized
          console.warn(`Unknown operator '${operator}', defaulting to 'eq'`);
          query = query.eq(column, value);
        }
      });

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching batch ${page} from ${tableName}:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log(
          `Received ${data.length} rows for batch ${page} from ${tableName}`
        );
        allData = [...allData, ...data];
        page++;

        // Check if we have more data
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }

      // Small delay between batches to avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(`Total rows fetched from ${tableName}: ${allData.length}`);

    // Cache the result
    if (cacheKey) {
      cache.set(cacheKey, allData, cacheTTL);
    }

    return allData;
  } catch (error) {
    console.error(`Error in batch fetching from ${tableName}:`, error);
    throw error;
  }
}

// Helper to get unique values from a column
export async function getUniqueColumnValues(tableName, column, options = {}) {
  const cacheKey = `${tableName}_unique_${column}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  try {
    console.log(`Fetching unique values for ${column} from ${tableName}`);

    // Use a more efficient approach - fetch just the column we need
    const { data, error } = await supabase
      .from(tableName)
      .select(column)
      .not(column, "is", null)
      .limit(options.limit || 1000);

    if (error) {
      console.error(`Error fetching unique ${column} values:`, error);
      throw error;
    }

    // Extract unique values with proper case handling
    let uniqueValues = [...new Set(data.map((item) => item[column]))].filter(
      Boolean
    );

    // For townname column, properly format the values (Title Case)
    if (column === "townname") {
      uniqueValues = uniqueValues.map((town) =>
        town
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ")
      );
    }

    console.log(`Found ${uniqueValues.length} unique ${column} values`);

    // Cache the result
    cache.set(cacheKey, uniqueValues, options.cacheTTL || 300000);

    return uniqueValues;
  } catch (error) {
    console.error(`Error getting unique values for ${column}:`, error);
    throw error;
  }
}

// Test the connection immediately with a simpler query
(async () => {
  try {
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase
      .from("ultimate-table")
      .select("dotcounty")
      .limit(1);

    if (error) {
      console.error("Supabase connection test failed:", error);
    } else {
      console.log("Supabase connection test successful:", data);
    }
  } catch (e) {
    console.error("Supabase connection test exception:", e);
  }
})();
