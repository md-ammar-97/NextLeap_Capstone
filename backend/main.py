import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

import catalog as catalog_module
import events as events_module
from copilot import get_copilot_response
from models import CopilotRequest, Event, OrderRequest

app = FastAPI(title="Mission Completion Copilot API")

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DEBUG_COPILOT = os.environ.get("DEBUG_COPILOT") == "1"


@app.get("/health")
def health():
    return {"status": "ok", "skus": len(catalog_module.SKUS)}


@app.post("/copilot")
def copilot(req: CopilotRequest, response: Response):
    result, meta = get_copilot_response(req)
    if result is None:
        response.status_code = 204
        return None
    return result


@app.post("/copilot/debug")
def copilot_debug(req: CopilotRequest):
    """Fix 5 (docs/improve.md): same body as /copilot, but returns the full
    scored candidate slice, raw model output, per-pick drop reasons, the
    final response (or None), and a named silence_reason — every silence
    has a cause, not a guess. Gated behind DEBUG_COPILOT=1; 404s otherwise
    so this never becomes an unintentional production surface."""
    if not DEBUG_COPILOT:
        raise HTTPException(status_code=404, detail="Not found")
    _, meta = get_copilot_response(req, debug=True)
    return meta


@app.post("/events")
def post_events(payload: Event | list[Event]):
    events = payload if isinstance(payload, list) else [payload]
    events_module.append_events([e.model_dump() for e in events])
    return Response(status_code=202)


@app.get("/metrics/{session_id}")
def metrics(session_id: str):
    return events_module.funnel_for_session(session_id)


@app.post("/order")
def order(req: OrderRequest):
    now = datetime.now(timezone.utc)
    order_id = f"IM-{now.strftime('%Y%m%d')}-{int(time.time() * 1000) % 100000:05X}"
    return {
        "order_id": order_id,
        "session_id": req.session_id,
        "persona_id": req.persona_id,
        "lines": [l.model_dump() for l in req.lines],
        "totals": req.totals,
        "placed_at": now.isoformat(),
    }
