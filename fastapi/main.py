from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.fuel import FuelPlan, build_fuel_plan
from services.places import PlaceCandidate, geocode_place, reverse_geocode, search_places
from services.routing import get_driving_route

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()

app = FastAPI(
    title="Fuel-Aware Route Optimizer",
    description="Vercel-friendly FastAPI entrypoint for the route optimizer backend.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlaceSuggestionOut(BaseModel):
    id: str
    label: str
    primary_text: str
    secondary_text: str
    lat: float
    lon: float
    country_code: Optional[str] = None
    state_code: Optional[str] = None


class FuelStopOut(BaseModel):
    id: str
    kind: str
    name: str
    subtitle: str
    lat: float
    lon: float
    distance_from_start_km: float
    fuel_price: float
    gallons_to_buy: float
    estimated_cost: float
    leg_distance_km: float


class RouteSummaryOut(BaseModel):
    distance_km: float
    duration_min: float
    fuel_type: str
    estimated_gallons: float
    estimated_fuel_cost: float
    average_fuel_price: float
    estimated_range_miles: float
    note: str


class RouteResponse(BaseModel):
    api_version: str = "v2"
    origin: PlaceSuggestionOut
    destination: PlaceSuggestionOut
    geometry: List[List[float]]
    bounds: List[List[float]]
    summary: RouteSummaryOut
    fuel_stops: List[FuelStopOut] = Field(default_factory=list)


def _place_to_model(place: PlaceCandidate) -> PlaceSuggestionOut:
    return PlaceSuggestionOut(
        id=place.place_id,
        label=place.label,
        primary_text=place.primary_text,
        secondary_text=place.secondary_text,
        lat=place.lat,
        lon=place.lon,
        country_code=place.country_code,
        state_code=place.state_code,
    )


def _resolve_place(
    query: Optional[str],
    lat: Optional[float],
    lon: Optional[float],
    label: Optional[str],
) -> PlaceCandidate:
    if lat is not None and lon is not None:
        fallback_label = label.strip() if label else f"{lat:.4f}, {lon:.4f}"
        try:
            nearby = reverse_geocode(lat, lon)
            return PlaceCandidate(
                place_id=nearby.place_id,
                label=fallback_label,
                primary_text=nearby.primary_text,
                secondary_text=nearby.secondary_text,
                lat=lat,
                lon=lon,
                country_code=nearby.country_code,
                country=nearby.country,
                state=nearby.state,
                state_code=nearby.state_code,
            )
        except Exception:
            return PlaceCandidate(
                place_id=fallback_label,
                label=fallback_label,
                primary_text=fallback_label.split(",")[0].strip(),
                secondary_text=label.strip() if label else "Selected destination",
                lat=lat,
                lon=lon,
            )

    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Both origin and destination are required.")

    try:
        return geocode_place(query)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _fuel_plan_to_stops(plan: FuelPlan) -> List[FuelStopOut]:
    return [
        FuelStopOut(
            id=stop.id,
            kind=stop.kind,
            name=stop.name,
            subtitle=stop.subtitle,
            lat=stop.lat,
            lon=stop.lon,
            distance_from_start_km=stop.distance_from_start_km,
            fuel_price=stop.fuel_price,
            gallons_to_buy=stop.gallons_to_buy,
            estimated_cost=stop.estimated_cost,
            leg_distance_km=stop.leg_distance_km,
        )
        for stop in plan.stops
    ]


@app.get("/")
def read_root():
    return {
        "service": "Fuel-Aware Route Optimizer",
        "docs": "/docs",
        "endpoints": [
            "/places/search",
            "/route",
        ],
    }


@app.get("/places/search", response_model=List[PlaceSuggestionOut])
def search_places_endpoint(
    q: str = Query(..., min_length=2),
    limit: int = Query(6, ge=1, le=8),
):
    try:
        places = search_places(q, limit=limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Place search is unavailable right now.",
        ) from exc

    return [_place_to_model(place) for place in places]


@app.get("/route", response_model=RouteResponse)
def get_route(
    origin_query: Optional[str] = Query(None),
    destination_query: Optional[str] = Query(None),
    origin_lat: Optional[float] = Query(None),
    origin_lon: Optional[float] = Query(None),
    destination_lat: Optional[float] = Query(None),
    destination_lon: Optional[float] = Query(None),
    origin_label: Optional[str] = Query(None),
    destination_label: Optional[str] = Query(None),
    fuel_type: str = Query("regular"),
):
    origin = _resolve_place(origin_query, origin_lat, origin_lon, origin_label)
    destination = _resolve_place(
        destination_query,
        destination_lat,
        destination_lon,
        destination_label,
    )

    if abs(origin.lat - destination.lat) < 1e-7 and abs(origin.lon - destination.lon) < 1e-7:
        raise HTTPException(status_code=400, detail="Choose two different destinations.")

    try:
        route = get_driving_route(origin.lon, origin.lat, destination.lon, destination.lat)
        fuel_plan = build_fuel_plan(route, origin, destination, fuel_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Route services are unavailable right now.",
        ) from exc

    return RouteResponse(
        origin=_place_to_model(origin),
        destination=_place_to_model(destination),
        geometry=route.geometry,
        bounds=route.bounds,
        summary=RouteSummaryOut(
            distance_km=round(route.distance_km, 1),
            duration_min=round(route.duration_min, 1),
            fuel_type=fuel_plan.summary.fuel_type,
            estimated_gallons=fuel_plan.summary.estimated_gallons,
            estimated_fuel_cost=fuel_plan.summary.estimated_cost,
            average_fuel_price=fuel_plan.summary.average_price,
            estimated_range_miles=fuel_plan.summary.route_range_miles,
            note=(
                f"{fuel_plan.summary.note} "
                f"{route.note or ''}"
            ).strip(),
        ),
        fuel_stops=_fuel_plan_to_stops(fuel_plan),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
