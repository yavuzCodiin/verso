import { useEffect, useState, type CSSProperties } from "react";
import { useStore } from "../../state/store";
import { api } from "../../lib/ipc";

/*
 * Alan Kurma/Düzenleme — README §5.7 + §9. Tam kural editörü:
 * ad/renk · anahtar kelimeler · eşleşme alanı · kapsam (tüm/seçili kaynaklar) · kaynaktan gizle.
 */
const COLORS = [
  "#a85f2e", "#4a6f8e", "#7a5f9e", "#4a7a4a",
  "#b05555", "#4a9187", "#d9a441", "#c96a4a",
];

const seg = (active: boolean): CSSProperties => ({
  flex: 1,
  textAlign: "center",
  padding: "5px 0",
  fontSize: 12,
  borderRadius: 6,
  cursor: "pointer",
  transition: "all var(--tr)",
  ...(active
    ? { color: "var(--accent)", border: "1px solid var(--accent)", background: "var(--soft)", fontWeight: 600 }
    : { color: "var(--dim)", border: "1px solid var(--border)" }),
});

export default function AddSpaceModal() {
  const close = useStore((s) => s.setOverlay);
  const saveSpace = useStore((s) => s.saveSpace);
  const spaces = useStore((s) => s.spaces);
  const feeds = useStore((s) => s.feeds);
  const editId = useStore((s) => s.editSpaceId);
  const setEditSpace = useStore((s) => s.setEditSpace);

  const editing = editId ? spaces.find((x) => x.id === editId) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState<string>(editing?.color ?? COLORS[0]);
  const [words, setWords] = useState<string[]>(
    editing ? [] : ["rust", "cargo", "tokio", "borrow checker"],
  );
  const [input, setInput] = useState("");
  const [field, setField] = useState<"title" | "content" | "both">("both");
  const [scopeAll, setScopeAll] = useState(true);
  const [scopeFeeds, setScopeFeeds] = useState<string[]>([]);
  const [hide, setHide] = useState(false);
  const [feedQuery, setFeedQuery] = useState("");

  // Düzenlemede mevcut kuralı yükle.
  useEffect(() => {
    if (!editId) return;
    api.getSpaceRule(editId).then((r) => {
      if (!r) return;
      setWords(r.keywords);
      setField((r.field as "title" | "content" | "both") || "both");
      setScopeAll(r.scopeAll);
      setScopeFeeds(r.scopeFeeds);
      setHide(r.hideFromSource);
    }).catch(() => {});
  }, [editId]);

  const dismiss = () => {
    setEditSpace(null);
    close(null);
  };
  const submit = () => {
    saveSpace({
      id: editId,
      name: name.trim() || "New Space",
      color,
      field,
      keywords: words,
      scopeAll,
      scopeFeeds: scopeAll ? [] : scopeFeeds,
      hideFromSource: hide,
    });
    dismiss();
  };
  const addWord = () => {
    const w = input.trim().toLowerCase();
    if (w && !words.includes(w)) setWords((ws) => [...ws, w]);
    setInput("");
  };
  const toggleFeed = (id: string) =>
    setScopeFeeds((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const palette = COLORS.includes(color) ? COLORS : [color, ...COLORS];

  return (
    <div className="ovl" onClick={dismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ width: 520, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 15, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div className="vscroll" style={{ overflowY: "auto" }}>
          <div style={{ padding: "20px 24px 0" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".13em" }}>
              {editing ? "Edit Space" : "New Space"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Space name (e.g. Rust)" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: "9px 13px", fontFamily: "var(--titlefont)", fontSize: 19, color: "var(--fg)", background: "transparent", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {palette.map((c) => (
                <button key={c} onClick={() => setColor(c)} title="Color" style={{ width: 24, height: 24, borderRadius: 7, background: c, boxShadow: color === c ? `0 0 0 2px var(--panel2), 0 0 0 3.5px ${c}` : "none" }} />
              ))}
            </div>
          </div>

          <div style={{ padding: "18px 24px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>Auto-fill rule</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", background: "var(--panel)" }}>
              {/* eşleşme alanı */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--dim)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4, border: "1px solid var(--border)", borderRadius: 8, padding: 2 }}>
                  <span onClick={() => setField("title")} style={seg(field === "title")}>Title</span>
                  <span onClick={() => setField("content")} style={seg(field === "content")}>Content</span>
                  <span onClick={() => setField("both")} style={seg(field === "both")}>Both</span>
                </div>
                <span>contains any of</span>
              </div>
              {/* kelimeler */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {words.map((w) => (
                  <span key={w} style={{ fontSize: 12, color: "var(--accent)", background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 9px" }}>
                    {w}{" "}
                    <button onClick={() => setWords((ws) => ws.filter((x) => x !== w))} style={{ color: "var(--accent)", padding: 0 }} title="Remove">✕</button>
                  </span>
                ))}
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWord(); } }} placeholder="＋ keyword" style={{ fontSize: 12, color: "var(--fg)", background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, padding: "3px 9px", outline: "none", width: 90 }} />
              </div>
            </div>

            {/* kapsam */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <span style={{ fontSize: 12, color: "var(--dim)", flexShrink: 0 }}>Scope</span>
              <div style={{ display: "flex", gap: 4, border: "1px solid var(--border)", borderRadius: 8, padding: 2, flex: 1 }}>
                <span onClick={() => setScopeAll(true)} style={seg(scopeAll)}>All feeds</span>
                <span onClick={() => setScopeAll(false)} style={seg(!scopeAll)}>Selected feeds</span>
              </div>
            </div>
            {!scopeAll && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <input
                    value={feedQuery}
                    onChange={(e) => setFeedQuery(e.target.value)}
                    placeholder="Search feeds…"
                    style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, color: "var(--fg)", background: "var(--chip)", outline: "none" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>{scopeFeeds.length} selected</span>
                </div>
                <div className="vscroll" style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 9, padding: 6 }}>
                  {feeds
                    .filter((f) => f.name.toLowerCase().includes(feedQuery.trim().toLowerCase()))
                    .map((f) => (
                      <button key={f.id} onClick={() => toggleFeed(f.id)} className="rowh" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "5px 8px", borderRadius: 6, textAlign: "left" }}>
                        <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${scopeFeeds.includes(f.id) ? "var(--accent)" : "var(--border)"}`, background: scopeFeeds.includes(f.id) ? "var(--accent)" : "transparent", color: "var(--seltext)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{scopeFeeds.includes(f.id) ? "✓" : ""}</span>
                        <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* kaynaktan gizle */}
            <button onClick={() => setHide(!hide)} className="rowh" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 12, padding: "8px 4px", borderRadius: 8, textAlign: "left" }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, color: "var(--fg)" }}>Hide from source</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--faint)", marginTop: 2 }}>Matching articles appear only in this Space</span>
              </span>
              <span style={{ width: 32, height: 19, borderRadius: 10, background: hide ? "var(--accent)" : "var(--border)", position: "relative", transition: "background var(--tr)", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, ...(hide ? { right: 2 } : { left: 2 }), width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "all var(--tr)" }} />
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="rowh" onClick={dismiss} style={{ fontSize: 12.5, color: "var(--dim)", padding: "8px 14px", borderRadius: 8 }}>Cancel</button>
          <button onClick={submit} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--seltext)", background: "var(--accent)", borderRadius: 8, padding: "8px 17px" }}>
            {editing ? "Save" : "Create Space"}
          </button>
        </div>
      </div>
    </div>
  );
}
