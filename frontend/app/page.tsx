"use client";

import { useMemo, useState } from "react";

type Merchant = {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice: number;
  distance: number;
  updatedHours: number;
  discountOff: number;
  atob: boolean;
  network: boolean;
  score: number;
  x: number;
  y: number;
  fuels: string[];
};

const fuelOptions = ["Truck Diesel", "Regular Gas", "Premium"];
const discountOptions = ["All Discounts", "AtoB Discount", "Network Only"];
const radiusOptions = ["50 mi", "100 mi", "200 mi"];

const merchants: Merchant[] = [
  {
    id: "petro",
    name: "Petro Stopping Center",
    brand: "P",
    price: 4.88,
    oldPrice: 4.98,
    distance: 44.0,
    updatedHours: 11,
    discountOff: 106,
    atob: true,
    network: true,
    score: 96,
    x: 18,
    y: 52,
    fuels: ["Truck Diesel", "Regular Gas"],
  },
  {
    id: "ta",
    name: "Travelcenters Of America",
    brand: "TA",
    price: 4.92,
    oldPrice: 5.35,
    distance: 49.6,
    updatedHours: 12,
    discountOff: 43,
    atob: true,
    network: true,
    score: 92,
    x: 31,
    y: 56,
    fuels: ["Truck Diesel", "Regular Gas"],
  },
  {
    id: "ta-2",
    name: "Travelcenters Of America",
    brand: "TA",
    price: 4.94,
    oldPrice: 5.06,
    distance: 47.6,
    updatedHours: 13,
    discountOff: 12,
    atob: true,
    network: false,
    score: 90,
    x: 47,
    y: 60,
    fuels: ["Truck Diesel"],
  },
  {
    id: "speedway",
    name: "Speedway",
    brand: "S",
    price: 4.94,
    oldPrice: 5.0,
    distance: 65.7,
    updatedHours: 10,
    discountOff: 6,
    atob: false,
    network: true,
    score: 88,
    x: 64,
    y: 67,
    fuels: ["Regular Gas", "Premium"],
  },
  {
    id: "seven-eleven",
    name: "7-Eleven",
    brand: "7",
    price: 5.32,
    oldPrice: 5.38,
    distance: 8.3,
    updatedHours: 10,
    discountOff: 6,
    atob: true,
    network: true,
    score: 94,
    x: 80,
    y: 70,
    fuels: ["Regular Gas", "Premium"],
  },
  {
    id: "pilot",
    name: "Pilot Travel Center",
    brand: "PT",
    price: 4.99,
    oldPrice: 5.11,
    distance: 78.8,
    updatedHours: 8,
    discountOff: 13,
    atob: false,
    network: true,
    score: 84,
    x: 74,
    y: 58,
    fuels: ["Truck Diesel", "Regular Gas", "Premium"],
  },
];

const brandClass: Record<string, string> = {
  P: "brand-petro",
  TA: "brand-ta",
  S: "brand-speedway",
  "7": "brand-seven",
  PT: "brand-pilot",
};

const radiusToMiles = (value: string) => Number(value.replace(" mi", ""));

export default function Home() {
  const [origin, setOrigin] = useState("Current Location");
  const [destination, setDestination] = useState("San Francisco");
  const [fuelType, setFuelType] = useState(fuelOptions[0]);
  const [discountType, setDiscountType] = useState(discountOptions[0]);
  const [radius, setRadius] = useState(radiusOptions[1]);
  const [sortBy, setSortBy] = useState<"recommended" | "price">("recommended");
  const [selectedId, setSelectedId] = useState("petro");

  const filteredMerchants = useMemo(() => {
    const maxMiles = radiusToMiles(radius);

    const discounted = merchants.filter((merchant) => {
      if (merchant.distance > maxMiles) {
        return false;
      }
      if (!merchant.fuels.includes(fuelType)) {
        return false;
      }
      if (discountType === "AtoB Discount") {
        return merchant.atob;
      }
      if (discountType === "Network Only") {
        return merchant.network;
      }
      return true;
    });

    return discounted.sort((a, b) => {
      if (sortBy === "price") {
        return a.price - b.price;
      }
      return b.score - a.score;
    });
  }, [discountType, fuelType, radius, sortBy]);

  const activeMerchant =
    filteredMerchants.find((merchant) => merchant.id === selectedId) ??
    filteredMerchants[0];

  const routePrices = filteredMerchants.slice(0, 5);

  const handleSwapLocations = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="map-canvas" />
        <div className="map-grid" />

        <header className="route-head">
          <button className="icon-btn" aria-label="Back">
            <span aria-hidden>‹</span>
          </button>
          <div className="route-inputs">
            <label className="route-field">
              <span className="field-label">From</span>
              <input
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              />
            </label>
            <label className="route-field">
              <span className="field-label">To</span>
              <input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </label>
          </div>
          <button
            className="icon-btn"
            onClick={handleSwapLocations}
            aria-label="Swap route"
          >
            ↕
          </button>
        </header>

        <div className="route-line" aria-hidden>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M98 70 C 84 63, 76 58, 65 55 C 54 52, 46 49, 38 43 C 29 36, 21 30, 8 24" />
          </svg>
        </div>

        {routePrices.map((merchant, index) => (
          <button
            key={merchant.id}
            className={`map-price-chip ${activeMerchant?.id === merchant.id ? "active" : ""}`}
            style={{ left: `${merchant.x}%`, top: `${merchant.y}%`, zIndex: 30 - index }}
            onClick={() => setSelectedId(merchant.id)}
          >
            <span className={`brand-dot ${brandClass[merchant.brand] ?? ""}`}>
              {merchant.brand}
            </span>
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
            <button
              className="sort-btn"
              onClick={() => setSortBy(sortBy === "recommended" ? "price" : "recommended")}
            >
              {sortBy === "recommended" ? "Recommended" : "Price"} ↓↑
            </button>
          </div>

          <div className="filters">
            <label>
              <span>Fuel</span>
              <select value={fuelType} onChange={(event) => setFuelType(event.target.value)}>
                {fuelOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Discount</span>
              <select value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
                {discountOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Radius</span>
              <select value={radius} onChange={(event) => setRadius(event.target.value)}>
                {radiusOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <ul className="merchant-list">
            {filteredMerchants.length === 0 ? (
              <li className="empty-state">
                No stations matched these filters. Try increasing the radius.
              </li>
            ) : (
              filteredMerchants.map((merchant) => (
                <li key={merchant.id}>
                  <button
                    className={`merchant-card ${activeMerchant?.id === merchant.id ? "active" : ""}`}
                    onClick={() => setSelectedId(merchant.id)}
                  >
                    <span className={`merchant-brand ${brandClass[merchant.brand] ?? ""}`}>
                      {merchant.brand}
                    </span>
                    <span className="merchant-main">
                      <strong>{merchant.name}</strong>
                      <small>
                        {merchant.distance.toFixed(1)} mi away • Updated {merchant.updatedHours}h ago
                      </small>
                    </span>
                    <span className="merchant-price">
                      <small>${merchant.oldPrice.toFixed(2)}</small>
                      <strong>${merchant.price.toFixed(2)}</strong>
                      <em>{merchant.discountOff}c off</em>
                    </span>
                  </button>
                </li>
              ))
            )}
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
