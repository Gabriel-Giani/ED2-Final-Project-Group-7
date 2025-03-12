"use client";

// src/context/accidentContext.js
import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { accidentDataService } from '@/services/accidentDataService';

// Initial state
const initialState = {
  // Data
  accidents: [],
  hotspots: [],
  roadSegments: [],
  
  // Filters
  filters: {
    filterRegion: 'state',
    regionName: '',
    dateRange: { start: '', end: '' },
    timeRange: { start: '', end: '' },
    useTimeFilter: false,
    locationRadius: '',
    
    // Additional filters
    dayOfWeek: '',
    roadName: '',
    intersectingRoad: '',
    injuryLevel: '',
    alcoholDrugs: '',
    lightCondition: '',
    weatherCondition: '',
    roadSurfaceCondition: '',
    aggressiveDriving: false,
    pedestrianInvolved: false,
    bicycleInvolved: false,
    motorcycleInvolved: false,
    teenInvolved: false,
    elderlyInvolved: false,
    impaired: false,
    direction: '',
    damageMin: '',
    damageMax: ''
  },
  
  // UI State
  loading: false,
  showPoints: false,
  
  // Reference Data
  counties: [],
  cities: []
};

// Reducer to handle state updates
const accidentReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ACCIDENTS':
      return { ...state, accidents: action.payload };
      
    case 'SET_HOTSPOTS':
      return { ...state, hotspots: action.payload };
      
    case 'SET_ROAD_SEGMENTS':
      return { ...state, roadSegments: action.payload };
      
    case 'SET_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.name]: action.value
        }
      };
      
    case 'SET_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      };
      
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: { ...initialState.filters }
      };
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'TOGGLE_POINTS':
      return { ...state, showPoints: !state.showPoints };
      
    case 'SET_SHOW_POINTS':
      return { ...state, showPoints: action.payload };
      
    case 'SET_REGION_OPTIONS':
      return {
        ...state,
        [action.regionType === 'county' ? 'counties' : 'cities']: action.payload 
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
      const counties = await accidentDataService.getRegionOptions('county');
      dispatch({ type: 'SET_REGION_OPTIONS', regionType: 'county', payload: counties });
      
      // Fetch cities
      const cities = await accidentDataService.getRegionOptions('city');
      dispatch({ type: 'SET_REGION_OPTIONS', regionType: 'city', payload: cities });
    };
    
    fetchRegionOptions();
  }, []);
  
  // Fetch data when filters change
  useEffect(() => {
    const fetchData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Build query params from filters
        const queryParams = accidentDataService.buildQueryParams(state.filters);
        
        // Fetch accident data
        const accidents = await accidentDataService.getFilteredAccidents(queryParams);
        
        // Process the data
        const { hotspots, roadSegments } = accidentDataService.processAccidentData(accidents);
        
        // Update state
        dispatch({ type: 'SET_ACCIDENTS', payload: accidents });
        dispatch({ type: 'SET_HOTSPOTS', payload: hotspots });
        dispatch({ type: 'SET_ROAD_SEGMENTS', payload: roadSegments });
      } catch (error) {
        console.error('Error fetching accident data:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    fetchData();
  }, [dataFetchTrigger]);
  
  // Utility functions
  
  // Update a single filter
  const updateFilter = (name, value) => {
    dispatch({ type: 'SET_FILTER', name, value });
  };
  
  // Update multiple filters at once
  const updateFilters = (filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };
  
  // Reset all filters to default
  const resetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' });
    triggerDataFetch();
  };
  
  // Toggle between points and heatmap view
  const togglePointsView = () => {
    dispatch({ type: 'TOGGLE_POINTS' });
  };
  
  // Trigger data fetch (called after filter updates)
  const triggerDataFetch = () => {
    setDataFetchTrigger(prev => prev + 1);
  };
  
  // Apply filters and fetch data
  const applyFilters = () => {
    triggerDataFetch();
  };
  
  // Process filters and send to parent
  const processAndApplyFilters = (localFilters) => {
    updateFilters(localFilters);
    triggerDataFetch();
  };
  
  // Get top accident hotspots
  const getTopHotspots = (limit = 10) => {
    return state.hotspots
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, limit);
  };
  
  return (
    <AccidentContext.Provider
      value={{
        ...state,
        updateFilter,
        updateFilters,
        resetFilters,
        applyFilters,
        togglePointsView,
        processAndApplyFilters,
        getTopHotspots
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
    throw new Error('useAccidentContext must be used within an AccidentProvider');
  }
  return context;
};