/* Harvests the mock's German/… renderings of the composed Home sentences, per
   locale × persona, to source the i18n-additions entries for Home.tsx's
   key-based migration. Writes JSON to stdout. */
const puppeteer = require('puppeteer-core');

const LANGS = ['de', 'ar', 'es', 'fr', 'ja', 'it', 'tr'];
const PERSONAS = ['architect', 'migrator', 'pm', 'pgm', 'admin', 'padmin'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--window-size=1920,1080'], defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  const out = {};
  for (const lang of LANGS) {
    out[lang] = { personas: {} };
    for (const persona of PERSONAS) {
      await page.goto(`file:///home/jcordes/NotBackedup/mta-improvements/deliverables/ui-mockup/index.html#scr=home&persona=${persona}&lang=${lang}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1600));
      out[lang].personas[persona] = await page.evaluate(() => {
        const b = document.querySelector('.persona-blurb b');
        const main = document.querySelector('.pf-v6-c-page__main');
        return {
          banner: b ? b.textContent.trim() : null,
          title: main?.querySelector('.page-title')?.textContent.trim() ?? null,
        };
      });
    }
    // architect landing details (KPI subs, waves sentence, trends)
    await page.goto(`file:///home/jcordes/NotBackedup/mta-improvements/deliverables/ui-mockup/index.html#scr=home&persona=architect&lang=${lang}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1600));
    out[lang].landing = await page.evaluate(() => {
      const lp = document.querySelector('.lp-architect');
      if (!lp) return null;
      const kpis = [...lp.querySelectorAll('.kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim());
      const hurtRow = lp.querySelector('.pf-v6-c-table__tbody tr');
      const trend = [...lp.querySelectorAll('.u-muted')].map(d => d.textContent.replace(/\s+/g, ' ').trim()).filter(t => /—|·/.test(t));
      return { kpis, hurtRow: hurtRow ? hurtRow.textContent.replace(/\s+/g, ' ').trim() : null, trend };
    });
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
