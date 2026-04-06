"use client";

import React from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { FuelStop, PlaceSuggestion } from "../types";

interface RouteMapProps {
  geometry: number[][];
  bounds: number[][];
  origin: PlaceSuggestion | null;
  destination: PlaceSuggestion | null;
  fuelStops: FuelStop[];
}

function FitRoute({
  bounds,
  geometry,
}: {
  bounds: number[][];
  geometry: number[][];
}) {
  const map = useMap();

  React.useEffect(() => {
    if (bounds.length === 2) {
      map.fitBounds(
        [
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], bounds[1][1]],
        ],
        { padding: [64, 64] },
      );
      return;
    }

    if (geometry.length > 1) {
      const latLngs = geometry.map(([lon, lat]) => [lat, lon] as [number, number]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [64, 64] });
    }
  }, [bounds, geometry, map]);

  return null;
}

function stopIcon(label: string) {
  return L.divIcon({
    className: "fuel-stop-marker",
    html: `<span>${label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function RouteMap({
  geometry,
  bounds,
  origin,
  destination,
  fuelStops,
}: RouteMapProps) {
  const line = React.useMemo(
    () => geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
    [geometry],
  );

  const center: [number, number] = React.useMemo(() => {
    if (origin) return [origin.lat, origin.lon];
    return [39.5, -98.35];
  }, [origin]);

  return (
    <div className="route-map">
      <MapContainer center={center} zoom={5} scrollWheelZoom className="leaflet-shell">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <FitRoute bounds={bounds} geometry={geometry} />

        {line.length > 1 ? (
          <>
            <Polyline positions={line} pathOptions={{ color: "#1f5cff", weight: 11, opacity: 0.16 }} />
            <Polyline positions={line} pathOptions={{ color: "#2358f5", weight: 6, opacity: 0.9 }} />
          </>
        ) : null}

        {origin ? (
          <CircleMarker
            center={[origin.lat, origin.lon]}
            radius={10}
            pathOptions={{
              color: "#0c8f63",
              fillColor: "#17b37e",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span>{origin.label}</span>
            </Tooltip>
          </CircleMarker>
        ) : null}

        {destination ? (
          <CircleMarker
            center={[destination.lat, destination.lon]}
            radius={10}
            pathOptions={{
              color: "#b6421e",
              fillColor: "#ff6c3b",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span>{destination.label}</span>
            </Tooltip>
          </CircleMarker>
        ) : null}

        <Pane name="fuel-stops" style={{ zIndex: 650 }}>
          {fuelStops
            .filter((stop) => stop.kind === "stop")
            .map((stop, index) => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lon]}
                icon={stopIcon(String(index + 1))}
                pane="fuel-stops"
              >
                <Tooltip direction="top" offset={[0, -16]}>
                  <div className="map-tooltip">
                    <strong>{stop.name}</strong>
                    <span>{stop.subtitle}</span>
                    <span>${stop.fuel_price.toFixed(2)}/gal</span>
                  </div>
                </Tooltip>
              </Marker>
            ))}
        </Pane>
      </MapContainer>
    </div>
  );
}
