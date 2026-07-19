// Bildirim + sessiz saat — README §9.
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Settings } from "../state/types";

export async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch (e) {
    console.error("notify", e);
  }
}

/** Şu an sessiz saat aralığında mıyız? (gece devri desteklenir) */
export function inQuietHours(s: Settings, d: Date = new Date()): boolean {
  if (!s.quietEnabled) return false;
  const cur = d.getHours() * 60 + d.getMinutes();
  const [sh, sm] = s.quietStart.split(":").map(Number);
  const [eh, em] = s.quietEnd.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}
