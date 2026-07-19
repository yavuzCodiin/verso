//! SQLite katmanı — README §8. Şema + migration (PRAGMA user_version) + sorgular.
use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::models::{
    ArticleFullVM, ArticleListVM, Feed, FeedVM, FolderVM, NewArticle, Rule, SmartCounts, Space,
    SpaceVM,
};

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

const SCHEMA_V1: &str = r#"
CREATE TABLE folder (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE feed (
  id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  site_url TEXT NOT NULL DEFAULT '', icon_letter TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#888888', folder_id TEXT,
  only_summary INTEGER NOT NULL DEFAULT 0, last_fetch INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE article (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '', dek TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
  published_at INTEGER, fetched_at INTEGER NOT NULL DEFAULT 0,
  content_summary TEXT NOT NULL DEFAULT '', content_full TEXT,
  mins INTEGER NOT NULL DEFAULT 1,
  is_read INTEGER NOT NULL DEFAULT 0, is_starred INTEGER NOT NULL DEFAULT 0,
  is_later INTEGER NOT NULL DEFAULT 0, read_progress INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(feed_id, guid)
);
CREATE INDEX idx_article_feed ON article(feed_id);
CREATE INDEX idx_article_pub ON article(published_at);
CREATE TABLE space (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#888888',
  manual_only INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE space_rule (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  field TEXT NOT NULL DEFAULT 'both', keywords TEXT NOT NULL DEFAULT '[]',
  scope_all INTEGER NOT NULL DEFAULT 1, scope_feeds TEXT NOT NULL DEFAULT '[]',
  hide_from_source INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE article_space (
  article_id TEXT NOT NULL REFERENCES article(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'rule',
  PRIMARY KEY(article_id, space_id)
);
CREATE TABLE tag ( id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE );
CREATE TABLE article_tag (
  article_id TEXT NOT NULL REFERENCES article(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY(article_id, tag_id)
);
CREATE TABLE operation_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL, entity_id TEXT NOT NULL, op TEXT NOT NULL,
  payload TEXT, ts INTEGER NOT NULL
);
PRAGMA user_version = 1;
"#;
// NOT: v1 sonrası şema değişiklikleri migrate() içindeki v2+ adımlarında.

// hide_from_source: bir kurala eşleşip "kaynaktan gizle" işaretli yazılar, kaynak/klasör/
// Bugün listelerinden dışlanır (yalnız Alanda görünür). README §9.
const HIDE_CLAUSE: &str = " AND a.id NOT IN (SELECT asp.article_id FROM article_space asp \
    JOIN space_rule sr ON sr.space_id=asp.space_id \
    JOIN space s ON s.id=asp.space_id AND s.deleted=0 \
    WHERE sr.hide_from_source=1 AND asp.source='rule')";

pub struct Store {
    pub conn: Connection,
}

struct BaseRow {
    id: String,
    feed_id: String,
    feed_name: String,
    title: String,
    dek: String,
    author: String,
    published_at: Option<i64>,
    mins: i64,
    url: String,
    is_read: i64,
    is_starred: i64,
    is_later: i64,
    only_summary: i64,
}

impl Store {
    pub fn open<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path).context("could not open DB")?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let mut s = Store { conn };
        s.migrate()?;
        Ok(s)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        let mut s = Store { conn };
        s.migrate()?;
        Ok(s)
    }

    fn migrate(&mut self) -> Result<()> {
        let v: i64 = self
            .conn
            .pragma_query_value(None, "user_version", |r| r.get(0))?;
        if v < 1 {
            let tx = self.conn.transaction()?;
            tx.execute_batch(SCHEMA_V1)?;
            tx.commit()?;
        }
        if v < 2 {
            // v2: feed favicon cache (data URL) + makale enclosure (podcast/medya).
            let tx = self.conn.transaction()?;
            tx.execute_batch(
                "ALTER TABLE feed ADD COLUMN icon_data TEXT;
                 ALTER TABLE article ADD COLUMN enclosure_url TEXT;
                 ALTER TABLE article ADD COLUMN enclosure_type TEXT;
                 PRAGMA user_version = 2;",
            )?;
            tx.commit()?;
        }
        Ok(())
    }

    // ── Feed ──
    #[allow(clippy::too_many_arguments)]
    pub fn insert_feed(
        &self,
        id: &str,
        url: &str,
        title: &str,
        site_url: &str,
        letter: &str,
        color: &str,
        only_summary: bool,
        folder_id: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO feed (id,url,title,site_url,icon_letter,color,only_summary,folder_id,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, url, title, site_url, letter, color, only_summary as i64, folder_id, now()],
        )?;
        Ok(())
    }

    /// URL'e göre feed arar (silinmişler dahil) → (id, deleted).
    pub fn feed_by_url_any(&self, url: &str) -> Result<Option<(String, bool)>> {
        Ok(self
            .conn
            .query_row("SELECT id, deleted FROM feed WHERE url=?1", [url], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0))
            })
            .optional()?)
    }

    pub fn get_feed(&self, id: &str) -> Result<Option<Feed>> {
        Ok(self
            .conn
            .query_row(
                "SELECT id,url,title,site_url,icon_letter,color,folder_id,only_summary,last_fetch
                 FROM feed WHERE id=?1 AND deleted=0",
                [id],
                |r| {
                    Ok(Feed {
                        id: r.get(0)?,
                        url: r.get(1)?,
                        title: r.get(2)?,
                        site_url: r.get(3)?,
                        icon_letter: r.get(4)?,
                        color: r.get(5)?,
                        folder_id: r.get(6)?,
                        only_summary: r.get::<_, i64>(7)? != 0,
                        last_fetch: r.get(8)?,
                    })
                },
            )
            .optional()?)
    }

    /// Feed'i (ve yazılarını) yumuşak siler — sync log'u için satırlar kalır.
    pub fn delete_feed(&self, id: &str) -> Result<()> {
        let ts = now();
        self.conn.execute(
            "UPDATE feed SET deleted=1, updated_at=?2 WHERE id=?1",
            params![id, ts],
        )?;
        self.conn.execute(
            "UPDATE article SET deleted=1, updated_at=?2 WHERE feed_id=?1",
            params![id, ts],
        )?;
        Ok(())
    }

    /// Silinmiş feed'i (ve yazılarını) geri getirir (aynı URL yeniden eklenirse).
    pub fn restore_feed(&self, id: &str) -> Result<()> {
        let ts = now();
        self.conn.execute(
            "UPDATE feed SET deleted=0, updated_at=?2 WHERE id=?1",
            params![id, ts],
        )?;
        self.conn.execute(
            "UPDATE article SET deleted=0, updated_at=?2 WHERE feed_id=?1",
            params![id, ts],
        )?;
        Ok(())
    }

    // ── Folder ──
    /// Başlığa göre klasörü bulur ya da oluşturur, id döner.
    pub fn ensure_folder(&self, title: &str) -> Result<String> {
        if let Some(id) = self
            .conn
            .query_row(
                "SELECT id FROM folder WHERE title=?1 AND deleted=0",
                [title],
                |r| r.get::<_, String>(0),
            )
            .optional()?
        {
            return Ok(id);
        }
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO folder (id,title,updated_at) VALUES (?1,?2,?3)",
            params![id, title, now()],
        )?;
        Ok(id)
    }

    pub fn list_folders(&self) -> Result<Vec<FolderVM>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id,title FROM folder WHERE deleted=0 ORDER BY title")?;
        let rows = stmt.query_map([], |r| {
            Ok(FolderVM {
                id: r.get(0)?,
                title: r.get(1)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn set_feed_folder(&self, feed_id: &str, folder_id: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE feed SET folder_id=?2, updated_at=?3 WHERE id=?1",
            params![feed_id, folder_id, now()],
        )?;
        Ok(())
    }

    pub fn rename_folder(&self, id: &str, title: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE folder SET title=?2, updated_at=?3 WHERE id=?1",
            params![id, title, now()],
        )?;
        Ok(())
    }

    /// Klasörü siler; içindeki feed'ler klasörsüz kalır (silinmez).
    pub fn delete_folder(&self, id: &str) -> Result<()> {
        let ts = now();
        self.conn.execute(
            "UPDATE feed SET folder_id=NULL, updated_at=?2 WHERE folder_id=?1",
            params![id, ts],
        )?;
        self.conn.execute(
            "UPDATE folder SET deleted=1, updated_at=?2 WHERE id=?1",
            params![id, ts],
        )?;
        Ok(())
    }

    pub fn rename_feed(&self, id: &str, title: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE feed SET title=?2, updated_at=?3 WHERE id=?1",
            params![id, title, now()],
        )?;
        Ok(())
    }

    pub fn set_feed_icon(&self, id: &str, data_url: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE feed SET icon_data=?2 WHERE id=?1",
            params![id, data_url],
        )?;
        Ok(())
    }

    /// Favicon'u henüz denenmemiş feed'ler → (id, sayfa url'i).
    pub fn feeds_missing_icon(&self) -> Result<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, CASE WHEN site_url!='' THEN site_url ELSE url END
             FROM feed WHERE deleted=0 AND icon_data IS NULL",
        )?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn set_feed_only_summary(&self, id: &str, v: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE feed SET only_summary=?2, updated_at=?3 WHERE id=?1",
            params![id, v as i64, now()],
        )?;
        Ok(())
    }

    // ── Space düzenleme ──
    pub fn update_space(&self, id: &str, name: &str, color: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE space SET name=?2, color=?3, updated_at=?4 WHERE id=?1",
            params![id, name, color, now()],
        )?;
        Ok(())
    }

    /// Alanı siler: kural + atamalar kaldırılır, alan yumuşak silinir.
    pub fn delete_space(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM space_rule WHERE space_id=?1", [id])?;
        self.conn
            .execute("DELETE FROM article_space WHERE space_id=?1", [id])?;
        self.conn.execute(
            "UPDATE space SET deleted=1, updated_at=?2 WHERE id=?1",
            params![id, now()],
        )?;
        Ok(())
    }

    pub fn get_space_keywords(&self, space_id: &str) -> Result<Vec<String>> {
        let kw: Option<String> = self
            .conn
            .query_row(
                "SELECT keywords FROM space_rule WHERE space_id=?1 LIMIT 1",
                [space_id],
                |r| r.get(0),
            )
            .optional()?;
        Ok(kw
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default())
    }

    /// Alan kuralının anahtar kelimelerini değiştirir (boşsa kural silinir).
    pub fn set_space_keywords(&self, space_id: &str, keywords: &[String]) -> Result<()> {
        if keywords.is_empty() {
            self.conn
                .execute("DELETE FROM space_rule WHERE space_id=?1", [space_id])?;
            return Ok(());
        }
        let json = serde_json::to_string(keywords)?;
        let n = self.conn.execute(
            "UPDATE space_rule SET keywords=?2 WHERE space_id=?1",
            params![space_id, json],
        )?;
        if n == 0 {
            self.insert_rule(&Rule {
                id: Uuid::new_v4().to_string(),
                space_id: space_id.to_string(),
                field: "both".to_string(),
                keywords: keywords.to_vec(),
                scope_all: true,
                scope_feeds: vec![],
                hide_from_source: false,
            })?;
        }
        Ok(())
    }

    /// Alanın kuralını (varsa) tam olarak döndürür (edit modalı için).
    pub fn get_space_rule(&self, space_id: &str) -> Result<Option<Rule>> {
        let row = self
            .conn
            .query_row(
                "SELECT id,space_id,field,keywords,scope_all,scope_feeds,hide_from_source \
                 FROM space_rule WHERE space_id=?1 LIMIT 1",
                [space_id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, i64>(4)?,
                        r.get::<_, String>(5)?,
                        r.get::<_, i64>(6)?,
                    ))
                },
            )
            .optional()?;
        Ok(row.map(|(id, space_id, field, kw, scope_all, sf, hide)| Rule {
            id,
            space_id,
            field,
            keywords: serde_json::from_str(&kw).unwrap_or_default(),
            scope_all: scope_all != 0,
            scope_feeds: serde_json::from_str(&sf).unwrap_or_default(),
            hide_from_source: hide != 0,
        }))
    }

    /// Alanın kuralını tam olarak ayarlar (tek kural/alan). Kelime yoksa kural silinir.
    #[allow(clippy::too_many_arguments)]
    pub fn set_space_rule(
        &self,
        space_id: &str,
        field: &str,
        keywords: &[String],
        scope_all: bool,
        scope_feeds: &[String],
        hide_from_source: bool,
    ) -> Result<()> {
        self.conn
            .execute("DELETE FROM space_rule WHERE space_id=?1", [space_id])?;
        if keywords.is_empty() {
            return Ok(());
        }
        self.insert_rule(&Rule {
            id: Uuid::new_v4().to_string(),
            space_id: space_id.to_string(),
            field: field.to_string(),
            keywords: keywords.to_vec(),
            scope_all,
            scope_feeds: scope_feeds.to_vec(),
            hide_from_source,
        })
    }

    /// Alan oluşturur (id=None) ya da günceller; kuralı tam ayarlar. Alan id döner.
    #[allow(clippy::too_many_arguments)]
    pub fn save_space(
        &self,
        id: Option<&str>,
        name: &str,
        color: &str,
        field: &str,
        keywords: &[String],
        scope_all: bool,
        scope_feeds: &[String],
        hide_from_source: bool,
    ) -> Result<String> {
        let sid = match id {
            Some(x) => {
                self.update_space(x, name, color)?;
                x.to_string()
            }
            None => {
                let s = Uuid::new_v4().to_string();
                self.insert_space(&Space {
                    id: s.clone(),
                    name: name.to_string(),
                    color: color.to_string(),
                    manual_only: keywords.is_empty(),
                })?;
                s
            }
        };
        self.set_space_rule(&sid, field, keywords, scope_all, scope_feeds, hide_from_source)?;
        Ok(sid)
    }

    pub fn feed_count(&self) -> Result<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM feed WHERE deleted=0", [], |r| r.get(0))?)
    }

    pub fn feed_id_by_url(&self, url: &str) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row("SELECT id FROM feed WHERE url=?1 AND deleted=0", [url], |r| r.get(0))
            .optional()?)
    }

    pub fn set_feed_fetched(&self, id: &str, ts: i64) -> Result<()> {
        self.conn
            .execute("UPDATE feed SET last_fetch=?2 WHERE id=?1", params![id, ts])?;
        Ok(())
    }

    pub fn list_feeds_raw(&self) -> Result<Vec<Feed>> {
        let mut stmt = self.conn.prepare(
            "SELECT id,url,title,site_url,icon_letter,color,folder_id,only_summary,last_fetch
             FROM feed WHERE deleted=0 ORDER BY title",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Feed {
                id: r.get(0)?,
                url: r.get(1)?,
                title: r.get(2)?,
                site_url: r.get(3)?,
                icon_letter: r.get(4)?,
                color: r.get(5)?,
                folder_id: r.get(6)?,
                only_summary: r.get::<_, i64>(7)? != 0,
                last_fetch: r.get(8)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn list_feeds(&self) -> Result<Vec<FeedVM>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, f.icon_letter, f.color, f.title, f.url, f.folder_id, f.only_summary, f.icon_data,
                (SELECT COUNT(*) FROM article a WHERE a.feed_id=f.id AND a.is_read=0 AND a.deleted=0)
             FROM feed f WHERE f.deleted=0 ORDER BY f.title",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(FeedVM {
                id: r.get(0)?,
                letter: r.get(1)?,
                color: r.get(2)?,
                name: r.get(3)?,
                url: r.get(4)?,
                folder_id: r.get(5)?,
                only_summary: r.get::<_, i64>(6)? != 0,
                icon_data: r.get(7)?,
                count: r.get(8)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    // ── Space / Rule ──
    pub fn insert_space(&self, s: &Space) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO space (id,name,color,manual_only,updated_at) VALUES (?1,?2,?3,?4,?5)",
            params![s.id, s.name, s.color, s.manual_only as i64, now()],
        )?;
        Ok(())
    }

    pub fn insert_rule(&self, r: &Rule) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO space_rule (id,space_id,field,keywords,scope_all,scope_feeds,hide_from_source)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                r.id, r.space_id, r.field,
                serde_json::to_string(&r.keywords)?,
                r.scope_all as i64,
                serde_json::to_string(&r.scope_feeds)?,
                r.hide_from_source as i64
            ],
        )?;
        Ok(())
    }

    pub fn list_rules(&self) -> Result<Vec<Rule>> {
        let mut stmt = self.conn.prepare(
            "SELECT sr.id,sr.space_id,sr.field,sr.keywords,sr.scope_all,sr.scope_feeds,sr.hide_from_source
             FROM space_rule sr JOIN space s ON s.id=sr.space_id AND s.deleted=0",
        )?;
        let raw = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i64>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, i64>(6)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut out = Vec::new();
        for (id, space_id, field, kw, scope_all, sf, hide) in raw {
            out.push(Rule {
                id,
                space_id,
                field,
                keywords: serde_json::from_str(&kw).unwrap_or_default(),
                scope_all: scope_all != 0,
                scope_feeds: serde_json::from_str(&sf).unwrap_or_default(),
                hide_from_source: hide != 0,
            });
        }
        Ok(out)
    }

    pub fn list_spaces(&self) -> Result<Vec<SpaceVM>> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, s.color,
                (SELECT COUNT(*) FROM article_space asp JOIN article a ON a.id=asp.article_id
                 WHERE asp.space_id=s.id AND a.is_read=0 AND a.deleted=0)
             FROM space s WHERE s.deleted=0 ORDER BY s.name",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(SpaceVM {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                count: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn assign_space(&self, article_id: &str, space_id: &str, source: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO article_space (article_id,space_id,source) VALUES (?1,?2,?3)",
            params![article_id, space_id, source],
        )?;
        Ok(())
    }

    /// Yeni Alan (+ opsiyonel kural) oluşturur, id döner. Alan kurma modalı için.
    pub fn create_space(&self, name: &str, color: &str, keywords: &[String]) -> Result<String> {
        let sid = Uuid::new_v4().to_string();
        self.insert_space(&Space {
            id: sid.clone(),
            name: name.to_string(),
            color: color.to_string(),
            manual_only: keywords.is_empty(),
        })?;
        if !keywords.is_empty() {
            self.insert_rule(&Rule {
                id: Uuid::new_v4().to_string(),
                space_id: sid.clone(),
                field: "both".to_string(),
                keywords: keywords.to_vec(),
                scope_all: true,
                scope_feeds: vec![],
                hide_from_source: false,
            })?;
        }
        Ok(sid)
    }

    // ── Article yazma ──
    /// Yeni yazıyı ekler (feed_id+guid tekil). Eklendiyse yeni id döner, tekrarsa None.
    pub fn insert_article(&self, na: &NewArticle) -> Result<Option<String>> {
        let id = Uuid::new_v4().to_string();
        let ts = now();
        let n = self.conn.execute(
            "INSERT OR IGNORE INTO article
             (id,feed_id,guid,title,dek,author,url,published_at,fetched_at,content_summary,mins,enclosure_url,enclosure_type,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                id, na.feed_id, na.guid, na.title, na.dek, na.author, na.url,
                na.published_at, ts, na.content_summary, na.mins,
                na.enclosure_url, na.enclosure_type, ts
            ],
        )?;
        Ok(if n == 1 { Some(id) } else { None })
    }

    /// Var olan yazının eksik enclosure'ını doldurur (v2 migration öncesi kayıtlar).
    pub fn backfill_enclosure(
        &self,
        feed_id: &str,
        guid: &str,
        url: &str,
        mime: &str,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE article SET enclosure_url=?3, enclosure_type=?4
             WHERE feed_id=?1 AND guid=?2 AND enclosure_url IS NULL",
            params![feed_id, guid, url, mime],
        )?;
        Ok(())
    }

    fn ensure_tag(&self, name: &str) -> Result<String> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tag (id,name) VALUES (?1,?2)",
            params![Uuid::new_v4().to_string(), name],
        )?;
        Ok(self
            .conn
            .query_row("SELECT id FROM tag WHERE name=?1", params![name], |r| {
                r.get(0)
            })?)
    }

    pub fn set_article_tags(&self, article_id: &str, tags: &[String]) -> Result<()> {
        for name in tags {
            let tid = self.ensure_tag(name)?;
            self.conn.execute(
                "INSERT OR IGNORE INTO article_tag (article_id,tag_id) VALUES (?1,?2)",
                params![article_id, tid],
            )?;
        }
        Ok(())
    }

    // ── Article okuma ──
    fn tags_for(&self, article_id: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.name FROM tag t JOIN article_tag at ON at.tag_id=t.id
             WHERE at.article_id=?1 ORDER BY t.name",
        )?;
        let rows = stmt.query_map([article_id], |r| r.get::<_, String>(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    fn space_ids_for(&self, article_id: &str) -> Result<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT space_id FROM article_space WHERE article_id=?1")?;
        let rows = stmt.query_map([article_id], |r| r.get::<_, String>(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn list_articles(
        &self,
        kind: &str,
        id: &str,
        today_start: i64,
    ) -> Result<Vec<ArticleListVM>> {
        let base = "SELECT a.id,a.feed_id,f.title,a.title,a.dek,a.author,a.published_at,a.mins,a.url,\
                    a.is_read,a.is_starred,a.is_later,f.only_summary \
                    FROM article a JOIN feed f ON f.id=a.feed_id WHERE a.deleted=0";
        let (cond, args): (String, Vec<Box<dyn rusqlite::ToSql>>) = match (kind, id) {
            ("feed", fid) => (
                format!(" AND a.feed_id=?1{HIDE_CLAUSE}"),
                vec![Box::new(fid.to_string())],
            ),
            ("folder", fid) => (
                format!(" AND a.feed_id IN (SELECT id FROM feed WHERE folder_id=?1 AND deleted=0){HIDE_CLAUSE}"),
                vec![Box::new(fid.to_string())],
            ),
            ("space", sid) => (
                " AND a.id IN (SELECT article_id FROM article_space WHERE space_id=?1)".to_string(),
                vec![Box::new(sid.to_string())],
            ),
            ("smart", "bugun") => (
                format!(" AND a.published_at>=?1{HIDE_CLAUSE}"),
                vec![Box::new(today_start)],
            ),
            ("smart", "yildizli") => (" AND a.is_starred=1".to_string(), vec![]),
            ("smart", "sonra") => (" AND a.is_later=1".to_string(), vec![]),
            _ => (String::new(), vec![]),
        };
        let sql = format!("{base}{cond} ORDER BY a.published_at DESC");
        let args_ref: Vec<&dyn rusqlite::ToSql> = args.iter().map(|b| b.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let base_rows = stmt
            .query_map(args_ref.as_slice(), |r| {
                Ok(BaseRow {
                    id: r.get(0)?,
                    feed_id: r.get(1)?,
                    feed_name: r.get(2)?,
                    title: r.get(3)?,
                    dek: r.get(4)?,
                    author: r.get(5)?,
                    published_at: r.get(6)?,
                    mins: r.get(7)?,
                    url: r.get(8)?,
                    is_read: r.get(9)?,
                    is_starred: r.get(10)?,
                    is_later: r.get(11)?,
                    only_summary: r.get(12)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(stmt);

        let mut out = Vec::with_capacity(base_rows.len());
        for b in base_rows {
            let tags = self.tags_for(&b.id)?;
            let space_ids = self.space_ids_for(&b.id)?;
            out.push(ArticleListVM {
                id: b.id,
                feed_id: b.feed_id,
                feed_name: b.feed_name,
                title: b.title,
                dek: b.dek,
                author: b.author,
                published_at: b.published_at,
                mins: b.mins,
                url: b.url,
                unread: b.is_read == 0,
                starred: b.is_starred == 1,
                later: b.is_later == 1,
                only_summary: b.only_summary == 1,
                tags,
                space_ids,
            });
        }
        Ok(out)
    }

    /// Global arama — başlık/dek/kaynak adında LIKE (⌘K paleti için).
    pub fn search_articles(&self, query: &str, limit: i64) -> Result<Vec<ArticleListVM>> {
        let pat = format!("%{}%", query.trim());
        let mut stmt = self.conn.prepare(
            "SELECT a.id,a.feed_id,f.title,a.title,a.dek,a.author,a.published_at,a.mins,a.url,\
             a.is_read,a.is_starred,a.is_later,f.only_summary \
             FROM article a JOIN feed f ON f.id=a.feed_id \
             WHERE a.deleted=0 AND (a.title LIKE ?1 OR a.dek LIKE ?1 OR f.title LIKE ?1) \
             ORDER BY a.published_at DESC LIMIT ?2",
        )?;
        let base_rows = stmt
            .query_map(params![pat, limit], |r| {
                Ok(BaseRow {
                    id: r.get(0)?,
                    feed_id: r.get(1)?,
                    feed_name: r.get(2)?,
                    title: r.get(3)?,
                    dek: r.get(4)?,
                    author: r.get(5)?,
                    published_at: r.get(6)?,
                    mins: r.get(7)?,
                    url: r.get(8)?,
                    is_read: r.get(9)?,
                    is_starred: r.get(10)?,
                    is_later: r.get(11)?,
                    only_summary: r.get(12)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(stmt);

        let mut out = Vec::with_capacity(base_rows.len());
        for b in base_rows {
            let tags = self.tags_for(&b.id)?;
            let space_ids = self.space_ids_for(&b.id)?;
            out.push(ArticleListVM {
                id: b.id,
                feed_id: b.feed_id,
                feed_name: b.feed_name,
                title: b.title,
                dek: b.dek,
                author: b.author,
                published_at: b.published_at,
                mins: b.mins,
                url: b.url,
                unread: b.is_read == 0,
                starred: b.is_starred == 1,
                later: b.is_later == 1,
                only_summary: b.only_summary == 1,
                tags,
                space_ids,
            });
        }
        Ok(out)
    }

    pub fn get_article(&self, id: &str) -> Result<Option<ArticleFullVM>> {
        let row = self
            .conn
            .query_row(
                "SELECT a.id,a.feed_id,f.title,a.title,a.dek,a.author,a.published_at,a.mins,a.url,\
                 a.is_read,a.is_starred,a.is_later,f.only_summary,a.content_summary,a.content_full,a.read_progress,\
                 a.enclosure_url,a.enclosure_type \
                 FROM article a JOIN feed f ON f.id=a.feed_id WHERE a.id=?1 AND a.deleted=0",
                [id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                        r.get::<_, String>(5)?,
                        r.get::<_, Option<i64>>(6)?,
                        r.get::<_, i64>(7)?,
                        r.get::<_, String>(8)?,
                        r.get::<_, i64>(9)?,
                        r.get::<_, i64>(10)?,
                        r.get::<_, i64>(11)?,
                        r.get::<_, i64>(12)?,
                        r.get::<_, String>(13)?,
                        r.get::<_, Option<String>>(14)?,
                        r.get::<_, i64>(15)?,
                        r.get::<_, Option<String>>(16)?,
                        r.get::<_, Option<String>>(17)?,
                    ))
                },
            )
            .optional()?;

        let Some(t) = row else { return Ok(None) };
        let tags = self.tags_for(&t.0)?;
        Ok(Some(ArticleFullVM {
            id: t.0,
            feed_id: t.1,
            feed_name: t.2,
            title: t.3,
            dek: t.4,
            author: t.5,
            published_at: t.6,
            mins: t.7,
            url: t.8,
            unread: t.9 == 0,
            starred: t.10 == 1,
            later: t.11 == 1,
            only_summary: t.12 == 1,
            content_summary: t.13,
            content_full: t.14,
            read_progress: t.15,
            enclosure_url: t.16,
            enclosure_type: t.17,
            tags,
        }))
    }

    // ── Article mutasyonları ──
    pub fn set_read(&self, id: &str, read: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE article SET is_read=?2, updated_at=?3 WHERE id=?1",
            params![id, read as i64, now()],
        )?;
        Ok(())
    }

    pub fn toggle_star(&self, id: &str) -> Result<bool> {
        self.conn.execute(
            "UPDATE article SET is_starred=1-is_starred, updated_at=?2 WHERE id=?1",
            params![id, now()],
        )?;
        let v: i64 =
            self.conn
                .query_row("SELECT is_starred FROM article WHERE id=?1", [id], |r| {
                    r.get(0)
                })?;
        Ok(v == 1)
    }

    pub fn toggle_later(&self, id: &str) -> Result<bool> {
        self.conn.execute(
            "UPDATE article SET is_later=1-is_later, updated_at=?2 WHERE id=?1",
            params![id, now()],
        )?;
        let v: i64 = self
            .conn
            .query_row("SELECT is_later FROM article WHERE id=?1", [id], |r| r.get(0))?;
        Ok(v == 1)
    }

    pub fn set_progress(&self, id: &str, p: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE article SET read_progress=?2, updated_at=?3 WHERE id=?1",
            params![id, p.clamp(0, 100), now()],
        )?;
        Ok(())
    }

    pub fn set_content_full(&self, id: &str, html: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE article SET content_full=?2, updated_at=?3 WHERE id=?1",
            params![id, html, now()],
        )?;
        Ok(())
    }

    pub fn mark_all_read(&self, kind: &str, id: &str, today_start: i64) -> Result<()> {
        let (cond, args): (&str, Vec<Box<dyn rusqlite::ToSql>>) = match (kind, id) {
            ("feed", fid) => ("feed_id=?1", vec![Box::new(fid.to_string())]),
            ("folder", fid) => (
                "feed_id IN (SELECT id FROM feed WHERE folder_id=?1 AND deleted=0)",
                vec![Box::new(fid.to_string())],
            ),
            ("space", sid) => (
                "id IN (SELECT article_id FROM article_space WHERE space_id=?1)",
                vec![Box::new(sid.to_string())],
            ),
            ("smart", "bugun") => ("published_at>=?1", vec![Box::new(today_start)]),
            ("smart", "yildizli") => ("is_starred=1", vec![]),
            ("smart", "sonra") => ("is_later=1", vec![]),
            _ => ("1=1", vec![]),
        };
        let sql = format!("UPDATE article SET is_read=1, updated_at={} WHERE {}", now(), cond);
        let args_ref: Vec<&dyn rusqlite::ToSql> = args.iter().map(|b| b.as_ref()).collect();
        self.conn.execute(&sql, args_ref.as_slice())?;
        Ok(())
    }

    pub fn smart_counts(&self, today_start: i64) -> Result<SmartCounts> {
        let bugun: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM article WHERE deleted=0 AND published_at>=?1",
            [today_start],
            |r| r.get(0),
        )?;
        let yildizli: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM article WHERE deleted=0 AND is_starred=1",
            [],
            |r| r.get(0),
        )?;
        let sonra: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM article WHERE deleted=0 AND is_later=1",
            [],
            |r| r.get(0),
        )?;
        Ok(SmartCounts {
            bugun,
            yildizli,
            sonra,
        })
    }
}
