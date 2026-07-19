//! İlk çalıştırmada varsayılan feed'ler + Alanlar + kurallar (gerçek RSS URL'leri).
use anyhow::Result;
use uuid::Uuid;

use crate::db::Store;
use crate::models::{Rule, Space};

// id, rss_url, title, site_url, letter, color, only_summary
type FeedSeed = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    bool,
);

const FEEDS: &[FeedSeed] = &[
    ("barry", "https://brevzin.github.io/feed.xml", "Barry's C++ Blog", "https://brevzin.github.io", "B", "#c96a4a", false),
    ("matklad", "https://matklad.github.io/feed.xml", "matklad", "https://matklad.github.io", "M", "#5f7d54", false),
    ("lobsters", "https://lobste.rs/rss", "Lobsters", "https://lobste.rs", "L", "#b05555", true),
    ("anteru", "https://anteru.net/rss.xml", "Anteru's blog", "https://anteru.net", "A", "#5a8fbf", false),
    ("huggingface", "https://huggingface.co/blog/feed.xml", "Hugging Face — Blog", "https://huggingface.co/blog", "H", "#d9a441", true),
    ("enhance", "https://www.computerenhance.com/feed", "Computer, Enhance!", "https://www.computerenhance.com", "C", "#4a9187", false),
];

// id, name, color, anahtar kelimeler
type SpaceSeed = (&'static str, &'static str, &'static str, &'static [&'static str]);

const SPACES: &[SpaceSeed] = &[
    ("rust", "Rust", "#a85f2e", &["rust", "cargo", "tokio", "borrow checker", "async"]),
    ("robotik", "Robotics", "#4a6f8e", &["robot", "robotics", "ros", "drone", "slam"]),
    ("ml", "ML", "#7a5f9e", &["llm", "machine learning", "neural network", "transformer", "distillation", "fine-tuning", "diffusion model"]),
];

/// DB boşsa varsayılanları ekler (idempotent).
pub fn seed_defaults(store: &Store) -> Result<()> {
    if store.feed_count()? > 0 {
        return Ok(());
    }
    for &(id, url, title, site, letter, color, only_summary) in FEEDS {
        store.insert_feed(id, url, title, site, letter, color, only_summary, None)?;
    }
    for &(id, name, color, kws) in SPACES {
        store.insert_space(&Space {
            id: id.to_string(),
            name: name.to_string(),
            color: color.to_string(),
            manual_only: false,
        })?;
        store.insert_rule(&Rule {
            id: Uuid::new_v4().to_string(),
            space_id: id.to_string(),
            field: "both".to_string(),
            keywords: kws.iter().map(|s| s.to_string()).collect(),
            scope_all: true,
            scope_feeds: vec![],
            hide_from_source: false,
        })?;
    }
    Ok(())
}
