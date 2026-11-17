/* Seeds src/i18n/locales/<lng>.json from the mock's I18N dictionary (verbatim in
   src/i18n/i18n.ts). Natural keys: the key IS the English string, the value is the
   translation — so `t('Applications')` needs no en.json (i18next runs with
   keySeparator/nsSeparator disabled and returns the key for EN / missing keys).
   Strings the mock never had (auth chrome etc.) live in i18n-additions.json and are
   merged on top — hand-maintained, so re-running this script keeps them.
   Run: node scripts/extract-i18n.mjs   (run again after the mock's dict changes) */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/i18n/i18n.ts'), 'utf8');

// slice the `const I18N = { … };` block (one giant line per locale) and evaluate it
const start = src.indexOf('const I18N = {');
const end = src.indexOf('\n};', start);
if (start < 0 || end < 0) throw new Error('I18N block not found in src/i18n/i18n.ts');
const I18N = new Function(`return (${src.slice(src.indexOf('{', start), end + 2)})`)();
const ADDITIONS = JSON.parse(readFileSync(join(here, 'i18n-additions.json'), 'utf8'));

const outDir = join(here, '../src/i18n/locales');
mkdirSync(outDir, { recursive: true });

// the dict's sentence FRAGMENTS (whitespace-padded keys from the mock's node-split
// prose) can never be clean t() keys — they belong to the legacy regex rules, drop them
const fragment = (k) => k !== k.trim() || k === '';

for (const [lng, dict] of Object.entries(I18N)) {
  const cat = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(dict || {})) {
    if (fragment(k)) { dropped++; continue; }
    cat[k] = v;
  }
  for (const [k, v] of Object.entries(ADDITIONS[lng] ?? {})) {
    if (fragment(k)) continue;
    cat[k] = v;
  }
  writeFileSync(join(outDir, `${lng}.json`), JSON.stringify(cat, null, 1) + '\n');
  console.log(`${lng}: ${Object.keys(cat).length} keys (${dropped} fragments dropped)`);
}

// EN is the identity locale (the key IS the English string — no catalog needed for
// bare lookups). en.json is generated from i18n-additions.json only and carries just
// the entries EN can't derive from the key: native plural forms (_one/_other pairs
// for count-keys where the English singular/plural strings differ).
if (ADDITIONS.en) {
  writeFileSync(join(outDir, 'en.json'), JSON.stringify(ADDITIONS.en, null, 1) + '\n');
  console.log(`en: ${Object.keys(ADDITIONS.en).length} keys (plural forms only — bare keys fall back to the key itself)`);
}

