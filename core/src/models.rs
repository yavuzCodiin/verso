//! Veri modelleri — README §8. DB varlıkları + arayüze dönen görünüm (VM) tipleri.
//! VM'ler serde ile camelCase serileşir (frontend'in beklediği alan adları).
use serde::{Deserialize, Serialize};

// ─────────────── DB varlıkları ───────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feed {
    pub id: String,
    pub url: String,
    pub title: String,
    pub site_url: String,
    pub icon_letter: String,
    pub color: String,
    pub folder_id: Option<String>,
    pub only_summary: bool,
    pub last_fetch: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub color: String,
    pub manual_only: bool,
}

/// Alan kuralı — anahtar-kelime filtresi (README §9).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub space_id: String,
    pub field: String, // "title" | "content" | "both"
    pub keywords: Vec<String>,
    pub scope_all: bool,
    pub scope_feeds: Vec<String>,
    pub hide_from_source: bool,
}

/// Feed'ten ayrıştırılmış, DB'ye yazılacak yazı (içerik sanitize edilmiş HTML).
#[derive(Debug, Clone)]
pub struct NewArticle {
    pub feed_id: String,
    pub guid: String,
    pub title: String,
    pub dek: String,
    pub author: String,
    pub url: String,
    pub published_at: Option<i64>,
    pub content_summary: String,
    pub mins: i64,
    pub tags: Vec<String>,
    pub enclosure_url: Option<String>,  // podcast/medya (README §9)
    pub enclosure_type: Option<String>, // "audio/mpeg" vb.
}

// ─────────────── Arayüz görünüm tipleri (camelCase) ───────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedVM {
    pub id: String,
    pub letter: String,
    pub color: String,
    pub name: String,
    pub url: String,
    pub folder_id: Option<String>,
    pub icon_data: Option<String>, // favicon (data URL); ""=denendi bulunamadı
    pub count: i64,                // okunmamış
    pub only_summary: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderVM {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceVM {
    pub id: String,
    pub name: String,
    pub color: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartCounts {
    pub bugun: i64,
    pub yildizli: i64,
    pub sonra: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleListVM {
    pub id: String,
    pub feed_id: String,
    pub feed_name: String,
    pub title: String,
    pub dek: String,
    pub author: String,
    pub published_at: Option<i64>,
    pub mins: i64,
    pub url: String,
    pub unread: bool,
    pub starred: bool,
    pub later: bool,
    pub only_summary: bool,
    pub tags: Vec<String>,
    pub space_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleFullVM {
    pub id: String,
    pub feed_id: String,
    pub feed_name: String,
    pub title: String,
    pub dek: String,
    pub author: String,
    pub published_at: Option<i64>,
    pub mins: i64,
    pub url: String,
    pub unread: bool,
    pub starred: bool,
    pub later: bool,
    pub only_summary: bool,
    pub tags: Vec<String>,
    pub content_summary: String,
    pub content_full: Option<String>,
    pub read_progress: i64,
    pub enclosure_url: Option<String>,
    pub enclosure_type: Option<String>,
}
