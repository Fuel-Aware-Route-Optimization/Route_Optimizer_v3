"use client";

import { useMemo, useState } from "react";
import type { MapNode } from "./RouteMap";

// fuel types for the filter dropdown
const FUEL_TYPES = ["Diesel", "Regular", "Premium"];

interface StationPanelProps {
  nodes: MapNode[];
  routePath: string[];
}

export default function StationPanel({ nodes, routePath }: StationPanelProps) {
  const [sortAsc, setSortAsc] = useState(true);
  const [fuelFilter, setFuelFilter] = useState(FUEL_TYPES[0]);

  // only show stations that are on the route, deduped
  const routeStations = useMemo(() => {
    const seen = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const stations: MapNode[] = [];
    for (const id of routePath) {
      if (seen.has(id)) continue;
      seen.add(id);
      const node = nodeMap.get(id);
      if (node) stations.push(node);
    }
    return stations;
  }, [nodes, routePath]);

  // sort by price
  const sorted = useMemo(() => {
    const copy = [...routeStations];
    copy.sort((a, b) =>
      sortAsc ? a.fuel_price - b.fuel_price : b.fuel_price - a.fuel_price
    );
    return copy;
  }, [routeStations, sortAsc]);

  // TODO: backend returns one price per node with no fuel type
  // when a fuel prices API is integrated, filter here by fuelFilter

  const shortName = (id: string) =>
    id.includes(",") ? id.split(",")[0].trim() : id;

  return (
    <section className="sheet">
      <div className="sheet-handle" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Stations ({sorted.length})</h1>
        <button className="sort-btn" onClick={() => setSortAsc(!sortAsc)}>
          Price {sortAsc ? "↑" : "↓"}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4, maxWidth: 200 }}>
          <span style={{ fontSize: "0.65rem", color: "#a6b3cf", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Fuel type
          </span>
          <select
            value={fuelFilter}
            onChange={(e) => setFuelFilter(e.target.value)}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              background: "rgba(11,22,45,0.6)",
              color: "#dce6ff",
              fontSize: "0.9rem",
              padding: "8px",
            }}
          >
            {FUEL_TYPES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sorted.length === 0 ? (
          <div className="empty-state">No stations on this route yet.</div>
        ) : (
          sorted.map((station, i) => (
            <div
              key={station.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2rem 1fr auto",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid rgba(87,160,255,0.25)",
                borderRadius: 11,
                background: "linear-gradient(120deg, rgba(30,50,90,0.8), rgba(25,42,75,0.75))",
              }}
            >
              <span
                style={{
                  width: "2.2rem",
                  height: "2.2rem",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "rgba(87,160,255,0.2)",
                  color: "#57a0ff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                {i + 1}
              </span>

              <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
                <strong style={{ fontSize: "1.02rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {shortName(station.id)}
                </strong>
                <small style={{ color: "#a6b3cf", fontSize: "0.75rem" }}>
                  {station.id}
                </small>
                <small style={{ color: "#a6b3cf", fontSize: "0.72rem" }}>
                  {station.y.toFixed(3)}°N, {Math.abs(station.x).toFixed(3)}°W
                </small>
              </div>

              <div style={{ display: "grid", justifyItems: "end", gap: 1 }}>
                <strong style={{ fontSize: "1.25rem", color: "#d4ec94" }}>
                  ${station.fuel_price.toFixed(2)}
                </strong>
                <small style={{ color: "#a6b3cf", fontSize: "0.72rem" }}>
                  {fuelFilter}/gal
                </small>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
