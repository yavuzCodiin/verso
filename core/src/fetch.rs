//! HTTP indirme — senkron (reqwest blocking + rustls). Feed XML ve makale HTML'i çeker.
use anyhow::{Context, Result};
use std::time::Duration;

pub fn client() -> Result<reqwest::blocking::Client> {
    // Tarayıcı-benzeri UA: bazı siteler bot UA'lara eksik/boş HTML veriyor.
    reqwest::blocking::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 \
             (KHTML, like Gecko) Version/17.5 Safari/605.1.15 Verso/0.1",
        )
        .timeout(Duration::from_secs(20))
        .build()
        .context("could not create HTTP client")
}

pub fn get_bytes(client: &reqwest::blocking::Client, url: &str) -> Result<Vec<u8>> {
    let resp = client
        .get(url)
        .send()
        .with_context(|| format!("GET {url}"))?
        .error_for_status()
        .with_context(|| format!("HTTP status error: {url}"))?;
    Ok(resp.bytes()?.to_vec())
}

pub fn get_text(client: &reqwest::blocking::Client, url: &str) -> Result<String> {
    let resp = client
        .get(url)
        .send()
        .with_context(|| format!("GET {url}"))?
        .error_for_status()
        .with_context(|| format!("HTTP status error: {url}"))?;
    Ok(resp.text()?)
}
