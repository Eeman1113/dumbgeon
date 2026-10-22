"use client";

import { useEffect, useRef, useState } from "react";

interface Line {
  text: string;
  tone?: "ok" | "hot";
  pause?: number;
}

const LINES: Line[] = [
  { text: "DUMBGEON BIOS v1.0 — 128K PHOSPHOR TERMINAL", pause: 320 },
  { text: "", pause: 60 },
  { text: "Memory test ................ 128K OK", tone: "ok", pause: 140 },
  { text: "Narrative coprocessor ...... PRESENT", tone: "ok", pause: 140 },
  { text: "Locating language model ....", pause: 260 },
  { text: "  gemini-nano @ local ...... ONLINE", tone: "ok", pause: 180 },
  { text: "  remote endpoints ......... NONE (good)", tone: "ok", pause: 180 },
  { text: "", pause: 60 },
  { text: "WARNING: model is small. It will forget things.", tone: "hot", pause: 420 },
  { text: "This is considered a feature.", tone: "hot", pause: 460 },
  { text: "", pause: 80 },
  { text: "Ready.", pause: 300 },
];

/**
 * Cold-start boot text. Runs once per tab — a reload inside the same session
 * skips it, because watching the same BIOS twice stops being charming fast.
 */
export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function step(index: number) {
      if (cancelled) return;
      if (index >= LINES.length) {
        timer = setTimeout(() => !cancelled && doneRef.current(), 450);
        return;
      }
      setShown(index + 1);
      timer = setTimeout(() => step(index + 1), LINES[index].pause ?? 120);
    }

    step(0);

    // Any key or click skips the rest.
    function skip() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timer);
      doneRef.current();
    }

    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div className="boot">
      {LINES.slice(0, shown).map((line, index) => (
        <p
          key={index}
          className={`boot-line ${line.tone ?? ""} ${
            index === shown - 1 ? "cursor" : ""
          }`}
        >
          {line.text || " "}
        </p>
      ))}
      <p className="boot-skip">PRESS ANY KEY TO SKIP</p>
    </div>
  );
}
