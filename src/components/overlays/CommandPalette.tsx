import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useStore } from "../../state/store";
import { api, type ArticleListVM } from "../../lib/ipc";

/*
 * Komut Paleti — README §5.8. Eylemler + GLOBAL makale araması (tüm DB, SQL).
 * ↑/↓ + Enter ile gezinilebilir; sorgu 180ms debounce ile aranır.
 */
export default function CommandPalette() {
  const setOverlay = useStore((s) => s.setOverlay);
  const selectArticle = useStore((s) => s.selectArticle);
  const refresh = useStore((s) => s.refresh);
  const markAllRead = useStore((s) => s.markAllRead);
  const importOpml = useStore((s) => s.importOpml);
  const exportOpml = useStore((s) => s.exportOpml);
  const articles = useStore((s) => s.articles);
  const feeds = useStore((s) => s.feeds);

  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ArticleListVM[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setIdx(0);
  }, [query]);

  // Global arama (debounce): boş sorguda aktif listeden ilk 4.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (!q) {
        setResults(articles.slice(0, 4));
        return;
      }
      try {
        setResults(await api.searchArticles(q));
      } catch (e) {
        console.error("searchArticles", e);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, articles]);

  const actions = [
    { icon: "＋", name: "Add new feed", kbd: "A", run: () => setOverlay("addfeed") },
    { icon: "◎", name: "Create new space", kbd: "", run: () => setOverlay("add") },
    { icon: "↻", name: "Refresh all", kbd: "⌘R", run: () => { setOverlay(null); refresh(); } },
    { icon: "✓", name: "Mark all as read", kbd: "", run: () => { setOverlay(null); markAllRead(); } },
    { icon: "↧", name: "Import OPML", kbd: "", run: () => { setOverlay(null); importOpml(); } },
    { icon: "↥", name: "Export OPML", kbd: "", run: () => { setOverlay(null); exportOpml(); } },
  ];

  const flat = [...actions.map((a) => a.run), ...results.map((r) => () => selectArticle(r.id))];
  const sel = Math.min(idx, Math.max(0, flat.length - 1));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); flat[sel]?.(); }
  };

  return (
    <div className="ovl" onClick={() => setOverlay(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.28)", zIndex: 40, display: "flex", justifyContent: "center", paddingTop: 120 }}>
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ width: 600, height: "max-content", maxHeight: 440, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 15, boxShadow: "var(--shadow)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <Search size={16} color="var(--faint)" strokeWidth={1.6} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Search or command…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, color: "var(--fg)" }} />
          <span style={{ font: "11px ui-monospace, Menlo, monospace", color: "var(--faint)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>esc</span>
        </div>

        <div className="vscroll" style={{ padding: 8, overflowY: "auto" }}>
          <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em" }}>Actions</div>
          {actions.map((a, i) => (
            <button key={i} className="rowh" onClick={a.run} onMouseEnter={() => setIdx(i)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 8, ...(sel === i ? { background: "var(--hover)" } : null) }}>
              <span style={{ width: 16, textAlign: "center", color: "var(--accent)" }}>{a.icon}</span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg)" }}>{a.name}</span>
              <span style={{ font: "11px ui-monospace, Menlo, monospace", color: "var(--faint)" }}>{a.kbd}</span>
            </button>
          ))}

          <div style={{ padding: "10px 10px 4px", fontSize: 10, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em" }}>Results</div>
          {results.length === 0 && <div style={{ padding: "9px 10px", fontSize: 13, color: "var(--faint)" }}>No results</div>}
          {results.map((r, j) => {
            const gi = actions.length + j;
            const f = feeds.find((x) => x.id === r.feedId);
            return (
              <button key={r.id} className="rowh" onClick={() => selectArticle(r.id)} onMouseEnter={() => setIdx(gi)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 8, ...(sel === gi ? { background: "var(--hover)" } : null) }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: f?.color ?? "#888", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f?.letter ?? "•"}</span>
                <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--titlefont)", fontSize: 14, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                <span style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>{r.feedName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
