// Feature probe: sidebar chat list + model picker + end-to-end chat
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let fails = 0;
function chk(name, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + "  got=" + JSON.stringify(got) + (want !== undefined ? " want=" + JSON.stringify(want) : ""));
}

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
pg.on("pageerror", e => errors.push(String(e)));
await pg.goto(BASE + "/", { waitUntil: "networkidle" });
await pg.waitForTimeout(1400);
const fr = pg.frames().find(f => f !== pg.mainFrame());
const F = fr || pg;

// 1 — sidebar chat list exists with empty hint, model pill says Flash
const init = await F.evaluate(() => ({
  hasList: !!document.querySelector('#chatList'),
  hint: (document.querySelector('.cl-empty') || {}).textContent || '',
  pillName: (document.querySelector('#homeModelBtn .mp-n') || {}).textContent || '',
  chatPill: (document.querySelector('#chatModelBtn .mp-n') || {}).textContent || ''
}));
chk("chat list exists", init.hasList, true);
chk("empty hint shown", init.hint.includes('No chats yet'), true);
chk("home pill = Flash", init.pillName, "Flash");
chk("chat pill = Flash", init.chatPill, "Flash");

// 2 — open model menu, switch to Vision
await F.click('#homeModelBtn');
await pg.waitForTimeout(250);
const menuOpen = await F.evaluate(() => getComputedStyle(document.querySelector('#homeModelMenu')).display);
chk("menu opens", menuOpen, "flex");
await pg.screenshot({ path: 'download/preview-20-model-menu.png' });
await F.click('#homeModelMenu button[data-m="prime-v1-vision"]');
await pg.waitForTimeout(300);
const after = await F.evaluate(() => document.querySelector('#homeModelBtn .mp-n').textContent);
chk("pill = Vision after pick", after, "Vision");
const toastTxt = await F.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'));
chk("toast shows Vision", toastTxt.includes('Vision'), true);

// 3 — send a message: chat must appear in the sidebar list under Search
await F.fill('#homeInput', 'what is 2+2? answer with just the number');
await F.click('#homeForm .send-btn');
await pg.waitForTimeout(13000);
const chatState = await F.evaluate(() => {
  const items = [...document.querySelectorAll('#chatList .cl-item')];
  return {
    count: items.length,
    title: (items[0] && items[0].querySelector('.cl-t').textContent) || '',
    active: items.filter(i => i.classList.contains('current')).length,
    view: document.querySelector('.view.active').id
  };
});
chk("chat in sidebar list", chatState.count >= 1, true);
chk("list title from first msg", chatState.title.includes('what is 2+2'), true);
chk("active highlight", chatState.active, 1);
chk("chat view opened", chatState.view, "view-chat");
const reply = await F.evaluate(() => {
  const as = [...document.querySelectorAll('.msg.a .bubble')];
  return as.length ? as[as.length - 1].textContent.trim() : '';
});
console.log("       reply:", JSON.stringify(reply.slice(0, 50)));
chk("AI replied", reply.length > 0 ? "yes" : "no", "yes");

// 4 — click the sidebar item again → still opens the chat
await F.click('#chatList .cl-item');
await pg.waitForTimeout(500);
chk("list item click ok", await F.evaluate(() => document.querySelector('.view.active').id), "view-chat");

// 5 — switch back to Flash via chat composer pill
await F.click('#chatModelBtn');
await pg.waitForTimeout(250);
await F.click('#chatModelMenu button[data-m="prime-v1-flash"]');
await pg.waitForTimeout(300);
chk("back to Flash", await F.evaluate(() => document.querySelector('#chatModelBtn .mp-n').textContent), "Flash");

await pg.screenshot({ path: 'download/preview-21-chat-list.png' });
chk("no page errors", errors.length, 0);
if (errors.length) console.log(errors.slice(0, 3));
await br.close();
console.log(fails === 0 ? "FEATURE PROBE: ALL PASS" : `FEATURE PROBE: ${fails} FAIL`);
process.exit(fails ? 1 : 0);
