// Try decoding Google News RSS article IDs (CBMi... / AU_yq...) to real publisher URLs.
const ids = [
  "CBMiYkFVX3lxTE8yU3NpeElnNzlSckkzbmg2TDdBOXNiMDN5SC1CTENRdmxiM3RhZEZDNkdhdGFRekVMLTBuRlN4aVRhTDJiY2xWeTZUSS14bFBfNnh0VVJvdUFSR3lBV2t0V1pR",
  "CBMiowFBVV95cUxQMlktZnpoWS1Hc3NvS2N0TDFQdm5aYU52MjJncHE3ZGpwbFYzRlEzbjdwV1pTSTU3dXJaUDlrbV80elk2SXQxSXN1VEdXNTlnQm1Samh5ZmstdlNxX19hNzNOaUtyNU1mMThwSnJVMWY0TEIyMU8tckp2Y29mY2RzLUdfb1VjTnZiSWdIMmRQR1pseWpWOWZxTFJRVUhodXBZNnFj",
];

function tryDecode(id) {
  let b64 = id.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const buf = Buffer.from(b64, "base64");
  const txt = buf.toString("latin1");
  // direct URL in the decoded bytes?
  const direct = txt.match(/https?:\/\/[^\x00-\x1f"\\]+/);
  if (direct) return { kind: "direct", url: direct[0] };
  // nested base64 blob (AU_yq...) — find printable runs and decode each
  const runs = txt.match(/[A-Za-z0-9+/_-]{16,}/g) || [];
  for (const run of runs) {
    let r = run.replace(/-/g, "+").replace(/_/g, "/");
    while (r.length % 4) r += "=";
    try {
      const inner = Buffer.from(r, "base64").toString("latin1");
      const u = inner.match(/https?:\/\/[^\x00-\x1f"\\]+/);
      if (u) return { kind: "nested", url: u[0], via: run.slice(0, 12) };
    } catch {}
  }
  return { kind: "fail", preview: txt.slice(0, 120) };
}

for (const id of ids) {
  console.log(tryDecode(id));
}

// live check: does the news.google.com/rss/articles/<id>?oc=5 link actually redirect?
const res = await fetch(`https://news.google.com/rss/articles/${ids[0]}?oc=5`, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
console.log("live follow ->", res.url.slice(0, 100), "| status", res.status);
