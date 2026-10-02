// FR-005 - Stamina staircase [FROZEN]
// After P150, passage length grows in 25-word steps ("short bridges, big consolidation"):
// per 150-passage block, three 25-passage bridge steps of +25 words, then 75 passages
// consolidated at the next 100-word milestone. P1500 is a 1,000-word passage.

export const WORLD1_LAST_PASSAGE = 1500;

export function passageWords(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > WORLD1_LAST_PASSAGE) {
    throw new RangeError("World 1 passage sequence must be an integer 1..1500");
  }
  if (sequence <= 150) return 100;
  const offset = sequence - 151;
  const block = Math.floor(offset / 150);
  const inBlock = offset % 150;
  const bridges = inBlock < 75 ? Math.floor(inBlock / 25) + 1 : 4;
  return 100 + block * 100 + bridges * 25;
}

export type StaircaseRow = { from: number; to: number; words: number };

/** The staircase as contiguous (from, to, words) rows, derived from passageWords. */
export function staircaseTable(): StaircaseRow[] {
  const rows: StaircaseRow[] = [];
  for (let s = 1; s <= WORLD1_LAST_PASSAGE; s += 1) {
    const words = passageWords(s);
    const last = rows[rows.length - 1];
    if (last && last.words === words) last.to = s;
    else rows.push({ from: s, to: s, words });
  }
  return rows;
}
