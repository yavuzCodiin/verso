import { useEffect } from "react";
import { useStore } from "../state/store";

/*
 * Global klavye kısayolları — README §6, prototip componentDidMount ile birebir.
 * Overlay açıkken navigasyon tuşları yok sayılır (yalnız ⌘K ve Esc çalışır).
 */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const k = e.key;

      // Metin girişindeyken yalnız ⌘K/Esc geçsin (Faz 4 komut paleti girişi için).
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      const isCmdK = (e.metaKey || e.ctrlKey) && (k === "k" || k === "K");
      if (typing && !isCmdK && k !== "Escape") return;

      if (isCmdK) {
        e.preventDefault();
        s.setOverlay(s.overlay === "cmd" ? null : "cmd");
        return;
      }
      // ⌘\ — kenar çubuğunu daralt/aç
      if ((e.metaKey || e.ctrlKey) && k === "\\") {
        e.preventDefault();
        s.toggleSidebar();
        return;
      }
      if (k === "Escape") {
        if (s.overlay) {
          e.preventDefault();
          s.setOverlay(null);
        }
        return;
      }
      if (s.overlay) return;

      if (k === "j" || k === "ArrowDown") {
        e.preventDefault();
        s.step(1);
      } else if (k === "k" || k === "ArrowUp") {
        e.preventDefault();
        s.step(-1);
      } else if (k === "s" || k === "S") {
        s.toggleStar();
      } else if (k === "m" || k === "M") {
        s.markRead();
      } else if (k === "r" || k === "R") {
        s.addLater();
      } else if (k === "v" || k === "V") {
        s.setMode("web");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
