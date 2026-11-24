/* Frame capture for the live-console demo — the React port of make-demo.sh's
   scenes, against the running application (console :5173, Keycloak :8180,
   hub :8080). Differences from the mock demo:
   - every persona needs a real Keycloak login (demo users, password "demo")
   - navigation happens inside the live SPA (hash routing, no page reloads)
   - the fx/click driver is injected per frame from here (no HTML patching)
   Screenshots land in $DEMO_FRAMES (default /tmp/opencode/live-demo/frames)
   as <scene>_<step>.png, plus manifest.json with per-scene frame counts. */
import { mkdirSync, writeFileSync } from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const BASE = process.env.DEMO_BASE;
if (!BASE) { console.error('DEMO_BASE is required — set it to the running console origin, e.g. http://<console-host>:5173'); process.exit(1); }
const OUT = process.env.DEMO_FRAMES || '/tmp/opencode/live-demo/frames';
const VP = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* demo users (checked-in realm, all password "demo") — usernames are the
   users' email addresses (2026-11-16); test fixtures keep their short names */
const LOGIN = {
  architect: 'm.keller@northwind-financial.com',
  migrator: 'j.cordes@northwind-financial.com',
  pm: 'p.schmidt@northwind-financial.com',
  pgm: 'k.vogel@northwind-financial.com',
};

/* scene | persona | hash | click selector (URL-decoded here) | fx scroll steps |
   bubble text. The click marker + speech bubble land on the LAST step of a
   scene (the "click" moment) — the nav anchor of the screen itself, or the
   first incident row for the modal scene. The bubble carries the short
   action-oriented explanation (the long prose stays in the bottom caption).
   Persona-first scenes carry no marker: the persona comes from the login,
   there is no switcher to click. */
const SCENES = [
  { name: 'arch-home',      persona: 'architect', hash: '#scr=home',      click: null,                                  fx: '0 200 400 600 800' },
  { name: 'arch-inventory', persona: 'architect', hash: '#scr=inventory', click: 'a[href="#scr=inventory"]',            fx: '0 130 260 390 520 650',
    bubble: 'Opens the application inventory — the single store of record, live from the hub.' },
  { name: 'arch-waves',     persona: 'architect', hash: '#scr=waves',     click: 'a[href="#scr=waves"]',                fx: '0 130 260 390 520 650 780',
    bubble: 'Opens Migration waves — composition, gates and the planned-vs-actual timeline.' },
  { name: 'mig-home',       persona: 'migrator',  hash: '#scr=home',      click: null,                                  fx: '0 200 400 600 800' },
  { name: 'mig-incidents',  persona: 'migrator',  hash: '#scr=incidents', click: 'a[href="#scr=incidents"]',            fx: '0 130 260 390 520 640',
    bubble: 'Opens the triage queue — the migrator’s daily work surface.' },
  { name: 'mig-modal',      persona: 'migrator',  hash: '#scr=incidents', click: 'button:has-text("Triage")',           fx: '0', modal: true,
    bubble: 'Click an incident row to open its triage detail — every write goes to the hub API.' },
  { name: 'pm-home',        persona: 'pm',        hash: '#scr=home',      click: null,                                  fx: '0 200 400 600 800' },
  { name: 'pm-waves',       persona: 'pm',        hash: '#scr=waves',     click: 'a[href="#scr=waves"]',                fx: '0 130 260 390 520 650',
    bubble: 'Opens Migration waves — the numbers to bring to the program review.' },
  { name: 'pm-reports',     persona: 'pm',        hash: '#scr=reports',   click: 'a[href="#scr=reports"]',              fx: '0 130 260 390 520 640',
    bubble: 'Opens Reports — effort and progress rollups, scoped to the team.' },
  { name: 'pgm-home',       persona: 'pgm',       hash: '#scr=home',      click: null,                                  fx: '0 200 400 600 800' },
  { name: 'pgm-waves',      persona: 'pgm',       hash: '#scr=waves',     click: 'a[href="#scr=waves"]',                fx: '0 130 260 390 520 650 780',
    bubble: 'Opens the cross-team composition card — which waves span more than one team.' },
  { name: 'pgm-tasks',      persona: 'pgm',       hash: '#scr=tasks',     click: 'a[href="#scr=tasks"]',                fx: '0 130 260 390 520 640',
    bubble: 'Opens the task manager — the escalation surface for shared platform work.' },
];

/* the mock demo's click marker, byte-for-byte, plus the speech bubble that
   carries the explanatory text next to the click */
const DEMO_CSS = `
#demoClick{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
  border:3px solid #0066cc;background:rgba(0,102,204,.18);z-index:2147483000;pointer-events:none;
  box-shadow:0 0 0 4px rgba(255,255,255,.85),0 0 18px rgba(0,102,204,.8);}
#demoClick:after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;
  border-radius:50%;background:#0066cc;box-shadow:0 0 0 2px #fff;}
#demoBubble{position:fixed;z-index:2147483001;pointer-events:none;max-width:400px;
  background:#fff;color:#151515;border:2px solid #0066cc;border-radius:12px;
  padding:10px 16px 10px 12px;font:500 23px/1.4 "Red Hat Text",Helvetica,Arial,sans-serif;
  box-shadow:0 0 0 4px rgba(255,255,255,.85),0 6px 16px rgba(0,0,0,.28);
  display:flex;gap:10px;align-items:center;}
#demoBubble svg{flex:none;}
#demoBubble:after{content:'';position:absolute;width:14px;height:14px;background:#fff;}
#demoBubble.b-left:after{left:-8px;top:50%;margin-top:-7px;border-left:2px solid #0066cc;border-bottom:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-right:after{right:-8px;top:50%;margin-top:-7px;border-right:2px solid #0066cc;border-top:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-top:after{top:-8px;left:28px;border-left:2px solid #0066cc;border-top:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-bottom:after{bottom:-8px;left:28px;border-right:2px solid #0066cc;border-bottom:2px solid #0066cc;transform:rotate(45deg);}
`;

/* marker + speech bubble at (cx, cy) — installed into the page after login
   (window.__demoInject); the bubble sits beside the marker with a tail pointing
   at it, flips side and clamps to stay inside the viewport */
const DEMO_INSTALL = () => {
  /* the Clippy avatar: a paperclip with eyes, pupils looking toward the click */
  const CLIPPY = '<svg viewBox="0 0 44 60" width="52" height="72" aria-hidden="true">'
    + '<g fill="none" stroke="#0066cc" stroke-width="3.6" stroke-linecap="round">'
    + '<path d="M13 7 L13 43 A9 9 0 0 0 31 43 L31 15 A6.5 6.5 0 0 0 18 15 L18 40 A3 3 0 0 0 24 40 L24 21"/></g>'
    + '<ellipse cx="19.5" cy="20" rx="5.4" ry="6.8" fill="#fff" stroke="#151515" stroke-width="1.4"/>'
    + '<ellipse cx="30.5" cy="20" rx="5.4" ry="6.8" fill="#fff" stroke="#151515" stroke-width="1.4"/>'
    + '<circle cx="21" cy="21.5" r="2" fill="#151515"/><circle cx="32" cy="21.5" r="2" fill="#151515"/></svg>';
  window.__demoInject = (cx, cy, text) => {
    const d = document.createElement('div');
    d.id = 'demoClick';
    d.style.left = cx + 'px';
    d.style.top = cy + 'px';
    document.body.appendChild(d);
    if (!text) return;
    const b = document.createElement('div');
    b.id = 'demoBubble';
    b.innerHTML = CLIPPY;
    const sp = document.createElement('span');
    sp.textContent = text;
    b.appendChild(sp);
    document.body.appendChild(b);
    const bw = b.offsetWidth, bh = b.offsetHeight, gap = 28;
    const right = cx + gap < innerWidth - bw - 12;   /* bubble beside the marker … */
    const left = right ? cx + gap : cx - gap - bw;   /* … flip to the other side on overflow */
    const top = Math.max(12, Math.min(cy - bh / 2, innerHeight - 12 - bh));
    let tail;
    if (cy < top + 16) tail = 'b-top';
    else if (cy > top + bh - 16) tail = 'b-bottom';
    else tail = right ? 'b-left' : 'b-right';
    b.classList.add(tail);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
  };
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  defaultViewport: VP,
});
mkdirSync(OUT, { recursive: true });
const manifest = [];

try {
  let ctx = null, page = null, curPersona = null;

  for (const sc of SCENES) {
    /* one logged-in context per persona (token lives in the SPA page) */
    if (sc.persona !== curPersona) {
      if (ctx) await ctx.close();
      ctx = await browser.createBrowserContext();
      page = await ctx.newPage();
      curPersona = sc.persona;
      await page.setViewport(VP);
      await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
      /* the welcome modal fires on a first login with no deep link — pin it seen
         before signing in (same origin as the console) */
      await page.evaluate((p) => { try { localStorage.setItem('mta.welcome.' + p, '1'); } catch {} }, sc.persona);
      await page.evaluate(() => { [...document.querySelectorAll('button, a')].find((el) => /sign in/i.test(el.textContent || ''))?.click(); });
      await page.waitForFunction(() => location.origin.includes('8180'), { timeout: 20000 });
      await page.waitForSelector('#username', { timeout: 20000 });
      await page.type('#username', LOGIN[sc.persona]);
      await page.click('#kc-login');
      await page.waitForSelector('#password', { timeout: 20000 });
      await page.type('#password', 'demo');
      await page.click('#kc-login');
      await page.waitForSelector('.pf-v6-c-masthead', { timeout: 30000 });
      await page.addStyleTag({ content: DEMO_CSS });
      await page.evaluate(DEMO_INSTALL);
      await sleep(1800);   /* live data settle */
      console.error('logged in:', sc.persona, '(' + LOGIN[sc.persona] + ')');
    }

    const steps = sc.fx.split(' ');
    const frames = [];
    for (let i = 0; i < steps.length; i++) {
      const fx = parseInt(steps[i], 10);
      await page.evaluate((h) => { if (location.hash !== h) location.hash = h; }, sc.hash);
      await sleep(sc.modal && i === 0 ? 2000 : 1400);
      await page.evaluate((fx) => {
        const el = document.querySelector('.pf-v6-c-page__main');
        if (el) el.scrollTop = Math.min(fx, Math.max(0, el.scrollHeight - el.clientHeight));
      }, fx);
      await sleep(250);
      /* triage modal scene: the queue ROWS open the incident modal (the mock used
         a per-row Triage button) — click the first row, then hold. Marker +
         speech bubble anchor on the clicked row's position (visible above the
         modal overlay). */
      if (sc.modal && i === 0) {
        const at = await page.evaluate(() => {
          const row = document.querySelector('.pf-v6-c-page__main .pf-v6-c-table__tbody tr');
          if (!row) return null;
          const r = row.getBoundingClientRect();
          return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });
        if (at) await page.evaluate(() => {
          const row = document.querySelector('.pf-v6-c-page__main .pf-v6-c-table__tbody tr');
          if (row) row.click();
        });
        await sleep(1200);
        if (at) {
          await page.evaluate((at, text) => window.__demoInject(at.cx, at.cy, text), at, sc.bubble);
          await sleep(250);
        } else {
          console.error('click marker skipped:', sc.name);
        }
      } else if (sc.click && i === steps.length - 1) {
        const ok = await page.evaluate((sel, text) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return false;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (cx < 8 || cy < 8 || cx > innerWidth - 8 || cy > innerHeight - 8) return false;
          const hit = document.elementFromPoint(cx, cy);
          if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return false;
          window.__demoInject(cx, cy, text);
          return true;
        }, sc.click, sc.bubble);
        await sleep(250);
        if (!ok) console.error('click marker skipped:', sc.name, sc.click);
      }
      const fname = `${sc.name}_${String(i).padStart(2, '0')}`;
      await page.screenshot({ path: `${OUT}/${fname}.png` });
      frames.push(fname);
      /* marker + bubble are per-frame (mock semantics: only on the final motion
         frame + hold) */
      await page.evaluate(() => {
        document.getElementById('demoClick')?.remove();
        document.getElementById('demoBubble')?.remove();
      });
    }
    manifest.push({ name: sc.name, persona: sc.persona, frames: frames.length, modal: !!sc.modal });
    console.error('scene done:', sc.name, '(' + frames.length + ' frames)');
  }
  writeFileSync(OUT + '/manifest.json', JSON.stringify(manifest, null, 1));
  console.error('capture complete:', OUT);
} finally {
  await browser.close();
}
