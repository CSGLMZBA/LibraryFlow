#!/usr/bin/env python3
"""Build a single PDF containing the Markdown documentation in this workspace."""

from __future__ import annotations

import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "LibraryFlow-documentation.pdf"


def inline_markup(value: str) -> str:
    value = html.escape(value, quote=False)
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", value)
    return value


def markdown_to_html(markdown: str) -> str:
    output: list[str] = []
    lines = markdown.splitlines()
    in_code = False
    in_list = False
    in_table = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            output.append("</ul>")
            in_list = False

    def close_table() -> None:
        nonlocal in_table
        if in_table:
            output.append("</tbody></table>")
            in_table = False

    for line in lines:
        if line.startswith("```"):
            close_list()
            close_table()
            if in_code:
                output.append("</code></pre>")
            else:
                output.append("<pre><code>")
            in_code = not in_code
            continue
        if in_code:
            output.append(html.escape(line))
            continue
        if not line.strip():
            close_list()
            close_table()
            continue
        if line.startswith("|") and line.endswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                continue
            if not in_table:
                close_list()
                output.append("<table><thead><tr>")
                output.extend(f"<th>{inline_markup(cell)}</th>" for cell in cells)
                output.append("</tr></thead><tbody>")
                in_table = True
            else:
                output.append("<tr>")
                output.extend(f"<td>{inline_markup(cell)}</td>" for cell in cells)
                output.append("</tr>")
            continue
        close_table()
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            close_list()
            level = len(heading.group(1))
            output.append(f"<h{level}>{inline_markup(heading.group(2))}</h{level}>")
        elif re.match(r"^\s*[-*]\s+", line):
            if not in_list:
                output.append("<ul>")
                in_list = True
            item = re.sub(r"^\s*[-*]\s+", "", line)
            output.append(f"<li>{inline_markup(item)}</li>")
        elif re.match(r"^\s*>\s?", line):
            close_list()
            quote = re.sub(r"^\s*>\s?", "", line)
            output.append(f"<blockquote>{inline_markup(quote)}</blockquote>")
        else:
            close_list()
            output.append(f"<p>{inline_markup(line)}</p>")

    close_list()
    close_table()
    if in_code:
        output.append("</code></pre>")
    return "\n".join(output)


def build_html(files: list[Path]) -> str:
    sections = []
    for index, file in enumerate(files):
        relative = file.relative_to(ROOT).as_posix()
        sections.append(
            f'<section class="document{" first" if index == 0 else ""}">'
            f'<p class="source">{html.escape(relative)}</p>'
            f"{markdown_to_html(file.read_text(encoding='utf-8'))}</section>"
        )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>LibraryFlow Documentation</title>
<style>
@page {{ size: A4; margin: 18mm 16mm; }}
body {{ color: #172033; font: 10.5pt/1.5 Arial, sans-serif; }}
h1 {{ color: #123b62; font-size: 24pt; border-bottom: 2px solid #2f80b7; padding-bottom: 5px; }}
h2 {{ color: #1d5e88; font-size: 17pt; margin-top: 20px; }}
h3 {{ color: #2c739b; font-size: 13pt; }}
.document {{ break-before: page; }}
.document.first {{ break-before: auto; }}
.source {{ color: #667085; font-size: 8pt; border-bottom: 1px solid #d0d5dd; padding-bottom: 4px; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 9pt; }}
th {{ background: #e8f1f8; color: #123b62; text-align: left; }}
th, td {{ border: 1px solid #b8c5d0; padding: 5px 6px; vertical-align: top; }}
li {{ margin: 3px 0; }}
blockquote {{ background: #f3f7fa; border-left: 4px solid #2f80b7; margin: 10px 0; padding: 7px 12px; }}
code {{ background: #f0f2f5; padding: 1px 3px; }}
pre {{ background: #f0f2f5; padding: 8px; white-space: pre-wrap; }}
a {{ color: #1769aa; }}
</style>
</head>
<body>
{''.join(sections)}
</body>
</html>"""


def main() -> int:
    files = sorted(ROOT.glob("**/*.md"))
    if not files:
        print("No Markdown files found.", file=sys.stderr)
        return 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary_directory:
        html_file = Path(temporary_directory) / "documentation.html"
        html_file.write_text(build_html(files), encoding="utf-8")
        libreoffice = shutil.which("libreoffice") or shutil.which("soffice")
        if libreoffice is None:
            print(
                "LibreOffice is required to create the PDF. "
                "Install it or open the generated HTML in a browser and print it to PDF.",
                file=sys.stderr,
            )
            return 1
        result = subprocess.run(
            [
                libreoffice,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(OUTPUT.parent),
                str(html_file),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(result.stderr or "LibreOffice could not create the PDF.", file=sys.stderr)
            return result.returncode
        generated_pdf = OUTPUT.parent / f"{html_file.stem}.pdf"
        generated_pdf.replace(OUTPUT)
    print(f"Created {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
