import ZAI from "z-ai-web-dev-sdk";
// quality probe of the hosted web_search for general-web (non-news) queries
const zai = await ZAI.create();
for (const q of ["what is the capital of australia", "best way to learn rust programming", "who is the president of france"]) {
  try {
    const res = await Promise.race([
      zai.functions.invoke("web_search", { query: q, num: 8 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 15s")), 15000)),
    ]);
    const items = (Array.isArray(res) ? res : []).slice(0, 4);
    console.log(`Q: ${q} -> ${items.length} items`);
    for (const it of items) console.log(`   • ${String(it.name || "").slice(0, 70)} | ${String(it.url || "").slice(0, 60)}`);
  } catch (e) {
    console.log(`Q: ${q} -> FAIL ${String(e?.message || e).slice(0, 80)}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}
