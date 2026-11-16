# UdaraKita – Kualitas Udara Indonesia

Web kualitas udara (US AQI) untuk 12 kota besar Indonesia: kondisi sekarang, prakiraan per jam,
**prediksi AQI besok dengan model XGBoost**, cuaca dari **BMKG** dan **Open-Meteo**, peta interaktif,
dan laporan evaluasi model. Tersedia dalam **Bahasa Indonesia, English, dan 日本語 (level JLPT N3)**.

## Fitur

- Kartu AQI saat ini, polutan utama, dan cuaca terkini (dengan ikon)
- Prakiraan AQI per jam (model CAMS) dan tren 8 hari terakhir + besok
- Prediksi AQI besok (XGBoost) lengkap dengan rentang galat dan pembanding prakiraan CAMS
- Tiga kotak data: rata-rata polutan hari ini, prakiraan **Open-Meteo**, dan prakiraan **BMKG**
- Halaman **Peta** (Leaflet + OpenStreetMap): warnai kota berdasarkan AQI sekarang, AQI besok, suhu, atau hujan
- Halaman **Laporan Model**: metrik per kota, grafik, dan kesimpulan dari notebook (ikut berganti bahasa)
- Ganti bahasa ID / EN / 日本語 di pojok kanan atas; pilihan disimpan di browser
- Mode gelap mengikuti pengaturan perangkat

## Arsitektur

```
Browser ──► Vercel (React + Vite)  ──VITE_API_URL──►  Render (FastAPI + XGBoost)
                                                         ├─ Open-Meteo  (kualitas udara CAMS + cuaca)
                                                         └─ BMKG        (prakiraan cuaca per kelurahan)
```

| Bagian   | Teknologi                                              |
|----------|--------------------------------------------------------|
| Frontend | React 18, Vite, Recharts, Leaflet                       |
| Backend  | FastAPI, httpx, pandas, XGBoost, scikit-learn          |
| Deploy   | Vercel (frontend) + Render (backend)                   |

## Struktur folder

```
.
├─ frontend/            React + Vite (deploy ke Vercel, Root Directory = frontend)
│  └─ src/              komponen, i18n.js (kamus 3 bahasa), api.js
├─ backend/             FastAPI (deploy ke Render, Root Directory = backend)
│  ├─ app/              main.py, clients.py, report.py, features.py, cities.json
│  ├─ model/            model_aqi.json + meta.json
│  └─ laporan/          laporan.json, terjemahan.json, gambar/
├─ render.yaml          Blueprint Render
├─ DEPLOY.md            tutorial deploy lengkap
└─ README.md
```

## Menjalankan di komputer sendiri

Backend (terminal 1):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (permintaan /api diteruskan ke port 8000)
```

## Endpoint API

| Method | Path                         | Isi                                                     |
|--------|------------------------------|---------------------------------------------------------|
| GET    | `/api/health`                | status server                                           |
| GET    | `/api/kota`                  | daftar kota                                             |
| GET    | `/api/laporan/{kota_id}`     | laporan lengkap satu kota                               |
| GET    | `/api/peta`                  | ringkasan semua kota untuk peta                         |
| GET    | `/api/laporan-model?bahasa=` | laporan model (`id`, `en`, `ja`)                        |

Dokumentasi interaktif: `/docs`.

## Catatan

- Prediksi adalah perkiraan statistik, **bukan** pengganti peringatan resmi.
- Data kualitas udara berasal dari model CAMS (bukan sensor stasiun).
- Prakiraan BMKG tersedia untuk kota yang punya kode `bmkg_adm4` di `backend/app/cities.json`
  (saat ini Jakarta). Cara menambah kota lain ada di `DEPLOY.md`.
- Teks laporan model diterjemahkan lewat `backend/laporan/terjemahan.json`; gambar dan keluaran sel
  notebook tetap apa adanya (bahasa Inggris).

## Sumber data dan atribusi

Kualitas udara: CAMS (Copernicus Atmosphere Monitoring Service) melalui [Open-Meteo](https://open-meteo.com/) ·
Cuaca: [Open-Meteo](https://open-meteo.com/) dan [BMKG](https://data.bmkg.go.id/) · Peta: © kontributor
[OpenStreetMap](https://www.openstreetmap.org/copyright).
