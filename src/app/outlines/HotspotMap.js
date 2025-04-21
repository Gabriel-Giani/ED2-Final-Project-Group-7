"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import GeoJSON from "ol/format/GeoJSON";

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

// Highlighted crash point style
const highlightedCrashPointStyle = new Style({
  image: new Circle({
    radius: 7,
    fill: new Fill({ color: "rgba(255, 255, 0, 0.8)" }),
    stroke: new Stroke({ color: "#ffff00", width: 2 }),
  }),
});

// County style
const countyStyle = new Style({
  stroke: new Stroke({
    color: "rgba(0, 0, 0, 0.6)",
    width: 1.5,
  }),
  fill: new Fill({
    color: "rgba(255, 255, 255, 0.1)",
  }),
});

// Selected county style
const selectedCountyStyle = new Style({
  stroke: new Stroke({
    color: "rgba(0, 0, 255, 0.8)",
    width: 2.5,
  }),
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.1)",
  }),
});

// City boundary style
const cityBoundaryStyle = new Style({
  stroke: new Stroke({
    color: "rgba(41, 122, 37, 0.88)",
    width: 2,
  }),
  fill: new Fill({
    color: "rgba(0, 128, 0, 0.1)",
  }),
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "#000",
    }),
    stroke: new Stroke({
      color: "#fff",
      width: 3,
    }),
    // Text placement will be determined when rendering
    offsetY: -15,
    overflow: true,
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

// Helper function to format date string
function formatDate(dateStr) {
  if (!dateStr) return "Unknown date";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

// Helper function to format time
function formatTime(timeStr) {
  if (!timeStr) return "Unknown time";
  try {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
}

export default function HotspotMap({ onMapReady, selectedCounty }) {
  const { accidents, hotspots, roadSegments, showPoints, loading, filters } =
    useAccidentContext();

  // Extract filter properties for use in our callbacks
  const { filterRegion, regionName } = filters || {};

  // State for accident details
  const [selectedAccident, setSelectedAccident] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Create sources for different layers
  const pointsSource = useRef(new VectorSource());
  const clusterSource = useRef(
    new Cluster({
      distance: 40,
      source: pointsSource.current,
    })
  );
  const roadSegmentsSource = useRef(new VectorSource());
  const countiesSource = useRef(new VectorSource());
  const cityBoundariesSource = useRef(new VectorSource());
  const highlightLayerSource = useRef(new VectorSource());

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

  const countiesLayer = useRef(
    new VectorLayer({
      source: countiesSource.current,
      style: function (feature) {
        const countyName = feature.get("NAME");
        if (selectedCounty && countyName === selectedCounty) {
          return selectedCountyStyle;
        }
        return countyStyle;
      },
      zIndex: 0.5,
    })
  );

  const cityBoundariesLayer = useRef(
    new VectorLayer({
      source: cityBoundariesSource.current,
      style: function (feature) {
        const style = cityBoundaryStyle.clone();
        return style;
      },
      zIndex: 0.8, // Above counties but below road segments
    })
  );

  // Highlight layer for selected crash point
  const highlightLayer = useRef(
    new VectorLayer({
      source: highlightLayerSource.current,
      style: highlightedCrashPointStyle,
      zIndex: 3, // Above all other layers
    })
  );

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]), // Center of Florida
    zoom: DEFAULT_ZOOM,
  });

  // Updated loadCounties function with proper filtering
  const loadCounties = useCallback(async () => {
    try {
      const response = await fetch("/floridaCountyOutline.geojson");
      const geojsonData = await response.json();

      // Filter features based on selected county or filter settings
      let featuresToShow;

      if (selectedCounty) {
        // If a selectedCounty prop is provided, prioritize that
        featuresToShow = geojsonData.features.filter(
          (feature) => feature.properties.NAME === selectedCounty
        );
        console.log(`Filtering to show only county: ${selectedCounty}`);
      } else if (filterRegion === "county" && regionName) {
        // Otherwise use the county from filters if set
        featuresToShow = geojsonData.features.filter(
          (feature) => feature.properties.NAME === regionName
        );
        console.log(
          `Filtering to show only county from filters: ${regionName}`
        );
      } else if (filterRegion === "state") {
        // Show all counties for state-level view
        featuresToShow = geojsonData.features;
        console.log("Showing all counties for state-level view");
      } else if (filterRegion === "city" && regionName) {
        // For city view, we might want to show the containing county
        // This would require knowing which county contains each city
        // For now, don't show county boundaries for city-specific views
        featuresToShow = [];
        console.log("City view active, not showing county boundaries");
      } else {
        // Default: show all counties if no specific filter is set
        featuresToShow = geojsonData.features;
        console.log("No specific filter set, showing all counties");
      }

      // Create a filtered GeoJSON
      const filteredGeoJSON = {
        type: "FeatureCollection",
        features: featuresToShow,
      };

      // Parse GeoJSON using OpenLayers format
      const format = new GeoJSON();
      const features = format.readFeatures(filteredGeoJSON, {
        featureProjection: "EPSG:3857", // Web Mercator projection used by OpenLayers
      });

      // Clear existing features and add filtered ones
      countiesSource.current.clear();
      countiesSource.current.addFeatures(features);

      console.log(`Added ${features.length} county features to map`);

      // Fit view to selected county if there's only one
      if (features.length === 1 && mapRef.current) {
        const extent = countiesSource.current.getExtent();
        mapRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 500,
        });
      }

      // Force map refresh if it exists
      if (mapRef.current) {
        mapRef.current.render();
      }
    } catch (error) {
      console.error("Error loading Florida counties GeoJSON:", error);
    }
  }, [selectedCounty, filterRegion, regionName]);

  // Updated loadCityBoundaries function with better debugging and error handling
  const loadCityBoundaries = useCallback(async () => {
    try {
      console.log(
        "Loading city boundaries with filterRegion:",
        filterRegion,
        "regionName:",
        regionName
      );

      // Load the city boundaries GeoJSON file
      const response = await fetch("/par_citylm_2021.geojson");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch city boundaries: ${response.status} ${response.statusText}`
        );
      }

      const geojsonData = await response.json();
      console.log(
        "City GeoJSON loaded, features count:",
        geojsonData.features?.length || 0
      );

      // Parse GeoJSON using OpenLayers format
      const format = new GeoJSON();
      const features = format.readFeatures(geojsonData, {
        featureProjection: "EPSG:3857", // Web Mercator projection used by OpenLayers
      });

      console.log("Parsed features count:", features.length);

      // Check the properties available on a sample feature for debugging
      if (features.length > 0) {
        const sampleFeature = features[0];
        console.log(
          "Sample city feature properties:",
          Object.keys(sampleFeature.getProperties()).join(", "),
          "NAME:",
          sampleFeature.get("NAME"),
          "COUNTY:",
          sampleFeature.get("COUNTY")
        );
      }

      // Filter features based on selection criteria
      let filteredFeatures = [];

      if (filterRegion === "city" && regionName) {
        // If a specific city is selected in filters, only show that city
        console.log("Filtering for specific city:", regionName);
        filteredFeatures = features.filter((feature) => {
          const name = feature.get("NAME") || "";
          const matches = name.toLowerCase() === regionName.toLowerCase();
          return matches;
        });
        console.log(
          `Found ${filteredFeatures.length} features matching city name: ${regionName}`
        );
      } else if (selectedCounty) {
        // If a county is selected, show all cities in that county
        console.log("Filtering for cities in county:", selectedCounty);
        filteredFeatures = features.filter((feature) => {
          const county = feature.get("COUNTY") || "";
          const matches = county.toLowerCase() === selectedCounty.toLowerCase();
          return matches;
        });
        console.log(
          `Found ${filteredFeatures.length} features in county: ${selectedCounty}`
        );
      } else if (filterRegion === "state") {
        // For state-level view, don't show any cities to avoid clutter
        console.log("State-level view, not showing city boundaries");
      } else {
        console.log("No specific city or county filter active");
      }

      // Clear existing features
      cityBoundariesSource.current.clear();

      // Add filtered features if we have any
      if (filteredFeatures.length > 0) {
        cityBoundariesSource.current.addFeatures(filteredFeatures);
        console.log(
          `Added ${filteredFeatures.length} city boundary features to map`
        );

        // If a specific city is selected, fit the view to that city
        if (filterRegion === "city" && regionName && mapRef.current) {
          const extent = cityBoundariesSource.current.getExtent();
          mapRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500,
          });
        }
      } else {
        console.log("No city boundaries to display based on current filters");
      }

      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
      }
    } catch (error) {
      console.error("Error loading or processing city boundaries:", error);
    }
  }, [selectedCounty, filterRegion, regionName]);

  // Update point features when accidents change - Improved implementation
  useEffect(() => {
    // Only update if showing points and the map is initialized
    if (!showPoints || !mapRef.current) return;

    // Clear existing points
    pointsSource.current.clear();

    // Add individual accident points
    if (accidents && accidents.length > 0) {
      console.log(
        `Adding ${accidents.length} individual accident points to map`
      );

      const features = accidents
        .filter((accident) => accident.latitude && accident.longitude)
        .map((accident) => {
          // Create a new feature with point geometry
          const feature = new Feature({
            geometry: new Point(
              fromLonLat([accident.longitude, accident.latitude])
            ),
          });

          // Set individual properties directly on the feature
          // Do not use a nested 'properties' object which can be harder to access
          Object.keys(accident).forEach((key) => {
            feature.set(key, accident[key]);
          });

          return feature;
        });

      if (features.length > 0) {
        console.log(
          "Sample accident feature keys:",
          Object.keys(features[0].getProperties())
        );
        pointsSource.current.addFeatures(features);
      }
    }

    // Force map refresh
    mapRef.current.render();
  }, [accidents, showPoints]);

  // Load Florida counties GeoJSON data
  useEffect(() => {
    if (mapRef.current) {
      loadCounties();
    }
  }, [loadCounties]);

  // Load city boundaries GeoJSON data
  useEffect(() => {
    if (mapRef.current) {
      loadCityBoundaries();
    }
  }, [loadCityBoundaries]);

  // Update map layers with accident data from context
  useEffect(() => {
    // Only update if the map is initialized
    if (!mapRef.current) return;

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
          name: segment.name,
          count: segment.count,
        });

        roadSegmentsSource.current.addFeature(feature);
      });
    }

    // Force map refresh
    mapRef.current.render();
  }, [roadSegments]);

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

  // Close the accident details panel when filters change
  useEffect(() => {
    setSelectedAccident(null);
    highlightLayerSource.current?.clear();
  }, [filters]);

  // Initialize map with direct click handler
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const mapInstance = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [
          new TileLayer({ source: new OSM(), zIndex: 0 }),
          countiesLayer.current,
          cityBoundariesLayer.current,
          roadSegmentsLayer.current,
          crashesLayer.current,
          highlightLayer.current, // Add the highlight layer for selected accidents
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

      // Add click handler directly
      mapInstance.on("click", function (evt) {
        const feature = mapInstance.forEachFeatureAtPixel(
          evt.pixel,
          function (feature) {
            return feature;
          },
          {
            layerFilter: function (layer) {
              return layer === crashesLayer.current;
            },
            hitTolerance: 10,
          }
        );

        console.log("Map clicked, feature found:", !!feature);

        if (feature) {
          // Clear any existing highlight
          highlightLayerSource.current.clear();

          // Get the features from the cluster
          const features = feature.get("features");

          if (features && features.length === 1) {
            // Single feature - show details
            const singleFeature = features[0];
            const props = singleFeature.getProperties();
            console.log("Feature properties:", props);

            // Create a highlight
            const highlightFeature = new Feature({
              geometry: singleFeature.getGeometry().clone(),
            });
            highlightLayerSource.current.addFeature(highlightFeature);

            // Set the accident data
            setSelectedAccident({
              crashnum: props.crashnum || "Unknown",
              crashdate: props.crashdate || "Unknown date",
              crashtime: props.crashtime || "Unknown time",
              latitude: props.latitude,
              longitude: props.longitude,
              onroadname: props.onroadname || "Unknown road",
              inroadname: props.inroadname || "",
              townname: props.townname || "",
              dotcounty: props.dotcounty || "Unknown county",
              highestinj: props.highestinj || "",
              cntofinj: props.cntofinj || "0",
              cntoffatl: props.cntoffatl || "0",
              weathcond: props.weathcond || "",
              lightcond: props.lightcond || "",
              rdsurfcond: props.rdsurfcond || "",
              dayofweek: props.dayofweek || "",
              cntofveh: props.cntofveh || "0",
              cntofpedes: props.cntofpedes || "0",
              cntofcycls: props.cntofcycls || "0",
              totcrshdmg: props.totcrshdmg || "",
              casenumber: props.casenumber || "",
              agency: props.agency || "",
            });
          } else if (features && features.length > 1) {
            // Cluster - zoom in
            console.log(
              "Cluster clicked with",
              features.length,
              "points - zooming in"
            );
            const extent = feature.getGeometry().getExtent();
            mapInstance.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 500,
              maxZoom: 15,
            });

            // Clear any selected accident
            setSelectedAccident(null);
          }
        } else {
          // Clicked empty space - clear selection
          setSelectedAccident(null);
          highlightLayerSource.current.clear();
        }
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
          getVectorSource: () => pointsSource.current,
        });
      }
    }

    // Cleanup function - fixed the syntax error by removing arrow function
    return function cleanup() {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady, setSelectedAccident]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute top-0 left-0 map-container"
      />

      {/* Simple Accident Details Panel */}
      {selectedAccident && (
        <div className="absolute top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-md">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Accident Details
            </h2>
            <button
              onClick={() => setSelectedAccident(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {/* Location */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Location
              </h3>
              <p className="text-gray-900 dark:text-white">
                {selectedAccident.onroadname || "Unknown road"}
                {selectedAccident.inroadname
                  ? ` at ${selectedAccident.inroadname}`
                  : ""}
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {selectedAccident.townname
                  ? `${selectedAccident.townname}, `
                  : ""}
                {selectedAccident.dotcounty || "Unknown county"}, FL
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Coordinates: {selectedAccident.latitude?.toFixed(6) || "N/A"},{" "}
                {selectedAccident.longitude?.toFixed(6) || "N/A"}
              </div>
            </div>

            {/* Date and Time */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Date & Time
              </h3>
              <p className="text-gray-900 dark:text-white">
                {formatDate(selectedAccident.crashdate)}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                {formatTime(selectedAccident.crashtime)}
              </p>
            </div>

            {/* Severity */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Severity
              </h3>
              <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Injuries:{" "}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {selectedAccident.cntofinj || "0"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Fatalities:{" "}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {selectedAccident.cntoffatl || "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* Case Information */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <p>Case #: {selectedAccident.casenumber || "N/A"}</p>
              <p>Crash #: {selectedAccident.crashnum || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full z-10">
          Loading data...
        </div>
      )}
    </div>
  );
}
