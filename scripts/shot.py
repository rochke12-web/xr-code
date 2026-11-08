from playwright.sync_api import sync_playwright

URL = 'file:///home/z/my-project/download/xr-code.html'

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_timeout(900)

    # 1. dark home (fresh) — new hero pill + new login box (left sidebar)
    pg.screenshot(path='/tmp/render/dark-home.png')

    # 2. chat gate while logged out
    pg.evaluate("showView('chat')")
    pg.wait_for_timeout(300)
    gate_disabled = pg.evaluate("document.getElementById('chatInput').disabled")
    pg.screenshot(path='/tmp/render/gate-chat.png')

    # 3. try to send from home without Google -> toast + login pulse
    pg.evaluate("showView('home')")
    pg.fill('#homeInput', 'Build me a todo app')
    pg.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
    pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/render/gate-toast.png')

    # 4. light theme home — strict white & black, grayscale scene + logo
    pg.evaluate("setTheme('light')")
    pg.wait_for_timeout(400)
    pg.screenshot(path='/tmp/render/light-home.png')

    # 5. login with Google, connect Gemini, chat works
    pg.evaluate("setTheme('dark'); login('google')")
    pg.wait_for_timeout(300)
    pg.click('#gemToggle')
    pg.fill('#gemKey', 'AIzaTESTKEY123')
    pg.evaluate("document.getElementById('gemForm').dispatchEvent(new Event('submit'))")
    pg.wait_for_timeout(300)
    connected = pg.evaluate("document.getElementById('gemToggle').textContent")
    pg.fill('#homeInput', 'Generate code: write a Python script that renames files')
    pg.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
    pg.wait_for_timeout(2600)
    chip = pg.evaluate("document.getElementById('chatModelChip').textContent")
    pg.screenshot(path='/tmp/render/chat-logged.png')

    # 6. light chat — black user bubble on white
    pg.evaluate("setTheme('light')")
    pg.wait_for_timeout(400)
    pg.screenshot(path='/tmp/render/chat-light.png')

    # 7. settings — AI Engine panel
    pg.evaluate("setTheme('dark'); showView('settings')")
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/render/settings.png')

    print('composer disabled while logged out:', gate_disabled)
    print('gemini button after connect:', connected)
    print('chat chip after send:', chip)
    print('JS errors:', errors if errors else 'none')
    b.close()
