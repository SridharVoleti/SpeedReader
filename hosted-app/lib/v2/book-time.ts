// FR-033 - Book-time impact [FROZEN]
// On every validated +1 WPM Level Up, show an estimated real-world reading-time impact for a standard
// 50,000-word (~200 page) reference book:  estimated_minutes = 50,000 / WPM.
// Shows previous WPM -> new WPM, estimated time at the new WPM (hours/minutes), approximate time saved
// versus the previous WPM, and optionally the cumulative time saved versus the learner's original
// baseline. Wording is always "about"/"estimated" - never a promise of exact real-book performance.

export const REFERENCE_BOOK_WORDS = 50_000;

export function estimatedMinutes(wpm: number, bookWords: number = REFERENCE_BOOK_WORDS): number {
  if (!Number.isFinite(wpm) || wpm <= 0) throw new RangeError("WPM must be a positive number");
  return bookWords / wpm;
}

export type HoursMinutes = { hours: number; minutes: number };

export function toHoursMinutes(totalMinutes: number): HoursMinutes {
  const rounded = Math.round(totalMinutes);
  return { hours: Math.floor(rounded / 60), minutes: rounded % 60 };
}

export function formatDuration({ hours, minutes }: HoursMinutes): string {
  const h = hours === 1 ? "1 hour" : `${hours} hours`;
  const m = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  if (hours === 0) return m;
  if (minutes === 0) return h;
  return `${h} ${m}`;
}

export type BookTimeImpact = {
  previousWpm: number;
  newWpm: number;
  estimatedMinutesAtNewWpm: number;
  estimatedAtNewWpm: HoursMinutes;
  savedMinutesVsPrevious: number;
  savedVsPrevious: HoursMinutes;
  cumulativeSavedMinutesVsBaseline?: number;
  cumulativeSavedVsBaseline?: HoursMinutes;
  /** Learner-facing text: uses "about"/"estimated" and never promises exact performance. */
  message: string;
};

export function bookTimeImpact(previousWpm: number, newWpm: number, baselineWpm?: number): BookTimeImpact {
  if (newWpm <= previousWpm) throw new RangeError("a Level Up raises WPM");
  const atNew = estimatedMinutes(newWpm);
  const saved = estimatedMinutes(previousWpm) - atNew;
  const impact: BookTimeImpact = {
    previousWpm,
    newWpm,
    estimatedMinutesAtNewWpm: atNew,
    estimatedAtNewWpm: toHoursMinutes(atNew),
    savedMinutesVsPrevious: saved,
    savedVsPrevious: toHoursMinutes(saved),
    message: ""
  };
  let tail = "";
  if (baselineWpm !== undefined && baselineWpm < newWpm) {
    const cumulative = estimatedMinutes(baselineWpm) - atNew;
    impact.cumulativeSavedMinutesVsBaseline = cumulative;
    impact.cumulativeSavedVsBaseline = toHoursMinutes(cumulative);
    tail = ` Since you started, that is about ${formatDuration(impact.cumulativeSavedVsBaseline)} saved.`;
  }
  impact.message =
    `${previousWpm} WPM → ${newWpm} WPM. At ${newWpm} WPM, a 50,000-word book (about 200 pages) takes an estimated ` +
    `${formatDuration(impact.estimatedAtNewWpm)} — about ${formatDuration(impact.savedVsPrevious)} less than at ${previousWpm} WPM.${tail}`;
  return impact;
}
