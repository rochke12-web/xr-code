#!/usr/bin/env python3
"""sight_server.py — add Sight Mode brain to the chat API:
- accepts mode 'sight' from the client
- SYSTEM_SIGHT: visual by default — described scenes become real photos/videos,
  attachments get deep vision analysis; non-visual asks stay brief
Edits src/app/api/chat/route.ts in place. Idempotent.
"""
import os, shutil, sys

F    = "/home/z/my-project/src/app/api/chat/route.ts"
SNAP = "/home/z/my-project/scripts/route-pre-sight.ts.bak"

src = open(F, encoding="utf-8").read()

if "SYSTEM_SIGHT" in src:
    print("already patched — nothing to do")
    sys.exit(0)

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    if n != count:
        fails.append(f"[{tag}] anchor found {n}x (expected {count}): {old[:80]!r}")
        return
    src = src.replace(old, new)

# ---------- 1. SYSTEM_SIGHT prompt (right after SYSTEM_QNA) ----------
rep("  \"• Code only when the user explicitly asks for it. \" +\n"
    "  DEPTH_RULES +\n"
    "  IDENTITY_LOCK;\n"
    "\n"
    "// creation tool — the brain can build real images & videos on demand",
    "  \"• Code only when the user explicitly asks for it. \" +\n"
    "  DEPTH_RULES +\n"
    "  IDENTITY_LOCK;\n"
    "\n"
    "// ---- SIGHT MODE — the photo & video AI ----\n"
    "const SYSTEM_SIGHT =\n"
    "  \"You are XR Code, the AI of the XR-Code app by YUX FF — currently in Sight Mode: the photo & video AI. \" +\n"
    "  \"Core behavior: \" +\n"
    "  \"• Visual by default: whenever the user describes, imagines or asks for anything visual — a scene, person, place, object, \" +\n"
    "  \"style, poster, logo, wallpaper, icon, clip or animation — treat it as a creation request and reply with ONLY the matching \" +\n"
    "  \"action JSON (see TOOL DIRECTIVES below), even when they never say 'generate', 'make' or 'create'. \" +\n"
    "  \"• Choose the medium: a still moment, poster, logo, wallpaper or scene → image action; motion, action, story or the words \" +\n"
    "  \"video/clip/animation → video action. Pick the size that fits the scene (square, portrait, landscape). \" +\n"
    "  \"• Enrich silently: add tasteful detail — lighting, mood, color palette, composition, camera feel — to the user's idea \" +\n"
    "  \"inside the action prompt, keeping their subject and intent intact. \" +\n"
    "  \"• Clearly non-visual requests (facts, code, advice, how-to, chat): answer in one or two crisp sentences, then offer one \" +\n"
    "  \"short line to visualize it. Never emit action JSON for those. \" +\n"
    "  \"• Photos and videos the user attaches: describe what you SEE in rich detail — subjects, text, colors, mood, motion — \" +\n"
    "  \"and answer any question about them directly. \" +\n"
    "  DEPTH_RULES +\n"
    "  IDENTITY_LOCK;\n"
    "\n"
    "// creation tool — the brain can build real images & videos on demand",
    "system-sight")

# ---------- 2. mode parse + prompt selection ----------
rep("  const mode = modeRaw === \"qna\" ? \"qna\" : \"koder\";\n"
    "  let sys = (mode === \"qna\" ? SYSTEM_QNA : SYSTEM_KODER) + TOOL_RULES;",
    "  const mode = modeRaw === \"qna\" || modeRaw === \"sight\" ? modeRaw : \"koder\";\n"
    "  let sys = (mode === \"qna\" ? SYSTEM_QNA : mode === \"sight\" ? SYSTEM_SIGHT : SYSTEM_KODER) + TOOL_RULES;",
    "mode-parse")

if fails:
    print("FAILED ANCHORS:")
    for f in fails: print("  " + f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)
print("OK — Sight Mode brain added:", len(src), "bytes")
