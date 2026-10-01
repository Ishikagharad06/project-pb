"""
Smart Parking Dashboard (Flask)

Manual slot toggles update ParkBy in this order:
    Flask UI -> ParkBy API -> Neon PostgreSQL -> MongoDB -> website

Run (from the project root, with ParkBy already running on port 3000):
    pip install flask requests python-dotenv
    python scripts/smart_parking.py

Then open http://127.0.0.1:5000
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from threading import Lock, Thread

import requests
from flask import Flask, abort, jsonify, render_template_string

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(PROJECT_ROOT / ".env")

PARKBY_API_URL = os.environ.get("PARKBY_API_URL", "http://localhost:3000").rstrip("/")
HTTP_TIMEOUT_SEC = float(os.environ.get("PARKBY_HTTP_TIMEOUT_SEC", "15"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
lock = Lock()

# True = available, False = occupied
PARKINGS = {
    "X": {
        "name": "X Parking",
        "slots": {i: True for i in range(1, 11)},
    },
    "Y": {
        "name": "Y Parking",
        "slots": {i: True for i in range(1, 21)},
    },
}


class ParkBySyncError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def serialize():
    data = {}
    for pid, parking in PARKINGS.items():
        slots = [
            {
                "id": sid,
                "slot_number": f"{pid}{sid}",
                "available": available,
            }
            for sid, available in parking["slots"].items()
        ]
        total = len(slots)
        free = sum(1 for slot in slots if slot["available"])
        data[pid] = {
            "name": parking["name"],
            "unique_parking_id": f"{pid}_PARKING",
            "slots": slots,
            "total": total,
            "available": free,
            "occupied": total - free,
        }
    return data


def apply_remote_state(parkings_payload) -> None:
    if not isinstance(parkings_payload, dict):
        return

    for pid, parking in PARKINGS.items():
        lot = parkings_payload.get(pid)
        if not isinstance(lot, dict) or not isinstance(lot.get("slots"), list):
            continue
        for slot in lot["slots"]:
            sid = slot.get("id")
            if sid is None and isinstance(slot.get("slot_number"), str):
                raw = slot["slot_number"].upper()
                if raw.startswith(pid):
                    try:
                        sid = int(raw[1:])
                    except ValueError:
                        continue
            try:
                sid = int(sid)
            except (TypeError, ValueError):
                continue
            if sid in parking["slots"]:
                parking["slots"][sid] = bool(slot.get("available"))


def parkby_request(method: str, path: str, json_body=None):
    url = f"{PARKBY_API_URL}{path}"
    try:
        response = requests.request(
            method,
            url,
            json=json_body,
            timeout=HTTP_TIMEOUT_SEC,
        )
    except requests.RequestException as exc:
        raise ParkBySyncError(503, f"Could not reach ParkBy API at {url}: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        reason = payload.get("reason") if isinstance(payload, dict) else None
        raise ParkBySyncError(
            response.status_code,
            reason or f"ParkBy API returned HTTP {response.status_code}",
        )

    return payload


def hydrate_from_parkby(quiet: bool = False) -> None:
    payload = parkby_request("GET", "/api/smart-parking/state")
    with lock:
        apply_remote_state(payload.get("parkings"))
    if not quiet:
        logger.info("Loaded latest X/Y slot state from ParkBy (Neon)")


def refresh_loop() -> None:
    while True:
        try:
            time.sleep(5)
            hydrate_from_parkby(quiet=True)
        except Exception as exc:
            logger.debug("Periodic ParkBy refresh skipped: %s", exc)


def abort_from_sync_error(error: ParkBySyncError):
    logger.error("ParkBy sync failed: %s", error.message)
    abort(error.status_code, description=error.message)


@app.route("/api/parkings")
@app.route("/api/status")
def get_parkings():
    with lock:
        return jsonify(serialize())


@app.route("/api/parkings/<pid>/slots/<int:sid>/toggle", methods=["POST"])
def toggle_slot(pid, sid):
    pid = str(pid).upper()
    with lock:
        parking = PARKINGS.get(pid)
        if not parking or sid not in parking["slots"]:
            abort(404)
        next_available = not parking["slots"][sid]
        slot_key = f"{pid}{sid}"

    try:
        result = parkby_request(
            "POST",
            f"/api/smart-parking/slots/{slot_key}",
            {"available": next_available},
        )
    except ParkBySyncError as error:
        abort_from_sync_error(error)

    if not result.get("neon_updated") or not result.get("mongo_updated"):
        abort(
            502,
            description=(
                f"Incomplete sync for {slot_key}: "
                f"neon_updated={result.get('neon_updated')} "
                f"mongo_updated={result.get('mongo_updated')}"
            ),
        )

    with lock:
        apply_remote_state(result.get("parkings"))
        return jsonify(serialize())


@app.route("/api/parkings/<pid>/reset", methods=["POST"])
def reset_parking(pid):
    pid = str(pid).upper()
    with lock:
        if pid not in PARKINGS:
            abort(404)

    try:
        result = parkby_request(
            "POST",
            f"/api/smart-parking/parkings/{pid}/reset",
        )
    except ParkBySyncError as error:
        abort_from_sync_error(error)

    if not result.get("neon_updated") or not result.get("mongo_updated"):
        abort(502, description=f"Incomplete reset sync for parking {pid}")

    with lock:
        apply_remote_state(result.get("parkings"))
        return jsonify(serialize())


PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Smart Parking Dashboard</title>
<style>
  :root {
    --bg: #0f172a;
    --panel: #1e293b;
    --panel-2: #273449;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --green: #22c55e;
    --red: #ef4444;
    --accent: #38bdf8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    background: radial-gradient(circle at top, #1e293b 0%, var(--bg) 60%);
    color: var(--text);
    min-height: 100vh;
  }
  header {
    padding: 28px 32px 8px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  header h1 { margin: 0; font-size: 1.8rem; letter-spacing: .5px; }
  header h1 span { color: var(--accent); }
  .legend { display: flex; gap: 18px; color: var(--muted); font-size: .9rem; }
  .legend i {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
  }
  .summary {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px; padding: 16px 32px;
  }
  .stat {
    background: var(--panel); border-radius: 14px; padding: 16px 20px;
    border: 1px solid #334155;
  }
  .stat .label { color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: 1px; }
  .stat .value { font-size: 2rem; font-weight: 700; margin-top: 4px; }
  .stat.g .value { color: var(--green); }
  .stat.r .value { color: var(--red); }
  .lots {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 24px; padding: 8px 32px 40px;
  }
  @media (max-width: 500px) { .lots { grid-template-columns: 1fr; padding: 8px 14px 30px; } }
  .lot {
    background: var(--panel); border-radius: 18px; padding: 22px;
    border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .lot-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .lot-head h2 { margin: 0; font-size: 1.3rem; }
  .badge {
    padding: 4px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600;
    background: var(--panel-2); color: var(--muted);
  }
  .bar { height: 10px; background: var(--red); border-radius: 999px; overflow: hidden; margin-bottom: 8px; }
  .bar > div { height: 100%; background: var(--green); transition: width .4s ease; }
  .counts { display: flex; justify-content: space-between; color: var(--muted); font-size: .85rem; margin-bottom: 18px; }
  .counts b.g { color: var(--green); }
  .counts b.r { color: var(--red); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
  .slot {
    border-radius: 12px; padding: 12px 8px; text-align: center;
    border: 2px solid; transition: all .25s ease;
  }
  .slot.available { background: rgba(34,197,94,.12); border-color: var(--green); }
  .slot.occupied  { background: rgba(239,68,68,.14); border-color: var(--red); }
  .slot .num { font-weight: 700; font-size: 1rem; }
  .slot .icon { font-size: 1.5rem; margin: 4px 0; }
  .slot .state { font-size: .7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
  .slot.available .state { color: var(--green); }
  .slot.occupied .state  { color: var(--red); }
  .switch { position: relative; display: inline-block; width: 46px; height: 24px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .track {
    position: absolute; inset: 0; cursor: pointer; border-radius: 24px;
    background: var(--red); transition: .25s;
  }
  .track::before {
    content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px;
    background: #fff; border-radius: 50%; transition: .25s;
  }
  .switch input:checked + .track { background: var(--green); }
  .switch input:checked + .track::before { transform: translateX(22px); }
  .actions { margin-top: 18px; text-align: right; }
  button.reset {
    background: transparent; color: var(--muted); border: 1px solid #475569;
    padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: .8rem;
  }
  button.reset:hover { color: var(--text); border-color: var(--accent); }
  footer { text-align: center; color: var(--muted); padding: 0 0 24px; font-size: .8rem; }
</style>
</head>
<body>
  <header>
    <h1>🅿️ Smart <span>Parking</span> Dashboard</h1>
    <div class="legend">
      <div><i style="background:var(--green)"></i>Available</div>
      <div><i style="background:var(--red)"></i>Occupied</div>
    </div>
  </header>
  <section class="summary" id="summary"></section>
  <section class="lots" id="lots"></section>
  <footer>Toggles update Neon first, then MongoDB, then the ParkBy website.</footer>
<script>
async function api(url, method = "GET") {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}
function render(data) {
  const ids = Object.keys(data);
  let total = 0, free = 0, occ = 0;
  ids.forEach(id => { total += data[id].total; free += data[id].available; occ += data[id].occupied; });
  document.getElementById("summary").innerHTML = `
    <div class="stat"><div class="label">Total Slots</div><div class="value">${total}</div></div>
    <div class="stat g"><div class="label">Available</div><div class="value">${free}</div></div>
    <div class="stat r"><div class="label">Occupied</div><div class="value">${occ}</div></div>
    <div class="stat"><div class="label">Occupancy</div><div class="value">${total ? Math.round(occ / total * 100) : 0}%</div></div>
  `;
  document.getElementById("lots").innerHTML = ids.map(id => {
    const p = data[id];
    const pct = p.total ? (p.available / p.total * 100) : 0;
    const full = p.available === 0;
    return `
      <div class="lot">
        <div class="lot-head">
          <h2>${p.name}</h2>
          <span class="badge">${full ? "FULL" : p.available + " free"}</span>
        </div>
        <div class="bar"><div style="width:${pct}%"></div></div>
        <div class="counts">
          <span><b class="g">${p.available}</b> available</span>
          <span><b class="r">${p.occupied}</b> occupied</span>
          <span>${p.total} total</span>
        </div>
        <div class="grid">
          ${p.slots.map(s => `
            <div class="slot ${s.available ? "available" : "occupied"}">
              <div class="num">${s.slot_number || (id + s.id)}</div>
              <div class="icon">${s.available ? "✅" : "🚗"}</div>
              <div class="state">${s.available ? "Available" : "Occupied"}</div>
              <label class="switch">
                <input type="checkbox" ${s.available ? "checked" : ""}
                       onchange="toggle('${id}', ${s.id})">
                <span class="track"></span>
              </label>
            </div>`).join("")}
        </div>
        <div class="actions">
          <button class="reset" onclick="resetLot('${id}')">Mark all available</button>
        </div>
      </div>`;
  }).join("");
}
async function toggle(pid, sid) {
  try { render(await api(`/api/parkings/${pid}/slots/${sid}/toggle`, "POST")); }
  catch (e) { alert("Could not update slot in Neon/MongoDB."); load(); }
}
async function resetLot(pid) {
  try { render(await api(`/api/parkings/${pid}/reset`, "POST")); }
  catch (e) { alert("Could not reset parking."); load(); }
}
async function load() { render(await api("/api/parkings")); }
load();
setInterval(load, 5000);
</script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(PAGE)


if __name__ == "__main__":
    try:
        hydrate_from_parkby()
    except ParkBySyncError as error:
        logger.warning(
            "ParkBy is not reachable yet (%s). Using local defaults until the API is up.",
            error.message,
        )
    except Exception as exc:
        logger.warning("Could not hydrate from ParkBy: %s", exc)

    logger.info("ParkBy API: %s", PARKBY_API_URL)
    Thread(target=refresh_loop, daemon=True).start()
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PARKING_FLASK_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1",
        use_reloader=False,
    )
