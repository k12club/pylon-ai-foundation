/* เปิดลายน้ำใน watermark.css (ใส่ class wm-on ที่ <html>) เฉพาะตอนที่น่าจะกำลังแคปจอ ใช้ร่วมกันทั้ง index.html, prompts.html, files.html
   - เบราว์เซอร์รู้ไม่ได้จริงว่ามีการแคปจอ จึงดักได้แค่สัญญาณที่หน้านี้ได้รับ:
     Cmd+Shift / Win+Shift (คีย์ลัดแคปจอของ Mac และ Win+Shift+S), ปุ่ม Win บนเครื่องที่ไม่ใช่ Mac และหน้าต่างเสียโฟกัส
   - กดคีย์แล้วค้างไว้ HOLD_MS เพราะแคปแบบเลือกพื้นที่หรือเลือกหน้าต่างจะจับภาพหลังปล่อยคีย์ไปแล้วหลายวินาที
   - เสียโฟกัส (เปิดโปรแกรมแคป, Snipping Tool, สลับไปแอปอื่น) ขึ้นค้างไว้จนกว่าจะกลับมาที่หน้านี้
     สถานะโฟกัสอ่านจาก document.hasFocus() ใหม่ทุกครั้งที่กลับมา (focus, pageshow, กลับมาเห็นหน้า, คลิก) จึงไม่ค้าง
   - Mac ต้องกด Cmd คู่กับ Shift เท่านั้น เพราะ Cmd อย่างเดียวใช้บ่อย (Cmd+C, Cmd+Tab)
   - ฟัง PrtSc ไว้ด้วย แต่บน Windows ส่วนใหญ่เครื่องจับภาพตอนกดลง ส่วนเบราว์เซอร์ส่งมาแค่ตอนปล่อย ลายน้ำจึงมักมาไม่ทัน (PrtSc, Alt+PrtSc)
   - แค่ฟังเหตุการณ์ ไม่ preventDefault ไม่ stopPropagation คีย์ลัดของสไลด์และของเครื่องทำงานตามเดิม
     blur/focus ต้องไม่ใช่ capture เพราะ capture บน window จะได้ blur/focus ของปุ่มทุกตัวด้วย
   - ไม่ได้ผล: แคปด้วยมือถือ ถ่ายรูปจอ แชร์จอหรืออัดจอ ปิด JavaScript และกรณีที่เครื่องจับภาพก่อนหน้าจะวาดลายน้ำทัน */
(function () {
  var HOLD_MS = 10000;
  var root = document.documentElement;
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var blurred = false;
  var timer = 0;

  function on() { root.classList.add('wm-on'); }
  function off() { if (!blurred && !timer) root.classList.remove('wm-on'); }
  function hold() {
    on();
    clearTimeout(timer);
    timer = setTimeout(function () { timer = 0; off(); }, HOLD_MS);
  }
  function sync() {
    blurred = !document.hasFocus();
    if (blurred) on(); else off();
  }

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    var winKey = k === 'Meta' || k === 'OS';
    if (k === 'PrintScreen' || ((e.metaKey || winKey) && e.shiftKey) || (!mac && winKey)) hold();
  }, true);
  window.addEventListener('keyup', function (e) { if (e.key === 'PrintScreen') hold(); }, true);
  window.addEventListener('blur', function () { blurred = true; on(); });
  window.addEventListener('focus', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pointerdown', sync, true);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
  sync();
})();
