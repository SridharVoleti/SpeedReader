import type { RoleId } from "./roles";

/** Final-package section -> the role whose approved artifact it must reproduce exactly. */
export const SECTION_ROLE = Object.freeze({
  spec: 1, passage: 2, assessment: 3, meaningUnits: 4, bpc: 5, scoring: 6, attemptContract: 7
} as const satisfies Record<string, RoleId>);

export type Section = keyof typeof SECTION_ROLE;
export const SECTIONS = Object.keys(SECTION_ROLE) as Section[];
