"use client";

import React, { useEffect, useRef } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import { defaults as defaultControls } from "ol/control";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import { Circle, Style, Fill, Stroke, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import { useAccidentContext } from "@/context/accidentContext";
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
  // Yellow to orange to red gradient
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

export default function HotspotMap({ onMapReady }) {
  const {
    accidents,
    hotspots,
    roadSegments,
    showPoints,
    loading
  } = useAccidentContext();
  
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
  const crashesLayer = useRef(
    new VectorLayer({
      source: clusterSource.current,
      style: getClusterStyle,
      zIndex: 2,
      visible: showPoints,
    })
  );

  const roadSegmentsLayer = useRef(
    new VectorLayer({
      source: roadSegmentsSource.current,
      style: getRoadSegmentStyle,
      zIndex: 1,
    })
  );

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]), // Center of Florida
    zoom: DEFAULT_ZOOM,
  });

  // Update map layers with accident data from context
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
        
        roadSegmentsSource.current.addFeature(feature);
      });
    }
    
    // Force map refresh
    mapRef.current.render();
  }, [roadSegments]);

  // Update point features when accidents change
  useEffect(() => {
    // Only update if showing points and the map is initialized
    if (!showPoints || !mapRef.current) return;
    
    // Clear existing points
    pointsSource.current.clear();
    
    // Add individual accident points
    if (accidents && accidents.length > 0) {
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
    mapRef.current.render();
  }, [accidents, showPoints]);

  // Update crashes layer visibility when showPoints changes
  useEffect(() => {
    if (crashesLayer.current) {
      crashesLayer.current.setVisible(showPoints);
      
      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
      }
    }
  }, [showPoints]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const mapInstance = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [
          new TileLayer({ source: new OSM(), zIndex: 0 }),
          roadSegmentsLayer.current,
          crashesLayer.current,
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
