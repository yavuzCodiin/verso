import { useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useStore } from "../../state/store";

/*
 * Ayarlar (bildirim + sessiz saat + OTA güncelleme) — README §9.
 */
export default function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const close = useStore((s) => s.setOverlay);

  const [updMsg, setUpdMsg] = useState<string | null>(null);
  const [updBusy, setUpdBusy] = useState(false);

  const checkUpdates = async () => {
    setUpdBusy(true);
    setUpdMsg("Checking…");
    try {
      const up = await check();
      if (up) {
        const ok = await confirm(
          `Verso ${up.version} is available (current: ${up.currentVersion}). Download and install now?`,
          { title: "Update Available", kind: "info" },
        );
        if (ok) {
          setUpdMsg("Downloading and installing…");
          await up.downloadAndInstall();
          await relaunch();
        } else {
          setUpdMsg(null);
        }
      } else {
        setUpdMsg("Verso is up to date.");
      }
    } catch (e) {
      setUpdMsg(`Couldn't check (the release channel may not exist yet).`);
      console.error("updater", e);
    } finally {
      setUpdBusy(false);
    }
  };

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: 32, height: 19, borderRadius: 10, background: on ? "var(--accent)" : "var(--border)", position: "relative", transition: "background var(--tr)", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, ...(on ? { right: 2 } : { left: 2 }), width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "all var(--tr)" }} />
    </button>
  );

  return (
    <>
      <div className="ovl" onClick={() => close(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.14)", zIndex: 20 }} />
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 12, bottom: 12, width: 280, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "var(--shadow)", zIndex: 21, padding: "15px 17px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 13 }}>Notifications</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--fg)" }}>New article notifications</span>
          <Toggle on={settings.notify} onClick={() => setSetting({ notify: !settings.notify })} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--fg)" }}>Quiet hours</span>
          <Toggle on={settings.quietEnabled} onClick={() => setSetting({ quietEnabled: !settings.quietEnabled })} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: settings.quietEnabled ? 1 : 0.5 }}>
          <input type="time" value={settings.quietStart} onChange={(e) => setSetting({ quietStart: e.target.value })} disabled={!settings.quietEnabled} style={timeInput} />
          <span style={{ fontSize: 12, color: "var(--faint)" }}>–</span>
          <input type="time" value={settings.quietEnd} onChange={(e) => setSetting({ quietEnd: e.target.value })} disabled={!settings.quietEnabled} style={timeInput} />
        </div>

        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--faint)", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 13 }}>
          No notifications are shown during this range. Settings are stored on this device.
        </div>

        {/* ── Güncelleme ── */}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".12em", margin: "14px 0 9px" }}>Update</div>
        <button
          className="trigger"
          onClick={checkUpdates}
          disabled={updBusy}
          style={{ width: "100%", fontSize: 12.5, color: "var(--fg)", borderRadius: 8, padding: "8px 12px", background: "var(--chip)", opacity: updBusy ? 0.6 : 1 }}
        >
          Check for updates
        </button>
        {updMsg && (
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 7, lineHeight: 1.5 }}>{updMsg}</div>
        )}
      </div>
    </>
  );
}

const timeInput = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "5px 8px",
  fontSize: 12.5,
  color: "var(--fg)",
  background: "var(--chip)",
  outline: "none",
} as const;
