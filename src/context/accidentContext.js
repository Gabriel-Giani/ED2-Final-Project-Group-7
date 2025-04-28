"use client";

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

export const initialState = {
  // Data
  accidents: [],
  roadLineSegments: [],

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

const AccidentContext = createContext();

export function AccidentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pathname = usePathname();

  const loadData = useCallback(async () => {
    if (pathname === "/case-study/fau") {
      dispatch({ type: actionTypes.SET_LOADING, payload: false });
      dispatch({ type: actionTypes.SET_LOADING_MESSAGE, payload: "" });
      return;
    }

    try {
      dispatch({ type: actionTypes.SET_LOADING, payload: true });
      dispatch({
        type: actionTypes.SET_LOADING_MESSAGE,
        payload: "Loading road data...",
      });

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

  useEffect(() => {
    if (pathname !== "/case-study/fau") {
      loadData();
    }
  }, [loadData, pathname]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        accidentDataService.clearCache();

        const counties = await accidentDataService.getRegionOptions("county");
        if (counties && counties.length > 0) {
          dispatch({ type: actionTypes.SET_COUNTIES, payload: counties });
        } else {
          console.warn("No counties returned from service.");
          dispatch({ type: actionTypes.SET_COUNTIES, payload: [] });
        }

        const cities = await accidentDataService.getRegionOptions("city");

        if (cities && cities.length > 0) {
          dispatch({ type: actionTypes.SET_CITIES, payload: cities });
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

export function useAccidentContext() {
  const context = useContext(AccidentContext);
  if (!context) {
    throw new Error("useAccidentContext must be used within AccidentProvider");
  }
  return context;
}
