"use client";

import { useMemo, useState } from "react";

import type { FuelStop, PlaceSuggestion, RouteSummary } from "../types";

const FUEL_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "premium", label: "Premium" },
  { value: "diesel", label: "Diesel" },
];

interface StationPanelProps {
  origin: PlaceSuggestion | null;
  destination: PlaceSuggestion | null;
  summary: RouteSummary | null;
  fuelStops: FuelStop[];
  fuelType: string;
  onFuelTypeChange: (fuelType: string) => void;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours <= 0) return `${mins} min`;
  return `${hours} hr ${mins} min`;
}

export default function StationPanel({
  origin,
  destination,
  summary,
  fuelStops,
  fuelType,
  onFuelTypeChange,
}: StationPanelProps) {
  const [sortBy, setSortBy] = useState<"distance" | "price">("distance");

  const sortedStops = useMemo(() => {
    const enRoute = fuelStops.filter((stop) => stop.kind === "stop");
    return [...enRoute].sort((a, b) =>
      sortBy === "price"
        ? a.fuel_price - b.fuel_price
        : a.distance_from_start_km - b.distance_from_start_km,
    );
  }, [fuelStops, sortBy]);

  const startingStop = fuelStops.find((stop) => stop.kind === "origin") ?? null;

  return (
    <aside className="sheet">
      <div className="sheet-handle" />

      <div className="sheet-header">
        <div>
          <p className="eyebrow">Fuel-aware route</p>
          <h1>Trip plan</h1>
        </div>

        <label className="fuel-select">
          <span>Fuel</span>
          <select value={fuelType} onChange={(event) => onFuelTypeChange(event.target.value)}>
            {FUEL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {origin && destination ? (
        <div className="journey-card">
          <div>
            <span className="journey-label">From</span>
            <strong>{origin.primary_text}</strong>
            <small>{origin.secondary_text}</small>
          </div>
          <div className="journey-arrow">→</div>
          <div>
            <span className="journey-label">To</span>
            <strong>{destination.primary_text}</strong>
            <small>{destination.secondary_text}</small>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Search any two cities or addresses to build a live driving route with fuel planning.
        </div>
      )}

      {summary ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Drive</span>
              <strong>{summary.distance_km.toFixed(0)} km</strong>
              <small>{formatDuration(summary.duration_min)}</small>
            </div>
            <div className="stat-card">
              <span>Fuel</span>
              <strong>${summary.estimated_fuel_cost.toFixed(2)}</strong>
              <small>{summary.estimated_gallons.toFixed(1)} gal est.</small>
            </div>
            <div className="stat-card">
              <span>Average</span>
              <strong>${summary.average_fuel_price.toFixed(2)}</strong>
              <small>{summary.fuel_type}/gal</small>
            </div>
            <div className="stat-card">
              <span>Range</span>
              <strong>{summary.estimated_range_miles.toFixed(0)} mi</strong>
              <small>usable tank range</small>
            </div>
          </div>

          {startingStop ? (
            <div className="reminder-card">
              <p className="eyebrow">Starting fill</p>
              <strong>{startingStop.name}</strong>
              <small>{startingStop.subtitle}</small>
              <div className="reminder-metrics">
                <span>${startingStop.fuel_price.toFixed(2)}/gal</span>
                <span>{startingStop.gallons_to_buy.toFixed(1)} gal</span>
                <span>${startingStop.estimated_cost.toFixed(2)}</span>
              </div>
            </div>
          ) : null}

          <div className="panel-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">Suggested refuels</p>
                <h2>{sortedStops.length} route stops</h2>
              </div>
              <button
                type="button"
                className="sort-btn"
                onClick={() =>
                  setSortBy((current) => (current === "distance" ? "price" : "distance"))
                }
              >
                Sort: {sortBy === "distance" ? "distance" : "price"}
              </button>
            </div>

            {sortedStops.length === 0 ? (
              <div className="empty-state">
                This trip fits inside the estimated tank range, so no en route refuel stop is needed.
              </div>
            ) : (
              <div className="stop-list">
                {sortedStops.map((stop, index) => (
                  <article key={stop.id} className="stop-card">
                    <div className="stop-rank">{index + 1}</div>
                    <div className="stop-main">
                      <strong>{stop.name}</strong>
                      <small>{stop.subtitle}</small>
                      <small>
                        {stop.distance_from_start_km.toFixed(0)} km from start • next leg{" "}
                        {stop.leg_distance_km.toFixed(0)} km
                      </small>
                    </div>
                    <div className="stop-price">
                      <strong>${stop.fuel_price.toFixed(2)}</strong>
                      <small>{stop.gallons_to_buy.toFixed(1)} gal</small>
                      <em>${stop.estimated_cost.toFixed(2)}</em>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <p className="panel-note">{summary.note}</p>
        </>
      ) : null}
    </aside>
  );
}
