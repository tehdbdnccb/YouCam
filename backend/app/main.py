# backend/app/main.py
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.agent import ConsultationOrchestrator
from app.tools import SessionVault


class ConsultPayload(BaseModel):
    image_b64: str = Field(..., min_length=100, description="Base64 encoded user scan")
    prompt: str = Field(..., min_length=2, max_length=400, description="User context")


class ConsultResult(BaseModel):
    session_id: str
    reasoning: str
    vto_image_b64: Optional[str] = None
    telemetry: Dict[str, Any] = Field(default_factory=dict)


class ConsultationController:
    """
    Validates HTTP ingress/egress contracts and delegates to the agentic orchestrator.
    Strictly 2 methods: __init__ and handle_consultation.
    """

    def __init__(self, orchestrator: ConsultationOrchestrator) -> None:
        self._orchestrator = orchestrator

    async def handle_consultation(self, payload: ConsultPayload) -> ConsultResult:
        session_id = SessionVault.check_in(payload.image_b64)
        reasoning = await self._orchestrator.execute(session_id, payload.prompt)
        slot = SessionVault.get_slot(session_id)
        return ConsultResult(
            session_id=session_id,
            reasoning=reasoning,
            vto_image_b64=slot.get("vto_image") or None,
            telemetry=slot.get("telemetry", {}),
        )


app = FastAPI(title="AuraFit Engine", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
controller = ConsultationController(ConsultationOrchestrator())


@app.post("/api/v1/consult", response_model=ConsultResult)
async def consult_endpoint(payload: ConsultPayload) -> ConsultResult:
    try:
        return await controller.handle_consultation(payload)
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err)) from val_err
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc