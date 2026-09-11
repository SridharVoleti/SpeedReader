# Speed Reading App

AI-free, Python-heavy speed reading trainer with a Candy Crush–style level
progression: pass each level's comprehension check to unlock the next.

## Progression

- **6 worlds × 6 levels = 36 levels.** Each world fixes how many words are
  highlighted at a time (the "chunk"), from 1 word up to 6 words.
- **Within a world the speed climbs 100 → 120 → 140 → 160 → 180 → 200 WPM.**
- **Finishing 200 WPM promotes you to the next world**, which restarts at
  100 WPM with one more word per chunk (e.g. after 1-word @ 200 WPM comes
  2-words @ 100 WPM), all the way to 6 words at a time.
- **Every level ends with a comprehension check**: the student retells the
  passage in their own words and a deterministic scorer (length, key facts,
  main ideas, originality, clarity) awards 0–100 points. 70+ passes and
  unlocks the next level; 80+ earns 2 stars, 90+ earns 3 stars.
- Progress (best score, stars, unlocks) is stored in the browser's
  localStorage. Auth and payment are intentionally deferred.

Level data lives in `data/progression.json`, passages in
`data/passages/level-1.json`. The comprehension scorer exists twice by
design — `backend/speed_reading/scoring.py` (source of truth, unit-tested)
and `lib/scoring.ts` (browser port); keep their weights in sync.

## Commands

```bash
npm run dev        # start the app (or double-click run.bat on Windows)
npm run test:ui    # Playwright tests (requires a production build first)
npm run test:backend
```

Python tests can be run without installing the frontend dependencies:

```bash
python -m pytest backend/tests
```
