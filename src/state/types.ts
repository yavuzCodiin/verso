// Verso UI state contract — README §7 (prototip durum değişkenleriyle birebir).

export type Mode = "ozet" | "tam" | "web";
export type Theme = "kagit" | "gece" | "yosun" | "cyber";
export type SelKind = "feed" | "space" | "smart" | "folder";
export type ReadFont = "serif" | "sans";
export type Width = "dar" | "orta" | "genis";
export type OverlayKind = null | "cmd" | "theme" | "aa" | "add" | "addfeed" | "settings";

export interface Settings {
  notify: boolean;
  quietEnabled: boolean;
  quietStart: string; // "HH:MM"
  quietEnd: string;
}

/** Uzun işlerin (yenileme/OPML) canlı ilerlemesi — "verso-progress" event'i. */
export interface TaskProgress {
  kind: string; // "refresh" | "import"
  done: number;
  total: number;
  label: string;
}

/** Sağ tık bağlam menüsü durumu. */
export interface CtxState {
  kind: "article" | "feed" | "folder" | "space" | "smart" | "allroot";
  id: string;
  x: number;
  y: number;
}

export interface UIState {
  theme: Theme;
  auto: boolean; // otomatik gündüz/gece
  selKind: SelKind; // kenar çubuğunda seçili grup türü
  selId: string; // seçili feed/alan/akıllı-liste id'si
  articleId: string; // okuyucudaki makale
  mode: Mode; // okuyucu modu
  overlay: OverlayKind;
  refreshing: boolean;
  readFont: ReadFont; // Aa
  size: number; // Aa yazı boyutu adımı
  width: Width;
  starred: Record<string, boolean>; // makale id → yıldız
  later: Record<string, boolean>; // makale id → sonra oku
  progress: number; // aktif makale okuma % (0-100)
}
