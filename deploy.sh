#!/bin/zsh
# Deploy site/ to codex.jeerawut.com, but stop if anything from the speaker notes (they hold the answers) got into site/.
set -euo pipefail
cd "${0:A:h}"

if grep -rqi '<aside' site; then
  echo "site/ has an <aside> (speaker notes): remove it before deploying" >&2
  exit 1
fi

notes=slides/speaker-notes.md
if [[ ! -f $notes && ${SKIP_NOTES_CHECK:-} != 1 ]]; then
  echo "$notes not found, so site/ cannot be checked against the notes (SKIP_NOTES_CHECK=1 to deploy anyway)" >&2
  exit 1
fi

if [[ -f $notes ]]; then
  # any 40 characters of a note (spaces collapsed, case ignored) that also appear in site/ text with tags stripped = leak
  python3 -I - "$notes" site <<'EOF'
import html, pathlib, re, sys
N = 40
norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()
notes = [norm(l) for l in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
grams, where = set(), {}
for f in sorted(pathlib.Path(sys.argv[2]).rglob("*")):
    if f.is_file() and f.suffix in (".html", ".css", ".js", ".txt", ".md", ".json", ""):
        t = norm(html.unescape(re.sub(r"<[^>]+>", " ", f.read_text(encoding="utf-8", errors="ignore"))))
        for i in range(len(t) - N + 1):
            grams.add(t[i:i + N]); where.setdefault(t[i:i + N], str(f))
hits = {(where[n[i:i + N]], n[i:i + N]) for n in notes for i in range(len(n) - N + 1) if n[i:i + N] in grams}
for f, g in sorted(hits)[:10]:
    print("speaker-note text in %s: %s" % (f, g), file=sys.stderr)
sys.exit(1 if hits else 0)
EOF
fi

npx --yes wrangler@4.166.0 deploy
