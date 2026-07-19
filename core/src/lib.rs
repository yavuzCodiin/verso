//! verso-core — Verso'nun platformdan bağımsız çekirdeği (README §4).
//! Tauri'ye bağımlı DEĞİLDİR; masaüstü/mobil/Windows kabukları aynı mantığı kullanır.

pub mod db;
pub mod favicon;
pub mod fetch;
pub mod html;
pub mod models;
pub mod opml_io;
pub mod parse;
pub mod readability;
pub mod refresh;
pub mod rules;
pub mod seed;
pub mod sync;

/// Çekirdek crate sürümü — UI ↔ core (IPC) bağlantısını doğrulamak için.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Yerel günün 00:00'ı (unix saniye) — "Bugün" akıllı listesi için.
pub fn start_of_today() -> i64 {
    use chrono::Local;
    Local::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|dt| dt.and_local_timezone(Local).single())
        .map(|dt| dt.timestamp())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_semver_ish() {
        assert!(version().split('.').count() >= 2);
    }

    #[test]
    fn migrate_and_seed_smoke() {
        let store = db::Store::open_in_memory().unwrap();
        seed::seed_defaults(&store).unwrap();
        assert_eq!(store.feed_count().unwrap(), 6);
        let feeds = store.list_feeds().unwrap();
        assert_eq!(feeds.len(), 6);
        let spaces = store.list_spaces().unwrap();
        assert_eq!(spaces.len(), 3);
        let rules = store.list_rules().unwrap();
        assert_eq!(rules.len(), 3);
    }

    #[test]
    fn insert_and_list_article() {
        let store = db::Store::open_in_memory().unwrap();
        store
            .insert_feed("f1", "http://x/feed", "F1", "http://x", "F", "#000", false, None)
            .unwrap();
        let na = models::NewArticle {
            feed_id: "f1".into(),
            guid: "g1".into(),
            title: "Rust ownership".into(),
            dek: "about rust".into(),
            author: "A".into(),
            url: "http://x/1".into(),
            published_at: Some(1_000_000),
            content_summary: "<p>cargo build</p>".into(),
            mins: 3,
            tags: vec!["rust".into()],
            enclosure_url: None,
            enclosure_type: None,
        };
        let id = store.insert_article(&na).unwrap().unwrap();
        store.set_article_tags(&id, &na.tags).unwrap();
        // tekrar ekleme (aynı guid) → None
        assert!(store.insert_article(&na).unwrap().is_none());
        let list = store.list_articles("feed", "f1", 0).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].tags, vec!["rust".to_string()]);
        assert!(list[0].unread);
    }
}
