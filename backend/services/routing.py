from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence
from urllib.parse import urlencode
import json
import math
import urllib.request

from services.tomtom import get_route_distance_km, get_route_geometry

USER_AGENT = "RouteOptimizerV3/1.0 (local demo app)"
OSRM_BASE = "https://router.project-osrm.org"


@dataclass(frozen=True)
class RouteResult:
    geometry: List[List[float]]
    distance_km: float
    duration_min: float
    bounds: List[List[float]]
    source: str
    note: str | None = None


@dataclass(frozen=True)
class RouteSamplePoint:
    lat: float
    lon: float
    distance_from_start_km: float


def _request_json(url: str) -> object:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _polyline_bounds(geometry: Sequence[Sequence[float]]) -> List[List[float]]:
    lons = [point[0] for point in geometry]
    lats = [point[1] for point in geometry]
    return [[min(lats), min(lons)], [max(lats), max(lons)]]


def _interpolate_geometry(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
    steps: int = 24,
) -> List[List[float]]:
    return [
        [
            start_lon + (end_lon - start_lon) * index / steps,
            start_lat + (end_lat - start_lat) * index / steps,
        ]
        for index in range(steps + 1)
    ]


def _estimated_drive_time_min(distance_km: float, avg_speed_kmh: float = 88.0) -> float:
    if distance_km <= 0:
        return 0.0
    return distance_km / avg_speed_kmh * 60.0


def _osrm_route(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> RouteResult:
    coords = f"{start_lon:.6f},{start_lat:.6f};{end_lon:.6f},{end_lat:.6f}"
    params = urlencode(
        {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "false",
            "steps": "false",
        }
    )
    raw = _request_json(f"{OSRM_BASE}/route/v1/driving/{coords}?{params}")
    if not isinstance(raw, dict) or raw.get("code") != "Ok":
        raise ValueError("OSRM could not build a driving route.")

    routes = raw.get("routes")
    if not isinstance(routes, list) or not routes:
        raise ValueError("OSRM returned no routes.")

    route = routes[0]
    geometry = route.get("geometry", {}).get("coordinates", [])
    if not geometry:
        raise ValueError("OSRM returned empty route geometry.")

    coords_out = [[float(lon), float(lat)] for lon, lat in geometry]
    return RouteResult(
        geometry=coords_out,
        distance_km=float(route.get("distance", 0.0)) / 1000.0,
        duration_min=float(route.get("duration", 0.0)) / 60.0,
        bounds=_polyline_bounds(coords_out),
        source="osrm",
    )


def _tomtom_route(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> RouteResult:
    geometry = get_route_geometry(start_lon, start_lat, end_lon, end_lat)
    if not geometry:
        raise ValueError("TomTom returned no route geometry.")

    distance_km = get_route_distance_km(start_lon, start_lat, end_lon, end_lat)
    if distance_km is None or distance_km <= 0:
        distance_km = _haversine_km(start_lat, start_lon, end_lat, end_lon) * 1.18

    return RouteResult(
        geometry=geometry,
        distance_km=distance_km,
        duration_min=_estimated_drive_time_min(distance_km),
        bounds=_polyline_bounds(geometry),
        source="tomtom",
    )


def _fallback_route(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> RouteResult:
    geometry = _interpolate_geometry(start_lon, start_lat, end_lon, end_lat)
    distance_km = _haversine_km(start_lat, start_lon, end_lat, end_lon) * 1.23
    return RouteResult(
        geometry=geometry,
        distance_km=distance_km,
        duration_min=_estimated_drive_time_min(distance_km),
        bounds=_polyline_bounds(geometry),
        source="fallback",
        note="Live routing was unavailable, so this route is an approximate drive estimate.",
    )


def get_driving_route(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> RouteResult:
    errors: List[str] = []

    for builder in (_osrm_route, _tomtom_route):
        try:
            return builder(start_lon, start_lat, end_lon, end_lat)
        except Exception as exc:
            errors.append(str(exc))

    fallback = _fallback_route(start_lon, start_lat, end_lon, end_lat)
    if errors:
        fallback = RouteResult(
            geometry=fallback.geometry,
            distance_km=fallback.distance_km,
            duration_min=fallback.duration_min,
            bounds=fallback.bounds,
            source=fallback.source,
            note=f"{fallback.note} Providers failed: {'; '.join(errors[:2])}",
        )
    return fallback


def sample_route_points(
    geometry: Sequence[Sequence[float]],
    count: int,
) -> List[RouteSamplePoint]:
    if count <= 0 or len(geometry) < 2:
        return []

    cumulative = [0.0]
    for index in range(1, len(geometry)):
        prev_lon, prev_lat = geometry[index - 1]
        lon, lat = geometry[index]
        cumulative.append(
            cumulative[-1] + _haversine_km(prev_lat, prev_lon, lat, lon)
        )

    total_distance = cumulative[-1]
    if total_distance <= 0:
        return []

    samples: List[RouteSamplePoint] = []
    for sample_index in range(1, count + 1):
        target = total_distance * sample_index / (count + 1)
        for index in range(1, len(cumulative)):
            if cumulative[index] < target:
                continue

            prev_total = cumulative[index - 1]
            segment = cumulative[index] - prev_total
            ratio = 0.0 if segment <= 0 else (target - prev_total) / segment
            prev_lon, prev_lat = geometry[index - 1]
            lon, lat = geometry[index]
            interp_lon = prev_lon + (lon - prev_lon) * ratio
            interp_lat = prev_lat + (lat - prev_lat) * ratio
            samples.append(
                RouteSamplePoint(
                    lat=interp_lat,
                    lon=interp_lon,
                    distance_from_start_km=target,
                )
            )
            break

    return samples
