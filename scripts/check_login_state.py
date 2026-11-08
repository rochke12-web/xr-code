import asyncio
from playwright.async_api import async_playwright

URL = "https://preview-chat-caecb24c-b927-48e1-93b7-2fa2e52b34a9.space-z.ai/"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(1500)
        fr = pg.frames[-1]
        box = await fr.query_selector("#loginBox")
        vis = await box.is_visible() if box else False
        gbtn = await fr.query_selector("#loginGoogle")
        gvis = await gbtn.is_visible() if gbtn else False
        txt = (await gbtn.inner_text()) if gbtn else "MISSING"
        # what happens when clicked today
        await fr.click("#loginGoogle")
        await pg.wait_for_timeout(600)
        modal = await fr.query_selector("#gModal")
        modal_vis = await modal.is_visible() if modal else False
        user = await fr.evaluate("() => JSON.parse(localStorage.getItem('xrcode.v1')).user")
        print("loginBox visible:", vis)
        print("google btn visible:", gvis, "| text:", " ".join(txt.split()))
        print("modal after click:", modal_vis)
        print("user after click:", user)
        print("JS errors:", errs or "none")
        await b.close()

asyncio.run(main())
