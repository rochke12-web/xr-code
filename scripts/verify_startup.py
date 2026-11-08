import asyncio, json
from playwright.async_api import async_playwright

F = "file:///home/z/my-project/download/xr-code.html"
MOCK = {
    "id": "c1", "object": "chat.completion", "created": 1, "model": "glm-4.6",
    "choices": [{"index": 0, "message": {"role": "assistant", "content": "STARTUP LIVE Z.AI REPLY OK"}, "finish_reason": "stop"}],
    "usage": {"prompt_tokens": 1, "completion_tokens": 1}
}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE-ERR: " + m.text) if m.type == "error" else None)

        async def mock_zai(route):
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK))
        await pg.route("**/api/paas/v4/chat/completions", mock_zai)

        ok = lambda name, cond: print(("PASS " if cond else "FAIL ") + name)

        # fresh context = no saved key
        await pg.goto(F, wait_until="networkidle")
        await pg.evaluate("localStorage.clear()")
        await pg.reload(wait_until="networkidle")
        await pg.wait_for_timeout(700)

        # 1. modal shows on open
        vis = await pg.is_visible("#startModal.open")
        ok("startup modal open on first visit", vis)
        ok("title", "Select a model to start" in (await pg.text_content(".startup h2")))
        cards = await pg.eval_on_selector_all("#stBody .st-card", "els => els.map(e => e.textContent)")
        ok("only Z.ai card", len(cards) == 1 and "Z.ai" in cards[0])
        await pg.screenshot(path="/tmp/shots/s1-modal-step1.png")

        # 2. click Z.ai -> step 2 (key page redirect link + key input)
        await pg.click("#stBody .st-card")
        await pg.wait_for_timeout(300)
        href = await pg.get_attribute("#stBody .st-open", "href")
        tgt = await pg.get_attribute("#stBody .st-open", "target")
        ok("redirect link", href == "https://z.ai/manage-apikey/apikey-list" and tgt == "_blank")
        ok("key input present", (await pg.query_selector("#stKey")) is not None)
        await pg.screenshot(path="/tmp/shots/s2-modal-step2.png")

        # 3. enter key -> start
        await pg.fill("#stKey", "sk-startup-test-key")
        await pg.click("#stBody .st-go-btn")
        await pg.wait_for_timeout(500)
        ok("modal closed", not (await pg.is_visible("#startModal.open")))
        ok("zaiToggle Connected", (await pg.text_content("#zaiToggle")).strip() == "Connected")
        stored = await pg.evaluate("() => JSON.parse(localStorage.getItem('xrcode.v1')).zaiKey")
        ok("key stored", stored == "sk-startup-test-key")

        # 4. live reply via composer (mocked api)
        await pg.click("#btnSearch"); await pg.wait_for_timeout(300)
        await pg.fill("#chatInput", "hello from startup flow")
        await pg.press("#chatInput", "Enter")
        await pg.wait_for_timeout(2500)
        bubbles = await pg.eval_on_selector_all(".msg .bubble", "els => els.map(e => e.textContent)")
        ok("live reply rendered", any("STARTUP LIVE Z.AI REPLY OK" in m for m in bubbles))

        # 5. reload with key -> modal must NOT show
        await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(700)
        ok("no modal when key connected", not (await pg.is_visible("#startModal.open")))

        # 6. clear key -> modal returns; skip works
        await pg.evaluate("localStorage.clear()")
        await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(700)
        ok("modal returns without key", await pg.is_visible("#startModal.open"))
        await pg.click("#stBody .st-skip")
        await pg.wait_for_timeout(300)
        ok("skip closes modal", not (await pg.is_visible("#startModal.open")))
        st = await pg.text_content("#stConn")
        ok("still demo mode after skip", "demo" in st.lower())

        ok("zero JS errors", not errs)
        for e in errs[:5]: print("  " + e)
        await b.close()

asyncio.run(main())
