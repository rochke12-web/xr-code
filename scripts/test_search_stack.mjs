// Isolated validation of the route's search stack (mirrors route.ts exactly):
// googleNews + duckWeb merge, hosted fallback trigger, withSources output.
const SEARCH_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}
function stripTags(s) { return decodeEntities(String(s).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(); }
async function fetchPage(url, ms) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": SEARCH_UA, "Accept-Language": "en-US,en;q=0.9" } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}
async function googleNews(q) {
  const xml = await fetchPage(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, 9000);
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
  let html = null;
  for (let i = 0; i < 2 && !html; i++) html = await fetchPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 8000);
  if (!html) return [];
  const out = [];
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snips = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map(m2 => stripTags(m2[1]));
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
async function googleSearch(q) {
  const [news, web] = await Promise.all([googleNews(q), duckWeb(q)]);
  const seen = new Set(); const merged = [];
  for (const it of [...news, ...web]) {
    const key = it.url.replace(/[?#].*$/, "").toLowerCase();
    if (!it.url || seen.has(key)) continue;
    seen.add(key); merged.push(it);
    if (merged.length >= 8) break;
  }
  return { merged, newsN: news.length, webN: web.length };
}
function withSources(text, items) {
  const clean = text.replace(/\n+Sources?:[\s\S]*$/i, "").trimEnd();
  const links = items.slice(0, 3).map((it, i) => `${i + 1}. ${it.url}`).join("\n");
  return `${clean}\n\nSources:\n${links}`;
}

for (const q of process.argv.slice(2).length ? process.argv.slice(2) : ["Who is the president of France right now?", "What is the capital of Australia?"]) {
  const t0 = Date.now();
  const { merged, newsN, webN } = await googleSearch(q);
  console.log(`Q: ${q}`);
  console.log(`   google-news=${newsN} duck-web=${webN} merged=${merged.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  for (const it of merged.slice(0, 3)) console.log(`   • ${it.name.slice(0, 65)} | ${it.url.slice(0, 70)}`);
  console.log("   withSources sample:");
  console.log(withSources("Canberra is the capital of Australia.", merged).split("\n").map(l => "     " + l).join("\n"));
}
