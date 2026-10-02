import { describe, expect, it } from "vitest";
import { passageWords, staircaseTable } from "../../../lib/v2/stamina";

// FR-005 - Stamina staircase [FROZEN]
describe("FR-005 stamina staircase", () => {
  it("matches the frozen table for the first 450 passages", () => {
    const table: Array<[number, number, number]> = [
      [1, 150, 100], [151, 175, 125], [176, 200, 150], [201, 225, 175], [226, 300, 200],
      [301, 325, 225], [326, 350, 250], [351, 375, 275], [376, 450, 300]
    ];
    for (const [from, to, words] of table) {
      expect(passageWords(from)).toBe(words);
      expect(passageWords(to)).toBe(words);
      expect(passageWords(Math.floor((from + to) / 2))).toBe(words);
    }
  });

  it("repeats the pattern for each subsequent 150-passage block", () => {
    // block starts at 451: 25@+25, 25@+50, 25@+75, then 75 consolidating at the next 100 milestone.
    expect(passageWords(451)).toBe(325);
    expect(passageWords(475)).toBe(325);
    expect(passageWords(476)).toBe(350);
    expect(passageWords(501)).toBe(375);
    expect(passageWords(526)).toBe(400);
    expect(passageWords(600)).toBe(400);
    expect(passageWords(601)).toBe(425);
  });

  it("reaches a 1,000-word passage at P1500", () => {
    expect(passageWords(1500)).toBe(1000);
    expect(passageWords(1426)).toBe(1000);
    expect(passageWords(1425)).toBe(975);
  });

  it("never decreases, and increases only in +25 steps", () => {
    let previous = passageWords(1);
    for (let s = 2; s <= 1500; s += 1) {
      const w = passageWords(s);
      expect([0, 25]).toContain(w - previous);
      previous = w;
    }
  });

  it("has 100-word milestones consolidating 75 passages each (after the foundation)", () => {
    const table = staircaseTable();
    const consolidations = table.filter((r) => r.words % 100 === 0 && r.words > 100);
    expect(consolidations.every((r) => r.to - r.from + 1 === 75)).toBe(true);
    expect(table[0]).toEqual({ from: 1, to: 150, words: 100 });
    expect(table.at(-1)).toEqual({ from: 1426, to: 1500, words: 1000 });
  });

  it("rejects sequences outside 1..1500", () => {
    expect(() => passageWords(0)).toThrow(RangeError);
    expect(() => passageWords(1501)).toThrow(RangeError);
    expect(() => passageWords(1.5)).toThrow(RangeError);
  });
});
