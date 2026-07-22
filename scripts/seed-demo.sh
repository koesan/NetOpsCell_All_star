#!/usr/bin/env bash
# =============================================================================
# NetOpsCell — Demo Senaryo Yukleyici
#
# Sistemi gercekci bir "operasyon gunu" verisiyle doldurur:
#   1. Istanbul'un farkli noktalarindan 6 telemetri gonderilir (kritik guc
#      kesintisi, asiri isinma, baglanti kaybi, donanim, yazilim ve 1 normal
#      olcum — normal olcum AI tarafindan IZLE'ye ayrilir, vaka acilmaz).
#   2. Orta guvenli tahminler NOC operatoru tarafindan onaylanip AI atamasina verilir.
#   3. Bir vaka tam yasam dongusunden gecirilir (YOLDA -> MUDAHALE -> COZULDU ->
#      KAPANDI -> 5 yildiz) — puan/rozet/liderlik tablosu dolar.
#   4. Bir KRITIK vaka YOLDA durumunda birakilir — haritada CANLI arac akisi izlenir.
#   5. Saha <-> NOC arasinda WhatsApp tarzi mesajlasma ornegi olusturulur.
#
# Kullanim:  ./scripts/seed-demo.sh   (once: docker compose up + identity seed)
# Gereksinim: curl, python3
# =============================================================================
set -euo pipefail

GW="${GATEWAY_URL:-http://localhost:8080}"
PASS="Demo123!"

say()  { printf "\033[1;34m[demo]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[hata]\033[0m %s\n" "$*"; exit 1; }

json() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$2" 2>/dev/null <<<"$1" || true; }

# Gateway auth brute-force limiti 5 giris/dk oldugu icin token'lar cache'lenir —
# ayni kullanici icin ikinci kez giris yapilmaz.
declare -A TOKEN_CACHE

login() { # $1=email -> access token
  if [ -n "${TOKEN_CACHE[$1]:-}" ]; then
    echo "${TOKEN_CACHE[$1]}"
    return
  fi
  local resp token
  resp=$(curl -sf -X POST "$GW/api/v1/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}") || fail "Giris basarisiz: $1 (identity seed calisti mi? / rate limit icin 1 dk bekleyin)"
  token=$(json "$resp" "d['data']['accessToken']")
  TOKEN_CACHE[$1]="$token"
  echo "$token"
}

telemetry() { # $1=token $2=json-body -> response
  curl -sf -X POST "$GW/api/v1/telemetry" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" -d "$2"
}

say "Gateway saglik kontrolu: $GW"
curl -sf "$GW/health" >/dev/null || fail "Gateway erisilemedi. 'docker compose up' calisiyor mu?"

# --- 1. Kimlikler -----------------------------------------------------------
say "Musteri OTP girisi (05551234567 / 1234)..."
curl -sf -X POST "$GW/api/v1/auth/register" -H 'Content-Type: application/json' \
  -d '{"gsm":"05551234567","name":"Demo","surname":"Musteri"}' >/dev/null
CUST=$(json "$(curl -sf -X POST "$GW/api/v1/auth/otp/verify" -H 'Content-Type: application/json' \
  -d '{"gsm":"05551234567","code":"1234"}')" "d['data']['accessToken']")
[ -n "$CUST" ] || fail "Musteri girisi basarisiz."

say "Personel girisleri..."
NOC=$(login "noc@netopscell.com")
SUP=$(login "supervizor@netopscell.com")

# Teknisyen adi -> email eslemesi (seed.ts ile ayni)
tech_email() {
  case "$1" in
    Ayse*)  echo "saha.donanim@netopscell.com" ;;
    Can*)   echo "saha.baglanti@netopscell.com" ;;
    Zeynep*) echo "saha.guc.kesintisi@netopscell.com" ;;
    Burak*) echo "saha.avrupa.donanim@netopscell.com" ;;
    Selin*) echo "saha.maslak@netopscell.com" ;;
    Emre*)  echo "saha.anadolu.guney@netopscell.com" ;;
    *) echo "" ;;
  esac
}

# --- 2. Telemetriler (istasyon katalogu koordinatlariyla) --------------------
say "Telemetri #1 — KRITIK guc kesintisi @ BTS-IST-010 Kadikoy Iskele (otomatik atama beklenir)"
telemetry "$CUST" '{"stationCode":"BTS-IST-010","latitude":40.9928,"longitude":29.0253,"signalStrength":-106,"packetLoss":48,"temperature":37,"powerStatus":"OUTAGE"}' >/dev/null

say "Telemetri #2 — asiri isinma @ BTS-IST-003 Taksim Meydan (musteri sikayeti + Gemini on analizi ile)"
DESC="Taksim'deki magazamizda internet gun icinde surekli yavasliyor, ogleden sonra tamamen kopuyor. Telefon cekiyor ama mobil veri neredeyse hic calismiyor."
ANALYSIS=$(curl -sf -X POST "$GW/api/v1/ai/analyze-complaint" -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
  -d "{\"text\":\"$DESC\"}" | python3 -c "import json,sys;print(json.dumps(json.load(sys.stdin)['data'],ensure_ascii=False))" 2>/dev/null || echo "")
if [ -n "$ANALYSIS" ]; then
  say "  Gemini analizi alindi: $(python3 -c "import json,sys;d=json.loads(sys.argv[1]);print(d['muhtemel_alan'],'-',d['olasi_neden'][:60])" "$ANALYSIS" 2>/dev/null || true)"
fi
PAYLOAD=$(python3 - "$DESC" "$ANALYSIS" << 'PYEOF'
import json, sys
body = {"stationCode":"BTS-IST-003","latitude":41.0370,"longitude":28.9850,
        "signalStrength":-82,"packetLoss":6,"temperature":91,"powerStatus":"NORMAL",
        "description":sys.argv[1]}
if sys.argv[2]:
    body["complaintAnalysis"] = json.loads(sys.argv[2])
print(json.dumps(body, ensure_ascii=False))
PYEOF
)
telemetry "$CUST" "$PAYLOAD" >/dev/null

say "Telemetri #3 — baglanti kaybi @ BTS-IST-014 Atasehir Finans Merkezi"
telemetry "$CUST" '{"stationCode":"BTS-IST-014","latitude":40.9923,"longitude":29.1274,"signalStrength":-105,"packetLoss":52,"temperature":36,"powerStatus":"NORMAL"}' >/dev/null

say "Telemetri #4 — donanim arizasi @ BTS-IST-005 Bakirkoy Sahil"
telemetry "$CUST" '{"stationCode":"BTS-IST-005","latitude":40.9744,"longitude":28.8719,"signalStrength":-97,"packetLoss":24,"temperature":74,"powerStatus":"UNSTABLE"}' >/dev/null

say "Telemetri #5 — yazilim/aralikli hata @ BTS-IST-002 Maslak"
telemetry "$CUST" '{"stationCode":"BTS-IST-002","latitude":41.1121,"longitude":29.0208,"signalStrength":-80,"packetLoss":12,"temperature":41,"powerStatus":"NORMAL"}' >/dev/null

say "Telemetri #6 — NORMAL olcum @ BTS-IST-012 Uskudar (AI 'IZLE' demeli, vaka ACILMAMALI)"
telemetry "$CUST" '{"stationCode":"BTS-IST-012","latitude":41.0255,"longitude":29.0158,"signalStrength":-68,"packetLoss":0.8,"temperature":33,"powerStatus":"NORMAL"}' >/dev/null

sleep 1

# --- 3. NOC: YENI vakalari onayla (AI atamasi tetiklenir) --------------------
say "YENI vakalar NOC tarafindan onaylanip AI atamasina veriliyor..."
INCIDENTS=$(curl -sf "$GW/api/v1/incidents" -H "Authorization: Bearer $NOC")
for ID in $(json "$INCIDENTS" "'\n'.join(i['id'] for i in d['data'] if i['status']=='YENI')"); do
  curl -sf -X POST "$GW/api/v1/incidents/$ID/confirm" -H "Authorization: Bearer $NOC" >/dev/null || true
done

sleep 1
INCIDENTS=$(curl -sf "$GW/api/v1/incidents" -H "Authorization: Bearer $NOC")

pick() { # $1=stationCode $2=alan
  json "$INCIDENTS" "next((i['$2'] for i in d['data'] if i['stationCode']=='$1' and i['status'] not in ('COZULDU','KAPANDI')), '')"
}

# --- 4. Tam yasam dongusu: Taksim ISINMA vakasi ------------------------------
ISINMA_ID=$(pick "BTS-IST-003" "id")
ISINMA_TEAM=$(pick "BTS-IST-003" "assignedTeamName")
if [ -n "$ISINMA_ID" ] && [ -n "$ISINMA_TEAM" ]; then
  TECH_EMAIL=$(tech_email "$ISINMA_TEAM")
  if [ -n "$TECH_EMAIL" ]; then
    say "Tam yasam dongusu: Taksim isinma vakasi ($ISINMA_TEAM ekibi)"
    TECH=$(login "$TECH_EMAIL")
    auth_tech=(-H "Authorization: Bearer $TECH" -H 'Content-Type: application/json')
    auth_noc=(-H "Authorization: Bearer $NOC" -H 'Content-Type: application/json')

    curl -sf -X PATCH "$GW/api/v1/incidents/$ISINMA_ID/status" "${auth_tech[@]}" -d '{"status":"YOLDA"}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/messages" "${auth_tech[@]}" -d '{"content":"Yola ciktim, Taksim trafigi yogun ama ETA icinde varirim."}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/messages" "${auth_noc[@]}" -d '{"content":"Anlasildi. Istasyonun sicaklik trendi hala yukseliyor, klima unitesini oncelikli kontrol eder misin?"}' >/dev/null
    curl -sf -X PATCH "$GW/api/v1/incidents/$ISINMA_ID/status" "${auth_tech[@]}" -d '{"status":"MUDAHALE_EDILIYOR"}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/messages" "${auth_tech[@]}" -d '{"content":"Sahadayim. Klima fani ariza vermis, kabin ici 63 derece. Fani degistiriyorum."}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/messages" "${auth_noc[@]}" -d '{"content":"Sicaklik dusmeye basladi, telemetriden goruyorum. Eline saglik."}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/resolution" "${auth_tech[@]}" \
      -d '{"resolutionNote":"Klima fan unitesi degistirildi, kabin ici sicaklik 34C seviyesine dustu. Termal macun yenilendi, 30 dk gozlem yapildi."}' >/dev/null
    curl -sf -X PATCH "$GW/api/v1/incidents/$ISINMA_ID/status" "${auth_noc[@]}" -d '{"status":"KAPANDI"}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$ISINMA_ID/resolution/rate" "${auth_noc[@]}" -d '{"rating":5,"isPermanent":true}' >/dev/null
    say "  -> COZULDU + KAPANDI + 5 yildiz (gamification puanlari islendi)"
  fi
fi

# --- 5. Canli harita demosu: KRITIK Kadikoy vakasini YOLDA'da birak ----------
GUC_ID=$(pick "BTS-IST-010" "id")
GUC_TEAM=$(pick "BTS-IST-010" "assignedTeamName")
GUC_STATUS=$(pick "BTS-IST-010" "status")
if [ -n "$GUC_ID" ] && [ -n "$GUC_TEAM" ] && [ "$GUC_STATUS" = "ATANDI" ]; then
  TECH_EMAIL=$(tech_email "$GUC_TEAM")
  if [ -n "$TECH_EMAIL" ]; then
    say "Canli akis demosu: Kadikoy KRITIK vakasi YOLDA durumuna aliniyor ($GUC_TEAM)"
    TECH=$(login "$TECH_EMAIL")
    curl -sf -X PATCH "$GW/api/v1/incidents/$GUC_ID/status" \
      -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' -d '{"status":"YOLDA"}' >/dev/null
    curl -sf -X POST "$GW/api/v1/incidents/$GUC_ID/messages" \
      -H "Authorization: Bearer $TECH" -H 'Content-Type: application/json' \
      -d '{"content":"Jenerator ve yedek aku setini aldim, Kadikoy sahiline hareket ettim."}' >/dev/null
    say "  -> Harita ekranini acin: arac rota uzerinde CANLI ilerliyor"
  fi
fi

# --- 6. Bir vakada da MUDAHALE surecini baslat (Atasehir) --------------------
BAG_ID=$(pick "BTS-IST-014" "id")
BAG_TEAM=$(pick "BTS-IST-014" "assignedTeamName")
BAG_STATUS=$(pick "BTS-IST-014" "status")
if [ -n "$BAG_ID" ] && [ -n "$BAG_TEAM" ] && [ "$BAG_STATUS" = "ATANDI" ]; then
  TECH_EMAIL=$(tech_email "$BAG_TEAM")
  if [ -n "$TECH_EMAIL" ]; then
    TECH=$(login "$TECH_EMAIL")
    auth_tech=(-H "Authorization: Bearer $TECH" -H 'Content-Type: application/json')
    curl -sf -X PATCH "$GW/api/v1/incidents/$BAG_ID/status" "${auth_tech[@]}" -d '{"status":"YOLDA"}' >/dev/null
    curl -sf -X PATCH "$GW/api/v1/incidents/$BAG_ID/status" "${auth_tech[@]}" -d '{"status":"MUDAHALE_EDILIYOR"}' >/dev/null
    curl -sf -X PATCH "$GW/api/v1/incidents/$BAG_ID/status" "${auth_tech[@]}" -d '{"status":"PARCA_BEKLENIYOR","reason":"SFP modulu arizali, yedek talep edildi"}' >/dev/null
    say "Atasehir baglanti vakasi PARCA_BEKLENIYOR durumunda (edge-case gosterimi)"
  fi
fi

echo
say "Demo senaryosu tamam. Ekranlar:"
say "  Musteri:     05551234567 / OTP 1234  -> vakalarim + yeni ariza bildir"
say "  NOC:         noc@netopscell.com / $PASS -> Operasyon Merkezi haritasi (canli arac!)"
say "  Supervizor:  supervizor@netopscell.com / $PASS -> dashboard + AI dogruluk + SLA"
say "  Teknisyen:   saha.donanim@netopscell.com / $PASS -> vakalarim + rota + profil/rozet"
say "  Liderlik tablosu ve rozetler icin: teknisyen profil sayfasi"
