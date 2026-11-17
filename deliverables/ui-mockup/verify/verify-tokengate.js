const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return require('/tmp/node_modules/jsdom'); } })();
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
const dom = new JSDOM(html, { url: 'http://localhost/mock.html#lang=de', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(900);
  const d = w.document;
  w.setPersona('admin', true);
  const T = () => d.body.textContent;

  // ---- DE: admin landing — wave-gate summary composition (i18nGateTxt fragments) ----
  w.show('home'); await sleep(150);
  OK('DE: wave-gate summary composes "Welle 3s Gate ist kritisch (2 offene Tickets"', T().includes('Welle 3s Gate ist kritisch (2 offene Tickets'));
  OK('DE: suites-red fragment', T().includes('2 von 9 Suiten rot'));
  OK('DE: expiring-credential fragment singular', T().includes('1 Zugang läuft ab (svn-read-key)'));
  OK('DE: quota-blocked fragment', T().includes('2 kontingentblockiert'));
  OK('DE: no digit-eating bug ("Welle as Gate")', !T().includes('Welle as Gate') && !T().includes('(  offene'));
  OK('DE: spend KPI converts $ and translates tail', T().includes('85,90 € · 3.5M Tokens · 12 Läufe'));
  OK('DE: notification "Gate gefährdet: 4 Tickets offen."', T().includes('Gate gefährdet: 4 Tickets offen.'));
  OK('DE: tenancy explainer (architect scope)', T().includes('Ein Architekt ist für einen Geltungsbereich verantwortlich'));
  OK('DE: tenancy explainer (orgs isolated)', T().includes('Organisationen sind isoliert'));
  OK('DE: admin workspace subtitle', T().includes('Der Arbeitsbereich für Plattformgesundheit der Administration'));

  // ---- DE: reports ----
  w.show('reports'); await sleep(150);
  OK('DE: risk insight translated', T().includes('konzentriert in Welle 4 — das Gate verlangt Cloud-Bereitschaft'));
  OK('DE: no mixed "concentrated in Welle 4"', !T().includes('concentrated in Welle 4'));

  // ---- DE: credentials ----
  w.show('credentials'); await sleep(150);
  OK('DE: expiring credential notification singular', T().includes('1 Zugang läuft ab — epic-fhir-token'));

  // ---- DE: waves (tokens·runs singular grammar) ----
  w.show('waves'); await sleep(150);
  OK('DE: "22k Tokens · 1 Lauf" singular', T().includes('22k Tokens · 1 Lauf'));
  OK('DE: no "1 Läufe" grammar bug', !/\b1 Läufe/.test(T()));
  OK('DE: task cell "Suite grün vor dem Wellen-Gate"', T().includes('Suite grün vor dem Wellen-Gate'));

  // ---- DE: config (gateway showback + Hub API excerpt) ----
  w.show('config'); await sleep(150);
  OK('DE: "Gateway-Nutzung" card', T().includes('Gateway-Nutzung'));
  OK('DE: "Tokens diesen Monat"', T().includes('Tokens diesen Monat'));
  OK('DE: "Gateway / Modell" header', T().includes('Gateway / Modell'));
  OK('DE: rate paragraph translated', T().includes('Das Rate-Feld ist der Geldbetrag'));
  OK('DE: no mixed "Währung selector"', !T().includes('Währung selector'));
  OK('DE: Hub token exchange label', T().includes('Hub-Token-Austausch'));
  OK('DE: OAuth paragraph translated', T().includes('expliziten Token-Austausch statt geteilter IdP-Konfiguration'));
  OK('DE: tool-execution bullet translated', T().includes('Tool-Ausführung, die Modellzugriff benötigt'));
  OK('DE: OpenAPI parity line translated', T().includes('Parity-Gate grün (0 Route-/Spec-Abweichungen)'));
  OK('DE: Swagger modal subtitle translated', T().includes('Swagger UI auf der parity-geprüften OpenAPI-3-Spec'));
  OK('DE: activation note translated', T().includes('Aktivierung am 2. Okt propagierte die v3-Antworten'));

  // ---- DE: agentic ----
  w.show('agentic'); await sleep(150);
  OK('DE: runs footer translated', T().includes('Läufe diesen Monat · neueste zuerst · Token-/Kosten-Showback'));
  OK('DE: showback pointer translated with nav names', T().includes('Showback (Läufe, Tokens, geschätzte Kosten pro Gateway) ist die Karte Verwaltung → Automatisierung'));
  OK('DE: reports KPI "Rollup pro Gateway →"', T().includes('Rollup pro Gateway →') || T().includes('welche Gateways haben sie genutzt?'));

  // ---- DE: rbac tour node ----
  OK('DE: RBAC scopes tour text translated', T().includes('Geltungsbereiche — Der Migrator sieht keine Verwaltungseinträge'));
  OK('DE: automation-access bullet translated around the Tokens link', T().includes('ein Servicekonto pro Pipeline') && T().includes('jede Mutation wird im Audit-Log attribuiert'));
  OK('DE: inference/audit tail translated', T().includes('Write-Tool-Opt-ins werden im Audit-Log aufgezeichnet'));
  OK('DE: admin-landing spend KPI "$ · 3.5M · 12 Läufe"', T().includes(' · 12 Läufe'));

  // ---- FR spot checks ----
  w.setLang('fr'); await sleep(150);
  OK('FR: gate summary fragments', T().includes('tickets ouverts') && T().includes('gate en échec'));
  OK('FR: "Tokens (30 jours)" or jetons labels', T().includes('Jetons') || T().includes('tokens'));
  w.show('config'); await sleep(150);
  OK('FR: gateway usage card', T().includes('Utilisation des passerelles'));
  OK('FR: rate paragraph', T().includes('Le champ Rate est le montant'));

  // ---- JA spot checks ----
  w.setLang('ja'); await sleep(150);
  w.show('home'); await sleep(150);
  OK('JA: gate summary fragments', T().includes('のゲートが失敗') && T().includes('オープンチケット2件'));
  OK('JA: spend KPI', T().includes('トークン · 12回'));
  w.show('config'); await sleep(150);
  OK('JA: gateway usage card', T().includes('ゲートウェイ使用状況'));

  // ---- AR spot checks ----
  w.setLang('ar'); await sleep(150);
  w.show('home'); await sleep(150);
  OK('AR: gate summary fragments', T().includes('بوابة الموجة 3 فاشلة'));

  // ---- EN must be byte-exact: reload fresh in EN ----
  const dom2 = new JSDOM(html, { url: 'http://localhost/mock.html', runScripts: 'dangerously', pretendToBeVisual: true });
  await sleep(900);
  const w2 = dom2.window, d2 = w2.document;
  w2.setPersona('admin', true); w2.show('home'); await sleep(150);
  OK('EN: wave-gate summary unchanged', d2.body.textContent.includes("Wave 3’s gate is failing (2 open tickets, 2 of 9 suites red, 1 credential expiring (svn-read-key))"));
  OK('EN: spend KPI unchanged', d2.body.textContent.includes('$93.37 · 3.5M tokens · 12 runs'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
