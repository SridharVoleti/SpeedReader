"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserSpeech, chunkSentences, createNarrator, normalizeWhitespace, type Narrator, type NarrationSegment, type NarratorStatus } from "../../lib/narrator";
import styles from "./ReadAloud.module.css";

// Screen-wide text-to-speech. Mounted once in the root layout so EVERY screen (home, progress,
// settings, level intro/quiz/results, every demo page) can be listened to. Content marked
// data-narrate-skip is never read; data-narration-lock (timed reading) disables narration, because
// speaking the passage would defeat the exercise and contaminate speed/comprehension evidence.

type Segment = NarrationSegment & { element: HTMLElement };

const INLINE_TAGS = new Set(["A", "SPAN", "STRONG", "EM", "B", "I", "SMALL", "CODE", "BR", "SUP", "SUB", "MARK", "BUTTON", "LABEL", "SVG", "IMG", "TIME", "ABBR", "U"]);
const NEVER_READ = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "CANVAS", "VIDEO", "AUDIO", "TEMPLATE"]);
const RATE_KEY = "speedreader_narration_rate";

function isReadable(el: HTMLElement): boolean {
  if (NEVER_READ.has(el.tagName)) return false;
  if (el.closest("[data-narrate-skip], [aria-hidden='true'], [hidden], nav, [data-read-aloud]")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return !(rect.width <= 1 && rect.height <= 1); // visually-hidden (screen-reader-only) helpers
}

function isLeafBlock(el: HTMLElement): boolean {
  if (/^H[1-6]$/.test(el.tagName)) return true;
  return Array.from(el.children).every((child) => INLINE_TAGS.has(child.tagName.toUpperCase()));
}

function textOf(el: HTMLElement): string {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      if (child.closest("[data-narrate-skip], [aria-hidden='true']") || NEVER_READ.has(child.tagName)) return;
      const inner = normalizeWhitespace(child.innerText ?? child.textContent ?? "");
      out += " " + inner + (["BUTTON", "A"].includes(child.tagName) && inner && !/[.!?]$/.test(inner) ? "." : "") + " ";
    }
  });
  return normalizeWhitespace(out);
}

export function collectSegments(root: HTMLElement): Segment[] {
  const found: Segment[] = [];
  const walk = (el: HTMLElement) => {
    if (!isReadable(el)) return;
    if (isLeafBlock(el)) {
      const text = textOf(el);
      if (text) {
        // Long blocks become sentence-sized pieces that all highlight the same element.
        chunkSentences(text).forEach((piece) => found.push({ text: piece, element: el }));
      }
      return;
    }
    // Mixed container: speak its own direct text first, then descend.
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join(" ");
    const ownText = normalizeWhitespace(own);
    if (ownText) chunkSentences(ownText).forEach((piece) => found.push({ text: piece, element: el }));
    Array.from(el.children).forEach((child) => walk(child as HTMLElement));
  };
  walk(root);
  return found;
}

function isLocked(): boolean {
  return document.querySelector("[data-narration-lock]") !== null;
}

export default function ReadAloud() {
  const narratorRef = useRef<Narrator | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const highlightedRef = useRef<HTMLElement | null>(null);
  const [supported, setSupported] = useState(true);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState<NarratorStatus>("idle");
  const [message, setMessage] = useState("Tap Listen to hear this screen read aloud.");
  const [rate, setRate] = useState(1);

  const clearHighlight = useCallback(() => {
    highlightedRef.current?.removeAttribute("data-narrating");
    highlightedRef.current = null;
  }, []);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(RATE_KEY));
      if (saved >= 0.7 && saved <= 1.4) setRate(saved);
    } catch { /* storage may be blocked - the default speed is fine */ }
  }, []);

  useEffect(() => {
    const speech = browserSpeech();
    if (!speech) {
      setSupported(false);
      setMessage("Read aloud is not supported by this browser.");
      return;
    }
    const synth = speech.synth as unknown as SpeechSynthesis;
    const narrator = createNarrator({
      ...speech,
      rate,
      onSegmentStart: (segment) => {
        const element = (segment as Segment).element;
        if (!element?.isConnected) return;
        clearHighlight();
        element.setAttribute("data-narrating", "true");
        highlightedRef.current = element;
        const rect = element.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight - 150) {
          const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        }
      },
      onStatus: (next, text) => {
        setStatus(next);
        setMessage(text);
        if (next === "idle") clearHighlight();
      },
      onDone: clearHighlight
    });
    narratorRef.current = narrator;

    // Mobile/desktop engines expose their voices lazily; a tap is also what un-suspends audio.
    const onPointer = () => {
      try { synth.resume(); } catch { /* safe no-op */ }
      narrator.refreshVoice();
    };
    document.addEventListener("pointerdown", onPointer, { passive: true });
    [100, 350, 1000, 2500].forEach((ms) => window.setTimeout(() => narrator.refreshVoice(), ms));

    // Anything that mounts a timed-reading lock, or swaps the screen under the narrator, stops speech.
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nowLocked = isLocked();
        setLocked(nowLocked);
        if (nowLocked) {
          narrator.stop("Narration is off during timed reading so it cannot spoil the exercise.");
          return;
        }
        if (segmentsRef.current.some((s) => !s.element.isConnected)) {
          narrator.stop("The screen changed, so narration stopped.");
          segmentsRef.current = [];
        }
      }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-narration-lock"] });
    setLocked(isLocked());

    // The microphone (speak-your-answer) must never hear the narrator.
    const onClickCapture = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest?.("[data-narration-stop]")) narrator.stop("Stopped so the microphone can listen.");
    };
    document.addEventListener("click", onClickCapture, true);
    const onHide = () => narrator.stop("Stopped.");
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("beforeunload", onHide);
      window.removeEventListener("pagehide", onHide);
      narrator.dispose();
      clearHighlight();
      narratorRef.current = null;
    };
  }, [rate, clearHighlight]);

  function listen() {
    const narrator = narratorRef.current;
    if (!narrator) return;
    if (isLocked()) {
      setMessage("Narration is off during timed reading so it cannot spoil the exercise.");
      return;
    }
    const root = (document.querySelector("main") as HTMLElement | null) ?? document.body;
    const segments = collectSegments(root);
    segmentsRef.current = segments;
    clearHighlight();
    narrator.start(segments); // synchronous with the tap - required by mobile autoplay rules
  }

  function changeRate(value: number) {
    setRate(value);
    try { window.localStorage.setItem(RATE_KEY, String(value)); } catch { /* ignore */ }
  }

  if (!supported) {
    return (
      <div className={styles.bar} data-read-aloud role="group" aria-label="Read aloud">
        <span className={styles.message} role="status">{message}</span>
      </div>
    );
  }

  return (
    <div className={styles.bar} data-read-aloud data-testid="read-aloud" role="group" aria-label="Read this screen aloud">
      <div className={styles.controls}>
        {status === "idle" && (
          <button type="button" className={styles.primary} data-testid="read-aloud-listen" disabled={locked} onClick={listen}>
            <span aria-hidden="true">🔊</span> Listen
          </button>
        )}
        {status === "speaking" && (
          <button type="button" className={styles.primary} data-testid="read-aloud-pause" onClick={() => narratorRef.current?.pause()}>
            Pause
          </button>
        )}
        {status === "paused" && (
          <button type="button" className={styles.primary} data-testid="read-aloud-resume" onClick={() => narratorRef.current?.resume()}>
            Resume
          </button>
        )}
        {status !== "idle" && (
          <button type="button" className={styles.secondary} data-testid="read-aloud-stop" onClick={() => narratorRef.current?.stop()}>
            Stop
          </button>
        )}
        <label className={styles.rate}>
          <span>Speed</span>
          <select data-testid="read-aloud-rate" value={rate} onChange={(event) => changeRate(Number(event.target.value))}>
            <option value={0.85}>Slower</option>
            <option value={1}>Normal</option>
            <option value={1.15}>Faster</option>
          </select>
        </label>
      </div>
      <span className={styles.message} role="status" aria-live="polite" data-testid="read-aloud-status">
        {locked ? "Narration is off during timed reading." : message}
      </span>
    </div>
  );
}
