#!/usr/bin/env bash
# Usage: tools/ship-fr.sh FR-002 "Title" "live-substring"
# typecheck -> unit tests (must ALL pass) -> build -> ui test -> commit code -> record hash -> push -> verify live.
set -euo pipefail
cd "$(dirname "$0")/.."
FR="$1"; TITLE="$2"; NEEDLE="$3"
P=hosted-app/requirements/PROGRESS.md

npx tsc --noEmit

# Unit tests: print the summary, but abort the ship if anything failed.
if ! npx vitest run > /tmp/vitest-ship.log 2>&1; then
  grep -E "FAIL|×|Test Files|Tests " /tmp/vitest-ship.log | head -30
  echo "UNIT TESTS FAILED - not shipping $FR"
  exit 1
fi
grep -E "Test Files|Tests " /tmp/vitest-ship.log

npx next build 2>&1 | grep -iE "error|Compiled" || true

if ! timeout 200 npx playwright test hosted-app/tests/ui/frozen-v2.spec.ts --project=desktop > /tmp/pw-ship.log 2>&1; then
  tail -25 /tmp/pw-ship.log
  echo "UI TESTS FAILED - not shipping $FR"
  exit 1
fi
tail -3 /tmp/pw-ship.log

git add -A hosted-app/lib hosted-app/tests hosted-app/ui hosted-app/app.manifest.ts hosted-app/archive tools tsconfig.json 2>/dev/null
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
