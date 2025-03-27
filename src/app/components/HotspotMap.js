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
    loading,
    loadMoreData,
    totalAccidents,
    hasMoreData,
    batchSize
  } = useAccidentContext();
  
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const featuresCache = useRef(null); // Initialize as null first
  const renderTimeout = useRef(null);
  
  // Create sources for different layers
  const pointsSource = useRef(null);
  const clusterSource = useRef(null);
  const roadSegmentsSource = useRef(null);

  // Create layers
  const crashesLayer = useRef(null);
  const roadSegmentsLayer = useRef(null);

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]), // Center of Florida
    zoom: DEFAULT_ZOOM,
  });

  // Initialize refs and sources
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize sources
    if (!pointsSource.current) {
      pointsSource.current = new VectorSource();
    }
    
    if (!roadSegmentsSource.current) {
      roadSegmentsSource.current = new VectorSource();
    }
    
    if (!featuresCache.current) {
      featuresCache.current = new Map();
    }
    
    if (!roadSegmentsLayer.current) {
      roadSegmentsLayer.current = new VectorLayer({
        source: roadSegmentsSource.current,
        style: getRoadSegmentStyle,
        zIndex: 1,
      });
    }
  }, []);

  // Clear features helper
  const clearFeatures = () => {
    if (!pointsSource.current) return;
    pointsSource.current.clear();
    if (featuresCache.current) {
      featuresCache.current = new Map();
    }
  };

  // Initialize cluster source and layer with optimized settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pointsSource.current) return;

    if (!clusterSource.current) {
      clusterSource.current = new Cluster({
        distance: 80,
        minDistance: 40,
        source: pointsSource.current,
        geometryFunction: (feature) => {
          const zoom = mapRef.current?.getView().getZoom() || DEFAULT_ZOOM;
          // More aggressive clustering at lower zoom levels
          if (zoom > 16) return null;
          if (zoom < 10 && !feature.get('isImportant')) {
            // Skip less important points at low zoom levels
            const random = Math.random();
            if (random > 0.3) return null;
          }
          return feature.getGeometry();
        }
      });
    }

    if (!crashesLayer.current) {
      crashesLayer.current = new VectorLayer({
        source: clusterSource.current,
        style: getClusterStyle,
        zIndex: 2,
        visible: showPoints,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
        renderBuffer: 200
      });
    }
  }, [showPoints, pointsSource.current]);

  // Initialize map with optimized settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapContainerRef.current || !crashesLayer.current || !roadSegmentsLayer.current) return;
    if (mapRef.current) return;

    const pixelRatio = window.devicePixelRatio > 1 ? 2 : 1;
    
    const mapInstance = new Map({
      target: mapContainerRef.current,
      controls: defaultControls({ zoom: false }),
      layers: [
        new TileLayer({ 
          source: new OSM({
            crossOrigin: null,
            preload: Infinity,
          }),
          zIndex: 0,
          preload: Infinity,
          useInterimTilesOnError: true
        }),
        roadSegmentsLayer.current,
        crashesLayer.current,
      ],
      view: new View({
        center: viewStateRef.current.center,
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        extent: FLORIDA_EXTENT_PROJ,
        constrainOnlyCenter: true,
        constrainResolution: true,
        smoothExtentConstraint: false,
        enableRotation: false
      }),
      pixelRatio,
      renderBuffer: 200,
      moveTolerance: 3,
      updateWhileAnimating: false,
      updateWhileInteracting: false
    });

    mapRef.current = mapInstance;
    
    let interactionTimeout;
    let isInteracting = false;
    
    mapInstance.on(['movestart', 'pointerdrag'], () => {
      isInteracting = true;
      if (interactionTimeout) clearTimeout(interactionTimeout);
      if (crashesLayer.current) {
        crashesLayer.current.setVisible(false);
      }
    });
    
    mapInstance.on(['moveend', 'pointerup'], () => {
      if (interactionTimeout) clearTimeout(interactionTimeout);
      isInteracting = false;
      
      interactionTimeout = setTimeout(() => {
        if (!isInteracting && showPoints && crashesLayer.current) {
          crashesLayer.current.setVisible(true);
        }
      }, 150);
    });

    const updateClusterDistance = () => {
      if (!clusterSource.current) return;
      const zoom = mapInstance.getView().getZoom();
      const newDistance = Math.max(30, Math.min(120, (MAX_ZOOM - zoom) * 8));
      clusterSource.current.setDistance(newDistance);
    };

    let zoomTimeout;
    mapInstance.getView().on('change:resolution', () => {
      if (zoomTimeout) clearTimeout(zoomTimeout);
      if (crashesLayer.current) {
        crashesLayer.current.setVisible(false);
      }
      
      zoomTimeout = setTimeout(() => {
        updateClusterDistance();
        if (showPoints && crashesLayer.current && !isInteracting) {
          crashesLayer.current.setVisible(true);
        }
      }, 100);
    });

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

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady, showPoints, crashesLayer.current, roadSegmentsLayer.current]);

  // Update point features when accidents change
  useEffect(() => {
    if (!showPoints || !mapRef.current) return;
    
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current);
    }
    
    renderTimeout.current = setTimeout(() => {
      if (accidents && accidents.length > 0) {
        console.log(`Processing ${accidents.length} accident points`);
        
        const isFirstBatch = !pointsSource.current.getFeatures().length;
        if (isFirstBatch) {
          clearFeatures();
        }
        
        updateFeaturesIncrementally(accidents);
      }
    }, 100);
    
    return () => {
      if (renderTimeout.current) {
        clearTimeout(renderTimeout.current);
      }
    };
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

  // Optimize feature creation with WebWorker-like chunking
  const createFeaturesBatch = (accidents, startIndex, endIndex) => {
    const features = [];
    const coordinates = new Float64Array((endIndex - startIndex) * 2);
    let validCount = 0;
    
    for (let i = startIndex; i < endIndex && i < accidents.length; i++) {
      const accident = accidents[i];
      if (!accident.latitude || !accident.longitude) continue;
      
      // Check cache first
      const cacheKey = `${accident.latitude},${accident.longitude}`;
      let feature = featuresCache.current.get(cacheKey);
      
      if (!feature) {
        const coords = fromLonLat([accident.longitude, accident.latitude]);
        coordinates[validCount * 2] = coords[0];
        coordinates[validCount * 2 + 1] = coords[1];
        
        feature = new Feature({
          geometry: new Point([coordinates[validCount * 2], coordinates[validCount * 2 + 1]]),
          properties: accident
        });
        featuresCache.current.set(cacheKey, feature);
        validCount++;
      }
      
      features.push(feature);
    }
    
    return features;
  };

  // Update point features incrementally with optimized batching
  const updateFeaturesIncrementally = (accidents, chunkSize = 10000) => {
    let currentIndex = 0;
    let additionTimeout;
    
    const processNextChunk = () => {
      if (currentIndex >= accidents.length) {
        if (additionTimeout) {
          clearTimeout(additionTimeout);
        }
        return;
      }
      
      const endIndex = Math.min(currentIndex + chunkSize, accidents.length);
      const features = createFeaturesBatch(accidents, currentIndex, endIndex);
      
      // Batch feature additions
      if (features.length > 0) {
        if (additionTimeout) {
          clearTimeout(additionTimeout);
        }
        
        additionTimeout = setTimeout(() => {
          pointsSource.current.addFeatures(features);
        }, 50);
      }
      
      currentIndex = endIndex;
      
      // Use a more aggressive chunking strategy when far from complete
      const progress = currentIndex / accidents.length;
      const nextChunkDelay = progress < 0.5 ? 0 : 10;
      
      // Schedule next chunk
      setTimeout(processNextChunk, nextChunkDelay);
    };
    
    processNextChunk();
  };

  // Update road segments when they change
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Clear existing road segments
    roadSegmentsSource.current.clear();
    
    // Add road segments
    if (roadSegments && roadSegments.length > 0) {
      console.log(`Adding ${roadSegments.length} road segments to map`);
      
      const features = roadSegments.map(segment => {
        const coordinates = segment.coordinates.map(coord =>
          fromLonLat([coord[0], coord[1]])
        );
        
        return new Feature({
          geometry: new LineString(coordinates),
          intensity: segment.intensity,
          name: segment.name,
          count: segment.count
        });
      });
      
      roadSegmentsSource.current.addFeatures(features);
      mapRef.current.render();
    }
  }, [roadSegments]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute top-0 left-0"
      />
      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full z-10">
          Loading data... {accidents.length.toLocaleString()} of {totalAccidents ? totalAccidents.toLocaleString() : '?'} accidents
        </div>
      )}
    </div>
  );
}