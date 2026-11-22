// Slide viewer for index.html: fits the 1920x1080 canvas to the window, moves between slides and click steps
// (.fragment, reveal.js style), keeps #N in the address bar, and adds copy buttons to prompt boxes (.code).
(function () {
  'use strict';
  var deck = document.querySelector('.deck');
  var slides = Array.prototype.slice.call(deck.children).filter(function (el) { return el.tagName === 'SECTION'; });
  var pos = document.querySelector('.bar .pos');
  var cur = -1;
  var step = 0;
  var groups = [];
  var timers = new Map();

  function fit() {
    deck.style.setProperty('--s', Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
  }

  // Click steps: elements with data-fragment-index go first (lowest first, one index = one click), then the rest in document order.
  function groupsOf(slide) {
    var indexed = {};
    var rest = [];
    slide.querySelectorAll('.fragment').forEach(function (el) {
      var k = el.getAttribute('data-fragment-index');
      if (k === null) rest.push([el]);
      else (indexed[k] = indexed[k] || []).push(el);
    });
    return Object.keys(indexed).sort(function (a, b) { return a - b; })
      .map(function (k) { return indexed[k]; }).concat(rest);
  }

  function paint() {
    groups.forEach(function (g, n) {
      g.forEach(function (el) {
        el.classList.toggle('visible', n < step);
        el.classList.toggle('current-fragment', n === step - 1);
      });
    });
  }

  function show(i, atEnd) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i !== cur) {
      var dir = i < cur ? -1 : 1;
      var old = slides[cur];
      var next = slides[i];
      var push = old && old.getAttribute('data-transition') === 'push';
      deck.style.setProperty('--dir', dir);
      if (old) {
        old.classList.remove('active');
        old.classList.add('leaving');
        old.classList.toggle('push', push);
        clearTimeout(timers.get(old));
        timers.set(old, setTimeout(function () { old.classList.remove('leaving', 'push'); }, 500));
      }
      clearTimeout(timers.get(next));
      next.classList.remove('leaving');
      next.classList.toggle('push', push);
      next.classList.add('active');
      cur = i;
    }
    groups = groupsOf(slides[cur]);
    step = atEnd ? groups.length : 0;
    paint();
    pos.textContent = (cur + 1) + ' / ' + slides.length;
    if (location.hash !== '#' + (cur + 1)) history.replaceState(null, '', '#' + (cur + 1));
  }

  function forward() {
    if (step < groups.length) { step++; paint(); } else if (cur < slides.length - 1) show(cur + 1);
  }
  function back() {
    if (step > 0) { step--; paint(); } else if (cur > 0) show(cur - 1, true);
  }

  // #12 = slide 12; #ws-git = the slide with that id
  function fromHash() {
    var h = location.hash.slice(1); // slide ids are ASCII, so no decoding (a malformed #% would throw)
    if (/^\d+$/.test(h)) return Number(h) - 1;
    for (var n = 0; n < slides.length; n++) if (slides[n].id === h) return n;
    return 0;
  }

  function toggleFull() {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }

  function copyText(text, btn, nodes) {
    function flash(msg) {
      btn.textContent = msg;
      btn.classList.add('ok');
      setTimeout(function () { btn.textContent = 'คัดลอก'; btn.classList.remove('ok'); }, 1600);
    }
    function fallback() {
      var range = document.createRange();
      range.setStartBefore(nodes[0]);
      range.setEndAfter(nodes[nodes.length - 1]);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      flash('กด Ctrl+C');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash('คัดลอกแล้ว'); }, fallback);
    } else {
      fallback();
    }
  }

  // A prompt box may hold several parts, each starting with <span class="label">; the label is not copied.
  // data-copy="off" on the box or a label skips it (values that are not pasted into Codex as one message).
  function addCopyButtons() {
    document.querySelectorAll('.deck .code').forEach(function (box) {
      if (box.getAttribute('data-copy') === 'off') return;
      var chunks = [];
      var chunk = null;
      Array.prototype.slice.call(box.childNodes).forEach(function (node) {
        if (node.nodeType === 1 && node.classList.contains('label')) {
          chunk = { label: node, nodes: [] };
          chunks.push(chunk);
          return;
        }
        if (!chunk) { chunk = { label: null, nodes: [] }; chunks.push(chunk); }
        chunk.nodes.push(node);
      });
      chunks.forEach(function (c, n) {
        if (c.label && c.label.getAttribute('data-copy') === 'off') return;
        var text = c.nodes.map(function (node) {
          return node.nodeName === 'BR' ? '\n' : node.textContent.replace(/\s*\n\s*/g, ' ');
        }).join('').replace(/^\n+|\n+$/g, '');
        if (!text.trim()) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy';
        btn.textContent = 'คัดลอก';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          copyText(text, btn, c.nodes);
        });
        if (n === 0) {
          box.insertBefore(btn, c.label || c.nodes[0]); // first part: tab on the box's top edge
        } else {
          btn.classList.add('inline'); // a later part: right after its label, so it is clear which part it copies
          box.insertBefore(btn, c.label.nextSibling);
        }
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var onControl = e.target.closest && e.target.closest('button, a, input, textarea, select');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': forward(); break;
      case ' ': case 'Enter':
        if (onControl) return;
        if (e.shiftKey) back(); else forward();
        break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': back(); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1); break;
      case 'f': case 'F': toggleFull(); break;
      default: return;
    }
    e.preventDefault();
  });

  // Click the left 30% to go back, anywhere else to go forward; clicks on controls, prompt boxes or a text selection do nothing.
  document.addEventListener('click', function (e) {
    // a mouse click leaves focus on the button; drop it so Space/Enter turn the slide instead of pressing that button again
    var control = e.target.closest('button, a');
    if (control && e.detail > 0) control.blur();
    if (e.target.closest('button, a, .code, .bar, .hint')) return;
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (e.clientX < window.innerWidth * 0.3) back(); else forward();
  });

  var touchX = null;
  var touchY = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchX = null; return; }
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchX;
    var dy = t.clientY - touchY;
    touchX = null;
    if (window.visualViewport && window.visualViewport.scale > 1.05) return; // zoomed in: let the finger pan
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) forward(); else back(); }
  });

  document.querySelector('.bar').addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (!go) return;
    var what = go.getAttribute('data-go');
    if (what === 'prev') back();
    else if (what === 'next') forward();
    else toggleFull();
  });
  if (!document.fullscreenEnabled) document.querySelector('[data-go="full"]').hidden = true;

  // The toolbar fades out after the mouse rests, so it stays off the projector.
  var idle;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idle);
    idle = setTimeout(function () { document.body.classList.add('idle'); }, 2500);
  }
  ['mousemove', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, wake, { passive: true }); });

  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', function () { show(fromHash()); });
  addCopyButtons();
  fit();
  show(fromHash());
  wake();
})();
