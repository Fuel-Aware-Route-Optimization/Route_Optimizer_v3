import urllib.request
import json
import time
import random


EIA_URL = (
    "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
    "?frequency=weekly&data[0]=value"
    "&sort[0][column]=period&sort[0][direction]=desc"
    "&offset=0&length=5000"
)

CACHE_TTL = 86400  # 24 hours

# city -> EIA state area code
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

_cache = {"data": None, "period": None, "ts": 0}


def fetch_state_prices(api_key):
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["data"], _cache["period"]

    url = f"{EIA_URL}&api_key={api_key}"
    with urllib.request.urlopen(url, timeout=15) as resp:
        raw = json.loads(resp.read().decode())

    rows = raw.get("response", {}).get("data", [])
    states_needed = set(STATE_MAP.values())
    state_prices = {}
    period = None

    for row in rows:
        area = row.get("duoarea", "")
        product = row.get("product", "")
        value = row.get("value")
        if area in states_needed and "EPD2D" in product and value is not None:
            if area not in state_prices:
                state_prices[area] = float(value)
                if period is None:
                    period = row.get("period", "")

    _cache["data"] = state_prices
    _cache["period"] = period
    _cache["ts"] = now
    return state_prices, period


def get_city_prices(api_key, seed=42):
    state_prices, period = fetch_state_prices(api_key)
    rng = random.Random(seed)

    city_prices = {}
    for city in sorted(STATE_MAP.keys()):
        base = state_prices.get(STATE_MAP[city], 3.50)
        offset = rng.uniform(-0.30, 0.30)
        city_prices[city] = round(base + offset, 2)

    return city_prices, state_prices, period
