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
} from "../../utils/db/hotspots";
import { getAccidentsByDateAndTimeRange } from "../../utils/db/accidents";

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = MIN_ZOOM;

// Florida bounding box coordinates (with small margin)
const FLORIDA_EXTENT = [
  -87.8, // Western boundary (slightly west of Pensacola)
  24.2, // Southern boundary (includes the Keys)
  -79.7, // Eastern boundary (past Jacksonville)
  31.2, // Northern boundary (slightly north of the Florida/Georgia border)
];

// Convert the geographic coordinates to the projection used by OpenLayers
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
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
    };
  }, [filterRegion, regionName, dateRange, timeRange]);

  // Function to fetch and display hotspots
  async function fetchHotspots() {
    setLoading(true);
    try {
      const { filterRegion, regionName, dateRange, timeRange } =
        filterStateRef.current;
      console.log(`Fetching hotspots for ${regionName || "all of Florida"}...`);

      let hotspots = [];
      let roadSegments = [];

      if (regionName) {
        if (filterRegion === "county") {
          console.log(`Fetching hotspots for county code: ${regionName}`);

          // Use batch fetching for county data
          const countyData = await batchFetchData("ultimate-table", {
            filters: [{ column: "dotcounty", value: regionName }],
            limit: 1000,
            batchSize: 200,
            maxBatches: 5,
            cacheTTL: 300000, // 5 minutes cache
          });

          console.log(`Fetched ${countyData.length} county accident records`);

          // Process the data to get hotspots
          const result = await getCountyHotspots(regionName, countyData);
          hotspots = result.hotspots;
          roadSegments = result.roadSegments;
        } else if (filterRegion === "city") {
          console.log(`Fetching hotspots for city: ${regionName}`);

          // Use batch fetching for city data with case insensitive search
          const cityData = await batchFetchData("ultimate-table", {
            filters: [
              {
                column: "townname",
                operator: "ilike",
                value: `%${regionName.toUpperCase()}%`,
              },
            ],
            limit: 1000,
            batchSize: 200,
            maxBatches: 5,
            cacheTTL: 300000, // 5 minutes cache
          });

          console.log(`Fetched ${cityData.length} city accident records`);

          // Process the data to get hotspots
          const result = await getCityHotspots(regionName, cityData);
          hotspots = result.hotspots;
          roadSegments = result.roadSegments;
        }
      } else {
        console.log("Fetching state-wide hotspots");

        // Use batch fetching for state data
        const stateData = await batchFetchData("ultimate-table", {
          limit: 2000,
          batchSize: 200,
          maxBatches: 10,
          cacheTTL: 300000, // 5 minutes cache
        });

        console.log(`Fetched ${stateData.length} state-wide accident records`);

        // Process the data to get hotspots
        const result = await getStateHotspots(stateData);
        hotspots = result.hotspots;
        roadSegments = result.roadSegments;
      }

      // Clear existing features
      roadSegmentsSource.current.clear();

      // Add road segments as features
      if (roadSegments && roadSegments.length > 0) {
        console.log(`Adding ${roadSegments.length} road segments to map`);

        roadSegments.forEach((segment) => {
          const coordinates = segment.coordinates.map((coord) =>
            fromLonLat([coord[0], coord[1]])
          );
          const feature = new Feature({
            geometry: new LineString(coordinates),
            intensity: segment.intensity,
          });

          roadSegmentsSource.current.addFeature(feature);
        });
      } else {
        console.log("No road segments to display");
      }

      // If showPoints is true, also fetch and display individual points
      if (showPoints) {
        await fetchCrashData();
      }
    } catch (error) {
      console.error("Error fetching hotspots:", error);
    } finally {
      setLoading(false);
    }
  }

  // Function to fetch crash data points
  async function fetchCrashData() {
    try {
      console.log("Fetching crash data points...");
      const { dateRange, timeRange } = filterStateRef.current;

      let data;

      // If date range is provided, use it to filter
      if (dateRange?.start && dateRange?.end) {
        if (timeRange?.start && timeRange?.end) {
          data = await getAccidentsByDateAndTimeRange(
            dateRange.start,
            dateRange.end,
            timeRange.start,
            timeRange.end
          );
        } else {
          const { data: accidentData, error } = await supabase
            .from("ultimate-table")
            .select("*")
            .gte("crashdate", dateRange.start)
            .lte("crashdate", dateRange.end);

          if (error) throw error;
          data = accidentData;
        }
      } else {
        // Fetch all crash records with a reasonable limit
        const { data: accidentData, error } = await supabase
          .from("ultimate-table")
          .select("latitude, longitude")
          .limit(5000); // Limit to prevent performance issues

        if (error) throw error;
        data = accidentData;
      }

      if (!data || data.length === 0) {
        console.log("No crash data found.");
        return;
      }

      console.log(`Fetched ${data.length} crash records.`);

      // Convert fetched data to OpenLayers Features
      const features = data
        .map((crash) => {
          if (crash.latitude && crash.longitude) {
            return new Feature({
              geometry: new Point(
                fromLonLat([crash.longitude, crash.latitude])
              ),
              properties: crash,
            });
          }
          return null;
        })
        .filter(Boolean);

      // Add features to the source
      pointsSource.current.clear();
      pointsSource.current.addFeatures(features);

      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
      }
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

  // IMPORTANT: This is the key effect change - ONLY refresh when shouldRefresh is true
  // and remove all other dependencies from the array
  useEffect(() => {
    if (mapRef.current && shouldRefresh) {
      console.log("Map refreshing due to explicit refresh request");
      fetchHotspots();
    }
  }, [shouldRefresh]); // <-- THIS IS THE KEY CHANGE: Only shouldRefresh triggers map refresh

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
          constrainOnlyCenter: true,
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
  }, [onMapReady]); // Only depends on onMapReady

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute top-0 left-0"
      />
      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full z-10">
          Loading hotspots...
        </div>
      )}
    </div>
  );
}
