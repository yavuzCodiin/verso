//! Local-first senkron iskeleti — README §4.
//! v1'de tek makine: her varlıkta `updated_at`/`deleted` alanları ve `operation_log`
//! tablosu şema düzeyinde hazır; replikasyon (v2) bunun üstüne binecek.
//! UI bu ayrımı bilmez — daima yerel DB'den okur.
