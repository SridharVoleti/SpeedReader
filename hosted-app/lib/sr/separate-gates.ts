// SR-047 - Oral and comprehension readiness are evaluated and stored separately; neither compensates.

export type GateScores = { oral: number; comprehension: number };

export function evaluateGates(results: GateScores, thresholds: GateScores) {
  const oralReady = results.oral >= thresholds.oral;
  const comprehensionReady = results.comprehension >= thresholds.comprehension;
  return { results: { oral: results.oral, comprehension: results.comprehension }, oralReady, comprehensionReady, fullyReady: oralReady && comprehensionReady };
}
