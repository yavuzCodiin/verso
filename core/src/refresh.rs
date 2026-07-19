//! Yenileme + feed ekleme + OPML orkestrasyonu — README §4/§9.
//!
//! Kural: ağ işleri KİLİTSİZ, DB yazımları KISA kilitle. Fetch'ler `WORKERS`
//! iş parçacığıyla paralel; `on_progress(done, total, label)` her feed bitince
//! çağrılır (kabuk bunu Tauri event'ine çevirir).
use std::sync::mpsc;
use std::sync::Mutex;

use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::db::{now, Store};
use crate::models::{Feed, NewArticle, Rule};
use crate::{favicon, fetch, opml_io, parse, rules};

pub const WORKERS: usize = 6;

#[derive(Debug, Default, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshSummary {
    pub feeds_ok: usize,
    pub feeds_err: usize,
    pub new_articles: usize,
}

// Yeni feed'lere renk atamak için döngüsel palet.
const PALETTE: &[&str] = &[
    "#c96a4a", "#5f7d54", "#b05555", "#5a8fbf", "#d9a441", "#4a9187", "#7a6bb5", "#a85f2e",
    "#4a6f8e", "#7a5f9e",
];

fn letter_of(title: &str) -> String {
    title
        .chars()
        .find(|c| c.is_alphanumeric())
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_else(|| "•".to_string())
}

fn lock<'a>(store: &'a Mutex<Store>) -> Result<std::sync::MutexGuard<'a, Store>> {
    store.lock().map_err(|_| anyhow!("DB lock poisoned"))
}

/// Ayrıştırılmış yazıları ekler + kural motorunu çalıştırır. Yeni yazı sayısı döner.
pub fn ingest(
    store: &Store,
    feed_id: &str,
    articles: Vec<NewArticle>,
    rule_list: &[Rule],
) -> Result<usize> {
    let mut new = 0;
    for na in articles {
        if let Some(article_id) = store.insert_article(&na)? {
            new += 1;
            store.set_article_tags(&article_id, &na.tags)?;
            for sid in rules::match_spaces(&na.title, &na.content_summary, feed_id, rule_list) {
                store.assign_space(&article_id, &sid, "rule")?;
            }
        } else if let (Some(eu), Some(et)) = (&na.enclosure_url, &na.enclosure_type) {
            // Kayıt zaten var (eski şemadan): eksik podcast/medya bilgisini doldur.
            let _ = store.backfill_enclosure(feed_id, &na.guid, eu, et);
        }
    }
    Ok(new)
}

/// İş kuyruğunu `workers` iş parçacığıyla tüketir (fetch+parse kilitsiz);
/// sonuçları biten sırayla `handle`'a verir (handle kısa kilit alır).
fn fetch_parse_pool<F>(
    client: &reqwest::blocking::Client,
    jobs: Vec<Feed>,
    workers: usize,
    mut handle: F,
) where
    F: FnMut(Feed, Result<parse::ParsedFeed>),
{
    let queue = Mutex::new(jobs);
    let (tx, rx) = mpsc::channel();
    std::thread::scope(|scope| {
        for _ in 0..workers.max(1) {
            let tx = tx.clone();
            let queue = &queue;
            scope.spawn(move || loop {
                let job = queue.lock().ok().and_then(|mut q| q.pop());
                let Some(feed) = job else { break };
                let res = fetch::get_bytes(client, &feed.url)
                    .and_then(|b| parse::parse_feed(&b, &feed.id));
                if tx.send((feed, res)).is_err() {
                    break;
                }
            });
        }
        drop(tx);
        for (feed, res) in rx {
            handle(feed, res);
        }
    });
}

/// Verilen feed işlerini paralel çeker + kısa kilitle işler (ortak gövde).
fn refresh_jobs<F>(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    jobs: Vec<Feed>,
    rule_list: &[Rule],
    workers: usize,
    on_progress: &mut F,
) -> RefreshSummary
where
    F: FnMut(usize, usize, &str),
{
    let total = jobs.len();
    if total == 0 {
        return RefreshSummary::default();
    }
    on_progress(0, total, "");

    let mut sum = RefreshSummary::default();
    let mut done = 0usize;
    fetch_parse_pool(client, jobs, workers, |feed, res| {
        done += 1;
        if let Ok(s) = lock(store) {
            match res {
                Ok(parsed) => match ingest(&s, &feed.id, parsed.articles, rule_list) {
                    Ok(n) => {
                        sum.feeds_ok += 1;
                        sum.new_articles += n;
                    }
                    Err(_) => sum.feeds_err += 1,
                },
                Err(_) => sum.feeds_err += 1,
            }
            let _ = s.set_feed_fetched(&feed.id, now());
        } else {
            sum.feeds_err += 1;
        }
        on_progress(done, total, &feed.title);
    });
    sum
}

/// Favicon'u eksik feed'ler için paralel çekim ("" = denendi, tekrar denenmez).
pub fn fetch_missing_favicons(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    workers: usize,
) {
    let missing = match lock(store) {
        Ok(s) => s.feeds_missing_icon().unwrap_or_default(),
        Err(_) => return,
    };
    if missing.is_empty() {
        return;
    }
    let queue = Mutex::new(missing);
    std::thread::scope(|scope| {
        for _ in 0..workers.max(1) {
            let queue = &queue;
            scope.spawn(move || loop {
                let item = queue.lock().ok().and_then(|mut q| q.pop());
                let Some((id, url)) = item else { break };
                let data = favicon::fetch_favicon(client, &url).unwrap_or_default();
                if let Ok(s) = lock(store) {
                    let _ = s.set_feed_icon(&id, &data);
                }
            });
        }
    });
}

/// Tüm feed'leri paralel yeniler; her feed bitince `on_progress` çağrılır.
/// Ardından eksik favicon'lar çekilir.
pub fn refresh_all_parallel<F>(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    workers: usize,
    mut on_progress: F,
) -> RefreshSummary
where
    F: FnMut(usize, usize, &str),
{
    let (feeds, rule_list) = match lock(store) {
        Ok(s) => (
            s.list_feeds_raw().unwrap_or_default(),
            s.list_rules().unwrap_or_default(),
        ),
        Err(_) => return RefreshSummary::default(),
    };
    let sum = refresh_jobs(store, client, feeds, &rule_list, workers, &mut on_progress);
    fetch_missing_favicons(store, client, workers);
    sum
}

/// Seçili feed'leri (id listesi) paralel yeniler — klasör/tekil yenileme için.
pub fn refresh_feeds_parallel<F>(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    ids: &[String],
    workers: usize,
    mut on_progress: F,
) -> RefreshSummary
where
    F: FnMut(usize, usize, &str),
{
    let (feeds, rule_list) = match lock(store) {
        Ok(s) => (
            s.list_feeds_raw().unwrap_or_default(),
            s.list_rules().unwrap_or_default(),
        ),
        Err(_) => return RefreshSummary::default(),
    };
    let jobs: Vec<Feed> = feeds.into_iter().filter(|f| ids.contains(&f.id)).collect();
    refresh_jobs(store, client, jobs, &rule_list, workers, &mut on_progress)
}

/// Sessiz toplu yenileme (örnek/test için).
pub fn refresh_all(store: &Mutex<Store>, client: &reqwest::blocking::Client) -> RefreshSummary {
    refresh_all_parallel(store, client, WORKERS, |_, _, _| {})
}

/// Tek feed'i yeniler; yeni yazı sayısı döner.
pub fn refresh_feed(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    feed_id: &str,
) -> Result<usize> {
    let feed = lock(store)?
        .get_feed(feed_id)?
        .ok_or_else(|| anyhow!("feed not found"))?;
    let bytes = fetch::get_bytes(client, &feed.url)?;
    let parsed = parse::parse_feed(&bytes, &feed.id)?;
    let s = lock(store)?;
    let rule_list = s.list_rules()?;
    let n = ingest(&s, &feed.id, parsed.articles, &rule_list)?;
    s.set_feed_fetched(&feed.id, now())?;
    Ok(n)
}

/// URL'den yeni feed ekler (başlık/site feed'den okunur) + ilk yazıları çeker. feed_id döner.
pub fn add_feed_from_url(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    url: &str,
) -> Result<String> {
    let existing = lock(store)?.feed_by_url_any(url)?;
    if let Some((id, deleted)) = existing {
        if deleted {
            lock(store)?.restore_feed(&id)?;
            let _ = refresh_feed(store, client, &id);
        }
        return Ok(id);
    }
    let feed_id = Uuid::new_v4().to_string();
    // Ağ işleri kilitsiz:
    let bytes = fetch::get_bytes(client, url)?;
    let parsed = parse::parse_feed(&bytes, &feed_id)?;
    let title = parsed.title.clone().unwrap_or_else(|| url.to_string());
    let site_url = parsed.site_url.clone().unwrap_or_default();
    // Kısa kilit: kayıt + ingest.
    {
        let s = lock(store)?;
        let color = PALETTE[(s.feed_count().unwrap_or(0) as usize) % PALETTE.len()];
        s.insert_feed(&feed_id, url, &title, &site_url, &letter_of(&title), color, false, None)?;
        let rule_list = s.list_rules()?;
        ingest(&s, &feed_id, parsed.articles, &rule_list)?;
        let _ = s.set_feed_fetched(&feed_id, now());
    }
    // Favicon (kilitsiz ağ + kısa kilit).
    let icon_src = if site_url.is_empty() { url } else { site_url.as_str() };
    let data = favicon::fetch_favicon(client, icon_src).unwrap_or_default();
    if let Ok(s) = lock(store) {
        let _ = s.set_feed_icon(&feed_id, &data);
    }
    Ok(feed_id)
}

/// OPML'deki feed'leri klasör yapısıyla ekler; yazıları paralel çeker.
/// Mevcut feed'lerin klasörü OPML'e göre güncellenir (yeniden içe aktarma onarır).
/// Eklenen feed sayısı döner.
pub fn import_opml_parallel<F>(
    store: &Mutex<Store>,
    client: &reqwest::blocking::Client,
    xml: &str,
    workers: usize,
    mut on_progress: F,
) -> Result<usize>
where
    F: FnMut(usize, usize, &str),
{
    let entries = opml_io::import(xml)?;

    // 1. faz (kısa kilit): feed satırlarını OPML başlığı + klasörle hemen kaydet.
    //    Fetch başarısız olsa bile feed listede görünür; yazıları sonra gelir.
    let mut jobs: Vec<Feed> = Vec::new();
    {
        let s = lock(store)?;
        let base = s.feed_count().unwrap_or(0) as usize;
        for (i, e) in entries.into_iter().enumerate() {
            let folder_id = e
                .folder
                .as_deref()
                .and_then(|t| s.ensure_folder(t).ok());
            match s.feed_by_url_any(&e.url) {
                Ok(Some((id, deleted))) => {
                    if deleted {
                        let _ = s.restore_feed(&id);
                    }
                    if folder_id.is_some() {
                        let _ = s.set_feed_folder(&id, folder_id.as_deref());
                    }
                }
                Ok(None) => {
                    let id = Uuid::new_v4().to_string();
                    let title = if e.title.trim().is_empty() {
                        e.url.clone()
                    } else {
                        e.title.clone()
                    };
                    let color = PALETTE[(base + i) % PALETTE.len()];
                    if s.insert_feed(
                        &id,
                        &e.url,
                        &title,
                        "",
                        &letter_of(&title),
                        color,
                        false,
                        folder_id.as_deref(),
                    )
                    .is_ok()
                    {
                        jobs.push(Feed {
                            id,
                            url: e.url,
                            title,
                            site_url: String::new(),
                            icon_letter: String::new(),
                            color: color.to_string(),
                            folder_id,
                            only_summary: false,
                            last_fetch: None,
                        });
                    }
                }
                Err(_) => {}
            }
        }
    }

    let added = jobs.len();
    if added == 0 {
        return Ok(0);
    }
    let rule_list = lock(store)?.list_rules().unwrap_or_default();
    on_progress(0, added, "");

    // 2. faz: paralel fetch + kısa kilitle ingest + ilerleme.
    let mut done = 0usize;
    fetch_parse_pool(client, jobs, workers, |feed, res| {
        done += 1;
        if let Ok(s) = lock(store) {
            if let Ok(parsed) = res {
                let _ = ingest(&s, &feed.id, parsed.articles, &rule_list);
            }
            let _ = s.set_feed_fetched(&feed.id, now());
        }
        on_progress(done, added, &feed.title);
    });
    Ok(added)
}
