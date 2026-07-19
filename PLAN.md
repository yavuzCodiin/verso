# Verso — Uygulama Kurulum Planı (PLAN.md)

> Bu belge **onay içindir**. Sen onaylamadan hiçbir kurulum/scaffold yapılmayacak.
> Kaynak: `design_handoff_verso/README.md` (spesifikasyon) + `Verso.dc.html` (nihai
> tasarım — piksel hedefi). Tokenlar README Bölüm 10'dan **birebir** uygulanacak.

---

## 0. Ortam Durumu (tarandı) ve Kurulacaklar

Makinede tespit edilenler:

| Bileşen | Durum | Not |
|---|---|---|
| macOS | ✅ 15.5 (Sequoia), **arm64** (Apple Silicon) | |
| Xcode Command Line Tools | ✅ Kurulu | `/Library/Developer/CommandLineTools` — `xcode-select --install` **gerekmiyor** |
| Homebrew | ✅ 6.0.10 | `/opt/homebrew` — kurmaya **gerek yok** |
| Node.js | ⚠️ v24.11.0 (LTS hattı) | npm 11.6.1. **AMA** Zed editörüne gömülü: `~/Library/Application Support/Zed/node/…` |
| Rust / cargo / rustup | ❌ **YOK** | Tauri için **zorunlu** — kurulacak tek gerçek şey |
| git / curl | ✅ | git 2.39.5 |

### 0.1 Zorunlu kurulum — Rust (rustup)
Sana göstereceğim, sen Enter'layacaksın:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```
Doğrulama: `rustc --version`, `cargo --version`, `rustup --version`
(Varsayılan hedef `aarch64-apple-darwin` otomatik gelir; v1 için yeterli.
Universal/x86 derleme ileride `rustup target add x86_64-apple-darwin`.)

### 0.2 Önerilen (opsiyonel) — sistem Node'u
Mevcut Node çalışıyor ama **Zed editörünün içinden** geliyor; Zed güncellen/kaldırılınca
proje derlemesi bozulabilir. Editörden bağımsız, kalıcı bir Node için:

```bash
brew install node        # şu an Node 24 (LTS hattı) kurar
```
Doğrulama: `which -a node` (PATH sırasına bakarız), `node -v`, `npm -v`.
> Karar senin: (a) `brew install node` ile kalıcı sistem Node'u (önerilen), ya da
> (b) mevcut v24.11.0 ile devam. İkisi de Vite/React için teknik olarak yeterli.

### 0.3 Tauri 2 macOS ön-koşulları
Yukarıdakiler dışında macOS'ta **ek sistem paketi gerekmez** — Tauri yerleşik
WKWebView kullanır (Linux'taki WebKitGTK vb. bu platformda geçersiz).

**→ İlk DURUŞ:** Bu plan onaylanınca Adım 0 (yukarıdaki kurulum) yapılır, doğrulanır,
sana gösterilir; onaylamadan Faz 1'e geçilmez.

---

## 1. Mimari Kararlar (README Bölüm 4'e uyumlu)

**Cargo workspace** ile UI'dan bağımsız çekirdek:

```
UI (React+TS, platformdan bağımsız)
        │  @tauri-apps/api invoke  (IPC)
        ▼
src-tauri  (ince Tauri kabuğu — sadece #[tauri::command] sarmalayıcılar)
        │  path dependency
        ▼
verso-core (SAF Rust crate — Tauri'ye bağımlı DEĞİL)
   fetch · parse · rules · readability · SQLite · OPML · sync-log
```
- **`verso-core` neden ayrı crate?** README Bölüm 4: çekirdek "hem masaüstü hem mobilde
  aynı". Tauri'ye bağımlı olmadığı için ileride Android/Windows kabuğu aynı crate'i kullanır.
- **Local-first hazırlığı (v1'de aktif değil):** her `Article`/`Space` kaydında
  `updated_at` + `deleted`, ve durum değişiklikleri için bir **operation log** tablosu
  şema düzeyinde kurulur; v2 senkronu bunun üstüne biner. UI hep yerel DB'den okur.
- **Pencere kromu (macOS):** Tasarımda kendi başlık çubuğu var. Gerçek uygulamada native
  trafik ışıklarını KORUYUP üstüne kendi çubuğumuzu çizmek için
  `titleBarStyle: "Overlay"` + `hiddenTitle: true` kullanılacak (prototipteki sahte 12px
  daireler yerine gerçek, çalışan ışıklar — görünüm aynı, UX daha iyi). Başlangıç boyutu
  **1340×860**, `resizable`, `minWidth ~960`; köşe yuvarlaklığı/gölge macOS'ta yerleşik.
  > İstersen tam sadık "sahte ışıklar + `decorations:false`" varyantına geçebiliriz; native
  > ışıklar hem daha standart hem daha az bakım gerektirdiği için varsayılan bu.

---

## 2. Klasör Yapısı

Uygulama, `project-Verso/` kökünde kurulur; `design_handoff_verso/` referans olarak durur.

```
project-Verso/
├── PLAN.md
├── design_handoff_verso/          # dokunulmaz referans
├── Cargo.toml                     # [workspace] members = ["src-tauri", "core"]
├── package.json  index.html  vite.config.ts  tsconfig.json  .gitignore
│
├── src/                           # ── React UI (platformdan bağımsız) ──
│   ├── main.tsx  App.tsx
│   ├── styles/
│   │   ├── themes.css             # data-theme token sistemi (Bölüm 10, birebir)
│   │   └── global.css             # reset, scrollbar, vpop/vfade/vspin animasyonları
│   ├── state/
│   │   ├── types.ts               # Mode/Theme/SelKind + UIState (Bölüm 7 birebir)
│   │   └── store.ts               # Zustand store (+ persist: theme/font/size/width…)
│   ├── data/sampleData.ts         # Faz 2: prototipteki statik veri (feeds/articles/…)
│   ├── components/
│   │   ├── TitleBar.tsx  Sidebar.tsx  ArticleList.tsx
│   │   ├── reader/ Reader.tsx  ReaderToolbar.tsx  ArticleBody.tsx  ProgressBar.tsx
│   │   └── overlays/ ThemeMenu.tsx  AaPanel.tsx  CommandPalette.tsx  AddSpaceModal.tsx  Overlay.tsx
│   ├── hooks/ useKeyboard.ts  useReadingProgress.ts  useAutoTheme.ts
│   └── lib/ ipc.ts                # invoke sarmalayıcıları (web-dev'de mock'a düşer)
│
├── src-tauri/                     # ── Tauri 2 kabuk ──
│   ├── Cargo.toml  tauri.conf.json  build.rs
│   ├── capabilities/default.json
│   ├── icons/                     # uygulama ikonları
│   └── src/ main.rs  lib.rs  commands.rs
│
└── core/                          # ── verso-core (saf Rust) ──
    ├── Cargo.toml
    └── src/ lib.rs  models.rs  db.rs  migrations.rs  fetch.rs  parse.rs
              rules.rs  readability.rs  opml.rs  notify.rs  sync.rs
```

---

## 3. Bağımlılık Listesi

### 3.1 Frontend (`package.json`)
| Paket | Amaç |
|---|---|
| `react` ^18.3, `react-dom` ^18.3 | UI |
| `typescript` ~5.7, `vite` ^6, `@vitejs/plugin-react` | derleme/dev |
| `@tauri-apps/api` ^2 | IPC (`invoke`) |
| `@tauri-apps/cli` ^2 *(dev)* | `tauri dev`/`build` |
| `@tauri-apps/plugin-notification` ^2 | yeni yazı bildirimi (Bölüm 9) |
| `@tauri-apps/plugin-dialog` ^2 | OPML içe/dışa aktarma dosya seçici |
| `zustand` ^5 (+ `persist`) | durum yönetimi — UIState (Bölüm 7) + kalıcılık |
| `@fontsource-variable/newsreader` | Newsreader'ı **paketleyip** çevrimdışı sun (Bölüm 11) |
| `lucide-react` | ikonlar (~1.5px çizgi; Bölüm 11 önerisi) |
| `clsx` | koşullu class birleştirme |

> Stil: Tailwind YOK. Tema tokenları **CSS custom property** olarak kalır (`data-theme`);
> yapısal stiller CSS Modules + piksel-kritik yerlerde prototiple birebir inline stil.

### 3.2 `verso-core/Cargo.toml`
| Crate | Amaç |
|---|---|
| `rusqlite` (feature `bundled`) | SQLite — sistem kütüphanesi gerektirmez |
| `feed-rs` | RSS/Atom/JSON Feed ayrıştırma |
| `reqwest` (feature `rustls-tls`) | feed/HTML indirme (OpenSSL sistem bağımlılığı yok) |
| `dom_smoothie` | Readability (Mozilla portu) — tam metin çıkarımı *(yedek: `readability`)* |
| `opml` | OPML içe/dışa aktarma |
| `serde`, `serde_json` | IPC serileştirme |
| `chrono` | tarih/saat (published_at, sessiz saat) |
| `uuid` (v4) | id üretimi |
| `thiserror`, `anyhow` | hata yönetimi |
| `tokio` | async çalışma zamanı (Tauri ile ortak) |

### 3.3 `src-tauri/Cargo.toml`
`tauri` ^2, `tauri-build` ^2, `verso-core` (path), `tauri-plugin-notification` ^2,
`tauri-plugin-dialog` ^2, `serde`, `serde_json`, `tokio`.

---

## 4. Faz Planı ve DURUŞ Noktaları

Her fazda `npm run tauri dev` **çalışır** kalır; ne yaptığımı özetlerim.

| Faz | İçerik | Kaynak | Çıktı |
|---|---|---|---|
| **0** | Rust kurulumu (+ops. brew node), doğrulama | §0 | `cargo -v` çalışır → **⏸ DUR / onay** |
| **1** | Vite+React+TS + Tauri iskeleti; `data-theme` + 4 tema; Newsreader paketli | README §10 | Pencere açılır, tema butonu 4 temayı değiştirir |
| **2** | Statik veriyle 3 panel + okuyucu (piksel hedefi prototip) | README §5 | Sidebar/liste/okuyucu prototiple birebir |
| **3** | Durum + etkileşimler + klavye (j/k/s/m/r/v, Esc, seçim, mod, ilerleme) | README §6–7 | Prototipteki tüm davranış |
| **4** | Overlay'ler: Tema menüsü · Aa · Komut paleti (⌘K) · Alan kurma | README §5.5–5.8 | Tüm overlay'ler + animasyonlar |
| — | **Faz 1–4 bitince → ⏸ DUR, sana göster, onay bekle** | | Çalışan macOS v1 UI (statik veri) |
| **5** | verso-core: SQLite şema (§8) · feed fetch/parse (feed-rs) · kural motoru · Readability; UI'yı gerçek DB'ye bağla | README §8–9 | Gerçek feed'ler, gerçek makaleler |
| **6** | OPML içe/dışa · bildirim + sessiz saat · ayar kalıcılığı | README §9 | Tam v1 |

> İki zorunlu duruş: **(a) Adım 0 sonrası**, **(b) Faz 1–4 sonrası**. Faz 5–6 ikinci
> onaydan sonra. Kapsam dışı bu turda: **Android / Windows / senkron** (yalnız şema hazır).

---

## 5. Tasarıma Sadakat Notları (Bölüm 3 & 10)

- Tema tokenları (`--bg --panel --panel2 --reader --fg --dim --faint --accent --accent2
  --soft --line --border --hover --code --chip --seltext --titlefont --readfont --titlewt
  --shadow`) `Verso.dc.html` satır 18–21'den **birebir** kopyalanır.
- Panel genişlikleri **246 / 380 / esnek**; başlık **50**, araç çubuğu **47**, ilerleme **3**.
- Tipografi ölçeği: makale başlığı **33**, liste başlığı **21**, öğe başlığı **17.5**,
  gövde p **17/1.75**, kicker/meta **10–10.5** uppercase; min gövde 17px, hiçbir metin <10px.
- Animasyon: `vfade .12s` · `vpop .14s cubic-bezier(.2,.8,.2,1)` · `vspin .7s` · tema `.18s ease`.
- Okuyucu modları Özet/Tam/Web; Özet ilk 2 bloğa kırpılır + "Tam metni oku" çağrısı.

## 6. Bilinen Risk / Açık Nokta
- **Web modu (dahili tarayıcı):** Tauri 2'de pencere içine gömülü ikinci webview
  deneyseldir. Hedef: okuyucu alanına konumlanan child-webview; zorlanırsa v1 fallback =
  ayrı native webview penceresi. (`<iframe>` çoğu sitede X-Frame-Options ile engellenir —
  kullanılmaz.) AdBlock filtre listeleri v1 sonrası.
- **Readability crate seçimi** (`dom_smoothie` vs `readability`) Faz 5 başında küçük bir
  PoC ile kesinleşir; ikisi de Rust.

## 7. Doğrulama
- Ortam: `rustc --version && cargo --version && node -v && npm -v && xcode-select -p`
- Her faz: `npm run tauri dev` açılır, ilgili davranış elle denenir + özet.
- Faz 5: `cargo test -p verso-core` (şema/kural/parse birim testleri).

---

### Onay
Bu yapı, bağımlılıklar ve Adım 0 komutları uygunsa **"onaylıyorum"** de; Adım 0'ı
uygulayıp doğrulama çıktısını göstereyim ve tekrar durayım. Değişiklik istersen söyle.
