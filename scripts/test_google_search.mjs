// Offline test of the Google News RSS + Bing scrape parsers before wiring into route.ts
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}
function stripTags(s) { return decodeEntities(String(s).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(); }

async function fetchText(url, ms) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) { console.log("  ! http", res.status); return null; }
    return await res.text();
  } catch (e) { console.log("  ! fetch fail:", String(e).slice(0, 80)); return null; }
}

function googleNews(xml) {
  const items = [];
  for (const chunk of xml.split("<item>").slice(1, 9)) {
    const title = stripTags(chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const link = (chunk.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    const date = (chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    const source = stripTags(chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "");
    if (!title || !link) continue;
    items.push({ name: title, url: link, date: date ? date.slice(5, 16) : undefined, source });
  }
  return items;
}

function bingWeb(html) {
  const items = [];
  const re = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(html)) && items.length < 8) {
    const blk = m[1];
    const url = (blk.match(/<h2><a[^>]*href="([^"]+)"/) || blk.match(/<a[^>]*href="(https?:[^"]+)"/))?.[1];
    const name = stripTags(blk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || "");
    const snippet = stripTags(blk.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || "");
    if (!url || !name || !/^https?:/.test(url)) continue;
    if (/bing\.com|microsoft\.com\/bing|go\.microsoft/.test(url)) continue;
    items.push({ name, snippet: snippet.slice(0, 200), url });
  }
  return items;
}

const q = process.argv[2] || "president of france";
console.log("== query:", q);
const [newsXml, bingHtml] = await Promise.all([
  fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, 9000),
  fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10&setlang=en`, 9000),
]);
const news = newsXml ? googleNews(newsXml) : [];
const web = bingHtml ? bingWeb(bingHtml) : [];
console.log(`google-news: ${news.length} items`);
for (const it of news.slice(0, 4)) console.log(`  • ${it.name.slice(0, 80)} | ${it.date} | ${it.source} | ${it.url.slice(0, 60)}...`);
console.log(`bing-web: ${web.length} items`);
for (const it of web.slice(0, 4)) console.log(`  • ${it.name.slice(0, 70)} | ${it.snippet.slice(0, 60)} | ${it.url.slice(0, 60)}`);
