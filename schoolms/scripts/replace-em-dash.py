"""
Replace all em dash characters (—, U+2014) with hyphens (-, U+002D)
in all text files under the schoolms/ directory.
Skips: node_modules, .git, .next, binary files.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EM_DASH = "\u2014"
HYPHEN = "-"

SKIP_DIRS = {"node_modules", ".git", ".next", ".vercel", "dist", ".turbo"}
TEXT_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".mdx", ".txt", ".css", ".scss",
    ".html", ".env", ".env.local", ".env.example",
    ".prisma", ".toml", ".yaml", ".yml", ".sh",
}

replaced_files = 0
replaced_total = 0

for dirpath, dirnames, filenames in os.walk(ROOT):
    # Prune skipped directories in-place
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

    for filename in filenames:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in TEXT_EXTENSIONS and not filename.startswith(".env"):
            continue

        filepath = os.path.join(dirpath, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except (UnicodeDecodeError, PermissionError):
            continue  # skip binary or unreadable files

        count = content.count(EM_DASH)
        if count == 0:
            continue

        new_content = content.replace(EM_DASH, HYPHEN)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)

        rel = os.path.relpath(filepath, ROOT)
        print(f"  {rel}: {count} replacement(s)")
        replaced_files += 1
        replaced_total += count

print(f"\nDone. {replaced_total} em dash(es) replaced in {replaced_files} file(s).")
