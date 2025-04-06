"use client";

// src/context/accidentContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
} from "react";
import { accidentDataService } from "@/services/accidentDataService";
import { roadSegmentService } from "@/services/roadSegmentService";

// Initial state
const initialState = {
  // Data
  // accidents: [], // No longer needed? Keep if used elsewhere.
  // hotspots: [], // No longer needed
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
    topSegmentsLimit: 10, // Add limit for top segments
  },

  // UI State
  loading: false,
  loadingMessage: "",
  // mapViewType: 'roadLines', // No longer needed, default is roadLines
  // showPoints: false, // No longer needed

  // Reference Data
  counties: [],
  cities: [],
};

// Reducer to handle state updates
const accidentReducer = (state, action) => {
  switch (action.type) {
    // case 'SET_ACCIDENTS': // Remove if not needed
    //   return { ...state, accidents: action.payload };
    // case 'SET_HOTSPOTS': // Remove
    //   return { ...state, hotspots: action.payload };
    case "SET_ROAD_LINE_SEGMENTS":
      return { ...state, roadLineSegments: action.payload };
    case "SET_FILTER": {
      // Validate topSegmentsLimit
      let value = action.value;
      if (action.name === "topSegmentsLimit") {
        const numValue = parseInt(value, 10);
        // Ensure it's a positive number, default to 1 if invalid
        value = isNaN(numValue) || numValue <= 0 ? 1 : numValue;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.name]: value,
        },
      };
    }
    case "SET_FILTERS": {
      // Also validate limit if present in bulk update
      let updatedFilters = { ...action.payload };
      if (updatedFilters.hasOwnProperty("topSegmentsLimit")) {
        const numValue = parseInt(updatedFilters.topSegmentsLimit, 10);
        updatedFilters.topSegmentsLimit =
          isNaN(numValue) || numValue <= 0 ? 1 : numValue;
      }
      return {
        ...state,
        filters: {
          ...state.filters,
          ...updatedFilters,
        },
      };
    }
    case "RESET_FILTERS":
      // Ensure the limit resets correctly to the initial state value
      return {
        ...state,
        filters: { ...initialState.filters },
      };
    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload.loading,
        loadingMessage: action.payload.message || "",
      };
    // case 'SET_MAP_VIEW_TYPE': // Remove
    //    return { ...state, mapViewType: action.payload };
    // case 'TOGGLE_POINTS': // Remove
    //   return { ...state, showPoints: !state.showPoints };
    // case 'SET_SHOW_POINTS': // Remove
    //   return { ...state, showPoints: action.payload };
    case "SET_REGION_OPTIONS":
      return {
        ...state,
        [action.regionType === "county" ? "counties" : "cities"]:
          action.payload,
      };
    default:
      return state;
  }
};

// Create the context
const AccidentContext = createContext();

// Provider component
export const AccidentProvider = ({ children }) => {
  const [state, dispatch] = useReducer(accidentReducer, initialState);
  const [dataFetchTrigger, setDataFetchTrigger] = useState(0);

  // Fetch region options on mount
  useEffect(() => {
    const fetchRegionOptions = async () => {
      const counties = await accidentDataService.getRegionOptions("county");
      dispatch({
        type: "SET_REGION_OPTIONS",
        regionType: "county",
        payload: counties,
      });
      const cities = await accidentDataService.getRegionOptions("city");
      dispatch({
        type: "SET_REGION_OPTIONS",
        regionType: "city",
        payload: cities,
      });
    };
    fetchRegionOptions();
  }, []);

  // Callback for progress updates from services
  const handleProgress = (progress) => {
    console.log("Progress Update:", progress);
    dispatch({
      type: "SET_LOADING",
      payload: {
        loading: true,
        message: progress.message || state.loadingMessage,
      },
    });
  };

  // Fetch data when filters change (simplified)
  useEffect(() => {
    const fetchData = async () => {
      dispatch({
        type: "SET_LOADING",
        payload: { loading: true, message: "Fetching road data..." },
      });

      try {
        // Always fetch road line segments
        console.log("Fetching road lines with filters:", state.filters);
        const roadLineSegmentsData =
          await roadSegmentService.getMajorRoadLineSegments(
            state.filters,
            handleProgress
          );
        dispatch({
          type: "SET_ROAD_LINE_SEGMENTS",
          payload: roadLineSegmentsData,
        });
      } catch (error) {
        console.error(`Error fetching road line data:`, error);
        dispatch({
          type: "SET_LOADING",
          payload: { loading: false, message: "Error loading data." },
        });
      } finally {
        if (!state.loadingMessage.startsWith("Error")) {
          dispatch({
            type: "SET_LOADING",
            payload: { loading: false, message: "" },
          });
        } else {
          dispatch({
            type: "SET_LOADING",
            payload: { loading: false, message: state.loadingMessage },
          });
        }
      }
    };

    fetchData();
    // Only trigger on filter changes now
  }, [dataFetchTrigger]);

  // Utility functions

  const updateFilter = (name, value) => {
    dispatch({ type: "SET_FILTER", name, value });
  };

  const updateFilters = (filters) => {
    dispatch({ type: "SET_FILTERS", payload: filters });
  };

  const resetFilters = () => {
    dispatch({ type: "RESET_FILTERS" });
    triggerDataFetch();
  };

  // Remove setMapViewType, togglePointsView

  const triggerDataFetch = () => {
    setDataFetchTrigger((prev) => prev + 1);
  };

  const applyFilters = () => {
    triggerDataFetch();
  };

  const processAndApplyFilters = (localFilters) => {
    updateFilters(localFilters);
    triggerDataFetch();
  };

  // Remove getTopHotspots

  return (
    <AccidentContext.Provider
      value={{
        // Spread remaining state values (roadLineSegments, filters, loading, etc.)
        ...state,
        updateFilter,
        updateFilters,
        resetFilters,
        applyFilters,
        processAndApplyFilters,
        // Removed: setMapViewType, togglePointsView, getTopHotspots
      }}
    >
      {children}
    </AccidentContext.Provider>
  );
};

// Custom hook remains the same
export const useAccidentContext = () => {
  const context = useContext(AccidentContext);
  if (!context) {
    throw new Error(
      "useAccidentContext must be used within an AccidentProvider"
    );
  }
  return context;
};
