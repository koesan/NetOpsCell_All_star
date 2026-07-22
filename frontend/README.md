# Frontend (Web)

React + TypeScript (Vite) + Tailwind CSS. Turkcell kurumsal tasarım sistemi: lacivert (`#001E62`) +
sarı (`#FFED00`) marka paleti, Inter tipografisi (self-hosted, CDN bağımlılığı yok), Framer Motion
animasyonları, Recharts grafikleri, React Leaflet harita.

Detaylı ekran haritası ve UI/UX kararları için bkz. [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — Bölüm 13.

## Durum: Faz 2 tamamlandı

Tüm rol bazlı ekranlar gerçek API'lara bağlı ve gerçek tarayıcıda (Playwright, headless Chromium)
test edildi — konsol hatası yok.

| Rol | Ekranlar |
|---|---|
| Müşteri | Arıza bildir (telemetri formu + AI sonuç paneli), Vakalarım |
| Saha Teknisyeni | Vakalarım, Vaka detayı (harita + durum akışı + çözüm notu + saha iletişimi), Profilim (puan/rozet/seviye/liderlik) |
| NOC Operatörü | Vakalar, Vaka detayı (onay/atama/değerlendirme), Liderlik Tablosu |
| Süpervizör | Dashboard (grafikler + harita + saha performansı + bekleyen kuyruk), Vakalar, Liderlik Tablosu |
| Admin | Personel Yönetimi (liste + oluşturma), Audit Log |

Tasarım sistemi bileşenleri `src/components/ui/` altında (Button, Card, Badge, Input, Modal,
StatTile, loading/error/empty state'leri). Mobilde sidebar, hamburger menü + slide-in drawer'a
dönüşür (`src/components/layout/MobileNav.tsx`).

## Environment Değişkenleri

Bkz. [`.env.example`](./.env.example)

## Çalıştırma (yerel geliştirme)

```bash
npm install
npm run dev
```

Docker Compose içinde `nginx` ile build edilmiş halde servis edilir (bkz. kök `docker-compose.yml`).
