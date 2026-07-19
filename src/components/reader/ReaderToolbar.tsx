import type { CSSProperties } from "react";
import { Bookmark } from "lucide-react";
import { useStore } from "../../state/store";
import type { Mode } from "../../state/types";

// Okuyucu araç çubuğu — README §5.4. Durum store.current'tan (DB).
const segActive: CSSProperties = { padding: "4px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--seltext)", background: "var(--accent)", borderRadius: 6, transition: "all var(--tr)" };
const segIdle: CSSProperties = { padding: "4px 12px", fontSize: 11.5, color: "var(--dim)", borderRadius: 6, transition: "all var(--tr)" };

export default function ReaderToolbar() {
  const mode = useStore((s) => s.mode);
  const current = useStore((s) => s.current);
  const setMode = useStore((s) => s.setMode);
  const loadFullText = useStore((s) => s.loadFullText);
  const toggleStar = useStore((s) => s.toggleStar);
  const addLater = useStore((s) => s.addLater);
  const setOverlay = useStore((s) => s.setOverlay);

  const starOn = !!current?.starred;
  const laterOn = !!current?.later;
  const tab = (m: Mode) => (mode === m ? segActive : segIdle);
  const disabled = !current;

  return (
    <div style={{ height: 47, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, padding: 2, background: "var(--chip)", opacity: disabled ? 0.5 : 1 }}>
        <button onClick={() => setMode("ozet")} style={tab("ozet")}>Summary</button>
        <button onClick={() => setMode("tam")} style={tab("tam")}>Full Text</button>
        <button onClick={() => setMode("web")} style={tab("web")}>Web</button>
      </div>

      {mode === "tam" && current?.contentFull && (
        <button
          className="iconh"
          onClick={() => loadFullText(true)}
          title="Refetch full text"
          style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6 }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
          full content fetched · ↻
        </button>
      )}

      <div style={{ flex: 1 }} />

      <button className="trigger" onClick={() => setOverlay("aa")} style={{ fontSize: 12, color: "var(--dim)", borderRadius: 7, padding: "4px 11px" }}>Aa</button>
      <button className="iconh" onClick={toggleStar} title="Star" style={{ width: 30, height: 30, borderRadius: 7, fontSize: 15, color: starOn ? "var(--accent)" : "var(--dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {starOn ? "★" : "☆"}
      </button>
      <button className="iconh" onClick={addLater} title={laterOn ? "In Read Later list" : "Read later"} style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: laterOn ? "var(--accent)" : "var(--dim)" }}>
        <Bookmark size={15} strokeWidth={1.4} fill={laterOn ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
