"""Sentetik veri seti ureticisi (v2).

Iki ayri veri seti uretir (bkz. docs/ARCHITECTURE.md Bolum 9.1 ve ML_APPROACH.md):

1. synthetic_telemetry.csv  — ariza turu SINIFLANDIRMA modeli icin.
   Her sinif icin ayri, gercekci parametrik dagilimlar + %12 oraninda "zor ornek"
   (iki sinifin sinir bolgesinde harmanlanmis telemetri). Zor ornekler modelin
   ezberlemesini onler ve gercek sahadaki belirsizligi temsil eder.

2. synthetic_resolution.csv — saha COZUM SURESI (dakika) REGRESYON modeli icin.
   Hedef degisken; ariza turune gore taban sure, oncelik kaynak carpani, yedek
   parca ihtiyaci (gizli/latent degisken — modele verilmez, gercekci indirgenemez
   hata payi yaratir), gece/hafta sonu vardiya etkisi ve istasyon ariza gecmisinin
   tani suresine etkisinden olusan bir uretici surecle (generative process) uretilir.

Calistirma (ai-service kok dizininden): python -m scripts.generate_dataset
"""

import csv
import math
import os
import random

RANDOM_SEED = 42
SAMPLES_PER_CLASS = 250
HARD_EXAMPLE_RATIO = 0.12  # sinif basina sinir-bolgesi ornegi orani
RESOLUTION_SAMPLES = 2400
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
TELEMETRY_PATH = os.path.join(OUTPUT_DIR, "synthetic_telemetry.csv")
RESOLUTION_PATH = os.path.join(OUTPUT_DIR, "synthetic_resolution.csv")

CSV_COLUMNS = [
    "signal_strength",
    "packet_loss",
    "temperature",
    "power_status",
    "historical_fault_count",
    "temperature_trend",
    "signal_delta",
    "packet_loss_ma",
    "fault_type",
]


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


# ---------------------------------------------------------------------------
# 1) Siniflandirma veri seti
# ---------------------------------------------------------------------------

def _gen_normal(rng: random.Random) -> dict:
    signal = _clip(rng.gauss(-70, 5), -110, -50)
    packet_loss = _clip(rng.gauss(1, 0.5), 0, 100)
    return {
        "signal_strength": round(signal, 2),
        "packet_loss": round(max(packet_loss, 0), 2),
        "temperature": round(_clip(rng.gauss(35, 4), 10, 100), 2),
        "power_status": "NORMAL",
        "historical_fault_count": max(0, round(rng.gauss(0.3, 0.6))),
        "temperature_trend": round(rng.gauss(0, 0.5), 2),
        "signal_delta": round(rng.gauss(0, 1.5), 2),
        "packet_loss_ma": round(max(packet_loss + rng.gauss(0, 0.3), 0), 2),
        "fault_type": "NORMAL",
    }


def _gen_isinma(rng: random.Random) -> dict:
    temperature = _clip(rng.gauss(78, 7), 50, 98)
    return {
        "signal_strength": round(_clip(rng.gauss(-78, 6), -110, -50), 2),
        "packet_loss": round(_clip(rng.gauss(5, 3), 0, 100), 2),
        "temperature": round(temperature, 2),
        "power_status": "NORMAL",
        "historical_fault_count": max(0, round(rng.gauss(1.2, 0.8))),
        "temperature_trend": round(rng.uniform(2, 6), 2),
        "signal_delta": round(rng.gauss(-2, 2), 2),
        "packet_loss_ma": round(_clip(rng.gauss(5, 3), 0, 100), 2),
        "fault_type": "ISINMA",
    }


def _gen_guc_kesintisi(rng: random.Random) -> dict:
    power_status = rng.choices(["UNSTABLE", "OUTAGE"], weights=[0.4, 0.6])[0]
    return {
        "signal_strength": round(_clip(rng.gauss(-100, 8), -110, -50), 2),
        "packet_loss": round(_clip(rng.gauss(30, 15), 0, 100), 2),
        "temperature": round(_clip(rng.gauss(38, 6), 10, 100), 2),
        "power_status": power_status,
        "historical_fault_count": max(0, round(rng.gauss(0.8, 0.7))),
        "temperature_trend": round(rng.gauss(0.5, 1), 2),
        "signal_delta": round(rng.gauss(-15, 5), 2),
        "packet_loss_ma": round(_clip(rng.gauss(30, 15) + rng.gauss(0, 3), 0, 100), 2),
        "fault_type": "GUC_KESINTISI",
    }


def _gen_baglanti(rng: random.Random) -> dict:
    packet_loss = _clip(rng.gauss(35, 10), 0, 100)
    return {
        "signal_strength": round(_clip(rng.gauss(-100, 6), -110, -50), 2),
        "packet_loss": round(packet_loss, 2),
        "temperature": round(_clip(rng.gauss(36, 4), 10, 100), 2),
        "power_status": "NORMAL",
        "historical_fault_count": max(0, round(rng.gauss(0.9, 0.7))),
        "temperature_trend": round(rng.gauss(0, 0.5), 2),
        "signal_delta": round(rng.gauss(-10, 4), 2),
        "packet_loss_ma": round(_clip(packet_loss + rng.gauss(0, 3), 0, 100), 2),
        "fault_type": "BAGLANTI",
    }


def _gen_yazilim(rng: random.Random) -> dict:
    packet_loss = _clip(rng.gauss(8, 6), 0, 100)
    return {
        "signal_strength": round(_clip(rng.gauss(-75, 10), -110, -50), 2),
        "packet_loss": round(packet_loss, 2),
        "temperature": round(_clip(rng.gauss(38, 5), 10, 100), 2),
        "power_status": "NORMAL",
        "historical_fault_count": max(0, round(rng.gauss(2.0, 1.0))),
        "temperature_trend": round(rng.gauss(0, 2), 2),
        "signal_delta": round(rng.gauss(0, 6), 2),
        "packet_loss_ma": round(_clip(packet_loss + rng.gauss(0, 4), 0, 100), 2),
        "fault_type": "YAZILIM",
    }


def _gen_donanim(rng: random.Random) -> dict:
    packet_loss = _clip(rng.gauss(20, 8), 0, 100)
    power_status = rng.choices(["NORMAL", "UNSTABLE"], weights=[0.8, 0.2])[0]
    return {
        "signal_strength": round(_clip(rng.gauss(-95, 7), -110, -50), 2),
        "packet_loss": round(packet_loss, 2),
        "temperature": round(_clip(rng.gauss(70, 10), 10, 100), 2),
        "power_status": power_status,
        "historical_fault_count": max(0, round(rng.gauss(1.5, 1.0))),
        "temperature_trend": round(rng.gauss(1.5, 2), 2),
        "signal_delta": round(rng.gauss(-8, 4), 2),
        "packet_loss_ma": round(_clip(packet_loss + rng.gauss(0, 3), 0, 100), 2),
        "fault_type": "DONANIM",
    }


GENERATORS = {
    "NORMAL": _gen_normal,
    "ISINMA": _gen_isinma,
    "GUC_KESINTISI": _gen_guc_kesintisi,
    "BAGLANTI": _gen_baglanti,
    "YAZILIM": _gen_yazilim,
    "DONANIM": _gen_donanim,
}

# Gercek sahada birbirine karisan sinif ciftleri: zor ornekler bu ciftlerin
# sayisal ozellikleri harmanlanarak uretilir (etiket ana sinifta kalir).
CONFUSABLE_PAIRS = {
    "ISINMA": "DONANIM",         # asiri isinan kart, donanim arizasina donusme sinirinda
    "DONANIM": "ISINMA",
    "BAGLANTI": "GUC_KESINTISI", # backhaul kaybi vs. enerji kaynakli sinyal cokusu
    "GUC_KESINTISI": "BAGLANTI",
    "YAZILIM": "NORMAL",         # aralikli yazilim hatasi, normal gurultusune yakin
    "NORMAL": "YAZILIM",
}

_NUMERIC_KEYS = [
    "signal_strength", "packet_loss", "temperature",
    "temperature_trend", "signal_delta", "packet_loss_ma",
]


def _blend(primary: dict, secondary: dict, alpha: float) -> dict:
    """Iki ornegin sayisal ozelliklerini alpha oraninda harmanlar (etiket primary'de kalir)."""
    row = dict(primary)
    for key in _NUMERIC_KEYS:
        row[key] = round(primary[key] * alpha + secondary[key] * (1 - alpha), 2)
    return row


def generate_telemetry(samples_per_class: int = SAMPLES_PER_CLASS, seed: int = RANDOM_SEED) -> list:
    rng = random.Random(seed)
    rows = []
    hard_count = int(samples_per_class * HARD_EXAMPLE_RATIO)
    for fault_type, generator in GENERATORS.items():
        for _ in range(samples_per_class - hard_count):
            rows.append(generator(rng))
        # Sinir bolgesi ornekleri: etiket korunur, ozellikler komsu sinifa dogru kaydirilir
        neighbor = GENERATORS[CONFUSABLE_PAIRS[fault_type]]
        for _ in range(hard_count):
            alpha = rng.uniform(0.65, 0.85)  # agirlik ana sinifta kalir
            rows.append(_blend(generator(rng), neighbor(rng), alpha))
    rng.shuffle(rows)
    return rows


# ---------------------------------------------------------------------------
# 2) Cozum suresi (ETA) regresyon veri seti
# ---------------------------------------------------------------------------

RESOLUTION_COLUMNS = [
    "fault_type",
    "priority",
    "distance_km",
    "hour_of_day",
    "is_weekend",
    "historical_fault_count",
    "resolution_minutes",
]

# Saha operasyon istatistiklerinden esinlenen taban is sureleri (dakika): (ortalama, std)
WORK_BASE_MINUTES = {
    "DONANIM": (150, 35),        # kart/anten degisimi, kule cikisi
    "GUC_KESINTISI": (105, 30),  # jenerator/aku/besleme hatti
    "BAGLANTI": (75, 25),        # fiber/backhaul, cogu zaman ek okuma + patch
    "YAZILIM": (55, 20),         # uzaktan yeniden yukleme + yerinde dogrulama
    "ISINMA": (90, 25),          # klima/fan degisimi, termal macun
    "BELIRSIZ": (120, 40),       # tani suresi belirsizligi yuksek
}

# Yedek parca gerektirme olasiligi (gizli degisken): parca cikarsa +N(60,20) dk.
PARTS_NEEDED_PROB = {
    "DONANIM": 0.45,
    "GUC_KESINTISI": 0.30,
    "BAGLANTI": 0.15,
    "YAZILIM": 0.05,
    "ISINMA": 0.25,
    "BELIRSIZ": 0.25,
}

PRIORITY_FACTOR = {
    "KRITIK": 0.85,  # kritik vakaya ek kaynak/oncelik verilir, is daha hizli biter
    "YUKSEK": 0.95,
    "ORTA": 1.0,
    "DUSUK": 1.10,
}

PRIORITY_WEIGHTS_BY_FAULT = {
    "DONANIM": [0.10, 0.35, 0.40, 0.15],
    "GUC_KESINTISI": [0.30, 0.40, 0.25, 0.05],
    "BAGLANTI": [0.15, 0.35, 0.35, 0.15],
    "YAZILIM": [0.05, 0.20, 0.45, 0.30],
    "ISINMA": [0.15, 0.35, 0.35, 0.15],
    "BELIRSIZ": [0.05, 0.20, 0.50, 0.25],
}
PRIORITIES = ["KRITIK", "YUKSEK", "ORTA", "DUSUK"]


def _resolution_minutes(rng: random.Random, fault_type: str, priority: str,
                        hour: int, weekend: bool, history: int) -> float:
    mean, std = WORK_BASE_MINUTES[fault_type]
    work = rng.gauss(mean, std)
    work *= PRIORITY_FACTOR[priority]
    if rng.random() < PARTS_NEEDED_PROB[fault_type]:
        work += max(15.0, rng.gauss(60, 20))  # parca tedarik bekleme
    if hour >= 22 or hour < 6:
        work *= 1.15  # gece vardiyasi: NOC destegi ve tedarik yavaslar
    if weekend:
        work *= 1.08
    work += min(history, 6) * rng.uniform(2, 5)  # kronik istasyonda tani uzar
    return _clip(work, 20, 480)


def generate_resolution(samples: int = RESOLUTION_SAMPLES, seed: int = RANDOM_SEED + 1) -> list:
    rng = random.Random(seed)
    rows = []
    fault_types = list(WORK_BASE_MINUTES.keys())
    for _ in range(samples):
        fault_type = rng.choice(fault_types)
        priority = rng.choices(PRIORITIES, weights=PRIORITY_WEIGHTS_BY_FAULT[fault_type])[0]
        # Sehir ici saha operasyonu: cogunluk yakin mesafe, uzun kuyruklu dagilim
        distance_km = round(_clip(rng.expovariate(1 / 8.0), 0.3, 45.0), 2)
        hour = rng.randint(0, 23)
        weekend = rng.random() < 2 / 7
        history = min(8, max(0, round(rng.expovariate(1 / 1.2))))
        minutes = _resolution_minutes(rng, fault_type, priority, hour, weekend, history)
        rows.append({
            "fault_type": fault_type,
            "priority": priority,
            "distance_km": distance_km,
            "hour_of_day": hour,
            "is_weekend": int(weekend),
            "historical_fault_count": history,
            "resolution_minutes": round(minutes, 1),
        })
    return rows


def _write_csv(path: str, columns: list, rows: list) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    telemetry_rows = generate_telemetry()
    _write_csv(TELEMETRY_PATH, CSV_COLUMNS, telemetry_rows)
    print(f"[siniflandirma] {len(telemetry_rows)} ornek -> {TELEMETRY_PATH}")
    print(f"  sinif basina: {SAMPLES_PER_CLASS} (%{int(HARD_EXAMPLE_RATIO*100)} sinir-bolgesi ornegi), {len(GENERATORS)} sinif")

    resolution_rows = generate_resolution()
    _write_csv(RESOLUTION_PATH, RESOLUTION_COLUMNS, resolution_rows)
    mean_minutes = sum(r["resolution_minutes"] for r in resolution_rows) / len(resolution_rows)
    print(f"[cozum suresi] {len(resolution_rows)} ornek -> {RESOLUTION_PATH} (ortalama {mean_minutes:.0f} dk)")


if __name__ == "__main__":
    main()
