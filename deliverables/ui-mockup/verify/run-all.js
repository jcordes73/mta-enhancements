#!/usr/bin/env node
/* Consolidated runner for the ui-mockup jsdom verification suites.
   Each verify-*.js stays independent (own JSDOM boot of ../index.html); this
   runner executes them in a parallel worker pool instead of sequentially,
   which is the dominant cost (each suite re-parses and boots the ~1.1 MB mock).
   A suite FAILS when it exits non-zero OR prints a line starting with FAIL
   (several suites historically exited 0 while printing FAIL lines — the exit
   codes were fixed 2026-11-17, the line check is kept as a belt-and-braces).
   Usage:  node verify/run-all.js [--jobs=N] [--only=suite,suite]
   Default jobs: min(os.cpus(), 6). --only matches suite names with or without
   the verify- prefix / .js suffix. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const jobsArg = args.find(a => a.startsWith('--jobs='));
const onlyArg = args.find(a => a.startsWith('--only='));
const jobs = jobsArg ? Math.max(1, parseInt(jobsArg.split('=')[1], 10) || 1) : Math.min(os.cpus().length, 6);
/* row 214: raised 420s → 900s — the i18n suite takes ~14min standalone at 12 locales
   (was ~8m19s at 11 in row 211, when 420s only failed under jobs=6 contention) */
const SUITE_TIMEOUT_MS = 900000;

let suites = fs.readdirSync(__dirname).filter(f => /^verify-.*\.js$/.test(f)).sort();
if (onlyArg){
  const want = new Set(onlyArg.split('=')[1].split(',').map(s => s.replace(/^verify-/, '').replace(/\.js$/, '')).filter(Boolean));
  suites = suites.filter(f => want.has(f.replace(/^verify-/, '').replace(/\.js$/, '')));
}
if (!suites.length){ console.error('no suites matched'); process.exit(2); }

const results = [];
let cursor = 0;
const t0 = Date.now();

function runSuite(file){
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, file)], { cwd: path.dirname(__dirname) });
    let out = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); out += '\nFAIL suite timed out after ' + (SUITE_TIMEOUT_MS / 1000) + 's'; }, SUITE_TIMEOUT_MS);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => out += d);
    child.on('close', code => {
      clearTimeout(timer);
      const failLines = out.split('\n').filter(l => /^FAIL/.test(l));
      const ok = code === 0 && failLines.length === 0;
      const summary = failLines.length ? failLines[0].slice(0, 110)
        : (out.match(/^\s*\d+ passed.*$/m) || [])[0]
          || (out.split('\n').filter(l => /PASS|OK /.test(l)).pop() || 'silent').trim().slice(0, 110);
      resolve({ file, ok, code, failLines, summary, secs: (Date.now() - started) / 1000 });
    });
  });
}

async function worker(){
  while (cursor < suites.length){
    const file = suites[cursor++];
    const r = await runSuite(file);
    results.push(r);
    console.log((r.ok ? 'OK    ' : 'FAIL  ') + r.file.replace(/^verify-|\.js$/g, '') + '  (' + r.secs.toFixed(1) + 's)  ' + r.summary);
    if (!r.ok) r.failLines.slice(1, 6).forEach(l => console.log('        ' + l));
  }
}

(async () => {
  console.log('run-all: ' + suites.length + ' suites, jobs=' + jobs + '\n');
  await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));
  const bad = results.filter(r => !r.ok);
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n=== ' + (results.length - bad.length) + '/' + results.length + ' suites passed, ' + bad.length + ' failed — ' + wall + 's wall (jobs=' + jobs + ') ===');
  process.exit(bad.length ? 1 : 0);
})();
