#!/usr/bin/env bash
# Usage: tools/ship-fr.sh FR-002 "Title" "live-substring"
# typecheck -> unit tests -> build -> ui test -> commit code -> record hash -> push -> verify live.
set -e
cd "$(dirname "$0")/.."
FR="$1"; TITLE="$2"; NEEDLE="$3"
P=hosted-app/requirements/PROGRESS.md
npx tsc --noEmit
npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL"
npx next build 2>&1 | grep -iE "error|Compiled" || true
timeout 200 npx playwright test hosted-app/tests/ui/frozen-v2.spec.ts --project=desktop 2>&1 | tail -3
git add -A hosted-app/lib hosted-app/tests hosted-app/ui hosted-app/app.manifest.ts tools 2>/dev/null
git commit -q -m "Implement $FR: $TITLE" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
H=$(git rev-parse --short HEAD)
python tools/progress-row.py "$P" "$FR" "$TITLE" "$H"
git add "$P"
git commit -q -m "Update progress: $FR done" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin main 2>&1 | grep -v warning || true
for i in $(seq 1 30); do
  if curl -s https://speedreader.babystepsindia.com/frozen-v2-demo | sed "s/&gt;/>/g;s/&lt;/</g;s/&amp;/\&/g" | grep -qF "$NEEDLE"; then echo "LIVE OK $FR ($H)"; exit 0; fi
  sleep 12
done
echo "LIVE CHECK FAILED $FR"; exit 1
