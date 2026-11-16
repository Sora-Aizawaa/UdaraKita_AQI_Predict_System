# Tutorial deploy: React ke Vercel, FastAPI ke Render, lalu dihubungkan

Urutan yang benar: **GitHub → Render (backend) → Vercel (frontend) → kembali ke Render (izin CORS)**.
Alasannya: frontend butuh URL backend, dan backend butuh URL frontend.

## 0. Persiapan

Buat akun gratis di GitHub, Render (render.com), dan Vercel (vercel.com; login dengan GitHub paling mudah).

## 1. Upload proyek ke GitHub

Dari folder proyek (yang berisi `frontend/`, `backend/`, `render.yaml`):

```bash
git init
git add .
git commit -m "UdaraKita v2"
git branch -M main
git remote add origin https://github.com/USERNAME/udarakita.git   # buat repo kosong dulu di github.com/new
git push -u origin main
```

`.gitignore` sudah mengecualikan `node_modules`, `.venv`, dan `.env`. Jangan upload folder-folder itu.

## 2. Deploy backend FastAPI ke Render

### Cara A (cepat): Blueprint

1. Render → **New +** → **Blueprint** → pilih repo `udarakita` → **Connect**.
2. Render membaca `render.yaml`. Saat diminta isi `CORS_ORIGINS`, isi sementara `http://localhost:5173`
   (nanti diganti). `CORS_ORIGIN_REGEX` boleh dikosongkan. Klik **Apply**.

### Cara B: manual

Render → **New +** → **Web Service** → pilih repo, lalu isi:

| Kolom             | Isi                                                        |
|-------------------|------------------------------------------------------------|
| Name              | `udarakita-api`                                            |
| Region            | Singapore                                                  |
| Root Directory    | `backend`                                                  |
| Runtime           | Python 3                                                   |
| Build Command     | `pip install -r requirements.txt`                          |
| Start Command     | `uvicorn app.main:app --host 0.0.0.0 --port $PORT`         |
| Instance Type     | Free                                                       |
| Health Check Path | `/api/health` (di Advanced)                                |

Environment Variables: `PYTHON_VERSION` = `3.12.10`, `CORS_ORIGINS` = `http://localhost:5173`.

### Cek hasilnya

Tunggu build selesai (beberapa menit; instalasi xgboost dan pandas cukup besar). Lalu buka:

- `https://udarakita-api.onrender.com/api/health` → `{"status":"ok",...}`
- `https://udarakita-api.onrender.com/api/kota` → daftar 12 kota
- `https://udarakita-api.onrender.com/docs` → dokumentasi interaktif

Salin URL backend (tanpa `/` di akhir). Nama `udarakita-api` bisa berbeda, pakai URL yang tampil di dashboard.

## 3. Deploy frontend React ke Vercel

1. Vercel → **Add New… → Project** → **Import** repo `udarakita`.
2. **Root Directory**: klik *Edit*, pilih `frontend`. Framework terdeteksi **Vite** (Build `npm run build`, Output `dist`).
3. Buka **Environment Variables**, tambahkan:
   - Name: `VITE_API_URL`
   - Value: `https://udarakita-api.onrender.com` (URL Render tadi, tanpa `/` di akhir)
4. Klik **Deploy**. Hasilnya URL seperti `https://udarakita.vercel.app`.

> Variabel `VITE_...` dibaca **saat build**. Kalau nanti mengubahnya, lakukan **Redeploy** di Vercel.

## 4. Hubungkan keduanya (CORS)

Browser hanya mengizinkan frontend memanggil backend yang mengizinkannya.

1. Render → service `udarakita-api` → **Environment**.
2. Ubah `CORS_ORIGINS` menjadi URL Vercel, tanpa `/` di akhir. Beberapa alamat dipisah koma:
   `https://udarakita.vercel.app,http://localhost:5173`
3. (Opsional) agar URL preview Vercel juga diterima, isi `CORS_ORIGIN_REGEX` =
   `https://udarakita-.*\.vercel\.app`
4. **Save changes**. Render otomatis deploy ulang (sekitar 1–2 menit).
5. Buka URL Vercel. Kartu AQI, peta, dan laporan model harus muncul. Coba ganti bahasa ID / EN / 日本語.

Kalau memakai domain sendiri di Vercel, tambahkan domain itu juga ke `CORS_ORIGINS`.

## 5. Update setelah deploy

`git push` ke branch `main` → Vercel dan Render otomatis deploy ulang.

## 6. Masalah yang sering muncul

| Gejala | Penyebab dan solusi |
|--------|----------------------|
| Halaman memuat lama di akses pertama, muncul pesan "Server gratis sedang bangun" | Render gratis tidur setelah ±15 menit tanpa trafik; bangun lagi dalam 30–60 detik. Untuk menguranginya, buat monitor gratis di UptimeRobot yang memanggil `/api/health` tiap 10 menit. |
| Console browser: `blocked by CORS policy` | `CORS_ORIGINS` di Render belum sama persis dengan URL Vercel (cek `https`, tanpa `/` di akhir, tanpa salah ketik). |
| Error `Failed to fetch` / data tidak pernah muncul | `VITE_API_URL` salah atau belum diisi. Perbaiki lalu **Redeploy** di Vercel. |
| Build Render gagal di `xgboost` atau Python tidak cocok | Pastikan `PYTHON_VERSION` = `3.12.10` dan `xgboost==3.4.1` di `requirements.txt` (harus sama dengan versi yang melatih model; lihat `model/meta.json`). |
| Server mati karena memori (Out of memory) | Instance gratis hanya 512 MB. Coba buka peta sesudah halaman kota selesai, atau naikkan instance ke Starter. |
| Kotak BMKG berisi "belum tersedia untuk kota ini" | Hanya kota dengan `bmkg_adm4` di `backend/app/cities.json` yang punya data BMKG (lihat bagian 7). |
| Peta kosong atau abu-abu | Periksa koneksi internet (ubin peta dari OpenStreetMap) dan pastikan `/api/peta` di backend mengembalikan data. |

## 7. Menambah kode BMKG untuk kota lain

API BMKG memakai kode wilayah tingkat kelurahan/desa (`adm4`, format Kemendagri, mis. `31.71.03.1001`).

1. Cari kode kelurahan di pusat kota yang kamu mau (dari daftar kode wilayah Kemendagri/BPS).
2. Uji di browser: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=KODE`. Kalau keluar JSON prakiraan, kodenya benar.
3. Isi `bmkg_adm4` kota itu di `backend/app/cities.json`, commit, lalu push. Kotak BMKG kota itu akan otomatis tampil.

## 8. Menambah kota baru

Tambahkan satu objek di `backend/app/cities.json` (`id`, `nama`, `provinsi`, `lat`, `lon`, `tz`, `bmkg_adm4`).
Kota baru otomatis muncul di pencarian dan peta. Prediksi model hanya tampil untuk kota yang ada di
`kota_tervalidasi` pada `model/meta.json`; kota lain memakai prakiraan CAMS.
