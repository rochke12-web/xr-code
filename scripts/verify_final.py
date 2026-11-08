# Final verification: XR CODE with NO api/model UI — hosted brain only
import asyncio, json
from playwright.async_api import async_playwright

URL = "https://preview-chat-caecb24c-b927-48e1-93b7-2fa2e52b34a9.space-z.ai/"
FILE = "file:///home/z/my-project/download/xr-code.html"

ok = lambda name, cond: print(("PASS " if cond else "FAIL ") + name)

async def no_model_ui(fr, tag):
    ok(f"[{tag}] no AI Models box", (await fr.query_selector("#modelBox")) is None)
    ok(f"[{tag}] no startup modal at all", (await fr.query_selector("#startModal")) is None)
    ok(f"[{tag}] no key form", (await fr.query_selector("#zaiForm")) is None)
    ok(f"[{tag}] no connect-key button", (await fr.query_selector("#zaiToggle")) is None)
    html = await fr.content()
    ok(f"[{tag}] zero Z.ai copy", "Z.ai" not in html and "GLM" not in html)
    ok(f"[{tag}] zero 'API key' copy", "API key" not in html and "Connect key" not in html)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------- deployed: desktop ----------
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append("page: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(2500)
        fr = pg.frames[-1]
        await no_model_ui(fr, "deployed")

        st = await fr.text_content("#stConn")
        ok("deployed: status AI online", "AI online" in st)
        chip = await fr.text_content("#chatModelChip")
        ok("deployed: chip engine live", "engine: live" in chip)

        # real hosted brain answer
        await fr.fill("#homeInput", "Reply with exactly: XR LIVE REPLY OK")
        await fr.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
        reply = ""
        for _ in range(40):
            await pg.wait_for_timeout(1500)
            bubbles = await fr.eval_on_selector_all(".msg .bubble", "els => els.map(e => e.textContent)")
            reply = " ".join(bubbles)
            if "XR LIVE REPLY OK" in reply or "unreachable" in reply:
                break
        ok("deployed: real hosted AI reply", "XR LIVE REPLY OK" in reply)
        chip = await fr.text_content("#chatModelChip")
        ok("deployed: chip stays live", "engine: live" in chip)
        ls = await fr.evaluate("JSON.parse(localStorage.getItem('xrcode.v1') || '{}')")
        ok("deployed: no key in localStorage", "zaiKey" not in ls and "apiKey" not in json.dumps(ls))
        await pg.screenshot(path="/tmp/render/final-desktop.png")

        # settings: engine panel + routing gone, theme + account stay
        await fr.click("#btnSettings")
        await pg.wait_for_timeout(400)
        sh = await fr.content()
        ok("settings: no AI Engine panel", "AI Engine" not in sh and "Smart routing" not in sh)
        ok("settings: no token stat", "tokens saved" not in sh)
        ok("settings: theme panel stays", "Theme" in sh)
        ok("settings: account panel stays", "Chats &amp; Account" in sh or "Chats & Account" in sh)
        acc = await fr.text_content("#accBox")
        ok("settings: account engine text", "XR CODE AI (live)" in acc)
        await pg.screenshot(path="/tmp/render/final-settings.png")

        # ---------- deployed: SECOND visitor (fresh context) ----------
        pg2 = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg2.goto(URL, wait_until="networkidle")
        await pg2.wait_for_timeout(2000)
        fr2 = pg2.frames[-1]
        await no_model_ui(fr2, "second-visitor")
        st2 = await fr2.text_content("#stConn")
        ok("second visitor: AI online instantly", "AI online" in st2)
        await pg2.close()

        # ---------- deployed: mobile ----------
        mob = await b.new_page(viewport={"width": 390, "height": 844})
        await mob.goto(URL, wait_until="networkidle")
        await mob.wait_for_timeout(2000)
        fm = mob.frames[-1]
        await no_model_ui(fm, "mobile")
        await mob.screenshot(path="/tmp/render/final-mobile.png")
        await mob.close()

        await pg.close()

        # ---------- local file:// preview: demo fallback ----------
        fl = await b.new_page(viewport={"width": 1280, "height": 800})
        ferrs = []
        fl.on("pageerror", lambda e: ferrs.append(str(e)))
        await fl.goto(FILE)
        await fl.wait_for_timeout(1200)
        ffr = fl.frames[0] if fl.frames else fl
        ok("file://: no model UI", (await ffr.query_selector("#modelBox")) is None
           and (await ffr.query_selector("#startModal")) is None)
        st3 = await ffr.text_content("#stConn")
        ok("file://: demo brain status", "AI offline" in st3 or "connecting" in st3)
        await ffr.fill("#homeInput", "give me ideas")
        await ffr.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
        await fl.wait_for_timeout(3500)
        bubbles = await ffr.eval_on_selector_all(".msg .bubble", "els => els.map(e => e.textContent)")
        ok("file://: demo reply rendered", len(bubbles) >= 2)
        chip3 = await ffr.text_content("#chatModelChip")
        ok("file://: chip demo", "engine: demo" in chip3)
        ok("file://: zero JS errors", not ferrs)
        await fl.close()

        ok("deployed: zero JS errors", not errs)
        for e in errs[:5]: print("  " + e)
        await b.close()

asyncio.run(main())
