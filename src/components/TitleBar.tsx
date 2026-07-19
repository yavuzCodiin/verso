import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, RefreshCw, PanelLeft } from "lucide-react";
import { useStore } from "../state/store";

// Pencere sürükleme — data-tauri-drag-region WKWebView+Overlay'de güvenilmez;
// mousedown'da doğrudan native startDragging çağrılır. Düğme/input'ta sürükleme yok.
const INTERACTIVE = "button, input, select, a, textarea";
function startDrag(e: MouseEvent) {
  if (e.button !== 0 || e.detail >= 2) return;
  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
  getCurrentWindow().startDragging().catch(() => {});
}
function dblMaximize(e: MouseEvent) {
  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
  getCurrentWindow().toggleMaximize().catch(() => {});
}
import { SMART } from "../lib/smartList";
import type { SelKind } from "../state/types";
import type { FeedVM, FolderVM, SpaceVM } from "../lib/ipc";

/*
 * Başlık çubuğu — README §5.1. Native trafik ışıkları (Overlay) için sol 82px padding.
 * Tema düğmesi menüyü açar; ↻ gerçek fetch tetikler.
 */
function crumbFor(
  kind: SelKind,
  id: string,
  feeds: FeedVM[],
  spaces: SpaceVM[],
  folders: FolderVM[],
): string {
  if (kind === "feed") return `Feeds › ${feeds.find((f) => f.id === id)?.name ?? ""}`;
  if (kind === "folder") return `Folders › ${folders.find((f) => f.id === id)?.title ?? ""}`;
  if (kind === "space") return `Spaces › ${spaces.find((s) => s.id === id)?.name ?? ""}`;
  return SMART.find((m) => m.id === id)?.name ?? "";
}

export default function TitleBar() {
  const selKind = useStore((s) => s.selKind);
  const selId = useStore((s) => s.selId);
  const feeds = useStore((s) => s.feeds);
  const spaces = useStore((s) => s.spaces);
  const folders = useStore((s) => s.folders);
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const setOverlay = useStore((s) => s.setOverlay);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const crumb = crumbFor(selKind, selId, feeds, spaces, folders);

  return (
    <div
      onMouseDown={startDrag}
      onDoubleClick={dblMaximize}
      style={{ height: 50, display: "flex", alignItems: "center", gap: 14, padding: "0 16px 0 82px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--panel)", transition: "background var(--tr)" }}
    >
      <button
        className="iconh"
        onClick={toggleSidebar}
        title="Collapse/expand sidebar (⌘\)"
        style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: -6 }}
      >
        <PanelLeft size={16} strokeWidth={1.6} color={sidebarOpen ? "var(--dim)" : "var(--accent)"} />
      </button>
      <span style={{ fontFamily: "var(--titlefont)", fontWeight: 600, fontSize: 16, letterSpacing: "-.01em", color: "var(--fg)" }}>Verso</span>
      <span style={{ fontSize: 12, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{crumb}</span>
      <div style={{ flex: 1 }} />

      <button className="trigger" onClick={() => setOverlay("cmd")} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--chip)", borderRadius: 8, padding: "6px 12px", width: 250 }}>
        <Search size={12} color="var(--faint)" strokeWidth={1.5} />
        <span style={{ fontSize: 12.5, color: "var(--faint)" }}>Search or command…</span>
        <span style={{ marginLeft: "auto", font: "11px ui-monospace, Menlo, monospace", color: "var(--faint)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px" }}>⌘K</span>
      </button>

      <button className="iconh" onClick={() => refresh()} title="Refresh" style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <RefreshCw size={16} color="var(--accent)" strokeWidth={1.6} style={{ animation: refreshing ? "vspin .7s linear infinite" : undefined, transformOrigin: "center" }} />
      </button>

      <button className="iconh" onClick={() => setOverlay("theme")} title="Theme" style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: "linear-gradient(135deg, var(--reader) 0 50%, var(--accent) 50% 100%)", border: "1px solid var(--border)", boxShadow: "inset 0 0 0 1px var(--panel)" }} />
      </button>
    </div>
  );
}
