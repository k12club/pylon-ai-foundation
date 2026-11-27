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
| `site/` | สไลด์ฉบับเว็บ (`index.html` 53 หน้า, `deck.css`, `deck.js`, `img/`), หน้า `prompts.html` ที่คัดลอกข้อความลองทำทุกข้อได้ และหน้า `files.html` ที่ให้โหลด `practice-kit.zip` (สำเนาที่ `build_kit.py` คัดลอกมาให้ ห้ามแก้เอง) ทั้งสามหน้าลิงก์ `watermark.css` + `watermark.js` (ลายน้ำ Jeerawut Buayoy ที่ซ่อนไว้ ขึ้นเมื่อกด Cmd+Shift / Win หรือหน้าต่างเสียโฟกัส และขึ้นเสมอตอนพิมพ์ แต่ไม่ติดภาพที่แคปด้วยมือถือ ถ่ายรูปจอ หรือกด PrtSc บน Windows ซึ่งจับภาพก่อนที่หน้าเว็บจะรู้) ซึ่ง `build_kit.py` ฝังลงใน `practice-kit/prompts.html` ให้เอง |
| `wrangler.jsonc`, `deploy.sh` | ตั้งค่าและสคริปต์ deploy `site/` ขึ้น Cloudflare Worker ที่ codex.jeerawut.com |
| `practice-kit/` | ไฟล์ฝึกที่แจกผู้เรียน ข้อมูลทั้งหมดเป็นข้อมูลสมมติ |
| `practice-kit.zip` | `practice-kit/` ที่บีบอัดแล้ว ไฟล์นี้คือไฟล์ที่ส่งให้ผู้เรียน (โหลดได้จาก https://codex.jeerawut.com/files) |
| `trainer-kit/` | ของผู้สอน: เฉลย, สคริปต์สร้างไฟล์ฝึก, สคริปต์ตรวจชุดฝึก |

- สไลด์ (53 หน้า เปิดได้ทุกคน): https://codex.jeerawut.com กดลูกศรหรือคลิกเพื่อเลื่อนหน้า กด F เต็มจอ
- ข้อความลองทำทุกข้อ มีปุ่มคัดลอก: https://codex.jeerawut.com/prompts
- ดาวน์โหลดชุดฝึก `practice-kit.zip`: https://codex.jeerawut.com/files
- คู่มือเทคนิค (อยู่บน claude.ai ต้องได้รับแชร์ก่อนจึงจะเปิดได้): https://claude.ai/artifact/PX6qKPhs8t5pogKnkE613t

## สำหรับผู้เรียน

1. ลงโปรแกรมให้ครบตาม `install-checklist.local.html`: แอป ChatGPT, Git, Python, Node.js (LTS), VS Code
2. ดาวน์โหลด `practice-kit.zip` จาก https://codex.jeerawut.com/files แล้วแตกไฟล์ตามขั้นตอนในหน้านั้น (หรือใน [`practice-kit/README.md`](practice-kit/README.md))
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
| `python3 trainer-kit/build_kit.py` | สร้างไฟล์ข้อมูลฝึกใหม่, `data-key.json` และ `practice-kit.zip` แล้วคัดลอก zip ไปไว้ที่ `site/practice-kit.zip` |
| `python3 trainer-kit/build_kit.py --check` | ตรวจว่าไฟล์ที่จะแจกตรงกับเฉลย และ zip ใน `site/` ตรงกับตัวหลัก ไม่เขียนไฟล์ |
| `node trainer-kit/selfcheck.js` | เปิดระบบตัวอย่าง ตรวจว่า bug ที่ฝังไว้ยังเกิดจริง ตรวจการทำงานปกติ และเรียก `--check` (ต้องได้ `all 29 checks passed`) |

แก้ไฟล์ใน `practice-kit/` เมื่อไร ให้รัน `build_kit.py` แล้วตามด้วย `selfcheck.js` ทุกครั้งก่อนแจก (`practice-kit/prompts.html` สร้างจาก `site/prompts.html` แก้ที่ `site/` แล้วรัน `build_kit.py`)

### แก้สไลด์

1. แก้ `site/index.html` (1 หน้า = 1 `<section>`) หรือ `site/deck.css`
2. ดูในเครื่อง: `npx --yes wrangler@4.166.0 dev --port 8788` แล้วเปิด http://localhost:8788
3. ขึ้นเว็บจริง: `./deploy.sh` (เช็กก่อนว่าไม่มีโน้ตผู้สอนหลุดเข้า `site/` รวมถึงไฟล์ใน `site/practice-kit.zip` และรัน `build_kit.py --check` ถ้าแก้ชุดฝึกหรือ `site/prompts.html` แล้วยังไม่รัน `build_kit.py` จะ deploy ไม่ผ่าน)

โน้ตผู้สอนของแต่ละหน้า (มีเฉลย) ไม่ได้เก็บใน repo นี้แล้ว เก็บไว้ที่ `slides/speaker-notes.md` ในเครื่องผู้สอน (`slides/` อยู่ใน `.gitignore`) ห้ามใส่ `<aside>` หรือโน้ตลงใน `site/`

เฉลยทั้งหมดอยู่ใน [`trainer-kit/answer-key.md`](trainer-kit/answer-key.md): bug ที่ฝังในระบบเบิกวัสดุ, เฉลยพื้นฐานครั้งที่ 1-2 และยอดที่ถูกต้องของสายหน่วยงาน
