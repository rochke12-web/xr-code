# Verify the DEPLOYED app (preview URL, Next.js iframe loader) — Z.ai-only flow
import asyncio, json
from playwright.async_api import async_playwright

URL = "https://preview-chat-caecb24c-b927-48e1-93b7-2fa2e52b34a9.space-z.ai/"

MOCK = {
    "id": "chatcmpl-mock", "object": "chat.completion", "created": 1, "model": "glm-4.6",
    "choices": [{"index": 0, "message": {"role": "assistant", "content": "DEPLOYED LIVE Z.AI REPLY OK"}, "finish_reason": "stop"}],
    "usage": {"prompt_tokens": 1, "completion_tokens": 1}
}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append("page: " + str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)

        async def mock_zai(route):
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK))
        await pg.route("**/api/paas/v4/chat/completions", mock_zai)

        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(2000)
        fr = pg.frames[-1]

        ok = lambda name, cond: print(("PASS " if cond else "FAIL ") + name)
        ok("app in iframe", (await fr.query_selector("#modelBox")) is not None)
        ok("AI Models box", "AI Models" in (await (await fr.query_selector("#modelBox h3")).text_content()))
        ok("no google login btn", (await fr.query_selector("#loginGoogle")) is None)
        ok("no gemini toggle", (await fr.query_selector("#gemToggle")) is None)

        # startup gate: fresh browser -> modal must show -> click Z.ai -> enter key -> start
        ok("startup modal open", await fr.is_visible("#startModal.open"))
        ok("only Z.ai card", len(await fr.query_selector_all("#stBody .st-card")) == 1)
        await fr.click("#stBody .st-card"); await pg.wait_for_timeout(300)
        ok("redirect link", (await fr.get_attribute("#stBody .st-open", "href")) == "https://z.ai/manage-apikey/apikey-list")
        await fr.fill("#stKey", "sk-DEPLOY-TEST")
        await fr.click("#stBody .st-go-btn"); await pg.wait_for_timeout(400)
        ok("modal closed after start", not (await fr.is_visible("#startModal.open")))

        # send -> live mocked reply
        await fr.fill("#homeInput", "hello deployed engine")
        await fr.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
        await pg.wait_for_timeout(2500)
        chip = await fr.text_content("#chatModelChip")
        ok("chip live glm", "GLM-4.6 · Z.ai" in chip and "live" in chip)
        bubbles = await fr.eval_on_selector_all(".msg .bubble", "els => els.map(e => e.textContent)")
        ok("live reply rendered", any("DEPLOYED LIVE Z.AI REPLY OK" in m for m in bubbles))
        st = await fr.text_content("#stConn")
        ok("status bar", "Z.ai connected" in st)
        await pg.screenshot(path="/tmp/render/deployed-dark.png")

        # light + mobile
        await fr.evaluate("setTheme('light')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/render/deployed-light.png")
        await fr.evaluate("setTheme('dark')")
        mob = await b.new_page(viewport={"width": 390, "height": 844})
        await mob.goto(URL, wait_until="networkidle"); await mob.wait_for_timeout(1500)
        ok("mobile: startup modal shows", await mob.frames[-1].is_visible("#startModal.open"))
        await mob.screenshot(path="/tmp/render/deployed-mobile-modal.png", full_page=False)
        await mob.frames[-1].click("#stBody .st-skip"); await mob.wait_for_timeout(400)
        await mob.screenshot(path="/tmp/render/deployed-mobile.png", full_page=False)

        ok("zero JS errors", not errs)
        for e in errs[:5]: print("  " + e)
        await b.close()

asyncio.run(main())
