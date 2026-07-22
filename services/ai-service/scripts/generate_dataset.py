"""Sentetik telemetri veri seti ureticisi.

Bkz. docs/ARCHITECTURE.md - Bolum 9.1 (Sentetik Veri Seti). Her sinif icin ayri, gercekci
parametrik dagilimlarla ornek uretir; ciktiyi ../data/synthetic_telemetry.csv'ye yazar.

Calistirma (ai-service kok dizininden): python -m scripts.generate_dataset
"""

import csv
import os
import random

RANDOM_SEED = 42
SAMPLES_PER_CLASS = 40
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_telemetry.csv")

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


def generate(samples_per_class: int = SAMPLES_PER_CLASS, seed: int = RANDOM_SEED) -> list:
    rng = random.Random(seed)
    rows = []
    for fault_type, generator in GENERATORS.items():
        for _ in range(samples_per_class):
            rows.append(generator(rng))
    rng.shuffle(rows)
    return rows


def main() -> None:
    rows = generate()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} ornek uretildi -> {OUTPUT_PATH}")
    print(f"Sinif basina: {SAMPLES_PER_CLASS} ornek, {len(GENERATORS)} sinif")


if __name__ == "__main__":
    main()
