import { MAX_HEALTH, type WorldState } from "@/lib/game";
import type { Director } from "@/lib/director";

const CONDITION = [
  { min: 1.0, text: "NOMINAL" },
  { min: 0.6, text: "SCRAPED" },
  { min: 0.3, text: "BLEEDING" },
  { min: 0.01, text: "CRITICAL" },
  { min: 0, text: "FLATLINE" },
];

interface Props {
  state: WorldState;
  director: Director;
}

export default function WorldPanel({ state, director }: Props) {
  const fraction = state.health / MAX_HEALTH;
  const condition = CONDITION.find((entry) => fraction >= entry.min) ?? CONDITION.at(-1)!;
  const hurt = fraction <= 0.3;

  // ASCII bar rather than a styled div — it belongs to the typeface.
  const bar = `[${"#".repeat(state.health)}${".".repeat(MAX_HEALTH - state.health)}]`;

  const clock = director.clock;
  const clockLow = clock.remaining / clock.total <= 0.33;
  const clockBar = `[${"#".repeat(clock.remaining)}${".".repeat(Math.max(0, clock.total - clock.remaining))}]`;

  return (
    <aside className="world" aria-label="Status">
      <section className="box">
        <h2 className="box-title">POSITION</h2>
        <p className="box-value">{state.location}</p>
      </section>

      <section className="box">
        <h2 className="box-title">INVENTORY</h2>
        {state.inventory.length ? (
          <ul className="carry-list">
            {state.inventory.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="carry-empty">-- empty --</p>
        )}
      </section>

      <section className="box">
        <h2 className="box-title">INTEGRITY</h2>
        <p
          className={`meter ${hurt ? "hurt" : ""}`}
          role="meter"
          aria-valuenow={state.health}
          aria-valuemin={0}
          aria-valuemax={MAX_HEALTH}
          aria-label="Integrity"
        >
          {bar}
        </p>
        <p className="meter-note">
          {state.health}/{MAX_HEALTH} {condition.text}
        </p>
      </section>

      <section className="box">
        <h2 className="box-title">DEADLINE</h2>
        <p className="box-value">{director.clock.label}</p>
        <p className={`meter ${clockLow ? "hurt" : ""}`} aria-label="Time remaining">
          {clockBar}
        </p>
        <p className="meter-note">
          {director.clock.remaining}/{director.clock.total}
        </p>
      </section>

      {director.promises[0] ? (
        <section className="box">
          <h2 className="box-title">UNRESOLVED</h2>
          <p className="box-value">{director.promises[0].text}</p>
        </section>
      ) : null}
    </aside>
  );
}
