//! OPML içe/dışa aktarma — README §9. Klasör (kategori) yapısı korunur.
use anyhow::{anyhow, Result};
use opml::{Outline, OPML};

use crate::models::{Feed, FolderVM};

pub struct ImportEntry {
    pub url: String,
    pub title: String,
    pub folder: Option<String>, // en yakın üst klasörün adı
}

/// OPML XML'inden feed girdilerini toplar (iç içe klasörler dahil).
pub fn import(xml: &str) -> Result<Vec<ImportEntry>> {
    let doc = OPML::from_str(xml).map_err(|e| anyhow!("failed to parse OPML: {e}"))?;
    let mut out = Vec::new();
    walk(&doc.body.outlines, None, &mut out);
    Ok(out)
}

fn walk(outlines: &[Outline], folder: Option<&str>, out: &mut Vec<ImportEntry>) {
    for o in outlines {
        if let Some(url) = &o.xml_url {
            let title = o
                .title
                .clone()
                .filter(|t| !t.trim().is_empty())
                .unwrap_or_else(|| o.text.clone());
            out.push(ImportEntry {
                url: url.clone(),
                title,
                folder: folder.map(str::to_string),
            });
        }
        if !o.outlines.is_empty() {
            // xml_url'süz, çocuklu outline = klasör; en yakın (iç) klasör adı geçerli.
            let next = if o.xml_url.is_none() && !o.text.trim().is_empty() {
                Some(o.text.as_str())
            } else {
                folder
            };
            walk(&o.outlines, next, out);
        }
    }
}

/// Feed'leri klasör yapısıyla OPML XML'ine çevirir.
pub fn export(feeds: &[Feed], folders: &[FolderVM]) -> Result<String> {
    let mut doc = OPML::default();
    for folder in folders {
        let mut group = Outline {
            text: folder.title.clone(),
            ..Outline::default()
        };
        for f in feeds
            .iter()
            .filter(|x| x.folder_id.as_deref() == Some(folder.id.as_str()))
        {
            group.add_feed(&f.title, &f.url);
        }
        if !group.outlines.is_empty() {
            doc.body.outlines.push(group);
        }
    }
    for f in feeds.iter().filter(|x| x.folder_id.is_none()) {
        doc.add_feed(&f.title, &f.url);
    }
    doc.to_string().map_err(|e| anyhow!("failed to generate OPML: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(id: &str, url: &str, title: &str, folder_id: Option<&str>) -> Feed {
        Feed {
            id: id.into(),
            url: url.into(),
            title: title.into(),
            site_url: String::new(),
            icon_letter: "X".into(),
            color: "#000".into(),
            folder_id: folder_id.map(str::to_string),
            only_summary: false,
            last_fetch: None,
        }
    }

    #[test]
    fn roundtrip_with_folders() {
        let folders = vec![FolderVM {
            id: "fo1".into(),
            title: "Tech".into(),
        }];
        let feeds = vec![
            feed("f1", "https://a.com/rss", "A Blog", Some("fo1")),
            feed("f2", "https://b.com/rss", "B Blog", None),
        ];
        let xml = export(&feeds, &folders).unwrap();
        let parsed = import(&xml).unwrap();
        assert_eq!(parsed.len(), 2);
        let a = parsed.iter().find(|e| e.url == "https://a.com/rss").unwrap();
        assert_eq!(a.folder.as_deref(), Some("Tech"));
        assert_eq!(a.title, "A Blog");
        let b = parsed.iter().find(|e| e.url == "https://b.com/rss").unwrap();
        assert!(b.folder.is_none());
    }
}
