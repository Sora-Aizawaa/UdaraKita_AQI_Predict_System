import asyncio
import copy
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import clients
from .features import KOLOM_DASAR, agregasi_harian, buat_fitur
from .report import kategori, polutan_utama, polutan_utama_detail
from .modelio import muat_model, verifikasi_model

BASE = Path(__file__).resolve().parent
MODEL_DIR = BASE.parent / "model"
LAPORAN_DIR = BASE.parent / "laporan"          # dibuat oleh bangun_laporan.py
TTL_DETIK = 30 * 60
IZINKAN_BELUM_VALID = os.getenv("IZINKAN_KOTA_BELUM_VALID", "false").lower() == "true"
ORIGINS = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
# Opsional: izinkan semua preview Vercel proyekmu, mis. https://nama-proyek-.*\.vercel\.app
ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None
BAHASA = {"id", "en", "ja"}

state: dict = {}
cache: dict = {}

SUMBER = [
    "Data kualitas udara: CAMS ENSEMBLE (Copernicus) melalui Open-Meteo",
    "Prakiraan cuaca: BMKG (bila tersedia) atau Open-Meteo",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["kota"] = {k["id"]: k for k in json.loads((BASE / "cities.json").read_text(encoding="utf-8"))}
    state["meta"] = json.loads((MODEL_DIR / "meta.json").read_text(encoding="utf-8"))
    state["model"] = muat_model(MODEL_DIR / state["meta"]["file_model"])
    verifikasi_model(state["model"], state["meta"])
    state["http"] = httpx.AsyncClient(timeout=20, headers={"User-Agent": "aqi-indonesia/1.0"})
    yield
    await state["http"].aclose()


app = FastAPI(title="AQI Indonesia", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_origin_regex=ORIGIN_REGEX,
                   allow_methods=["GET"], allow_headers=["*"])
(LAPORAN_DIR / "gambar").mkdir(parents=True, exist_ok=True)
app.mount("/api/laporan-model/gambar", StaticFiles(directory=LAPORAN_DIR / "gambar"), name="gambar_laporan")


def sekarang(tz: str) -> datetime:           # dipisah supaya mudah diuji
    return datetime.now(ZoneInfo(tz))


def susun_laporan(kota: dict, hourly: dict, cuaca, waktu: datetime, model, meta: dict) -> dict:
    harian = agregasi_harian(hourly)
    hari_ini = pd.Timestamp(waktu.date())
    besok = hari_ini + pd.Timedelta(days=1)

    if hari_ini not in harian.index:
        raise ValueError("Data kualitas udara hari ini belum lengkap dari sumber.")
    riwayat = harian.loc[:hari_ini].tail(8)
    if (len(riwayat) < 8 or (riwayat.index[-1] - riwayat.index[0]).days != 7
            or riwayat[KOLOM_DASAR].isna().any().any()):
        raise ValueError("Riwayat 8 hari terakhir tidak lengkap, prediksi tidak dapat dibuat.")

    aqi_hari_ini = float(riwayat["us_aqi"].iloc[-1])
    sub = {c: (None if pd.isna(riwayat[c].iloc[-1]) else float(riwayat[c].iloc[-1]))
           for c in riwayat.columns if c.startswith("us_aqi_")}

    # --- prediksi model (hanya bila kota sudah tervalidasi) ---
    valid = kota["id"] in meta["kota_tervalidasi"]
    prediksi = None
    if valid or IZINKAN_BELUM_VALID:
        fitur = buat_fitur(riwayat[KOLOM_DASAR], meta["kolom_fitur"]).iloc[[-1]]
        p = float(np.clip(model.predict(fitur)[0], 0, 500))
        mae = meta["mae_uji"].get(kota["id"], max(meta["mae_uji"].values()))
        prediksi = {
            "tanggal": str(besok.date()), "us_aqi": round(p, 1),
            "rentang": [round(max(p - mae, 0), 1), round(min(p + mae, 500), 1)],
            "galat_rata_rata_uji": mae, "tervalidasi": valid, **kategori(p),
        }

    # --- kondisi jam ini dan prakiraan per jam (CAMS, dipakai untuk tampilan) ---
    jam_df = pd.DataFrame(hourly)
    jam_df["time"] = pd.to_datetime(jam_df["time"])
    jam_df = jam_df.set_index("time").apply(pd.to_numeric, errors="coerce")
    t_now = pd.Timestamp(waktu.replace(tzinfo=None)).floor("h")

    saat_ini = None
    if t_now in jam_df.index and not pd.isna(jam_df.loc[t_now, "us_aqi"]):
        r = jam_df.loc[t_now]
        v = float(r["us_aqi"])
        sub_j = {c: (None if pd.isna(r[c]) else float(r[c])) for c in jam_df.columns if c.startswith("us_aqi_")}
        kons_j = {c: (None if pd.isna(r[c]) else float(r[c])) for c in jam_df.columns if not c.startswith("us_aqi")}
        saat_ini = {"waktu": t_now.strftime("%Y-%m-%dT%H:%M"), "us_aqi": round(v),
                    "polutan_utama": polutan_utama_detail(sub_j, kons_j), **kategori(v)}

    per_jam = [{"waktu": t.strftime("%Y-%m-%dT%H:%M"), "jam": t.strftime("%H.%M"),
                "us_aqi": round(float(v)), **{k: kategori(float(v))[k] for k in ("warna", "warna_teks")}}
               for t, v in jam_df.loc[t_now:, "us_aqi"].dropna().head(24).items()]

    cams_besok = None
    if besok in harian.index and not pd.isna(harian.loc[besok, "us_aqi"]):
        v = float(harian.loc[besok, "us_aqi"])
        cams_besok = {"us_aqi": round(v, 1), **kategori(v)}

    return {
        "kota": {k: kota[k] for k in ("id", "nama", "provinsi", "lat", "lon")},
        "diperbarui": waktu.strftime("%Y-%m-%dT%H:%M"),   # waktu setempat kota
        "tanggal_acuan": str(hari_ini.date()),
        "saat_ini": saat_ini,
        "per_jam": per_jam,
        "hari_ini": {"us_aqi": round(aqi_hari_ini, 1), "polutan_utama": polutan_utama(sub),
                     **kategori(aqi_hari_ini)},
        "prediksi_besok": prediksi,
        "alasan_tanpa_prediksi": None if prediksi else
            "Model belum divalidasi untuk kota ini, sehingga prediksi tidak ditampilkan.",
        "prakiraan_cams_besok": cams_besok,
        "riwayat": [{"tanggal": str(t.date()), "us_aqi": round(float(v), 1)}
                    for t, v in riwayat["us_aqi"].items()],
        "polutan": {c: round(float(riwayat[c].iloc[-1]), 2) for c in
                    ["pm2_5", "pm10", "ozone", "nitrogen_dioxide", "sulphur_dioxide", "carbon_monoxide"]},
        "cuaca": cuaca,
        "catatan": "Nilai hari ini adalah rata-rata 24 jam; jam yang belum terjadi berasal dari prakiraan CAMS.",
        "sumber": SUMBER,
    }


@app.get("/")
def akar():
    return {"layanan": "UdaraKita API", "dokumentasi": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {"status": "ok", "model": state["meta"]["file_model"]}


@app.get("/api/kota")
def daftar_kota():
    valid = set(state["meta"]["kota_tervalidasi"])
    return [{"id": k["id"], "nama": k["nama"], "provinsi": k["provinsi"],
             "model_tervalidasi": k["id"] in valid} for k in state["kota"].values()]


async def ambil_laporan(kota_id: str) -> dict:
    """Laporan satu kota, dengan cache 30 menit (dipakai bersama oleh /api/laporan dan /api/peta)."""
    kota = state["kota"].get(kota_id)
    if kota is None:
        raise HTTPException(404, "Kota tidak ditemukan")

    tersimpan = cache.get(kota_id)
    if tersimpan and time.time() - tersimpan[0] < TTL_DETIK:
        return tersimpan[1]

    try:
        hourly = await clients.ambil_kualitas_udara(state["http"], kota)
    except httpx.HTTPError:
        raise HTTPException(502, "Sumber data kualitas udara tidak dapat dihubungi, coba lagi nanti.")
    cuaca = await clients.ambil_cuaca(state["http"], kota)

    try:
        data = susun_laporan(kota, hourly, cuaca, sekarang(kota["tz"]),
                             state["model"], state["meta"])
    except ValueError as e:
        raise HTTPException(503, str(e))

    cache[kota_id] = (time.time(), data)
    return data


@app.get("/api/laporan/{kota_id}")
async def laporan(kota_id: str):
    return await ambil_laporan(kota_id)


@app.get("/api/peta")
async def peta():
    """Ringkasan semua kota untuk halaman peta: AQI sekarang, AQI besok, suhu, hujan hari ini."""
    tersimpan = cache.get("_peta")
    if tersimpan and time.time() - tersimpan[0] < TTL_DETIK:
        return tersimpan[1]

    batas = asyncio.Semaphore(4)               # sopan terhadap API sumber dan hemat RAM di Render gratis

    async def satu(k: dict) -> dict:
        dasar = {"id": k["id"], "nama": k["nama"], "provinsi": k["provinsi"],
                 "lat": k["lat"], "lon": k["lon"], "aqi_sekarang": None, "aqi_besok": None,
                 "sumber_besok": None, "suhu_c": None, "hujan_mm": None, "kondisi_kode": None}
        async with batas:
            try:
                d = await ambil_laporan(k["id"])
            except HTTPException:
                return dasar
            except Exception:                    # satu kota bermasalah tidak boleh merusak seluruh peta
                logging.getLogger("aqi").exception("Peta: kota %s gagal", k["id"])
                return dasar
        saat = d.get("saat_ini")
        dasar["aqi_sekarang"] = saat["us_aqi"] if saat else round(d["hari_ini"]["us_aqi"])
        p, c = d.get("prediksi_besok"), d.get("prakiraan_cams_besok")
        if p:
            dasar["aqi_besok"], dasar["sumber_besok"] = round(p["us_aqi"]), "model"
        elif c:
            dasar["aqi_besok"], dasar["sumber_besok"] = round(c["us_aqi"]), "cams"
        cu = d.get("cuaca") or {}
        sek = cu.get("sekarang") or {}
        harian = (cu.get("open_meteo") or {}).get("harian") or []
        dasar["suhu_c"] = sek.get("suhu_c")
        dasar["kondisi_kode"] = sek.get("kondisi_kode")
        dasar["hujan_mm"] = harian[0]["hujan_mm"] if harian else None
        return dasar

    daftar = await asyncio.gather(*[satu(k) for k in state["kota"].values()])
    if all(x["aqi_sekarang"] is None for x in daftar):
        raise HTTPException(502, "Sumber data tidak dapat dihubungi, coba lagi nanti.")
    data = {"diperbarui": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"), "kota": daftar}
    cache["_peta"] = (time.time(), data)
    return data


def terjemahkan_laporan(data: dict, bahasa: str) -> dict:
    """Terjemahkan teks laporan model memakai laporan/terjemahan.json.

    Tabel terjemahan berkunci teks Indonesia aslinya; teks yang belum ada di tabel
    (mis. setelah laporan dibangun ulang) tetap tampil dalam bahasa Indonesia.
    Keluaran sel notebook (angka, tabel pandas, gambar) tidak diubah.
    """
    if bahasa == "id":
        return data
    berkas = LAPORAN_DIR / "terjemahan.json"
    if not berkas.exists():
        return data
    tabel = json.loads(berkas.read_text(encoding="utf-8")).get(bahasa) or {}
    if not tabel:
        return data

    def tr(x):
        return tabel.get(x, x) if isinstance(x, str) else x

    out = copy.deepcopy(data)
    out["judul"] = tr(out.get("judul"))
    out["kesimpulan_md"] = tr(out.get("kesimpulan_md"))
    for tab in out.get("tab", []):
        tab["nama"] = tr(tab.get("nama"))
        for bagian in tab.get("bagian", []):
            bagian["judul"] = tr(bagian.get("judul"))
            for it in bagian.get("item", []):
                if it.get("jenis") == "markdown":
                    it["isi"] = tr(it.get("isi"))
                for kunci in ("keterangan", "judul"):
                    if it.get(kunci):
                        it[kunci] = tr(it[kunci])
    return out


@app.get("/api/laporan-model")
def laporan_model(bahasa: str = "id"):
    """Laporan evaluasi model: nilai dan gambar diambil dari output notebook (lihat bangun_laporan.py)."""
    berkas = LAPORAN_DIR / "laporan.json"
    if not berkas.exists():
        raise HTTPException(
            404, 'Laporan model belum dibuat. Jalankan: python bangun_laporan.py "path\\ke\\notebook.ipynb"')
    data = json.loads(berkas.read_text(encoding="utf-8"))
    data = terjemahkan_laporan(data, bahasa if bahasa in BAHASA else "id")
    meta = state["meta"]
    nama = {k["id"]: k["nama"] for k in state["kota"].values()}
    for r in data.get("ringkasan_kota", []):
        r["nama"] = nama.get(r["kota"], r["kota"].title())
    data["model_aktif"] = {
        "versi": meta.get("versi"), "file_model": meta["file_model"],
        "dilatih_pada": meta.get("dilatih_pada"), "versi_xgboost": meta.get("versi_xgboost"),
        "kota_tervalidasi": meta["kota_tervalidasi"],
    }
    return data
