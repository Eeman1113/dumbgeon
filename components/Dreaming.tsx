"use client";

import { useEffect, useState } from "react";
import Wordmark from "./Wordmark";

/**
 * The wait before a session begins.
 *
 * Nano can take a while, and how long is genuinely unpredictable, so this
 * screen grows to fill whatever time it takes: new lines appear on a schedule
 * that stretches as the wait does, and the copy gets more candid the longer it
 * runs. A stalled bar would read as broken; a terminal still printing does not.
 */

interface Scheduled {
  at: number;
  text: string;
  tone?: "ok" | "hot";
}

const SCHEDULE: Scheduled[] = [
  { at: 0, text: "Allocating narrative heap .......... OK", tone: "ok" },
  { at: 1.5, text: "Seeding entropy from system clock .. OK", tone: "ok" },
  { at: 3, text: "Drawing a setting from the hat" },
  { at: 6, text: "Drawing a hidden problem" },
  { at: 9, text: "Handing it all to the model" },
  { at: 14, text: "The model is small. It is thinking hard." },
  { at: 20, text: "No server is being contacted. This is all happening here." },
  { at: 28, text: "That is the trade: free and private, or fast." },
  { at: 37, text: "Still working. Nothing has crashed." },
  { at: 48, text: "Your laptop is writing fiction. Be patient with it." },
  { at: 62, text: "This is taking longer than it should.", tone: "hot" },
  { at: 78, text: "Consider the wait part of the atmosphere.", tone: "hot" },
  { at: 95, text: "Genuinely still going." },
  { at: 115, text: "If this never finishes, reload and it will try again.", tone: "hot" },
  { at: 140, text: "..." },
  { at: 170, text: "......" },
];

interface Props {
  ready: number;
  wanted: number;
  titles: string[];
  onResume?: () => void;
}

export default function Dreaming({ ready, wanted, titles, onResume }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const flavour = SCHEDULE.filter((line) => elapsed >= line.at);

  // Real progress is interleaved with the flavour, so the screen always shows
  // the most recent true thing that happened.
  const resolved = titles.map((title, index) => ({
    text: `World ${index + 1} of ${wanted} resolved — ${title}`,
    tone: "ok" as const,
  }));

  const seconds = Math.floor(elapsed);

  return (
    <div className="boot">
      <p className="boot-line" style={{ marginBottom: "1.25rem" }}>
        <Wordmark cursor={false} />
      </p>

      {flavour.map((line, index) => (
        <p key={`f-${index}`} className={`boot-line ${line.tone ?? ""}`}>
          {line.text}
        </p>
      ))}

      {resolved.map((line, index) => (
        <p key={`r-${index}`} className={`boot-line ${line.tone}`}>
          {line.text}
        </p>
      ))}

      <p className="boot-line cursor" style={{ marginTop: "1.25rem" }}>
        {ready}/{wanted} ready · {seconds}s
      </p>

      {onResume && elapsed > 6 ? (
        <p className="boot-line" style={{ marginTop: "1.5rem" }}>
          <button type="button" className="key-button" onClick={onResume}>
            [SKIP — RESUME SAVED SESSION]
          </button>
        </p>
      ) : null}
    </div>
  );
}
