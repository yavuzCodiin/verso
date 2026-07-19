import type { CSSProperties } from "react";
import { useStore } from "../../state/store";
import type { Width } from "../../state/types";

/*
 * Aa paneli — README §5.6. Sağda açılır 262px kart.
 * Serif|Sans · boyut kaydırıcısı · satır genişliği. Değerler okuyucuya uygulanır (Reader).
 */
const segIdle: CSSProperties = { flex: 1, textAlign: "center", padding: "5px 0", fontSize: 13, color: "var(--dim)", borderRadius: 6 };
const serifActive: CSSProperties = { flex: 1, textAlign: "center", padding: "5px 0", fontFamily: "var(--titlefont)", fontSize: 13, fontWeight: 600, color: "var(--seltext)", background: "var(--accent)", borderRadius: 6 };
const sansActive: CSSProperties = { flex: 1, textAlign: "center", padding: "5px 0", fontSize: 13, fontWeight: 600, color: "var(--seltext)", background: "var(--accent)", borderRadius: 6 };

const WIDTHS: [string, Width][] = [["Narrow", "dar"], ["Medium", "orta"], ["Wide", "genis"]];

export default function AaPanel() {
  const readFont = useStore((s) => s.readFont);
  const size = useStore((s) => s.size);
  const width = useStore((s) => s.width);
  const setReadFont = useStore((s) => s.setReadFont);
  const setSize = useStore((s) => s.setSize);
  const setWidth = useStore((s) => s.setWidth);
  const close = useStore((s) => s.setOverlay);

  const sizePct = `${35 + size * 10}%`;

  return (
    <>
      <div className="ovl" onClick={() => close(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.14)", zIndex: 20 }} />
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 104, right: 16, width: 262, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "var(--shadow)", zIndex: 21, padding: "15px 17px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 11 }}>Reading Settings</div>

        {/* Serif | Sans */}
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, padding: 2, marginBottom: 13 }}>
          <button onClick={() => setReadFont("serif")} style={readFont === "serif" ? serifActive : segIdle}>Serif</button>
          <button onClick={() => setReadFont("sans")} style={readFont === "sans" ? sansActive : segIdle}>Sans</button>
        </div>

        {/* boyut kaydırıcısı */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
          <span style={{ fontSize: 11, color: "var(--dim)" }}>A</span>
          <div style={{ position: "relative", flex: 1, height: 3 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 2, background: "var(--border)" }} />
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: sizePct, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ position: "absolute", left: sizePct, top: -5, width: 13, height: 13, borderRadius: "50%", background: "#fff", border: "1.5px solid var(--accent)", marginLeft: -7 }} />
            <input type="range" min={0} max={5} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Font size" style={{ position: "absolute", left: 0, top: -9, width: "100%", height: 22, margin: 0, opacity: 0, cursor: "pointer" }} />
          </div>
          <span style={{ fontSize: 16, color: "var(--fg)" }}>A</span>
        </div>

        {/* satır genişliği */}
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>Line width</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 13 }}>
          {WIDTHS.map(([label, key]) => {
            const active = width === key;
            return (
              <button key={key} onClick={() => setWidth(key)} style={{ flex: 1, textAlign: "center", fontSize: 11.5, padding: "5px 0", borderRadius: 6, transition: "all var(--tr)", ...(active ? { color: "var(--accent)", border: "1px solid var(--accent)", background: "var(--soft)", fontWeight: 600 } : { color: "var(--dim)", border: "1px solid var(--border)" }) }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--faint)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          Remembered per theme — you can use a different size in Night.
        </div>
      </div>
    </>
  );
}
