import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ExternalLink } from "lucide-react";
import { useStore } from "../../state/store";
import { useReadingProgress } from "../../hooks/useReadingProgress";
import { fmtLong } from "../../lib/format";
import { api } from "../../lib/ipc";
import ReaderToolbar from "./ReaderToolbar";
import Lightbox from "../Lightbox";

// Okuyucu — README §5.4. İçerik verso-core'dan gelen sanitize edilmiş HTML.
const SANS_STACK = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
const SERIF_STACK = "'Newsreader Variable', 'Newsreader', Georgia, serif";

// Özet önizlemesi: sanitize edilmiş HTML'in ilk N blok öğesi.
function previewHtml(html: string, maxBlocks = 3): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const kids = Array.from(tpl.content.children).slice(0, maxBlocks);
  return kids.length ? kids.map((n) => n.outerHTML).join("") : html;
}

export default function Reader() {
  const mode = useStore((s) => s.mode);
  const current = useStore((s) => s.current);
  const progress = useStore((s) => s.progress);
  const readFont = useStore((s) => s.readFont);
  const size = useStore((s) => s.size);
  const width = useStore((s) => s.width);
  const setMode = useStore((s) => s.setMode);

  const overlay = useStore((s) => s.overlay);
  const ctx = useStore((s) => s.ctx);
  const openUrl = useStore((s) => s.openUrl);
  const setVideoId = useStore((s) => s.setVideoId);

  const bodyRef = useRef<HTMLDivElement>(null);
  useReadingProgress(bodyRef);

  // Görsel lightbox (prose içindeki resme tıkla → büyüt/kaydır)
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Prose tıklamaları: resim → lightbox; bağlantı → sistem tarayıcısı
  // (aksi halde <a> uygulamanın kendi webview'ini siteye götürürdü).
  const onProseClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // YouTube kartı → uygulama içi native oynatıcı (VideoModal)
    const yt = t.closest(".verso-yt") as HTMLElement | null;
    if (yt) {
      e.preventDefault();
      const id = yt.getAttribute("data-yt-id");
      if (id) setVideoId(id);
      return;
    }
    if (t.tagName === "IMG") {
      e.preventDefault();
      setLightbox((t as HTMLImageElement).src);
      return;
    }
    const a = t.closest("a");
    if (a?.href) {
      e.preventDefault();
      openUrl(a.href);
    }
  };

  // Web modu: gerçek gömülü native webview — DOM'daki boş kabın konumuna yerleşir.
  // Overlay/menü açıkken kapatılır (native görünüm DOM'un ÜSTÜNDE kalır).
  const webRef = useRef<HTMLDivElement>(null);
  const webUrl = current?.url ?? "";
  const webActive = mode === "web" && !!webUrl && !overlay && !ctx;
  useEffect(() => {
    if (!webActive) {
      api.closeWebPreview().catch(() => {});
      return;
    }
    const el = webRef.current;
    if (!el) return;
    let raf = 0;
    const rect = () => el.getBoundingClientRect();
    const place = () => {
      const r = rect();
      api.openWebPreview(webUrl, r.x, r.y, r.width, r.height).catch(console.error);
    };
    place();
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = rect();
        api.resizeWebPreview(r.x, r.y, r.width, r.height).catch(() => {});
      });
    });
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      if (raf) cancelAnimationFrame(raf);
      api.closeWebPreview().catch(() => {});
    };
  }, [webActive, webUrl]);

  const pct = `${progress}%`;
  const showResume = progress > 0 && mode !== "web";
  const colWidth = width === "dar" ? 560 : width === "genis" ? 720 : 640;
  const scale = 1 + (size - 2) * 0.075;
  // Aa ayarları doğrudan .reader-prose öğesine (kesin uygulanır, tema-bağımsız).
  const proseStyle = {
    "--read-scale": scale,
    fontFamily: readFont === "sans" ? SANS_STACK : SERIF_STACK,
  } as CSSProperties;

  const articleHtml =
    mode === "tam"
      ? current?.contentFull ?? current?.contentSummary ?? ""
      : previewHtml(current?.contentSummary ?? "");

  return (
    <div style={{ flex: 1, background: "var(--reader)", display: "flex", flexDirection: "column", minWidth: 0, transition: "background var(--tr)" }}>
      <div style={{ height: 3, background: "var(--border)", flexShrink: 0 }}>
        <div style={{ width: pct, height: "100%", background: "var(--accent)", transition: "width .2s ease" }} />
      </div>

      <ReaderToolbar />

      <div ref={bodyRef} className="vscroll" style={{ flex: 1, minHeight: 0 }}>
        {!current ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--faint)", fontSize: 14 }}>
            Select an article, or refresh with ↻ (top right).
          </div>
        ) : mode === "web" ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px 10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--chip)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 12px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#28c840", flexShrink: 0 }} />
                <span style={{ font: "11.5px ui-monospace, Menlo, monospace", color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.url}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>built-in browser · adblock (network + cosmetic)</span>
                <button
                  className="iconh"
                  onClick={() => openUrl(current.url)}
                  title="Open in browser"
                  style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}
                >
                  <ExternalLink size={13} strokeWidth={1.7} />
                </button>
              </div>
            </div>
            {/* Gerçek site buraya gömülür (native child webview bu kabın konumunu alır). */}
            <div ref={webRef} style={{ flex: 1, minHeight: 0 }}>
              {!current.url && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--faint)", fontSize: 13 }}>
                  This article has no link.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: colWidth, margin: "0 auto", padding: "34px 44px 64px" }}>
            {showResume && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 13px", marginBottom: 26 }}>
                <span style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>Resume · {pct}</span>
                <span style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--border)" }}><span style={{ display: "block", width: pct, height: "100%", borderRadius: 2, background: "var(--accent)" }} /></span>
                <span style={{ fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>continue ↵</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10.5, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".14em" }}>
              <span>{current.feedName}</span>
              <span style={{ flex: 1, borderTop: "1px solid var(--line)" }} />
              <span style={{ color: "var(--faint)" }}>{fmtLong(current.publishedAt)}</span>
            </div>

            <h1 style={{ fontFamily: "var(--titlefont)", fontSize: 33, fontWeight: "var(--titlewt)" as unknown as number, lineHeight: 1.18, letterSpacing: "-.015em", color: "var(--fg)", margin: "16px 0 0" }}>{current.title}</h1>

            <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--readfont)", fontStyle: "italic", fontSize: 14.5, color: "var(--dim)" }}>
                {current.author ? `${current.author} · ` : ""}{current.mins} min read
              </span>
              {current.tags.slice(0, 4).map((t) => (
                <span key={t} style={{ fontSize: 10, color: "var(--accent)", background: "var(--soft)", borderRadius: 4, padding: "2px 7px" }}>#{t}</span>
              ))}
            </div>

            {/* Podcast / medya (enclosure) — README §9 */}
            {current.enclosureUrl && current.enclosureType?.startsWith("audio") && (
              <audio controls src={current.enclosureUrl} style={{ width: "100%", marginTop: 16, borderRadius: 10 }} />
            )}
            {current.enclosureUrl && current.enclosureType?.startsWith("video") && (
              <video controls src={current.enclosureUrl} style={{ width: "100%", marginTop: 16, borderRadius: 10, maxHeight: 380 }} />
            )}

            <div style={{ width: 44, borderTop: "2px solid var(--fg)", margin: "24px 0" }} />

            <div className="reader-prose" style={proseStyle} onClick={onProseClick} dangerouslySetInnerHTML={{ __html: articleHtml }} />

            {mode === "ozet" && (
              <button className="ctah" onClick={() => setMode("tam")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 20, padding: "13px 16px", border: "1px dashed var(--line)", borderRadius: 10, background: "var(--soft)", textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Read full text</span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>Fetch clean full text from the site (Readability)</span>
                <span style={{ marginLeft: "auto", color: "var(--accent)" }}>→</span>
              </button>
            )}
          </div>
        )}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
