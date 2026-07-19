# Devir Paketi: Verso — RSS Okuyucu

> Bu belge, Claude Code (veya herhangi bir geliştirici) tarafından okunup gerçek bir
> uygulamaya dönüştürülmek üzere yazılmıştır. Tek başına yeterlidir: bu konuşmada
> bulunmayan biri bile yalnızca bu README ile tasarımı birebir uygulayabilir.

---

## 1. Genel Bakış

**Verso**, sakin/editoryal bir okuma deneyimini güçlü organizasyon araçlarıyla birleştiren
bir RSS okuyucudur. Mevcut RSS Guard (Qt) kurulumunun yerine geçecek, sıfırdan yazılan
yerli bir uygulamadır.

Temel fikirler:
- **Üç panel**: Kaynaklar/Alanlar kenar çubuğu · editoryal makale listesi · okuyucu.
- **Dört tema** (Kağıt / Gece / Yosun / Cyberpunk) + otomatik gündüz/gece.
- **Alanlar (Spaces)**: kullanıcının kendi tanımladığı akıllı kuyruklar (ör. Rust, Robotik, ML).
  Hem anahtar-kelime kuralıyla otomatik dolar hem elle eklenir.
- **Okuyucu üç modu**: Özet · Tam Metin (siteden Readability ile çekilmiş) · Web (dahili tarayıcı).
- **Komut paleti (⌘K)**, tam klavye navigasyonu, Sonra Oku, "kaldığın yerden devam".

## 2. Bu Paketteki Dosyalar Hakkında

Buradaki `Verso.dc.html` **bir tasarım referansıdır** — HTML ile üretilmiş, istenen
görünümü ve davranışı gösteren yüksek-doğruluklu bir prototip. **Doğrudan production'a
kopyalanacak kod değildir.** Görev, bu tasarımı hedef teknoloji yığınında (React + TypeScript)
o yığının kendi bileşen/durum kalıplarıyla **yeniden inşa etmektir**.

Prototip tek dosyalık, çalışır bir React uygulamasıdır (özel bir "DC" runtime'ında). Tüm
etkileşimler gerçektir: tema değişimi, makale seçimi, okuyucu modları, komut paleti (⌘K),
klavye kısayolları (j/k/s/m/r/v, Esc). Referans alırken **davranışı buradan izleyin.**

## 3. Doğruluk (Fidelity)

**Yüksek doğruluk (hi-fi).** Renkler, tipografi, boşluklar ve etkileşimler nihaidir.
Bölüm 10'daki token değerleri (hex/px) birebir uygulanmalıdır. Piksel hedefi budur.

---

## 4. Mimari ve Yol Haritası

Kullanıcının hedefi: **önce Mac uygulaması → sonra Android → sonra Windows → hepsi senkron.**
Bunu ilk günden mümkün kılan mimari:

### Önerilen yığın
- **UI**: React 18 + TypeScript + Vite. Stil için CSS değişkenleri (theming) + CSS Modules
  veya vanilla-extract (Tailwind da olur ama token'lar CSS custom property olarak kalmalı —
  tema değişimi runtime'da `data-theme` ile yapılır, bkz. Bölüm 10).
- **Masaüstü kabuk**: **Tauri 2** (Rust çekirdek). Electron yerine Tauri; çünkü:
  - küçük ikili, düşük RAM (kullanıcı ~6400 makale ölçeğinde çalışıyor),
  - Android hedefi Tauri 2 ile aynı çekirdeği paylaşabilir,
  - Rust tarafı feed çekme + veritabanı + full-text extraction için ideal.
- **Çekirdek mantık (paylaşılan)**: Rust "core" crate — feed fetch/parse, planlayıcı,
  kural motoru, veritabanı, senkron. UI'dan bağımsız; hem masaüstü hem mobilde aynı.
- **Veritabanı**: SQLite (Rust tarafında `sqlx` veya `rusqlite`). RSS Guard da SQLite kullanıyor;
  şema basit tutulmalı (Bölüm 8).
- **Feed parse**: Rust `feed-rs` (RSS/Atom/JSON Feed).
- **Full-text**: Rust `readability`/`dom_smoothie` ya da mevcut "article extractor" mantığı.
- **Senkron (ileride)**: çekirdeği "local-first" tasarla — her makale/etiket için
  `id`, `updated_at`, `deleted` alanları; durum değişiklikleri (okundu/yıldız/etiket) bir
  **operation log** olarak tutulsun. İlk sürümde tek makine; sonra bu log bir sunucuya
  (kendi backend'in veya Feedly/Inoreader Google Reader API'si) replike edilir. UI bu
  ayrımı hiç bilmemeli — hep yerel DB'den okur.

### Katmanlar
```
┌─────────────────────────────────────────┐
│  React + TS UI  (bu tasarım)             │  ← platformdan bağımsız
├─────────────────────────────────────────┤
│  Tauri komutları (invoke) / IPC          │
├─────────────────────────────────────────┤
│  Rust core: fetch · parse · rules ·      │  ← Mac/Android/Windows ortak
│  extractor · SQLite · sync log           │
└─────────────────────────────────────────┘
```

### Sürüm planı
- **v1 (Mac)**: 3 panel, 4 tema, feed CRUD + OPML, Alanlar + kural motoru, okuyucu 3 modu,
  komut paleti, klavye, Sonra Oku, kaldığın yer, bildirim + sessiz saat. Tek makine, yerel DB.
- **v1.1**: Android (Tauri 2 mobile) — aynı core, mobil-uyarlı UI (tek panel + gezinme).
- **v1.2**: Windows (Tauri zaten çapraz) + pencere kromu farkları.
- **v2**: Senkron (operation-log replikasyonu; opsiyonel Google Reader API uyumluluğu).

---

## 5. Ekranlar / Görünümler

Uygulama tek pencere; içindeki paneller ve üst-katman (overlay) görünümleri:

### 5.1 Başlık Çubuğu (Title Bar) — yükseklik 50px
- Sol: macOS trafik ışıkları (12px daireler, boşluk 8px: `#ff5f57 #febc2e #28c840`),
  ince ayraç (1px, `--border`), ürün adı **"Verso"** (`--titlefont`, 600, 16px), ardından
  soluk **breadcrumb** (12px, `--faint`; ör. "FeedBoba › Barry's C++ Blog").
- Orta-sağ: **Arama/komut tetikleyici** — 250px, `--chip` zemin, `--border` çerçeve, 8px radius,
   padding 6/12px; içinde arama ikonu + "Ara veya komut…" (12.5px `--faint`) + sağda `⌘K` rozeti
  (11px monospace, `--border` çerçeveli). Tıklayınca komut paleti açılır.
- Sağ: **Yenile** butonu (32×32, hover `--hover`; ikon `--accent`; yüklenirken 0.7s dönüş animasyonu),
  **Tema** butonu (32×32; ikonu yarısı `--reader` yarısı `--accent` olan 15px daire).

### 5.2 Kenar Çubuğu (Sidebar) — genişlik 246px, `--panel` zemin, sağ 1px `--border`
Dikey kaydırılabilir. Üç bölüm, her başlık 10.5px/700/`--faint`, letter-spacing .12em, uppercase:
1. **Akıllı** — satırlar: Bugün (◷), Yıldızlı (★), Sonra Oku (◎). Her satır: ikon (17px kutu),
   ad (13px), sağda sayı (11px monospace `--faint`). Seçili satır: `--soft` zemin.
2. **Alanlar** — başlıkta sağda `＋` (yeni alan; `--accent`, hover `--soft`). Satırlar: 9px
   yuvarlak-köşe renk noktası (alanın kendi rengi) + ad + sayı. Seçili: `--soft` zemin +
   sol 3px iç-gölge çubuğu alanın renginde.
3. **Kaynaklar** — feed satırları: 18px favicon kutusu (harf, feed rengi zemin, beyaz yazı) +
   ad + sayı. Seçili: `--soft` zemin.
- Satır hover: `--hover`. Seçili olmayan metin `--dim`, seçili `--fg`.
- Alt: ince ayraç üstünde "Sessiz saat · 09:00–18:00 / bildirim yok" (10.5px `--faint`).

### 5.3 Makale Listesi — genişlik 380px, `--panel2` zemin, sağ 1px `--border`
- **Başlık** (padding 18/22px, alt 1px `--border`): küçük kicker (10.5px/600/`--accent`,
  uppercase, .13em; Alan seçiliyse solunda renk noktası + "Alan · kural + elle") + büyük başlık
  (`--titlefont`, `--titlewt`, 21px) + soluk alt bilgi ("· N yazı").
- **Satırlar** (her biri buton, block, margin 0 6px, padding 14/16px, radius 9px, alt 1px `--border`):
  - Üst meta satırı: okunmamış noktası (6px daire `--accent`; okunan/seçili için transparent) +
    "KAYNAK · TARİH · N DK" (10px/600 uppercase; seçili `--accent`, değilse `--faint`) +
    sağda yıldız (★) eğer yıldızlıysa.
  - Başlık (`--titlefont`, 17.5px, satır 1.28; seçili `--seltext`, okunmuş `--faint`/400, normal `--fg`/500).
  - Dek (özet): 12.5px `--dim`, 2 satır kırpma (`-webkit-line-clamp:2`). Yalnızca okunmamış/seçili
    satırda gösterilir.
  - Etiketler: `#etiket` çipleri (10px, `--accent`, `--soft` zemin, radius 4px).
  - Seçili satır: `--soft` zemin + sol 3px iç-gölge `--accent`.
- **Alt klavye ipuçları çubuğu** (padding 9/20px, üst 1px `--border`): "J/K gez · M okundu ·
  S yıldız · R sonra oku" (10.5px `--faint`; kısayol harfleri monospace/600 `--dim`).

### 5.4 Okuyucu (Reader) — kalan genişlik, `--reader` zemin
- **İlerleme çubuğu** (üstte 3px, `--border` zemin, dolgu `--accent`, genişlik = okuma yüzdesi).
- **Araç çubuğu** (47px, alt 1px `--border`):
  - **Mod segmenti** (çerçeve `--border`, `--chip` zemin, radius 8px): **Özet | Tam Metin | Web**.
    Aktif: `--accent` zemin, `--seltext` yazı, 600. Pasif: `--dim`.
  - Tam Metin aktifken yanında "● tam içerik çekildi" (11px `--accent`).
  - Sağ: **Aa** butonu (okuma ayarları), **Yıldız** (★/☆, aktif `--accent`), **Sonra Oku**
    (yer-imi ikonu). Hepsi hover `--hover`.
- **Gövde** (kaydırılabilir):
  - Özet/Tam Metin modu: ortalanmış sütun (max 640px, padding 34/44px).
    - "Kaldığın yer · %N" şeridi (`--soft` zemin, `--line` çerçeve) — ilerleme > 0 iken.
    - Kicker satırı: KAYNAK ——— TARİH (10.5px/600 `--accent`, ortada `--line` çizgi).
    - Başlık (`--titlefont`, `--titlewt`, 33px, satır 1.18, letter-spacing -.015em).
    - Yazar + "N dk okuma" (italik `--readfont` 14.5px `--dim`) + etiket çipleri.
    - 44px `--fg` üst-çizgi ayraç.
    - Gövde blokları: **p** (`--readfont` 17px/1.75), **h2** (`--titlefont` 21px/600),
      **pre/code** (`--code` zemin, `--border` çerçeve, radius 9px, 13px monospace),
      **blockquote** (italik `--dim`, sol 2px `--line`).
    - Özet modunda gövde ilk 2 bloğa kırpılır ve altında **"Tam metni oku"** kesikli-çerçeve
      çağrısı görünür (tıklayınca Tam Metin moduna geçer).
  - Web modu: üstte sahte adres çubuğu (yeşil nokta + URL monospace + "dahili tarayıcı · AdBlock açık"),
    altında sayfanın tam hâli (max 680px). Gerçekte bu bir gömülü web görünümü (Tauri WebView /
    `<iframe>` değil — native webview) olacaktır.

### 5.5 Tema Menüsü (overlay) — sağ üstte açılır kart (270px)
- Başlık "Tema" + dört seçenek (Kağıt/Gece/Yosun/Cyberpunk). Her satır: iki üst-üste binen
  15px renk dairesi (temanın c1/c2'si) + ad + aktifse ✓ (`--accent`). Aktif satır `--soft`.
- Altta ayraç + **"Otomatik gündüz / gece"** anahtarı (toggle; açıkken `--accent`,
  knob sağda). Altında "Gündüz Kağıt, gece Gece." açıklaması.
- Zemin: yarı saydam örtü; örtüye/Esc'e tıklayınca kapanır. Açılış animasyonu `vpop` (0.14s).

### 5.6 Aa Paneli (overlay) — sağda açılır kart (262px)
- "Okuma Ayarları" başlığı. **Serif | Sans** segment (aktif `--accent`). Boyut kaydırıcısı
  (A····A, dolgu `--accent`). "Satır genişliği": Dar/Orta/Geniş segment butonları. Altta not:
  "Tema başına ayrı hatırlanır."

### 5.7 Alan Kurma (modal) — ortada 520px kart
- "Yeni Alan" + ad girişi (`--titlefont` 19px, imleç) + 4 renk seçeneği (24px kutu, seçili
  halka).
- "Otomatik doldurma kuralı" kutusu: "başlık veya içerik şunlardan birini içerirse" +
  kelime çipleri (rust ✕, cargo ✕, tokio ✕, borrow checker ✕) + "＋ kelime".
- Açıklama: kural her yeni yazıda çalışır; ayrıca `R` ile elle eklenir.
- Alt: **Vazgeç** / **Alanı Kur** (dolu `--accent` buton).

### 5.8 Komut Paleti (overlay ⌘K) — üstte ortalanmış 600px kart
- Arama girişi (ikon + imleçli metin + `esc` rozeti).
- **Eylemler**: Yeni feed ekle (A) · Yeni alan oluştur · Tümünü yenile (⌘R) · Tümünü okundu say.
- **Sonuçlar**: makale satırları (favicon + başlık + kaynak adı). Tıklayınca o makaleye gider.

---

## 6. Etkileşimler ve Davranış

- **Tema değişimi**: `data-theme` özniteliği kök öğede değişir → tüm CSS değişkenleri güncellenir.
  Geçişler `transition: background/color .18s ease`. Otomatik mod açıksa saat 07–19 arası Kağıt,
  değilse Gece (uygulamada `prefers-color-scheme` veya saate bağlanabilir).
- **Makale seçimi**: liste satırına tıkla → okuyucu güncellenir, mod "Özet"e döner, ilerleme sıfırlanır.
- **Mod geçişi**: Özet→Tam Metin ilk seçimde full-text fetch tetiklenir (Readability); Web modu
  gömülü webview açar.
- **Yenile**: ikon 0.9s döner (`vspin`), sonra durur (gerçekte fetch tamamlanınca).
- **Overlay'ler**: örtüye tıklama veya `Esc` kapatır. Modal içine tıklama `stopPropagation` ile korunur.
- **Animasyonlar**: overlay girişleri `vfade` (0.12s), kartlar `vpop` (0.14s cubic-bezier(.2,.8,.2,1)).
- **Hover**: tüm satır/buton hover'ları `--hover` zemin; tetikleyiciler `--line` çerçeve.

### Klavye kısayolları (global)
| Tuş | Eylem |
|-----|-------|
| ⌘K / Ctrl+K | Komut paletini aç/kapat |
| Esc | Açık overlay'i kapat |
| J / ↓ | Sonraki makale |
| K / ↑ | Önceki makale |
| M | Okundu işaretle (ve sonrakine geç) |
| S | Yıldızla / kaldır |
| R | Aktif alana / Sonra Oku'ya ekle |
| V | Web (dahili tarayıcı) moduna geç |

## 7. Durum Yönetimi (State)

Prototipteki durum değişkenleri (React state / store'a birebir taşınır):

```ts
type Mode = 'ozet' | 'tam' | 'web';
type Theme = 'kagit' | 'gece' | 'yosun' | 'cyber';
type SelKind = 'feed' | 'space' | 'smart';

interface UIState {
  theme: Theme;
  auto: boolean;              // otomatik gündüz/gece
  selKind: SelKind;           // kenar çubuğunda seçili grup türü
  selId: string;              // seçili feed/alan/akıllı-liste id'si
  articleId: string;          // okuyucudaki makale
  mode: Mode;                 // okuyucu modu
  overlay: null | 'cmd' | 'theme' | 'aa' | 'add';
  refreshing: boolean;
  readFont: 'serif' | 'sans'; // Aa
  size: number;               // Aa yazı boyutu adımı
  width: 'dar' | 'orta' | 'genis';
  starred: Record<string, boolean>;   // makale id → yıldız
  later: Record<string, boolean>;     // makale id → sonra oku
  progress: number;           // aktif makale okuma % (0-100)
}
```
Kalıcı olmalı (localStorage / DB): `theme`, `auto`, `readFont`, `size`, `width`, ve her makalenin
`progress`/`starred`/`later`/okundu durumu. `progress` gerçekte okuyucunun kaydırma konumundan hesaplanır.

## 8. Veri Modeli (öneri — Rust core / SQLite)

```
Feed        { id, url, title, site_url, icon_letter, color, folder_id, only_summary,
              last_fetch, unread_count }
Folder      { id, title }                          // "AI & Programming" gibi
Article      { id, feed_id, title, dek, author, url, published_at, fetched_at,
              content_summary, content_full,        // full: Readability çıktısı (lazy)
              is_read, is_starred, is_later,
              read_progress,                         // 0..100
              updated_at, deleted }                  // sync için
Space        { id, name, color, manual_only }        // "Alan" = özel etiket + kural
SpaceRule    { id, space_id, field('title'|'content'|'both'),
              keywords[], scope('all'|feed_ids[]), hide_from_source }
ArticleSpace { article_id, space_id, source('rule'|'manual') }
Tag          { id, name } / ArticleTag              // #rust gibi otomatik etiketler
```
- **Alanlar RSS Guard'ın "label + article filter" mantığının UI'ya taşınmış hâlidir**: her Alan
  bir etikettir; kuralı bir kelime-eşleştirme filtresidir. Kullanıcı istediği kadar Alan
  tanımlar; "Sonra Oku" özel/yerleşik bir Alandır.
- Akıllı listeler sorgudur: **Bugün** = `published_at >= today`; **Yıldızlı** = `is_starred`;
  **Sonra Oku** = `is_later`.

## 9. Özellik Spesifikasyonları

- **Alanlar + kural motoru**: Yeni yazı geldiğinde başlık/içerik, her Alanın anahtar
  kelimeleriyle (case-insensitive, substring) eşleştirilir; eşleşen yazı o Alana atanır
  (`source='rule'`). Kapsam tüm kaynaklar veya seçili kaynaklar olabilir. `hide_from_source`
  açıksa yazı yalnızca Alanda görünür. Elle ekleme: `R` kısayolu (`source='manual'`).
- **Tam Metin çekme (Readability)**: `only_summary` feed'lerde veya kullanıcı isteğiyle,
  makale URL'i indirilip okunabilir metne çevrilir (`content_full` cache'lenir). Otomatik dene
  (kullanıcı tercihi), başarısızsa Özet'e düş. Görseller/kod korunur, reklam/nav temizlenir.
- **Okuyucu modları**: Özet (feed içeriği, ilk paragraflar) · Tam Metin (`content_full`) ·
  Web (native gömülü webview, AdBlock filtre listeleriyle).
- **Komut paleti**: fuzzy arama — eylemler + feed'ler + makaleler. Klavyeyle gezinilebilir.
- **Sonra Oku + kaldığın yer**: `is_later` kuyruğu; `read_progress` kaydırma ile güncellenir,
  makaleye dönünce "Kaldığın yer · %N" şeridi + kaldığı yere atlama.
- **OPML içe/dışa aktarma**: standart OPML; feed'ler ve klasörler.
- **Bildirim + sessiz saat**: yeni yazı bildirimi; kullanıcı-tanımlı saat aralığında sustur.
- **Podcast/medya**: enclosure'lı yazılarda gömülü oynatıcı (v1 sonrası).

## 10. Tasarım Token'ları

### Tema paletleri (CSS custom properties — kökte `data-theme` ile değişir)

Ortak: geçiş `--tr: .18s ease`.

| Token | Kağıt (kagit) | Gece (gece) | Yosun (yosun) | Cyberpunk (cyber) |
|-------|-------|------|-------|-----------|
| `--bg` | `#efeae0` | `#131418` | `#dfe5d6` | `#080b10` |
| `--panel` (sidebar) | `#f6f1e7` | `#17181d` | `#e6ebde` | `#0c1016` |
| `--panel2` (liste) | `#f9f5ee` | `#15161a` | `#eef2e6` | `#0a0e13` |
| `--reader` | `#fdfaf4` | `#1a1b21` | `#f2f5ec` | `#0b0f14` |
| `--fg` | `#33302a` | `#d5d0c4` | `#232a1f` | `#b7c2c9` |
| `--dim` | `#6e675b` | `#8f8b83` | `#5a6150` | `#6b7a80` |
| `--faint` | `#a89f8f` | `#6f6b63` | `#8a9180` | `#47535b` |
| `--accent` | `#b0532a` | `#d07a4f` | `#4a7a4a` | `#3ef08a` |
| `--accent2` | `#b0532a` | `#d07a4f` | `#4a7a4a` | `#ff5ea8` |
| `--soft` (accent tint) | `rgba(176,83,42,.08)` | `rgba(208,122,79,.13)` | `rgba(74,122,74,.1)` | `rgba(62,240,138,.1)` |
| `--line` (accent %30) | `rgba(176,83,42,.3)` | `rgba(208,122,79,.35)` | `rgba(74,122,74,.35)` | `rgba(62,240,138,.3)` |
| `--border` | `rgba(35,32,25,.1)` | `rgba(255,255,255,.07)` | `rgba(35,42,31,.12)` | `rgba(62,240,138,.16)` |
| `--hover` | `rgba(35,32,25,.045)` | `rgba(255,255,255,.04)` | `rgba(35,42,31,.045)` | `rgba(62,240,138,.06)` |
| `--code` | `#f3eee3` | `#22242b` | `#e2e8d4` | `#0e141b` |
| `--chip` | `rgba(35,32,25,.055)` | `rgba(255,255,255,.06)` | `rgba(35,42,31,.06)` | `rgba(62,240,138,.08)` |
| `--seltext` (accent üstü yazı) | `#232019` | `#f0ece2` | `#232a1f` | `#e8fff2` |
| `--titlefont` | Newsreader serif | Newsreader serif | Newsreader serif | system sans |
| `--readfont` | Newsreader serif | Newsreader serif | Newsreader serif | system sans |
| `--titlewt` (başlık ağırlığı) | 500 | 500 | 500 | 700 |

macOS trafik ışıkları tüm temalarda: `#ff5f57` / `#febc2e` / `#28c840`.
Alan renkleri (örnek): Rust `#a85f2e`, Robotik `#4a6f8e`, ML `#7a5f9e`.
Feed favicon renkleri: Barry `#c96a4a`, matklad `#5f7d54`, Lobsters `#b05555`, Anteru `#5a8fbf`,
Hugging Face `#d9a441`, Computer Enhance `#4a9187`, Danger Zone `#7a6bb5`.

### Tipografi
- **Başlık/okuma serifi**: **Newsreader** (Google Fonts) — opsz 6..72; ağırlıklar 400/500/600 + italic 400.
- **Sans (Cyberpunk + UI)**: sistem `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`.
- **Monospace**: `ui-monospace, Menlo, monospace` (kicker/sayılar/kod/kısayol rozetleri).
- Ölçek (px): makale başlığı 33 · liste başlığı 21 · liste öğe başlığı 17.5 · gövde p 17 (satır 1.75) ·
  h2 21 · kicker/meta 10–10.5 (uppercase, letter-spacing .12–.14em) · dek/ikincil 12.5 · sayı 11.
- Minimum okunur gövde 17px; hiçbir metin 10px altına inmesin.

### Boşluk / geometri
- Panel genişlikleri: sidebar **246**, liste **380**, okuyucu esnek. Başlık çubuğu **50**,
  okuyucu araç çubuğu **47**, ilerleme çubuğu **3**.
- Radius: pencere 13 · kartlar/modallar 13–15 · satır/buton 8–9 · çip 4–6 · rozet 5.
- Okuyucu ölçüsü: metin sütunu max **640px** (Web modu 680px), yatay padding 44px.
- Gölge (`--shadow`): açık temalar `0 24px 60px rgba(0,0,0,.2–.22)`, Gece `.4`, Cyberpunk `.5`.
- Animasyon: `vfade` 0.12s (örtü) · `vpop` 0.14s cubic-bezier(.2,.8,.2,1) (kart) ·
  `vspin` 0.7s linear (yenile) · tema geçişi 0.18s ease.

## 11. Assets

- **Font**: Newsreader — Google Fonts'tan (`https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@...`)
  veya paketlenmiş .ttf. Production'da paketlemeniz önerilir (çevrimdışı çalışma için).
- **Feed favicon'ları**: gerçek uygulamada her feed'in `site_url`'inden favicon çekilir;
  yoksa harf-rozeti (feed renginde) fallback (prototipteki gibi).
- **İkonlar**: prototipte satır-içi SVG (arama, yenile, yer-imi). Kendi ikon setinizi
  (ör. Lucide) kullanabilirsiniz; boyut/çizgi kalınlığı (~1.5px) korunmalı.
- Anthropic/marka varlığı yok; tümü özgün.

## 12. Dosyalar

- `Verso.dc.html` — çalışan hi-fi prototip (tüm ekranlar, 4 tema, tüm etkileşimler).
  Tarayıcıda aç, ⌘K ve j/k/s/m/r/v tuşlarını dene, tema butonundan temaları değiştir.

---

### Uygulama sırası önerisi (Claude Code için)
1. Vite + React + TS iskeleti; `data-theme` + CSS değişken sistemi (Bölüm 10) — 4 tema çalışsın.
2. Statik veriyle 3 panel + okuyucu (Bölüm 5) — piksel hedefi bu prototip.
3. Durum + etkileşimler + klavye (Bölüm 6–7).
4. Overlay'ler (tema/Aa/komut paleti/alan kurma).
5. Tauri kabuğu + Rust core: SQLite şema (Bölüm 8), feed fetch/parse, kural motoru, Readability.
6. OPML, bildirim/sessiz saat, kalıcılık.
7. (Sonra) Android/Windows + senkron (Bölüm 4).
