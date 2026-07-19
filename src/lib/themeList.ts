import type { Theme } from "../state/types";

// Tema menüsü metadatası (Verso.dc.html themeMeta) — c1/c2 üst üste binen renk daireleri.
export interface ThemeMeta {
  id: Theme;
  name: string;
  c1: string;
  c2: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "kagit", name: "Paper", c1: "#f9f5ee", c2: "#b0532a" },
  { id: "gece", name: "Night", c1: "#17181d", c2: "#d07a4f" },
  { id: "yosun", name: "Moss", c1: "#eef2e6", c2: "#4a7a4a" },
  { id: "cyber", name: "Cyberpunk", c1: "#0b0f14", c2: "#3ef08a" },
];
