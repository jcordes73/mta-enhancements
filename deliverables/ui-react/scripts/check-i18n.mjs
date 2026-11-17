/* i18n coverage check — run via `npm run check:i18n` (also a prebuild gate candidate).
   Verifies, for the key-based i18next layer (src/i18n/):
   1. every `t('…')` literal used in src/ exists in ALL locale catalogs
      (missing → the string silently renders English);
   2. no catalog key is identifier-shaped or whitespace-padded
      (natural keys are English sentences; identifier-shaped keys mean someone
      invented a symbolic key — not the convention here);
   3. catalogs stay in sync: every locale has the same key set as de.json
      (the largest, seeded from the mock). */
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../src');
const locDir = join(srcDir, 'i18n/locales');

const catalogs = {};
for (const f of readdirSync(locDir).filter(f => f.endsWith('.json'))) {
  catalogs[f.replace('.json', '')] = JSON.parse(readFileSync(join(locDir, f), 'utf8'));
}
const refLng = Object.keys(catalogs).sort((a, b) => Object.keys(catalogs[b]).length - Object.keys(catalogs[a]).length)[0];

// 1. collect t('…') / t("…") literals from src (skip the catalog JSONs and this script);
//    calls carrying `count:` are plural keys — they need _one/_other entries in EVERY
//    locale (a locale missing _one silently falls to _other, not the bare key!)
const used = new Set();
const usedPlural = new Set();
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|jsx?)$/.test(f.name) || p.includes('locales')) continue;
    const code = readFileSync(p, 'utf8');
    for (const m of code.matchAll(/[^a-zA-Z0-9_$]t\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*\{(?:(?!\}\)).)*\bcount\b/gs)) {
      usedPlural.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
    for (const m of code.matchAll(/[^a-zA-Z0-9_$]t\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      used.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
    // Trans components: i18nKey="…" attribute
    for (const m of code.matchAll(/\bi18nKey=(['"])((?:\\.|(?!\1).)*)\1/g)) {
      used.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
};
walk(srcDir);

let fail = 0;
const checked = [...used].filter(k => k && !k.includes('${'));
const checkLngs = Object.keys(catalogs).filter(l => l !== 'en');   // en = identity: bare keys fall back to the key itself
for (const key of checked) {
  const missing = checkLngs.filter(l => !(key in catalogs[l]));
  if (missing.length) {
    console.error(`MISSING key ${JSON.stringify(key)} in: ${missing.join(', ')}`);
    fail++;
  }
}
for (const key of [...usedPlural].filter(k => k && !k.includes('${'))) {
  for (const suf of ['_one', '_other']) {
    const missing = Object.keys(catalogs).filter(l => !(`${key}${suf}` in catalogs[l]));
    if (missing.length) {
      console.error(`MISSING plural entry ${JSON.stringify(key + suf)} in: ${missing.join(', ')}`);
      fail++;
    }
  }
}
if (!checked.length) console.warn('no t() literals found — nothing to check');

// 2. suspicious catalog keys
for (const [lng, cat] of Object.entries(catalogs)) {
  for (const k of Object.keys(cat)) {
    if (k !== k.trim()) { console.error(`PADDED key in ${lng}.json: ${JSON.stringify(k)}`); fail++; }
    else if (/^[A-Za-z0-9_.:/@+-]+$/.test(k) && /\./.test(k)) { console.error(`IDENTIFIER-shaped key in ${lng}.json: ${JSON.stringify(k)}`); fail++; }
  }
}

// 3. key-set drift across locales — WARNING only: the mock's own dicts have
//    pre-existing holes (they rendered EN fallback); new code may not add to them.
//    en is exempt: identity locale, intentionally plural-forms-only.
const ref = new Set(Object.keys(catalogs[refLng]));
let drift = 0;
for (const [lng, cat] of Object.entries(catalogs)) {
  if (lng === refLng || lng === 'en') continue;
  for (const k of Object.keys(cat)) if (!ref.has(k)) { console.warn(`extra key in ${lng}.json (not in ${refLng}.json): ${JSON.stringify(k)}`); drift++; }
  for (const k of [...ref].filter(k => !(k in cat))) { console.warn(`hole in ${lng}.json (missing, present in ${refLng}): ${JSON.stringify(k)} — renders EN`); drift++; }
}

console.log(`i18n check: ${checked.length} t() keys × ${Object.keys(catalogs).length} locales — ${fail ? fail + ' PROBLEMS' : 'OK'}${drift ? ` (${drift} legacy drift warnings)` : ''}`);
process.exit(fail ? 1 : 0);
