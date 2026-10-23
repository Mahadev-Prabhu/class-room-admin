#!/usr/bin/env python3
"""Merge the two Head Start user exports and build the weekly reading report."""

import copy
import json
import math
import re
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    Path("/Users/deeksha/Downloads/head-start-learning-libray-default-rtdb-users-export.json"),
    Path("/Users/deeksha/Downloads/head-start-restore-default-rtdb-users-export.json"),
)
OUTPUT_DIR = ROOT / "outputs"
REPORT_END = date(2026, 10, 16)
REPORT_NAME = "NCC_HeadStart_Weekly_Reading_Report 2026_10_16"
WORKBOOK_PATH = OUTPUT_DIR / f"{REPORT_NAME}.xlsx"
TEMPLATE_PATH = OUTPUT_DIR / "NCC_HeadStart_Weekly_Reading_Template.xlsx"
MERGED_PATH = OUTPUT_DIR / f"head-start-merged-users-{REPORT_END.isoformat()}.json"

TEACHERS = {
    "EFHB775": ("Dalia", "NCC Head Start", date(2025, 8, 19)),
    "EKTE853": ("Jeanette", "NCC Head Start", date(2025, 8, 19)),
    "EQOJ127": ("Dawn", "NCC Head Start", date(2025, 10, 22)),
    "EJUK743": ("Ana", "NCC Head Start", date(2025, 10, 22)),
    "EOQN657": ("Nilly", "NCC Early Head Start", date(2025, 10, 22)),
    "ERKO743": ("Anna", "NCC Early Head Start", date(2025, 10, 22)),
    "EGBN872": ("Yuri", "NCC Early Head Start", date(2025, 10, 22)),
    "ERXG173": ("Jennifer", "NCC Early Head Start", date(2025, 10, 22)),
    "EKAX388": ("Fatima", "NCC Early Head Start", date(2025, 10, 22)),
}


def merge_missing(primary, secondary):
    """Prefer restore values, adding missing user/child/reward keys from learning."""
    if isinstance(primary, dict) and isinstance(secondary, dict):
        for key, value in secondary.items():
            if key not in primary:
                primary[key] = value
            else:
                primary[key] = merge_missing(primary[key], value)
    return primary


def parse_timestamp(raw):
    if not raw:
        return None
    normalized = str(raw).strip().replace("\u202f", " ").replace("\xa0", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %I:%M:%S %p", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def hhmmss(seconds):
    seconds = int(seconds)
    return f"{seconds // 3600}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def week_info(code, completed):
    start = TEACHERS[code][2]
    week_no = (completed.date() - start).days // 7 + 1
    week_start = start + timedelta(days=(week_no - 1) * 7)
    week_end = min(week_start + timedelta(days=6), REPORT_END)
    return week_no, week_start, week_end


def load_and_merge():
    learning, restore = (json.loads(path.read_text(encoding="utf-8")) for path in SOURCES)
    merged = merge_missing(copy.deepcopy(restore), learning)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MERGED_PATH.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return learning, restore, merged


def extract(learning, restore, merged):
    teacher_uids = {
        uid: user.get("teacher_code")
        for uid, user in merged.items()
        if isinstance(user, dict)
        and user.get("is_teacher") is True
        and user.get("teacher_code") in TEACHERS
    }
    teacher_json_names = defaultdict(set)
    for uid, code in teacher_uids.items():
        name = ((merged[uid].get("teacher_details") or {}).get("teacher_name") or "").strip()
        if name:
            teacher_json_names[code].add(name)

    children = []
    events = []
    quality = Counter()
    for owner_uid, user in merged.items():
        if not isinstance(user, dict):
            continue
        account = user.get("sign_in_details") or {}
        email = account.get("sign_in_email") or ""
        for child_key, child in (user.get("children") or {}).items():
            if not isinstance(child, dict):
                continue
            code = (
                child.get("teacher_code")
                or teacher_uids.get(child.get("teacher_uid"))
                or teacher_uids.get(owner_uid)
            )
            if code not in TEACHERS:
                continue
            name, program, started = TEACHERS[code]
            source_membership = []
            for label, source in (("Learning", learning), ("Restore", restore)):
                source_user = source.get(owner_uid) or {}
                if child_key in (source_user.get("children") or {}):
                    source_membership.append(label)
            child_record = {
                "Code": code,
                "Teacher Name": name,
                "Program": program,
                "Student Name": child.get("child_name") or "(name missing in export)",
                "Child Key": child_key,
                "Student / Owner UID": owner_uid,
                "Owner Email": email,
                "Child Age": child.get("child_age") or "",
                "Teacher UID": child.get("teacher_uid") or (owner_uid if owner_uid in teacher_uids else ""),
                "Source Export(s)": ", ".join(source_membership),
            }
            children.append(child_record)
            for reward_id, reward in (child.get("rewards") or {}).items():
                if not isinstance(reward, dict) or reward.get("type") != "reading":
                    continue
                completed = parse_timestamp(reward.get("date"))
                if completed is None:
                    quality["reading_without_valid_end"] += 1
                    continue
                if not started <= completed.date() <= REPORT_END:
                    quality["reading_outside_range"] += 1
                    continue
                began = parse_timestamp(reward.get("start_date"))
                if began is None or began > completed:
                    duration = None
                    quality["reading_without_valid_duration"] += 1
                else:
                    duration = int((completed - began).total_seconds())
                week_no, week_start, week_end = week_info(code, completed)
                events.append(
                    {
                        **child_record,
                        "Date Started": started.isoformat(),
                        "Week #": week_no,
                        "Week Start": week_start.isoformat(),
                        "Week End": week_end.isoformat(),
                        "Book ID": str(reward.get("book_id") or ""),
                        "Reward ID": reward_id,
                        "Read Start": began.strftime("%Y-%m-%d %H:%M:%S") if began else "",
                        "Read End": completed.strftime("%Y-%m-%d %H:%M:%S"),
                        "Duration Seconds": duration if duration is not None else "",
                        "Duration": hhmmss(duration) if duration is not None else "",
                        "Points": reward.get("points") or "",
                    }
                )
    children.sort(key=lambda row: (row["Code"], row["Student Name"].casefold(), row["Student / Owner UID"], row["Child Key"]))
    events.sort(key=lambda row: (row["Code"], row["Student / Owner UID"], row["Child Key"], row["Read End"], row["Reward ID"]))
    return children, events, teacher_json_names, quality


def build_tables(children, events, teacher_json_names, quality):
    events_by_child_week = defaultdict(list)
    events_by_code_week = defaultdict(list)
    events_by_child = defaultdict(list)
    events_by_code = defaultdict(list)
    for event in events:
        child_id = (event["Student / Owner UID"], event["Child Key"])
        events_by_child_week[(child_id, event["Week #"])].append(event)
        events_by_code_week[(event["Code"], event["Week #"])].append(event)
        events_by_child[child_id].append(event)
        events_by_code[event["Code"]].append(event)

    weekly = []
    for code, (name, program, started) in TEACHERS.items():
        total_weeks = math.ceil(((REPORT_END - started).days + 1) / 7)
        for week_no in range(1, total_weeks + 1):
            week_start = started + timedelta(days=7 * (week_no - 1))
            week_end = min(week_start + timedelta(days=6), REPORT_END)
            group = events_by_code_week[(code, week_no)]
            seconds = sum(e["Duration Seconds"] for e in group if e["Duration Seconds"] != "")
            active = {(e["Student / Owner UID"], e["Child Key"]) for e in group}
            weekly.append({
                "Code": code, "Teacher Name": name, "Program": program,
                "Date Started": started.isoformat(), "Week #": week_no,
                "Week Start": week_start.isoformat(), "Week End": week_end.isoformat(),
                "Active Children": len(active), "Books Read": len(group),
                "Total Duration Seconds": seconds, "Total Duration": hhmmss(seconds),
            })

    student_weekly = []
    child_rows = []
    for child in children:
        code = child["Code"]
        started = TEACHERS[code][2]
        child_id = (child["Student / Owner UID"], child["Child Key"])
        own_events = events_by_child[child_id]
        total_seconds = sum(e["Duration Seconds"] for e in own_events if e["Duration Seconds"] != "")
        child_rows.append({
            **child, "Date Started": started.isoformat(), "Report End": REPORT_END.isoformat(),
            "Books Read in Report Range": len(own_events),
            "Total Duration Seconds": total_seconds, "Total Duration": hhmmss(total_seconds),
        })
        total_weeks = math.ceil(((REPORT_END - started).days + 1) / 7)
        for week_no in range(1, total_weeks + 1):
            week_start = started + timedelta(days=7 * (week_no - 1))
            week_end = min(week_start + timedelta(days=6), REPORT_END)
            group = events_by_child_week[(child_id, week_no)]
            seconds = sum(e["Duration Seconds"] for e in group if e["Duration Seconds"] != "")
            book_details = "; ".join(
                f'Book {e["Book ID"] or "ID missing"} ({e["Duration"] or "duration unavailable"})'
                for e in group
            ) or "0 books read"
            if len(book_details) > 32767:
                raise ValueError(f"Book details exceed Excel cell limit: {child_id}, week {week_no}")
            student_weekly.append({
                "Code": code, "Teacher Name": child["Teacher Name"], "Program": child["Program"],
                "Student Name": child["Student Name"], "Child Key": child["Child Key"],
                "Student / Owner UID": child["Student / Owner UID"], "Owner Email": child["Owner Email"],
                "Date Started": started.isoformat(), "Week #": week_no,
                "Week Date Range": f"{week_start.isoformat()} to {week_end.isoformat()}",
                "Week Start": week_start.isoformat(), "Week End": week_end.isoformat(),
                "Books Read This Week": len(group), "Book Details This Week": book_details,
                "Total Duration This Week Seconds": seconds,
                "Total Duration This Week": hhmmss(seconds),
            })

    overview = []
    for code, (name, program, started) in TEACHERS.items():
        group = events_by_code[code]
        seconds = sum(e["Duration Seconds"] for e in group if e["Duration Seconds"] != "")
        overview.append({
            "Code": code, "Teacher Name": name,
            "Teacher Name in JSON": "; ".join(sorted(teacher_json_names[code])),
            "Student Limit": 20, "Days Limit": 365, "Program": program,
            "Date Started": started.isoformat(), "Report End": REPORT_END.isoformat(),
            "Associated Children": sum(c["Code"] == code for c in children),
            "Active Children": len({(e["Student / Owner UID"], e["Child Key"]) for e in group}),
            "Books Read": len(group), "Total Duration Seconds": seconds,
            "Total Duration": hhmmss(seconds),
            "Weeks in Report": sum(row["Code"] == code for row in weekly),
        })
    overview.append({
        "Code": "Notes", "Teacher Name": "Merged learning + restore exports; duplicate reward IDs counted once.",
        "Teacher Name in JSON": "Book titles are not in the exports; book IDs are shown.",
        "Program": f'Invalid end times: {quality["reading_without_valid_end"]}; invalid durations: {quality["reading_without_valid_duration"]}',
        "Date Started": "Weeks start on each teacher code's start date.",
    })
    return overview, weekly, student_weekly, events, child_rows


def col_name(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def clean_xml(value):
    return escape("".join(ch for ch in str(value) if ch in "\t\n\r" or ord(ch) >= 32))


def cell_xml(row_index, col_index, value, style=0):
    ref = f"{col_name(col_index)}{row_index}"
    style_attr = f' s="{style}"' if style else ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t>{clean_xml(value)}</t></is></c>'


def sheet_xml(headers, rows):
    xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
        '<cols>',
    ]
    for index, header in enumerate(headers, 1):
        width = 46 if "Details" in header else 34 if header in {"Student / Owner UID", "Child Key", "Teacher UID", "Reward ID"} else min(28, max(13, len(header) + 3))
        xml.append(f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>')
    xml.extend(['</cols>', '<sheetData><row r="1">'])
    xml.extend(cell_xml(1, index, header, 1) for index, header in enumerate(headers, 1))
    xml.append('</row>')
    for row_index, row in enumerate(rows, 2):
        xml.append(f'<row r="{row_index}">')
        for col_index, header in enumerate(headers, 1):
            value = row.get(header, "")
            style = 2 if isinstance(value, (int, float)) else 0
            xml.append(cell_xml(row_index, col_index, value, style))
        xml.append('</row>')
    xml.append('</sheetData>')
    xml.append(f'<autoFilter ref="A1:{col_name(len(headers))}{len(rows) + 1}"/>')
    xml.append('</worksheet>')
    return ''.join(xml)


def write_xlsx(tables, destination=WORKBOOK_PATH, headers_by_sheet=None):
    names = [name for name, _ in tables]
    content_types = [
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    content_types.extend(
        f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for i in range(1, len(names) + 1)
    )
    workbook_sheets = ''.join(
        f'<sheet name="{clean_xml(name)}" sheetId="{i}" r:id="rId{i}"/>'
        for i, name in enumerate(names, 1)
    )
    relationships = ''.join(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        for i in range(1, len(names) + 1)
    )
    relationships += f'<Relationship Id="rId{len(names) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    styles = (
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B72"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ''.join(content_types) + '</Types>')
        archive.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        archive.writestr('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + workbook_sheets + '</sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relationships + '</Relationships>')
        archive.writestr('xl/styles.xml', styles)
        for index, (name, rows) in enumerate(tables, 1):
            headers = list(rows[0]) if rows else headers_by_sheet[name]
            archive.writestr(f'xl/worksheets/sheet{index}.xml', sheet_xml(headers, rows))


def main():
    learning, restore, merged = load_and_merge()
    children, events, teacher_json_names, quality = extract(learning, restore, merged)
    overview, weekly, student_weekly, detail, child_rows = build_tables(children, events, teacher_json_names, quality)
    assert sum(row['Books Read'] for row in weekly) == len(detail)
    assert sum(row['Books Read This Week'] for row in student_weekly) == len(detail)
    assert sum(row['Total Duration This Week Seconds'] for row in student_weekly) == sum(e['Duration Seconds'] for e in detail if e['Duration Seconds'] != '')
    tables = [
        ('Overview', overview),
        ('Weekly Summary', weekly),
        ('Student Weekly', student_weekly),
        ('Reading Detail', detail),
        ('Children', child_rows),
    ]
    write_xlsx(tables)
    write_xlsx(
        [(name, []) for name, _ in tables],
        destination=TEMPLATE_PATH,
        headers_by_sheet={name: list(rows[0]) for name, rows in tables},
    )
    print(json.dumps({
        'workbook': str(WORKBOOK_PATH), 'template': str(TEMPLATE_PATH),
        'merged_json': str(MERGED_PATH),
        'merged_users': len(merged), 'children': len(children), 'reading_events': len(events),
        'weekly_rows': len(weekly), 'student_weekly_rows': len(student_weekly),
        'zero_student_weeks': sum(row['Books Read This Week'] == 0 for row in student_weekly),
        'quality': dict(quality),
        'by_code': {row['Code']: {'children': row['Associated Children'], 'books': row['Books Read']} for row in overview if row.get('Code') in TEACHERS},
    }, indent=2))


if __name__ == '__main__':
    main()
