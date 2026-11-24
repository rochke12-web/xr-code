// Test the QnA verbatim pipeline: googleSearch (Google News RSS + DDG + hosted)
// and the verbatim formatter — same logic as chat/route.ts.
import https from "https";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const fetchPage = (url, ms) => new Promise((resolve) => {
  const req = https.get(url, { headers: { "user-agent": UA }, timeout: ms }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      return resolve(fetchPage(new URL(res.headers.location, url).toString(), ms));
    }
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => resolve(d));
  });
  req.on("timeout", () => { req.destroy(); resolve(null); });
  req.on("error", () => resolve(null));
});
const stripTags = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").trim();

async function googleNews(q) {
  const xml = await fetchPage(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, 7000);
  if (!xml) return [];
  const out = [];
  for (const chunk of xml.split("<item>").slice(1, 9)) {
    const name = stripTags(chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const url = (chunk.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    const date = (chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    if (!name || !url) continue;
    out.push({ name, snippet: name, url, date: date ? date.slice(5, 16) : undefined });
  }
  return out;
}
async function duckWeb(q) {
  const html = await fetchPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 7000);
  if (!html) return [];
  const out = [];
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snips = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m2) => stripTags(m2[1]));
  let m;
  while ((m = re.exec(html)) && out.length < 8) {
    let url = m[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) { try { url = decodeURIComponent(uddg[1]); } catch {} }
    const name = stripTags(m[2]);
    if (!name || !/^https?:\/\//.test(url) || /duckduckgo\.com/.test(url)) continue;
    out.push({ name, snippet: snips[out.length] || name, url });
  }
  return out;
}

const q = process.argv[2] || "price of gold today";
const t = Date.now();
const [news, web] = await Promise.all([googleNews(q), duckWeb(q)]);
console.log(`googleNews: ${news.length} items, duckWeb: ${web.length} items, ${Date.now() - t}ms`);
const items = [...news, ...web].slice(0, 5);
for (const it of items) console.log(`- ${it.name.slice(0, 90)}\n  ${String(it.snippet).slice(0, 140)}\n  ${it.url.slice(0, 80)} ${it.date || ""}`);
// verbatim output exactly as googleVerbatim builds it
if (items.length) {
  const it = items[0];
  const more = items.slice(1, 4).map((r, i) => `${i + 2}. ${r.name}\n   ${String(r.snippet || "").trim().slice(0, 280)}\n   ${r.url}`).join("\n\n");
  console.log("\n===== VERBATIM QnA ANSWER =====\n");
  console.log(`Google's answer to "${q}" — straight from the top result:\n\n${it.name}\n${String(it.snippet || "").trim()}\n${it.url}${it.date ? ` (${it.date})` : ""}${more ? `\n\nMore from Google:\n\n${more}` : ""}`);
} else console.log("NO RESULTS — search path broken!");
