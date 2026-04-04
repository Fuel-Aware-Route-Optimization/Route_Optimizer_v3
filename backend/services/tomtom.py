"""
tomtom routing service
hits the tomtom routing api to get real road geometry between two coords
"""

import os
import urllib.request
import json
from typing import List, Optional

TOMTOM_KEY = os.environ.get("TOMTOM_KEY", "")

# cache so we dont spam the api for the same pair twice in one session
_cache: dict[str, Optional[List[List[float]]]] = {}


def _get_key() -> str:
    """read key lazily so dotenv has time to load"""
    global TOMTOM_KEY
    if not TOMTOM_KEY:
        TOMTOM_KEY = os.environ.get("TOMTOM_KEY", "")
    return TOMTOM_KEY


def get_route_geometry(
    lon1: float, lat1: float, lon2: float, lat2: float
) -> Optional[List[List[float]]]:
    """
    get road geometry from tomtom routing api
    returns list of [lon, lat] pairs or None if it fails
    """
    key = _get_key()
    if not key:
        return None

    cache_key = f"{lon1:.4f},{lat1:.4f}>{lon2:.4f},{lat2:.4f}"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        # tomtom calculate route endpoint
        base = "https://api.tomtom.com/routing/1/calculateRoute"
        coords = f"{lat1},{lon1}:{lat2},{lon2}"
        url = (
            f"{base}/{coords}/json"
            f"?key={key}"
            f"&routeType=fastest"
            f"&traffic=false"
            f"&travelMode=truck"
        )

        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        route = data.get("routes", [{}])[0]
        legs = route.get("legs", [])

        # pull all the points from every leg
        points: List[List[float]] = []
        for leg in legs:
            for pt in leg.get("points", []):
                points.append([pt["longitude"], pt["latitude"]])

        if points:
            _cache[cache_key] = points
            return points

    except Exception as e:
        print(f"[tomtom] routing failed: {e}")

    _cache[cache_key] = None
    return None


def get_route_distance_km(
    lon1: float, lat1: float, lon2: float, lat2: float
) -> Optional[float]:
    """
    get driving distance in km between two points via tomtom
    """
    key = _get_key()
    if not key:
        return None

    try:
        base = "https://api.tomtom.com/routing/1/calculateRoute"
        coords = f"{lat1},{lon1}:{lat2},{lon2}"
        url = (
            f"{base}/{coords}/json"
            f"?key={key}"
            f"&routeType=fastest"
            f"&traffic=false"
            f"&travelMode=truck"
        )

        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        route = data.get("routes", [{}])[0]
        summary = route.get("summary", {})
        meters = summary.get("lengthInMeters", 0)
        return meters / 1000.0 if meters else None

    except Exception as e:
        print(f"[tomtom] distance failed: {e}")

    return None
