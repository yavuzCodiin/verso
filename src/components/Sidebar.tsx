import { useState, type CSSProperties, type DragEvent } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "../state/store";
import { SMART } from "../lib/smartList";
import type { FeedVM } from "../lib/ipc";

/*
 * Kenar çubuğu — README §5.2 + klasörler (açılır/kapanır, geçerli HTML: chevron
 * ayrı buton) + sağ tık menüleri + sürükle-bırak (feed → klasör / KAYNAKLAR başlığı
 * → klasörden çıkar).
 */
const sectionLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "var(--faint)",
  textTransform: "uppercase",
  letterSpacing: ".12em",
};
const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 10px",
  margin: "0 8px",
  width: "calc(100% - 16px)",
  borderRadius: 8,
  textAlign: "left",
};
const countStyle: CSSProperties = { font: "11px ui-monospace, Menlo, monospace" };
const DND_TYPE = "text/verso-feed-id";

export default function Sidebar() {
  const selKind = useStore((s) => s.selKind);
  const selId = useStore((s) => s.selId);
  const feeds = useStore((s) => s.feeds);
  const folders = useStore((s) => s.folders);
  const spaces = useStore((s) => s.spaces);
  const smart = useStore((s) => s.smart);
  const settings = useStore((s) => s.settings);
  const collapsed = useStore((s) => s.collapsed);
  const selectList = useStore((s) => s.selectList);
  const setOverlay = useStore((s) => s.setOverlay);
  const toggleFolder = useStore((s) => s.toggleFolder);
  const openCtx = useStore((s) => s.openCtx);
  const moveFeedToFolder = useStore((s) => s.moveFeedToFolder);
  const setAddFeedFolder = useStore((s) => s.setAddFeedFolder);

  // DnD hedef vurgusu: klasör id ya da "root" (klasörden çıkar).
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const smartCount = (id: string) =>
    id === "bugun" ? smart.bugun : id === "yildizli" ? smart.yildizli : smart.sonra;

  const looseFeeds = feeds.filter((f) => !f.folderId);
  const folderFeeds = (fid: string) => feeds.filter((f) => f.folderId === fid);
  const folderUnread = (fid: string) => folderFeeds(fid).reduce((n, f) => n + f.count, 0);

  const dropHandlers = (target: string, folderId: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(DND_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(target);
      }
    },
    // Yalnızca hedef bölgeden GERÇEKTEN çıkınca temizle (çocuklara geçiş sayılmaz).
    onDragLeave: (e: DragEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (!el.contains(e.relatedTarget as Node | null)) {
        setDropTarget((t) => (t === target ? null : t));
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const feedId = e.dataTransfer.getData(DND_TYPE);
      if (feedId) moveFeedToFolder(feedId, folderId);
    },
  });

  const FeedRow = ({ m, indent }: { m: FeedVM; indent?: boolean }) => {
    const active = selKind === "feed" && selId === m.id;
    return (
      <button
        className="rowh"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DND_TYPE, m.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => selectList("feed", m.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          openCtx("feed", m.id, e.clientX, e.clientY);
        }}
        style={{
          ...rowBase,
          padding: "5px 10px",
          ...(indent ? { paddingLeft: 26 } : null),
          ...(active ? { background: "var(--soft)" } : null),
        }}
      >
        {m.iconData ? (
          <img src={m.iconData} alt="" style={{ width: 18, height: 18, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 18, height: 18, borderRadius: 5, background: m.color, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {m.letter}
          </span>
        )}
        <span style={{ flex: 1, fontSize: 13, color: active ? "var(--fg)" : "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.name}
        </span>
        <span style={{ ...countStyle, color: "var(--faint)" }}>{m.count > 0 ? m.count : ""}</span>
      </button>
    );
  };

  return (
    <div
      className="vscroll"
      style={{ width: 246, background: "var(--panel)", borderRight: "1px solid var(--border)", flexShrink: 0, display: "flex", flexDirection: "column", padding: "12px 0", transition: "background var(--tr)" }}
    >
      {/* ── Akıllı ── */}
      <div style={{ padding: "2px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={sectionLabel}>Smart</span>
      </div>
      {SMART.map((m) => {
        const active = selKind === "smart" && selId === m.id;
        return (
          <button
            key={m.id}
            className="rowh"
            onClick={() => selectList("smart", m.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              openCtx("smart", m.id, e.clientX, e.clientY);
            }}
            style={{ ...rowBase, ...(active ? { background: "var(--soft)" } : null) }}
          >
            <span style={{ width: 17, textAlign: "center", fontSize: 12, color: active ? "var(--accent)" : "var(--faint)" }}>{m.icon}</span>
            <span style={{ flex: 1, fontSize: 13, color: active ? "var(--fg)" : "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
            <span style={{ ...countStyle, color: "var(--faint)" }}>{smartCount(m.id)}</span>
          </button>
        );
      })}

      {/* ── Alanlar ── */}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...sectionLabel, flex: 1 }}>Spaces</span>
        <button className="plush" onClick={() => setOverlay("add")} title="New space" style={{ color: "var(--accent)", fontSize: 15, lineHeight: 1, width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
      </div>
      {spaces.map((m) => {
        const active = selKind === "space" && selId === m.id;
        return (
          <button
            key={m.id}
            className="rowh"
            onClick={() => selectList("space", m.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              openCtx("space", m.id, e.clientX, e.clientY);
            }}
            style={{ ...rowBase, ...(active ? { background: "var(--soft)", boxShadow: `inset 3px 0 0 ${m.color}` } : null) }}
          >
            <span style={{ width: 17, display: "flex", justifyContent: "center" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: m.color }} /></span>
            <span style={{ flex: 1, fontSize: 13, color: active ? "var(--fg)" : "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
            <span style={{ ...countStyle, color: active ? "var(--accent)" : "var(--faint)" }}>{m.count}</span>
          </button>
        );
      })}

      {/* ── Kaynaklar (başlık = klasörden-çıkar drop hedefi) ── */}
      <div
        {...dropHandlers("root", null)}
        onContextMenu={(e) => {
          e.preventDefault();
          openCtx("allroot", "root", e.clientX, e.clientY);
        }}
        style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, margin: "0 8px", ...(dropTarget === "root" ? { background: "var(--soft)", outline: "1px dashed var(--line)" } : null) }}
      >
        <span style={{ ...sectionLabel, flex: 1 }}>
          Feeds
          {dropTarget === "root" && <span style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· remove from folder</span>}
        </span>
        <button className="plush" onClick={() => { setAddFeedFolder(null); setOverlay("addfeed"); }} title="New feed" style={{ color: "var(--accent)", fontSize: 15, lineHeight: 1, width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
      </div>
      {folders.map((fo) => {
        const active = selKind === "folder" && selId === fo.id;
        const isOpen = !collapsed[fo.id];
        const members = folderFeeds(fo.id);
        if (members.length === 0) return null;
        const isDrop = dropTarget === fo.id;
        return (
          // Drop hedefi: başlık + içindeki feed'ler dahil TÜM klasör bölgesi.
          <div
            key={fo.id}
            {...dropHandlers(fo.id, fo.id)}
            style={isDrop ? { background: "var(--soft)", outline: "1px dashed var(--line)", outlineOffset: -1, borderRadius: 8 } : undefined}
          >
            {/* Geçerli HTML: satır bir div; chevron ve seçim AYRI butonlar. */}
            <div
              className="rowh"
              onContextMenu={(e) => {
                e.preventDefault();
                openCtx("folder", fo.id, e.clientX, e.clientY);
              }}
              style={{
                ...rowBase,
                padding: 0,
                gap: 0,
                ...(active ? { background: "var(--soft)" } : null),
              }}
            >
              <button
                onClick={() => toggleFolder(fo.id)}
                title={isOpen ? "Collapse" : "Expand"}
                style={{ width: 26, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", color: active ? "var(--accent)" : "var(--faint)", flexShrink: 0 }}
              >
                <ChevronRight size={12} strokeWidth={2} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .14s ease" }} />
              </button>
              <button
                onClick={() => selectList("folder", fo.id)}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 6px 0", textAlign: "left", minWidth: 0 }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: active ? "var(--fg)" : "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fo.title}
                </span>
                <span style={{ ...countStyle, color: "var(--faint)" }}>{folderUnread(fo.id) || ""}</span>
              </button>
            </div>
            {isOpen && members.map((m) => <FeedRow key={m.id} m={m} indent />)}
          </div>
        );
      })}
      {looseFeeds.map((m) => (
        <FeedRow key={m.id} m={m} />
      ))}

      <div style={{ flex: 1, minHeight: 16 }} />
      <button
        className="rowh"
        onClick={() => setOverlay("settings")}
        title="Notification and quiet hours settings"
        style={{ display: "block", width: "calc(100% - 24px)", margin: "0 12px", padding: "9px 10px", borderTop: "1px solid var(--border)", fontSize: 10.5, lineHeight: 1.6, color: "var(--faint)", textAlign: "left" }}
      >
        {settings.quietEnabled ? `Quiet hours · ${settings.quietStart}–${settings.quietEnd}` : "Quiet hours · off"}
        <br />
        {settings.notify ? "notifications on" : "notifications off"}
      </button>
    </div>
  );
}
