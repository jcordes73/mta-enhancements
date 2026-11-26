/* verify-estour.js — row 248: ES parity for the guided-tour surfaces.
 * Boots the mock in Spanish (deep-link &lang=es) across the tour's screens and asserts
 * the persona-landing chrome (pgm KPI cards + coordination strips), the incident triage
 * drawer, and the home quick links render Spanish; also asserts EN stays byte-exact and
 * the es->en switch is lossless (i18nOrig cache). Run: node verify/verify-estour.js
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,'');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const OK = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); c ? pass++ : fail++; };
function boot(hash){
  return new JSDOM(html, { url: 'http://mock.test/mock.html#' + hash, runScripts: 'dangerously', pretendToBeVisual: true });
}
function bodyText(d){ return d.body.textContent.replace(/\s+/g, ' '); }
(async () => {
  // pgm home + waves (KPI cards, coordination strips)
  const pgm = boot('scr=home&persona=pgm&org=nwf&lang=es');
  await sleep(500);
  let t = bodyText(pgm.window.document);
  OK('pgm KPIs: Equipos en el ámbito / Olas entre equipos / Bloqueos compartidos',
    t.includes('Equipos en el ámbito') && t.includes('Olas entre equipos') && t.includes('Bloqueos compartidos'));
  OK('pgm KPI subs: abarcan más de un equipo / team-days rule / staffed rule',
    t.includes('abarcan más de un equipo') && t.includes('días-equipo') && t.includes('3 de 4 olas con personal asignado') && t.includes('aplicaciones bloqueadas por cuota'));
  OK('coordination: Un solo equipo / edge-out rule fires',
    t.includes('Un solo equipo') && t.includes('Arista de dependencia saliente: payments-api (equipo Claims) → claims-web (equipo Claims, ola 4) — se queda dentro del equipo Claims'));
  OK('coordination: raise-path + edge-in rule fires',
    t.includes('la vía de escalado es una decisión de programa. · Arista de dependencia entrante: ← payments-api (equipo Claims, ola 3) — se queda dentro del equipo Claims'));
  OK('empty-coordination cell translated', t.includes('sin miembros muestreados — la vista de coordinación se completa cuando se planifica la ola.'));
  pgm.window.close();

  const pgmw = boot('scr=waves&persona=pgm&org=nwf&lang=es');
  await sleep(500);
  t = bodyText(pgmw.window.document);
  OK('waves screen: capacity cell rule + edge strip', t.includes('días-equipo') && t.includes('Arista de dependencia saliente'));
  pgmw.window.close();

  // incident drawer (modal chrome)
  const inc = boot('scr=incidents&persona=migrator&org=nwf&drawer=incident&lang=es');
  await sleep(600);
  t = bodyText(inc.window.document);
  OK('modal: Migration hint available + hint sentence translated',
    t.includes('Sugerencia de migración disponible') && t.includes('Las 3 ocurrencias comparten un patrón de reemplazo. Aplica, recompila y la suite de verificación comprueba que el arreglo funciona al arrancar'));
  OK('modal: cohort/effort/rules links translated',
    t.includes('el mismo hallazgo en otros 6 miembros') && t.includes('abrir cohorte') && t.includes('5 pts · derivado de reglas, confirmado dos veces en esta cohorte') && t.includes('abrir en reglas'));
  OK('modal: buttons + triage-state label + subtitle',
    t.includes('Marcar resuelto') && t.includes('Marcar falso positivo') && t.includes('Abrir el archivo en la línea 214') && t.includes('Estado de clasificación') && t.includes('asignada a ti por el ámbito del equipo'));
  const ph = inc.window.document.getElementById('incCommentInput');
  OK('modal: comment aria-label translated (attribute path; placeholder stays EN in every locale — only aria-label/title walk)',
    ph && (ph.getAttribute('aria-label') || '').includes('Añadir un comentario de triage'));
  inc.window.close();

  // home links (architect + migrator)
  const arch = boot('scr=home&persona=architect&org=nwf&lang=es');
  await sleep(500);
  t = bodyText(arch.window.document);
  OK('arch home: Ver riesgos combinados →', t.includes('Ver riesgos combinados →'));
  arch.window.close();
  const mig = boot('scr=home&persona=migrator&org=nwf&lang=es');
  await sleep(500);
  t = bodyText(mig.window.document);
  OK('mig home: Abrir mi cola en Incidencias →', t.includes('Abrir mi cola en Incidencias →'));
  OK('mig banner rule: Todos los equipos en Northwind Financial', t.includes('Todos los equipos en Northwind Financial'));
  OK('mig KPI: sampled-applications (team) rule', t.includes('aplicaciones muestreadas (equipo Claims)'));
  mig.window.close();

  // EN byte-exactness: same nodes unchanged in an EN boot
  const en = boot('scr=home&persona=pgm&org=nwf&drawer=incident');
  await sleep(600);
  t = bodyText(en.window.document);
  OK('EN unchanged: View combined risks / Mark resolved / team-days / edge sentence',
    t.includes('View combined risks →') && t.includes('Mark resolved') && t.includes('team-days')
    && t.includes('Dependency edge out: payments-api (team Claims) → claims-web (team Claims, Wave 4) — stays within team Claims, no cross-team ordering constraint.')
    && t.includes('All 3 occurrences share one replacement pattern'));
  en.window.close();

  // language SWITCH back and forth must be lossless (i18nOrig cache)
  const sw = boot('scr=home&persona=pgm&org=nwf');
  await sleep(400);
  sw.window.setLang('es');
  await sleep(250);
  sw.window.setLang('en');
  await sleep(250);
  t = bodyText(sw.window.document);
  OK('switch es→en restores EN (lossless cache)', t.includes('Teams in scope') && t.includes('Single team') && t.includes('View combined risks →'));
  sw.window.close();

  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
