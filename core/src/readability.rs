//! Tam metin çıkarımı — dom_smoothie 0.18 (Mozilla Readability portu). README §9.
use anyhow::{anyhow, Result};
use dom_smoothie::{Config, Readability};

/// Ham HTML'den okunabilir gövdeyi çıkarır ve sanitize eder. Başarısızsa Err döner
/// (çağıran Özet'e düşer).
/// `allow_video`: makale bir medya öğesi mi (podcast/video enclosure)? True ise ham
/// sayfadan da video çıkarılabilir; false ise yalnız makale gövdesindeki video kabul edilir.
pub fn extract(raw_html: &str, url: &str, allow_video: bool) -> Result<String> {
    // Öğe sınırı YOK (büyük sayfalar kırpılmasın); kısa bölümler için eşik düşük.
    let cfg = Config {
        char_threshold: 250,
        ..Default::default()
    };
    let mut readability = Readability::new(raw_html, Some(url), Some(cfg))
        .map_err(|e| anyhow!("readability init: {e}"))?;
    let article = readability
        .parse()
        .map_err(|e| anyhow!("readability parse: {e}"))?;
    let content = article.content.to_string();
    if content.trim().is_empty() {
        return Err(anyhow!("empty content"));
    }
    let mut html = crate::html::sanitize(&content);
    // İçerikteki YouTube (makale gövdesinde, KESİN) önce; yoksa yalnız medya
    // makalesinde ham sayfadan (podcast). Böylece blog kenar-çubuğu videoları eklenmez.
    let yt = find_youtube_id(&content).or_else(|| {
        if allow_video {
            find_youtube_id(raw_html)
        } else {
            None
        }
    });
    if !html.contains("verso-yt") {
        if let Some(id) = yt {
            let card = format!(
                "<div class=\"verso-yt\" data-yt-id=\"{id}\">\
                 <img src=\"https://i.ytimg.com/vi/{id}/hqdefault.jpg\" alt=\"YouTube\"/>\
                 <span class=\"verso-yt-badge\">► Play video</span></div>"
            );
            html = format!("{card}{html}");
        }
    }
    Ok(html)
}

/// Ham HTML'de ilk YouTube video kimliğini (11 karakter) çeşitli işaretlerden bulur.
fn find_youtube_id(raw: &str) -> Option<String> {
    const MARKERS: &[&str] = &[
        "ytimg.com/vi/",
        "youtube.com/embed/",
        "youtube-nocookie.com/embed/",
        "youtu.be/",
        "youtube.com/watch?v=",
        "youtube.com/v/",
    ];
    for m in MARKERS {
        let mut from = 0usize;
        while let Some(i) = raw[from..].find(m) {
            let idpos = from + i + m.len();
            let id: String = raw[idpos..]
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .take(11)
                .collect();
            if id.len() == 11 {
                return Some(id);
            }
            from = idpos;
        }
    }
    None
}
