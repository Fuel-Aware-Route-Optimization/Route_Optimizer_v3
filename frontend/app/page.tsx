"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapNode, MapEdge } from "./components/RouteMap";
import StationPanel from "./components/StationPanel";

const RouteMap = dynamic(() => import("./components/RouteMap"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type NodeId = string;

interface RouteResponse {
  nodes: MapNode[];
  edges: MapEdge[];
  route: {
    path: NodeId[];
    total_distance: number;
    fuel_cost: number;
    objective: number;
    expanded: number;
    notes: string | null;
  };
  baseline_path: string[];
  comparison: {
    baseline_fuel_cost: number;
    optimized_fuel_cost: number;
    savings_amount: number;
    savings_percent: number;
  } | null;
}

export default function Home() {
  // route data from backend
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [routePath, setRoutePath] = useState<NodeId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // origin / destination are city IDs from the graph
  const [origin, setOrigin] = useState<NodeId>("");
  const [destination, setDestination] = useState<NodeId>("");

  // available cities (populated after first fetch)
  const availableCities = useMemo(() => nodes.map((n) => n.id), [nodes]);

  const fetchRoute = useCallback(async (start?: string, goal?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ algorithm: "astar", seed: "42" });
      if (start) params.set("start", start);
      if (goal) params.set("goal", goal);

      const res = await fetch(`${API_BASE}/route?${params}`);
      if (!res.ok) throw new Error(`Backend ${res.status}`);
      const data: RouteResponse = await res.json();

      setNodes(data.nodes);
      setEdges(data.edges);
      setRoutePath(data.route.path);

      // sync the inputs with what the backend actually used
      if (data.route.path.length > 0) {
        if (!start) setOrigin(data.route.path[0]);
        if (!goal) setDestination(data.route.path[data.route.path.length - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch (no start/goal, let backend pick defaults)
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchRoute();
  }, [fetchRoute]);

  const handleSwap = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
    fetchRoute(destination, origin);
  };

  return (
    <main className="app-page">
      <section className="app-shell">
        {loading ? (
          <div className="map-loading">loading route…</div>
        ) : error ? (
          <div className="map-error">backend error: {error}</div>
        ) : (
          <RouteMap
            nodes={nodes}
            edges={edges}
            routePath={routePath}
            fromNode={origin}
            toNode={destination}
          />
        )}

        <header className="route-head">
          <button className="icon-btn" aria-label="Back">
            <span aria-hidden>‹</span>
          </button>
          <div className="route-inputs">
            <label className="route-field">
              <span className="field-label">From</span>
              <select
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  fetchRoute(e.target.value, destination);
                }}
              >
                {availableCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="route-field">
              <span className="field-label">To</span>
              <select
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  fetchRoute(origin, e.target.value);
                }}
              >
                {availableCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="icon-btn" onClick={handleSwap} aria-label="Swap route">
            ↕
          </button>
        </header>

        <StationPanel nodes={nodes} routePath={routePath} />

        <nav className="bottom-nav" aria-label="Primary">
          <button>Home</button>
          <button className="active">Fuel Map</button>
          <button>Cards</button>
        </nav>
      </section>
    </main>
  );
}
