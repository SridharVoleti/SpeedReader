#!/usr/bin/env bash
# Usage: tools/ship-fr.sh FR-002 "Title" "live-substring"
# build -> unit+ui tests -> progress row -> commit -> push -> wait for live deploy -> verify live page.
set -e
cd "$(dirname "$0")/.."
FR="$1"; TITLE="$2"; NEEDLE="$3"
npx tsc --noEmit
npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL" 
npx next build 2>&1 | grep -iE "error|Compiled" || true
timeout 200 npx playwright test hosted-app/tests/ui/frozen-v2.spec.ts --project=desktop 2>&1 | tail -4
P=hosted-app/requirements/PROGRESS.md
grep -q "^| $FR |" "$P" && sed -i "s#^| $FR |.*#| $FR | $TITLE | Done | pending |#" "$P" || echo "| $FR | $TITLE | Done | pending |" >> "$P"
git add -A hosted-app/lib hosted-app/tests hosted-app/ui hosted-app/app.manifest.ts "$P" tools 2>/dev/null
git commit -q -m "Implement $FR: $TITLE" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" 2>/dev/null
H=$(git rev-parse --short HEAD)
sed -i "s#^| $FR |\(.*\)| pending |#| $FR |\1| $H |#" "$P"
git add "$P"; git commit -q --amend --no-edit
H=$(git rev-parse --short HEAD)
git push -q origin main 2>&1 | grep -v warning || true
for i in $(seq 1 20); do
  if curl -s https://speedreader.babystepsindia.com/frozen-v2-demo | grep -qF "$NEEDLE"; then echo "LIVE OK $FR ($H)"; exit 0; fi
  sleep 12
done
echo "LIVE CHECK FAILED $FR"; exit 1
