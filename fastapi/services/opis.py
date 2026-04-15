import os
import time
import urllib.request
import xml.etree.ElementTree as ET
from typing import Optional

OPIS_ENDPOINT = "https://services.opisnet.com/RealtimePriceService/RealtimePriceService.asmx"
OPIS_NS = "https://services.opisnet.com/RealtimePriceService/"

TICKET_TTL = 82800
PRICE_CACHE_TTL = 3600

_DIESEL_FIELDS = ("Diesel_Price", "Diesel", "Dsl", "DieselPrice", "No2Diesel", "DSL")

_ticket_cache: dict = {"ticket": None, "ts": 0.0}
_price_cache: dict = {}

OPIS_KEY = os.environ.get("OPIS_KEY", "")


def _get_key() -> str:
    global OPIS_KEY
    if not OPIS_KEY:
        OPIS_KEY = os.environ.get("OPIS_KEY", "")
    return OPIS_KEY


def _soap_call(action: str, body_xml: str) -> ET.Element:
    envelope = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" '
        f'xmlns:tns="{OPIS_NS}">'
        "<soap:Body>"
        f"{body_xml}"
        "</soap:Body>"
        "</soap:Envelope>"
    )
    data = envelope.encode("utf-8")
    req = urllib.request.Request(
        OPIS_ENDPOINT,
        data=data,
        headers={
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": f'"{OPIS_NS}{action}"',
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return ET.fromstring(resp.read())


def _authenticate(api_key: str) -> str:
    now = time.time()
    if _ticket_cache["ticket"] and (now - _ticket_cache["ts"]) < TICKET_TTL:
        return _ticket_cache["ticket"]

    body = (
        "<tns:Authenticate>"
        f"<tns:CustomerToken>{api_key}</tns:CustomerToken>"
        "</tns:Authenticate>"
    )
    root = _soap_call("Authenticate", body)
    ticket = root.findtext(f".//{{{OPIS_NS}}}AuthenticateResult") or ""
    ticket = ticket.strip()

    _ticket_cache["ticket"] = ticket
    _ticket_cache["ts"] = now
    return ticket


def _extract_diesel_price(root: ET.Element) -> Optional[float]:
    for elem in root.iter():
        for field in _DIESEL_FIELDS:
            child = elem.find(field)
            if child is not None and child.text:
                try:
                    val = float(child.text)
                    if val > 0:
                        return val
                except ValueError:
                    pass
    return None


def get_diesel_price(lat: float, lon: float) -> Optional[float]:
    api_key = _get_key()
    if not api_key:
        return None

    cache_key = f"{lat:.2f},{lon:.2f}"
    now = time.time()
    cached = _price_cache.get(cache_key)
    if cached and (now - cached["ts"]) < PRICE_CACHE_TTL:
        return cached["price"]

    try:
        ticket = _authenticate(api_key)
        if not ticket:
            return None

        body = (
            "<tns:GetLatLongResults>"
            f"<tns:UserTicket>{ticket}</tns:UserTicket>"
            f"<tns:Latitude>{lat}</tns:Latitude>"
            f"<tns:Longitude>{lon}</tns:Longitude>"
            "</tns:GetLatLongResults>"
        )
        root = _soap_call("GetLatLongResults", body)
        price = _extract_diesel_price(root)
        _price_cache[cache_key] = {"price": price, "ts": now}
        return price
    except Exception as exc:
        print(f"[opis] price lookup failed for ({lat:.4f},{lon:.4f}): {exc}")
        return None
