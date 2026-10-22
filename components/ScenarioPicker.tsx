"use client";

import { useEffect } from "react";
import { Play, Sparkles } from "lucide-react";
import Wordmark from "./Wordmark";
import type { Scenario } from "@/lib/scenarios";

interface Props {
  scenarios: Scenario[];
  failed: boolean;
  onChoose: (scenario: Scenario) => void;
  onRegenerate: () => void;
  onResume?: () => void;
}

/** Only ever rendered with a finished set of worlds — the wait lives in Dreaming. */
export default function ScenarioPicker({
  scenarios,
  failed,
  onChoose,
  onRegenerate,
  onResume,
}: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < scenarios.length) {
        // Without this the same keystroke lands in the action field that
        // autofocuses a moment later, so the game opens with "1" typed in.
        event.preventDefault();
        onChoose(scenarios[index]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenarios, onChoose]);

  return (
    <div className="centered">
      <div className="panel">
        <h1 className="panel-title">
          <Wordmark />
        </h1>
        <p className="panel-body">
          A text adventure improvised by a model running <b>inside your browser</b>.
          Nothing leaves this machine. Nothing costs anything.
        </p>

        {failed ? (
          <p className="notice">
            The model did not return anything usable. Try dreaming again.
          </p>
        ) : (
          <p className="panel-body">
            Four worlds, invented just now and never before. Select one, or press its
            number.
          </p>
        )}

        <div className="panel-actions">
          {onResume ? (
            <button type="button" className="block-button" onClick={onResume}>
              <Play className="icon" aria-hidden="true" />
              RESUME SESSION
            </button>
          ) : null}
          <button type="button" className="key-button" onClick={onRegenerate}>
            <Sparkles className="icon" aria-hidden="true" />
            DREAM NEW WORLDS
          </button>
        </div>

        <ul className="menu">
          {scenarios.map((scenario, index) => (
            <li key={scenario.id} className="menu-item">
              <button
                type="button"
                className="menu-button"
                onClick={() => onChoose(scenario)}
              >
                <span className="menu-key">[{index + 1}]</span>
                <span className="menu-name">{scenario.name}</span>
                <span className="menu-opening">{scenario.opening}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
