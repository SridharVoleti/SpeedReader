// The learner-facing outcome: "Read a 200-page book in under 3 hours - with understanding and retention."
//
// Speed is the means, not the headline. This turns the engine-owned earned WPM into the outcome a child or parent cares
// about: how long a standard 200-page (~50,000-word, FR-033) book would take TODAY compared with the 3-hour goal.
// Wording is always "about" and never promises real-book performance. The WPM needed for the goal is derived, not
// configured: 50,000 words / 180 minutes = ~278 WPM, above the World 1 ceiling of 150, so the goal is presented as a
// journey and is never shown as already reachable inside World 1. Nothing here feeds progression.

import { REFERENCE_BOOK_WORDS, estimatedMinutes, formatDuration, toHoursMinutes } from "./book-time";
import { WORLD1_MAX_WPM } from "./speed-ceiling";

export const BOOK_PAGES = 200;
export const GOAL_MINUTES = 180;
/** WPM at which the reference book takes exactly the goal time. */
export const GOAL_WPM = Math.ceil(REFERENCE_BOOK_WORDS / GOAL_MINUTES);

export const OUTCOME_HEADLINE = "Read a 200-page book in under 3 hours - with understanding and retention.";

export type BookGoalView = {
  /** Estimated minutes for the reference book at the learner's earned speed. */
  minutesNow: number;
  /** ... and at the speed they started with. */
  minutesAtStart: number;
  /** Learner-facing sentence, e.g. "about 8 hours 20 minutes". */
  nowText: string;
  goalText: string;
  /** Time saved since starting, in the same wording ("about 1 hour 40 minutes"), or null before any gain. */
  savedText: string | null;
  /** 0..1 share of the way from the starting time to the goal time (capped; never claims the goal is met early). */
  journey: number;
  goalReached: boolean;
};

const about = (minutes: number) => `about ${formatDuration(toHoursMinutes(minutes))}`;

export function bookGoalView(currentWpm: number, startingWpm: number): BookGoalView {
  if (!(currentWpm > 0) || !(startingWpm > 0)) throw new RangeError("speeds must be positive");
  const minutesNow = estimatedMinutes(currentWpm);
  const minutesAtStart = estimatedMinutes(startingWpm);
  const span = minutesAtStart - GOAL_MINUTES;
  const gained = minutesAtStart - minutesNow;
  const journey = span <= 0 ? (minutesNow <= GOAL_MINUTES ? 1 : 0) : Math.max(0, Math.min(1, gained / span));
  const saved = minutesAtStart - minutesNow;
  return {
    minutesNow,
    minutesAtStart,
    nowText: about(minutesNow),
    goalText: "under 3 hours",
    savedText: saved >= 1 ? about(saved) : null,
    journey,
    goalReached: minutesNow < GOAL_MINUTES
  };
}

/** The World 1 ceiling expressed in the same terms (what the current world can deliver at best). */
export function world1BestCase(): { minutes: number; text: string } {
  const minutes = estimatedMinutes(WORLD1_MAX_WPM);
  return { minutes, text: about(minutes) };
}
