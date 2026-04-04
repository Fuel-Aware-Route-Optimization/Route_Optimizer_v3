"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapNode, MapEdge } from "./components/RouteMap";

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

// merchant stuff from the original UI (unchanged)
type Merchant = {
  id: string; name: string; brand: string; price: number; oldPrice: number;
  distance: number; updatedHours: number; discountOff: number;
  atob: boolean; network: boolean; score: number; x: number; y: number; fuels: string[];
};
const fuelOptions = ["Truck Diesel", "Regular Gas", "Premium"];
const discountOptions = ["All Discounts", "AtoB Discount", "Network Only"];
const radiusOptions = ["50 mi", "100 mi", "200 mi"];

const merchants: Merchant[] = [
  { id:"petro",name:"Petro Stopping Center",brand:"P",price:4.88,oldPrice:4.98,distance:44.0,updatedHours:11,discountOff:106,atob:true,network:true,score:96,x:18,y:52,fuels:["Truck Diesel","Regular Gas"] },
  { id:"ta",name:"Travelcenters Of America",brand:"TA",price:4.92,oldPrice:5.35,distance:49.6,updatedHours:12,discountOff:43,atob:true,network:true,score:92,x:31,y:56,fuels:["Truck Diesel","Regular Gas"] },
  { id:"ta-2",name:"Travelcenters Of America",brand:"TA",price:4.94,oldPrice:5.06,distance:47.6,updatedHours:13,discountOff:12,atob:true,network:false,score:90,x:47,y:60,fuels:["Truck Diesel"] },
  { id:"speedway",name:"Speedway",brand:"S",price:4.94,oldPrice:5.0,distance:65.7,updatedHours:10,discountOff:6,atob:false,network:true,score:88,x:64,y:67,fuels:["Regular Gas","Premium"] },
  { id:"seven-eleven",name:"7-Eleven",brand:"7",price:5.32,oldPrice:5.38,distance:8.3,updatedHours:10,discountOff:6,atob:true,network:true,score:94,x:80,y:70,fuels:["Regular Gas","Premium"] },
  { id:"pilot",name:"Pilot Travel Center",brand:"PT",price:4.99,oldPrice:5.11,distance:78.8,updatedHours:8,discountOff:13,atob:false,network:true,score:84,x:74,y:58,fuels:["Truck Diesel","Regular Gas","Premium"] },
];
const brandClass: Record<string,string> = { P:"brand-petro", TA:"brand-ta", S:"brand-speedway", "7":"brand-seven", PT:"brand-pilot" };
const radiusToMiles = (v: string) => Number(v.replace(" mi",""));

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

  // merchant panel state (unchanged from original)
  const [fuelType, setFuelType] = useState(fuelOptions[0]);
  const [discountType, setDiscountType] = useState(discountOptions[0]);
  const [radius, setRadius] = useState(radiusOptions[1]);
  const [sortBy, setSortBy] = useState<"recommended"|"price">("recommended");
  const [selectedId, setSelectedId] = useState("petro");

  const filteredMerchants = useMemo(() => {
    const maxMiles = radiusToMiles(radius);
    return merchants
      .filter((m) => m.distance <= maxMiles && m.fuels.includes(fuelType) &&
        (discountType === "All Discounts" || (discountType === "AtoB Discount" ? m.atob : m.network)))
      .sort((a, b) => sortBy === "price" ? a.price - b.price : b.score - a.score);
  }, [discountType, fuelType, radius, sortBy]);

  const activeMerchant = filteredMerchants.find((m) => m.id === selectedId) ?? filteredMerchants[0];
  const routePrices = filteredMerchants.slice(0, 5);

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
        <div className="map-grid" />

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

        {routePrices.map((merchant, index) => (
          <button
            key={merchant.id}
            className={`map-price-chip ${activeMerchant?.id === merchant.id ? "active" : ""}`}
            style={{ left: `${merchant.x}%`, top: `${merchant.y}%`, zIndex: 30 - index }}
            onClick={() => setSelectedId(merchant.id)}
          >
            <span className={`brand-dot ${brandClass[merchant.brand] ?? ""}`}>{merchant.brand}</span>
            <span>${merchant.price.toFixed(2)}</span>
          </button>
        ))}

        <section className="sheet">
          <div className="sheet-handle" />
          <article className="reminder">
            <p className="reminder-title">Reminder</p>
            <p>Your card is eligible for TA, Petro, 7-Eleven and Speedway discounted stations.</p>
          </article>
          <div className="merchant-header">
            <h1>Merchants ({filteredMerchants.length})</h1>
            <button className="sort-btn" onClick={() => setSortBy(sortBy === "recommended" ? "price" : "recommended")}>
              {sortBy === "recommended" ? "Recommended" : "Price"} ↓↑
            </button>
          </div>
          <div className="filters">
            <label><span>Fuel</span>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                {fuelOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label><span>Discount</span>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                {discountOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label><span>Radius</span>
              <select value={radius} onChange={(e) => setRadius(e.target.value)}>
                {radiusOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <ul className="merchant-list">
            {filteredMerchants.length === 0 ? (
              <li className="empty-state">No stations matched these filters. Try increasing the radius.</li>
            ) : filteredMerchants.map((merchant) => (
              <li key={merchant.id}>
                <button
                  className={`merchant-card ${activeMerchant?.id === merchant.id ? "active" : ""}`}
                  onClick={() => setSelectedId(merchant.id)}
                >
                  <span className={`merchant-brand ${brandClass[merchant.brand] ?? ""}`}>{merchant.brand}</span>
                  <span className="merchant-main">
                    <strong>{merchant.name}</strong>
                    <small>{merchant.distance.toFixed(1)} mi away • Updated {merchant.updatedHours}h ago</small>
                  </span>
                  <span className="merchant-price">
                    <small>${merchant.oldPrice.toFixed(2)}</small>
                    <strong>${merchant.price.toFixed(2)}</strong>
                    <em>{merchant.discountOff}c off</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <nav className="bottom-nav" aria-label="Primary">
          <button>Home</button>
          <button className="active">Fuel Map</button>
          <button>Cards</button>
        </nav>
      </section>
    </main>
  );
}
