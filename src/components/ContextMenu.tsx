import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useStore } from "../state/store";

/*
 * Sağ tık bağlam menüsü — makale / feed / klasör satırları (RSS Guard eşdeğeri).
 * Durum store.ctx'te; herhangi bir tıklama/Esc kapatır.
 */
const MENU_W = 220;

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "7px 11px",
  borderRadius: 7,
  fontSize: 12.5,
  color: "var(--fg)",
  textAlign: "left",
};

function Item({
  label,
  onClick,
  danger,
  right,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  return (
    <button
      className="rowh"
      onClick={onClick}
      style={{ ...itemStyle, color: danger ? "#c05555" : "var(--fg)" }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </button>
  );
}

function Sep() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "5px 7px" }} />;
}

export default function ContextMenu() {
  const ctx = useStore((s) => s.ctx);
  const closeCtx = useStore((s) => s.closeCtx);
  const articles = useStore((s) => s.articles);
  const feeds = useStore((s) => s.feeds);
  const folders = useStore((s) => s.folders);
  const spaces = useStore((s) => s.spaces);
  const [sub, setSub] = useState<null | "spaces" | "folders">(null);
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => {
    setSub(null);
    setNewFolder("");
  }, [ctx]);
  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCtx();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx, closeCtx]);

  if (!ctx) return null;
  const st = () => useStore.getState();
  const run = (fn: () => void | Promise<unknown>) => {
    closeCtx();
    void fn();
  };

  let items: ReactNode = null;
  let estH = 200;

  if (ctx.kind === "article") {
    const a = articles.find((x) => x.id === ctx.id);
    if (!a) return null;
    estH = 300;
    items = (
      <>
        <Item
          label={a.unread ? "Mark as read" : "Mark as unread"}
          onClick={() => run(() => st().markArticleRead(a.id, a.unread))}
        />
        <Item
          label={a.starred ? "Unstar" : "Star"}
          onClick={() => run(() => st().starArticle(a.id))}
        />
        <Item
          label={a.later ? "Remove from Read Later" : "Add to Read Later"}
          onClick={() => run(() => st().laterArticle(a.id))}
        />
        {spaces.length > 0 && (
          <div style={{ position: "relative" }} onMouseEnter={() => setSub("spaces")} onMouseLeave={() => setSub(null)}>
            <button className="rowh" style={itemStyle}>
              <span style={{ flex: 1 }}>Add to space</span>
              <span style={{ color: "var(--faint)" }}>▸</span>
            </button>
            {sub === "spaces" && (
              <div
                className="pop"
                style={{ position: "absolute", left: "100%", top: -4, width: 170, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 5, zIndex: 47 }}
              >
                {spaces.map((sp) => (
                  <button
                    key={sp.id}
                    className="rowh"
                    onClick={() => run(() => st().addArticleToSpace(a.id, sp.id))}
                    style={itemStyle}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: sp.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{sp.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Sep />
        <Item label="Refetch full text" onClick={() => run(() => st().refetchFullTextFor(a.id))} />
        <Item label="Open in browser" onClick={() => run(() => st().openUrl(a.url))} />
        <Item label="Copy link" onClick={() => run(() => st().copyText(a.url))} />
      </>
    );
  } else if (ctx.kind === "feed") {
    const f = feeds.find((x) => x.id === ctx.id);
    if (!f) return null;
    estH = 230;
    items = (
      <>
        {/* Yeniden adlandır — mevcut adla dolu, ⏎ ile kaydet */}
        <input
          defaultValue={f.name}
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim();
            if (e.key === "Enter" && v && v !== f.name) {
              e.preventDefault();
              run(() => st().renameFeed(f.id, v));
            }
          }}
          onClick={(e) => e.stopPropagation()}
          title="Rename (⏎)"
          style={{ width: "calc(100% - 8px)", margin: 4, border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", fontSize: 12.5, color: "var(--fg)", background: "var(--chip)", outline: "none" }}
        />
        <Sep />
        <Item label="Refresh" onClick={() => run(() => st().refreshFeed(f.id))} />
        <Item label="Mark all as read" onClick={() => run(() => st().markAllReadFor("feed", f.id))} />
        <Item
          label="Fetch full text from site"
          onClick={() => run(() => st().toggleOnlySummary(f.id, !f.onlySummary))}
          right={f.onlySummary ? <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span> : undefined}
        />
        <Sep />
        {/* Klasöre taşı ▸ — klasör listesi + klasörden çıkar + yeni klasör */}
        <div style={{ position: "relative" }} onMouseEnter={() => setSub("folders")} onMouseLeave={() => setSub(null)}>
          <button className="rowh" style={itemStyle}>
            <span style={{ flex: 1 }}>Move to folder</span>
            <span style={{ color: "var(--faint)" }}>▸</span>
          </button>
          {sub === "folders" && (
            <div
              className="pop"
              style={{ position: "absolute", left: "100%", top: -4, width: 190, maxHeight: 320, overflowY: "auto", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 5, zIndex: 47 }}
            >
              {f.folderId && (
                <>
                  <Item label="Remove from folder" onClick={() => run(() => st().moveFeedToFolder(f.id, null))} />
                  <Sep />
                </>
              )}
              {folders.map((fo) => (
                <button
                  key={fo.id}
                  className="rowh"
                  onClick={() => run(() => st().moveFeedToFolder(f.id, fo.id))}
                  style={itemStyle}
                >
                  <span style={{ flex: 1 }}>{fo.title}</span>
                  {f.folderId === fo.id && <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>}
                </button>
              ))}
              {folders.length > 0 && <Sep />}
              <input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolder.trim()) {
                    e.preventDefault();
                    run(() => st().moveFeedToNewFolder(f.id, newFolder.trim()));
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="New folder + ⏎"
                style={{ width: "calc(100% - 8px)", margin: 4, border: "1px dashed var(--border)", borderRadius: 7, padding: "5px 8px", fontSize: 12, color: "var(--fg)", background: "transparent", outline: "none" }}
              />
            </div>
          )}
        </div>
        <Sep />
        <Item label="Copy feed link" onClick={() => run(() => st().copyText(f.url))} />
        <Sep />
        <Item
          label="Delete feed…"
          danger
          onClick={() =>
            run(async () => {
              const ok = await confirm(`Remove "${f.name}" and its articles?`, {
                title: "Delete Feed",
                kind: "warning",
              });
              if (ok) await st().deleteFeed(f.id);
            })
          }
        />
      </>
    );
  } else if (ctx.kind === "folder") {
    const fo = folders.find((x) => x.id === ctx.id);
    if (!fo) return null;
    estH = 250;
    items = (
      <>
        <input
          defaultValue={fo.title}
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim();
            if (e.key === "Enter" && v && v !== fo.title) {
              e.preventDefault();
              run(() => st().renameFolder(fo.id, v));
            }
          }}
          onClick={(e) => e.stopPropagation()}
          title="Rename (⏎)"
          style={{ width: "calc(100% - 8px)", margin: 4, border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", fontSize: 12.5, color: "var(--fg)", background: "var(--chip)", outline: "none" }}
        />
        <Sep />
        <Item label="Refresh" onClick={() => run(() => st().refreshFolder(fo.id))} />
        <Item label="Mark all as read" onClick={() => run(() => st().markAllReadFor("folder", fo.id))} />
        <Item
          label="Add feed to this folder…"
          onClick={() =>
            run(() => {
              st().setAddFeedFolder(fo.id);
              st().setOverlay("addfeed");
            })
          }
        />
        <Sep />
        <Item
          label="Delete folder…"
          danger
          onClick={() =>
            run(async () => {
              const ok = await confirm(
                `Delete folder "${fo.title}"? (Its feeds aren't deleted; they become unfiled.)`,
                { title: "Delete Folder", kind: "warning" },
              );
              if (ok) await st().deleteFolder(fo.id);
            })
          }
        />
      </>
    );
  } else if (ctx.kind === "smart") {
    const labels: Record<string, string> = { bugun: "Today", yildizli: "Starred", sonra: "Read Later" };
    const name = labels[ctx.id] ?? "List";
    estH = 110;
    items = (
      <>
        <Item label="Refresh all" onClick={() => run(() => st().refresh())} />
        <Item label={`Mark ${name} as read`} onClick={() => run(() => st().markAllReadFor("smart", ctx.id))} />
      </>
    );
  } else if (ctx.kind === "allroot") {
    estH = 110;
    items = (
      <>
        <Item label="Refresh all feeds" onClick={() => run(() => st().refresh())} />
        <Item label="Mark all articles as read" onClick={() => run(() => st().markAllReadFor("all", "all"))} />
      </>
    );
  } else {
    const sp = spaces.find((x) => x.id === ctx.id);
    if (!sp) return null;
    estH = 170;
    items = (
      <>
        <Item label="Refresh" onClick={() => run(() => st().refresh())} />
        <Item
          label="Edit…"
          onClick={() =>
            run(() => {
              st().setEditSpace(sp.id);
              st().setOverlay("add");
            })
          }
        />
        <Item label="Mark all as read" onClick={() => run(() => st().markAllReadFor("space", sp.id))} />
        <Sep />
        <Item
          label="Delete space…"
          danger
          onClick={() =>
            run(async () => {
              const ok = await confirm(
                `Delete space "${sp.name}" and its rule? (Articles aren't deleted.)`,
                { title: "Delete Space", kind: "warning" },
              );
              if (ok) await st().deleteSpace(sp.id);
            })
          }
        />
      </>
    );
  }

  const x = Math.min(ctx.x, window.innerWidth - MENU_W - 10);
  const y = Math.min(ctx.y, window.innerHeight - estH - 10);

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 45 }}
        onClick={closeCtx}
        onContextMenu={(e) => {
          e.preventDefault();
          closeCtx();
        }}
      />
      <div
        className="pop"
        style={{ position: "fixed", left: x, top: y, width: MENU_W, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 5, zIndex: 46 }}
      >
        {items}
      </div>
    </>
  );
}
