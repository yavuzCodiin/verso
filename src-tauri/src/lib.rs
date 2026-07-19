//! Verso Tauri kabuğu — ince IPC katmanı. Gerçek mantık verso-core'da (README §4).
use std::sync::Mutex;

#[cfg(target_os = "macos")]
mod adblock;

use tauri::{async_runtime::spawn_blocking, AppHandle, Emitter, Manager, State};

use verso_core::db::Store;
use verso_core::models::{
    ArticleFullVM, ArticleListVM, FeedVM, FolderVM, Rule, SmartCounts, SpaceVM,
};
use verso_core::refresh::{RefreshSummary, WORKERS};
use verso_core::{fetch, readability, refresh, seed, start_of_today};

struct AppState {
    store: Mutex<Store>,
}

/// Uzun işlerin canlı ilerlemesi — frontend "verso-progress" event'ini dinler.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    kind: String, // "refresh" | "import"
    done: usize,
    total: usize,
    label: String,
}

fn emit_progress(app: &AppHandle, kind: &str, done: usize, total: usize, label: &str) {
    let _ = app.emit(
        "verso-progress",
        ProgressPayload {
            kind: kind.into(),
            done,
            total,
            label: label.into(),
        },
    );
}

// ─────────────── Sorgular ───────────────

#[tauri::command]
fn core_version() -> String {
    verso_core::version().to_string()
}

#[tauri::command]
fn list_feeds(state: State<'_, AppState>) -> Result<Vec<FeedVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.list_feeds().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_folders(state: State<'_, AppState>) -> Result<Vec<FolderVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.list_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_spaces(state: State<'_, AppState>) -> Result<Vec<SpaceVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.list_spaces().map_err(|e| e.to_string())
}

#[tauri::command]
fn smart_counts(state: State<'_, AppState>) -> Result<SmartCounts, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.smart_counts(start_of_today()).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_articles(
    kind: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ArticleListVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.list_articles(&kind, &id, start_of_today())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_article(id: String, state: State<'_, AppState>) -> Result<Option<ArticleFullVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.get_article(&id).map_err(|e| e.to_string())
}

// ─────────────── Mutasyonlar ───────────────

#[tauri::command]
fn mark_read(id: String, read: bool, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.set_read(&id, read).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_star(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.toggle_star(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_later(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.toggle_later(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_progress(id: String, progress: i64, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.set_progress(&id, progress).map_err(|e| e.to_string())
}

#[tauri::command]
fn mark_all_read(kind: String, id: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.mark_all_read(&kind, &id, start_of_today())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_space(
    name: String,
    color: String,
    keywords: Vec<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.create_space(&name, &color, &keywords)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_space(
    article_id: String,
    space_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.assign_space(&article_id, &space_id, "manual")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_feed(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.delete_feed(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_feed_to_folder(
    feed_id: String,
    folder_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.set_feed_folder(&feed_id, folder_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(title: String, state: State<'_, AppState>) -> Result<String, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.ensure_folder(title.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_folder(id: String, title: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.rename_folder(&id, title.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.delete_folder(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_feed(id: String, title: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.rename_feed(&id, title.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_feed_only_summary(id: String, value: bool, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.set_feed_only_summary(&id, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_space(
    id: String,
    name: String,
    color: String,
    keywords: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.update_space(&id, name.trim(), &color).map_err(|e| e.to_string())?;
    s.set_space_keywords(&id, &keywords).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_space(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.delete_space(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_space_keywords(id: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.get_space_keywords(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_space_rule(id: String, state: State<'_, AppState>) -> Result<Option<Rule>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.get_space_rule(&id).map_err(|e| e.to_string())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn save_space(
    id: Option<String>,
    name: String,
    color: String,
    field: String,
    keywords: Vec<String>,
    scope_all: bool,
    scope_feeds: Vec<String>,
    hide_from_source: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.save_space(
        id.as_deref(),
        name.trim(),
        &color,
        &field,
        &keywords,
        scope_all,
        &scope_feeds,
        hide_from_source,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn search_articles(query: String, state: State<'_, AppState>) -> Result<Vec<ArticleListVM>, String> {
    let s = state.store.lock().map_err(|e| e.to_string())?;
    s.search_articles(&query, 20).map_err(|e| e.to_string())
}

// ─────────────── Sistem entegrasyonu ───────────────

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // Şema beyaz-listesi: feed <a> bağlantıları buraya düşer; ammonia javascript:/file:'i
    // temizler ama tel:/magnet:/ssh: gibi şemalar geçebilir. Sadece güvenli olanları OS'e ver.
    let parsed: tauri::Url = url.parse().map_err(|e| format!("invalid URL: {e}"))?;
    match parsed.scheme() {
        "http" | "https" | "mailto" => open::that(&url).map_err(|e| e.to_string()),
        other => Err(format!("blocked URL scheme: {other}")),
    }
}

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(text).map_err(|e| e.to_string())
}

// ─────────────── Web modu: gerçek gömülü native webview (child) ───────────────

const WEB_PREVIEW: &str = "web-preview";

/// Kozmetik adblock: geniş reklam seti gizlenir + reklam iframe'leri DOM'dan kaldırılır
/// (MutationObserver ile sürekli). Her sayfaya enjekte edilir. (Ağ-seviyesi engelleme
/// için WKContentRuleList ayrı bir iş.)
const ADBLOCK_JS: &str = r#"
(function () {
  var SEL = [
    'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]','iframe[src*="adservice"]',
    'iframe[src*="/ads/"]','iframe[src*="adnxs"]','iframe[src*="amazon-adsystem"]',
    'iframe[src*="taboola"]','iframe[src*="outbrain"]',
    'ins.adsbygoogle','.adsbygoogle','[id^="google_ads"]','[id^="div-gpt-ad"]',
    '[id*="-ad-"]','[class^="ad-"]','[class*=" ad-"]','[class$="-ad"]','[class*="-ads-"]',
    '[class*="advert"]','[class*="sponsor"]','[data-ad-slot]','[data-ad-client]','[data-adunit]',
    'aside[class*="ad"]','div[class*="banner-ad"]','.taboola','.outbrain','#taboola-below-article',
    '[aria-label="Advertisement"]','[aria-label="advertisement"]'
  ];
  var css = SEL.join(',') + '{display:none!important;visibility:hidden!important;min-height:0!important;height:0!important}';
  function isAd(src){
    src=(src||'').toLowerCase();
    return src.indexOf('doubleclick')>=0||src.indexOf('googlesyndication')>=0
      ||src.indexOf('adservice')>=0||src.indexOf('adnxs')>=0||src.indexOf('amazon-adsystem')>=0
      ||src.indexOf('taboola')>=0||src.indexOf('outbrain')>=0||src.indexOf('/ads/')>=0
      ||src.indexOf('/adserver')>=0;
  }
  function inject(){
    if(document.getElementById('__verso_ab')) return;
    var s=document.createElement('style'); s.id='__verso_ab'; s.textContent=css;
    (document.head||document.documentElement).appendChild(s);
  }
  function sweep(){
    try{
      var f=document.getElementsByTagName('iframe');
      for(var i=f.length-1;i>=0;i--){ if(isAd(f[i].src)) f[i].remove(); }
    }catch(e){}
  }
  inject();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){inject();sweep();});
  else sweep();
  try{ new MutationObserver(function(){inject();sweep();}).observe(document.documentElement,{childList:true,subtree:true}); }catch(e){}
})();
"#;

#[tauri::command]
fn open_web_preview(
    window: tauri::Window,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("invalid URL: {e}"))?;
    if let Some(wv) = window.get_webview(WEB_PREVIEW) {
        wv.navigate(parsed).map_err(|e| e.to_string())?;
        wv.set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    let child = window
        .add_child(
            tauri::webview::WebviewBuilder::new(WEB_PREVIEW, tauri::WebviewUrl::External(parsed))
                // Kalıcı-olmayan (nonPersistent) veri deposu: çerez/izleme kalıcı olmaz
                // ve WKWebView keychain'e "WebCrypto Master Key" yazmaya çalışmadığı için
                // her açılışta çıkan keychain izin penceresi de görünmez.
                .incognito(true)
                .initialization_script(ADBLOCK_JS),
            tauri::LogicalPosition::new(x, y),
            tauri::LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    // Ağ-seviyesi adblock: WKUserContentController'a içerik-kural listesi ekle.
    // Bir kez eklenince bu webview'in tüm gelecek navigasyonlarını (navigate) kapsar.
    #[cfg(target_os = "macos")]
    {
        let _ = child.with_webview(|pw| adblock::apply(pw.controller()));
    }
    let _ = &child;
    Ok(())
}

#[tauri::command]
fn resize_web_preview(
    window: tauri::Window,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(wv) = window.get_webview(WEB_PREVIEW) {
        wv.set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_web_preview(window: tauri::Window) -> Result<(), String> {
    if let Some(wv) = window.get_webview(WEB_PREVIEW) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// In-app video: native child webview, youtube.com/embed'e ÜST-DÜZEY navigasyon
// (iframe değil) → embedding-origin kontrolü yok → Error 153 yok.
const VIDEO_PREVIEW: &str = "video-preview";

#[tauri::command]
fn open_video(
    window: tauri::Window,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("invalid URL: {e}"))?;
    if let Some(wv) = window.get_webview(VIDEO_PREVIEW) {
        wv.navigate(parsed).map_err(|e| e.to_string())?;
        wv.set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        wv.set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    window
        .add_child(
            tauri::webview::WebviewBuilder::new(VIDEO_PREVIEW, tauri::WebviewUrl::External(parsed)),
            tauri::LogicalPosition::new(x, y),
            tauri::LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_video(window: tauri::Window) -> Result<(), String> {
    if let Some(wv) = window.get_webview(VIDEO_PREVIEW) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─────────────── Ağ işleri (spawn_blocking; kilit kısa, fetch paralel) ───────────────

#[tauri::command]
async fn refresh_all(app: AppHandle) -> Result<RefreshSummary, String> {
    spawn_blocking(move || {
        let client = fetch::client().map_err(|e| e.to_string())?;
        let state = app.state::<AppState>();
        let sum = refresh::refresh_all_parallel(&state.store, &client, WORKERS, |done, total, label| {
            emit_progress(&app, "refresh", done, total, label);
        });
        Ok::<RefreshSummary, String>(sum)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn refresh_feed(app: AppHandle, id: String) -> Result<usize, String> {
    spawn_blocking(move || {
        let state = app.state::<AppState>();
        let title = {
            let s = state.store.lock().map_err(|e| e.to_string())?;
            s.get_feed(&id)
                .ok()
                .flatten()
                .map(|f| f.title)
                .unwrap_or_default()
        };
        emit_progress(&app, "refresh", 0, 1, &title);
        let client = fetch::client().map_err(|e| e.to_string())?;
        let res = refresh::refresh_feed(&state.store, &client, &id).map_err(|e| e.to_string());
        emit_progress(&app, "refresh", 1, 1, &title);
        res
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn refresh_folder(app: AppHandle, id: String) -> Result<RefreshSummary, String> {
    spawn_blocking(move || {
        let state = app.state::<AppState>();
        let ids: Vec<String> = {
            let s = state.store.lock().map_err(|e| e.to_string())?;
            s.list_feeds_raw()
                .map_err(|e| e.to_string())?
                .into_iter()
                .filter(|f| f.folder_id.as_deref() == Some(id.as_str()))
                .map(|f| f.id)
                .collect()
        };
        let client = fetch::client().map_err(|e| e.to_string())?;
        let sum = refresh::refresh_feeds_parallel(&state.store, &client, &ids, WORKERS, |d, t, l| {
            emit_progress(&app, "refresh", d, t, l);
        });
        Ok::<RefreshSummary, String>(sum)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn add_feed(app: AppHandle, url: String, folder_id: Option<String>) -> Result<String, String> {
    spawn_blocking(move || {
        let client = fetch::client().map_err(|e| e.to_string())?;
        let state = app.state::<AppState>();
        let id = refresh::add_feed_from_url(&state.store, &client, &url).map_err(|e| e.to_string())?;
        if let Some(fid) = folder_id {
            let s = state.store.lock().map_err(|e| e.to_string())?;
            s.set_feed_folder(&id, Some(&fid)).map_err(|e| e.to_string())?;
        }
        Ok(id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn import_opml(app: AppHandle, path: String) -> Result<usize, String> {
    spawn_blocking(move || {
        let xml = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let client = fetch::client().map_err(|e| e.to_string())?;
        let state = app.state::<AppState>();
        refresh::import_opml_parallel(&state.store, &client, &xml, WORKERS, |done, total, label| {
            emit_progress(&app, "import", done, total, label);
        })
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn export_opml(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let feeds = store.list_feeds_raw().map_err(|e| e.to_string())?;
    let folders = store.list_folders().map_err(|e| e.to_string())?;
    let xml = verso_core::opml_io::export(&feeds, &folders).map_err(|e| e.to_string())?;
    std::fs::write(&path, xml).map_err(|e| e.to_string())
}

/// Tam metni Readability ile çeker (varsa cache'ten; `force` cache'i yok sayar). README §9.
#[tauri::command]
async fn get_full_text(app: AppHandle, id: String, force: bool) -> Result<String, String> {
    spawn_blocking(move || {
        let state = app.state::<AppState>();
        // 1) URL + medya durumu al / cache kontrolü (kilit kısa)
        let (url, allow_video) = {
            let s = state.store.lock().map_err(|e| e.to_string())?;
            let art = s
                .get_article(&id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "article not found".to_string())?;
            if !force {
                if let Some(full) = art.content_full {
                    return Ok::<String, String>(full);
                }
            }
            (art.url, art.enclosure_url.is_some())
        };
        if url.is_empty() {
            return Err("article has no URL".into());
        }
        // 2) İndir + çıkar (kilitsiz)
        let client = fetch::client().map_err(|e| e.to_string())?;
        let raw = fetch::get_text(&client, &url).map_err(|e| e.to_string())?;
        let extracted = readability::extract(&raw, &url, allow_video).map_err(|e| e.to_string())?;
        // 3) Cache'e yaz (kilit kısa)
        {
            let s = state.store.lock().map_err(|e| e.to_string())?;
            s.set_content_full(&id, &extracted).map_err(|e| e.to_string())?;
        }
        Ok(extracted)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // DB'yi uygulama veri dizininde aç + varsayılanları seed'le.
            let dir = app.path().app_data_dir().expect("app_data_dir");
            std::fs::create_dir_all(&dir).ok();
            let store = Store::open(dir.join("verso.db")).expect("could not open DB");
            seed::seed_defaults(&store).expect("seed failed");
            app.manage(AppState {
                store: Mutex::new(store),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_version,
            list_feeds,
            list_folders,
            list_spaces,
            smart_counts,
            list_articles,
            get_article,
            mark_read,
            toggle_star,
            toggle_later,
            set_progress,
            mark_all_read,
            create_space,
            add_to_space,
            delete_feed,
            move_feed_to_folder,
            create_folder,
            rename_folder,
            delete_folder,
            rename_feed,
            set_feed_only_summary,
            update_space,
            delete_space,
            get_space_keywords,
            get_space_rule,
            save_space,
            search_articles,
            open_url,
            copy_text,
            open_web_preview,
            resize_web_preview,
            close_web_preview,
            open_video,
            close_video,
            refresh_all,
            refresh_feed,
            refresh_folder,
            add_feed,
            import_opml,
            export_opml,
            get_full_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
