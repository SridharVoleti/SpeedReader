"use client";

// Memory check (retention): answer a few questions about a story you read earlier - WITHOUT seeing it again. Only after
// answering do you get a short refresher (retrieval first, then feedback). It is optional, never affects speed or
// the next story, and a faded memory is presented as normal.

import { useEffect, useState } from "react";
import { api, friendlyProblem, type StoryItem } from "./api";
import styles from "./learner.module.css";

type Result = { feedback: { message: string; remembered: boolean }; refresher: string | null };

export default function Retention({ onExit, onProblem }: { onExit: () => void; onProblem: (m: string) => void }) {
  const [due, setDue] = useState<{ passageId: string; checkNumber: number } | null>(null);
  const [items, setItems] = useState<StoryItem[] | null>(null);
  const [none, setNone] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [key] = useState(() => `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    void api<{ due: { passageId: string; checkNumber: number }; items: StoryItem[] }>("GET", "retention/next").then((r) => {
      if (r.ok) { setDue(r.data.due); setItems(r.data.items); setAnswers(r.data.items.map(() => null)); }
      else if (r.status === 409) setNone(true);
      else onProblem(friendlyProblem(r));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    if (!due) return;
    setBusy(true);
    const r = await api<Result>("POST", "retention/submit", { attemptId: key, passageId: due.passageId, answers });
    setBusy(false);
    if (!r.ok) return onProblem(friendlyProblem(r));
    setResult(r.data);
  }

  if (none) {
    return (
      <section className={styles.card} data-testid="rt-none">
        <h2>Nothing to remember right now</h2>
        <p>Come back after a little while. We will ask about a story you have read, to help it stay with you.</p>
        <div className={styles.row}><button type="button" className={styles.primary} onClick={onExit} data-testid="rt-back">Back to my stories</button></div>
      </section>
    );
  }

  if (result) {
    return (
      <section className={`${styles.card} ${result.feedback.remembered ? styles.levelUp : ""}`} data-testid="rt-result">
        <div className={styles.celebrate} aria-hidden="true">{result.feedback.remembered ? "🧠" : "🌱"}</div>
        <h2 data-testid="rt-message">{result.feedback.message}</h2>
        {result.refresher && (
          <>
            <p className={styles.note}>A quick refresher:</p>
            <p data-testid="rt-refresher">{result.refresher}</p>
          </>
        )}
        <div className={styles.row}><button type="button" className={styles.primary} onClick={onExit} data-testid="rt-done">Keep going</button></div>
      </section>
    );
  }

  if (!items) return <section className={styles.card} role="status"><p>Finding a story to remember...</p></section>;

  return (
    <section className={styles.card} aria-label="Memory check" data-testid="rt-questions">
      <h2>Do you remember a story you read earlier?</h2>
      <p>Try to answer from memory. There is no hurry, and it is fine if some of it is fuzzy.</p>
      {items.map((item, i) => (
        <fieldset key={item.itemId} className={styles.fieldset}>
          <legend className={styles.legend}>{item.stem}</legend>
          {item.options.map((opt, o) => (
            <label key={o} className={styles.option}>
              <input type="radio" name={`rt-${item.itemId}`} checked={answers[i] === o} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? o : x)))} />
              <span>{opt}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className={styles.row}>
        <button type="button" className={styles.primary} disabled={busy || !answers.every((a) => a !== null)} onClick={() => void send()} data-testid="rt-send">Done</button>
        <button type="button" className={styles.secondary} onClick={onExit} data-testid="rt-later">Not now</button>
      </div>
    </section>
  );
}
