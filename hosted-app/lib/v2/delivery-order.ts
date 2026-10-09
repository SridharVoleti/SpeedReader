// APP-KM-001 / APP-W1-002 - correct delivery coordinate for the first 150 canonical passages.
//
// The approved Band-A registry is a 15 RS x 10 P matrix. Learners are NOT served in registry-ID order: delivery
// follows `delivery_session`, which interleaves the 15 reading stages round by round:
//     delivery_session = (P - 1) * 15 + RS          (enforced for every row by pipeline-v2/registry.ts validateRow)
// and registry passage numbers run stage by stage:
//     passage_no       = (RS - 1) * 10 + P           (e.g. RS01-P10 = W1-0010, RS02-P10 = W1-0020 in the readiness matrix)
// So canonical sequence 1..15 are P1 of RS01..RS15, 16..30 are P2 of RS01..RS15, and so on.
//
// Beyond sequence 150 the provided specification defines no registry structure; those positions are mapped
// identity (sequence = passage number) and flagged `specified: false` so callers never mistake it for canon.

export const BAND_A_PASSAGES = 150;
export const RS_COUNT = 15;
export const P_COUNT = 10;

export type DeliveryCoordinate = {
  sequence: number;
  rs: number;
  p: number;
  passageNo: number;
  passageId: string;
  coordinate: string;
  /** False beyond the specified first 150 (identity mapping, an explicit placeholder). */
  specified: boolean;
};

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function deliveryCoordinateFor(sequence: number): DeliveryCoordinate {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 1500) throw new RangeError("canonical sequence must be an integer 1..1500");
  if (sequence > BAND_A_PASSAGES) {
    return { sequence, rs: 0, p: 0, passageNo: sequence, passageId: `W1-${pad(sequence, 4)}`, coordinate: `SEQ-${sequence}`, specified: false };
  }
  const rs = ((sequence - 1) % RS_COUNT) + 1;
  const p = Math.floor((sequence - 1) / RS_COUNT) + 1;
  const passageNo = (rs - 1) * P_COUNT + p;
  return { sequence, rs, p, passageNo, passageId: `W1-${pad(passageNo, 4)}`, coordinate: `RS${pad(rs, 2)}-P${p}`, specified: true };
}

/** Inverse: which canonical sequence does a registry passage number occupy? */
export function sequenceForPassageNo(passageNo: number): number {
  if (!Number.isInteger(passageNo) || passageNo < 1 || passageNo > 1500) throw new RangeError("passage number must be an integer 1..1500");
  if (passageNo > BAND_A_PASSAGES) return passageNo;
  const rs = Math.floor((passageNo - 1) / P_COUNT) + 1;
  const p = ((passageNo - 1) % P_COUNT) + 1;
  return (p - 1) * RS_COUNT + rs;
}

export function sequenceForPassageId(passageId: string): number | null {
  const m = /^W1-(\d{4})$/.exec(passageId);
  return m ? sequenceForPassageNo(Number.parseInt(m[1], 10)) : null;
}

export type RegistryCoordinate = { registryPassageId: string; rsId: string; p: number };

/** Registry/RS/P coordinate stored with an attempt (APP-DATA-002). Null outside the specified Band-A registry. */
export function registryCoordinateFor(passageId: string): RegistryCoordinate | null {
  const seq = sequenceForPassageId(passageId);
  if (seq === null || seq > BAND_A_PASSAGES) return null;
  const c = deliveryCoordinateFor(seq);
  return { registryPassageId: passageId, rsId: `RS${pad(c.rs, 2)}`, p: c.p };
}
