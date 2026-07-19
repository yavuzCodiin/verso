import { RefreshCw } from "lucide-react";
import { useStore } from "../state/store";

/*
 * Uzun iş ilerleme pili — OPML içe aktarma / toplu yenileme sırasında sağ altta.
 * "verso-progress" event'iyle beslenir (App.tsx dinler).
 */
export default function ProgressPill() {
  const p = useStore((s) => s.taskProgress);
  if (!p || p.total === 0) return null;

  const label = p.kind === "import" ? "Importing OPML" : "Refreshing feeds";
  const doneAll = p.done >= p.total;

  return (
    <div
      className="pop"
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--panel2)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        boxShadow: "var(--shadow)",
        padding: "9px 13px",
        maxWidth: 380,
      }}
    >
      <RefreshCw
        size={13}
        color="var(--accent)"
        strokeWidth={1.8}
        style={{ animation: doneAll ? undefined : "vspin .7s linear infinite", transformOrigin: "center", flexShrink: 0 }}
      />
      <span style={{ fontSize: 12, color: "var(--fg)", whiteSpace: "nowrap" }}>
        {doneAll ? "Done" : label} ·{" "}
        <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
          {p.done}/{p.total}
        </b>
      </span>
      {p.label && !doneAll && (
        <span style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
          {p.label}
        </span>
      )}
      {/* mini ilerleme çubuğu */}
      <span style={{ width: 56, height: 3, borderRadius: 2, background: "var(--border)", flexShrink: 0 }}>
        <span
          style={{ display: "block", width: `${Math.round((p.done / p.total) * 100)}%`, height: "100%", borderRadius: 2, background: "var(--accent)", transition: "width .2s ease" }}
        />
      </span>
    </div>
  );
}
