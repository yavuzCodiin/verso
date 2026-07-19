import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Theme,
  Mode,
  SelKind,
  ReadFont,
  Width,
  OverlayKind,
  Settings,
  TaskProgress,
  CtxState,
} from "./types";
import { notify, inQuietHours } from "../lib/notify";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  api,
  type FeedVM,
  type FolderVM,
  type SpaceVM,
  type SmartCounts,
  type ArticleListVM,
  type ArticleFullVM,
} from "../lib/ipc";

/*
 * Verso store — UI durumu (README §7) + verso-core (SQLite) veri katmanı.
 * Kalıcı olanlar yalnız UI tercihleri (theme/auto/readFont/size/width); makale
 * durumu (okundu/yıldız/sonra/ilerleme) artık gerçek DB'de tutulur (Faz 6 kalıcılığı).
 */
interface State {
  // UI
  theme: Theme;
  auto: boolean;
  readFont: ReadFont;
  size: number;
  width: Width;
  selKind: SelKind;
  selId: string;
  articleId: string;
  mode: Mode;
  overlay: OverlayKind;
  refreshing: boolean;
  progress: number;
  loadingArticle: boolean;
  // veri
  feeds: FeedVM[];
  folders: FolderVM[];
  spaces: SpaceVM[];
  smart: SmartCounts;
  articles: ArticleListVM[];
  current: ArticleFullVM | null;
  settings: Settings;
  collapsed: Record<string, boolean>; // klasör id → kapalı mı
  taskProgress: TaskProgress | null;
  ctx: CtxState | null;
  addFeedFolderId: string | null; // AddFeedModal hedef klasörü
  sidebarOpen: boolean;
  editSpaceId: string | null; // AddSpaceModal düzenleme modu
  filterUnread: boolean; // yalnız okunmamışları göster
  sortAsc: boolean; // eski → yeni sıralama
  videoId: string | null; // in-app YouTube oynatıcı
}

interface Actions {
  setTheme: (t: Theme) => void;
  chooseTheme: (t: Theme) => void;
  toggleAuto: () => void;
  setOverlay: (o: OverlayKind) => void;
  setReadFont: (f: ReadFont) => void;
  setSize: (n: number) => void;
  setWidth: (w: Width) => void;

  init: () => Promise<void>;
  loadSidebar: () => Promise<void>;
  loadArticles: () => Promise<void>;
  selectList: (kind: SelKind, id: string) => Promise<void>;
  selectArticle: (id: string) => Promise<void>;
  setMode: (m: Mode) => Promise<void>;
  loadFullText: (force?: boolean) => Promise<void>;
  refetchFullTextFor: (id: string) => Promise<void>;
  toggleStar: () => Promise<void>;
  addLater: () => Promise<void>;
  step: (d: number) => Promise<void>;
  markRead: () => Promise<void>;
  setProgress: (n: number) => void;
  refresh: (silent?: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  createSpace: (name: string, color: string, keywords: string[]) => Promise<void>;
  saveSpace: (a: import("../lib/ipc").SaveSpaceArgs) => Promise<void>;
  setSetting: (patch: Partial<Settings>) => void;
  setAddFeedFolder: (id: string | null) => void;
  addFeed: (url: string, folderId?: string | null) => Promise<void>;
  moveFeedToFolder: (feedId: string, folderId: string | null) => Promise<void>;
  moveFeedToNewFolder: (feedId: string, title: string) => Promise<void>;
  refreshFolder: (id: string) => Promise<void>;
  importOpml: () => Promise<void>;
  exportOpml: () => Promise<void>;
  toggleFolder: (id: string) => void;
  setTaskProgress: (p: TaskProgress | null) => void;
  openCtx: (kind: CtxState["kind"], id: string, x: number, y: number) => void;
  closeCtx: () => void;
  refreshFeed: (id: string) => Promise<void>;
  deleteFeed: (id: string) => Promise<void>;
  markArticleRead: (id: string, read: boolean) => Promise<void>;
  starArticle: (id: string) => Promise<void>;
  laterArticle: (id: string) => Promise<void>;
  addArticleToSpace: (id: string, spaceId: string) => Promise<void>;
  markAllReadFor: (kind: string, id: string) => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  copyText: (text: string) => Promise<void>;
  toggleSidebar: () => void;
  setEditSpace: (id: string | null) => void;
  toggleFilterUnread: () => void;
  toggleSortAsc: () => void;
  setVideoId: (id: string | null) => void;
  renameFolder: (id: string, title: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFeed: (id: string, title: string) => Promise<void>;
  toggleOnlySummary: (id: string, value: boolean) => Promise<void>;
  updateSpace: (id: string, name: string, color: string, keywords: string[]) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
}

let progressTimer: ReturnType<typeof setTimeout> | null = null;

/** Görünen makale listesi: okunmamış filtresi (+seçili istisna) ve sıralama. */
export function viewArticles(s: {
  articles: ArticleListVM[];
  filterUnread: boolean;
  sortAsc: boolean;
  articleId: string;
}): ArticleListVM[] {
  let list = s.articles;
  if (s.filterUnread) list = list.filter((a) => a.unread || a.id === s.articleId);
  if (s.sortAsc) list = [...list].reverse(); // DB'den yeni→eski gelir
  return list;
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      // ── başlangıç ──
      theme: "kagit",
      auto: true,
      readFont: "serif",
      size: 2,
      width: "orta",
      selKind: "feed",
      selId: "barry",
      articleId: "",
      mode: "ozet",
      overlay: null,
      refreshing: false,
      progress: 0,
      loadingArticle: false,
      feeds: [],
      spaces: [],
      smart: { bugun: 0, yildizli: 0, sonra: 0 },
      articles: [],
      current: null,
      folders: [],
      settings: { notify: true, quietEnabled: true, quietStart: "09:00", quietEnd: "18:00" },
      collapsed: {},
      taskProgress: null,
      ctx: null,
      addFeedFolderId: null,
      sidebarOpen: true,
      editSpaceId: null,
      filterUnread: false,
      sortAsc: false,
      videoId: null,

      // ── UI ──
      setTheme: (t) => set({ theme: t }),
      chooseTheme: (t) => set({ theme: t, auto: false }),
      toggleAuto: () => set((s) => ({ auto: !s.auto })),
      setOverlay: (o) => set({ overlay: o }),
      setReadFont: (f) => set({ readFont: f }),
      setSize: (n) => set({ size: n }),
      setWidth: (w) => set({ width: w }),

      // ── veri ──
      init: async () => {
        await get().loadSidebar();
        await get().loadArticles();
        get().refresh(true); // arka planda tazele (ilk açılışta bildirim yok)
      },

      loadSidebar: async () => {
        try {
          const [feeds, folders, spaces, smart] = await Promise.all([
            api.listFeeds(),
            api.listFolders(),
            api.listSpaces(),
            api.smartCounts(),
          ]);
          set({ feeds, folders, spaces, smart });
        } catch (e) {
          console.error("loadSidebar", e);
        }
      },

      loadArticles: async () => {
        const { selKind, selId } = get();
        try {
          const articles = await api.listArticles(selKind, selId);
          set({ articles });
          const cur = get().articleId;
          if (!articles.find((a) => a.id === cur)) {
            if (articles.length) await get().selectArticle(articles[0].id);
            else set({ current: null, articleId: "" });
          }
        } catch (e) {
          console.error("loadArticles", e);
        }
      },

      selectList: async (kind, id) => {
        set({ selKind: kind, selId: id, mode: "ozet", articleId: "", progress: 0 });
        await get().loadArticles();
      },

      selectArticle: async (id) => {
        set({ articleId: id, mode: "ozet", overlay: null, loadingArticle: true });
        try {
          const art = await api.getArticle(id);
          set({ current: art, progress: art?.readProgress ?? 0, loadingArticle: false });
          if (art && art.unread) {
            await api.markRead(id, true);
            set((s) => ({
              articles: s.articles.map((a) => (a.id === id ? { ...a, unread: false } : a)),
              current: s.current ? { ...s.current, unread: false } : s.current,
            }));
            get().loadSidebar();
          }
        } catch (e) {
          console.error("selectArticle", e);
          set({ loadingArticle: false });
        }
      },

      setMode: async (m) => {
        if (m === "tam") {
          // README §5.4: Tam Metin ilk seçimde HER ZAMAN siteden çekilir (cache'li).
          // Feed "tam içerik veriyor" görünse bile çoğu feed kesik özet yollar.
          const cur = get().current;
          if (!cur?.contentFull) {
            await get().loadFullText();
          } else {
            set({ mode: "tam" });
          }
          return;
        }
        set({ mode: m });
      },

      loadFullText: async (force = false) => {
        const { articleId, current } = get();
        if (!articleId) return;
        if (!force && current?.contentFull) {
          set({ mode: "tam" });
          return;
        }
        set({ mode: "tam" });
        try {
          const full = await api.getFullText(articleId, force);
          set((s) => ({
            current: s.current ? { ...s.current, contentFull: full } : s.current,
          }));
        } catch (e) {
          console.error("getFullText", e);
          if (!force) set({ mode: "ozet" }); // başarısızsa Özet'e düş
        }
      },

      refetchFullTextFor: async (id) => {
        await get().selectArticle(id);
        await get().loadFullText(true);
      },

      toggleStar: async () => {
        const id = get().articleId;
        if (!id) return;
        try {
          const v = await api.toggleStar(id);
          set((s) => ({
            current: s.current ? { ...s.current, starred: v } : s.current,
            articles: s.articles.map((a) => (a.id === id ? { ...a, starred: v } : a)),
          }));
          get().loadSidebar();
        } catch (e) {
          console.error("toggleStar", e);
        }
      },

      addLater: async () => {
        const id = get().articleId;
        if (!id) return;
        try {
          const v = await api.toggleLater(id);
          set((s) => ({
            current: s.current ? { ...s.current, later: v } : s.current,
            articles: s.articles.map((a) => (a.id === id ? { ...a, later: v } : a)),
          }));
          get().loadSidebar();
        } catch (e) {
          console.error("toggleLater", e);
        }
      },

      step: async (d) => {
        const s = get();
        const list = viewArticles(s); // klavye, görünen (filtreli/sıralı) listeyi izler
        if (!list.length) return;
        const i = Math.max(0, list.findIndex((a) => a.id === s.articleId));
        const ni = Math.min(list.length - 1, Math.max(0, i + d));
        await get().selectArticle(list[ni].id);
      },
      markRead: async () => {
        await get().step(1);
      },

      setProgress: (n) => {
        set({ progress: n });
        const id = get().articleId;
        if (!id) return;
        if (progressTimer) clearTimeout(progressTimer);
        progressTimer = setTimeout(() => {
          api.setProgress(id, n).catch(() => {});
        }, 400);
      },

      refresh: async (silent = false) => {
        if (get().refreshing) return;
        set({ refreshing: true });
        try {
          const sum = await api.refreshAll();
          await get().loadSidebar();
          await get().loadArticles();
          const s = get().settings;
          if (!silent && sum.newArticles > 0 && s.notify && !inQuietHours(s)) {
            notify("Verso", `${sum.newArticles} new articles`);
          }
        } catch (e) {
          console.error("refresh", e);
        } finally {
          set({ refreshing: false });
        }
      },

      markAllRead: async () => {
        const { selKind, selId } = get();
        try {
          await api.markAllRead(selKind, selId);
          await get().loadSidebar();
          await get().loadArticles();
        } catch (e) {
          console.error("markAllRead", e);
        }
      },

      createSpace: async (name, color, keywords) => {
        try {
          const id = await api.createSpace(name, color, keywords);
          await get().loadSidebar();
          await get().selectList("space", id);
        } catch (e) {
          console.error("createSpace", e);
        }
      },

      saveSpace: async (a) => {
        try {
          const id = await api.saveSpace(a);
          await get().loadSidebar();
          await get().loadArticles();
          await get().selectList("space", id);
        } catch (e) {
          console.error("saveSpace", e);
        }
      },

      setSetting: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setAddFeedFolder: (id) => set({ addFeedFolderId: id }),

      addFeed: async (url, folderId = null) => {
        try {
          const id = await api.addFeed(url, folderId);
          await get().loadSidebar();
          await get().selectList("feed", id);
        } catch (e) {
          console.error("addFeed", e);
        }
      },

      moveFeedToFolder: async (feedId, folderId) => {
        try {
          await api.moveFeedToFolder(feedId, folderId);
          await get().loadSidebar();
        } catch (e) {
          console.error("moveFeedToFolder", e);
        }
      },

      moveFeedToNewFolder: async (feedId, title) => {
        try {
          const fid = await api.createFolder(title);
          await api.moveFeedToFolder(feedId, fid);
          await get().loadSidebar();
        } catch (e) {
          console.error("moveFeedToNewFolder", e);
        }
      },

      refreshFolder: async (id) => {
        try {
          await api.refreshFolder(id);
          await get().loadSidebar();
          await get().loadArticles();
        } catch (e) {
          console.error("refreshFolder", e);
        }
      },

      importOpml: async () => {
        try {
          const path = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "OPML", extensions: ["opml", "xml"] }],
          });
          if (typeof path === "string") {
            const n = await api.importOpml(path);
            await get().loadSidebar();
            await get().loadArticles();
            // Görünür sonuç: kaç yeni feed geldi (0 ise zaten import edilmiş demek).
            set({
              taskProgress: {
                kind: "import",
                done: 1,
                total: 1,
                label: n > 0 ? `${n} feed${n === 1 ? "" : "s"} imported` : "No new feeds (already imported)",
              },
            });
            setTimeout(() => set({ taskProgress: null }), 3000);
          }
        } catch (e) {
          console.error("importOpml", e);
          set({ taskProgress: { kind: "import", done: 1, total: 1, label: "Import failed — check the file" } });
          setTimeout(() => set({ taskProgress: null }), 3400);
        }
      },

      exportOpml: async () => {
        try {
          const path = await save({
            defaultPath: "verso-subscriptions.opml",
            filters: [{ name: "OPML", extensions: ["opml"] }],
          });
          if (path) await api.exportOpml(path);
        } catch (e) {
          console.error("exportOpml", e);
        }
      },

      toggleFolder: (id) =>
        set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),

      setTaskProgress: (p) => set({ taskProgress: p }),

      openCtx: (kind, id, x, y) => set({ ctx: { kind, id, x, y } }),
      closeCtx: () => set({ ctx: null }),

      refreshFeed: async (id) => {
        try {
          await api.refreshFeed(id);
          await get().loadSidebar();
          await get().loadArticles();
        } catch (e) {
          console.error("refreshFeed", e);
        }
      },

      deleteFeed: async (id) => {
        try {
          await api.deleteFeed(id);
          const { selKind, selId } = get();
          if (selKind === "feed" && selId === id) {
            await get().selectList("smart", "bugun");
          } else {
            await get().loadSidebar();
            await get().loadArticles();
          }
        } catch (e) {
          console.error("deleteFeed", e);
        }
      },

      markArticleRead: async (id, read) => {
        try {
          await api.markRead(id, read);
          set((s) => ({
            articles: s.articles.map((a) => (a.id === id ? { ...a, unread: !read } : a)),
            current:
              s.current && s.current.id === id ? { ...s.current, unread: !read } : s.current,
          }));
          get().loadSidebar();
        } catch (e) {
          console.error("markArticleRead", e);
        }
      },

      starArticle: async (id) => {
        try {
          const v = await api.toggleStar(id);
          set((s) => ({
            articles: s.articles.map((a) => (a.id === id ? { ...a, starred: v } : a)),
            current: s.current && s.current.id === id ? { ...s.current, starred: v } : s.current,
          }));
          get().loadSidebar();
        } catch (e) {
          console.error("starArticle", e);
        }
      },

      laterArticle: async (id) => {
        try {
          const v = await api.toggleLater(id);
          set((s) => ({
            articles: s.articles.map((a) => (a.id === id ? { ...a, later: v } : a)),
            current: s.current && s.current.id === id ? { ...s.current, later: v } : s.current,
          }));
          get().loadSidebar();
        } catch (e) {
          console.error("laterArticle", e);
        }
      },

      addArticleToSpace: async (id, spaceId) => {
        try {
          await api.addToSpace(id, spaceId);
          await get().loadSidebar();
        } catch (e) {
          console.error("addArticleToSpace", e);
        }
      },

      markAllReadFor: async (kind, id) => {
        try {
          await api.markAllRead(kind, id);
          await get().loadSidebar();
          await get().loadArticles();
        } catch (e) {
          console.error("markAllReadFor", e);
        }
      },

      openUrl: async (url) => {
        try {
          await api.openUrl(url);
        } catch (e) {
          console.error("openUrl", e);
        }
      },

      copyText: async (text) => {
        try {
          await api.copyText(text);
        } catch (e) {
          console.error("copyText", e);
        }
      },

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setEditSpace: (id) => set({ editSpaceId: id }),
      toggleFilterUnread: () => set((s) => ({ filterUnread: !s.filterUnread })),
      toggleSortAsc: () => set((s) => ({ sortAsc: !s.sortAsc })),
      setVideoId: (id) => set({ videoId: id }),

      renameFolder: async (id, title) => {
        try {
          await api.renameFolder(id, title);
          await get().loadSidebar();
        } catch (e) {
          console.error("renameFolder", e);
        }
      },

      deleteFolder: async (id) => {
        try {
          await api.deleteFolder(id);
          const { selKind, selId } = get();
          if (selKind === "folder" && selId === id) await get().selectList("smart", "bugun");
          else await get().loadSidebar();
        } catch (e) {
          console.error("deleteFolder", e);
        }
      },

      renameFeed: async (id, title) => {
        try {
          await api.renameFeed(id, title);
          await get().loadSidebar();
          await get().loadArticles();
        } catch (e) {
          console.error("renameFeed", e);
        }
      },

      toggleOnlySummary: async (id, value) => {
        try {
          await api.setFeedOnlySummary(id, value);
          await get().loadSidebar();
        } catch (e) {
          console.error("toggleOnlySummary", e);
        }
      },

      updateSpace: async (id, name, color, keywords) => {
        try {
          await api.updateSpace(id, name, color, keywords);
          await get().loadSidebar();
        } catch (e) {
          console.error("updateSpace", e);
        }
      },

      deleteSpace: async (id) => {
        try {
          await api.deleteSpace(id);
          const { selKind, selId } = get();
          if (selKind === "space" && selId === id) await get().selectList("smart", "bugun");
          else await get().loadSidebar();
        } catch (e) {
          console.error("deleteSpace", e);
        }
      },
    }),
    {
      name: "verso-ui",
      partialize: (s) => ({
        theme: s.theme,
        auto: s.auto,
        readFont: s.readFont,
        size: s.size,
        width: s.width,
        settings: s.settings,
        collapsed: s.collapsed,
        sidebarOpen: s.sidebarOpen,
        filterUnread: s.filterUnread,
        sortAsc: s.sortAsc,
      }),
    },
  ),
);
