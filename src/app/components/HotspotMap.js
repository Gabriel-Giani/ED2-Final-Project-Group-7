"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { Map, View, Overlay } from "ol";
import { defaults as defaultControls } from "ol/control";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import { boundingExtent } from "ol/extent";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Circle, Style, Fill, Stroke, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import { supabase, batchFetchData } from "../supabaseClient";
import "../styles/map.css";
import {
  getStateHotspots,
  getCountyHotspots,
  getCityHotspots,
  getTopHotspots,
  getRoadSegmentsWithAccidents,
} from "@/utils/db/hotspots";
import { getAccidentsByDateAndTimeRange } from "@/utils/db/accidents";

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = MIN_ZOOM;

// Florida bounding box coordinates (with small margin)
const FLORIDA_EXTENT = [
  -87.8, // Western boundary (slightly west of Pensacola)
  24.2,  // Southern boundary (includes the Keys)
  -79.7, // Eastern boundary (past Jacksonville)
  31.2   // Northern boundary (slightly north of the Florida/Georgia border)
];

// Convert the geographic coordinates to the projection used by OpenLayers
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]])
];

// Crash point style
const crashPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 0, 0, 0.6)" }),
    stroke: new Stroke({ color: "#ff0000", width: 1 }),
  }),
});

// Cluster style function
function getClusterStyle(feature) {
  const size = feature.get("features").length;
  if (size === 1) return crashPointStyle;

  return new Style({
    image: new Circle({
      radius: Math.min(size * 3, 30),
      fill: new Fill({ color: "rgba(255, 0, 0, 0.6)" }),
      stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
    text: new Text({
      text: size.toString(),
      fill: new Fill({ color: "#fff" }),
      font: "bold 12px Arial",
    }),
  });
}

// Function to generate a color based on intensity (0-1)
function getHeatColor(intensity) {
  // Yellow to orange to red gradient (no green)
  if (intensity < 0.33) {
    // Yellow (low intensity)
    return `rgba(255, 255, 0, 0.7)`;
  } else if (intensity < 0.66) {
    // Orange (medium intensity)
    return `rgba(255, 165, 0, 0.7)`;
  } else {
    // Red (high intensity)
    return `rgba(255, 0, 0, 0.7)`;
  }
}

// Road segment style function based on intensity
function getRoadSegmentStyle(feature) {
  const intensity = feature.get("intensity") || 0;
  const color = getHeatColor(intensity);
  const width = 3 + intensity * 5; // Width increases with intensity

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
    }),
  });
}

export default function HotspotMap({
  onMapReady,
  showPoints = false,
  filterRegion = null,
  regionName = null,
  dateRange = null,
  timeRange = null,
  advancedFilters = {},
  shouldRefresh = false, // Control when to refresh
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  
  // Store filter state internally to prevent re-renders
  const filterStateRef = useRef({
    filterRegion,
    regionName,
    dateRange,
    timeRange,
    advancedFilters
  });

  // Create sources for different layers
  const pointsSource = useRef(new VectorSource());
  const clusterSource = useRef(
    new Cluster({
      distance: 40,
      source: pointsSource.current,
    })
  );
  const roadSegmentsSource = useRef(new VectorSource());

  // Create layers
  const crashesLayer = new VectorLayer({
    source: clusterSource.current,
    style: getClusterStyle,
    zIndex: 2,
    visible: showPoints,
  });

  const roadSegmentsLayer = new VectorLayer({
    source: roadSegmentsSource.current,
    style: getRoadSegmentStyle,
    zIndex: 1,
  });

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]), // Center of Florida
    zoom: DEFAULT_ZOOM,
  });

  // Update internal filter state without triggering re-renders
  useEffect(() => {
    filterStateRef.current = {
      filterRegion,
      regionName,
      dateRange,
      timeRange,
      advancedFilters
    };
  }, [filterRegion, regionName, dateRange, timeRange, advancedFilters]);

  // Helper function to convert time to database format (HHMM)
  const convertTimeToDbFormat = (timeString) => {
    if (!timeString || !timeString.includes(':')) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours}${minutes}`;
  };

  // Function to build Supabase query with all filter parameters
  const buildQuery = (baseQuery, queryParams) => {
    let query = baseQuery;
    
    // Apply region filters
    if (queryParams.dotcounty) {
      query = query.eq("dotcounty", queryParams.dotcounty);
    }
    
    if (queryParams.townname) {
      query = query.ilike("townname", `%${queryParams.townname}%`);
    }
    
    // Apply date range filters
    if (queryParams.dateStart && queryParams.dateEnd) {
      query = query.gte("crashdate", queryParams.dateStart)
                 .lte("crashdate", queryParams.dateEnd);
    }
    
    // Apply time range filters
    if (queryParams.timeStart && queryParams.timeEnd) {
      // Convert time to 24-hour format for database query
      const timeStart = convertTimeToDbFormat(queryParams.timeStart);
      const timeEnd = convertTimeToDbFormat(queryParams.timeEnd);
      
      if (timeStart && timeEnd) {
        query = query.gte("crashtime", timeStart)
                   .lte("crashtime", timeEnd);
      }
    }
    
    // Apply day of week filter
    if (queryParams.dayofweek) {
      query = query.eq("dayofweek", queryParams.dayofweek);
    }
    
    // Apply road name filter
    if (queryParams.onroadname) {
      query = query.ilike("onroadname", `%${queryParams.onroadname}%`);
    }
    
    // Apply intersecting road filter
    if (queryParams.inroadname) {
      query = query.ilike("inroadname", `%${queryParams.inroadname}%`);
    }
    
    // Apply direction filter
    if (queryParams.refdirect) {
      query = query.eq("refdirect", queryParams.refdirect);
    }
    
    // Apply injury level filter
    if (queryParams.highestinj) {
      query = query.eq("highestinj", queryParams.highestinj);
    }
    
    // Apply alcohol/drugs filter
    if (queryParams.crshalcdrg) {
      query = query.eq("crshalcdrg", queryParams.crshalcdrg);
    }
    
    // Apply light condition filter
    if (queryParams.lightcond) {
      query = query.eq("lightcond", queryParams.lightcond);
    }
    
    // Apply weather condition filter
    if (queryParams.weathcond) {
      query = query.eq("weathcond", queryParams.weathcond);
    }
    
    // Apply road surface condition filter
    if (queryParams.rdsurfcond) {
      query = query.eq("rdsurfcond", queryParams.rdsurfcond);
    }
    
    // Apply damage range filters
    if (queryParams.damageMin) {
      query = query.gte("totcrshdmg", queryParams.damageMin);
    }
    
    if (queryParams.damageMax) {
      query = query.lte("totcrshdmg", queryParams.damageMax);
    }
    
    // Apply boolean filters (Y/N values)
    if (queryParams.fl_aggrsv) {
      query = query.eq("fl_aggrsv", queryParams.fl_aggrsv);
    }
    
    if (queryParams.fl_vru_ped) {
      query = query.eq("fl_vru_ped", queryParams.fl_vru_ped);
    }
    
    if (queryParams.fl_vru_bik) {
      query = query.eq("fl_vru_bik", queryParams.fl_vru_bik);
    }
    
    if (queryParams.fl_vru_mot) {
      query = query.eq("fl_vru_mot", queryParams.fl_vru_mot);
    }
    
    if (queryParams.fl_ar_teen) {
      query = query.eq("fl_ar_teen", queryParams.fl_ar_teen);
    }
    
    if (queryParams.fl_ar_ag) {
      query = query.eq("fl_ar_ag", queryParams.fl_ar_ag);
    }
    
    if (queryParams.flag_imp) {
      query = query.eq("flag_imp", queryParams.flag_imp);
    }
    
    return query;
  };

  // Function to process accident data and create hotspots and road segments
  function processAccidentData(data) {
    if (!data || data.length === 0) {
      return { hotspots: [], roadSegments: [] };
    }
    
    console.log(`Processing ${data.length} accident records`);
    
    // Group accidents by road name for road segments
    const roadGroups = new Map();
    
    // Create grid for hotspots
    const gridSize = 0.01;
    const grid = {};
    
    data.forEach(accident => {
      if (!accident.latitude || !accident.longitude) return;
      
      // Process for hotspots (grid-based)
      const lat = Math.round(accident.latitude / gridSize) * gridSize;
      const lng = Math.round(accident.longitude / gridSize) * gridSize;
      const key = `${lat},${lng}`;
      
      if (!grid[key]) {
        grid[key] = {
          count: 0,
          lats: [],
          lngs: [],
          road_names: [],
          county: accident.dotcounty,
          city: accident.townname
        };
      }
      
      grid[key].count++;
      grid[key].lats.push(accident.latitude);
      grid[key].lngs.push(accident.longitude);
      
      if (accident.onroadname && !grid[key].road_names.includes(accident.onroadname)) {
        grid[key].road_names.push(accident.onroadname);
      }
      
      // Process for road segments
      if (accident.onroadname) {
        const county = accident.dotcounty || "Unknown";
        const city = accident.townname || "Unknown";
        const roadKey = `${accident.onroadname}|${county}|${city}`;
        
        if (!roadGroups.has(roadKey)) {
          roadGroups.set(roadKey, {
            name: accident.onroadname,
            county: county,
            city: city,
            coordinates: [],
            count: 0
          });
        }
        
        const group = roadGroups.get(roadKey);
        group.coordinates.push([
          parseFloat(accident.longitude),
          parseFloat(accident.latitude)
        ]);
        group.count += 1;
      }
    });
    
    // Calculate hotspots from grid cells
    const counts = Object.values(grid).map(cell => cell.count);
    const maxCount = Math.max(...counts, 1); // Prevent division by zero
    
    const hotspots = Object.entries(grid).map(([key, cell], index) => {
      const avgLat = cell.lats.reduce((sum, lat) => sum + lat, 0) / cell.lats.length;
      const avgLng = cell.lngs.reduce((sum, lng) => sum + lng, 0) / cell.lngs.length;
      const intensity = cell.count / maxCount;
      const radius = Math.max(500, Math.min(5000, cell.count * 50));
      
      // Find most common road name
      const roadNameCounts = {};
      cell.road_names.forEach(name => {
        roadNameCounts[name] = (roadNameCounts[name] || 0) + 1;
      });
      
      const roadName = cell.road_names.length > 0
        ? Object.entries(roadNameCounts).sort((a, b) => b[1] - a[1])[0][0]
        : undefined;
      
      return {
        id: `hotspot-${index}`,
        center: [avgLng, avgLat],
        intensity,
        radius,
        count: cell.count,
        road_name: roadName,
        county: cell.county,
        city: cell.city
      };
    });
    
    // Process road segments
    const filteredRoadGroups = Array.from(roadGroups.values()).filter(
      group => group.coordinates.length >= 3
    );
    
    const roadSegments = filteredRoadGroups.map((group, index) => {
      // Sort coordinates to form a reasonable line
      const sortedCoordinates = sortCoordinatesForLine(group.coordinates);
      
      // Calculate intensity based on accident count
      const maxGroupCount = Math.max(...filteredRoadGroups.map(g => g.count), 1);
      const intensity = Math.min(1, group.count / maxGroupCount);
      
      return {
        id: `road-${index}`,
        name: group.name,
        county: group.county,
        city: group.city,
        coordinates: sortedCoordinates,
        count: group.count,
        intensity: intensity
      };
    });
    
    return { hotspots, roadSegments };
  }
  
  // Helper function to sort coordinates for road segments
  function sortCoordinatesForLine(coords) {
    if (coords.length <= 2) return coords;
    
    // Start with first point
    const sorted = [coords[0]];
    const remaining = new Set(coords.slice(1).map(c => JSON.stringify(c)));
    
    while (remaining.size > 0) {
      const lastPoint = sorted[sorted.length - 1];
      let closestPoint = null;
      let closestPointStr = null;
      let minDistance = Infinity;
      
      Array.from(remaining).forEach(pointStr => {
        const point = JSON.parse(pointStr);
        const distance = Math.sqrt(
          Math.pow(point[0] - lastPoint[0], 2) +
          Math.pow(point[1] - lastPoint[1], 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
          closestPointStr = pointStr;
        }
      });
      
      if (minDistance > 0.05) {
        break; // Too far away, likely different road segment
      }
      
      if (closestPoint && closestPointStr) {
        sorted.push(closestPoint);
        remaining.delete(closestPointStr);
      } else {
        break;
      }
    }
    
    return sorted;
  }
  
  // Update map layers with processed data
  function updateMapLayersWithData(hotspots, roadSegments, accidents) {
    // Clear existing features
    roadSegmentsSource.current.clear();
    pointsSource.current.clear();
    
    // Add road segments as features
    if (roadSegments && roadSegments.length > 0) {
      console.log(`Adding ${roadSegments.length} road segments to map`);
      
      roadSegments.forEach(segment => {
        const coordinates = segment.coordinates.map(coord =>
          fromLonLat([coord[0], coord[1]])
        );
        
        const feature = new Feature({
          geometry: new LineString(coordinates),
          intensity: segment.intensity,
          name: segment.name,
          count: segment.count
        });
        
        roadSegmentsSource.current.addFeature(feature);
      });
    }
    
    // Add individual accident points if showPoints is true
    if (showPoints && accidents && accidents.length > 0) {
      console.log(`Adding ${accidents.length} individual accident points to map`);
      
      const features = accidents
        .map(accident => {
          if (accident.latitude && accident.longitude) {
            return new Feature({
              geometry: new Point(
                fromLonLat([accident.longitude, accident.latitude])
              ),
              properties: accident
            });
          }
          return null;
        })
        .filter(Boolean);
      
      pointsSource.current.addFeatures(features);
    }
    
    // Force map refresh
    if (mapRef.current) {
      mapRef.current.render();
    }
  }
  
  // New method for fetching data with all filters applied
  async function fetchFilteredData(queryParams = {}) {
    setLoading(true);
    try {
      console.log("Fetching filtered accident data with params:", queryParams);
      
      // Start a base query
      let query = supabase.from("ultimate-table").select("*");
      
      // Apply all filters to the query
      query = buildQuery(query, queryParams);
      
      // Limit to prevent performance issues
      query = query.limit(5000);
      
      // Execute the query
      const { data: accidents, error } = await query;
      
      if (error) {
        console.error("Error fetching filtered accident data:", error);
        return;
      }
      
      console.log(`Fetched ${accidents?.length || 0} filtered accident records`);
      
      // Process the results to generate hotspots and road segments
      const { hotspots, roadSegments } = processAccidentData(accidents || []);
      
      // Update map layers
      updateMapLayersWithData(hotspots, roadSegments, accidents);
      
      // Return the fetched data for further use if needed
      return accidents;
    } catch (error) {
      console.error("Error in fetchFilteredData:", error);
    } finally {
      setLoading(false);
    }
  }

  // Function to fetch and display hotspots
  async function fetchHotspots() {
    setLoading(true);
    try {
      const { filterRegion, regionName, dateRange, timeRange, advancedFilters } = filterStateRef.current;
      console.log(`Fetching hotspots for ${regionName || "all of Florida"}...`);

      // Build query params from all filters
      const queryParams = {
        // Region filters
        dotcounty: filterRegion === "county" ? regionName : undefined,
        townname: filterRegion === "city" ? regionName : undefined,
        
        // Date/time filters
        dateStart: dateRange?.start,
        dateEnd: dateRange?.end,
        timeStart: timeRange?.start,
        timeEnd: timeRange?.end,
        
        // Advanced filters
        ...advancedFilters
      };
      
      // Use the new fetchFilteredData method
      await fetchFilteredData(queryParams);
    } catch (error) {
      console.error("Error fetching hotspots:", error);
    } finally {
      setLoading(false);
    }
  }

  // Function to fetch crash data points
  async function fetchCrashData(queryParams = {}) {
    try {
      console.log("Fetching crash data points...");
      await fetchFilteredData(queryParams);
    } catch (error) {
      console.error("Error in fetchCrashData:", error);
    }
  }

  // Toggle visibility of points layer
  useEffect(() => {
    if (crashesLayer) {
      crashesLayer.setVisible(showPoints);

      // If toggling to show points and we don't have any yet, fetch them
      if (showPoints && pointsSource.current.getFeatures().length === 0) {
        fetchCrashData();
      }
    }
  }, [showPoints]);

  // IMPORTANT: Only refresh when shouldRefresh is true
  useEffect(() => {
    if (mapRef.current && shouldRefresh) {
      console.log("Map refreshing due to explicit refresh request");
      fetchHotspots();
    }
  }, [shouldRefresh]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const mapInstance = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [
          new TileLayer({ source: new OSM(), zIndex: 0 }),
          roadSegmentsLayer,
          crashesLayer,
        ],
        view: new View({
          center: viewStateRef.current.center,
          zoom: viewStateRef.current.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true
        }),
      });

      mapRef.current = mapInstance;

      // Initial fetch of hotspots when the map is initialized
      fetchHotspots();

      if (onMapReady) {
        onMapReady({
          getView: () => mapInstance.getView(),
          getZoom: () => mapInstance.getView().getZoom(),
          zoomTo: (zoom) => {
            mapInstance.getView().animate({ zoom, duration: 250 });
          },
          zoomBy: (delta) => {
            const view = mapInstance.getView();
            view.animate({ zoom: view.getZoom() + delta, duration: 250 });
          },
          fetchHotspots: fetchHotspots,
          fetchCrashData: fetchCrashData,
          fetchFilteredData: fetchFilteredData,
          getVectorSource: () => pointsSource.current
        });
      }
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute top-0 left-0"
      />
      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full z-10">
          Loading data...
        </div>
      )}
    </div>
  );
}