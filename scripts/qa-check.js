#!/usr/bin/env node
/**
 * QA check — run with: node scripts/qa-check.js
 *
 * Three layers:
 *   1. Syntax check every JS file (frontend + backend)
 *   2. Unit tests for pure logic (radar target encoding, insight builders)
 *   3. Static invariants — greps that catch the bug classes we've actually
 *      shipped (stale copy, encoded-target leaks, inline-onclick injection,
 *      unparsed radar prefixes)
 *
 * Exits non-zero on any failure. Add new invariants when a bug ships:
 * every entry below is a regression test for a real defect.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
let passes = 0;

function check(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ────────────────────────────────────────────────────────────
// 1. SYNTAX: every JS file must parse
// ────────────────────────────────────────────────────────────
console.log('\n[1/3] Syntax checks');
const jsFiles = execSync(
  `find backend frontend -name "*.js" -not -path "*/node_modules/*"`,
  { cwd: ROOT }
).toString().trim().split('\n');

check(`node --check on ${jsFiles.length} JS files`, () => {
  for (const f of jsFiles) {
    try {
      execSync(`node --check "${f}"`, { cwd: ROOT, stdio: 'pipe' });
    } catch (err) {
      throw new Error(`${f}: ${err.stderr?.toString().split('\n')[0]}`);
    }
  }
});

// ────────────────────────────────────────────────────────────
// 2. UNIT: pure logic
// ────────────────────────────────────────────────────────────
console.log('\n[2/3] Unit tests');

check('radarTypes: round-trips, including apostrophes and quotes', () => {
  const { parseRadarTarget, encodeRadarTarget, radarDisplayLabel } =
    require(path.join(ROOT, 'backend/services/radarTypes'));

  const cases = [
    ['subreddit', 'webdev'],
    ['topic', "china's robotic development"],   // the apostrophe that broke unsubscribe
    ['leads', 'social media "scheduling" tool'],
    ['learning', 'roman history']
  ];
  for (const [type, target] of cases) {
    const encoded = encodeRadarTarget(type, target);
    const parsed = parseRadarTarget(encoded);
    assert(parsed.type === type, `type mismatch for ${encoded}: got ${parsed.type}`);
    assert(parsed.target === target, `target mismatch for ${encoded}: got "${parsed.target}"`);
  }
  assert(parseRadarTarget('plainsubreddit').type === 'subreddit', 'plain value must decode as subreddit');
  assert(radarDisplayLabel('leads:crm software') === 'Leads: crm software', 'display label wrong');
});

check('InsightSections: all builders render and escape user data', () => {
  global.escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const src = read('frontend/js/insightsSections.js');
  // eslint-disable-next-line no-eval
  eval(src + ';globalThis.InsightSections = InsightSections;');
  const mock = {
    theVerdict: { answer: 'A <b>"quoted"</b> answer', confidence: 'high' },
    exploreNext: [{ query: "what's next?", why: 'gap', angle: 'deeper' }],
    confidence: { level: 'high', dataQuality: 'good' }
  };
  const opts = { tag: 'h2', cls: 'analysis-section' };
  const verdictHtml = InsightSections.verdict(mock, opts);
  assert(verdictHtml.includes('&lt;b&gt;'), 'verdict must escape HTML in user data');
  const exploreHtml = InsightSections.exploreNext(mock, opts);
  assert(exploreHtml.includes('data-query='), 'exploreNext must use data attributes for queries');
  for (const [name, fn] of Object.entries(InsightSections)) {
    assert(fn({}, opts) === '', `${name} must return '' for empty data`);
  }
});

// ────────────────────────────────────────────────────────────
// 3. STATIC INVARIANTS — one per shipped bug class
// ────────────────────────────────────────────────────────────
console.log('\n[3/3] Static invariants (regression guards)');

check('no stale "Add Another Subreddit" copy anywhere', () => {
  const hits = [];
  for (const f of jsFiles.concat(
    execSync(`find frontend backend -name "*.html" -not -path "*/node_modules/*"`, { cwd: ROOT })
      .toString().trim().split('\n'))) {
    if (read(f).includes('Add Another Subreddit')) hits.push(f);
  }
  assert(hits.length === 0, `stale copy in: ${hits.join(', ')}`);
});

check('no inline onclick with interpolated user data in content-radar JS', () => {
  // Bug class: onclick="fn('${subscription.subreddit}')" breaks on apostrophes
  const files = ['frontend/content-radar/js/manage.js', 'frontend/content-radar/js/subscribe.js', 'frontend/content-radar/js/unsubscribe.js'];
  for (const f of files) {
    const bad = read(f).match(/onclick="[^"]*\$\{[^}]*(subreddit|subscription|target|query)[^}]*\}[^"]*"/);
    assert(!bad, `${f} interpolates user data into inline onclick: ${bad && bad[0]}`);
  }
});

check('every generateDigest() call site outside contentRadar passes radarType', () => {
  const files = ['backend/routes/radar.js', 'backend/routes/cron.js', 'backend/services/scheduler.js'];
  for (const f of files) {
    const src = read(f);
    const regex = /generateDigest\(\{[\s\S]{0,300}?\}\)/g;
    let m;
    while ((m = regex.exec(src)) !== null) {
      assert(m[0].includes('radarType'), `${f}: generateDigest call without radarType:\n${m[0].substring(0, 120)}`);
    }
  }
});

check('digest-processing paths decode the radar prefix (parseRadarTarget)', () => {
  for (const f of ['backend/routes/radar.js', 'backend/routes/cron.js', 'backend/services/scheduler.js']) {
    assert(read(f).includes('parseRadarTarget'), `${f} never decodes radar prefixes`);
  }
});

check('unsubscribe page has no hardcoded r/ around the target label', () => {
  assert(!read('frontend/content-radar/unsubscribe.html').includes('r/<span id="unsubSubreddit"'),
    'unsubscribe.html hardcodes r/ before the decoded label');
});

check('subscribe preview flow handles quiet periods (no blank emails)', () => {
  assert(read('frontend/content-radar/js/subscribe.js').includes('data.quiet'),
    'subscribe.js does not handle quiet preview responses');
  assert(read('backend/routes/radar.js').includes('quiet: true'),
    'send-preview endpoint never reports quiet periods');
});

check('success screen decodes radar type (never shows topic:/leads:/learn:)', () => {
  const src = read('frontend/content-radar/js/subscribe.js');
  assert(src.includes('labelByType') || src.includes('decodeRadarTarget'),
    'showSuccess does not decode the radar target for display');
});

check('insightsSections.js loads before ui.js in index.html', () => {
  const html = read('frontend/index.html');
  const a = html.indexOf('js/insightsSections.js');
  const b = html.indexOf('js/ui.js');
  assert(a !== -1 && b !== -1 && a < b, 'script order wrong: shared builders must load before ui.js');
});

// ────────────────────────────────────────────────────────────
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
