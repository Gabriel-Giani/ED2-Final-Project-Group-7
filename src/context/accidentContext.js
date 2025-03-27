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
  loadedChunks: new Set(), // Track which chunks are loaded
  
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
    injuryLevel: '',
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
  cities: [],

  // Pagination State
  currentPage: 0,
  hasMoreData: true,
  batchSize: 25000, // Increased batch size
  totalAccidents: 0,
  parallelLoads: 3 // Number of parallel data loads
};

// Reducer to handle state updates
const accidentReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ACCIDENTS':
      return { 
        ...state, 
        accidents: action.payload.replace ? action.payload.data : [...state.accidents, ...action.payload.data],
        currentPage: action.payload.replace ? 0 : state.currentPage + 1,
        hasMoreData: action.payload.hasMore
      };
      
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
        },
        currentPage: 0,
        hasMoreData: true,
        accidents: []
      };
      
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: { ...initialState.filters },
        currentPage: 0,
        hasMoreData: true,
        accidents: []
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

    case 'SET_TOTAL_ACCIDENTS':
      return { ...state, totalAccidents: action.payload };

    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };

    case 'ADD_LOADED_CHUNK':
      return {
        ...state,
        loadedChunks: new Set([...state.loadedChunks, action.payload])
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
  
  // Fetch data when filters change or when loading more data
  useEffect(() => {
    const fetchDataChunk = async (page) => {
      if (state.loadedChunks.has(page)) return null;
      
      try {
        const { accidents, hasMore, total } = await accidentDataService.getFilteredAccidents({
          ...state.filters,
          page,
          batchSize: state.batchSize
        });
        
        return { accidents, hasMore, total, page };
      } catch (error) {
        console.error(`Error fetching chunk ${page}:`, error);
        return null;
      }
    };

    const processChunk = (chunk) => {
      if (!chunk) return;
      
      const { accidents, hasMore, total, page } = chunk;
      
      // Update loaded chunks tracking
      dispatch({ type: 'ADD_LOADED_CHUNK', payload: page });
      
      // Update accidents without reprocessing everything
      dispatch({ 
        type: 'SET_ACCIDENTS', 
        payload: { 
          data: accidents,
          hasMore,
          replace: false
        }
      });
      
      dispatch({ type: 'SET_TOTAL_ACCIDENTS', payload: total });
      
      // If there's more data, trigger next chunks
      if (hasMore) {
        const nextPage = Math.max(...Array.from(state.loadedChunks)) + 1;
        setDataFetchTrigger(nextPage);
      }
    };

    const fetchData = async () => {
      if (!state.hasMoreData || state.loading) return;
      
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Calculate which chunks to load
        const startPage = state.currentPage;
        const chunksToLoad = Array.from(
          { length: state.parallelLoads },
          (_, i) => startPage + i
        );
        
        // Fetch chunks in parallel
        const chunkPromises = chunksToLoad.map(page => fetchDataChunk(page));
        const chunks = await Promise.all(chunkPromises);
        
        // Process chunks sequentially to maintain order
        chunks.forEach(processChunk);
        
        // Process road segments and hotspots every batch
        const { hotspots, roadSegments } = accidentDataService.processAccidentData(state.accidents);
        dispatch({ type: 'SET_HOTSPOTS', payload: hotspots });
        dispatch({ type: 'SET_ROAD_SEGMENTS', payload: roadSegments });
      } catch (error) {
        console.error('Error in fetch operation:', error);
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

  // Simplified loadMoreData - now just a trigger since loading is automatic
  const loadMoreData = () => {
    if (state.hasMoreData && !state.loading) {
      setDataFetchTrigger(prev => prev + 1);
    }
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
        getTopHotspots,
        loadMoreData
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