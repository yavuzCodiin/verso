//! feed-rs ile RSS/Atom/JSON Feed ayrıştırma → NewArticle (README §9 cheat-sheet).
use anyhow::{Context, Result};
use feed_rs::model::{Entry, Link};
use feed_rs::parser;

use crate::html;
use crate::models::NewArticle;

pub struct ParsedFeed {
    pub title: Option<String>,
    pub site_url: Option<String>,
    pub articles: Vec<NewArticle>,
}

/// Kanonik sayfa URL'i: rel="alternate" > rel yok > self/enclosure/related olmayan.
fn canonical_url(links: &[Link]) -> Option<String> {
    links
        .iter()
        .find(|l| l.rel.as_deref() == Some("alternate"))
        .or_else(|| links.iter().find(|l| l.rel.is_none()))
        .or_else(|| {
            links.iter().find(|l| {
                !matches!(
                    l.rel.as_deref(),
                    Some("self") | Some("enclosure") | Some("related")
                )
            })
        })
        .map(|l| l.href.clone())
}

pub fn parse_feed(bytes: &[u8], feed_id: &str) -> Result<ParsedFeed> {
    let feed = parser::parse(bytes).context("failed to parse feed")?;
    let title = feed.title.map(|t| t.content);
    let site_url = canonical_url(&feed.links);
    let articles = feed
        .entries
        .into_iter()
        .map(|e| to_new_article(e, feed_id))
        .collect();
    Ok(ParsedFeed {
        title,
        site_url,
        articles,
    })
}

/// Enclosure (podcast/medya): Atom rel="enclosure" ya da Media-RSS içeriği.
/// Yalnız audio/video kabul edilir (görsel ekleri medya sayılmaz).
fn extract_enclosure(entry: &Entry) -> (Option<String>, Option<String>) {
    let is_media = |t: &str| t.starts_with("audio/") || t.starts_with("video/");
    let guess = |u: &str| {
        let ul = u.to_lowercase();
        if ul.ends_with(".mp3") { Some("audio/mpeg") }
        else if ul.ends_with(".m4a") { Some("audio/mp4") }
        else if ul.ends_with(".ogg") { Some("audio/ogg") }
        else if ul.ends_with(".mp4") { Some("video/mp4") }
        else { None }
    };
    // Atom/RSS enclosure link'i
    for l in &entry.links {
        if l.rel.as_deref() == Some("enclosure") {
            let mt = l.media_type.clone().or_else(|| guess(&l.href).map(String::from));
            if let Some(mt) = mt {
                if is_media(&mt) {
                    return (Some(l.href.clone()), Some(mt));
                }
            }
        }
    }
    // Media-RSS
    for m in &entry.media {
        for c in &m.content {
            if let Some(u) = &c.url {
                let mt = c
                    .content_type
                    .as_ref()
                    .map(|t| t.to_string())
                    .or_else(|| guess(u.as_str()).map(String::from));
                if let Some(mt) = mt {
                    if is_media(&mt) {
                        return (Some(u.to_string()), Some(mt));
                    }
                }
            }
        }
    }
    (None, None)
}

fn to_new_article(entry: Entry, feed_id: &str) -> NewArticle {
    // links/media taşınmadan önce borrow ile çıkar.
    let url = canonical_url(&entry.links).unwrap_or_default();
    let (enclosure_url, enclosure_type) = extract_enclosure(&entry);
    let title = entry.title.map(|t| t.content).unwrap_or_default();

    // İçerik: content.body (tam) yoksa summary.
    let summary_text: Option<String> = entry.summary.map(|t| t.content);
    let content_body: Option<String> = entry.content.and_then(|c| c.body);
    let raw_content = content_body
        .clone()
        .or_else(|| summary_text.clone())
        .unwrap_or_default();
    let content_summary = html::sanitize(&raw_content);

    // dek: summary düz metni (yoksa içerikten), kırpılmış.
    let dek_src = summary_text.unwrap_or_else(|| raw_content.clone());
    let dek = html::truncate_chars(&html::to_text(&dek_src), 220);

    let author = entry
        .authors
        .into_iter()
        .next()
        .map(|p| p.name)
        .unwrap_or_default();

    let published_at = entry.published.or(entry.updated).map(|d| d.timestamp());

    let tags: Vec<String> = entry
        .categories
        .into_iter()
        .filter_map(|c| {
            let t = c.label.unwrap_or(c.term).trim().to_lowercase();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .take(4)
        .collect();

    let mins = html::reading_minutes(&html::to_text(&content_summary));

    NewArticle {
        feed_id: feed_id.to_string(),
        guid: entry.id,
        title,
        dek,
        author,
        url,
        published_at,
        content_summary,
        mins,
        tags,
        enclosure_url,
        enclosure_type,
    }
}
