// Tarih biçimlendirme (Türkçe). publishedAt = unix saniye (null olabilir).
const short = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function fmtShort(ts: number | null): string {
  if (!ts) return "";
  return short.format(new Date(ts * 1000));
}

export function fmtLong(ts: number | null): string {
  if (!ts) return "";
  return long.format(new Date(ts * 1000));
}
