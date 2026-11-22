"""Trainer-only generator for practice-kit data (stdlib only, Python 3.9+).

Run:   python3 trainer-kit/build_kit.py          -> writes data files, data-key.json, normalises text files, builds practice-kit.zip
Check: python3 trainer-kit/build_kit.py --check  -> no writes; verifies shipped files against a fresh regeneration
"""
import csv
import io
import json
import os
import random
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KIT = os.path.join(ROOT, "practice-kit")
ZIP_PATH = os.path.join(ROOT, "practice-kit.zip")
KEY_PATH = os.path.join(HERE, "data-key.json")
FALLBACK_PATH = os.path.join(HERE, "site-c-fallback.csv")
SEED = 20270113

MATERIALS = [
    ("MAT-001", "ปูนซีเมนต์ปอร์ตแลนด์", "ถุง", 14250, "ถุงละ 50 กก. (1 ตัน = 20 ถุง)"),
    ("MAT-002", "เหล็กเส้นข้ออ้อย DB12", "เส้น", 18725, ""),
    ("MAT-003", "ทรายหยาบ", "ลบ.ม.", 42000, ""),
    ("MAT-004", "อิฐมวลเบา", "ก้อน", 2175, ""),
    ("MAT-005", "กระเบื้องหลังคา", "แผ่น", 5890, ""),
    ("MAT-006", "ท่อพีวีซี 4 นิ้ว", "ท่อน", 31500, ""),
    ("MAT-007", "สีรองพื้นปูนใหม่", "ถัง", 129000, ""),
    ("MAT-008", "น้ำยากันซึม", "แกลลอน", 46535, ""),
]
MAT = {m[0]: m for m in MATERIALS}
QTY_RANGE = {
    "MAT-001": (1, 20, 20), "MAT-002": (10, 300, 1), "MAT-003": (2, 30, 1), "MAT-004": (200, 2000, 1),
    "MAT-005": (50, 1500, 1), "MAT-006": (5, 60, 1), "MAT-007": (2, 20, 1), "MAT-008": (5, 40, 1),
}
SUPPLIER = {
    "MAT-001": "บริษัท รุ่งเรืองวัสดุภัณฑ์ จำกัด", "MAT-002": "บริษัท เหล็กสยามพัฒนา จำกัด",
    "MAT-003": "ห้างหุ้นส่วนจำกัด ศิลาทองการค้า", "MAT-004": "บริษัท รุ่งเรืองวัสดุภัณฑ์ จำกัด",
    "MAT-005": "ร้านมั่นคงวัสดุก่อสร้าง", "MAT-006": "ร้านมั่นคงวัสดุก่อสร้าง",
    "MAT-007": "ห้างหุ้นส่วนจำกัด ศิลาทองการค้า", "MAT-008": "ร้านมั่นคงวัสดุก่อสร้าง",
}
SITES = {
    "SITE-A": "โครงการอาคารสำนักงานริมน้ำ",
    "SITE-B": "โครงการคลังสินค้าทุ่งทอง",
    "SITE-C": "โครงการหมู่บ้านสวนสัก",
}
DAYS = [date(2027, 1, 13) + timedelta(days=i) for i in range(14)]
HEADER = ["เลขที่ใบส่งของ", "วันที่", "ไซต์งาน", "ผู้ขาย", "รหัสวัสดุ", "รายการ", "จำนวน", "หน่วย", "หมายเหตุ"]
NOTES = ["ส่งช่วงเช้า", "ตรวจรับแล้ว", "ลงของหน้างาน"]
THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

FILES = [
    dict(name="site-a.csv", site="SITE-A", letter="A", clean=40, blank=2, dup=2, date=6, site_var=5, comma=3, text=0, ton=2, base="iso", variant="dmy_be"),
    dict(name="site-b.csv", site="SITE-B", letter="B", clean=44, blank=3, dup=2, date=5, site_var=4, comma=3, text=0, ton=3, base="dmy_be", variant="dmy_ce"),
    dict(name="site-c.xlsx", site="SITE-C", letter="C", clean=36, blank=2, dup=1, date=4, site_var=4, comma=2, text=3, ton=1, base="iso", variant="thai"),
]
FLAW_KEYS = ["blank", "dup", "date", "site_var", "comma", "text", "ton"]


def fmt_date(d, style):
    if style == "iso":
        return d.isoformat()
    if style == "dmy_be":
        return "%02d/%02d/%d" % (d.day, d.month, d.year + 543)
    if style == "dmy_ce":
        return "%02d/%02d/%d" % (d.day, d.month, d.year)
    return "%d %s %d" % (d.day, THAI_MONTHS[d.month - 1], d.year + 543)


def baht(satang):
    return "{:,.2f}".format(satang / 100)


def gen_file(cfg, index):
    """Return (clean_rows, rendered_rows). rendered rows: list of 9-value lists, or None for a blank row."""
    rng = random.Random(SEED + index)
    mats = ["MAT-004"] * cfg["comma"] + ["MAT-001"] * cfg["ton"]
    others = [m[0] for m in MATERIALS]
    while len(mats) < cfg["clean"]:
        mats.append(rng.choice(others))
    rows = []
    for i, code in enumerate(mats):
        lo, hi, step = QTY_RANGE[code]
        qty = rng.randint(1000, 2000) if i < cfg["comma"] else rng.randint(lo, hi) * step
        rows.append(dict(order=i, day=rng.choice(DAYS), code=code, qty=qty,
                         note=rng.choice(NOTES) if rng.random() < 0.12 else "", force=("comma" if i < cfg["comma"] else "ton" if i < cfg["comma"] + cfg["ton"] else "")))
    rows.sort(key=lambda r: (r["day"], r["order"]))
    for n, r in enumerate(rows, 1):
        r["dn"] = "DN-%s-%04d" % (cfg["letter"], n)

    free = [i for i, r in enumerate(rows) if not r["force"]]
    rng.shuffle(free)
    flaw = {}
    for i, r in enumerate(rows):
        if r["force"]:
            flaw[i] = r["force"]
    for kind in ("text", "date", "site_var"):
        for _ in range(cfg[kind]):
            flaw[free.pop()] = kind
    dup_src = sorted(free[: cfg["dup"]])

    site_name = SITES[cfg["site"]]
    variants = [site_name.replace("โครงการ", "", 1), site_name + "  ", cfg["site"]]
    var_n = 0
    rendered = []
    for i, r in enumerate(rows):
        code, name, unit, _, _ = MAT[r["code"]]
        kind = flaw.get(i, "")
        d = fmt_date(r["day"], cfg["variant"] if kind == "date" else cfg["base"])
        site = site_name
        if kind == "site_var":
            site = variants[var_n % len(variants)]
            var_n += 1
        qty, out_unit = r["qty"], unit
        if kind == "comma":
            qty = "{:,}".format(r["qty"])
        elif kind == "text":
            qty = str(r["qty"])
        elif kind == "ton":
            qty, out_unit = r["qty"] // 20, "ตัน"
        line = [r["dn"], d, site, SUPPLIER[code], code, name, qty, out_unit, r["note"]]
        rendered.append(line)
        if i in dup_src:
            rendered.append(list(line))
    for _ in range(cfg["blank"]):
        rendered.insert(rng.randint(1, len(rendered) - 1), None)
    return rows, rendered


def build_key(all_rows):
    key = {"clean_rows": {}, "value_by_site": {}, "by_material": {}, "value_by_date": {}, "flaws": {}, "naive": {}}
    grand = 0
    for cfg, (rows, rendered) in zip(FILES, all_rows):
        key["clean_rows"][cfg["name"]] = len(rows)
        site_total = 0
        for r in rows:
            v = r["qty"] * MAT[r["code"]][3]
            site_total += v
            m = key["by_material"].setdefault(r["code"], {"qty": 0, "value_satang": 0})
            m["qty"] += r["qty"]
            m["value_satang"] += v
            day = r["day"].isoformat()
            key["value_by_date"][day] = key["value_by_date"].get(day, 0) + v
        key["value_by_site"][cfg["site"]] = {"satang": site_total, "baht": baht(site_total)}
        grand += site_total
        key["flaws"][cfg["name"]] = {k: cfg[k] for k in FLAW_KEYS}
    for m in key["by_material"].values():
        m["value_baht"] = baht(m["value_satang"])
    key["letter_by_site"] = {}
    for cfg, (rows, _) in zip(FILES, all_rows):
        by_mat = {}
        for r in rows:
            by_mat[r["code"]] = by_mat.get(r["code"], 0) + r["qty"] * MAT[r["code"]][3]
        top = max(by_mat, key=lambda c: by_mat[c])
        days = sorted(r["day"] for r in rows)
        key["letter_by_site"][cfg["site"]] = {
            "site_name": SITES[cfg["site"]],
            "period_from": days[0].isoformat(), "period_to": days[-1].isoformat(),
            "delivery_count": len(rows),
            "total_value": baht(sum(by_mat.values())),
            "top_material": "%s %s" % (top, MAT[top][1]), "top_material_value": baht(by_mat[top]),
        }
    key["value_by_date"] = {d: {"satang": v, "baht": baht(v)} for d, v in sorted(key["value_by_date"].items())}
    key["grand_total"] = {"satang": grand, "baht": baht(grand)}

    dup_extra = ton_wrong = comma_value = 0
    for rows, rendered in all_rows:
        seen = set()
        for line in rendered:
            if line is None:
                continue
            t = tuple(str(x) for x in line)
            unit_price = MAT[line[4]][3]
            if t in seen:
                dup_extra += int(str(line[6]).replace(",", "")) * unit_price
            seen.add(t)
            if line[7] == "ตัน":
                ton_wrong += line[6] * unit_price - line[6] * 20 * unit_price
            if isinstance(line[6], str) and "," in line[6]:
                comma_value += int(line[6].replace(",", "")) * unit_price
    key["naive"] = {
        "duplicates_kept": baht(grand + dup_extra),
        "ton_read_as_bag": baht(grand + ton_wrong),
        "both": baht(grand + dup_extra + ton_wrong),
        "comma_rows_dropped": baht(grand - comma_value),
    }
    key["session2"] = session2_key(gen_session2())
    return key


SALES_GROUPS = [("ปูน", 150), ("เหล็ก", 200), ("อิฐ", 60), ("สี", 1300)]
BRANCHES = [("sales-north.csv", "สาขาเหนือ"), ("sales-central.csv", "สาขากลาง"), ("sales-south.csv", "สาขาใต้")]


def gen_session2():
    rng = random.Random(SEED + 99)
    out = {}
    for fname, branch in BRANCHES:
        rows = []
        for day in ("2027-01-14", "2027-01-15"):
            for group, price in SALES_GROUPS:
                qty = rng.randint(1, 20)
                rows.append([day, branch, group, qty, qty * price])
        out[fname] = rows
    return out


def session2_key(data):
    by_branch, by_group, total = {}, {}, 0
    for rows in data.values():
        for _, branch, group, _, amount in rows:
            by_branch[branch] = by_branch.get(branch, 0) + amount
            by_group[group] = by_group.get(group, 0) + amount
            total += amount
    return {"by_branch": by_branch, "by_group": by_group, "total": total}


def csv_bytes(header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(header)
    for r in rows:
        w.writerow([""] * len(header) if r is None else r)
    return ("﻿" + buf.getvalue()).encode("utf-8")


def xml_escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def xlsx_bytes(header, rows, sheet_name):
    letters = "ABCDEFGHI"
    lines = []
    for r_idx, values in enumerate([header] + rows, 1):
        if values is None:
            lines.append('<row r="%d"/>' % r_idx)
            continue
        cells = []
        for c_idx, v in enumerate(values):
            ref = "%s%d" % (letters[c_idx], r_idx)
            if isinstance(v, int):
                cells.append('<c r="%s"><v>%d</v></c>' % (ref, v))
            elif v != "":
                cells.append('<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, xml_escape(v)))
        lines.append('<row r="%d">%s</row>' % (r_idx, "".join(cells)))
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    parts = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="%s/officeDocument" Target="xl/workbook.xml"/></Relationships>' % rel,
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook %s xmlns:r="%s"><sheets><sheet name="%s" sheetId="1" r:id="rId1"/></sheets></workbook>' % (ns, rel, xml_escape(sheet_name)),
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' % rel,
        "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet %s><sheetData>%s</sheetData></worksheet>' % (ns, "".join(lines)),
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, text in parts.items():
            info = zipfile.ZipInfo(name, date_time=(2027, 1, 27, 9, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 0  # same bytes on every OS, so --check works on Windows too
            z.writestr(info, text.encode("utf-8"))
    return buf.getvalue()


def price_list_bytes():
    rows = [[c, n, u, "%.2f" % (p / 100), note] for c, n, u, p, note in MATERIALS]
    return csv_bytes(["รหัสวัสดุ", "รายการ", "หน่วย", "ราคาต่อหน่วย (บาท)", "หมายเหตุ"], rows)


def outputs():
    """All generated files as {abs_path: bytes} plus the key."""
    all_rows = [gen_file(cfg, i) for i, cfg in enumerate(FILES)]
    files = {}
    for cfg, (_, rendered) in zip(FILES, all_rows):
        path = os.path.join(KIT, "biz", "reports", cfg["name"])
        if cfg["name"].endswith(".xlsx"):
            files[path] = xlsx_bytes(HEADER, rendered, "รับวัสดุ")
            files[FALLBACK_PATH] = csv_bytes(HEADER, rendered)
        else:
            files[path] = csv_bytes(HEADER, rendered)
    files[os.path.join(KIT, "biz", "price-list.csv")] = price_list_bytes()
    for fname, rows in gen_session2().items():
        files[os.path.join(KIT, "common", "session2", fname)] = csv_bytes(["date", "branch", "product_group", "qty", "amount_baht"], rows)
    # copy-to-Codex page: the source is site/prompts.html (same page as codex.jeerawut.com/prompts), shipped CRLF + BOM like other kit text
    page = open(os.path.join(ROOT, "site", "prompts.html"), encoding="utf-8-sig").read()
    files[os.path.join(KIT, "prompts.html")] = ("﻿" + page.replace("\r\n", "\n").replace("\n", "\r\n")).encode("utf-8")
    key = build_key(all_rows)
    files[KEY_PATH] =(json.dumps(key, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    return files, key, all_rows


TEXT_EXT = (".md", ".txt", ".csv", ".js", ".html", ".json", ".bat")


def kit_files():
    out = []
    for base, dirs, names in os.walk(KIT):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for n in sorted(names):
            if not n.startswith("."):
                out.append(os.path.join(base, n))
    return out


def normalise():
    for path in kit_files():
        if not path.endswith(TEXT_EXT):
            continue
        raw = open(path, "rb").read()
        text = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\n", "\r\n")
        bom = not path.endswith(".json") and any(ord(ch) > 127 for ch in text)
        data = (("﻿" if bom else "") + text).encode("utf-8")
        if data != raw:
            open(path, "wb").write(data)


def build_zip():
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
        for path in kit_files():
            arc = "practice-kit/" + os.path.relpath(path, KIT).replace(os.sep, "/")
            z.write(path, arc)


# ---------- reading shipped files (used by --check) ----------

def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    return rows[0], [None if not any(c.strip() for c in r) else r for r in rows[1:]]


def read_xlsx(path):
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    out = []
    for row in root.find("m:sheetData", ns):
        cells = row.findall("m:c", ns)
        if not cells:
            out.append(None)
            continue
        values = [""] * 9
        for c in cells:
            col = ord(c.get("r")[0]) - 65
            if c.get("t") == "inlineStr":
                values[col] = c.find("m:is/m:t", ns).text or ""
            else:
                values[col] = int(c.find("m:v", ns).text)
        out.append(values)
    return out[0], out[1:]


def as_strings(line):
    return None if line is None else [str(x) for x in line]


def parse_date(s):
    s = s.strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3))), "iso"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        y = int(m.group(3))
        return date(y - 543 if y > 2400 else y, int(m.group(2)), int(m.group(1))), "dmy_be" if y > 2400 else "dmy_ce"
    m = re.match(r"^(\d{1,2}) (\S+) (\d{4})$", s)
    if m and m.group(2) in THAI_MONTHS:
        return date(int(m.group(3)) - 543, THAI_MONTHS.index(m.group(2)) + 1, int(m.group(1))), "thai"
    raise ValueError("unknown date " + s)


def site_code(s):
    s = s.strip()
    if s in SITES:
        return s
    for code, name in SITES.items():
        if s in (name, name.replace("โครงการ", "", 1)):
            return code
    raise ValueError("unknown site " + s)


def reference_clean(cfg, lines):
    """Independent cleaner over shipped rows; returns (value_satang, clean_count, flaw_counts)."""
    counts = dict.fromkeys(FLAW_KEYS, 0)
    seen, total, kept = set(), 0, 0
    for line in lines:
        if line is None:
            counts["blank"] += 1
            continue
        t = tuple(str(x) for x in line)
        if t in seen:
            counts["dup"] += 1
            continue
        seen.add(t)
        _, style = parse_date(str(line[1]))
        if style != cfg["base"]:
            counts["date"] += 1
        if str(line[2]) != SITES[site_code(str(line[2]))]:
            counts["site_var"] += 1
        raw_qty = line[6]
        if isinstance(raw_qty, str) and "," in raw_qty:
            counts["comma"] += 1
        elif isinstance(raw_qty, str) and cfg["name"].endswith(".xlsx"):
            counts["text"] += 1
        qty = int(str(raw_qty).replace(",", ""))
        if line[7] == "ตัน":
            counts["ton"] += 1
            qty *= 20
        total += qty * MAT[line[4]][3]
        kept += 1
    return total, kept, counts


def check():
    files, key, all_rows = outputs()
    problems = []
    shipped_key = json.load(open(KEY_PATH, encoding="utf-8"))
    if shipped_key != key:
        problems.append("data-key.json differs from a fresh regeneration")
    grand = 0
    for cfg, (rows, rendered) in zip(FILES, all_rows):
        path = os.path.join(KIT, "biz", "reports", cfg["name"])
        header, lines = read_xlsx(path) if path.endswith(".xlsx") else read_csv(path)
        expected = rendered if path.endswith(".xlsx") else [as_strings(x) for x in rendered]
        if [str(h) for h in header] != HEADER:
            problems.append(cfg["name"] + ": header differs")
        if lines != expected:
            problems.append(cfg["name"] + ": rows differ from regeneration")
        total, kept, counts = reference_clean(cfg, lines)
        grand += total
        if total != key["value_by_site"][cfg["site"]]["satang"]:
            problems.append(cfg["name"] + ": reference total %d != key" % total)
        if kept != key["clean_rows"][cfg["name"]]:
            problems.append(cfg["name"] + ": reference kept %d rows" % kept)
        if counts != key["flaws"][cfg["name"]]:
            problems.append(cfg["name"] + ": flaw counts %s != key" % counts)
    if grand != key["grand_total"]["satang"]:
        problems.append("grand total mismatch")
    for path, data in files.items():
        if open(path, "rb").read() != data:
            problems.append(os.path.relpath(path, ROOT) + " differs from regeneration")
    for path in kit_files():
        if path.endswith(TEXT_EXT):
            raw = open(path, "rb").read()
            if not path.endswith(".json") and any(b > 127 for b in raw) and not raw.startswith(b"\xef\xbb\xbf"):
                problems.append(os.path.relpath(path, ROOT) + " has Thai text but no BOM")
            if re.search(rb"(?<!\r)\n", raw):
                problems.append(os.path.relpath(path, ROOT) + " has LF line endings (run build_kit.py)")
    with zipfile.ZipFile(ZIP_PATH) as z:
        names = z.namelist()
        for name in names:
            disk = os.path.join(KIT, *name.split("/")[1:])
            if os.path.isfile(disk) and z.read(name) != open(disk, "rb").read():
                problems.append("zip entry %s is stale (run build_kit.py)" % name)
    bad = [n for n in names if not n.startswith("practice-kit/") or "/." in n or "trainer" in n]
    if bad:
        problems.append("zip has unexpected entries: %s" % bad[:5])
    expected_names = {"practice-kit/" + os.path.relpath(p, KIT).replace(os.sep, "/") for p in kit_files()}
    if set(names) != expected_names:
        problems.append("zip listing differs from practice-kit/ (rebuild the zip)")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("data check ok: %d clean rows, grand total %s baht" % (sum(key["clean_rows"].values()), key["grand_total"]["baht"]))


def main():
    if "--check" in sys.argv:
        check()
        return
    files, key, _ = outputs()
    for path, data in files.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(data)
    normalise()
    build_zip()
    print("built: %d clean rows, grand total %s baht, zip %s" % (sum(key["clean_rows"].values()), key["grand_total"]["baht"], os.path.relpath(ZIP_PATH, ROOT)))


if __name__ == "__main__":
    main()
