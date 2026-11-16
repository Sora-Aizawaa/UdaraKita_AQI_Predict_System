import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

log = logging.getLogger("aqi")

URL_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality"
URL_WX = "https://api.open-meteo.com/v1/forecast"
URL_BMKG = "https://api.bmkg.go.id/publik/prakiraan-cuaca"

HOURLY_AQ = [
    "pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "sulphur_dioxide",
    "ozone", "aerosol_optical_depth", "uv_index", "us_aqi",
    "us_aqi_pm2_5", "us_aqi_pm10", "us_aqi_ozone",
    "us_aqi_nitrogen_dioxide", "us_aqi_sulphur_dioxide", "us_aqi_carbon_monoxide",
]

# Kode kondisi cuaca yang sama dipakai untuk Open-Meteo dan BMKG,
# supaya frontend cukup menerjemahkan satu set kunci ke ID / EN / JA.
# Kunci: clear, partly, cloudy, haze, fog, light_rain, rain, heavy_rain, thunder
KODE_OPEN_METEO = {
    0: "clear", 1: "clear", 2: "partly", 3: "cloudy",
    45: "fog", 48: "fog",
    51: "light_rain", 53: "light_rain", 55: "light_rain", 56: "light_rain", 57: "light_rain",
    61: "light_rain", 63: "rain", 65: "heavy_rain", 66: "rain", 67: "rain",
    80: "light_rain", 81: "rain", 82: "heavy_rain",
    95: "thunder", 96: "thunder", 99: "thunder",
}


def kondisi_open_meteo(kode):
    if kode is None:
        return None
    return KODE_OPEN_METEO.get(int(kode), "cloudy")


def kondisi_bmkg(deskripsi):
    """Teks BMKG (mis. 'Cerah Berawan', 'Hujan Ringan') -> kunci kondisi."""
    if not deskripsi:
        return None
    s = deskripsi.lower()
    if "petir" in s:
        return "thunder"
    if "lebat" in s:
        return "heavy_rain"
    if "ringan" in s:
        return "light_rain"
    if "hujan" in s:
        return "rain"
    if "kabut" in s:
        return "fog"
    if "kabur" in s or "asap" in s:
        return "haze"
    if "cerah berawan" in s:
        return "partly"
    if "berawan" in s:
        return "cloudy"
    if "cerah" in s:
        return "clear"
    return None


async def ambil_kualitas_udara(client: httpx.AsyncClient, kota: dict) -> dict:
    """10 hari ke belakang + hari ini + besok, per jam, waktu lokal kota."""
    r = await client.get(URL_AQ, params={
        "latitude": kota["lat"], "longitude": kota["lon"],
        "hourly": ",".join(HOURLY_AQ),
        "domains": "cams_global",          # sama dengan data latih
        "timezone": kota["tz"],
        "past_days": 10, "forecast_days": 2,
    })
    r.raise_for_status()
    return r.json()["hourly"]


async def _cuaca_bmkg(client: httpx.AsyncClient, adm4: str, tz: str) -> dict:
    r = await client.get(URL_BMKG, params={"adm4": adm4})
    r.raise_for_status()
    j = r.json()
    hari = j["data"][0]["cuaca"]                 # list per hari, tiap hari list per 3 jam
    jam = [e for h in hari for e in h]

    sekarang = datetime.now(ZoneInfo(tz)).replace(tzinfo=None)

    def waktu(e):
        return datetime.strptime(e["local_datetime"], "%Y-%m-%d %H:%M:%S")

    # mulai dari slot 3-jam yang masih berlaku saat ini, ambil 6 slot (= 18 jam)
    mulai = sekarang - timedelta(hours=1.5)
    ke_depan = [e for e in jam if waktu(e) >= mulai][:6] or jam[-6:]

    lok = j.get("lokasi") or {}
    lokasi = ", ".join(x for x in (lok.get("desa"), lok.get("kecamatan"), lok.get("kotkab")) if x)
    return {
        "lokasi": lokasi or None,
        "prakiraan": [{
            "waktu": e.get("local_datetime"), "suhu_c": e.get("t"),
            "kelembapan_persen": e.get("hu"), "angin_kmj": e.get("ws"),
            "hujan_mm": e.get("tp"), "kondisi": e.get("weather_desc"),
            "kondisi_kode": kondisi_bmkg(e.get("weather_desc")),
        } for e in ke_depan],
    }


async def _cuaca_open_meteo(client: httpx.AsyncClient, kota: dict) -> dict:
    r = await client.get(URL_WX, params={
        "latitude": kota["lat"], "longitude": kota["lon"], "timezone": kota["tz"],
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        "forecast_days": 3,
    })
    r.raise_for_status()
    j = r.json()
    d, c = j["daily"], j.get("current", {})
    return {
        "sekarang": {
            "suhu_c": c.get("temperature_2m"), "kelembapan_persen": c.get("relative_humidity_2m"),
            "angin_kmj": c.get("wind_speed_10m"), "kondisi": None,
            "kondisi_kode": kondisi_open_meteo(c.get("weather_code")),
        },
        "harian": [{
            "tanggal": d["time"][i], "suhu_min_c": d["temperature_2m_min"][i],
            "suhu_maks_c": d["temperature_2m_max"][i],
            "hujan_mm": d["precipitation_sum"][i], "angin_maks_kmj": d["wind_speed_10m_max"][i],
            "kondisi_kode": kondisi_open_meteo(d["weather_code"][i]),
        } for i in range(len(d["time"]))],
    }


async def ambil_cuaca(client: httpx.AsyncClient, kota: dict):
    """Open-Meteo dan BMKG diambil bersamaan; keduanya ditampilkan sebagai kotak terpisah.

    Cuaca hanya pelengkap laporan: kegagalan satu sumber tidak menggagalkan laporan,
    dan kota tanpa kode `bmkg_adm4` di cities.json hanya menampilkan Open-Meteo.
    """
    punya_bmkg = bool(kota.get("bmkg_adm4"))
    tugas = [_cuaca_open_meteo(client, kota)]
    if punya_bmkg:
        tugas.append(_cuaca_bmkg(client, kota["bmkg_adm4"], kota["tz"]))
    hasil = await asyncio.gather(*tugas, return_exceptions=True)

    for sumber, h in zip(("Open-Meteo", "BMKG"), hasil):
        if isinstance(h, Exception):
            log.warning("Cuaca %s gagal untuk %s: %r", sumber, kota["id"], h)
    om = hasil[0] if not isinstance(hasil[0], Exception) else None
    bmkg = hasil[1] if len(hasil) > 1 and not isinstance(hasil[1], Exception) else None
    if om is None and bmkg is None:
        return None

    if om:
        sekarang = om["sekarang"]
    else:                                         # hanya BMKG yang berhasil: pakai slot terdekat
        p = bmkg["prakiraan"][0]
        sekarang = {"suhu_c": p["suhu_c"], "kelembapan_persen": p["kelembapan_persen"],
                    "angin_kmj": p["angin_kmj"], "kondisi": p["kondisi"],
                    "kondisi_kode": p["kondisi_kode"]}
    return {
        "sekarang": sekarang,
        "open_meteo": {"harian": om["harian"]} if om else None,
        "bmkg": bmkg,
        "bmkg_didukung": punya_bmkg,
    }
