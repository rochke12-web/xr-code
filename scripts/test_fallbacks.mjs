// test bing RSS + ddg html as general-web fallbacks
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const q = process.argv[2] || "what is the capital of australia";

async function get(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
    if (!res.ok) return { err: res.status };
    return { text: await res.text() };
  } catch (e) { return { err: String(e).slice(0, 60) }; }
}

const strip = s => String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const bing = await get(`https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&count=10`);
if (bing.text) {
  const items = bing.text.split("<item>").slice(1, 6).map(c => ({
    title: strip(c.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""),
    link: (c.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim(),
    desc: strip(c.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "").slice(0, 120),
  }));
  console.log(`BING RSS: ${items.length} items (${bing.text.length}B)`);
  for (const it of items) console.log(`  • ${it.title.slice(0, 65)} | ${it.link.slice(0, 65)} | ${it.desc.slice(0, 50)}`);
} else console.log("BING RSS: fail", bing.err);

const ddg = await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
if (ddg.text) {
  const n = (ddg.text.match(/result__a/g) || []).length;
  console.log(`DDG HTML: ${ddg.text.length}B, result links: ${n}`);
  const m = ddg.text.match(/result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (m) console.log("  first:", strip(m[2]).slice(0, 60), "|", m[1].slice(0, 80));
} else console.log("DDG HTML: fail", ddg.err);
