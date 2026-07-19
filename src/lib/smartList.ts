// Akıllı liste metadatası (ikon + ad). Sayılar store.smart'tan (DB) gelir.
export interface SmartMeta {
  id: "bugun" | "yildizli" | "sonra";
  icon: string;
  name: string;
}

export const SMART: SmartMeta[] = [
  { id: "bugun", icon: "◷", name: "Today" },
  { id: "yildizli", icon: "★", name: "Starred" },
  { id: "sonra", icon: "◎", name: "Read Later" },
];
