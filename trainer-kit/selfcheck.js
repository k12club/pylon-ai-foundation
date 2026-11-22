'use strict';
// Trainer-only self-check for practice-kit. Node built-ins only (Node 18+ for global fetch).
// Usage: node trainer-kit/selfcheck.js

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const KIT = path.join(ROOT, 'practice-kit');
const APP = path.join(KIT, 'qa', 'app');
const SERVER = path.join(APP, 'server.js');

let BASE = '';
const results = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function http(method, url, { body, token, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

async function login(username, password = 'demo1234') {
  const r = await http('POST', '/api/login', { body: { username, password } });
  if (r.status !== 200) throw new Error('login ' + username + ' -> ' + r.status);
  return r.data.token;
}

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(label + ': expected ' + e + ', got ' + a);
}

const ids = (rows) => rows.map((r) => r.id);
const create = (token, body) => http('POST', '/api/requests', { body, token });
const list = (token, qs) => http('GET', '/api/requests' + (qs ? '?' + qs : ''), { token });
const base = (over) => Object.assign({ itemCode: 'MAT-004', qty: 5, site: 'SITE-A', needDate: '2027-03-01' }, over);

function loadFormat() {
  let code = fs.readFileSync(path.join(APP, 'public', 'format.js'), 'utf8');
  if (code.charCodeAt(0) === 0xfeff) code = code.slice(1);
  const ctx = {};
  vm.runInNewContext(code, ctx);
  return ctx;
}

const checks = [
  // ---- planted faults: each must reproduce exactly ----
  { id: 'BUG-01', kind: 'bug', clause: 'REQ-05', fn: async (t) => {
    const r = await create(t.r1, base({ qty: 0 }));
    eq(r.status, 201, 'qty 0 status');
    eq(r.data.net, 0, 'qty 0 net');
  } },
  { id: 'BUG-02', kind: 'bug', clause: 'REQ-06', fn: async (t) => {
    const r = await create(t.r1, base({ note: 'ก'.repeat(67) }));
    eq(r.status, 400, '67 Thai chars status');
  } },
  { id: 'BUG-03', kind: 'bug', clause: 'REQ-07', fn: async (t) => {
    eq((await create(t.r1, base({ itemCode: 'MAT-999' }))).status, 500, 'unknown material status');
    const missing = base();
    delete missing.itemCode;
    eq((await create(t.r1, missing)).status, 500, 'missing material status');
    eq((await http('GET', '/api/materials', { token: t.r1 })).status, 200, 'server alive after 500');
  } },
  { id: 'BUG-04', kind: 'bug', clause: 'REQ-08', fn: async (t) => {
    const a = await create(t.r1, base({ itemCode: 'MAT-004', qty: 7 }));
    eq([a.status, a.data.subtotal, a.data.vat, a.data.net], [201, 152.25, 10.65, 162.9], 'MAT-004 x7');
    const b = await create(t.r1, base({ itemCode: 'MAT-001', qty: 3, needDate: '2027-03-02' }));
    eq([b.status, b.data.vat, b.data.net], [201, 29.92, 457.42], 'MAT-001 x3');
  } },
  { id: 'BUG-05', kind: 'bug', clause: 'REQ-09', fn: async (t) => {
    const r = await create(t.r1, { itemCode: 'MAT-001', qty: 10, site: 'SITE-A', needDate: '2027-01-11' });
    eq(r.status, 201, 'same as pending MR-0001 status');
  } },
  { id: 'BUG-06', kind: 'bug', clause: 'REQ-12', fn: async (t) => {
    eq(ids((await list(t.r1, 'from=2027-01-15&to=2027-01-20')).data), ['MR-0004', 'MR-0003'], 'range 15-20');
    eq(ids((await list(t.r1, 'to=2027-01-15')).data), ['MR-0002', 'MR-0001'], 'to 15');
    eq(ids((await list(t.r1, 'from=2027-01-15&to=2027-01-15')).data), [], 'from=to 15');
  } },
  { id: 'BUG-07', kind: 'bug', clause: 'REQ-13', fn: async (t) => {
    eq(ids((await list(t.r1, 'q=' + encodeURIComponent('ทราย'))).data), [], 'q ทราย');
    eq(ids((await list(t.r1, 'q=' + encodeURIComponent('สี'))).data), ['MR-0007', 'MR-0003', 'MR-0002'], 'q สี');
    eq(ids((await list(t.r1, 'q=' + encodeURIComponent('ปูน'))).data), [], 'q ปูน');
  } },
  { id: 'BUG-08', kind: 'bug', clause: 'REQ-14', fn: async (t) => {
    const f = loadFormat();
    const rows = (await list(t.r1)).data;
    eq(f.formatMoney(f.sumNet(rows)), '97,757.34', 'footer total, unfiltered');
    const html = fs.readFileSync(path.join(APP, 'public', 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(APP, 'public', 'app.js'), 'utf8');
    eq(html.includes('/format.js') && html.includes('/app.js'), true, 'index loads scripts');
    eq(app.includes('sumNet(rows)'), true, 'app uses sumNet on displayed rows');
  } },
  { id: 'BUG-09', kind: 'bug', clause: 'REQ-15', fn: async (t) => {
    const r = await http('POST', '/api/requests/MR-0003/approve', { token: t.r1 });
    eq([r.status, r.data.status], [200, 'approved'], 'requester approves');
  } },
  { id: 'BUG-10', kind: 'bug', clause: 'REQ-16', fn: async (t) => {
    const r = await http('POST', '/api/requests/MR-0002/reject', { token: t.ap, body: { reason: 'ทดสอบ' } });
    eq([r.status, r.data.status], [200, 'rejected'], 'reject an approved request');
  } },

  // ---- clean paths: must keep working ----
  { id: 'CLEAN-login', kind: 'clean', clause: 'REQ-01', fn: async () => {
    const ok = await http('POST', '/api/login', { body: { username: 'approver1', password: 'demo1234' } });
    eq([ok.status, ok.data.role], [200, 'approver'], 'login ok');
    const bad = await http('POST', '/api/login', { body: { username: 'requester1', password: 'wrong' } });
    eq([bad.status, bad.data.error], [401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'], 'login bad');
  } },
  { id: 'CLEAN-auth', kind: 'clean', clause: 'REQ-02', fn: async () => {
    eq((await http('GET', '/api/requests')).status, 401, 'no token');
    eq((await http('GET', '/api/requests', { token: 'nope' })).status, 401, 'bad token');
    eq((await http('POST', '/api/reset')).status, 401, 'reset without token');
  } },
  { id: 'CLEAN-role', kind: 'clean', clause: 'REQ-03', fn: async (t) => {
    eq((await create(t.ap, base())).status, 403, 'approver create');
  } },
  { id: 'CLEAN-create', kind: 'clean', clause: 'REQ-04/08', fn: async (t) => {
    const r = await create(t.r1, { itemCode: 'MAT-003', qty: 2, site: 'SITE-B', needDate: '2027-03-01' });
    eq([r.status, r.data.id, r.data.status, r.data.subtotal, r.data.vat, r.data.net], [201, 'MR-0009', 'pending', 840, 58.8, 898.8], 'create example');
  } },
  { id: 'CLEAN-qty', kind: 'clean', clause: 'REQ-05', fn: async (t) => {
    eq((await create(t.r1, base({ qty: 1, needDate: '2027-03-01' }))).status, 201, 'qty 1');
    eq((await create(t.r1, base({ qty: 500, needDate: '2027-03-02' }))).status, 201, 'qty 500');
    for (const q of [501, -1, 1.5, '10', null]) {
      eq((await create(t.r1, base({ qty: q, needDate: '2027-03-03' }))).status, 400, 'qty ' + JSON.stringify(q));
    }
  } },
  { id: 'CLEAN-note', kind: 'clean', clause: 'REQ-06', fn: async (t) => {
    eq((await create(t.r1, base({ note: 'a'.repeat(200) }))).status, 201, 'note 200');
    eq((await create(t.r1, base({ note: 'a'.repeat(201), needDate: '2027-03-04' }))).status, 400, 'note 201');
  } },
  { id: 'CLEAN-input', kind: 'clean', clause: 'REQ-07', fn: async (t) => {
    eq((await create(t.r1, base({ site: 'SITE-Z' }))).status, 400, 'unknown site');
    eq((await create(t.r1, base({ needDate: '2027-02-30' }))).status, 400, 'bad calendar date');
    eq((await create(t.r1, base({ needDate: '01/03/2027' }))).status, 400, 'bad date format');
    eq((await http('POST', '/api/requests', { token: t.r1, raw: '{"itemCode":' })).status, 400, 'malformed json');
    const bomBody = '﻿' + JSON.stringify(base({ needDate: '2027-03-07' }));
    eq((await http('POST', '/api/requests', { token: t.r1, raw: bomBody })).status, 201, 'JSON body with BOM');
    eq((await http('GET', '//')).status, 200, 'double-slash path');
    eq((await http('GET', '/favicon.ico')).status, 204, 'favicon');
  } },
  { id: 'CLEAN-rounding', kind: 'clean', clause: 'REQ-08', fn: async (t) => {
    const a = await create(t.r1, base({ itemCode: 'MAT-004', qty: 1 }));
    eq([a.data.vat, a.data.net], [1.52, 23.27], 'MAT-004 x1');
    const b = await create(t.r1, base({ itemCode: 'MAT-008', qty: 1, needDate: '2027-03-05' }));
    eq([b.data.vat, b.data.net], [32.57, 497.92], 'MAT-008 x1');
  } },
  { id: 'CLEAN-duplicate', kind: 'clean', clause: 'REQ-09', fn: async (t) => {
    const p = base({ needDate: '2027-03-06' });
    eq((await create(t.r1, p)).status, 201, 'first');
    const again = await create(t.r1, p);
    eq([again.status, again.data.error], [409, 'มีคำขอนี้อยู่แล้ว'], 'immediate resubmit');
    eq((await create(t.r2, p)).status, 201, 'other requester same payload');
  } },
  { id: 'CLEAN-list', kind: 'clean', clause: 'REQ-10', fn: async (t) => {
    eq(ids((await list(t.r1)).data), ['MR-0008', 'MR-0007', 'MR-0006', 'MR-0005', 'MR-0004', 'MR-0003', 'MR-0002', 'MR-0001'], 'default order');
  } },
  { id: 'CLEAN-filter', kind: 'clean', clause: 'REQ-11', fn: async (t) => {
    eq(ids((await list(t.r1, 'status=pending&site=SITE-A')).data), ['MR-0007', 'MR-0001'], 'status+site');
    eq(ids((await list(t.r1, 'status=rejected')).data), ['MR-0004'], 'status only');
    eq((await list(t.r1, 'site=SITE-Z')).status, 400, 'unknown site filter');
    eq((await list(t.r1, 'status=foo')).status, 400, 'unknown status filter');
    eq((await list(t.r1, 'from=' + encodeURIComponent('15/01/2570'))).status, 400, 'Thai-style date filter');
  } },
  { id: 'CLEAN-from', kind: 'clean', clause: 'REQ-12', fn: async (t) => {
    eq(ids((await list(t.r1, 'from=2027-01-20')).data), ['MR-0008', 'MR-0007', 'MR-0006', 'MR-0005'], 'from only');
  } },
  { id: 'CLEAN-search', kind: 'clean', clause: 'REQ-13', fn: async (t) => {
    eq(ids((await list(t.r1, 'q=MAT-003')).data), ['MR-0003'], 'q code');
    eq(ids((await list(t.r1, 'q=db12')).data), ['MR-0002'], 'q db12');
    eq(ids((await list(t.r1, 'q=' + encodeURIComponent('ทร'))).data), ['MR-0003'], 'q ทร');
  } },
  { id: 'CLEAN-format', kind: 'clean', clause: 'REQ-10', fn: async () => {
    const f = loadFormat();
    eq(f.formatMoney(1234.5), '1,234.50', 'formatMoney');
    eq(f.formatMoney(0), '0.00', 'formatMoney zero');
    eq(f.formatThaiDate('2027-01-11'), '11/01/2570', 'formatThaiDate');
  } },
  { id: 'CLEAN-decide', kind: 'clean', clause: 'REQ-15/16', fn: async (t) => {
    eq((await http('POST', '/api/requests/MR-0003/reject', { token: t.r1, body: { reason: 'x' } })).status, 403, 'requester reject');
    eq((await http('POST', '/api/requests/MR-0003/reject', { token: t.ap, body: {} })).status, 400, 'reject without reason');
    eq((await http('POST', '/api/requests/MR-0002/approve', { token: t.ap })).status, 409, 'approve decided');
    const ok = await http('POST', '/api/requests/MR-0001/approve', { token: t.ap });
    eq([ok.status, ok.data.status, ok.data.decidedBy], [200, 'approved', 'approver1'], 'approve pending');
    const rej = await http('POST', '/api/requests/MR-0005/reject', { token: t.ap, body: { reason: 'งบไม่พอ' } });
    eq([rej.status, rej.data.status, rej.data.rejectReason], [200, 'rejected', 'งบไม่พอ'], 'reject pending');
  } },
  { id: 'CLEAN-404', kind: 'clean', clause: '-', fn: async (t) => {
    eq((await http('GET', '/api/requests/MR-0999', { token: t.r1 })).status, 404, 'missing id');
    eq((await http('GET', '/api/requests/MR-0003', { token: t.r1 })).data.itemCode, 'MAT-003', 'get one');
  } },
  { id: 'CLEAN-reset', kind: 'clean', clause: 'REQ-17', fn: async (t) => {
    await create(t.r1, base());
    eq((await http('POST', '/api/reset', { token: t.r1 })).data.count, 8, 'reset count');
    eq((await list(t.r1)).data.length, 8, 'rows after reset');
    eq((await create(t.r2, base({ needDate: '2027-03-09' }))).data.id, 'MR-0009', 'numbering restarts, old token valid');
  } },
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    out.push(full);
    if (fs.statSync(full).isDirectory()) walk(full, out);
  }
  return out;
}

function leakScan() {
  const banned = /bug|planted|intentional|deliberate|shortcut:|trainer|answer|pylon|เฉลย|บั๊ก|จงใจ/i;
  const problems = [];
  for (const file of walk(KIT)) {
    const rel = path.relative(KIT, file);
    if (path.basename(file).startsWith('.')) problems.push('dotfile ' + rel);
    if (banned.test(rel)) problems.push('name ' + rel);
    if (fs.statSync(file).isDirectory() || /\.(xlsx|zip)$/i.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    // prompts.html repeats the slides' own exercise prompts, which say "หา bug" openly; every other banned word still applies
    const m = rel === 'prompts.html' ? /planted|intentional|deliberate|shortcut:|trainer|answer|pylon|เฉลย|บั๊ก|จงใจ/i.exec(text) : banned.exec(text);
    if (m) problems.push('content ' + rel + ' contains "' + m[0] + '"');
  }
  const spec = fs.readFileSync(path.join(APP, 'openapi.json'));
  if (spec[0] === 0xef) problems.push('openapi.json has a BOM');
  if ([...spec].some((b) => b > 0x7f)) problems.push('openapi.json has non-ASCII bytes');
  JSON.parse(spec.toString('utf8'));
  if (problems.length) throw new Error(problems.join('; '));
}

function dataCheck() {
  const script = path.join(__dirname, 'build_kit.py');
  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];
  for (const exe of candidates) {
    const r = spawnSync(exe, [script, '--check'], { encoding: 'utf8' });
    if (r.error) continue;
    if (r.status !== 0) throw new Error((r.stdout || '') + (r.stderr || ''));
    return r.stdout.trim().split('\n').pop();
  }
  throw new Error('no python interpreter found');
}

async function main() {
  const port = await freePort();
  BASE = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [SERVER], { env: Object.assign({}, process.env, { PORT: String(port) }), stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  try {
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        const r = await fetch(BASE + '/openapi.json');
        if (r.ok) break;
      } catch (e) { /* not up yet */ }
      if (Date.now() > deadline) throw new Error('server did not start: ' + stderr);
      await new Promise((r) => setTimeout(r, 100));
    }
    const tokens = { r1: await login('requester1'), r2: await login('requester2'), ap: await login('approver1') };
    for (const c of checks) {
      try {
        const reset = await http('POST', '/api/reset', { token: tokens.ap });
        if (reset.status !== 200) throw new Error('reset failed ' + reset.status);
        await c.fn(tokens);
        results.push(['PASS', c.id, c.clause, '']);
      } catch (e) {
        results.push(['FAIL', c.id, c.clause, e.message]);
      }
    }
  } finally {
    child.kill();
  }
  for (const [name, fn] of [['LEAK-scan', leakScan], ['DATA-check', dataCheck]]) {
    try {
      const note = fn();
      results.push(['PASS', name, '-', note || '']);
    } catch (e) {
      results.push(['FAIL', name, '-', e.message]);
    }
  }
  for (const [s, id, clause, msg] of results) console.log(s + '  ' + id.padEnd(16) + clause.padEnd(10) + msg);
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? failed + ' check(s) failed' : 'all ' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
