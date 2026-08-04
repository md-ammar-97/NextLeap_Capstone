"""SQLite event log — docs/datamodel.md section 7. Ephemeral on Render's
free disk across deploys; acceptable by design (see README)."""
import json
import os
import sqlite3
from statistics import median

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "events.db")


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            type TEXT NOT NULL,
            payload TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)")
    return conn


def append_events(events: list[dict]) -> None:
    conn = _connect()
    try:
        conn.executemany(
            "INSERT INTO events (session_id, ts, type, payload) VALUES (?, ?, ?, ?)",
            [(e["session_id"], e["ts"], e["type"], json.dumps(e.get("payload", {}))) for e in events],
        )
        conn.commit()
    finally:
        conn.close()


def funnel_for_session(session_id: str) -> dict:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT type, payload FROM events WHERE session_id = ?", (session_id,)
        ).fetchall()
    finally:
        conn.close()

    counts: dict[str, int] = {}
    latencies: list[float] = []
    new_category_skus: set[str] = set()

    for type_, payload_raw in rows:
        counts[type_] = counts.get(type_, 0) + 1
        payload = json.loads(payload_raw) if payload_raw else {}
        if type_ == "copilot_latency" and not payload.get("failed") and "latency_ms" in payload:
            latencies.append(payload["latency_ms"])
        if type_ == "suggestion_added" and payload.get("is_new_category"):
            sku_id = payload.get("sku_id")
            if sku_id:
                new_category_skus.add(sku_id)

    p95_latency = None
    if latencies:
        sorted_lat = sorted(latencies)
        idx = min(len(sorted_lat) - 1, int(round(0.95 * (len(sorted_lat) - 1))))
        p95_latency = sorted_lat[idx]

    return {
        "session_id": session_id,
        "counts": counts,
        "latency_p95_ms": p95_latency,
        "new_category_added": len(new_category_skus),
    }
