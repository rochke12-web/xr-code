#!/usr/bin/env python3
"""Koder AI v2 upgrade: senior-engineer answer quality + conversation-aware engine routing.
Idempotent; verifies anchors; restores from scripts/route-pre-koder2.ts.bak on request."""
import sys, shutil

F = "/home/z/my-project/src/app/api/chat/route.ts"
shutil.copy(F, "/home/z/my-project/scripts/route-pre-koder2.ts.bak")

src = open(F, encoding="utf-8").read()
if "senior engineer" in src:
    print("already patched — exit")
    sys.exit(0)

# ---------- 1. SYSTEM_KODER v2 ----------
start = src.index("const SYSTEM_KODER =")
end = src.index("const SYSTEM_QNA")
old_block = src[start:end]
assert "currently in Koder Mode" in old_block and "IDENTITY_LOCK;" in old_block, "koder block shape"

new_block = '''const SYSTEM_KODER =
  "You are XR Code, the AI of the XR-Code app by YUX FF — currently in Koder Mode, the full developer brain. " +
  "Quality bar — think like a senior engineer: " +
  "• Plan silently, answer with the polished result only. " +
  "• Code: complete, runnable, production-quality, in fenced blocks with the language tag. " +
  "Correct by default — check syntax, logic and edge cases mentally before presenting. " +
  "Modern idioms, clear names, short useful comments. " +
  "• Be proactive: if you spot a bug, risk or a clearly better approach beyond what was asked, " +
  "add ONE short line about it after the solution. " +
  "• Debugging: name the exact root cause in one or two sentences first, then the corrected code, " +
  "then a one-line why-it-works. " +
  "• Explanations: simple, accurate, step by step, one concrete example. " +
  "• Never invent APIs, libraries, flags or quotes. If unsure, say so plainly and give the closest verified answer. " +
  "• Any question (facts, knowledge, advice, current events): lead with the direct answer in the first " +
  "sentence, then a few crisp supporting facts. When live results are attached, base the reply on them — " +
  "answer the way the top result would read, with light grammar and wording changes so it is not a verbatim copy. " +
  "When LIVE WEB RESULTS are attached, use them to ground factual replies, but keep the reply clean — " +
  "do NOT add any Sources line by default. Only when the user explicitly asks for sources, references " +
  "or links, end with a final line 'Sources:' followed by up to 3 of the result URLs. " +
  `• Attachments: ${ATT_BLIND}. ` +
  DEPTH_RULES +
  IDENTITY_LOCK;

'''
src = src[:start] + new_block + src[end:]

# ---------- 2. conversation-aware engine routing ----------
old_auto = '''function autoEngine(q: string): string {
  const s = (q || "").toLowerCase();
  const heavy =
    s.length >= 140 ||
    /(code|debug|fix|error|write|build|implement|refactor|explain|analy[sz]e|compare|design|architect|why|algorithm|sql|regex)/.test(s);
  return heavy ? GLM_FLAGSHIP : GLM_QUICK;
}'''
assert old_auto in src, "autoEngine anchor missing"
new_auto = '''function autoEngine(q: string, safe: Msg[]): string {
  const s = (q || "").toLowerCase();
  const tech =
    /(code|debug|fix|error|write|build|implement|refactor|explain|analy[sz]e|compare|design|architect|why|algorithm|sql|regex)/;
  // heavy now, or the conversation is already deep in technical territory —
  // short follow-ups like "still failing" deserve the flagship too
  const deepTech = safe.slice(-6).some(
    m => m.role === "user" && (m.content.includes("```") || tech.test(m.content.slice(0, 400).toLowerCase()))
  );
  const heavy = s.length >= 140 || tech.test(s) || deepTech;
  return heavy ? GLM_FLAGSHIP : GLM_QUICK;
}'''
src = src.replace(old_auto, new_auto, 1)

old_call = 'const chosen = GLM_MODELS.has(wanted) ? wanted : autoEngine(lastUser?.content || "");'
assert old_call in src, "autoEngine call anchor missing"
src = src.replace(old_call, 'const chosen = GLM_MODELS.has(wanted) ? wanted : autoEngine(lastUser?.content || "", safe);', 1)

open(F, "w", encoding="utf-8").write(src)
print("patched: SYSTEM_KODER v2 + conversation-aware routing")
print("koder v2 marker:", "senior engineer" in src)
print("routing marker:", "deepTech" in src)
