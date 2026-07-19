// Tauri IPC katmanı — verso-core komutlarının tipli sarmalayıcıları.
// invoke arg anahtarları camelCase; Tauri bunları Rust snake_case parametrelerine çevirir.
import { invoke } from "@tauri-apps/api/core";

export interface FeedVM {
  id: string;
  letter: string;
  color: string;
  name: string;
  url: string;
  folderId: string | null;
  iconData: string | null; // favicon data-URL; ""/null → harf rozeti
  count: number;
  onlySummary: boolean;
}
export interface FolderVM {
  id: string;
  title: string;
}
export interface RuleVM {
  id: string;
  spaceId: string;
  field: string; // "title" | "content" | "both"
  keywords: string[];
  scopeAll: boolean;
  scopeFeeds: string[];
  hideFromSource: boolean;
}
export interface SaveSpaceArgs {
  id: string | null;
  name: string;
  color: string;
  field: string;
  keywords: string[];
  scopeAll: boolean;
  scopeFeeds: string[];
  hideFromSource: boolean;
}
export interface SpaceVM {
  id: string;
  name: string;
  color: string;
  count: number;
}
export interface SmartCounts {
  bugun: number;
  yildizli: number;
  sonra: number;
}
export interface ArticleListVM {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  dek: string;
  author: string;
  publishedAt: number | null;
  mins: number;
  url: string;
  unread: boolean;
  starred: boolean;
  later: boolean;
  onlySummary: boolean;
  tags: string[];
  spaceIds: string[];
}
export interface ArticleFullVM {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  dek: string;
  author: string;
  publishedAt: number | null;
  mins: number;
  url: string;
  unread: boolean;
  starred: boolean;
  later: boolean;
  onlySummary: boolean;
  tags: string[];
  contentSummary: string;
  contentFull: string | null;
  readProgress: number;
  enclosureUrl: string | null;
  enclosureType: string | null;
}
export interface RefreshSummary {
  feedsOk: number;
  feedsErr: number;
  newArticles: number;
}

export const api = {
  coreVersion: () => invoke<string>("core_version"),
  listFeeds: () => invoke<FeedVM[]>("list_feeds"),
  listSpaces: () => invoke<SpaceVM[]>("list_spaces"),
  smartCounts: () => invoke<SmartCounts>("smart_counts"),
  listArticles: (kind: string, id: string) =>
    invoke<ArticleListVM[]>("list_articles", { kind, id }),
  getArticle: (id: string) => invoke<ArticleFullVM | null>("get_article", { id }),
  markRead: (id: string, read: boolean) => invoke<void>("mark_read", { id, read }),
  toggleStar: (id: string) => invoke<boolean>("toggle_star", { id }),
  toggleLater: (id: string) => invoke<boolean>("toggle_later", { id }),
  setProgress: (id: string, progress: number) =>
    invoke<void>("set_progress", { id, progress }),
  markAllRead: (kind: string, id: string) =>
    invoke<void>("mark_all_read", { kind, id }),
  createSpace: (name: string, color: string, keywords: string[]) =>
    invoke<string>("create_space", { name, color, keywords }),
  addToSpace: (articleId: string, spaceId: string) =>
    invoke<void>("add_to_space", { articleId, spaceId }),
  refreshAll: () => invoke<RefreshSummary>("refresh_all"),
  getFullText: (id: string, force = false) =>
    invoke<string>("get_full_text", { id, force }),
  addFeed: (url: string, folderId: string | null) =>
    invoke<string>("add_feed", { url, folderId }),
  importOpml: (path: string) => invoke<number>("import_opml", { path }),
  exportOpml: (path: string) => invoke<void>("export_opml", { path }),
  listFolders: () => invoke<FolderVM[]>("list_folders"),
  refreshFeed: (id: string) => invoke<number>("refresh_feed", { id }),
  refreshFolder: (id: string) => invoke<RefreshSummary>("refresh_folder", { id }),
  deleteFeed: (id: string) => invoke<void>("delete_feed", { id }),
  moveFeedToFolder: (feedId: string, folderId: string | null) =>
    invoke<void>("move_feed_to_folder", { feedId, folderId }),
  createFolder: (title: string) => invoke<string>("create_folder", { title }),
  renameFolder: (id: string, title: string) => invoke<void>("rename_folder", { id, title }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),
  renameFeed: (id: string, title: string) => invoke<void>("rename_feed", { id, title }),
  setFeedOnlySummary: (id: string, value: boolean) =>
    invoke<void>("set_feed_only_summary", { id, value }),
  updateSpace: (id: string, name: string, color: string, keywords: string[]) =>
    invoke<void>("update_space", { id, name, color, keywords }),
  deleteSpace: (id: string) => invoke<void>("delete_space", { id }),
  getSpaceKeywords: (id: string) => invoke<string[]>("get_space_keywords", { id }),
  getSpaceRule: (id: string) => invoke<RuleVM | null>("get_space_rule", { id }),
  saveSpace: (a: SaveSpaceArgs) =>
    invoke<string>("save_space", {
      id: a.id,
      name: a.name,
      color: a.color,
      field: a.field,
      keywords: a.keywords,
      scopeAll: a.scopeAll,
      scopeFeeds: a.scopeFeeds,
      hideFromSource: a.hideFromSource,
    }),
  searchArticles: (query: string) => invoke<ArticleListVM[]>("search_articles", { query }),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  copyText: (text: string) => invoke<void>("copy_text", { text }),
  openWebPreview: (url: string, x: number, y: number, width: number, height: number) =>
    invoke<void>("open_web_preview", { url, x, y, width, height }),
  resizeWebPreview: (x: number, y: number, width: number, height: number) =>
    invoke<void>("resize_web_preview", { x, y, width, height }),
  closeWebPreview: () => invoke<void>("close_web_preview"),
  openVideo: (url: string, x: number, y: number, width: number, height: number) =>
    invoke<void>("open_video", { url, x, y, width, height }),
  closeVideo: () => invoke<void>("close_video"),
};
