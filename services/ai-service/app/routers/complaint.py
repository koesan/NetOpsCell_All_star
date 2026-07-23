"""Musteri/saha sikayet metni on analizi endpoint'i (Gemini LLM).

Musteri veya saha personeli, ariza bildirimi formunda serbest metin sikayetini yazip
"AI On Analiz" ister; yanit aninda formun yaninda ve vaka detaylarinda gosterilir.
Kota doldugunda veya API anahtari yapilandirilmadiginda kullaniciyi bilgilendiren
acik bir fallback yaniti doner (UI'da kutu her zaman gorunur).
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.llm.gemini import analyze_complaint, is_configured

router = APIRouter(prefix="/api/v1/ai", tags=["complaint"])


class ComplaintRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000, description="Musteri veya saha personeli sikayet metni")
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
        return ComplaintAnalysis(
            muhtemel_alan="BELIRSIZ",
            olasi_neden="Gemini API anahtarı henüz eklenmedi. (secrets/gemini_api_key.txt bekleniyor).",
            oneri="Sistem telemetri tabanlı ML sınıflandırma ve otomatik atama ile kesintisiz çalışmaktadır.",
            guven=0.0,
            model="gemini-unconfigured",
        )

    result = analyze_complaint(payload.text, payload.telemetry_summary)
    if result is None:
        return ComplaintAnalysis(
            muhtemel_alan="BELIRSIZ",
            olasi_neden="Gemini AI servisi kota sınırında veya geçici olarak yanıt veremiyor (Kota yetmiyor / API sınırı).",
            oneri="Telemetri analizi ve ML sınıflandırıcı aktif durumdadır.",
            guven=0.0,
            model="gemini-quota-exceeded",
        )

    return ComplaintAnalysis(**result)
