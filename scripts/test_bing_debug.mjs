// Debug bing fetch + ck/a link unwrapping
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const q = process.argv[2] || "what is the capital of australia";
const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10&setlang=en`, {
  headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9", "Cookie": "SRCHHPGUSR=SRCHLANG=en" },
  redirect: "follow",
});
const html = await res.text();
console.log("status", res.status, "size", html.length, "| b_algo count:", (html.match(/class="b_algo"/g) || []).length);

function unwrapBing(url) {
  if (!url.includes("bing.com/ck/")) return url;
  const m = url.match(/[?&]u=a1([^&]+)/);
  if (!m) return url;
  try {
    let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const dec = Buffer.from(b64, "base64").toString("utf8");
    return /^https?:\/\//.test(dec) ? dec : url;
  } catch { return url; }
}

const re = /<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
let m, n = 0;
while ((m = re.exec(html)) && n < 6) {
  const raw = m[1];
  const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  console.log(`  h2: ${title.slice(0, 60)} | ${unwrapBing(raw).slice(0, 80)}`);
  n++;
}
if (n === 0) console.log("  h2 regex 0 — sample:", html.slice(html.indexOf("b_algo"), html.indexOf("b_algo") + 300));
