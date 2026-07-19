import { useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { useStore } from "../state/store";
import { api } from "../lib/ipc";

/*
 * Uygulama içi YouTube oynatıcı — native child webview'i YouTube'un TAM izleme
 * sayfasına (youtube.com/watch, embed DEĞİL) üst-düzey götürür → Error 153 yok.
 * DOM'daki kutu konumuna yerleşir; native görünüm DOM'un üstünde olduğundan
 * kapatma düğmeleri kutunun DIŞINDA durur.
 */
export default function VideoModal() {
  const videoId = useStore((s) => s.videoId);
  const setVideoId = useStore((s) => s.setVideoId);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoId) {
      api.closeVideo().catch(() => {});
      return;
    }
    const place = () => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Tam izleme sayfası (embed DEĞİL) → Error 153 yok, her zaman oynar.
      api
        .openVideo(`https://www.youtube.com/watch?v=${videoId}`, r.x, r.y, r.width, r.height)
        .catch((e) => console.error("openVideo", e));
    };
    // Layout'un oturması için bir kare bekle.
    const raf = requestAnimationFrame(place);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setVideoId(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      api.closeVideo().catch(() => {});
    };
  }, [videoId, setVideoId]);

  if (!videoId) return null;

  return (
    <div
      className="ovl"
      onClick={() => setVideoId(null)}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.82)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* Native video webview bu kutunun konumunu kaplar (boş kalır). */}
      <div
        ref={boxRef}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1200px, 92vw)", height: "min(780px, 86vh)", borderRadius: 12, overflow: "hidden", background: "#000", boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); api.openUrl(`https://www.youtube.com/watch?v=${videoId}`); }}
        title="Open on YouTube"
        style={{ position: "fixed", top: 18, right: 66, width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <ExternalLink size={16} strokeWidth={2} />
      </button>
      <button
        onClick={() => setVideoId(null)}
        title="Close (Esc)"
        style={{ position: "fixed", top: 18, right: 18, width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <X size={17} strokeWidth={2} />
      </button>
    </div>
  );
}
