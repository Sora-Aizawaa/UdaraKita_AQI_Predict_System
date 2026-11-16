"""Memuat model XGBoost dan memastikan prediksinya sama dengan saat dilatih."""
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost 
from xgboost import XGBRegressor

log = logging.getLogger("aqi")


def muat_model(path: Path):
    """.json / .ubj = format asli XGBoost (disarankan); .pkl = pickle lama."""
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"File model tidak ditemukan di: {path}")

    if path.suffix in (".json", ".ubj"):
        m = XGBRegressor()
        m.load_model(path)
        return m
    
    # Membaca format pickle/joblib lama
    return joblib.load(path)


def verifikasi_model(model, meta: dict) -> None:
    """Prediksi contoh dari Colab harus sama dengan prediksi di server ini.

    Model yang dimuat dengan versi XGBoost berbeda bisa terbaca tanpa error
    tetapi menghasilkan angka yang bergeser; pemeriksaan ini menangkapnya.
    """
    uji = meta.get("uji")
    if not uji:
        log.warning("meta.json tidak berisi 'uji'; pemeriksaan kecocokan model dilewati.")
        return
    X = pd.DataFrame(uji["fitur"], columns=meta["kolom_fitur"])
    prediksi = np.asarray(model.predict(X), dtype=float)
    harapan = np.asarray(uji["prediksi"], dtype=float)
    if not np.allclose(prediksi, harapan, atol=1e-3):
        selisih = float(np.abs(prediksi - harapan).max())
        raise RuntimeError(
            f"Model tidak cocok dengan hasil di Colab (selisih maks {selisih:.3f} poin). "
            f"Dilatih dengan xgboost {meta.get('versi_xgboost', '?')}; server memakai versi lain. "
            f"Samakan versi xgboost, atau simpan ulang model dari Colab."
        )
    print(f"[aqi] pemeriksaan model lulus ({len(harapan)} contoh) | xgboost {xgboost.__version__}")