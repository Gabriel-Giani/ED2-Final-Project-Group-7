"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function SupabaseTest() {
  const [status, setStatus] = useState("Testing connection...");
  const [error, setError] = useState(null);
  const [count, setCount] = useState(null);
  const [tableName, setTableName] = useState("ultimate-table");

  useEffect(() => {
    async function testConnection() {
      try {
        console.log(`Testing connection to table: ${tableName}`);

        // First try with quotes around the table name
        try {
          const { data, error, count } = await supabase
            .from("ultimate-table")
            .select("*", { count: "exact" })
            .limit(1);

          if (error) {
            console.error("Supabase test with quotes failed:", error);
            throw error;
          }

          console.log("Supabase test query result:", data);
          setStatus("Connection successful");
          setCount(count);
          return;
        } catch (quotedError) {
          console.log("Quoted table name approach failed:", quotedError);
          // Continue to try without quotes
        }

        // Try without quotes
        try {
          const { data, error, count } = await supabase
            .from(tableName)
            .select("*", { count: "exact" })
            .limit(1);

          if (error) {
            console.error("Supabase test without quotes failed:", error);
            throw error;
          }

          console.log("Supabase test query result:", data);
          setStatus("Connection successful");
          setCount(count);
          return;
        } catch (unquotedError) {
          console.log("Unquoted table name approach failed:", unquotedError);
          // Try one more approach
        }

        // Try with backticks
        const { data, error, count } = await supabase
          .from(`ultimate-table`)
          .select("*", { count: "exact" })
          .limit(1);

        if (error) {
          console.error("Supabase test with backticks failed:", error);
          throw error;
        }

        console.log("Supabase test query result:", data);
        setStatus("Connection successful");
        setCount(count);
      } catch (err) {
        console.error("Supabase test error:", err);
        setStatus("Connection failed");
        setError(err.message || JSON.stringify(err));
      }
    }

    testConnection();
  }, [tableName]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <h2 className="text-lg font-bold mb-2">Supabase Connection Test</h2>
      <div className="mb-2">
        Status:{" "}
        <span
          className={
            status === "Connection successful"
              ? "text-green-500 font-bold"
              : "text-red-500 font-bold"
          }
        >
          {status}
        </span>
      </div>
      <div className="mb-2">
        Table: <span className="font-bold">{tableName}</span>
      </div>
      {count !== null && (
        <div className="mb-2">
          Records in {tableName}: <span className="font-bold">{count}</span>
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm mt-2 p-2 bg-red-900 bg-opacity-30 rounded">
          Error: {error}
        </div>
      )}
    </div>
  );
}
