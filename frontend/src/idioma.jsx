import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { terjemah } from "./i18n.js";

const Ctx = createContext({ bahasa: "id", setBahasa: () => {}, t: (k) => k });

function bahasaAwal() {
  try {
    const simpan = localStorage.getItem("bahasa");
    if (["id", "en", "ja"].includes(simpan)) return simpan;
  } catch {
    /* localStorage bisa diblokir; abaikan */
  }
  const n = (navigator.language || "id").slice(0, 2);
  return ["en", "ja"].includes(n) ? n : "id";
}

export function IdiomaProvider({ children }) {
  const [bahasa, setBahasa] = useState(bahasaAwal);

  useEffect(() => {
    document.documentElement.lang = bahasa;
    try {
      localStorage.setItem("bahasa", bahasa);
    } catch {
      /* abaikan */
    }
  }, [bahasa]);

  const t = useCallback((kunci, nilai) => terjemah(bahasa, kunci, nilai), [bahasa]);
  const nilai = useMemo(() => ({ bahasa, setBahasa, t }), [bahasa, t]);
  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>;
}

export const useIdioma = () => useContext(Ctx);
