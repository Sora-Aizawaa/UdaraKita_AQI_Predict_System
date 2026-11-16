"""Fitur HARUS identik dengan notebook (diverifikasi lewat tes paritas)."""
import numpy as np
import pandas as pd

KOLOM_DASAR = [
    "pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "sulphur_dioxide",
    "ozone", "aerosol_optical_depth", "uv_index", "us_aqi",
]


def agregasi_harian(hourly: dict, jam_minimum: int = 20) -> pd.DataFrame:
    """Data per jam (waktu lokal kota) -> rata-rata harian, sama seperti dataset latih."""
    df = pd.DataFrame(hourly)
    df["time"] = pd.to_datetime(df["time"])
    df = df.set_index("time").apply(pd.to_numeric, errors="coerce")
    harian = df.resample("D").mean()
    jam_valid = df["us_aqi"].resample("D").count()
    harian = harian[jam_valid >= jam_minimum]      # buang hari yang datanya bolong
    harian.index.name = "date"
    return harian


def buat_fitur(d: pd.DataFrame, kolom_fitur: list) -> pd.DataFrame:
    f = d.copy()
    for lag in [1, 2, 3, 7]:
        f[f"aqi_lag{lag}"] = f["us_aqi"].shift(lag)
        f[f"pm25_lag{lag}"] = f["pm2_5"].shift(lag)
    f["aqi_rata7"] = f["us_aqi"].rolling(7).mean()
    bulan = f.index.month
    f["bulan_sin"] = np.sin(2 * np.pi * bulan / 12)
    f["bulan_cos"] = np.cos(2 * np.pi * bulan / 12)
    return f[kolom_fitur]