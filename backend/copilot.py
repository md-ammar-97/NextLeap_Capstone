"""Copilot pipeline: candidate filter -> Groq call (+ fallback chain) ->
validation -> cache. Mirrors docs/architecture.md section 4.

Server-side validation is the actual guardrail enforcement — the model's
claims (is_new_category, fact text, price) are never trusted directly."""
import hashlib
import json
import os
import re
import time

from groq import Groq

import catalog
import prompts
from models import CopilotRequest, CopilotResponse, ModelOutput, Suggestion, TrustFact

PRIMARY_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODEL = os.environ.get("GROQ_FALLBACK", "llama-3.1-8b-instant")
PRIMARY_TIMEOUT_S = 2.0
FALLBACK_TIMEOUT_S = 1.0
CONFIDENCE_FLOOR = 0.6
MAX_SUGGESTIONS = 3
MIN_NEW_CATEGORY = 2
WHY_MAX_WORDS = 12

_SUPERLATIVE_RE = re.compile(r"\b(better|best|healthiest|healthier|superior|greatest)\b", re.I)

_client: Groq | None = None
_cache: dict[str, dict] = {}


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _client


def _cache_key(req: CopilotRequest) -> str:
    raw = json.dumps({
        "persona": req.persona,
        "sku_ids": sorted(line.sku_id for line in req.cart),
        "dismissed": sorted(req.dismissed_sku_ids),
    }, sort_keys=True)
    return hashlib.sha1(raw.encode()).hexdigest()


def _cart_summary(req: CopilotRequest) -> str:
    lines = []
    for line in req.cart:
        sku = catalog.get_sku(line.sku_id)
        if sku:
            lines.append(f"- {sku['name']} x{line.qty} ({sku['category_id']})")
    return "\n".join(lines) if lines else "(empty)"


def _call_model(model: str, system: str, user: str, timeout_s: float) -> str | None:
    try:
        resp = _get_client().with_options(timeout=timeout_s).chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=500,
        )
        return resp.choices[0].message.content
    except Exception:
        return None


def _parse_model_output(raw: str | None) -> ModelOutput | None:
    if raw is None:
        return None
    text = raw.strip()
    for attempt in range(2):
        try:
            data = json.loads(text)
            return ModelOutput.model_validate(data)
        except Exception:
            if attempt == 0:
                # one repair attempt: strip code fences
                text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
                continue
            return None
    return None


def _truncate_why(why: str) -> str:
    words = why.strip().split()
    if len(words) <= WHY_MAX_WORDS:
        return why.strip()
    return " ".join(words[:WHY_MAX_WORDS])


def _strip_superlatives(why: str) -> str | None:
    """Return None if the whole line should be dropped (nothing salvageable),
    else the cleaned line."""
    sentences = re.split(r"(?<=[.!?])\s+", why)
    kept = [s for s in sentences if not _SUPERLATIVE_RE.search(s)]
    cleaned = " ".join(kept).strip()
    return cleaned or None


def _build_suggestion(pick, req: CopilotRequest) -> Suggestion | None:
    sku = catalog.get_sku(pick.sku_id)
    if sku is None:
        return None

    why = _strip_superlatives(pick.why)
    if why is None:
        return None
    why = _truncate_why(why)

    catalog_facts_by_id = {f["fact_id"]: f for f in sku.get("trust_facts", [])}
    trust_facts = []
    for fid in pick.fact_ids:
        f = catalog_facts_by_id.get(fid)
        if f:
            trust_facts.append(TrustFact(type=f["type"], label=f["label"]))
    if not trust_facts:
        # model gave no valid fact_ids — fall back to the SKU's own facts (still catalog-sourced)
        trust_facts = [TrustFact(type=f["type"], label=f["label"]) for f in sku.get("trust_facts", [])[:3]]
    trust_facts = trust_facts[:3]

    is_new = catalog.is_new_category(pick.sku_id, req.history_category_ids)

    price_anchor = None
    anchor = sku.get("anchor_price")
    if anchor:
        price_anchor = f"₹{sku['price']} here · ~₹{anchor['price']} at {anchor['retailer']}"

    return Suggestion(
        sku_id=pick.sku_id,
        why=why,
        trust_facts=trust_facts,
        price_anchor=price_anchor,
        protected_trial=is_new,
        is_new_category=is_new,
    )


def get_copilot_response(req: CopilotRequest) -> tuple[CopilotResponse | None, dict]:
    """Returns (response_or_None, debug_meta). None means: render nothing (204)."""
    key = _cache_key(req)
    if key in _cache:
        cached = _cache[key]
        return CopilotResponse.model_validate(cached), {"cache_hit": True, "latency_ms": 0}

    start = time.monotonic()
    candidates = catalog.candidate_slice(req.history_category_ids, req.dismissed_sku_ids)
    if not candidates:
        return None, {"reason": "no_candidates", "latency_ms": int((time.monotonic() - start) * 1000)}

    candidate_lines = [
        prompts.format_candidate(s, s["category_id"] not in set(req.history_category_ids))
        for s in candidates
    ]
    system = prompts.build_system_prompt(req.persona)
    user = prompts.build_user_prompt(_cart_summary(req), req.local_hour, candidate_lines)

    model_used = PRIMARY_MODEL
    raw = _call_model(PRIMARY_MODEL, system, user, PRIMARY_TIMEOUT_S)
    if raw is None:
        model_used = FALLBACK_MODEL
        raw = _call_model(FALLBACK_MODEL, system, user, FALLBACK_TIMEOUT_S)

    output = _parse_model_output(raw)
    latency_ms = int((time.monotonic() - start) * 1000)

    if output is None:
        return None, {"reason": "model_error_or_invalid_json", "latency_ms": latency_ms}

    if output.confidence < CONFIDENCE_FLOOR:
        return None, {"reason": "low_confidence", "confidence": output.confidence, "latency_ms": latency_ms}

    candidate_ids = {s["sku_id"] for s in candidates}
    suggestions: list[Suggestion] = []
    for pick in output.picks:
        if pick.sku_id not in candidate_ids:
            continue
        s = _build_suggestion(pick, req)
        if s is not None:
            suggestions.append(s)
        if len(suggestions) >= MAX_SUGGESTIONS:
            break

    new_category_count = sum(1 for s in suggestions if s.is_new_category)
    if not suggestions or new_category_count < MIN_NEW_CATEGORY:
        return None, {"reason": "insufficient_new_category_or_empty", "latency_ms": latency_ms}

    response = CopilotResponse(
        mission=output.mission,
        confidence=output.confidence,
        suggestions=suggestions,
        latency_ms=latency_ms,
        model=model_used,
    )
    _cache[key] = response.model_dump()
    return response, {"latency_ms": latency_ms, "model": model_used}
