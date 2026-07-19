//! Alan kural motoru — README §9.
//! Yeni yazı geldiğinde başlık/içerik, her Alanın anahtar kelimeleriyle
//! (case-insensitive, substring) eşleştirilir; eşleşen yazı o Alana atanır.
use crate::models::Rule;

/// Bir yazının (başlık + içerik, feed) eşleştiği Alan (space id) listesini döndürür.
pub fn match_spaces(title: &str, content: &str, feed_id: &str, rules: &[Rule]) -> Vec<String> {
    let title_l = title.to_lowercase();
    let content_l = content.to_lowercase();
    let mut out: Vec<String> = Vec::new();

    for r in rules {
        // Kapsam: tüm kaynaklar mı yoksa seçili kaynaklar mı?
        if !r.scope_all && !r.scope_feeds.iter().any(|f| f == feed_id) {
            continue;
        }
        let matched = r.keywords.iter().any(|k| {
            let kw = k.trim().to_lowercase();
            if kw.is_empty() {
                return false;
            }
            match r.field.as_str() {
                "title" => title_l.contains(&kw),
                "content" => content_l.contains(&kw),
                _ => title_l.contains(&kw) || content_l.contains(&kw), // both
            }
        });
        if matched {
            out.push(r.space_id.clone());
        }
    }
    out.sort();
    out.dedup();
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(space: &str, kws: &[&str]) -> Rule {
        Rule {
            id: "r".into(),
            space_id: space.into(),
            field: "both".into(),
            keywords: kws.iter().map(|s| s.to_string()).collect(),
            scope_all: true,
            scope_feeds: vec![],
            hide_from_source: false,
        }
    }

    #[test]
    fn matches_case_insensitive_substring() {
        let rules = vec![rule("rust", &["rust", "cargo"]), rule("ml", &["llm"])];
        let got = match_spaces("Ownership in RUST", "using Cargo build", "f1", &rules);
        assert_eq!(got, vec!["rust".to_string()]);
    }

    #[test]
    fn respects_scope_feeds() {
        let mut r = rule("rust", &["rust"]);
        r.scope_all = false;
        r.scope_feeds = vec!["f2".into()];
        assert!(match_spaces("rust", "", "f1", std::slice::from_ref(&r)).is_empty());
        assert_eq!(match_spaces("rust", "", "f2", std::slice::from_ref(&r)), vec!["rust".to_string()]);
    }
}
