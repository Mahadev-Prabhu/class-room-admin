# NCC Head Start Weekly Reading Report Template

The blank workbook has the five report tabs: Overview, Weekly Summary,
Student Weekly, Reading Detail, and Children. It contains column headers only;
no student data is stored in it.

Use `ncc_weekly_report.py` to recreate the report from Firebase user exports.
Before running it, update these values near the top of the script:

- `SOURCES`: paths to the two JSON exports.
- `REPORT_END`: inclusive report end date.
- `REPORT_NAME`: output workbook name.
- `TEACHERS`: teacher codes, names, programs, and start dates.

From this template folder, run `python3 tools/ncc_weekly_report.py`. The script merges records by user ID,
child key, and reward ID. The restore export takes precedence when the same
field differs; fields present only in the learning export are retained. It
writes a merged JSON file, a filled workbook, and a fresh blank template to
the package's `outputs` folder.

The report counts `reading` rewards completed from each teacher's start date
through `REPORT_END`. Weeks are seven-day periods anchored to that start date.
Each student has one row per week, including weeks with zero books. Book IDs
and individual durations appear together in `Student Weekly`.
