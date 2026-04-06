export interface PlaceSuggestion {
  id: string;
  label: string;
  primary_text: string;
  secondary_text: string;
  lat: number;
  lon: number;
  country_code?: string | null;
  state_code?: string | null;
}

export interface FuelStop {
  id: string;
  kind: "origin" | "stop";
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  distance_from_start_km: number;
  fuel_price: number;
  gallons_to_buy: number;
  estimated_cost: number;
  leg_distance_km: number;
}

export interface RouteSummary {
  distance_km: number;
  duration_min: number;
  fuel_type: string;
  estimated_gallons: number;
  estimated_fuel_cost: number;
  average_fuel_price: number;
  estimated_range_miles: number;
  note: string;
}

export interface RouteResponse {
  api_version: string;
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  geometry: number[][];
  bounds: number[][];
  summary: RouteSummary;
  fuel_stops: FuelStop[];
}
