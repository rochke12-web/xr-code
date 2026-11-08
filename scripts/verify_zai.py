import asyncio, json
from playwright.async_api import async_playwright

F = "file:///home/z/my-project/download/xr-code.html"
SHOTS = "/tmp/shots"
import os; os.makedirs(SHOTS, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE-ERR: " + m.text) if m.type == "error" else None)

        # mock Z.ai OpenAI-compatible endpoint BEFORE load
        async def mock_zai(route):
            body = json.dumps({
                "id": "chatcmpl-mock", "object": "chat.completion", "created": 1,
                "model": "glm-4.6",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "LIVE Z.AI REPLY — GLM-4.6 says hello. Ask me to plan, code or review."}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 12}
            })
            await route.fulfill(status=200, content_type="application/json", body=body)
        await pg.route("**/api/paas/v4/chat/completions", mock_zai)

        await pg.goto(F, wait_until="networkidle")
        await pg.wait_for_timeout(700)

        ok = lambda name, cond: print(("PASS " if cond else "FAIL ") + name)

        # 1. sidebar structure
        ok("AI Models box present", await pg.query_selector("#modelBox") is not None)
        ok("old login box gone", await pg.query_selector("#loginBox") is None)
        ok("google btn gone", await pg.query_selector("#loginGoogle") is None)
        ok("gemini toggle gone", await pg.query_selector("#gemToggle") is None)
        ok("zai toggle present", (await pg.query_selector("#zaiToggle")) is not None)
        h3 = await pg.text_content("#modelBox h3")
        ok("box title = AI Models", h3.strip() == "AI Models")
        zline = await pg.text_content("#zaiLine")
        ok("demo mode line", "Demo mode" in zline)
        st = await pg.text_content("#stConn")
        ok("status: not connected", "Z.ai not connected" in st)
        await pg.screenshot(path=f"{SHOTS}/z1-home-dark.png")

        # 2. composer enabled, demo reply without key
        await pg.click("#btnSearch")   # open chat view
        await pg.wait_for_timeout(500)
        inp = await pg.query_selector("#chatInput")
        ok("composer enabled", not (await inp.is_disabled()))
        await pg.fill("#chatInput", "give me ideas for a weekend project")
        await pg.click("#chatForm button[type=submit], #chatSend") if False else await pg.press("#chatInput", "Enter")
        await pg.wait_for_timeout(3500)
        chips = await pg.eval_on_selector_all(".chip", "els => els.map(e => e.textContent)")
        ok("demo chip engine XR Core", any("XR Core" in c and "demo" in c for c in chips))
        toasts = await pg.eval_on_selector_all(".toast", "els => els.map(e => e.textContent)")
        ok("demo nudge toast", any("Demo mode" in t for t in toasts))

        # 3. connect Z.ai (mocked network later verifies real fetch path)
        await pg.click("#zaiToggle")
        await pg.fill("#zaiKey", "sk-test-1234567890")
        await pg.click("#zaiForm .api-connect")
        await pg.wait_for_timeout(500)
        tog = (await pg.text_content("#zaiToggle")).strip()
        ok("zaiToggle says Connected", tog == "Connected")
        zline = await pg.text_content("#zaiLine")
        ok("live line", "GLM-4.6 live" in zline)
        st = await pg.text_content("#stConn")
        ok("status: connected", "Z.ai connected · GLM-4.6" in st)

        # 4. live reply via mocked API
        await pg.fill("#chatInput", "now run with the real engine")
        await pg.press("#chatInput", "Enter")
        await pg.wait_for_timeout(3000)
        msgs = await pg.eval_on_selector_all(".msg .bubble", "els => els.map(e => e.textContent)")
        ok("LIVE Z.ai reply rendered", any("LIVE Z.AI REPLY" in m for m in msgs))
        chips = await pg.eval_on_selector_all(".chip", "els => els.map(e => e.textContent)")
        ok("live chip", any("GLM-4.6 · Z.ai" in c and "live" in c for c in chips))
        stored = await pg.evaluate("() => JSON.parse(localStorage.getItem('xrcode.v1')).zaiKey")
        ok("key stored locally", stored == "sk-test-1234567890")
        await pg.screenshot(path=f"{SHOTS}/z2-chat-live.png")

        # 5. settings — models panel + optional account link
        await pg.click("#btnSettings")
        await pg.wait_for_timeout(400)
        rows = await pg.eval_on_selector_all("#modelsPanel .model-row", "els => els.map(e => e.querySelector('.mn').textContent)")
        ok("models panel = Z.ai only", rows == ["GLM-4.6 · Z.ai"])
        acc = await pg.text_content("#accBox")
        ok("optional link text", "optional" in acc.lower())
        # click the Google link button inside accBox
        btns = await pg.query_selector_all("#accBox .auth-btn")
        ok("two link buttons", len(btns) == 2)
        await btns[0].click()
        await pg.wait_for_timeout(400)
        acc = await pg.text_content("#accBox")
        ok("linked google row", "YUX FF (Google)" in acc and "GLM-4.6 (Z.ai)" in acc)
        await pg.screenshot(path=f"{SHOTS}/z3-settings.png")

        # 6. light theme home
        await pg.click("#btnHome")
        await pg.emulate_media(media="screen")
        await pg.click("#themeQuick")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/z4-home-light.png")

        ok("zero JS errors", not errs)
        for e in errs[:5]: print("  " + e)
        await b.close()

asyncio.run(main())
