import { useStore } from "../../state/store";
import { THEMES } from "../../lib/themeList";

/*
 * Tema menüsü — README §5.5. Sağ üstte açılır 270px kart (vpop).
 * 4 tema seçeneği (üst üste binen c1/c2 daireleri) + otomatik gündüz/gece anahtarı.
 */
export default function ThemeMenu() {
  const theme = useStore((s) => s.theme);
  const auto = useStore((s) => s.auto);
  const chooseTheme = useStore((s) => s.chooseTheme);
  const toggleAuto = useStore((s) => s.toggleAuto);
  const close = useStore((s) => s.setOverlay);

  return (
    <>
      <div className="ovl" onClick={() => close(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.14)", zIndex: 20 }} />
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 56, right: 16, width: 270, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "var(--shadow)", zIndex: 21, padding: 8 }}>
        <div style={{ padding: "8px 10px", fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em" }}>Theme</div>

        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button key={t.id} className="rowh" onClick={() => chooseTheme(t.id)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "8px 10px", borderRadius: 8, ...(active ? { background: "var(--soft)" } : null) }}>
              <span style={{ display: "flex", flexShrink: 0 }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: t.c1, border: "1px solid var(--border)" }} />
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: t.c2, marginLeft: -5 }} />
              </span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg)", fontWeight: active ? 600 : 400 }}>{t.name}</span>
              {active && <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>}
            </button>
          );
        })}

        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 6px" }} />

        <button className="rowh" onClick={toggleAuto} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8 }}>
          <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg)" }}>Automatic day / night</span>
          <span style={{ width: 32, height: 19, borderRadius: 10, background: auto ? "var(--accent)" : "var(--border)", position: "relative", transition: "background var(--tr)" }}>
            <span style={{ position: "absolute", top: 2, ...(auto ? { right: 2 } : { left: 2 }), width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "all var(--tr)" }} />
          </span>
        </button>
        <div style={{ padding: "2px 10px 8px", fontSize: 11, lineHeight: 1.5, color: "var(--faint)" }}>
          <b style={{ color: "var(--dim)" }}>Paper</b> by day, <b style={{ color: "var(--dim)" }}>Night</b> by night.
        </div>
      </div>
    </>
  );
}
