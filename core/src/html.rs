//! HTML güvenliği + yardımcılar. Feed/Readability HTML'i webview'e verilmeden önce
//! ammonia ile sanitize edilir (XSS koruması).
use std::collections::HashSet;

// Yalnız bu hostlardan iframe gömülülerine izin verilir.
// YouTube DAHİL DEĞİL: paketli uygulamada origin (tauri://) reddedilip "Error 153"
// verdiği için YouTube gömülüleri küçük-resim kartına dönüştürülür (readability.rs).
const EMBED_HOSTS: &[&str] = &[
    "player.vimeo.com",
    "w.soundcloud.com",
    "open.spotify.com",
    "player.twitch.tv",
];

/// Güvenli HTML (script/style/onclick temizlenir); güvenilir hostlardan video iframe'i korunur.
pub fn sanitize(html: &str) -> String {
    let mut b = ammonia::Builder::default();
    b.add_tags(["iframe"]);
    b.add_tag_attributes(
        "iframe",
        ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    );
    // iframe src'sini yalnız izinli hostlara sınırla (kalanı temizle).
    let cleaned = b.clean(html).to_string();
    strip_untrusted_iframes(&cleaned)
}

/// İzinli host listesinde olmayan iframe'leri kaldırır (basit, regex'siz tarama).
fn strip_untrusted_iframes(html: &str) -> String {
    let lower = html.to_lowercase();
    let mut out = String::with_capacity(html.len());
    let mut pos = 0usize;
    while let Some(rel) = lower[pos..].find("<iframe") {
        let start = pos + rel;
        out.push_str(&html[pos..start]);
        // iframe kapanışını bul (</iframe> ya da kendinden kapanan >)
        let after = &lower[start..];
        let end = match after.find("</iframe>") {
            Some(e) => start + e + "</iframe>".len(),
            None => match after.find('>') {
                Some(e) => start + e + 1,
                None => html.len(),
            },
        };
        let block = &html[start..end];
        let block_l = &lower[start..end];
        let trusted = extract_src(block_l, block)
            .and_then(|src| host_of(&src))
            .map(|h| EMBED_HOSTS.contains(&h.as_str()))
            .unwrap_or(false);
        if trusted {
            out.push_str(block);
        }
        pos = end;
    }
    out.push_str(&html[pos..]);
    out
}

fn extract_src(tag_lower: &str, tag_orig: &str) -> Option<String> {
    let i = tag_lower.find("src=")?;
    let rest = &tag_orig[i + 4..];
    let q = rest.chars().next()?;
    if q == '"' || q == '\'' {
        let endq = rest[1..].find(q)?;
        Some(rest[1..1 + endq].to_string())
    } else {
        None
    }
}

fn host_of(url: &str) -> Option<String> {
    let u = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://"))?;
    let u = u.strip_prefix("//").unwrap_or(u);
    Some(u.split(['/', '?', '#']).next()?.to_lowercase())
}

/// Tüm etiketleri kaldırıp düz metin döndürür (dek/özet ve kelime sayımı için).
pub fn to_text(html: &str) -> String {
    let stripped = ammonia::Builder::default()
        .tags(HashSet::new())
        .clean(html)
        .to_string();
    stripped.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// ~200 kelime/dk okuma süresi (en az 1).
pub fn reading_minutes(text: &str) -> i64 {
    let words = text.split_whitespace().count();
    (((words + 199) / 200).max(1)) as i64
}

/// Düz metni en fazla `max` karaktere kırpar (kelime sınırına yakın).
pub fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max).collect();
    out.push('…');
    out
}
