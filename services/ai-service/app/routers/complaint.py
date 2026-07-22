"""Musteri sikayet metni on analizi endpoint'i (Gemini LLM).

Musteri, ariza bildirimi formunda serbest metin sikayetini yazip "AI On Analiz"
ister; yanit aninda formun yaninda gosterilir ve bildirimle birlikte saklanmak
uzere Incident Service'e iletilir. Anahtar tanimli degilse 503 doner — frontend
bu durumu zarifce gizler.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm.gemini import analyze_complaint, is_configured

router = APIRouter(prefix="/api/v1/ai", tags=["complaint"])


class ComplaintRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000, description="Musteri sikayet metni")
    station_code: str | None = None
    telemetry_summary: str | None = Field(None, max_length=500)


class ComplaintAnalysis(BaseModel):
    muhtemel_alan: str
    olasi_neden: str
    oneri: str
    guven: float
    model: str
    token_kullanimi: int | None = None


@router.post("/analyze-complaint", response_model=ComplaintAnalysis)
def analyze(payload: ComplaintRequest):
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="LLM analizi yapilandirilmamis (GEMINI_API_KEY secret'i tanimli degil, bkz. README).",
        )
    result = analyze_complaint(payload.text, payload.telemetry_summary)
    if result is None:
        raise HTTPException(status_code=503, detail="LLM analizi su an kullanilamiyor, lutfen tekrar deneyin.")
    return ComplaintAnalysis(**result)
