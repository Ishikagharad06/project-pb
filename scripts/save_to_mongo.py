"""
Poll the local smart-parking Flask API and push occupancy into ParkBy.

Order of writes (same as the website path):
    Flask snapshot -> ParkBy /api/smart-parking/sync -> Neon -> MongoDB upsert

This keeps one document per lot (X_PARKING / Y_PARKING) and one document
per slot (X1-X10, Y1-Y20) instead of inserting duplicates.

Run alongside the Flask dashboard:
    pip install requests python-dotenv pymongo certifi
    python scripts/save_to_mongo.py
"""

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

import requests
from pymongo import MongoClient

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(PROJECT_ROOT / ".env")

PARKBY_API_URL = os.environ.get("PARKBY_API_URL", "http://localhost:3000").rstrip("/")
STATUS_URL = os.environ.get("STATUS_URL", "http://localhost:5000/api/parkings")
POLL_INTERVAL_SEC = float(os.environ.get("POLL_INTERVAL_SEC", "2.0"))
HTTP_TIMEOUT_SEC = float(os.environ.get("HTTP_TIMEOUT_SEC", "8"))
MONGO_URI = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or ""
DB_NAME = os.environ.get("MONGODB_DB_NAME", "parkby")
STATUS_COLLECTION = "parking_status"
SLOT_COLLECTION = "parking_slots"
MONGO_SERVER_SELECTION_MS = 15000

PARKING_META = {
    "NH": {
        "name": "Nandanvan House",
        "unique_parking_id": "NH_PARKING",
        "slot_count": 15,
    },
    "X": {
        "name": "X Parking",
        "unique_parking_id": "X_PARKING",
        "slot_count": 10,
    },
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def connect_mongo():
    if not MONGO_URI:
        raise RuntimeError("MONGODB_URI is missing. Set it in the project .env file.")

    try:
        import certifi

        tls_kwargs = {"tlsCAFile": certifi.where()}
    except Exception:
        tls_kwargs = {}

    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_MS,
        connectTimeoutMS=15000,
        socketTimeoutMS=15000,
        retryWrites=True,
        **tls_kwargs,
    )
    client.admin.command("ping")
    logger.info("MongoDB connected (db=%s)", DB_NAME)
    return client


def normalize_snapshot(data: dict) -> dict:
    if not isinstance(data, dict):
        raise ValueError("Invalid JSON response from Flask")

    snapshot = {}
    for pid, meta in PARKING_META.items():
        lot = data.get(pid)
        if not isinstance(lot, dict) or not isinstance(lot.get("slots"), list):
            raise ValueError(f"Missing parking location {pid} in Flask snapshot")

        slots = []
        seen = set()
        for slot in lot["slots"]:
            sid = slot.get("id")
            slot_number = slot.get("slot_number") or f"{pid}{sid}"
            slot_number = str(slot_number).upper()
            if slot_number in seen:
                logger.warning("Skipping duplicate slot %s in Flask snapshot", slot_number)
                continue
            seen.add(slot_number)
            slots.append(
                {
                    "id": sid,
                    "slot_number": slot_number,
                    "available": bool(slot.get("available")),
                }
            )

        if len(slots) != meta["slot_count"]:
            logger.warning(
                "%s expected %s slots, Flask sent %s",
                meta["name"],
                meta["slot_count"],
                len(slots),
            )

        snapshot[pid] = {
            "name": meta["name"],
            "unique_parking_id": meta["unique_parking_id"],
            "slots": slots,
            "total": meta["slot_count"],
            "available": sum(1 for slot in slots if slot["available"]),
            "occupied": meta["slot_count"] - sum(1 for slot in slots if slot["available"]),
        }
    return snapshot


def sync_via_parkby(session: requests.Session, snapshot: dict) -> dict:
    url = f"{PARKBY_API_URL}/api/smart-parking/sync"
    try:
        response = session.post(url, json=snapshot, timeout=HTTP_TIMEOUT_SEC)
    except requests.RequestException as exc:
        raise RuntimeError(f"ParkBy/Neon sync failed: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        reason = payload.get("reason") if isinstance(payload, dict) else response.text
        raise RuntimeError(f"ParkBy/Neon sync failed: {reason}")

    if not payload.get("neon_updated") or not payload.get("mongo_updated"):
        raise RuntimeError(
            "ParkBy did not confirm both Neon and MongoDB updates "
            f"(neon_updated={payload.get('neon_updated')}, "
            f"mongo_updated={payload.get('mongo_updated')})"
        )

    return payload


def verify_mongo(collection_status) -> None:
    count = collection_status.count_documents(
        {"unique_parking_id": {"$in": ["NH_PARKING", "X_PARKING"]}}
    )
    if count < 2:
        raise RuntimeError(
            f"MongoDB verification failed: expected 2 lot documents, found {count}"
        )


def fetch_and_upsert(session: requests.Session, collection_status) -> None:
    try:
        response = session.get(STATUS_URL, timeout=HTTP_TIMEOUT_SEC)
        response.raise_for_status()
        snapshot = normalize_snapshot(response.json())
        sync_via_parkby(session, snapshot)
        verify_mongo(collection_status)
        logger.info(
            "Synced NH=%s free / X=%s free",
            snapshot["NH"]["available"],
            snapshot["X"]["available"],
        )
    except Exception as exc:
        logger.error("Sync error: %s", exc)


def main() -> None:
    try:
        client = connect_mongo()
    except Exception as exc:
        logger.exception("Failed to connect to MongoDB: %s", exc)
        sys.exit(1)

    db = client[DB_NAME]
    collection_status = db[STATUS_COLLECTION]
    collection_slots = db[SLOT_COLLECTION]
    collection_status.create_index("unique_parking_id", unique=True)
    collection_slots.create_index("slot_key", unique=True)

    logger.info(
        "Polling %s every %ss then Neon+Mongo via %s",
        STATUS_URL,
        POLL_INTERVAL_SEC,
        PARKBY_API_URL,
    )

    session = requests.Session()
    try:
        while True:
            fetch_and_upsert(session, collection_status)
            time.sleep(POLL_INTERVAL_SEC)
    except KeyboardInterrupt:
        logger.info("Stopped by user.")
    finally:
        session.close()
        client.close()


if __name__ == "__main__":
    main()
