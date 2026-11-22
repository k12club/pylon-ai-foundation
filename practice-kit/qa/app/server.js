'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3100;
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MATERIALS = [
  { code: 'MAT-001', name: 'ปูนซีเมนต์ปอร์ตแลนด์', unit: 'ถุง', price: 14250 },
  { code: 'MAT-002', name: 'เหล็กเส้นข้ออ้อย DB12', unit: 'เส้น', price: 18725 },
  { code: 'MAT-003', name: 'ทรายหยาบ', unit: 'ลบ.ม.', price: 42000 },
  { code: 'MAT-004', name: 'อิฐมวลเบา', unit: 'ก้อน', price: 2175 },
  { code: 'MAT-005', name: 'กระเบื้องหลังคา', unit: 'แผ่น', price: 5890 },
  { code: 'MAT-006', name: 'ท่อพีวีซี 4 นิ้ว', unit: 'ท่อน', price: 31500 },
  { code: 'MAT-007', name: 'สีรองพื้นปูนใหม่', unit: 'ถัง', price: 129000 },
  { code: 'MAT-008', name: 'น้ำยากันซึม', unit: 'แกลลอน', price: 46535 },
];

const SITES = [
  { code: 'SITE-A', name: 'โครงการอาคารสำนักงานริมน้ำ' },
  { code: 'SITE-B', name: 'โครงการคลังสินค้าทุ่งทอง' },
  { code: 'SITE-C', name: 'โครงการหมู่บ้านสวนสัก' },
];

const USERS = [
  { username: 'requester1', password: 'demo1234', role: 'requester', displayName: 'ผู้ขอเบิก 1' },
  { username: 'requester2', password: 'demo1234', role: 'requester', displayName: 'ผู้ขอเบิก 2' },
  { username: 'approver1', password: 'demo1234', role: 'approver', displayName: 'ผู้อนุมัติ 1' },
];

const SEED = [
  ['requester1', 'MAT-001', 40, 'SITE-A', '2027-01-11', 'เทพื้นชั้น 2', 'pending'],
  ['requester1', 'MAT-002', 120, 'SITE-A', '2027-01-12', '', 'approved'],
  ['requester2', 'MAT-003', 15, 'SITE-B', '2027-01-15', 'ส่งช่วงเช้า', 'pending'],
  ['requester2', 'MAT-004', 500, 'SITE-B', '2027-01-15', '', 'rejected'],
  ['requester1', 'MAT-005', 200, 'SITE-C', '2027-01-20', 'งานหลังคาโรงจอดรถ', 'pending'],
  ['requester2', 'MAT-006', 30, 'SITE-C', '2027-01-20', '', 'approved'],
  ['requester1', 'MAT-007', 12, 'SITE-A', '2027-01-31', 'ทาสีรองพื้นอาคาร B', 'pending'],
  ['requester2', 'MAT-008', 20, 'SITE-B', '2027-02-01', '', 'pending'],
];

const tokens = new Map();
let requests = [];
let nextNumber = 1;

function amounts(qty, price) {
  const subtotal = qty * price;
  const vat = Math.floor(subtotal * 7 / 100);
  return { subtotal, vat, net: subtotal + vat };
}

function makeRequest(requester, itemCode, unitPrice, qty, site, needDate, note, status) {
  const money = amounts(qty, unitPrice);
  const id = 'MR-' + String(nextNumber).padStart(4, '0');
  nextNumber += 1;
  const row = {
    id, requester, itemCode, qty, site, needDate, note, status,
    subtotal: money.subtotal, vat: money.vat, net: money.net,
    decidedBy: null, rejectReason: null,
  };
  if (status === 'rejected') {
    row.decidedBy = 'approver1';
    row.rejectReason = 'เกินงบประมาณของงวดนี้';
  } else if (status === 'approved') {
    row.decidedBy = 'approver1';
  }
  requests.push(row);
  return row;
}

function resetData() {
  requests = [];
  nextNumber = 1;
  for (const [requester, itemCode, qty, site, needDate, note, status] of SEED) {
    const unitPrice = MATERIALS.find((m) => m.code === itemCode).price;
    makeRequest(requester, itemCode, unitPrice, qty, site, needDate, note, status);
  }
}

function baht(satang) {
  return satang / 100;
}

function toApi(row) {
  const material = MATERIALS.find((m) => m.code === row.itemCode);
  const site = SITES.find((s) => s.code === row.site);
  return {
    id: row.id,
    requester: row.requester,
    itemCode: row.itemCode,
    itemName: material.name,
    unit: material.unit,
    unitPrice: baht(material.price),
    qty: row.qty,
    site: row.site,
    siteName: site.name,
    needDate: row.needDate,
    note: row.note,
    status: row.status,
    subtotal: baht(row.subtotal),
    vat: baht(row.vat),
    net: baht(row.net),
    decidedBy: row.decidedBy,
    rejectReason: row.rejectReason,
  };
}

function isValidDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  try {
    const value = JSON.parse(raw.replace(/^\uFEFF/, ''));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ok: false };
    return { ok: true, value };
  } catch (e) {
    return { ok: false };
  }
}

function currentUser(req) {
  const header = req.headers['authorization'] || '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return null;
  return tokens.get(match[1]) || null;
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/format.js': ['format.js', 'text/javascript; charset=utf-8'],
};

function serveStatic(res, file, type) {
  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, { error: 'ไม่พบหน้าที่ต้องการ' });
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function filterError(query) {
  const status = query.get('status');
  if (status && !['pending', 'approved', 'rejected'].includes(status)) return 'ไม่พบสถานะนี้';
  const site = query.get('site');
  if (site && !SITES.some((s) => s.code === site)) return 'ไม่พบไซต์งานนี้';
  for (const name of ['from', 'to']) {
    const value = query.get(name);
    if (value && !isValidDate(value)) return 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD';
  }
  return null;
}

function listRequests(query) {
  const status = query.get('status') || '';
  const site = query.get('site') || '';
  const from = query.get('from') || '';
  const to = query.get('to') || '';
  const q = (query.get('q') || '').trim().toLowerCase().replace(/[^a-z0-9ก-ฮ \-]/g, '');
  let rows = requests.slice();
  if (status) rows = rows.filter((r) => r.status === status);
  if (site) rows = rows.filter((r) => r.site === site);
  if (from) rows = rows.filter((r) => r.needDate >= from);
  if (to) rows = rows.filter((r) => r.needDate < to);
  if (q) {
    rows = rows.filter((r) => {
      const material = MATERIALS.find((m) => m.code === r.itemCode);
      const haystack = [material.name, material.code, r.note].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }
  rows.sort((a, b) => (a.id < b.id ? 1 : -1));
  return rows.map(toApi);
}

async function createRequest(req, res, user) {
  if (user.role !== 'requester') return send(res, 403, { error: 'บทบาทนี้สร้างคำขอไม่ได้' });
  const parsed = await readJson(req);
  if (!parsed.ok) return send(res, 400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
  const { itemCode, qty, site, needDate } = parsed.value;
  const note = parsed.value.note === undefined || parsed.value.note === null ? '' : parsed.value.note;

  if (!SITES.some((s) => s.code === site)) return send(res, 400, { error: 'ไม่พบไซต์งานนี้' });
  if (!isValidDate(needDate)) return send(res, 400, { error: 'วันที่ต้องการใช้ต้องอยู่ในรูปแบบ YYYY-MM-DD' });
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 0 || qty > 500) {
    return send(res, 400, { error: 'จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 500' });
  }
  if (typeof note !== 'string') return send(res, 400, { error: 'หมายเหตุต้องเป็นข้อความ' });
  if (Buffer.byteLength(note) > 200) return send(res, 400, { error: 'หมายเหตุยาวได้ไม่เกิน 200 ตัวอักษร' });

  const unitPrice = MATERIALS.find((m) => m.code === itemCode).price;
  const mine = requests.filter((r) => r.requester === user.username);
  const last = mine[mine.length - 1];
  if (last && last.status === 'pending' && last.itemCode === itemCode && last.site === site && last.needDate === needDate) {
    return send(res, 409, { error: 'มีคำขอนี้อยู่แล้ว' });
  }
  const row = makeRequest(user.username, itemCode, unitPrice, qty, site, needDate, note, 'pending');
  return send(res, 201, toApi(row));
}

function approveRequest(res, user, id) {
  const row = requests.find((r) => r.id === id);
  if (!row) return send(res, 404, { error: 'ไม่พบคำขอ' });
  if (row.status !== 'pending') return send(res, 409, { error: 'คำขอนี้ตัดสินแล้ว' });
  row.status = 'approved';
  row.decidedBy = user.username;
  return send(res, 200, toApi(row));
}

async function rejectRequest(req, res, user, id) {
  if (user.role !== 'approver') return send(res, 403, { error: 'เฉพาะผู้อนุมัติเท่านั้น' });
  const row = requests.find((r) => r.id === id);
  if (!row) return send(res, 404, { error: 'ไม่พบคำขอ' });
  const parsed = await readJson(req);
  if (!parsed.ok) return send(res, 400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
  const reason = typeof parsed.value.reason === 'string' ? parsed.value.reason.trim() : '';
  if (reason.length < 1 || reason.length > 200) {
    return send(res, 400, { error: 'ต้องระบุเหตุผล 1 ถึง 200 ตัวอักษร' });
  }
  row.status = 'rejected';
  row.decidedBy = user.username;
  row.rejectReason = reason;
  return send(res, 200, toApi(row));
}

async function route(req, res) {
  const url = new URL(req.url.replace(/^\/+/, '/'), 'http://' + HOST);
  const p = url.pathname;

  if (req.method === 'GET' && STATIC[p]) {
    const [file, type] = STATIC[p];
    return serveStatic(res, path.join(PUBLIC_DIR, file), type);
  }
  if (req.method === 'GET' && p === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && p === '/openapi.json') {
    return serveStatic(res, path.join(__dirname, 'openapi.json'), 'application/json; charset=utf-8');
  }

  if (req.method === 'POST' && p === '/api/login') {
    const parsed = await readJson(req);
    if (!parsed.ok) return send(res, 400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
    const { username, password } = parsed.value;
    const found = USERS.find((u) => u.username === username && u.password === password);
    if (!found) return send(res, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const token = crypto.randomUUID();
    tokens.set(token, { username: found.username, role: found.role });
    return send(res, 200, { token, username: found.username, role: found.role, displayName: found.displayName });
  }

  if (!p.startsWith('/api/')) return send(res, 404, { error: 'ไม่พบหน้าที่ต้องการ' });

  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'กรุณาเข้าสู่ระบบ' });

  if (req.method === 'GET' && p === '/api/materials') {
    return send(res, 200, MATERIALS.map((m) => ({ code: m.code, name: m.name, unit: m.unit, unitPrice: baht(m.price) })));
  }
  if (req.method === 'GET' && p === '/api/sites') return send(res, 200, SITES);
  if (req.method === 'GET' && p === '/api/requests') {
    const problem = filterError(url.searchParams);
    if (problem) return send(res, 400, { error: problem });
    return send(res, 200, listRequests(url.searchParams));
  }
  if (req.method === 'POST' && p === '/api/requests') return createRequest(req, res, user);
  if (req.method === 'POST' && p === '/api/reset') {
    resetData();
    return send(res, 200, { ok: true, count: requests.length });
  }

  const one = /^\/api\/requests\/(MR-\d{4})(\/approve|\/reject)?$/.exec(p);
  if (one) {
    const [, id, action] = one;
    if (req.method === 'GET' && !action) {
      const row = requests.find((r) => r.id === id);
      return row ? send(res, 200, toApi(row)) : send(res, 404, { error: 'ไม่พบคำขอ' });
    }
    if (req.method === 'POST' && action === '/approve') return approveRequest(res, user, id);
    if (req.method === 'POST' && action === '/reject') return rejectRequest(req, res, user, id);
  }
  return send(res, 404, { error: 'ไม่พบหน้าที่ต้องการ' });
}

resetData();

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error('Request failed:', req.method, req.url, '-', err && err.message);
    if (!res.headersSent) send(res, 500, { error: 'Internal Server Error' });
    else res.end();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Try: $env:PORT = "3101"; node server.js');
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error('Port ' + PORT + ' is not allowed on this machine. Try: $env:PORT = "3101"; node server.js');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log('Material request demo is running at http://' + HOST + ':' + PORT);
  console.log('Press Ctrl+C to stop.');
});
