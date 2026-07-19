//! Ağ-seviyesi reklam/izleyici engelleme — macOS WKContentRuleList.
//!
//! Web modundaki gömülü native webview'in `WKUserContentController`'ına, bilinen
//! reklam/izleyici alan adlarına giden istekleri *ağ seviyesinde* engelleyen bir
//! içerik-kural listesi ekler. Kozmetik JS (`ADBLOCK_JS`) sadece görünürde gizlerken,
//! bu, isteğin hiç yapılmamasını sağlar → daha hızlı, daha az veri.
//!
//! Derleme asenkron (WebKit completion bloğu). `apply()` ana thread'de çağrılmalı;
//! `Webview::with_webview` callback'i zaten ana thread'de çalışır.

use std::ffi::c_void;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::MainThreadMarker;
use objc2_foundation::{NSError, NSString};
use objc2_web_kit::{WKContentRuleList, WKContentRuleListStore, WKUserContentController};

/// Diskte önbelleğe alınan derlenmiş listenin kimliği (kural seti değişirse artır).
const IDENTIFIER: &str = "verso-adblock-v1";

/// URL içinde bu dizeler geçen istekler engellenir. Alan adı temelli — sayfanın
/// kendisini değil, üçüncü-taraf reklam/izleyici kaynaklarını hedefler.
const AD_DOMAINS: &[&str] = &[
    // Google reklam / analitik
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "googletagservices.com",
    "google-analytics.com",
    "googletagmanager.com",
    "adservice.google.com",
    // Büyük reklam borsaları / SSP
    "adnxs.com",
    "amazon-adsystem.com",
    "criteo.com",
    "criteo.net",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "casalemedia.com",
    "3lift.com",
    "sharethrough.com",
    "adform.net",
    "smartadserver.com",
    "adsrvr.org",
    "bidswitch.net",
    "yieldmo.com",
    "teads.tv",
    "media.net",
    "zedo.com",
    "rlcdn.com",
    // İçerik-önerici reklamlar
    "taboola.com",
    "outbrain.com",
    // Analitik / izleyici
    "scorecardresearch.com",
    "quantserve.com",
    "quantcount.com",
    "moatads.com",
    "adroll.com",
    "bounceexchange.com",
    "hotjar.com",
    "mixpanel.com",
    "segment.io",
    "fullstory.com",
    "mouseflow.com",
    "chartbeat.com",
    "parsely.com",
    // Sosyal izleyiciler (siteyi değil, yalnız izleme uçlarını)
    "ads-twitter.com",
    "bat.bing.com",
    "connect.facebook.net",
    "facebook.com/tr",
    // Mobil/oyun reklam ağları (bazı web SDK'ları)
    "applovin.com",
    "adcolony.com",
    "inmobi.com",
];

/// WebKit içerik-engelleyici JSON'u üretir: her domain için bir `block` kuralı.
/// Nokta karakterleri regex için kaçışlanır (JSON için çift ters-bölü).
fn rules_json() -> String {
    let mut s = String::with_capacity(AD_DOMAINS.len() * 96 + 2);
    s.push('[');
    for (i, d) in AD_DOMAINS.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        let pat = d.replace('.', "\\\\.");
        s.push_str(&format!(
            r#"{{"trigger":{{"url-filter":"{pat}","url-filter-is-case-sensitive":false}},"action":{{"type":"block"}}}}"#
        ));
    }
    s.push(']');
    s
}

/// `controller_ptr`: `PlatformWebview::controller()` — WKUserContentController*.
/// Ana thread'de çağrılmalı. Hata durumunda sessizce (log'layarak) çıkar; adblock
/// başarısız olsa bile Web modu çalışmaya devam eder.
pub fn apply(controller_ptr: *mut c_void) {
    if controller_ptr.is_null() {
        return;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("[adblock] not on main thread — skipped");
        return;
    };
    // wry'nin sahip olduğu controller; retain ile ömrünü completion bloğu boyunca uzat.
    let controller: Retained<WKUserContentController> =
        match unsafe { Retained::retain(controller_ptr as *mut WKUserContentController) } {
            Some(c) => c,
            None => return,
        };
    let Some(store) = (unsafe { WKContentRuleListStore::defaultStore(mtm) }) else {
        eprintln!("[adblock] could not get defaultStore");
        return;
    };

    let ident = NSString::from_str(IDENTIFIER);
    let json = NSString::from_str(&rules_json());

    let handler = RcBlock::new(move |list: *mut WKContentRuleList, err: *mut NSError| {
        if !list.is_null() {
            let list_ref: &WKContentRuleList = unsafe { &*list };
            unsafe { controller.addContentRuleList(list_ref) };
        } else if !err.is_null() {
            let e: &NSError = unsafe { &*err };
            eprintln!("[adblock] rule compile error: {}", e.localizedDescription());
        }
    });

    unsafe {
        store.compileContentRuleListForIdentifier_encodedContentRuleList_completionHandler(
            Some(&ident),
            Some(&json),
            Some(&handler),
        );
    }
}
