//! Feed favicon'ları — README §11: site_url'den çekilir, yoksa harf-rozeti fallback.
//! Sonuç data-URL olarak DB'de cache'lenir (çevrimdışı çalışır).
use base64::Engine;

use crate::fetch;

fn mime_of(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 4 {
        return None;
    }
    if bytes.starts_with(b"\x89PNG") {
        Some("image/png")
    } else if bytes.starts_with(b"\xFF\xD8") {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif")
    } else if bytes.starts_with(&[0, 0, 1, 0]) {
        Some("image/x-icon")
    } else if bytes.starts_with(b"RIFF") {
        Some("image/webp")
    } else {
        let head = String::from_utf8_lossy(&bytes[..bytes.len().min(256)]).to_lowercase();
        if head.contains("<svg") {
            Some("image/svg+xml")
        } else {
            None
        }
    }
}

/// Sayfa HTML'inde `<link rel="…icon…" href="…">` arar (basit tarama, regex'siz).
fn find_icon_href(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let mut pos = 0usize;
    while let Some(i) = lower[pos..].find("<link") {
        let start = pos + i;
        let Some(e) = lower[start..].find('>') else { break };
        let end = start + e;
        let tag = &html[start..end];
        let tag_l = &lower[start..end];
        if tag_l.contains("rel=") && tag_l.contains("icon") && !tag_l.contains("mask-icon") {
            if let Some(h) = tag_l.find("href=") {
                let rest = &tag[h + 5..];
                let mut chars = rest.chars();
                if let Some(q) = chars.next() {
                    if q == '"' || q == '\'' {
                        if let Some(endq) = rest[1..].find(q) {
                            return Some(rest[1..1 + endq].to_string());
                        }
                    }
                }
            }
        }
        pos = end;
    }
    None
}

/// Sitenin favicon'unu çekip data-URL döndürür (bulunamazsa None).
pub fn fetch_favicon(client: &reqwest::blocking::Client, page_url: &str) -> Option<String> {
    let base = reqwest::Url::parse(page_url).ok()?;
    let origin = base.join("/").ok()?;

    let mut candidates: Vec<reqwest::Url> = Vec::new();
    if let Ok(html) = fetch::get_text(client, origin.as_str()) {
        // Büyük sayfalarda yalnız baş kısmı tara (ikon <head> içindedir).
        let head: String = html.chars().take(64_000).collect();
        if let Some(href) = find_icon_href(&head) {
            if let Ok(u) = origin.join(&href) {
                candidates.push(u);
            }
        }
    }
    if let Ok(u) = origin.join("/favicon.ico") {
        candidates.push(u);
    }

    for u in candidates {
        if let Ok(bytes) = fetch::get_bytes(client, u.as_str()) {
            if !bytes.is_empty() && bytes.len() <= 300_000 {
                if let Some(mime) = mime_of(&bytes) {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    return Some(format!("data:{mime};base64,{b64}"));
                }
            }
        }
    }
    None
}
