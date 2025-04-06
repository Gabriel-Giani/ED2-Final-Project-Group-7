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
  accidents: [],
  hotspots: [],
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
  },

  // UI State
  loading: false,
  loadingMessage: "",
  mapViewType: "hotspots",
  showPoints: false,

  // Reference Data
  counties: [],
  cities: [],
};

// Reducer to handle state updates
const accidentReducer = (state, action) => {
  switch (action.type) {
    case "SET_ACCIDENTS":
      return { ...state, accidents: action.payload };

    case "SET_HOTSPOTS":
      return { ...state, hotspots: action.payload };

    case "SET_ROAD_LINE_SEGMENTS":
      return { ...state, roadLineSegments: action.payload };

    case "SET_FILTER":
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.name]: action.value,
        },
      };

    case "SET_FILTERS":
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload,
        },
      };

    case "RESET_FILTERS":
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

    case "SET_MAP_VIEW_TYPE":
      return { ...state, mapViewType: action.payload };

    case "TOGGLE_POINTS":
      return { ...state, showPoints: !state.showPoints };

    case "SET_SHOW_POINTS":
      return { ...state, showPoints: action.payload };

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
      // Fetch counties
      const counties = await accidentDataService.getRegionOptions("county");
      dispatch({
        type: "SET_REGION_OPTIONS",
        regionType: "county",
        payload: counties,
      });

      // Fetch cities
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

  // Fetch data when filters or mapViewType change
  useEffect(() => {
    const fetchData = async () => {
      // Set loading state with initial message based on view type
      const initialMessage =
        state.mapViewType === "roadLines"
          ? "Fetching road data..."
          : "Fetching accident data...";
      dispatch({
        type: "SET_LOADING",
        payload: { loading: true, message: initialMessage },
      });

      try {
        if (state.mapViewType === "roadLines") {
          // Fetch road line segments
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
          // Clear hotspot/accident data when switching? Optional.
          dispatch({ type: "SET_ACCIDENTS", payload: [] });
          dispatch({ type: "SET_HOTSPOTS", payload: [] });
        } else {
          // Default to 'hotspots' view
          // Build query params from filters
          const queryParams = accidentDataService.buildQueryParams(
            state.filters
          );

          // Fetch accident data
          console.log(
            "Fetching hotspots/accidents with queryParams:",
            queryParams
          );
          const accidents = await accidentDataService.getFilteredAccidents(
            queryParams,
            handleProgress
          ); // Pass progress handler if service supports it

          // Process the data for hotspots
          handleProgress({ message: "Processing hotspots..." }); // Update message
          const { hotspots } =
            accidentDataService.processAccidentData(accidents); // Only process hotspots if needed

          // Update state
          dispatch({ type: "SET_ACCIDENTS", payload: accidents });
          dispatch({ type: "SET_HOTSPOTS", payload: hotspots });
          // Clear road line data when switching? Optional.
          dispatch({ type: "SET_ROAD_LINE_SEGMENTS", payload: [] });
        }
      } catch (error) {
        console.error(`Error fetching data for ${state.mapViewType}:`, error);
        dispatch({
          type: "SET_LOADING",
          payload: { loading: false, message: "Error loading data." },
        }); // Show error message
      } finally {
        // Set loading false, clear message only if successful, otherwise keep error message
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
    // Add state.mapViewType to dependency array
  }, [dataFetchTrigger, state.mapViewType]); // Re-fetch when trigger OR viewType changes

  // Utility functions

  // Update a single filter
  const updateFilter = (name, value) => {
    dispatch({ type: "SET_FILTER", name, value });
  };

  // Update multiple filters at once
  const updateFilters = (filters) => {
    dispatch({ type: "SET_FILTERS", payload: filters });
  };

  // Reset all filters to default
  const resetFilters = () => {
    dispatch({ type: "RESET_FILTERS" });
    triggerDataFetch();
  };

  // Set the map view type
  const setMapViewType = (viewType) => {
    if (viewType !== state.mapViewType) {
      console.log(`Switching map view to: ${viewType}`);
      dispatch({ type: "SET_MAP_VIEW_TYPE", payload: viewType });
      // No need to call triggerDataFetch here, useEffect dependency array handles it
    }
  };

  // Toggle between points and heatmap view (Consider removing/deprecating)
  const togglePointsView = () => {
    // Maybe this should now cycle through view types?
    // Or be removed in favour of a direct ViewToggle component?
    // For now, let's make it switch between hotspots and roadLines
    const nextView =
      state.mapViewType === "hotspots" ? "roadLines" : "hotspots";
    setMapViewType(nextView);
    // dispatch({ type: 'TOGGLE_POINTS' }); // Keep original showPoints logic? Probably not needed.
  };

  // Trigger data fetch (called after filter updates)
  const triggerDataFetch = () => {
    setDataFetchTrigger((prev) => prev + 1);
  };

  // Apply filters and fetch data
  const applyFilters = () => {
    triggerDataFetch();
  };

  // Process filters and send to parent (seems redundant if applyFilters works?)
  const processAndApplyFilters = (localFilters) => {
    updateFilters(localFilters);
    triggerDataFetch();
  };

  // Get top accident hotspots
  const getTopHotspots = (limit = 10) => {
    // Only relevant for hotspot view
    if (state.mapViewType !== "hotspots" || !state.hotspots) return [];
    return state.hotspots
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, limit);
  };

  return (
    <AccidentContext.Provider
      value={{
        ...state, // Spread all state values (accidents, hotspots, roadLineSegments, filters, loading, mapViewType, etc.)
        updateFilter,
        updateFilters,
        resetFilters,
        applyFilters,
        setMapViewType, // Export the new function
        togglePointsView, // Keep or remove?
        processAndApplyFilters, // Keep or remove?
        getTopHotspots,
      }}
    >
      {children}
    </AccidentContext.Provider>
  );
};

// Custom hook to use the accident context
export const useAccidentContext = () => {
  const context = useContext(AccidentContext);
  if (!context) {
    throw new Error(
      "useAccidentContext must be used within an AccidentProvider"
    );
  }
  return context;
};
