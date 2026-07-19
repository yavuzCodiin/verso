#!/usr/bin/env bash
#
# Verso OTA yayın betiği — tek komutla:
#   1) sürümü tauri.conf.json + package.json'a yazar
#   2) imzalı derler (updater .tar.gz + .sig üretir)
#   3) latest.json üretir (updater'ın okuduğu manifest)
#   4) GitHub release oluşturur/günceller ve artefaktları yükler
#
# Kullanım:
#   ./release.sh <yeni-sürüm> ["sürüm notları"]
#   ör: ./release.sh 0.2.0 "Ağ-seviyesi adblock, lightbox zoom, in-app video"
#
# Ön koşullar (bir kez):
#   - Public bir GitHub repo (updater manifest'i auth'suz indirebilmeli → private OLMAZ)
#   - brew install gh && gh auth login
#   - ~/.tauri/verso_updater.key (imza anahtarı — GİZLİ, repoya girmez)
#   - tauri.conf.json > plugins.updater.endpoints, aşağıdaki REPO ile aynı olmalı
#
set -euo pipefail

# ─────────── AYAR ───────────
REPO="${VERSO_REPO:-yavuzCodiin/verso}"        # GitHub owner/repo (env ile geçici override: VERSO_REPO=... )
KEY="$HOME/.tauri/verso_updater.key"
TARGET="darwin-aarch64"                         # Apple Silicon
# ────────────────────────────

cd "$(dirname "$0")"

VERSION="${1:-}"
NOTES="${2:-Verso $VERSION}"
if [[ -z "$VERSION" ]]; then
  echo "Kullanım: ./release.sh <sürüm> [\"notlar\"]   (ör: ./release.sh 0.2.0 \"…\")"
  exit 1
fi

# 0) Ön kontroller
command -v gh >/dev/null || { echo "✗ gh CLI yok:  brew install gh && gh auth login"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ gh oturumu yok:  gh auth login"; exit 1; }
[[ -f "$KEY" ]] || { echo "✗ İmza anahtarı yok: $KEY"; exit 1; }

echo "▶ Verso $VERSION  →  $REPO  ($TARGET)"

# 1) Sürümü yaz (tauri.conf.json = updater'ın kıyasladığı sürüm)
VERSION="$VERSION" node -e '
  const fs = require("fs");
  const v = process.env.VERSION;
  for (const f of ["src-tauri/tauri.conf.json", "package.json"]) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.version = v;
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
    console.log("  sürüm yazıldı →", f);
  }
'

# 2) İmzalı derleme — createUpdaterArtifacts:true olduğundan .app.tar.gz + .sig üretilir
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
echo "▶ İmzalı derleme…"
npm run tauri build

# 3) Artefaktları bul
MACOS_DIR="target/release/bundle/macos"
DMG_DIR="target/release/bundle/dmg"
TARGZ="$MACOS_DIR/Verso.app.tar.gz"
SIG="$TARGZ.sig"
DMG="$(ls "$DMG_DIR"/Verso_"${VERSION}"_aarch64.dmg 2>/dev/null || ls "$DMG_DIR"/*.dmg 2>/dev/null | head -1)"
[[ -f "$TARGZ" ]] || { echo "✗ Updater paketi yok: $TARGZ"; exit 1; }
[[ -f "$SIG"   ]] || { echo "✗ İmza dosyası yok: $SIG (imza env değişkenleri ayarlı mıydı?)"; exit 1; }
TARGZ_NAME="$(basename "$TARGZ")"
PUB_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 4) latest.json üret (updater manifest'i — notlar güvenli JSON-escape ile)
VERSION="$VERSION" NOTES="$NOTES" PUB_DATE="$PUB_DATE" REPO="$REPO" \
TARGET="$TARGET" TARGZ_NAME="$TARGZ_NAME" SIG="$SIG" node -e '
  const fs = require("fs");
  const sig = fs.readFileSync(process.env.SIG, "utf8").trim();
  const out = {
    version: process.env.VERSION,
    notes: process.env.NOTES,
    pub_date: process.env.PUB_DATE,
    platforms: {
      [process.env.TARGET]: {
        signature: sig,
        url: `https://github.com/${process.env.REPO}/releases/download/v${process.env.VERSION}/${process.env.TARGZ_NAME}`,
      },
    },
  };
  fs.writeFileSync("latest.json", JSON.stringify(out, null, 2) + "\n");
  console.log("  latest.json üretildi");
'

# 4b) Sürüm bump'ını commit + push — release tag'i doğru commit'e otursun
if [[ -n "$(git status --porcelain -- src-tauri/tauri.conf.json package.json 2>/dev/null)" ]]; then
  git add src-tauri/tauri.conf.json package.json
  git commit -q -m "release: v$VERSION"
  git push origin main
  echo "  sürüm bump commit + push edildi"
fi

# 5) GitHub release — varsa güncelle, yoksa oluştur; tag'i push'lu son commit'ten açar
echo "▶ GitHub release yükleniyor…"
if gh release view "v$VERSION" -R "$REPO" >/dev/null 2>&1; then
  gh release upload "v$VERSION" -R "$REPO" --clobber "$TARGZ" "$SIG" "$DMG" latest.json
else
  gh release create "v$VERSION" -R "$REPO" \
    --title "Verso $VERSION" --notes "$NOTES" \
    "$TARGZ" "$SIG" "$DMG" latest.json
fi

echo ""
echo "✓ Yayınlandı: https://github.com/$REPO/releases/tag/v$VERSION"
echo "  Updater manifest: https://github.com/$REPO/releases/latest/download/latest.json"
echo "  (Uygulamada Ayarlar → 'Güncellemeleri denetle' ile test et.)"
