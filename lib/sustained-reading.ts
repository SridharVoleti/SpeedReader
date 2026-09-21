// SR-R7-001: Duration-band measurement.
// "Measure performance over configured sustained-reading duration bands."
// "Attempt identifies duration band and rate/comprehension over full valid interval." Only the
// valid (uninterrupted) portion of the attempt counts toward duration, rate and comprehension -
// a technical interruption never inflates or deflates sustained measurement.

export type DurationBandConfig = { bandId: string; minSeconds: number; maxSeconds: number }[];

export type ReadingSegment = {
  startSeconds: number;
  endSeconds: number;
  wordsRead: number;
  valid: boolean;
  comprehensionCorrect: number;
  comprehensionTotal: number;
};

export type SustainedAttempt = {
  segments: ReadingSegment[];
};

export type DurationBandMeasurement = {
  durationBand: string | null;
  sustainedWpm: number;
  comprehensionRate: number | null;
};

export const DEFAULT_DURATION_BANDS: DurationBandConfig = [
  { bandId: "SHORT", minSeconds: 0, maxSeconds: 300 },
  { bandId: "MEDIUM", minSeconds: 300, maxSeconds: 900 },
  { bandId: "LONG", minSeconds: 900, maxSeconds: Infinity }
];

export function classifyDurationBand(totalValidSeconds: number, bands: DurationBandConfig = DEFAULT_DURATION_BANDS): string | null {
  if (totalValidSeconds <= 0) return null;
  const band = bands.find((candidate) => totalValidSeconds >= candidate.minSeconds && totalValidSeconds < candidate.maxSeconds);
  return band ? band.bandId : null;
}

export function measureSustainedPerformance(
  attempt: SustainedAttempt,
  bands: DurationBandConfig = DEFAULT_DURATION_BANDS
): DurationBandMeasurement {
  const validSegments = attempt.segments.filter((segment) => segment.valid);
  const totalValidSeconds = validSegments.reduce((sum, segment) => sum + (segment.endSeconds - segment.startSeconds), 0);
  const totalWords = validSegments.reduce((sum, segment) => sum + segment.wordsRead, 0);
  const totalCorrect = validSegments.reduce((sum, segment) => sum + segment.comprehensionCorrect, 0);
  const totalQuestions = validSegments.reduce((sum, segment) => sum + segment.comprehensionTotal, 0);

  return {
    durationBand: classifyDurationBand(totalValidSeconds, bands),
    sustainedWpm: totalValidSeconds > 0 ? Math.round((totalWords / totalValidSeconds) * 60) : 0,
    comprehensionRate: totalQuestions > 0 ? totalCorrect / totalQuestions : null
  };
}
