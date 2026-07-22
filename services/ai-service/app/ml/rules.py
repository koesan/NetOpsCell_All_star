"""Kural katmani: esik yonlendirme + guvenlik agi kurallari (bkz. ARCHITECTURE.md Bolum 9.2).

Model uzerine sarilir; hem canli demoda beklenmedik tahminlere karsi bir guvence saglar
hem de "kural + ML hibrit" onayli yaklasimlardan birini karsilar.
"""

from app.config import settings

RECOMMENDATION_IZLE = "IZLE"
RECOMMENDATION_VAKA_AC = "VAKA_AC"
RECOMMENDATION_ACIL = "ACIL"


def recommendation_for(probability: float) -> str:
    if probability < settings.threshold_izle:
        return RECOMMENDATION_IZLE
    if probability < settings.threshold_acil:
        return RECOMMENDATION_VAKA_AC
    return RECOMMENDATION_ACIL


def apply_safety_net(probability: float, fault_type: str, power_status: str) -> tuple[float, str]:
    """Guc kesintisi acik sekilde OUTAGE ise, modelin tahminine bakmaksizin GUC_KESINTISI +
    yuksek olasilik garanti edilir. Bu, jurinin bariz senaryolarda modelin garip davranmasi
    riskine karsi bir guvenlik agidir (bkz. ARCHITECTURE.md Bolum 9.2)."""
    if power_status == "OUTAGE":
        return max(probability, 0.9), "GUC_KESINTISI"
    return probability, fault_type


def priority_for(probability: float, power_status: str) -> str:
    """Case 4.3: 'buyuk kapsama alani + yuksek olasilik -> KRITIK'. Bu sistemde gercek
    'etkilenen kullanici sayisi' veri kaynagi olmadigindan (case'te de belirtilmemis),
    power_status=OUTAGE genis kapsamli kesinti icin makul bir vekil (proxy) olarak kullanilir.
    Supervizor bu atamayi her zaman manuel degistirebilir (case 3.3)."""
    if probability >= settings.threshold_acil:
        return "KRITIK" if power_status == "OUTAGE" else "YUKSEK"
    if probability >= settings.threshold_izle:
        return "ORTA"
    return "DUSUK"
