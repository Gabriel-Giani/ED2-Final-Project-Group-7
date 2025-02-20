"use client";

import React, { useEffect, useRef } from "react";
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
import { Circle, Style, Fill, Stroke, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import { supabase } from "../supabaseClient";
import "../styles/map.css";
import { getAccidentsInRadius } from "@/utils/db/accidents";

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = MIN_ZOOM;

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

export default function OpenLayersMap({ onMapReady }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Create cluster source
  const clusterSource = new Cluster({
    distance: 40,
    source: new VectorSource(),
  });

  const crashesLayer = new VectorLayer({
    source: clusterSource,
    style: getClusterStyle,
    zIndex: 2,
  });

  const viewStateRef = useRef({
    center: fromLonLat([-82.4497, 27.6648]),
    zoom: DEFAULT_ZOOM,
  });

  // Function to fetch crash data
  async function fetchCrashData() {
    try {
      console.log("Fetching crash data...");

      // Fetch all crash records
      const { data, error } = await supabase
        .from("florida_crashes_2006")
        .select("latitude, longitude, dtcarxtrct");

      if (error) {
        console.error("Supabase query error:", error);
        return;
      }

      if (!data || data.length === 0) {
        console.log("No crash data found.");
        return;
      }

      console.log(`Fetched ${data.length} crash records.`);
      console.log("Sample record:", data[0]);

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

      console.log("Number of features created:", features.length);

      // Add features to the cluster source
      const source = clusterSource.getSource();
      source.clear();
      source.addFeatures(features);

      console.log("Features added to map:", source.getFeatures().length);

      // Force map refresh
      if (mapRef.current) {
        mapRef.current.render();
        console.log("Map refreshed after adding features");
      }
    } catch (error) {
      console.error("Error in fetchCrashData:", error);
    }
  }

  // not sure what for?
  async function loadNearbyAccidents(lat, lng) {
    const accidents = await getAccidentsInRadius(lat, lng, 1000); // 1km radius
    // Update map markers...
  }

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const mapInstance = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [
          new TileLayer({ source: new OSM(), zIndex: 0 }),
          crashesLayer, // ✅ Ensure the crash layer is added
        ],
        view: new View({
          center: viewStateRef.current.center,
          zoom: viewStateRef.current.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        }),
      });

      mapRef.current = mapInstance;

      // Fetch crash data when the map is initialized
      fetchCrashData();

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
          fetchCrashData: fetchCrashData,
          getVectorSource: () => clusterSource.getSource(),
        });
      }
    }
  }, [onMapReady]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full absolute top-0 left-0"
    />
  );
}
