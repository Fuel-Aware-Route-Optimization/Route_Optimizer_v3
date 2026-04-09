from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Dict, List

from services.places import PlaceCandidate, reverse_geocode
from services.routing import RouteResult, sample_route_points

KM_TO_MILES = 0.621371
DEFAULT_US_PRICE = 3.64
DEFAULT_WORLD_PRICE = 4.48
TANK_CAPACITY_GALLONS = 16.0
USABLE_RANGE_RATIO = 0.72

US_REGULAR_PRICE_BY_STATE: Dict[str, float] = {
    "AL": 3.23,
    "AK": 4.08,
    "AZ": 3.67,
    "AR": 3.11,
    "CA": 4.89,
    "CO": 3.31,
    "CT": 3.52,
    "DC": 3.74,
    "DE": 3.29,
    "FL": 3.36,
    "GA": 3.27,
    "HI": 4.74,
    "IA": 3.19,
    "ID": 3.58,
    "IL": 3.91,
    "IN": 3.34,
    "KS": 3.18,
    "KY": 3.19,
    "LA": 3.15,
    "MA": 3.44,
    "MD": 3.39,
    "ME": 3.58,
    "MI": 3.49,
    "MN": 3.34,
    "MO": 3.06,
    "MS": 3.04,
    "MT": 3.43,
    "NC": 3.22,
    "ND": 3.28,
    "NE": 3.24,
    "NH": 3.42,
    "NJ": 3.33,
    "NM": 3.18,
    "NV": 4.06,
    "NY": 3.57,
    "OH": 3.25,
    "OK": 3.04,
    "OR": 4.21,
    "PA": 3.62,
    "RI": 3.47,
    "SC": 3.12,
    "SD": 3.23,
    "TN": 3.14,
    "TX": 3.11,
    "UT": 3.49,
    "VA": 3.19,
    "VT": 3.59,
    "WA": 4.62,
    "WI": 3.31,
    "WV": 3.36,
    "WY": 3.27,
}

COUNTRY_PRICE_FACTORS = {
    "US": 1.00,
    "CA": 1.28,
    "MX": 1.08,
    "GB": 1.73,
    "FR": 1.70,
    "DE": 1.68,
    "ES": 1.57,
    "IT": 1.74,
    "AU": 1.31,
}

FUEL_TYPE_UPCHARGE = {
    "regular": 0.0,
    "premium": 0.54,
    "diesel": 0.31,
}

MPG_BY_FUEL_TYPE = {
    "regular": 27.0,
    "premium": 26.0,
    "diesel": 30.0,
}


@dataclass(frozen=True)
class FuelPlanStop:
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


@dataclass(frozen=True)
class FuelPlanSummary:
    fuel_type: str
    estimated_gallons: float
    estimated_cost: float
    average_price: float
    route_range_miles: float
    note: str


@dataclass(frozen=True)
class FuelPlan:
    stops: List[FuelPlanStop]
    summary: FuelPlanSummary


def _normalize_fuel_type(fuel_type: str) -> str:
    normalized = fuel_type.strip().lower()
    return normalized if normalized in MPG_BY_FUEL_TYPE else "regular"


def price_for_place(place: PlaceCandidate, fuel_type: str) -> float:
    normalized = _normalize_fuel_type(fuel_type)
    base_price = DEFAULT_WORLD_PRICE

    country_code = (place.country_code or "").upper()
    if country_code == "US":
        base_price = US_REGULAR_PRICE_BY_STATE.get(place.state_code or "", DEFAULT_US_PRICE)
    elif country_code:
        base_price = DEFAULT_US_PRICE * COUNTRY_PRICE_FACTORS.get(country_code, 1.23)

    return round(base_price + FUEL_TYPE_UPCHARGE[normalized], 2)


def build_fuel_plan(
    route: RouteResult,
    origin: PlaceCandidate,
    destination: PlaceCandidate,
    fuel_type: str,
) -> FuelPlan:
    normalized = _normalize_fuel_type(fuel_type)
    mpg = MPG_BY_FUEL_TYPE[normalized]
    distance_miles = route.distance_km * KM_TO_MILES
    estimated_gallons = distance_miles / mpg if mpg > 0 else 0.0
    usable_range = mpg * TANK_CAPACITY_GALLONS * USABLE_RANGE_RATIO
    stop_count = max(0, ceil(distance_miles / usable_range) - 1) if usable_range > 0 else 0

    sample_points = sample_route_points(route.geometry, stop_count)
    checkpoints = [origin]
    for point in sample_points:
        try:
            nearby = reverse_geocode(point.lat, point.lon)
        except Exception:
            nearby = PlaceCandidate(
                place_id=f"fuel-{point.distance_from_start_km:.1f}",
                label=f"Route point {point.distance_from_start_km:.0f} km",
                primary_text="Route midpoint",
                secondary_text="Approximate stop area",
                lat=point.lat,
                lon=point.lon,
                country_code=origin.country_code or destination.country_code,
                country=origin.country or destination.country,
                state=origin.state or destination.state,
                state_code=origin.state_code or destination.state_code,
            )
        checkpoints.append(
            PlaceCandidate(
                place_id=f"fuel-{point.distance_from_start_km:.1f}",
                label=nearby.label,
                primary_text=nearby.primary_text,
                secondary_text=nearby.secondary_text,
                lat=point.lat,
                lon=point.lon,
                country_code=nearby.country_code,
                country=nearby.country,
                state=nearby.state,
                state_code=nearby.state_code,
            )
        )
    checkpoints.append(destination)

    plan_stops: List[FuelPlanStop] = []
    total_cost = 0.0
    total_gallons = 0.0

    checkpoint_distances = [0.0]
    checkpoint_distances.extend(point.distance_from_start_km for point in sample_points)
    checkpoint_distances.append(route.distance_km)

    for index in range(len(checkpoints) - 1):
        current = checkpoints[index]
        leg_distance_km = checkpoint_distances[index + 1] - checkpoint_distances[index]
        gallons = (leg_distance_km * KM_TO_MILES) / mpg if mpg > 0 else 0.0
        price = price_for_place(current, normalized)
        cost = gallons * price
        total_cost += cost
        total_gallons += gallons

        is_origin = index == 0
        plan_stops.append(
            FuelPlanStop(
                id=f"{'start' if is_origin else 'stop'}-{index}",
                kind="origin" if is_origin else "stop",
                name=(
                    f"Top off in {current.primary_text}"
                    if is_origin
                    else f"Fuel stop near {current.primary_text}"
                ),
                subtitle=current.secondary_text or current.label,
                lat=current.lat,
                lon=current.lon,
                distance_from_start_km=checkpoint_distances[index],
                fuel_price=round(price, 2),
                gallons_to_buy=round(gallons, 2),
                estimated_cost=round(cost, 2),
                leg_distance_km=round(leg_distance_km, 1),
            )
        )

    average_price = (total_cost / total_gallons) if total_gallons > 0 else price_for_place(origin, normalized)
    note = (
        "Fuel costs are estimated from regional averages and route-spaced refuel stops."
    )

    return FuelPlan(
        stops=plan_stops,
        summary=FuelPlanSummary(
            fuel_type=normalized,
            estimated_gallons=round(estimated_gallons, 2),
            estimated_cost=round(total_cost, 2),
            average_price=round(average_price, 2),
            route_range_miles=round(usable_range, 1),
            note=note,
        ),
    )
