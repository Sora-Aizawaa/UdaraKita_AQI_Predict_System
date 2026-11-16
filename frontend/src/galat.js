/** Ubah galat API menjadi pesan sesuai bahasa yang dipilih. */
export function pesanGalat(e, t) {
  if (!e) return null;
  if (e.status === 0) return t("galat.jaringan");
  if ([404, 502, 503].includes(e.status)) return t(`galat.${e.status}`);
  return t("galat.umum");
}
