from app.ml.rules import apply_safety_net, priority_for, recommendation_for


def test_recommendation_izle_below_threshold():
    assert recommendation_for(0.10) == "IZLE"
    assert recommendation_for(0.39) == "IZLE"


def test_recommendation_vaka_ac_in_middle_band():
    assert recommendation_for(0.40) == "VAKA_AC"
    assert recommendation_for(0.84) == "VAKA_AC"


def test_recommendation_acil_at_and_above_threshold():
    assert recommendation_for(0.85) == "ACIL"
    assert recommendation_for(1.0) == "ACIL"


def test_safety_net_forces_guc_kesintisi_on_outage():
    probability, fault_type = apply_safety_net(0.10, "YAZILIM", "OUTAGE")
    assert fault_type == "GUC_KESINTISI"
    assert probability >= 0.9


def test_safety_net_does_not_lower_an_already_high_probability():
    probability, fault_type = apply_safety_net(0.97, "GUC_KESINTISI", "OUTAGE")
    assert fault_type == "GUC_KESINTISI"
    assert probability == 0.97


def test_safety_net_no_effect_when_power_normal():
    probability, fault_type = apply_safety_net(0.10, "YAZILIM", "NORMAL")
    assert (probability, fault_type) == (0.10, "YAZILIM")


def test_priority_kritik_when_outage_and_high_probability():
    assert priority_for(0.90, "OUTAGE") == "KRITIK"


def test_priority_yuksek_when_high_probability_without_outage():
    assert priority_for(0.90, "NORMAL") == "YUKSEK"


def test_priority_orta_in_middle_band():
    assert priority_for(0.50, "NORMAL") == "ORTA"


def test_priority_dusuk_below_izle_threshold():
    assert priority_for(0.10, "NORMAL") == "DUSUK"


# --- Case 4.3 kapsama-farkindalikli oncelik matrisi ------------------------

def test_priority_big_coverage_high_probability_is_kritik():
    """Case 4.3 birebir: 'buyuk kapsama alani + yuksek olasilik -> KRITIK'."""
    assert priority_for(0.90, "NORMAL", coverage_users=42000) == "KRITIK"


def test_priority_small_coverage_high_probability_is_yuksek():
    assert priority_for(0.90, "NORMAL", coverage_users=17000) == "YUKSEK"


def test_priority_big_coverage_medium_probability_is_yuksek():
    assert priority_for(0.55, "NORMAL", coverage_users=42000) == "YUKSEK"


def test_priority_small_coverage_medium_probability_is_orta():
    assert priority_for(0.55, "NORMAL", coverage_users=17000) == "ORTA"


def test_priority_unknown_coverage_backward_compatible():
    """Katalog disi istasyon (kapsama bilinmiyor): eski davranis korunur."""
    assert priority_for(0.90, "NORMAL") == "YUKSEK"
    assert priority_for(0.90, "OUTAGE") == "KRITIK"
