from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode
import json
import urllib.request

USER_AGENT = "RouteOptimizerV3/1.0 (local demo app)"
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"

US_STATE_ABBREVIATIONS = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
}


@dataclass(frozen=True)
class PlaceCandidate:
    place_id: str
    label: str
    primary_text: str
    secondary_text: str
    lat: float
    lon: float
    country_code: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None


_search_cache: Dict[Tuple[str, int], List[PlaceCandidate]] = {}
_reverse_cache: Dict[str, PlaceCandidate] = {}


def _request_json(url: str) -> object:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _compact(parts: List[Optional[str]]) -> List[str]:
    return [part.strip() for part in parts if part and part.strip()]


def _pick_primary_name(address: Dict[str, str], fallback: str) -> str:
    for key in (
        "city",
        "town",
        "village",
        "municipality",
        "county",
        "state_district",
        "state",
        "country",
    ):
        value = address.get(key)
        if value:
            return value
    return fallback


def _state_code_from_name(state: Optional[str], raw_code: Optional[str]) -> Optional[str]:
    if raw_code:
        return raw_code.upper()
    if not state:
        return None
    if len(state) == 2 and state.isalpha():
        return state.upper()
    return US_STATE_ABBREVIATIONS.get(state)


def _place_from_row(row: Dict[str, object]) -> PlaceCandidate:
    address = row.get("address", {}) if isinstance(row.get("address"), dict) else {}
    display_name = str(row.get("display_name") or "").strip()
    primary = _pick_primary_name(address, display_name.split(",")[0] if display_name else "Unknown place")

    state = str(address.get("state") or address.get("region") or "").strip() or None
    state_code = _state_code_from_name(state, address.get("ISO3166-2-lvl4"))
    if state_code and "-" in state_code:
        state_code = state_code.split("-")[-1]

    secondary_parts = _compact(
        [
            address.get("state") or address.get("region"),
            address.get("country"),
        ]
    )
    secondary = " • ".join(secondary_parts) if secondary_parts else display_name

    return PlaceCandidate(
        place_id=str(row.get("place_id") or display_name or primary),
        label=display_name or primary,
        primary_text=primary,
        secondary_text=secondary,
        lat=float(row["lat"]),
        lon=float(row["lon"]),
        country_code=str(address.get("country_code") or "").upper() or None,
        country=str(address.get("country") or "").strip() or None,
        state=state,
        state_code=state_code,
    )


def search_places(query: str, limit: int = 6) -> List[PlaceCandidate]:
    normalized = query.strip()
    if len(normalized) < 2:
        return []

    cache_key = (normalized.casefold(), limit)
    if cache_key in _search_cache:
        return _search_cache[cache_key]

    params = urlencode(
        {
            "q": normalized,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": limit,
            "dedupe": 1,
            "accept-language": "en",
        }
    )
    raw = _request_json(f"{NOMINATIM_BASE}/search?{params}")
    rows = raw if isinstance(raw, list) else []
    results = [_place_from_row(row) for row in rows if isinstance(row, dict)]
    _search_cache[cache_key] = results
    return results


def geocode_place(query: str) -> PlaceCandidate:
    results = search_places(query, limit=1)
    if not results:
        raise ValueError(f'No place match found for "{query}".')
    return results[0]


def reverse_geocode(lat: float, lon: float) -> PlaceCandidate:
    cache_key = f"{lat:.4f},{lon:.4f}"
    if cache_key in _reverse_cache:
        return _reverse_cache[cache_key]

    params = urlencode(
        {
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
            "accept-language": "en",
        }
    )
    raw = _request_json(f"{NOMINATIM_BASE}/reverse?{params}")
    if not isinstance(raw, dict):
        raise ValueError("Reverse geocoding failed.")

    place = _place_from_row(raw)
    _reverse_cache[cache_key] = place
    return place
