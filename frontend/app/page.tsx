"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";

import PlaceAutocomplete from "./components/PlaceAutocomplete";
import StationPanel from "./components/StationPanel";
import type { PlaceSuggestion, RouteResponse } from "./types";

const RouteMap = dynamic(() => import("./components/RouteMap"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_ORIGIN = "Phoenix, Arizona";
const DEFAULT_DESTINATION = "Dallas, Texas";

interface PlaceSearchState {
  query: string;
  selected: PlaceSuggestion | null;
}

function usePlaceSuggestions(query: string) {
  const deferredQuery = useDeferredValue(query);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = deferredQuery.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: normalized, limit: "6" });
        const response = await fetch(`${API_BASE}/places/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Suggestion lookup failed.");
        }

        const data: PlaceSuggestion[] = await response.json();
        setSuggestions(data);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery]);

  return { suggestions, loading };
}

async function searchSinglePlace(query: string) {
  const params = new URLSearchParams({ q: query.trim(), limit: "1" });
  const response = await fetch(`${API_BASE}/places/search?${params.toString()}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Could not resolve that place.");
  }

  const matches: PlaceSuggestion[] = await response.json();
  if (!matches[0]) {
    throw new Error(`No place match found for "${query}".`);
  }

  return matches[0];
}

export default function Home() {
  const [origin, setOrigin] = useState<PlaceSearchState>({
    query: DEFAULT_ORIGIN,
    selected: null,
  });
  const [destination, setDestination] = useState<PlaceSearchState>({
    query: DEFAULT_DESTINATION,
    selected: null,
  });
  const [fuelType, setFuelType] = useState("regular");
  const [optimizeMode, setOptimizeMode] = useState<"cost" | "distance">("cost");
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originSuggestions = usePlaceSuggestions(origin.query);
  const destinationSuggestions = usePlaceSuggestions(destination.query);
  const didInit = useRef(false);
  const latestRouteRef = useRef<RouteResponse | null>(null);

  const resolveSelectedPlace = useCallback(async (state: PlaceSearchState) => {
    if (state.selected && state.query.trim() === state.selected.label.trim()) {
      return state.selected;
    }
    return searchSinglePlace(state.query);
  }, []);

  const requestRoute = useCallback(async (
    nextOrigin: PlaceSuggestion,
    nextDestination: PlaceSuggestion,
    nextFuelType: string,
    nextOptimize: "cost" | "distance" = "cost",
  ) => {
    setLoadingRoute(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        origin_lat: String(nextOrigin.lat),
        origin_lon: String(nextOrigin.lon),
        destination_lat: String(nextDestination.lat),
        destination_lon: String(nextDestination.lon),
        origin_label: nextOrigin.label,
        destination_label: nextDestination.label,
        fuel_type: nextFuelType,
        optimize: nextOptimize,
      });
      const response = await fetch(`${API_BASE}/route?${params.toString()}`);

      if (!response.ok) {
        let message = "Unable to build that route.";
        try {
          const payload = await response.json();
          if (payload?.detail) {
            message = String(payload.detail);
          }
        } catch {
          message = `Backend ${response.status}`;
        }
        throw new Error(message);
      }

      const data: RouteResponse = await response.json();
      latestRouteRef.current = data;
      setRoute(data);
      setOrigin({ query: data.origin.label, selected: data.origin });
      setDestination({ query: data.destination.label, selected: data.destination });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Route request failed.");
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const submitWithStates = useCallback(async (
    nextOriginState: PlaceSearchState,
    nextDestinationState: PlaceSearchState,
    nextFuelType: string,
    nextOptimize: "cost" | "distance" = "cost",
  ) => {
    const originQuery = nextOriginState.query.trim();
    const destinationQuery = nextDestinationState.query.trim();
    if (!originQuery || !destinationQuery) {
      setError("Enter both a starting point and a destination.");
      return;
    }

    try {
      const [resolvedOrigin, resolvedDestination] = await Promise.all([
        resolveSelectedPlace(nextOriginState),
        resolveSelectedPlace(nextDestinationState),
      ]);

      setOrigin({ query: resolvedOrigin.label, selected: resolvedOrigin });
      setDestination({ query: resolvedDestination.label, selected: resolvedDestination });
      await requestRoute(resolvedOrigin, resolvedDestination, nextFuelType, nextOptimize);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Route request failed.");
    }
  }, [requestRoute, resolveSelectedPlace]);

  const handleSubmit = useCallback(async () => {
    await submitWithStates(origin, destination, fuelType, optimizeMode);
  }, [destination, fuelType, optimizeMode, origin, submitWithStates]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void handleSubmit();
  }, [handleSubmit]);

  useEffect(() => {
    if (!latestRouteRef.current) return;
    void requestRoute(
      latestRouteRef.current.origin,
      latestRouteRef.current.destination,
      fuelType,
      optimizeMode,
    );
  }, [fuelType, optimizeMode, requestRoute]);

  return (
    <main className="app-page">
      <section className="app-shell">
        <RouteMap
          geometry={route?.geometry ?? []}
          bounds={route?.bounds ?? []}
          origin={route?.origin ?? null}
          destination={route?.destination ?? null}
          fuelStops={route?.fuel_stops ?? []}
        />

        <div className="map-scrim" />

        <header className="search-shell">
          <div className="search-card">
            <div className="search-copy">
              <p className="eyebrow">Live destination search</p>
              <h1>Drive between any two places</h1>
              <span>Type a city or address, choose a clean suggestion, then build the route.</span>
            </div>

            <form
              className="search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <PlaceAutocomplete
                id="origin"
                label="From"
                value={origin.query}
                loading={originSuggestions.loading}
                suggestions={originSuggestions.suggestions}
                selectedPlace={origin.selected}
                onChange={(value) => setOrigin({ query: value, selected: null })}
                onSelect={(place) => setOrigin({ query: place.label, selected: place })}
                onSubmit={() => void handleSubmit()}
              />

              <button
                type="button"
                className="swap-btn"
                aria-label="Swap origin and destination"
                onClick={() => {
                  const nextOrigin = destination;
                  const nextDestination = origin;
                  setOrigin(nextOrigin);
                  setDestination(nextDestination);

                  if (nextOrigin.query.trim() && nextDestination.query.trim()) {
                    void submitWithStates(nextOrigin, nextDestination, fuelType, optimizeMode);
                  }
                }}
              >
                ↕
              </button>

              <PlaceAutocomplete
                id="destination"
                label="To"
                value={destination.query}
                loading={destinationSuggestions.loading}
                suggestions={destinationSuggestions.suggestions}
                selectedPlace={destination.selected}
                onChange={(value) => setDestination({ query: value, selected: null })}
                onSelect={(place) => setDestination({ query: place.label, selected: place })}
                onSubmit={() => void handleSubmit()}
              />

              <button type="submit" className="go-btn" disabled={loadingRoute}>
                {loadingRoute ? "Routing..." : "Go"}
              </button>
            </form>

            {error ? <div className="error-banner">{error}</div> : null}
          </div>
        </header>

        <StationPanel
          origin={route?.origin ?? null}
          destination={route?.destination ?? null}
          summary={route?.summary ?? null}
          fuelStops={route?.fuel_stops ?? []}
          fuelType={fuelType}
          onFuelTypeChange={setFuelType}
          optimizeMode={optimizeMode}
          onOptimizeModeChange={setOptimizeMode}
        />
      </section>
    </main>
  );
}
