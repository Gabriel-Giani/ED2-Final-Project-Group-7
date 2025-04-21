"use client";

// src/context/accidentContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";
import { accidentDataService } from "@/services/accidentDataService";
import { roadSegmentService } from "@/services/roadSegmentService";

// Initial state
export const initialState = {
  // Data
  accidents: [], // Keep this for individual points view
  roadLineSegments: [], // Keep for road lines

  // Filters
  filters: {
    filterRegion: "state",
    regionName: "",
    dateRange: { start: "", end: "" },
    timeRange: { start: "", end: "" },
    useTimeFilter: false,
    locationRadius: "",

    // Additional filters
    dayOfWeek: "",
    roadName: "",
    injuryLevel: "",
    lightCondition: "",
    weatherCondition: "",
    roadSurfaceCondition: "",
    aggressiveDriving: false,
    pedestrianInvolved: false,
    bicycleInvolved: false,
    motorcycleInvolved: false,
    teenInvolved: false,
    elderlyInvolved: false,
    impaired: false,
    direction: "",
    damageMin: "",
    damageMax: "",
    topSegmentsLimit: 10,
  },

  // UI State
  loading: false,
  loadingMessage: "",
  showPoints: false,

  // Reference Data
  counties: [],
  cities: [],
};

// Action types
const actionTypes = {
  SET_LOADING: "SET_LOADING",
  SET_LOADING_MESSAGE: "SET_LOADING_MESSAGE",
  SET_ROAD_LINE_SEGMENTS: "SET_ROAD_LINE_SEGMENTS",
  SET_ACCIDENTS: "SET_ACCIDENTS",
  SET_FILTERS: "SET_FILTERS",
  SET_COUNTIES: "SET_COUNTIES",
  SET_CITIES: "SET_CITIES",
  SET_SHOW_POINTS: "SET_SHOW_POINTS",
};

// Reducer
function reducer(state, action) {
  switch (action.type) {
    case actionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    case actionTypes.SET_LOADING_MESSAGE:
      return { ...state, loadingMessage: action.payload };
    case actionTypes.SET_ROAD_LINE_SEGMENTS:
      return { ...state, roadLineSegments: action.payload };
    case actionTypes.SET_ACCIDENTS:
      return { ...state, accidents: action.payload };
    case actionTypes.SET_FILTERS:
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case actionTypes.SET_COUNTIES:
      return { ...state, counties: action.payload };
    case actionTypes.SET_CITIES:
      return { ...state, cities: action.payload };
    case actionTypes.SET_SHOW_POINTS:
      return { ...state, showPoints: action.payload };
    default:
      return state;
  }
}

// Context
const AccidentContext = createContext();

// Provider Component
export function AccidentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pathname = usePathname();

  // Load data based on filters
  const loadData = useCallback(async () => {
    if (pathname === "/case-study/fau") {
      console.log("On case study page, skipping general data load.");
      dispatch({ type: actionTypes.SET_LOADING, payload: false });
      dispatch({ type: actionTypes.SET_LOADING_MESSAGE, payload: "" });
      return;
    }

    console.log(
      "AccidentProvider: Loading data based on filters:",
      state.filters
    );
    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      dispatch({
        type: actionTypes.SET_LOADING_MESSAGE,
        payload: "Loading road data...",
      });

      // Load road line segments
      const segments = await roadSegmentService.getMajorRoadLineSegments(
        state.filters,
        (progress) => {
          if (progress.message) {
            dispatch({
              type: actionTypes.SET_LOADING_MESSAGE,
              payload: progress.message,
            });
          }
        }
      );

      dispatch({
        type: actionTypes.SET_ROAD_LINE_SEGMENTS,
        payload: segments || [],
      });

      // Load individual accidents if needed
      dispatch({
        type: actionTypes.SET_LOADING_MESSAGE,
        payload: "Loading accident data...",
      });

      const accidents = await accidentDataService.getAccidents(state.filters);
      dispatch({ type: actionTypes.SET_ACCIDENTS, payload: accidents || [] });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      dispatch({ type: actionTypes.SET_LOADING, payload: false });
      dispatch({ type: actionTypes.SET_LOADING_MESSAGE, payload: "" });
    }
  }, [state.filters, pathname]);

  // Load main accident/segment data when filters change OR pathname changes (to re-enable loading when navigating away from case study)
  useEffect(() => {
    if (pathname !== "/case-study/fau") {
      console.log(
        "Pathname is not case study, proceeding with loadData trigger."
      );
      loadData();
    }
  }, [loadData, pathname]);

  // Fetch initial filter options (counties, cities) on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        console.log("Fetching initial filter options (counties, cities)...");
        // Fetch counties using getRegionOptions
        const counties = await accidentDataService.getRegionOptions("county");
        if (counties && counties.length > 0) {
          dispatch({ type: actionTypes.SET_COUNTIES, payload: counties });
          console.log(`Fetched ${counties.length} unique counties.`);
        } else {
          console.warn("No counties returned from service.");
          dispatch({ type: actionTypes.SET_COUNTIES, payload: [] });
        }

        // Fetch cities using getRegionOptions
        const cities = await accidentDataService.getRegionOptions("city");
        if (cities && cities.length > 0) {
          dispatch({ type: actionTypes.SET_CITIES, payload: cities });
          console.log(`Fetched ${cities.length} unique cities.`);
        } else {
          console.warn("No cities returned from service.");
          dispatch({ type: actionTypes.SET_CITIES, payload: [] });
        }
      } catch (error) {
        console.error("Error fetching filter options:", error);
        dispatch({ type: actionTypes.SET_COUNTIES, payload: [] });
        dispatch({ type: actionTypes.SET_CITIES, payload: [] });
      }
    };

    fetchFilterOptions();
  }, []);

  const value = {
    ...state,
    setFilters: (filters) =>
      dispatch({ type: actionTypes.SET_FILTERS, payload: filters }),
    setCounties: (counties) =>
      dispatch({ type: actionTypes.SET_COUNTIES, payload: counties }),
    setCities: (cities) =>
      dispatch({ type: actionTypes.SET_CITIES, payload: cities }),
    setShowPoints: (show) =>
      dispatch({ type: actionTypes.SET_SHOW_POINTS, payload: show }),
  };

  return (
    <AccidentContext.Provider value={value}>
      {children}
    </AccidentContext.Provider>
  );
}

// Hook
export function useAccidentContext() {
  const context = useContext(AccidentContext);
  if (!context) {
    throw new Error("useAccidentContext must be used within AccidentProvider");
  }
  return context;
}
