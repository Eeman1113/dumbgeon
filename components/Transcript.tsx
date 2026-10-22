"use client";

import { useEffect, useRef } from "react";
import type { Turn } from "@/lib/game";

interface Props {
  turns: Turn[];
  pendingAction: string | null;
  streaming: string;
  dead: boolean;
}

export default function Transcript({ turns, pendingAction, streaming, dead }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, streaming, pendingAction]);

  return (
    <div className="column">
      {turns.map((turn) => (
        <div key={turn.id}>
          {turn.action ? <p className="utterance">{turn.action}</p> : null}
          <p className="narration">{turn.narration}</p>
        </div>
      ))}

      {pendingAction ? (
        <div>
          <p className="utterance">{pendingAction}</p>
          {streaming ? (
            <p className="narration cursor">{streaming}</p>
          ) : (
            <p className="waiting cursor">thinking</p>
          )}
        </div>
      ) : null}

      {dead ? (
        <p className="epitaph">
          *** PROCESS TERMINATED ***
          <br />
          The world keeps running without you. That is the unkind part.
        </p>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
