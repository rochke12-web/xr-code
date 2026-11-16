#!/usr/bin/env python3
"""Visual QA: does the app still render through /api/shell?"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.goto("http://localhost:3000", wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(3000)
    frame = None
    for f in pg.frames:
        if f != pg.main_frame and "XR-Code" in (f.url or "about:srcdoc"):
            frame = f
    if frame is None:
        # srcdoc frames show url about:srcdoc — find by content instead
        for f in pg.frames:
            try:
                if f.locator("text=XR-Code").count() > 0:
                    frame = f
                    break
            except Exception:
                pass
    assert frame, "app iframe not found"
    body = frame.locator("body").inner_text(timeout=10000)
    has_search = frame.locator(".big-search, #chatInput, textarea").count() > 0
    print("iframe body chars:", len(body))
    print("input present:", has_search)
    print("mode picker director:", frame.locator("text=Director Mode").count() > 0)
    pg.screenshot(path="/tmp/render/shell-dark.png")
    print("screenshot saved")
    b.close()
