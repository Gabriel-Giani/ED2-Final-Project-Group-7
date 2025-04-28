"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAccidentContext } from "@/context/accidentContext";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { OSM } from "ol/source";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { Style, Stroke } from "ol/style";
import Overlay from "ol/Overlay";
import { defaults as defaultControls } from "ol/control";
import Point from "ol/geom/Point";
import { Circle, Fill, Text } from "ol/style";
import Cluster from "ol/source/Cluster";
import AccidentDetailsPopup from "@/app/components/AccidentDetailsPopup";

const FLORIDA_EXTENT = [-87.8, 24.2, -79.7, 31.2];
const FLORIDA_EXTENT_PROJ = [
  ...fromLonLat([FLORIDA_EXTENT[0], FLORIDA_EXTENT[1]]),
  ...fromLonLat([FLORIDA_EXTENT[2], FLORIDA_EXTENT[3]]),
];
const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 7;

function getHeatColor(intensity) {
  if (intensity < 0.33) return `rgba(0, 220, 0, 0.8)`; // Green
  if (intensity < 0.66) return `rgba(255, 220, 0, 0.8)`; // Yellow
  return `rgba(220, 0, 0, 0.8)`; // Red
}

// Convert intensity (0-1) to rating (0-5)
function getRiskRating(intensity) {
  return Math.round(intensity * 10) / 2;
}

function getRiskRatingHTML(rating) {
  const totalSymbols = 5;
  const fullSymbols = Math.floor(rating);
  const hasHalfSymbol = rating % 1 !== 0;
  const emptySymbols = totalSymbols - fullSymbols - (hasHalfSymbol ? 1 : 0);

  const fullSymbolSVG = `<svg class="inline w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#FF0000" stroke-width="3" fill="none" />
    <line x1="5" y1="19" x2="19" y2="5" stroke="#FF0000" stroke-width="3" />
  </svg>`;

  const emptySymbolSVG = `<svg class="inline w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#9CA3AF" stroke-width="3" fill="none" />
    <line x1="5" y1="19" x2="19" y2="5" stroke="#9CA3AF" stroke-width="3" />
  </svg>`;

  const halfSymbolSVG = `<svg class="inline w-4 h-4" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="half-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="50%" stop-color="#FF0000" />
        <stop offset="50%" stop-color="#9CA3AF" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9" stroke="url(#half-gradient)" stroke-width="3" fill="none" />
    <line x1="5" y1="19" x2="19" y2="5" stroke="url(#half-gradient)" stroke-width="3" />
  </svg>`;

  return `
    <div class="flex flex-col gap-2">
      <div class="text-xs text-gray-300">
        More symbols indicate higher risk (scale: 0-5)
      </div>
      <div class="flex gap-1">
        ${fullSymbolSVG.repeat(fullSymbols)}
        ${hasHalfSymbol ? halfSymbolSVG : ""}
        ${emptySymbolSVG.repeat(emptySymbols)}
      </div>
      <div class="text-xs text-gray-300">
        Risk Rating: ${rating.toFixed(1)} out of 5
      </div>
    </div>
  `;
}

const accidentPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "rgba(239, 68, 68, 0.7)" }),
    stroke: new Stroke({ color: "#ffffff", width: 1 }),
  }),
});

function getClusterStyle(feature) {
  const size = feature.get("features").length;
  const radius = Math.min(Math.max(8, Math.sqrt(size) * 3), 20);

  return new Style({
    image: new Circle({
      radius: radius,
      fill: new Fill({
        color: size > 1 ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.7)",
      }),
      stroke: new Stroke({
        color: "#fff",
        width: 2,
      }),
    }),
    text:
      size > 1
        ? new Text({
            text: size.toString(),
            fill: new Fill({
              color: "#fff",
            }),
            font: "bold 12px Inter, Arial, sans-serif",
          })
        : null,
  });
}

function addRoadInfoInteraction(map, layerId = "roadLayer") {
  const overlayId = "road-info-overlay";
  const existingOverlay = map.getOverlayById(overlayId);
  if (existingOverlay) {
    map.removeOverlay(existingOverlay);
  }

  const tooltipElement =
    document.getElementById("road-tooltip") || document.createElement("div");
  tooltipElement.id = "road-tooltip";
  tooltipElement.className = "ol-tooltip hidden";
  tooltipElement.style.position = "absolute";
  tooltipElement.style.backgroundColor = "rgba(30, 41, 59, 0.9)";
  tooltipElement.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";
  tooltipElement.style.color = "#f1f5f9";
  tooltipElement.style.padding = "10px 15px";
  tooltipElement.style.borderRadius = "6px";
  tooltipElement.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  tooltipElement.style.pointerEvents = "none";
  tooltipElement.style.zIndex = "1000";
  tooltipElement.style.fontSize = "12px";
  tooltipElement.style.minWidth = "200px";
  tooltipElement.style.maxWidth = "400px";
  tooltipElement.style.wordBreak = "normal";

  if (!document.getElementById(tooltipElement.id)) {
    document.body.appendChild(tooltipElement);
  }

  const tooltip = new Overlay({
    element: tooltipElement,
    id: overlayId,
    offset: [0, -15],
    positioning: "bottom-center",
    stopEvent: false,
  });
  map.addOverlay(tooltip);

  map.on("pointermove", function (evt) {
    if (evt.dragging) {
      tooltipElement.classList.add("hidden");
      return;
    }

    const pixel = map.getEventPixel(evt.originalEvent);
    let featureFound = null;

    map.forEachFeatureAtPixel(
      pixel,
      function (feature, layer) {
        if (layer && layer.get("layerId") === layerId) {
          featureFound = feature;
          return true;
        }
        return false;
      },
      {
        layerFilter: (layer) => layer.get("layerId") === layerId,
      }
    );

    const targetElement = map.getTargetElement();
    targetElement.style.cursor = featureFound ? "pointer" : "";

    if (featureFound) {
      const properties = {
        name: featureFound.get("name") || "Unknown Road",
        count: featureFound.get("count") || 0,
        intensity: featureFound.get("intensity") || 0,
        length: featureFound.get("length") || 0,
        accidentsPerKm: featureFound.get("accidentsPerKm") || 0,
        roadType: featureFound.get("roadType") || "",
      };

      const riskRating = getRiskRating(properties.intensity);

      let riskColor;
      if (riskRating < 2) {
        riskColor = "#22c55e"; // Green
      } else if (riskRating < 4) {
        riskColor = "#eab308"; // Yellow
      } else {
        riskColor = "#ef4444"; // Red
      }

      tooltipElement.innerHTML = `
        <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 6px;">
          <div style="font-weight: bold; font-size: 14px;">${
            properties.name
          }</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Road Type:</div>
          <div>${properties.roadType || "N/A"}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Accidents:</div>
          <div>${properties.count}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Length:</div>
          <div>${(properties.length / 1000).toFixed(2)} km</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Accidents/km:</div>
          <div>${properties.accidentsPerKm.toFixed(2)}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Risk Rating:</div>
          <div style="color: ${riskColor}; font-weight: bold">${riskRating.toFixed(
        1
      )}/5</div>
        </div>
      `;

      tooltip.setPosition(evt.coordinate);
      tooltipElement.classList.remove("hidden");
    } else {
      tooltipElement.classList.add("hidden");
    }
  });

  map.on("movestart", () => {
    tooltipElement.classList.add("hidden");
  });
}

function addAccidentInfoInteraction(map, layerId = "pointsLayer") {
  const overlayId = "accident-info-overlay";
  const existingOverlay = map.getOverlayById(overlayId);
  if (existingOverlay) {
    map.removeOverlay(existingOverlay);
  }

  const tooltipElement =
    document.getElementById("accident-tooltip") ||
    document.createElement("div");
  tooltipElement.id = "accident-tooltip";
  tooltipElement.className = "ol-tooltip hidden";
  tooltipElement.style.position = "absolute";
  tooltipElement.style.backgroundColor = "rgba(30, 41, 59, 0.9)";
  tooltipElement.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";
  tooltipElement.style.color = "#f1f5f9";
  tooltipElement.style.padding = "10px 15px";
  tooltipElement.style.borderRadius = "6px";
  tooltipElement.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  tooltipElement.style.pointerEvents = "none";
  tooltipElement.style.zIndex = "1000";
  tooltipElement.style.fontSize = "12px";
  tooltipElement.style.minWidth = "350px";
  tooltipElement.style.maxWidth = "400px";
  tooltipElement.style.wordBreak = "normal";

  if (!document.getElementById(tooltipElement.id)) {
    document.body.appendChild(tooltipElement);
  }

  const tooltip = new Overlay({
    element: tooltipElement,
    id: overlayId,
    offset: [0, -15],
    positioning: "bottom-center",
    stopEvent: false,
  });
  map.addOverlay(tooltip);

  map.on("pointermove", function (evt) {
    if (evt.dragging) {
      tooltipElement.classList.add("hidden");
      return;
    }

    const pixel = map.getEventPixel(evt.originalEvent);
    let featureFound = null;

    map.forEachFeatureAtPixel(
      pixel,
      function (feature, layer) {
        if (layer && layer.get("layerId") === layerId) {
          // Check for clusters vs single points
          const features = feature.get("features");
          if (features && features.length === 1) {
            // Show tooltip only for individual points
            featureFound = features[0];
            return true;
          }
        }
        return false;
      },
      {
        layerFilter: (layer) => layer.get("layerId") === layerId,
      }
    );

    const targetElement = map.getTargetElement();
    targetElement.style.cursor = featureFound ? "pointer" : "";

    if (featureFound) {
      const properties = featureFound.getProperties();

      const date = properties.crashdate
        ? new Date(properties.crashdate).toLocaleDateString()
        : "Unknown";
      const time = properties.crashtime
        ? `${properties.crashtime.slice(0, 2)}:${properties.crashtime.slice(2)}`
        : "Unknown";

      const injuries = properties.cntofinj || 0;
      const fatalities = properties.cntoffatl || 0;
      let severityColor;
      let severityText = "Minor";

      if (fatalities > 0) {
        severityColor = "#ef4444"; // Red
        severityText = "Fatal";
      } else if (injuries > 2) {
        severityColor = "#ef4444"; // Red
        severityText = "Severe";
      } else if (injuries > 0) {
        severityColor = "#eab308"; // Yellow
        severityText = "Moderate";
      } else {
        severityColor = "#22c55e"; // Green
      }

      tooltipElement.innerHTML = `
        <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 6px;">
          <div style="font-weight: bold; font-size: 14px;">${
            properties.onroadname || "Unknown Road"
          }</div>
        </div>
        ${
          properties.inroadname
            ? `
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Intersection:</div>
          <div>${properties.inroadname}</div>
        </div>`
            : ""
        }
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Date:</div>
          <div>${date}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Time:</div>
          <div>${time}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Injuries:</div>
          <div>${injuries}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Fatalities:</div>
          <div>${fatalities}</div>
        </div>
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Severity:</div>
          <div style="color: ${severityColor}; font-weight: bold">${severityText}</div>
        </div>
        ${
          properties.weathcond
            ? `
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Weather:</div>
          <div>${properties.weathcond}</div>
        </div>`
            : ""
        }
        ${
          properties.lightcond
            ? `
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Lighting:</div>
          <div>${properties.lightcond}</div>
        </div>`
            : ""
        }
        ${
          properties.rdsurfcond
            ? `
        <div style="display: flex; margin-bottom: 6px;">
          <div style="width: 120px; color: #94a3b8;">Road Surface:</div>
          <div>${properties.rdsurfcond}</div>
        </div>`
            : ""
        }
      `;

      tooltip.setPosition(evt.coordinate);
      tooltipElement.classList.remove("hidden");
    } else {
      tooltipElement.classList.add("hidden");
    }
  });

  map.on("movestart", () => {
    tooltipElement.classList.add("hidden");
  });
}

export default function RoadLineMap({ onMapReady }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const { roadLineSegments, accidents, showPoints } = useAccidentContext();
  const vectorLayerRef = useRef(null);
  const pointsLayerRef = useRef(null);
  const clusterSourceRef = useRef(null);

  const [selectedAccident, setSelectedAccident] = useState(null);

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = new Map({
        target: mapContainerRef.current,
        controls: defaultControls({ zoom: false }),
        layers: [new TileLayer({ source: new OSM(), zIndex: 0 })],
        view: new View({
          center: fromLonLat([-82.5, 28.1]),
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          extent: FLORIDA_EXTENT_PROJ,
          constrainOnlyCenter: true,
        }),
      });
      mapRef.current = map;

      vectorLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 1,
        layerId: "roadLayer",
      });

      const pointsSource = new VectorSource();
      clusterSourceRef.current = new Cluster({
        distance: 40,
        source: pointsSource,
      });

      pointsLayerRef.current = new VectorLayer({
        source: clusterSourceRef.current,
        style: getClusterStyle,
        zIndex: 2,
        layerId: "pointsLayer",
      });

      map.addLayer(vectorLayerRef.current);
      map.addLayer(pointsLayerRef.current);

      addRoadInfoInteraction(map, "roadLayer");

      map.on("click", function (evt) {
        const feature = map.forEachFeatureAtPixel(
          evt.pixel,
          function (feature) {
            return feature;
          },
          {
            layerFilter: function (layer) {
              return layer === pointsLayerRef.current;
            },
            hitTolerance: 10,
          }
        );

        if (feature) {
          const features = feature.get("features");
          if (features && features.length === 1) {
            // Single accident - show details
            const singleFeature = features[0];
            const props = singleFeature.getProperties();
            setSelectedAccident(props.properties);
          } else if (features && features.length > 1) {
            // Cluster - zoom in
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 500,
              maxZoom: 15,
            });
            setSelectedAccident(null);
          }
        } else {
          setSelectedAccident(null);
        }
      });

      if (onMapReady) {
        onMapReady(map);
      }
    }

    // Cleanup tooltip DOM element
    return () => {
      const roadTooltip = document.getElementById("road-tooltip");
      if (roadTooltip && roadTooltip.parentNode) {
        roadTooltip.parentNode.removeChild(roadTooltip);
      }
      const accidentTooltip = document.getElementById("accident-tooltip");
      if (accidentTooltip && accidentTooltip.parentNode) {
        accidentTooltip.parentNode.removeChild(accidentTooltip);
      }

      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [onMapReady]);

  // Update map layers based on showPoints state
  useEffect(() => {
    if (!mapRef.current || !vectorLayerRef.current || !pointsLayerRef.current)
      return;

    vectorLayerRef.current.setVisible(!showPoints);
    pointsLayerRef.current.setVisible(showPoints);

    if (!showPoints) {
      updateHotspotLayer();
    } else {
      updatePointsLayer();
    }
  }, [showPoints, roadLineSegments, accidents]);

  const updateHotspotLayer = () => {
    if (!vectorLayerRef.current) return;

    const source = vectorLayerRef.current.getSource();
    source.clear();

    if (roadLineSegments && roadLineSegments.length > 0) {
      const features = roadLineSegments
        .map((segment) => {
          if (
            segment.geometry &&
            segment.geometry.coordinates &&
            segment.geometry.coordinates.length >= 2
          ) {
            const feature = new Feature({
              geometry: new LineString(
                segment.geometry.coordinates.map((coord) => fromLonLat(coord))
              ),
              intensity: segment.intensity,
              count: segment.count,
              name: segment.name,
              roadType: segment.roadType,
              length: segment.length,
              accidentsPerKm: segment.accidentsPerKm,
            });

            feature.setStyle(
              new Style({
                stroke: new Stroke({
                  color: getHeatColor(segment.intensity),
                  width: 3 + segment.intensity * 6,
                }),
              })
            );
            return feature;
          }
          return null;
        })
        .filter(Boolean);

      source.addFeatures(features);
    }
  };

  const updatePointsLayer = () => {
    if (!clusterSourceRef.current) return;

    const source = clusterSourceRef.current.getSource();
    source.clear();

    if (accidents && accidents.length > 0) {
      const features = accidents
        .map((accident) => {
          if (accident.longitude && accident.latitude) {
            return new Feature({
              geometry: new Point(
                fromLonLat([
                  parseFloat(accident.longitude),
                  parseFloat(accident.latitude),
                ])
              ),
              properties: accident,
            });
          }
          return null;
        })
        .filter(Boolean);

      source.addFeatures(features);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {selectedAccident && (
        <AccidentDetailsPopup
          accident={selectedAccident}
          onClose={() => setSelectedAccident(null)}
        />
      )}
    </div>
  );
}
