# Verify the DEPLOYED app (Next.js iframe loader at localhost:3000 -> preview link)
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append('page: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:3000', wait_until='networkidle')
    pg.wait_for_timeout(1500)

    frame = pg.frames[-1] if len(pg.frames) > 1 else pg.main_frame
    title = frame.evaluate("document.getElementById('brandTitle') ? document.getElementById('brandTitle').textContent : 'NO APP'")

    # golden path inside the deployed iframe: login -> connect Z.ai -> chat
    frame.evaluate("login('google')"); pg.wait_for_timeout(200)
    frame.click('#zaiToggle'); pg.wait_for_timeout(100)
    frame.fill('#zaiKey', 'sk-TESTKEY'); pg.wait_for_timeout(100)
    frame.evaluate("document.getElementById('zaiForm').dispatchEvent(new Event('submit'))"); pg.wait_for_timeout(200)
    frame.fill('#homeInput', 'Debug this: my JavaScript function returns undefined instead of the fetched data')
    frame.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
    pg.wait_for_timeout(2800)
    chip = frame.text_content('#chatModelChip')
    zbtn = frame.text_content('#zaiToggle')

    pg.screenshot(path='/tmp/render/deployed-dark.png')
    frame.evaluate("setTheme('light')"); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/render/deployed-light.png')

    print('app loaded in iframe:', title)
    print('z.ai button:', zbtn.strip(), '| chip after debug msg:', chip.strip())
    print('JS errors:', errs if errs else 'none')
    b.close()
