(function () {
  'use strict';

  var STATUS_LABEL = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' };
  var ROLE_LABEL = { requester: 'ผู้ขอเบิก', approver: 'ผู้อนุมัติ' };
  var session = null;
  var materials = [];
  var sites = [];

  function $(id) { return document.getElementById(id); }

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem('mr-session') || 'null'); } catch (e) { return null; }
  }
  function saveSession(value) {
    try {
      if (value) sessionStorage.setItem('mr-session', JSON.stringify(value));
      else sessionStorage.removeItem('mr-session');
    } catch (e) { /* storage unavailable */ }
  }

  function api(method, url, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (session) headers.Authorization = 'Bearer ' + session.token;
    return fetch(url, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.status === 401 && session) logout();
          return { status: res.status, data: data };
        });
      });
  }

  function setMessage(el, text, kind) {
    el.textContent = text;
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function option(value, text) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  function showLogin() {
    $('login-view').hidden = false;
    $('main-view').hidden = true;
  }

  function logout() {
    session = null;
    saveSession(null);
    ['action-message', 'create-message'].forEach(function (id) { setMessage($(id), ''); });
    showLogin();
  }

  function showMain() {
    $('login-view').hidden = true;
    $('main-view').hidden = false;
    $('who').textContent = session.displayName + ' (' + ROLE_LABEL[session.role] + ')';
    $('create-section').hidden = session.role !== 'requester';
    $('action-head').hidden = session.role !== 'approver';
    Promise.all([api('GET', '/api/materials'), api('GET', '/api/sites')]).then(function (r) {
      if (r[0].status !== 200 || r[1].status !== 200) return;
      materials = r[0].data || [];
      sites = r[1].data || [];
      var mat = $('material');
      mat.innerHTML = '';
      mat.appendChild(option('', 'เลือกวัสดุ'));
      materials.forEach(function (m) { mat.appendChild(option(m.code, m.code + ' ' + m.name + ' (' + m.unit + ')')); });
      var site = $('site');
      site.innerHTML = '';
      site.appendChild(option('', 'เลือกไซต์งาน'));
      sites.forEach(function (s) { site.appendChild(option(s.code, s.name)); });
      var fsite = $('f-site');
      fsite.innerHTML = '';
      fsite.appendChild(option('', 'ทั้งหมด'));
      sites.forEach(function (s) { fsite.appendChild(option(s.code, s.name)); });
      loadRows();
    });
  }

  function currentFilters() {
    var params = new URLSearchParams();
    [['status', 'f-status'], ['site', 'f-site'], ['from', 'f-from'], ['to', 'f-to'], ['q', 'f-q']].forEach(function (pair) {
      var v = $(pair[1]).value.trim();
      if (v) params.set(pair[0], v);
    });
    return params.toString();
  }

  function cell(text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  function actionCell(row) {
    var td = document.createElement('td');
    if (row.status !== 'pending') return td;
    var box = document.createElement('div');
    box.className = 'row-actions';

    var approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'primary';
    approve.textContent = 'อนุมัติ';
    approve.setAttribute('data-testid', 'approve-' + row.id);
    approve.addEventListener('click', function () { decide(row.id, 'approve'); });

    var inline = document.createElement('div');
    inline.className = 'inline';
    var label = document.createElement('label');
    label.className = 'sr-only';
    label.setAttribute('for', 'reason-' + row.id);
    label.textContent = 'เหตุผลที่ไม่อนุมัติ ' + row.id;
    var reason = document.createElement('input');
    reason.id = 'reason-' + row.id;
    reason.placeholder = 'เหตุผล';
    reason.setAttribute('data-testid', 'reject-reason-' + row.id);
    var reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'danger';
    reject.textContent = 'ไม่อนุมัติ';
    reject.setAttribute('data-testid', 'reject-' + row.id);
    reject.addEventListener('click', function () { decide(row.id, 'reject', reason.value); });
    inline.appendChild(label);
    inline.appendChild(reason);
    inline.appendChild(reject);

    box.appendChild(approve);
    box.appendChild(inline);
    td.appendChild(box);
    return td;
  }

  function render(rows) {
    var body = $('rows');
    body.innerHTML = '';
    if (!rows.length) {
      var tr = document.createElement('tr');
      var td = cell('ไม่พบรายการ');
      td.colSpan = 9;
      tr.appendChild(td);
      body.appendChild(tr);
    }
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-testid', 'row-' + r.id);
      tr.appendChild(cell(r.id));
      tr.appendChild(cell(formatThaiDate(r.needDate)));
      tr.appendChild(cell(r.itemName));
      tr.appendChild(cell(r.qty + ' ' + r.unit, 'num'));
      tr.appendChild(cell(r.siteName));
      tr.appendChild(cell(r.requester));
      tr.appendChild(cell(formatMoney(r.net), 'num'));
      var st = document.createElement('td');
      var pill = document.createElement('span');
      pill.className = 'status ' + r.status;
      pill.textContent = STATUS_LABEL[r.status];
      st.appendChild(pill);
      tr.appendChild(st);
      if (session.role === 'approver') tr.appendChild(actionCell(r));
      body.appendChild(tr);
    });
    $('total-net').textContent = formatMoney(sumNet(rows));
  }

  function loadRows() {
    var qs = currentFilters();
    api('GET', '/api/requests' + (qs ? '?' + qs : '')).then(function (r) {
      if (r.status === 200) render(r.data);
      else setMessage($('action-message'), r.data.error || 'โหลดรายการไม่สำเร็จ', 'err');
    });
  }

  function decide(id, action, reason) {
    var body = action === 'reject' ? { reason: reason } : {};
    api('POST', '/api/requests/' + id + '/' + action, body).then(function (r) {
      if (r.status === 200) {
        setMessage($('action-message'), (action === 'approve' ? 'อนุมัติ ' : 'ไม่อนุมัติ ') + id + ' แล้ว', 'ok');
        loadRows();
      } else {
        setMessage($('action-message'), r.data.error || 'ทำรายการไม่สำเร็จ', 'err');
      }
    });
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    setMessage($('login-error'), '', 'err');
    api('POST', '/api/login', { username: $('username').value.trim(), password: $('password').value }).then(function (r) {
      if (r.status === 200) {
        session = r.data;
        saveSession(session);
        $('password').value = '';
        showMain();
      } else {
        setMessage($('login-error'), r.data.error || 'เข้าสู่ระบบไม่สำเร็จ', 'err');
      }
    });
  });

  $('logout').addEventListener('click', logout);

  $('create-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('create-message');
    var itemCode = $('material').value;
    var site = $('site').value;
    if (!itemCode || !site) {
      setMessage(msg, 'กรุณาเลือกวัสดุและไซต์งาน', 'err');
      return;
    }
    var rawQty = $('qty').value.trim();
    var payload = {
      itemCode: itemCode,
      qty: rawQty === '' ? null : Number(rawQty),
      site: site,
      needDate: $('need-date').value.trim(),
      note: $('note').value,
    };
    api('POST', '/api/requests', payload).then(function (r) {
      if (r.status === 201) {
        setMessage(msg, 'บันทึกคำขอ ' + r.data.id + ' แล้ว ยอดสุทธิ ' + formatMoney(r.data.net) + ' บาท', 'ok');
        loadRows();
      } else {
        setMessage(msg, r.data.error || 'บันทึกไม่สำเร็จ', 'err');
      }
    });
  });

  $('filter-form').addEventListener('submit', function (e) {
    e.preventDefault();
    loadRows();
  });

  $('filter-clear').addEventListener('click', function () {
    ['f-status', 'f-site', 'f-from', 'f-to', 'f-q'].forEach(function (id) { $(id).value = ''; });
    loadRows();
  });

  session = loadSession();
  if (session) showMain();
  else showLogin();
})();
