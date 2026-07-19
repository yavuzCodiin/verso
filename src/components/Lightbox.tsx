import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Plus, Minus } from "lucide-react";

/*
 * Görsel lightbox — yakınlaştır/uzaklaştır + kaydır (pan).
 * Tekerlek: zoom · sürükle: pan (zoomluyken) · çift-tık: 1×↔2.5× · +/-/0: klavye · Esc: kapat.
 */
const MIN = 1;
const MAX = 6;
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));

export default function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setScale(1);
    setOff({ x: 0, y: 0 });
  };

  useEffect(() => {
    reset();
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => clamp(s * 1.25));
      } else if (e.key === "-" || e.key === "_") {
        setScale((s) => clamp(s / 1.25));
      } else if (e.key === "0") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const zoomBy = (f: number) =>
    setScale((s) => {
      const ns = clamp(s * f);
      if (ns === 1) setOff({ x: 0, y: 0 });
      return ns;
    });

  return (
    <div
      className="ovl"
      onClick={onClose}
      onWheel={(e) => {
        setScale((s) => {
          const ns = clamp(s * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
          if (ns === 1) setOff({ x: 0, y: 0 });
          return ns;
        });
      }}
      onMouseMove={(e) => {
        if (!drag.current) return;
        setOff({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
      }}
      onMouseUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (scale > 1) reset();
          else setScale(2.5);
        }}
        onMouseDown={(e) => {
          if (scale <= 1) return;
          e.preventDefault();
          drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          setDragging(true);
        }}
        style={{
          maxWidth: "90%",
          maxHeight: "90%",
          transform: `translate(${off.x}px, ${off.y}px) scale(${scale})`,
          transformOrigin: "center",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          borderRadius: 10,
          boxShadow: "0 24px 80px rgba(0,0,0,.6)",
          transition: dragging ? "none" : "transform .12s ease",
          userSelect: "none",
        }}
      />

      {/* kontroller */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.5)", borderRadius: 12, padding: 5 }}>
        <button onClick={() => zoomBy(1 / 1.25)} title="Zoom out (-)" style={ctrl}><Minus size={16} strokeWidth={2} /></button>
        <button onClick={reset} title="Reset (0)" style={{ ...ctrl, width: "auto", padding: "0 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{Math.round(scale * 100)}%</button>
        <button onClick={() => zoomBy(1.25)} title="Zoom in (+)" style={ctrl}><Plus size={16} strokeWidth={2} /></button>
      </div>

      <button onClick={onClose} title="Close (Esc)" style={{ position: "fixed", top: 18, right: 18, width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={17} strokeWidth={2} />
      </button>
    </div>
  );
}

const ctrl: CSSProperties = {
  width: 32,
  height: 30,
  borderRadius: 8,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
