const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const OK = (n, c) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n);
const dom = new JSDOM(html, { url: 'http://localhost/mock.html#lang=de', runScripts: 'dangerously', pretendToBeVisual: true });
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
    OK('DE: gate titles translated', txt.includes('Keine Kontingentblocker') && txt.includes('Verifizierung grün'));
    OK('DE: wave chips translated', txt.includes('abgeschlossen') && txt.includes('blockiert'));
    OK('DE: months localized', txt.includes('Okt'));
    process.exit(0);
  }, 300);
}, 900);
