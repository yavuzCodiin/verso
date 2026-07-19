//! Uçtan uca backend doğrulaması: gerçek feed'leri paralel çek → ayrıştır → kural motoru → DB.
//! `cargo run -p verso-core --example refresh_demo`
use std::sync::Mutex;

use verso_core::{db::Store, fetch, refresh, seed};

fn main() {
    let store = Mutex::new(Store::open_in_memory().expect("db"));
    seed::seed_defaults(&store.lock().unwrap()).expect("seed");
    let client = fetch::client().expect("client");

    println!("== Feed'ler yenileniyor (paralel, gerçek ağ) ==");
    let sum = refresh::refresh_all_parallel(&store, &client, refresh::WORKERS, |done, total, label| {
        println!("  [{done}/{total}] {label}");
    });
    println!("Özet: {sum:?}\n");

    let s = store.lock().unwrap();
    println!("== Kaynaklar (okunmamış) ==");
    for f in s.list_feeds().unwrap() {
        println!("  {:<22} okunmamış={}", f.name, f.count);
    }

    println!("\n== Alanlar (kural motoruyla dolan) ==");
    for sp in s.list_spaces().unwrap() {
        println!("  {:<10} yazı={}", sp.name, sp.count);
    }

    println!("\n== 'Rust' alanı — ilk 5 (kural eşleşmesi) ==");
    for a in s.list_articles("space", "rust", 0).unwrap().iter().take(5) {
        println!("  • {}  [{}, {} dk]", a.title, a.feed_name, a.mins);
    }
}
