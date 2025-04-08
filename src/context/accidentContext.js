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
import { accidentDataService } from "@/services/accidentDataService";
import { roadSegmentService } from "@/services/roadSegmentService";

// Initial state
const initialState = {
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
    default:
      return state;
  }
}

// Context
const AccidentContext = createContext();

// Provider Component
export function AccidentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data based on filters
  const loadData = useCallback(async () => {
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
  }, [state.filters]);

  // Load data when filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  const value = {
    ...state,
    setFilters: (filters) =>
      dispatch({ type: actionTypes.SET_FILTERS, payload: filters }),
    setCounties: (counties) =>
      dispatch({ type: actionTypes.SET_COUNTIES, payload: counties }),
    setCities: (cities) =>
      dispatch({ type: actionTypes.SET_CITIES, payload: cities }),
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
