const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const OK = (n, c) => { if (!c) global.__fails = (global.__fails || 0) + 1; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
const dom = new JSDOM(html, { url: 'http://mock.test/mock.html#lang=de', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
setTimeout(() => {
  const d = w.document;
  w.setPersona('architect', true);
  w.show('waves');
  setTimeout(() => {
    // every text node on the waves screen must be translated (or whitelisted data/proper nouns)
    const WHITELIST = new Set([
      'payments-api','invoicing','claims-web','claims-batch','notification-router','ledger-sync','risk-scoring','cust-portal','policy-engine',
      'Claims','EAP8-archetype','MIG-412','MIG-418','MIG-425','M. Keller','M. Keller, J. Cordes','M. Keller, P. Schmidt',
      'Log4j remediation','Namespace migration','ORM hint replacement','Migrate JNDI lookups',
      ' 410 Gone — ticket moved projects ','synced','green'.replace('x','x'),
      '1 DB · 1 queue','1 DB · 2 APIs','2 DBs · 3 APIs · 1 queue',
      'Sep','Nov','Suites','Ticket','Tickets','Tickets ',' svn-read-key','410 Gone — ticket moved projects',
      /* row 127 member-table chrome is EN-only by the recorded row-127 decision; 'quota-blocked'
         is a pre-existing state key (identifier-guarded, never translated) */
      'of 2','quota-blocked',
      /* row 198: the gateList blocker row composes data (app + finding, EN by the incident-text
         rule) with a short count phrase — the strip chip is skip-pinned; these stay EN pending
         the i18n pass, like the row-127 chrome */
      '1 blocking incident','\u2014 claims-batch: Kafka contract mismatch \u2014 kafka-contract suite red',
      /* row 199: the Blocking-incidents tab's data nodes (finding + source are seeded EN) */
      'Kafka contract mismatch \u2014 kafka-contract suite red','(citrus-verification WR-12)',
      /* row 200: the Quota-blocks tab's row text (chrome composed with #38 cite) */
      'analysis postponed \u2014 waiting for org quota (#38)',
      /* row 207: the Burndown tab label — DE/ES/FR/IT/TR/PT keep the loanword (identity
         translation by design), so the node is never rewritten and trips the heuristic */
      'Burndown',
      /* row 210: the Dependencies tab's Status header — DE value is the identity 'Status'
         (loanword), so the node is never rewritten and trips the heuristic, like Burndown */
      'Status',
      /* row 212 follow-on: the per-wave burndown legend's 'Ideal' — DE value is the identity
         'Ideal' (loanword); the node only surfaced once row 212 made the chart mount under DE */
      'Ideal',
    ]);
    const left = w.eval(`(() => {
      const out = [];
      const walker = document.createTreeWalker(document.getElementById('scr-waves'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()){
        const n = walker.currentNode;
        const orig = i18nOrig.has(n) ? i18nOrig.get(n) : n.nodeValue;
        if (n.nodeValue === orig && /[A-Za-z]{2}/.test(orig) && !i18nSkipped(n)) out.push(orig.trim());
      }
      return [...new Set(out)];
    })()`);
    const unexpected = left.filter(t => !WHITELIST.has(t) && !/^svn-read-key/.test(t) && !/^(claims|invoicing|ledger|notification|payments|policy|risk|M\.)/.test(t));
    OK('DE waves: no unexpected untranslated nodes (' + left.length + ' whitelisted data nodes)', unexpected.length === 0);
    if (unexpected.length) console.log('  unexpected:', JSON.stringify(unexpected));
    // positive spot checks
    const txt = d.getElementById('scr-waves').textContent;
    OK('DE: card title translated', txt.includes('Wellenausführung'));
    OK('DE: bar label composes "Gate kritisch"', txt.includes('Gate kritisch'));
    OK('DE: "Geplant → ist" header', txt.includes('Geplant → ist'));
    OK('DE: no mixed "Welle execution"', !txt.includes('Welle execution'));
    OK('DE: no mixed "gate kritisch"', !txt.includes('gate kritisch'));
    OK('DE: incidents count translated', txt.includes('88 Vorfälle'));
    OK('DE: tokens·runs composed', txt.includes('3.5M Tokens · 11 Läufe'));
    OK('DE: gate condition names translated (row 205: creds tab + stat tile carry them)', txt.includes('Zugangsdaten verifiziert') && txt.includes('Kapazität'));
    OK('DE: wave chips translated', txt.includes('abgeschlossen') && txt.includes('blockiert'));
    OK('DE: months localized', txt.includes('Okt'));
    /* row 212: the burndown charts (per-wave + aggregate) must mount under non-EN —
       the lane lookup used to match the rendered 'Wave N' title, which translates,
       silently skipping every chart (EN-only charts since row 207) */
    OK('DE: aggregate burndown mounts (row 212)', !!d.getElementById('waveBurnAll').querySelector('svg'));
    OK('DE: per-wave burndown mounts (row 212)', !!d.getElementById('waveBurn-3').querySelector('svg'));
    OK('DE: wave risk rollup counts from data-risk (row 212)', /1 hoch \u00b7 1 mittel \u00b7 1 niedrig/.test(txt));
    process.exit(global.__fails ? 1 : 0);
  }, 300);
}, 900);
