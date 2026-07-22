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


def priority_for(probability: float, power_status: str, coverage_users: int | None = None) -> str:
    """Case 4.3 birebir uygulanir: 'AI etkilenen kullanici sayisi ve ariza olasiligina gore
    atar: buyuk kapsama alani + yuksek olasilik -> KRITIK'.

    Kapsama verisi Incident Service'in istasyon katalogundan gelir (stations.coverageUsers)
    ve telemetriyle birlikte iletilir. Karar matrisi (kapsama esikleri yapilandirilabilir):

        olasilik >= 0.85  &  kapsama >= COVERAGE_KRITIK (35K) veya OUTAGE  -> KRITIK
        olasilik >= 0.85  (diger)                                          -> YUKSEK
        olasilik >= 0.40  &  kapsama >= COVERAGE_KRITIK                    -> YUKSEK
        olasilik >= 0.40  (diger)                                          -> ORTA
        olasilik <  0.40                                                   -> DUSUK

    Kapsama bilinmiyorsa (istasyon katalog disi) orta kapsama varsayilir; OUTAGE her zaman
    genis etki vekilidir. Supervizor atamayi her zaman manuel degistirebilir (case 3.3);
    degisiklik AI dogruluk metrigine yansir."""
    big_coverage = (coverage_users or 0) >= settings.coverage_kritik_threshold
    if probability >= settings.threshold_acil:
        return "KRITIK" if (big_coverage or power_status == "OUTAGE") else "YUKSEK"
    if probability >= settings.threshold_izle:
        return "YUKSEK" if big_coverage else "ORTA"
    return "DUSUK"
