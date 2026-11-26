# Reproduce the real browser flow on xr-code.vercel.app: load app, send a
# chat message as guest, capture every network response + the status chip.
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "https://xr-code.vercel.app/"
LOG = []

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("console", lambda m: LOG.append(("console-" + m.type, m.text[:160])))
        async def log_resp(r):
            u = r.url
            if "/api/" in u:
                body = ""
                try:
                    body = (await r.text())[:150]
                except Exception:
                    body = "<no body>"
                LOG.append(("resp", f"{r.status} {u} :: {body}"))
        pg.on("response", log_resp)
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(5000)
        # the guest gate lives on the OUTER page (frame 0) — click it there first
        try:
            g = await pg.wait_for_selector("text=Continue as guest", timeout=6000)
            await g.click()
            await pg.wait_for_timeout(3000)
            LOG.append(("gate", "clicked continue-as-guest (outer)"))
        except Exception:
            LOG.append(("gate", "no outer gate visible"))
        fr = next((f for f in pg.frames if f.url == "about:srcdoc" and "#modelBox" in (f.name or "")), None)
        if fr is None:
            for f in pg.frames:
                try:
                    if await f.query_selector("#modelBox"):
                        fr = f
                        break
                except Exception:
                    pass
        if fr is None:
            fr = pg.frames[1] if len(pg.frames) > 1 else pg.frames[-1]
        LOG.append(("frame", "using frame: " + (fr.url or fr.name or "?")))
        # guest gate: click "Continue as guest" if present
        try:
            g = await fr.wait_for_selector("text=Continue as guest", timeout=5000)
            await g.click()
            await pg.wait_for_timeout(2500)
            LOG.append(("gate", "clicked continue-as-guest"))
        except Exception:
            LOG.append(("gate", "no guest gate visible"))
        # find the input + send
        box = None
        for sel in ["#modelBox input", "#modelBox textarea", "#input", "textarea", "[contenteditable=true]", "input[type=text]"]:
            try:
                box = await fr.wait_for_selector(sel, timeout=3000)
                if box: break
            except Exception:
                pass
        LOG.append(("frame", "input found: " + str(bool(box))))
        if box:
            await box.click()
            await box.type("hello")
            await pg.wait_for_timeout(500)
            await box.press("Enter")
            LOG.append(("send", "pressed Enter"))
            await pg.wait_for_timeout(25000)
            # capture the status chip text
            try:
                chips = await fr.eval_on_selector_all("[class*=chip], [id*=chip]", "els => els.map(e => e.textContent)")
                LOG.append(("chip", str(chips)))
            except Exception as e:
                LOG.append(("chip", "err " + str(e)))
            try:
                body_text = await fr.eval_on_selector("body", "e => e.innerText.slice(0, 600)")
                LOG.append(("body", body_text.replace("\n", " | ")[:600]))
            except Exception:
                pass
        await b.close()
    for kind, msg in LOG:
        print(f"[{kind}] {msg}")

asyncio.run(main())
