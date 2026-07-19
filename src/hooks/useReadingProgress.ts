import { useEffect, type RefObject } from "react";
import { useStore } from "../state/store";

/*
 * Okuyucu kaydırma → ilerleme (%). README §5.4/§6/§7.
 * - Kaydırma konumundan yüzde hesaplanır (rAF ile kısılır) → 3px çubuk + "Kaldığın yer".
 * - Makale değişince en üste döner (ilerleme selectArticle/step'te zaten 0'lanır).
 * - "devam ↵": Enter'a basınca kaydedilen yüzdeye yumuşak kaydırma.
 */
export function useReadingProgress(ref: RefObject<HTMLDivElement | null>) {
  const articleId = useStore((s) => s.articleId);
  const setProgress = useStore((s) => s.setProgress);

  // Makale değişince en üste dön (scrollTop zaten 0 ise scroll olayı tetiklenmez,
  // böylece ilk yükleyişteki başlangıç ilerlemesi korunur).
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = 0;
  }, [articleId, ref]);

  // Kaydırma → yüzde.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = el.scrollHeight - el.clientHeight;
        const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
        setProgress(pct);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, setProgress]);

  // "devam ↵" — Enter ile kaydedilen yere atla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const s = useStore.getState();
      if (s.overlay || s.mode === "web" || s.progress <= 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const el = ref.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      el.scrollTo({ top: (s.progress / 100) * max, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}
