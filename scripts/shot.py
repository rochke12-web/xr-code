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

    # 1. dark home
    pg.screenshot(path='/tmp/render/dark-home.png')

    # 2. light theme home (toggle via settings state)
    pg.evaluate("setTheme('light')")
    pg.wait_for_timeout(400)
    pg.screenshot(path='/tmp/render/light-home.png')

    # 3. agent view (dark)
    pg.evaluate("setTheme('dark'); showView('agent')")
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/render/agent.png')

    # 4. run the agent to see console steps
    pg.fill('#agentGoal', 'Build a todo app in HTML, CSS and JS with localStorage')
    pg.click('#agentRunBtn')
    pg.wait_for_timeout(2500)
    pg.screenshot(path='/tmp/render/agent-run.png')

    # 5. chat view after sending a message from home
    pg.evaluate("showView('home')")
    pg.fill('#homeInput', 'Generate code: write a Python script that renames files')
    pg.evaluate("document.getElementById('homeForm').dispatchEvent(new Event('submit'))")
    pg.wait_for_timeout(2500)
    pg.screenshot(path='/tmp/render/chat.png')

    # 6. settings view
    pg.evaluate("showView('settings')")
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/render/settings.png')

    # 7. login with google to check sync UI
    pg.click('#loginGoogle')
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/render/logged-in.png')

    print('JS errors:', errors if errors else 'none')
    b.close()
