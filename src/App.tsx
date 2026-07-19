import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./state/store";
import { useKeyboard } from "./hooks/useKeyboard";
import { useAutoTheme } from "./hooks/useAutoTheme";
import type { TaskProgress } from "./state/types";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import ArticleList from "./components/ArticleList";
import Reader from "./components/reader/Reader";
import Overlays from "./components/overlays/Overlays";
import ContextMenu from "./components/ContextMenu";
import ProgressPill from "./components/ProgressPill";
import VideoModal from "./components/VideoModal";

export default function App() {
  const theme = useStore((s) => s.theme);
  const init = useStore((s) => s.init);
  const sidebarOpen = useStore((s) => s.sidebarOpen);

  // Global klavye kısayolları (j/k/s/m/r/v/Esc/⌘K) + otomatik gündüz/gece.
  useKeyboard();
  useAutoTheme();

  // İlk yüklemede verso-core'dan veri çek + arka planda tazele.
  useEffect(() => {
    init();
  }, [init]);

  // Otomatik yenileme: 15 dakikada bir (bildirim + sessiz saat kurallarına uyar).
  useEffect(() => {
    const id = setInterval(() => {
      useStore.getState().refresh(false);
    }, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Uzun iş ilerlemesi (yenileme/OPML) — backend "verso-progress" yayınlar.
  useEffect(() => {
    const sub = listen<TaskProgress>("verso-progress", (e) => {
      const st = useStore.getState();
      st.setTaskProgress(e.payload);
      if (e.payload.done >= e.payload.total) {
        setTimeout(() => useStore.getState().setTaskProgress(null), 1500);
      }
    });
    return () => {
      sub.then((un) => un());
    };
  }, []);

  // Tema, kök <html> öğesinde data-theme olarak yansıtılır.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div
      className="app"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        background: "var(--bg)",
        color: "var(--fg)",
        transition: "background var(--tr), color var(--tr)",
      }}
    >
      <TitleBar />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Daraltılabilir kenar çubuğu (⌘\ / başlıktaki panel düğmesi) */}
        <div style={{ width: sidebarOpen ? 246 : 0, overflow: "hidden", flexShrink: 0, display: "flex", transition: "width .18s ease" }}>
          <Sidebar />
        </div>
        <ArticleList />
        <Reader />
      </div>
      <Overlays />
      <ContextMenu />
      <ProgressPill />
      <VideoModal />
    </div>
  );
}
