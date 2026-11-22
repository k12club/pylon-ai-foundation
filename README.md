# คอร์สอบรมใช้ Codex สำหรับคนในองค์กร

ของสอนสำหรับคอร์สอบรมการใช้ Codex (ในแอป ChatGPT บน Windows) ผู้เรียนมี 2 สาย

- **สาย QA**: ให้ Codex ช่วยเขียน test case, หา bug, เขียนเทสหน้าเว็บและเทส API
- **สายหน่วยงาน**: ให้ Codex ช่วยทำเครื่องมือเล็ก ๆ ไว้ใช้กับงานของตัวเอง เช่น รวมไฟล์ Excel หรือหน้าเว็บคิดราคา

ประมาณ 24 ชั่วโมงต่อคน ใน 5 สัปดาห์ รายละเอียดอยู่ใน [`codex-training-plan.md`](codex-training-plan.md)

## ในนี้มีอะไร

| ไฟล์ / โฟลเดอร์ | คืออะไร |
|---|---|
| `codex-training-plan.md` | แผนคอร์ส: สมมติฐาน, สิ่งที่ต้องเตรียม, โปรแกรมที่ต้องลง, เนื้อหาแต่ละครั้ง, เกณฑ์ผ่าน |
| `install-checklist.local.html` | หน้ารายการติดตั้งโปรแกรมก่อนเรียน เปิดในเบราว์เซอร์ได้เลย |
| `install-checklist.html` | หน้าเดียวกัน แต่เป็นฉบับที่ใช้ publish เป็น Artifact (ไม่มีส่วน `<head>`) |
| `practice-kit/` | ไฟล์ฝึกที่แจกผู้เรียน ข้อมูลทั้งหมดเป็นข้อมูลสมมติ |
| `practice-kit.zip` | `practice-kit/` ที่บีบอัดแล้ว ไฟล์นี้คือไฟล์ที่ส่งให้ผู้เรียน |
| `trainer-kit/` | ของผู้สอน: เฉลย, สคริปต์สร้างไฟล์ฝึก, สคริปต์ตรวจชุดฝึก |

สไลด์ (30 หน้า) และคู่มือเทคนิคอยู่บน claude.ai ต้องได้รับแชร์ก่อนจึงจะเปิดได้

- สไลด์: https://claude.ai/artifact/Ewe5rrSAWMVjmsbErwakFD
- คู่มือ: https://claude.ai/artifact/PX6qKPhs8t5pogKnkE613t

## สำหรับผู้เรียน

1. ลงโปรแกรมให้ครบตาม `install-checklist.local.html`: แอป ChatGPT, Git, Python, Node.js (LTS), VS Code
2. ดาวน์โหลด `practice-kit.zip` แล้วแตกไฟล์ตามขั้นตอนใน [`practice-kit/README.md`](practice-kit/README.md)
3. สาย QA เปิดระบบเบิกวัสดุตัวอย่างตาม [`practice-kit/qa/README.md`](practice-kit/qa/README.md)

| โฟลเดอร์ในชุดฝึก | ใช้ฝึก |
|---|---|
| `common/` | พื้นฐานที่ทุกคนเรียน: สรุปประชุม, รวมไฟล์ยอดขาย, ติดตั้ง skill ของทีม |
| `qa/` | ข้อกำหนด 17 ข้อ และระบบเบิกวัสดุตัวอย่างที่มีจุดผิดซ่อนอยู่ (QA-1 ถึง QA-5) |
| `biz/` | รายงานรับวัสดุจาก 3 ไซต์ ที่มีข้อมูลผิดปกติซ่อนอยู่ (BIZ-2 ถึง BIZ-4) |

บัญชีในระบบตัวอย่าง (`requester1`, `requester2`, `approver1` รหัส `demo1234`) เป็นบัญชีสมมติ ใช้ได้กับระบบฝึกในเครื่องเท่านั้น

## สำหรับผู้สอน

ต้องมี Python 3.9 ขึ้นไป และ Node.js 18 ขึ้นไป ไม่ต้องติดตั้ง package เพิ่ม

| คำสั่ง | ทำอะไร |
|---|---|
| `python3 trainer-kit/build_kit.py` | สร้างไฟล์ข้อมูลฝึกใหม่, `data-key.json` และ `practice-kit.zip` |
| `python3 trainer-kit/build_kit.py --check` | ตรวจว่าไฟล์ที่จะแจกตรงกับเฉลย ไม่เขียนไฟล์ |
| `node trainer-kit/selfcheck.js` | เปิดระบบตัวอย่าง ตรวจว่า bug ที่ฝังไว้ยังเกิดจริง ตรวจการทำงานปกติ และเรียก `--check` (ต้องได้ `all 29 checks passed`) |

แก้ไฟล์ใน `practice-kit/` เมื่อไร ให้รัน `build_kit.py` แล้วตามด้วย `selfcheck.js` ทุกครั้งก่อนแจก

เฉลยทั้งหมดอยู่ใน [`trainer-kit/answer-key.md`](trainer-kit/answer-key.md): bug ที่ฝังในระบบเบิกวัสดุ, เฉลยพื้นฐานครั้งที่ 1-2 และยอดที่ถูกต้องของสายหน่วยงาน
