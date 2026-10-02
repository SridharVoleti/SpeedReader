// Tiny deterministic stemmer shared by the spoken-expression evaluator and the BPC fidelity check.
// Deliberately simple (no dictionary, no AI): it only has to make "kite/kites", "help/helped/helping",
// "cry/cried" compare equal.

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
  if (/(ied|ies)$/.test(w) && w.length > 4) return w.replace(/(ied|ies)$/, "y");
  if (/(ing)$/.test(w) && w.length > 5) w = w.slice(0, -3);
  else if (/(ed)$/.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (/(sses|shes|ches|xes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) w = w.slice(0, -1);
  return w;
}
