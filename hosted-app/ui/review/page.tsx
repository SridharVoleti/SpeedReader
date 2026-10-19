"use client";

// Content review (diagnostics-only): the owner-approved World 1 passages (delivery sessions 1-49) shown in the real
// one-word reader with their authored questions, answers, hints and explanations visible, so content can be reviewed
// in the app itself. This is a read-only projection built by tools/build-review-bundle.mjs from Approved_v2; it is not
// the learner journey and it records nothing.

import { useMemo, useState } from "react";
import bundle from "../../data/review/world1-approved-v2.json";
import Reader from "../learner/Reader";
import { tokensFromText } from "../../lib/v2/rsvp";
import styles from "./review.module.css";

type Item = {
  id: string; dimension: string; type: string; question: string; options: string[] | null;
  answer: string; primary: boolean; hint: string | null; explanation: string | null;
};
type Passage = {
  session: number; id: string; sourceFile: string; status: string; superseded: boolean; title: string; strand: string;
  rs: string; pLevel: string; wordCount: number | null; text: string; primaryDimension: string | null;
  requiredCorrect: number | null; items: Item[];
};

const passages = bundle.passages as Passage[];
const missing = bundle.missingSessions as number[];
const SPEEDS = [60, 80, 100, 120, 150];

export default function ReviewPage() {
  const [selected, setSelected] = useState(0);
  const [wpm, setWpm] = useState(100);
  const [run, setRun] = useState(0);
  const p = passages[selected];
  const tokens = useMemo(() => tokensFromText(p.text), [p.text]);

  const pick = (i: number) => { setSelected(i); setRun((r) => r + 1); };

  return (
    <main className={styles.shell}>
      <aside className={styles.list} aria-label="Passages">
        <h1 className={styles.heading}>World 1 review</h1>
        <p className={styles.note} data-testid="review-count">{passages.length} passages, sessions 1-49{missing.length ? `; session ${missing.join(", ")} not supplied` : ""}</p>
        <ol className={styles.nav}>
          {passages.map((q, i) => (
            <li key={q.id}>
              <button type="button" className={i === selected ? styles.navActive : styles.navItem} onClick={() => pick(i)} data-testid={`review-pick-${q.session}`}>
                <span className={styles.navNo}>{q.session}</span>
                <span>{q.title}{q.superseded ? " (_old)" : ""}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <section className={styles.detail}>
        <header>
          <h2 className={styles.title} data-testid="review-title">{p.session}. {p.title}</h2>
          <p className={styles.meta}>
            {p.id} · {p.rs} {p.pLevel} · {p.strand} · {p.wordCount ?? p.text.split(/\s+/).length} words · <span className={styles.badge}>{p.status} (not certified)</span>
            {p.superseded ? <span className={styles.badgeWarn}> source file is named {p.sourceFile}</span> : null}
          </p>
        </header>

        <div className={styles.speed} role="group" aria-label="Reading speed">
          <span>Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={s === wpm ? styles.speedOn : styles.speedOff} onClick={() => { setWpm(s); setRun((r) => r + 1); }}>{s} WPM</button>
          ))}
        </div>

        <Reader key={`${p.id}-${wpm}-${run}`} tokens={tokens} wpm={wpm} onComplete={() => undefined} />

        <h3 className={styles.sub}>Full text</h3>
        <p className={styles.text} data-testid="review-text">{p.text}</p>

        <h3 className={styles.sub}>Questions ({p.items.length}{p.requiredCorrect !== null ? `, ${p.requiredCorrect} needed first try` : ""})</h3>
        <ol className={styles.items}>
          {p.items.map((it) => (
            <li key={it.id} className={styles.item} data-testid="review-item">
              <p className={styles.q}>{it.question} <span className={styles.tag}>{it.dimension}{it.primary ? " · primary" : ""} · {it.type === "MULTIPLE_CHOICE" ? "multiple choice" : "typed answer"}</span></p>
              {it.options ? (
                <ul className={styles.opts}>
                  {it.options.map((o) => <li key={o} className={o === it.answer ? styles.correct : undefined}>{o}{o === it.answer ? " ✓" : ""}</li>)}
                </ul>
              ) : null}
              {it.options ? null : <p><strong>Answer:</strong> {it.answer}</p>}
              {it.hint ? <p className={styles.small}><strong>Hint:</strong> {it.hint}</p> : null}
              {it.explanation ? <p className={styles.small}><strong>Explanation:</strong> {it.explanation}</p> : null}
            </li>
          ))}
        </ol>

        <div className={styles.pager}>
          <button type="button" className={styles.speedOff} disabled={selected === 0} onClick={() => pick(selected - 1)}>Previous</button>
          <button type="button" className={styles.speedOff} disabled={selected === passages.length - 1} onClick={() => pick(selected + 1)}>Next</button>
        </div>
      </section>
    </main>
  );
}
