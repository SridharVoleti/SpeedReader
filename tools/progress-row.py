import sys

path, fr, title, commit = sys.argv[1:5]
rows = open(path, encoding="utf8").read().split("\n")
row = f"| {fr} | {title} | Done | {commit} |"
for i, r in enumerate(rows):
    if r.startswith(f"| {fr} |"):
        rows[i] = row
        break
else:
    while rows and rows[-1] == "":
        rows.pop()
    rows.append(row)
    rows.append("")
open(path, "w", encoding="utf8", newline="\n").write("\n".join(rows))
