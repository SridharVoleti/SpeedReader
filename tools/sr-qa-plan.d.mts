export const V3_UI_SPECS: readonly string[];
export type QaStep = { name: string; command: string };
export function qaPlan(options?: { ui?: boolean; diagnosticsUi?: boolean }): QaStep[];
