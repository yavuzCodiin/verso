//! Tek URL'de fetch+Readability doğrulaması:
//! `cargo run -p verso-core --example extract_demo -- <url>`
use verso_core::{fetch, html, readability};

fn main() {
    let url = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "https://brevzin.github.io/c++/2025/03/25/attributes/".into());
    let client = fetch::client().expect("client");
    let raw = fetch::get_text(&client, &url).expect("fetch");
    println!("ham HTML: {} bayt", raw.len());
    match readability::extract(&raw, &url, true) {
        Ok(out) => {
            let text = html::to_text(&out);
            let words = text.split_whitespace().count();
            println!("çıkarılan HTML: {} bayt · {} kelime (~{} dk)", out.len(), words, (words / 200).max(1));
            let preview: String = text.chars().take(220).collect();
            println!("başlangıç: {preview}…");
            let tail: String = text.chars().rev().take(160).collect::<Vec<_>>().iter().rev().collect();
            println!("son: …{tail}");
        }
        Err(e) => println!("EXTRACT HATASI: {e}"),
    }
}
