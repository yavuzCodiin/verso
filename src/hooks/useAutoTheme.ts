import { useEffect } from "react";
import { useStore } from "../state/store";

/*
 * Otomatik gündüz/gece — README §6.
 * `auto` açıkken saat 07–19 arası Kağıt, dışında Gece uygulanır (dakikada bir kontrol).
 * Kullanıcı tema menüsünden elle seçim yapınca `chooseTheme` auto'yu kapatır.
 */
export function useAutoTheme() {
  const auto = useStore((s) => s.auto);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    if (!auto) return;
    const apply = () => {
      const h = new Date().getHours();
      const t = h >= 7 && h < 19 ? "kagit" : "gece";
      if (useStore.getState().theme !== t) setTheme(t);
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [auto, setTheme]);
}
