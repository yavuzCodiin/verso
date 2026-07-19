import { useState } from "react";
import { useStore } from "../../state/store";

/*
 * Feed Ekle modalı — README §9. URL'den gerçek feed ekler (add_feed komutu).
 * OPML içe/dışa aktarma da buradan.
 */
export default function AddFeedModal() {
  const close = useStore((s) => s.setOverlay);
  const addFeed = useStore((s) => s.addFeed);
  const importOpml = useStore((s) => s.importOpml);
  const exportOpml = useStore((s) => s.exportOpml);
  const folders = useStore((s) => s.folders);
  const targetFolder = useStore((s) => s.addFeedFolderId);
  const setAddFeedFolder = useStore((s) => s.setAddFeedFolder);

  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string>(targetFolder ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    await addFeed(u, folderId || null);
    setBusy(false);
    setAddFeedFolder(null);
    close(null);
  };

  return (
    <div className="ovl" onClick={() => close(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ width: 500, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 15, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".13em" }}>Add Feed</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              autoFocus
              placeholder="RSS/Atom URL (e.g. https://blog.rust-lang.org/feed.xml)"
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: "10px 13px", fontSize: 13.5, color: "var(--fg)", background: "transparent", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--dim)", flexShrink: 0 }}>Folder</span>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, color: "var(--fg)", background: "var(--chip)", outline: "none" }}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.55, color: "var(--faint)", marginTop: 8 }}>
            Title and site address are read automatically from the feed; the first articles are fetched right away.
          </div>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", gap: 10 }}>
            <button className="trigger" onClick={() => importOpml()} style={{ fontSize: 12.5, color: "var(--dim)", borderRadius: 8, padding: "8px 13px" }}>Import OPML…</button>
            <button className="trigger" onClick={() => exportOpml()} style={{ fontSize: 12.5, color: "var(--dim)", borderRadius: 8, padding: "8px 13px" }}>Export OPML…</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 24px", marginTop: 14, borderTop: "1px solid var(--border)" }}>
          <button className="rowh" onClick={() => close(null)} style={{ fontSize: 12.5, color: "var(--dim)", padding: "8px 14px", borderRadius: 8 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--seltext)", background: "var(--accent)", borderRadius: 8, padding: "8px 17px", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Adding…" : "Add Feed"}
          </button>
        </div>
      </div>
    </div>
  );
}
