"""Yerel (self-hosted) telekom ariza teshis motoru — Qwen2.5-1.5B-Instruct.

Gemini entegrasyonunun (bkz. ai-service/app/llm/gemini.py) aksine, bu motor
disari hicbir API cagrisi yapmaz: model agirliklari ve cikarim tamamen bu
konteyner icinde calisir. Kaynagi docs/telecom_llm/ altindaki deney/gelistirme
calismasidir (bkz. o dizindeki README_LLM.md) — LoRA ince ayar denemesi 4GB
VRAM'li bir GPU'da adim basina ~85sn olculdugu ve pratik olmadigi icin
(bkz. kok README "Yerel AI") burada bir fine-tuned adaptor VARSAYILMAZ; motor
taban modeli, zengin few-shot ornekleriyle birlikte DOGRUDAN kullanir. Eger
ileride LORA_ADAPTER_DIR altinda gecerli bir adaptor uretilirse, motor onu
otomatik olarak yukler (asagidaki dosya-varligi kontrolu sayesinde) — kod
degisikligi gerekmez.
"""

import json
import logging
import os
import threading

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger("local-ai-service.engine")

MODEL_DIR = os.environ.get(
    "LOCAL_AI_MODEL_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs", "telecom_llm", "models", "Qwen2.5-1.5B-Instruct")),
)
FALLBACK_MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"
ADAPTER_DIR = os.environ.get(
    "LOCAL_AI_ADAPTER_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs", "telecom_llm", "models", "telecom_qwen_lora_adapter")),
)

FAULT_AREAS = ["ISINMA", "GUC_KESINTISI", "BAGLANTI", "DONANIM", "YAZILIM", "NORMAL"]

SYSTEM_PROMPT = """Sen Turkcell NetOpsCell Kıdemli Telekom Ağ ve Baz İstasyonu Yapay Zeka Uzmanısın.

Görevin:
1. Gelen baz istasyonu telemetrisini ve kullanıcı/saha bildirimini analiz et.
2. `ariza_turu` alanını SADECE şu 6 değerden biri yap:
   - "ISINMA": Yüksek sıcaklık (>75°C), fan gürültüsü, termal uyarı alarmı varsa.
   - "GUC_KESINTISI": Şebeke elektriği kesintisi (OUTAGE), 0V AC, voltaj düşüklüğü, akü tükenmesi varsa.
   - "BAGLANTI": Fiber kablo kopukluğu, LOS alarmı, yüksek paket kaybı (>30%), backhaul sönümlenmesi varsa.
   - "DONANIM": Sektör RRU kartı yanması, VSWR yüksek uyarısı, fiziki donanım arızası varsa.
   - "YAZILIM": Sinyal normal olmasına rağmen BBU kilitlenmesi, 4G el sıkışma (handshake) hatası, protocol drop varsa.
   - "NORMAL": Tüm değerler sağlamsa.
3. Yanıtını DAİMA ve KESİNLİKLE aşağıdaki JSON formatında üret. Başka metin yazma!"""

FEW_SHOT_EXAMPLES = [
    {
        "role": "user",
        "content": "İstasyon: IST-ANK-01\nSıcaklık: 86.5 °C\nSinyal: -79 dBm\nPaket Kaybı: %7.1\nGüç: NORMAL\nŞikayet: Kabinden yüksek fan gürültüsü ve termal alarm geliyor.",
    },
    {
        "role": "assistant",
        "content": json.dumps(
            {
                "ariza_turu": "ISINMA",
                "oncelik": "YUKSEK",
                "kok_neden": "Kabin iklimlendirme/fan ünitesi arızası sebebiyle 86.5°C sıcaklık ve termal alarm.",
                "önerilen_aksiyonlar": [
                    "Saha iklimlendirme ekibi yedek fan ünitesi ile sevk edilmeli."
                ],
                "gerekli_uzmanlik": "DONANIM_IKLIMLENDIRME",
            },
            ensure_ascii=False,
        ),
    },
]


class TelecomFaultLLMEngine:
    """Sureç ici tekil (singleton) motor — model bir kez yuklenir, tum istekler paylasir."""

    def __init__(self):
        self._lock = threading.Lock()
        self._tokenizer = None
        self._model = None
        self._adapter_loaded = False
        self._model_source = None
        self._load_error = None

    def load(self):
        with self._lock:
            if self._model is not None:
                return
            is_local = os.path.exists(MODEL_DIR) and bool(os.listdir(MODEL_DIR))
            if not is_local:
                self._load_error = f"Yerel model klasoru ({MODEL_DIR}) bulunamadi veya bos. Lutfen once modeli indirin."
                logger.error("%s Internet uzerinden otomatik indirme yapilmayacak.", self._load_error)
                return

            source = MODEL_DIR
            logger.info("Yerel model yukleniyor: %s (local_files_only=True)", source)
            self._model_source = source

            try:
                cpu_threads = min(8, os.cpu_count() or 4)
                torch.set_num_threads(cpu_threads)
                logger.info("PyTorch CPU thread sayisi: %d", cpu_threads)

                tokenizer = AutoTokenizer.from_pretrained(
                    source, trust_remote_code=True, local_files_only=True
                )
                if tokenizer.pad_token is None:
                    tokenizer.pad_token = tokenizer.eos_token

                device_map = "auto" if torch.cuda.is_available() else "cpu"
                torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
                model = AutoModelForCausalLM.from_pretrained(
                    source,
                    torch_dtype=torch_dtype,
                    device_map=device_map,
                    trust_remote_code=True,
                    local_files_only=True,
                )

                if os.path.exists(ADAPTER_DIR) and os.listdir(ADAPTER_DIR):
                    try:
                        from peft import PeftModel

                        model = PeftModel.from_pretrained(model, ADAPTER_DIR, local_files_only=True)
                        if hasattr(model, "merge_and_unload"):
                            model = model.merge_and_unload()
                        self._adapter_loaded = True
                        logger.info("Ince ayarli LoRA adaptoru yuklendi ve birlestirildi: %s", ADAPTER_DIR)
                    except Exception as exc:  # noqa: BLE001 - adaptor yuklenemezse taban model + few-shot ile devam
                        logger.warning("LoRA adaptoru yuklenemedi (%s), taban model few-shot ile devam ediliyor.", exc)

                self._tokenizer = tokenizer
                self._model = model
                self._load_error = None
                logger.info("Yerel model hazir (adaptor=%s).", self._adapter_loaded)
            except Exception as exc:
                self._load_error = f"Yerel model yuklenirken hata olustu: {exc}"
                logger.error(self._load_error)

    @property
    def ready(self) -> bool:
        return self._model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    @property
    def model_source(self) -> str | None:
        return self._model_source

    @property
    def adapter_loaded(self) -> bool:
        return self._adapter_loaded

    def diagnose(self, user_input: str) -> dict:
        if self._model is None:
            self.load()

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(FEW_SHOT_EXAMPLES)
        messages.append({"role": "user", "content": user_input})

        text = self._tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = self._tokenizer([text], return_tensors="pt").to(self._model.device)

        with torch.no_grad():
            generated_ids = self._model.generate(
                **model_inputs,
                max_new_tokens=150,
                do_sample=False,
                pad_token_id=self._tokenizer.pad_token_id,
            )

        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]
        response_text = self._tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

        try:
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                parsed = json.loads(response_text[start_idx:end_idx])
                if parsed.get("ariza_turu") not in FAULT_AREAS:
                    parsed["ariza_turu"] = "YAZILIM"
                return parsed
        except Exception:  # noqa: BLE001 - model bozuk JSON uretirse ham metni dondur
            pass
        return {"raw_response": response_text}


engine = TelecomFaultLLMEngine()
