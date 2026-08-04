"""Pydantic schemas — mirror docs/datamodel.md section 5 and the
/copilot contract in docs/architecture.md section 3."""
from typing import Literal, Optional

from pydantic import BaseModel

TrustFactType = Literal[
    "expiry", "ingredient", "authenticity", "freshness",
    "sourcing", "compatibility", "warranty", "return", "quantity",
]

Persona = Literal["householder", "experimenter"]


class CartLine(BaseModel):
    sku_id: str
    qty: int


class CopilotRequest(BaseModel):
    session_id: str
    persona: Persona
    cart: list[CartLine]
    history_category_ids: list[str]
    dismissed_sku_ids: list[str] = []
    local_hour: int = 12


class TrustFact(BaseModel):
    type: TrustFactType
    label: str


class Suggestion(BaseModel):
    sku_id: str
    why: str
    trust_facts: list[TrustFact]
    price_anchor: Optional[str] = None
    protected_trial: bool
    is_new_category: bool


class CopilotResponse(BaseModel):
    mission: str
    confidence: float
    suggestions: list[Suggestion]
    latency_ms: int
    model: str


class ModelPick(BaseModel):
    sku_id: str
    why: str
    fact_ids: list[str] = []


class ModelOutput(BaseModel):
    """The smaller shape Groq is actually asked for — server expands
    picks into full Suggestion objects. The model never authors fact
    text, prices, or badges (docs/datamodel.md section 5)."""
    mission: str
    confidence: float
    picks: list[ModelPick] = []


class Event(BaseModel):
    session_id: str
    ts: str
    type: Literal[
        "suggestion_shown", "suggestion_tapped", "suggestion_added",
        "suggestion_removed", "module_dismissed", "not_relevant",
        "checkout_started", "order_placed", "copilot_latency",
    ]
    payload: dict = {}


class OrderLine(BaseModel):
    sku_id: str
    qty: int


class OrderRequest(BaseModel):
    session_id: str
    persona_id: str
    lines: list[OrderLine]
    totals: dict
