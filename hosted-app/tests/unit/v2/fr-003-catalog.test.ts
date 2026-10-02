import { describe, expect, it } from "vitest";
import { WORLD1_PASSAGE_COUNT, validateWorld1Catalog, first150Architecture } from "../../../lib/v2/catalog";

const seqs = (n: number) => Array.from({ length: n }, (_, i) => ({ sequence: i + 1 }));

// FR-003 - 1,500 canonical passages [FROZEN]
describe("FR-003 1,500 canonical passages", () => {
  it("requires exactly 1,500 sequential passages", () => {
    expect(WORLD1_PASSAGE_COUNT).toBe(1500);
    expect(validateWorld1Catalog(seqs(1500))).toEqual([]);
  });

  it("rejects fewer or more than 1,500", () => {
    expect(validateWorld1Catalog(seqs(1499))).toContain("expected exactly 1500 passages, got 1499");
    expect(validateWorld1Catalog(seqs(1501))).toContain("expected exactly 1500 passages, got 1501");
  });

  it("rejects duplicates, gaps and out-of-order sequences", () => {
    const dup = seqs(1500); dup[10] = { sequence: 5 };
    expect(validateWorld1Catalog(dup).join()).toMatch(/duplicate sequence 5/);
    const gap = seqs(1500); gap[1499] = { sequence: 1501 };
    expect(validateWorld1Catalog(gap).join()).toMatch(/missing sequence 1500/);
    const swapped = seqs(1500); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validateWorld1Catalog(swapped).join()).toMatch(/out of order at index 0/);
  });

  it("retains the approved 15 RS x 10 P architecture for the first 150 passages", () => {
    const arch = first150Architecture();
    expect(arch).toHaveLength(150);
    expect(new Set(arch.map((c) => c.rsId)).size).toBe(15);
    expect(new Set(arch.map((c) => c.pLevel)).size).toBe(10);
    expect(arch.filter((c) => c.rsId === "RS01")).toHaveLength(10);
  });
});
