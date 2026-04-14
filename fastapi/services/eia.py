import urllib.request
import json
import time
import random
import os
from typing import Dict, Optional, Tuple

EIA_URL = (
    "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
    "?frequency=weekly&data[0]=value"
    "&sort[0][column]=period&sort[0][direction]=desc"
    "&offset=0&length=5000"
)

CACHE_TTL = 604800  # 7 days — EIA updates weekly

# city -> EIA state area code (kept for get_city_prices backward compat)
STATE_MAP = {
    "Phoenix, AZ":      "SAZ",
    "Tucson, AZ":       "SAZ",
    "Las Cruces, NM":   "SNM",
    "El Paso, TX":      "STX",
    "Midland, TX":      "STX",
    "San Angelo, TX":   "STX",
    "Abilene, TX":      "STX",
    "Fort Worth, TX":   "STX",
    "Dallas, TX":       "STX",
    "Tyler, TX":        "STX",
    "Houston, TX":      "STX",
    "San Antonio, TX":  "STX",
}

# EIA area codes for all 50 states (pattern is "S" + 2-letter abbreviation)
_STATE_TO_EIA = {
    "AL": "SAL", "AK": "SAK", "AZ": "SAZ", "AR": "SAR", "CA": "SCA",
    "CO": "SCO", "CT": "SCT", "DE": "SDE", "FL": "SFL", "GA": "SGA",
    "HI": "SHI", "ID": "SID", "IL": "SIL", "IN": "SIN", "IA": "SIA",
    "KS": "SKS", "KY": "SKY", "LA": "SLA", "ME": "SME", "MD": "SMD",
    "MA": "SMA", "MI": "SMI", "MN": "SMN", "MS": "SMS", "MO": "SMO",
    "MT": "SMT", "NE": "SNE", "NV": "SNV", "NH": "SNH", "NJ": "SNJ",
    "NM": "SNM", "NY": "SNY", "NC": "SNC", "ND": "SND", "OH": "SOH",
    "OK": "SOK", "OR": "SOR", "PA": "SPA", "RI": "SRI", "SC": "SSC",
    "SD": "SSD", "TN": "STN", "TX": "STX", "UT": "SUT", "VT": "SVT",
    "VA": "SVA", "WA": "SWA", "WV": "SWV", "WI": "SWI", "WY": "SWY",
}

_all_cache: Dict = {"data": None, "period": None, "ts": 0.0}

EIA_KEY = os.environ.get("EIAKEY", "")


def _get_key() -> str:
    global EIA_KEY
    if not EIA_KEY:
        EIA_KEY = os.environ.get("EIAKEY", "")
    return EIA_KEY


def _fetch_all_diesel_prices(api_key: str) -> Tuple[Dict[str, float], str]:
    now = time.time()
    if _all_cache["data"] is not None and (now - _all_cache["ts"]) < CACHE_TTL:
        return _all_cache["data"], _all_cache["period"]

    url = f"{EIA_URL}&api_key={api_key}"
    with urllib.request.urlopen(url, timeout=15) as resp:
        raw = json.loads(resp.read().decode())

    rows = raw.get("response", {}).get("data", [])
    state_prices: Dict[str, float] = {}
    period = ""

    for row in rows:
        area = row.get("duoarea", "")
        product = row.get("product", "")
        value = row.get("value")
        if "EPD2D" in product and value is not None and area not in state_prices:
            state_prices[area] = float(value)
            if not period:
                period = row.get("period", "")

    _all_cache["data"] = state_prices
    _all_cache["period"] = period
    _all_cache["ts"] = now
    return state_prices, period


def get_state_diesel_price(state_code: str) -> Optional[float]:
    api_key = _get_key()
    if not api_key or not state_code:
        return None
    try:
        eia_area = _STATE_TO_EIA.get(state_code.upper())
        if not eia_area:
            return None
        prices, _ = _fetch_all_diesel_prices(api_key)
        return prices.get(eia_area)
    except Exception as exc:
        print(f"[eia] state diesel lookup failed for {state_code}: {exc}")
        return None


def fetch_state_prices(api_key):
    now = time.time()
    if _all_cache["data"] is not None and (now - _all_cache["ts"]) < CACHE_TTL:
        legacy = {k: v for k, v in _all_cache["data"].items() if k in set(STATE_MAP.values())}
        return legacy, _all_cache["period"]

    prices, period = _fetch_all_diesel_prices(api_key)
    legacy = {k: v for k, v in prices.items() if k in set(STATE_MAP.values())}
    return legacy, period


def get_city_prices(api_key, seed=42):
    state_prices, period = fetch_state_prices(api_key)
    rng = random.Random(seed)

    city_prices = {}
    for city in sorted(STATE_MAP.keys()):
        base = state_prices.get(STATE_MAP[city], 3.50)
        offset = rng.uniform(-0.30, 0.30)
        city_prices[city] = round(base + offset, 2)

    return city_prices, state_prices, period
