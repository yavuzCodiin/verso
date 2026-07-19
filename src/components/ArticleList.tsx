import { memo, useMemo } from "react";
import { CircleDot, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useStore, viewArticles } from "../state/store";
import { SMART } from "../lib/smartList";
import { fmtShort } from "../lib/format";
import type { ArticleListVM } from "../lib/ipc";
import type { CtxState } from "../state/types";

// Makale listesi — README §5.3. Satırlar memoize (büyük listede j/k akıcı kalır).
function useHeader() {
  const selKind = useStore((s) => s.selKind);
  const selId = useStore((s) => s.selId);
  const feeds = useStore((s) => s.feeds);
  const folders = useStore((s) => s.folders);
  const spaces = useStore((s) => s.spaces);
  const count = useStore((s) => s.articles.length);
  if (selKind === "feed") {
    const f = feeds.find((x) => x.id === selId);
    return { kickerShow: false, kickerText: "Feed", kickerColor: "var(--accent)", title: f?.name ?? "Feed", sub: `${count} articles` };
  }
  if (selKind === "folder") {
    const fo = folders.find((x) => x.id === selId);
    return { kickerShow: false, kickerText: "Folder", kickerColor: "var(--accent)", title: fo?.title ?? "Folder", sub: `${count} articles` };
  }
  if (selKind === "space") {
    const sp = spaces.find((x) => x.id === selId);
    return { kickerShow: true, kickerText: "Space · rules + manual", kickerColor: sp?.color ?? "var(--accent)", title: sp?.name ?? "Space", sub: `${count} articles` };
  }
  const m = SMART.find((x) => x.id === selId);
  return { kickerShow: false, kickerText: "Smart list", kickerColor: "var(--accent)", title: m?.name ?? "List", sub: `${count} articles` };
}

const kbd = { fontFamily: "ui-monospace, Menlo, monospace", color: "var(--dim)", fontWeight: 600 } as const;

type OpenCtx = (kind: CtxState["kind"], id: string, x: number, y: number) => void;

const ArticleRow = memo(function ArticleRow({
  a,
  active,
  onSelect,
  onCtx,
}: {
  a: ArticleListVM;
  active: boolean;
  onSelect: (id: string) => void;
  onCtx: OpenCtx;
}) {
  const read = !a.unread && !active;
  const showDek = !!a.dek && (active || a.unread);
  return (
    <button
      className="rowh art-row"
      onClick={() => onSelect(a.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onCtx("article", a.id, e.clientX, e.clientY);
      }}
      style={{
        display: "block",
        width: "calc(100% - 12px)",
        margin: "0 6px",
        padding: "14px 16px",
        borderRadius: 9,
        textAlign: "left",
        borderBottom: "1px solid var(--border)",
        ...(active ? { background: "var(--soft)", boxShadow: "inset 3px 0 0 var(--accent)" } : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.unread && !active ? "var(--accent)" : "transparent", flexShrink: 0, transform: "translateY(-1px)" }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: active ? "var(--accent)" : "var(--faint)", textTransform: "uppercase", letterSpacing: ".1em" }}>
          {a.feedName} · {fmtShort(a.publishedAt)} · {a.mins} min
        </span>
        <span style={{ flex: 1 }} />
        {a.starred && <span style={{ fontSize: 11, color: "var(--accent)" }}>★</span>}
      </div>
      <div style={{ fontFamily: "var(--titlefont)", fontSize: 17.5, fontWeight: read ? 400 : 500, lineHeight: 1.28, color: read ? "var(--faint)" : active ? "var(--seltext)" : "var(--fg)" }}>
        {a.title}
      </div>
      {showDek && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.dek}</div>
      )}
      {a.tags.length > 0 && (
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {a.tags.slice(0, 4).map((t) => (
            <span key={t} style={{ fontSize: 10, color: "var(--accent)", background: "var(--soft)", borderRadius: 4, padding: "2px 7px" }}>#{t}</span>
          ))}
        </div>
      )}
    </button>
  );
});

export default function ArticleList() {
  const rawArticles = useStore((s) => s.articles);
  const articleId = useStore((s) => s.articleId);
  const filterUnread = useStore((s) => s.filterUnread);
  const sortAsc = useStore((s) => s.sortAsc);
  const toggleFilterUnread = useStore((s) => s.toggleFilterUnread);
  const toggleSortAsc = useStore((s) => s.toggleSortAsc);
  const selectArticle = useStore((s) => s.selectArticle);
  const openCtx = useStore((s) => s.openCtx);
  const header = useHeader();

  const articles = useMemo(
    () => viewArticles({ articles: rawArticles, filterUnread, sortAsc, articleId }),
    [rawArticles, filterUnread, sortAsc, articleId],
  );

  return (
    <div style={{ width: 380, background: "var(--panel2)", borderRight: "1px solid var(--border)", flexShrink: 0, display: "flex", flexDirection: "column", transition: "background var(--tr)" }}>
      <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {header.kickerShow && <span style={{ width: 9, height: 9, borderRadius: 3, background: header.kickerColor }} />}
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".13em" }}>{header.kickerText}</span>
          <span style={{ flex: 1 }} />
          <button className="iconh" onClick={toggleFilterUnread} title={filterUnread ? "Show all" : "Unread only"} style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: filterUnread ? "var(--accent)" : "var(--faint)", background: filterUnread ? "var(--soft)" : "transparent" }}>
            <CircleDot size={13} strokeWidth={1.8} />
          </button>
          <button className="iconh" onClick={toggleSortAsc} title={sortAsc ? "Sort newest → oldest" : "Sort oldest → newest"} style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: sortAsc ? "var(--accent)" : "var(--faint)", background: sortAsc ? "var(--soft)" : "transparent" }}>
            {sortAsc ? <ArrowUpNarrowWide size={13} strokeWidth={1.8} /> : <ArrowDownWideNarrow size={13} strokeWidth={1.8} />}
          </button>
        </div>
        <div style={{ fontFamily: "var(--titlefont)", fontSize: 21, fontWeight: "var(--titlewt)" as unknown as number, color: "var(--fg)", marginTop: 3 }}>
          {header.title} <span style={{ color: "var(--faint)", fontSize: 15 }}>· {header.sub}</span>
        </div>
      </div>

      <div className="vscroll" style={{ flex: 1, padding: "2px 0" }}>
        {articles.length === 0 && (
          <div style={{ padding: "48px 22px", fontSize: 13, lineHeight: 1.6, color: "var(--faint)", textAlign: "center" }}>
            No articles yet.
            <br />
            Refresh feeds with ↻ (top right).
          </div>
        )}
        {articles.map((a) => (
          <ArticleRow key={a.id} a={a} active={a.id === articleId} onSelect={selectArticle} onCtx={openCtx} />
        ))}
        <div style={{ height: 8 }} />
      </div>

      <div style={{ padding: "9px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 14, fontSize: 10.5, color: "var(--faint)", flexShrink: 0 }}>
        <span><b style={kbd}>J / K</b> navigate</span>
        <span><b style={kbd}>M</b> read</span>
        <span><b style={kbd}>S</b> star</span>
        <span><b style={kbd}>R</b> read later</span>
      </div>
    </div>
  );
}
