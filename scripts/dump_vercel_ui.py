# Dump the live UI state inside the app iframe on xr-code.vercel.app
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("https://xr-code.vercel.app/", wait_until="networkidle")
        await pg.wait_for_timeout(5000)
        print("frames:", len(pg.frames))
        for i, f in enumerate(pg.frames):
            try:
                txt = await f.eval_on_selector("body", "e => e.innerText.slice(0, 700)")
                print(f"--- frame {i} ({f.url[:60]}) text:")
                print(txt.replace("\n", " | ")[:700])
                n = await f.eval_on_selector_all("textarea, input, [contenteditable]", "els => els.length")
                print("inputs:", n)
            except Exception as e:
                print(f"--- frame {i}: err {str(e)[:100]}")
        await b.close()

asyncio.run(main())
