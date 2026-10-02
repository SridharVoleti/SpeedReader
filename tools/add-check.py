"""Append a live-check entry to the frozen-v2 demo page and a Playwright assertion.

Usage: python tools/add-check.py FR-018 "Title" imports.txt expr.txt "expected text"
  imports.txt - extra import lines to add (one per line, may be empty)
  expr.txt    - a TypeScript expression producing the result string (an IIFE or template literal)
"""
import sys

fr, title, imports_path, expr_path, expected = sys.argv[1:6]
page = "hosted-app/ui/frozen-v2-demo/page.tsx"
spec = "hosted-app/tests/ui/frozen-v2.spec.ts"

src = open(page, encoding="utf8").read()
imports = [l for l in open(imports_path, encoding="utf8").read().splitlines() if l.strip()]
marker = 'import styles from "../page.module.css";'
for line in imports:
    if line not in src:
        src = src.replace(marker, line + "\n" + marker, 1)

expr = open(expr_path, encoding="utf8").read().strip()
entry = '  {\n    id: "%s",\n    title: "%s",\n    result: %s\n  }' % (fr, title, expr)
end = "\n];\n\nexport default function FrozenV2Demo"
assert end in src, "checks array end marker not found"
src = src.replace(end, ",\n" + entry + end, 1)
open(page, "w", encoding="utf8", newline="\n").write(src)

block = '\ntest("%s %s", async ({ page }) => {\n  await page.goto("/frozen-v2-demo");\n  await expect(page.getByTestId("result-%s")).toHaveText(\n    %s\n  );\n});\n' % (
    fr, title.replace('"', "'"), fr, __import__("json").dumps(expected))
open(spec, "a", encoding="utf8", newline="\n").write(block)
