/**
 * The director.
 *
 * The narrator model is tiny. Asked for judgement — "is this impossible?",
 * "what is unresolved?", "how much damage?" — it guesses, inconsistently.
 * Asked to dramatise a verdict it has been handed, it does well.
 *
 * So every judgement lives here, in deterministic TypeScript: what beat the
 * story is on, whether an action succeeds, what it costs, when a threat acts,
 * what gets remembered. The model only writes the sentences. None of this
 * costs a model call.
 */

export type Beat =
  | "SETUP"      // orient; show a trace of the threat, not the threat
  | "BITE"       // the threat touches the player directly, first time
  | "COMPLICATE" // a cost, an obstacle, a price
  | "REVERSE"    // something the player believed turns out to be wrong
  | "SQUEEZE"    // the threat acts hard and the clock jumps
  | "CONFRONT"   // the threat is here, now
  | "PAYOFF"     // settle the oldest open question
  | "BREATH";    // give a win, drop tension, plant the next hook

export type Outcome = "SUCCESS" | "PARTIAL" | "COST" | "FAIL";

export type RiskClass = "observe" | "talk" | "act" | "risk";

export interface Threat {
  /** A definite name, reused verbatim every turn so it stays one character. */
  name: string;
  /** What it wants, as one clause. */
  wants: string;
  /** Three escalating physical actions, indexed by arc. */
  moves: [string, string, string];
}

export interface Clock {
  label: string;
  remaining: number;
  total: number;
}

export interface Promise_ {
  id: string;
  text: string;
  openedOn: number;
}

export interface Director {
  beat: Beat;
  beatTurns: number;
  /** 0-10. Drives failure odds and beat jumps. */
  tension: number;
  /** 0-2. Each loop raises the tension floor and picks a harder threat move. */
  arc: number;
  threat: Threat;
  clock: Clock;
  /** The scenario's hidden truth. Released once, by REVERSE. */
  secret: string;
  promises: Promise_[];
  lastBreath: number;
  /** Bumped on retry so a re-roll genuinely re-rolls. */
  nonce: number;
  ended: null | "won" | "lost";
}

export interface Resolution {
  cls: RiskClass;
  outcome: Outcome;
  harm: number;
  itemLost: string | null;
  costLine: string;
}

// ---------------------------------------------------------------------------
// Drawn content
//
// Composed, never generated. A drawn threat is always coherent, always
// specific, and costs no model time.
// ---------------------------------------------------------------------------

export const THREATS: Threat[] = [
  {
    name: "the Inspector",
    wants: "to finish the count",
    moves: [
      "is heard in the next room, counting aloud",
      "seals a door you came through",
      "takes hold of your wrist and begins counting your fingers",
    ],
  },
  {
    name: "the tide",
    wants: "the lower floor",
    moves: [
      "has reached the bottom step",
      "is at your ankles and rising faster than it should",
      "closes over the only stairwell",
    ],
  },
  {
    name: "Halloran",
    wants: "the thing you are carrying",
    moves: [
      "has been in this room since you left it",
      "blocks the corridor and asks you for it by name",
      "takes it from you, or takes your hand with it",
    ],
  },
  {
    name: "the substitute",
    wants: "your name",
    moves: [
      "is wearing your coat, two rooms away",
      "answers when someone calls for you",
      "tells you your own history, correctly, in your voice",
    ],
  },
  {
    name: "the machinery",
    wants: "to finish its cycle",
    moves: [
      "changes pitch and will not change back",
      "locks the valves and begins to vent",
      "starts the press with you inside the gate",
    ],
  },
  {
    name: "the debt",
    wants: "to be collected in person",
    moves: [
      "arrives as a notice pinned where you slept",
      "names a figure and a time, both impossible",
      "sends the collector, who is already inside",
    ],
  },
  {
    name: "the cold",
    wants: "the building",
    moves: [
      "has frosted the inside of the glass",
      "has taken your fingers past feeling",
      "has stopped the clock, the pipes, and your breath in the air",
    ],
  },
  {
    name: "the Keeper",
    wants: "you to stay and take over",
    moves: [
      "has laid a second place at the table",
      "has written your name in the duty log, in your handwriting",
      "offers you the keys and will not take no",
    ],
  },
];

export const CLOCKS = [
  "the tide turns",
  "the shift changes",
  "the last train goes",
  "the count reaches your name",
  "the lights go out for good",
  "the ice gives",
  "the inspection begins",
  "the water reaches the panel",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function drawThreat(): Threat {
  return pick(THREATS);
}

export function drawClock(): string {
  return pick(CLOCKS);
}

const CLOCK_TOTAL = 12;

export function newDirector(threat: Threat, clock: string, secret: string): Director {
  return {
    beat: "SETUP",
    beatTurns: 0,
    tension: 1,
    arc: 0,
    threat,
    clock: { label: clock, remaining: CLOCK_TOTAL, total: CLOCK_TOTAL },
    secret,
    promises: [],
    lastBreath: -99,
    nonce: 0,
    ended: null,
  };
}

// ---------------------------------------------------------------------------
// Beat transitions
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** BITE, REVERSE, PAYOFF and BREATH are single punches — held longer they repeat. */
const MAX_TURNS: Record<Beat, number> = {
  SETUP: 2,
  BITE: 1,
  COMPLICATE: 2,
  REVERSE: 1,
  SQUEEZE: 2,
  CONFRONT: 2,
  PAYOFF: 1,
  BREATH: 1,
};

const CHAIN: Record<Beat, Beat> = {
  SETUP: "BITE",
  BITE: "COMPLICATE",
  COMPLICATE: "REVERSE",
  REVERSE: "SQUEEZE",
  SQUEEZE: "CONFRONT",
  CONFRONT: "BREATH",   // relief is earned by surviving the confrontation
  PAYOFF: "COMPLICATE", // an answer immediately creates the next problem
  BREATH: "COMPLICATE", // loop, with arc++ on this edge
};

const TENSION_BY_BEAT: Record<Beat, number> = {
  SETUP: 0,
  BITE: 2,
  COMPLICATE: 1,
  REVERSE: 1,
  SQUEEZE: 2,
  CONFRONT: 1,
  PAYOFF: -2,
  BREATH: -3,
};

const TENSION_BY_OUTCOME: Record<Outcome, number> = {
  SUCCESS: -1,
  PARTIAL: 1,
  COST: 1,
  FAIL: 2,
};

const PROMISE_TEXT: Partial<Record<Beat, (d: Director) => string>> = {
  BITE: (d) => `what ${d.threat.name} wants with you`,
  COMPLICATE: () => "the way past what just blocked you",
  REVERSE: () => "what you were wrong about",
  SQUEEZE: (d) => `whether you get out before ${d.clock.label}`,
};

const MAX_PROMISES = 3;

/**
 * Advance the story one beat. Guard order is the design: mercy and payoff
 * outrank the normal chain, so no player is ground down and nothing the
 * director raises is ever forgotten.
 */
export function advance(
  d: Director,
  turnIndex: number,
  outcome: Outcome,
  healthFraction: number,
): Director {
  const next: Director = { ...d, promises: [...d.promises] };

  next.tension = clamp(
    d.tension + TENSION_BY_BEAT[d.beat] + TENSION_BY_OUTCOME[outcome],
    d.arc * 2, // the floor rises each arc: no returning to calm
    10,
  );

  const tick =
    (d.beat === "SQUEEZE" || d.beat === "CONFRONT" ? 1 : 0) +
    (outcome === "FAIL" ? 1 : 0) -
    (d.beat === "BREATH" ? 1 : 0); // a win buys back a little time

  next.clock = {
    ...d.clock,
    remaining: clamp(d.clock.remaining - tick, 0, d.clock.total),
  };

  next.beatTurns = d.beatTurns + 1;

  // Resolve the promise belonging to the beat just PLAYED. Doing this on the
  // beat being entered left PAYOFF unable to clear the promise that summoned
  // it, so the guard below re-fired forever and the story froze.
  if (d.beat === "PAYOFF" || d.beat === "CONFRONT") {
    next.promises.shift();
  }

  const oldest = next.promises[0];
  const promiseAge = oldest ? turnIndex - oldest.openedOn : 0;

  let beat: Beat;
  if (next.clock.remaining <= 0 && d.arc >= 2) {
    beat = "CONFRONT"; // endgame
  } else if (healthFraction <= 0.35 && turnIndex - d.lastBreath >= 3) {
    beat = "BREATH"; // mercy: a death spiral loses players faster than anything
  } else if (next.clock.remaining <= 0 && d.beat !== "CONFRONT") {
    beat = "CONFRONT";
  } else if (next.tension >= 8 && (d.beat === "COMPLICATE" || d.beat === "REVERSE")) {
    beat = "SQUEEZE";
  } else if (next.beatTurns >= MAX_TURNS[d.beat]) {
    beat = CHAIN[d.beat];
  } else if (promiseAge >= 6 && d.beat !== "PAYOFF") {
    // Safety net only: it fires when a beat would otherwise idle, so it can
    // never outrank the escalating chain and starve the climax.
    beat = "PAYOFF";
  } else {
    beat = d.beat;
  }

  if (beat !== d.beat) {
    next.beatTurns = 0;
    if (d.beat === "BREATH") next.arc = Math.min(2, d.arc + 1);
    if (beat === "BREATH") next.lastBreath = turnIndex;

    // Surviving a confrontation before the endgame buys a new deadline, so a
    // spent clock cannot pin the story on CONFRONT for the rest of the game.
    if (d.beat === "CONFRONT" && next.clock.remaining <= 0 && next.arc < 2) {
      next.clock = { ...next.clock, remaining: Math.ceil(next.clock.total / 2) };
    }

    // Promises are opened by the director, because it knows when it caused one.
    const makePromise = PROMISE_TEXT[beat];
    if (makePromise && next.promises.length < MAX_PROMISES) {
      const text = makePromise(next);
      if (!next.promises.some((p) => p.text === text)) {
        next.promises.push({ id: `${turnIndex}-${beat}`, text, openedOn: turnIndex });
      }
    }
  }

  next.beat = beat;

  // The story ends when the final confrontation has played out.
  if (next.beat === "CONFRONT" && next.arc >= 2 && next.beatTurns >= 1) {
    next.ended = healthFraction <= 0 ? "lost" : "won";
  }

  return next;
}

// ---------------------------------------------------------------------------
// Directives
//
// One imperative line naming a concrete required event. Never a mood. "Name
// it" appears repeatedly on purpose: abstraction is a small model's escape
// hatch from any instruction, and demanding a named noun closes it.
// ---------------------------------------------------------------------------

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function directive(d: Director): string {
  const threat = d.threat;
  const move = threat.moves[clamp(d.arc, 0, 2)];
  const oldest = d.promises[0]?.text ?? "the thing you came here for";

  switch (d.beat) {
    case "SETUP":
      return "Show one physical detail here that someone left in a hurry. Name it. Do not explain it.";

    case "BITE":
      return `${cap(threat.name)} ${move}. Put it in this room, in reach, in this reply. The player learns it knows they are here.`;

    case "COMPLICATE":
      return "Something the player relied on stops working or is taken away. Name exactly what, and make it final.";

    case "REVERSE":
      // Given a secret and permission to be subtle, a small model is subtle to
      // the point of invisibility. Blunt, once, on schedule, reads as a twist.
      return `Reveal this plainly, as something the player now sees: ${d.secret}. Do not hint. State it.`;

    case "SQUEEZE":
      return `${cap(threat.name)} acts without warning and gets closer to ${threat.wants}. End on the new distance between it and the player.`;

    case "CONFRONT":
      return d.arc >= 2
        ? `${cap(threat.name)} is here and this ends now. One of you gets ${threat.wants}. Decide it in this reply.`
        : `${cap(threat.name)} is in the room with the player and blocks the only way out. Nobody escapes in this reply.`;

    case "PAYOFF":
      return `Answer this concretely and for good: ${oldest}. Give the player the fact, then one new problem it creates.`;

    case "BREATH":
      return `The player gets what they were reaching for. Let it work. Then show one sign ${threat.name} has moved.`;
  }
}

/** Nano cannot count, so the deadline is always described, never numbered. */
export function clockPhrase(clock: Clock): string {
  const fraction = clock.remaining / clock.total;
  if (fraction > 0.66) return `Soon, ${clock.label}.`;
  if (fraction > 0.33) return `${cap(clock.label)} — not long now.`;
  if (fraction > 0) return `${cap(clock.label)} within minutes.`;
  return `${cap(clock.label)} is happening now.`;
}

// ---------------------------------------------------------------------------
// Action resolution
//
// The model never decides whether something works. This does, then hands the
// narrator a verdict to dramatise. Seeded from the turn and the action text so
// a given turn always resolves the same way — undo and replay stay honest,
// while retry bumps the nonce and genuinely re-rolls.
// ---------------------------------------------------------------------------

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Risk is tested first: players bury the dangerous verb in a compound sentence
// constantly ("break the door open and look inside" is not observation).
const PATTERNS: [RiskClass, RegExp][] = [
  [
    "risk",
    /\b(attack|hit|kill|smash|break|force|charge|jump|leap|climb|dive|swim|burn|stab|shoot|fight|pry|kick|punch|wrestle|cut|grab|throw|ram)\b/i,
  ],
  [
    "talk",
    /\b(ask|tell|say|talk|speak|answer|greet|shout|call|lie|promise|beg|threaten|bargain|plead|warn|apologi[sz]e)\b/i,
  ],
  [
    "observe",
    /\b(look|listen|examine|inspect|read|wait|watch|smell|check|study|peer|search|hide|sneak|creep|think|consider)\b/i,
  ],
];

export function classify(action: string): RiskClass {
  for (const [cls, pattern] of PATTERNS) {
    if (pattern.test(action)) return cls;
  }
  return "act";
}

/** Thresholds on a 0-99 roll; lower is better. [SUCCESS, PARTIAL, COST] */
const TABLE: Record<RiskClass, [number, number, number]> = {
  observe: [70, 95, 100], // observing never hard-fails
  talk: [45, 75, 90],
  act: [40, 70, 85],
  risk: [25, 50, 70],
};

/** Does the action name something the player is actually carrying? */
function namesHeldItem(action: string, inventory: string[]): boolean {
  const lower = action.toLowerCase();
  return inventory.some((item) =>
    item
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .some((word) => lower.includes(word)),
  );
}

const OUTCOME_LINE: Record<Outcome, string> = {
  SUCCESS: "The action works. Show it working, in one clean beat.",
  PARTIAL:
    "The action half-works. Show what the player got and exactly what they did not get.",
  COST: "The action works but takes something from the player.",
  FAIL:
    "The action fails. Show it failing physically, and show what that failure costs right now.",
};

export function outcomeLine(outcome: Outcome): string {
  return OUTCOME_LINE[outcome];
}

function costLine(itemLost: string | null, cls: RiskClass): string {
  if (itemLost) return ` The player loses the ${itemLost} doing it. Show how.`;
  if (cls === "talk") return " Whoever the player spoke to reacts worse than they hoped.";
  return "";
}

export function resolveAction(
  d: Director,
  inventory: string[],
  healthFraction: number,
  action: string,
  turnIndex: number,
): Resolution {
  const cls = classify(action);

  // Never punish before stakes exist, and never during relief.
  if (d.beat === "SETUP" || d.beat === "BREATH" || d.beat === "PAYOFF") {
    return { cls, outcome: "SUCCESS", harm: 0, itemLost: null, costLine: "" };
  }

  const rng = mulberry32(hash(`${turnIndex}:${action}:${d.nonce}`));
  let roll = Math.floor(rng() * 100);

  // Negative is favourable. The item bonus is the whole reward loop: it makes
  // inventory into leverage, so clever play visibly pays.
  if (namesHeldItem(action, inventory)) roll -= 20;
  if (d.beat === "SQUEEZE" || d.beat === "CONFRONT") roll += 8;
  roll += Math.max(0, d.tension - 5) * 2;
  // Deliberately no penalty for being hurt: it compounds into a death spiral,
  // and the mercy beat exists precisely to stop that.
  if (healthFraction < 0.4) roll += 4;
  roll = clamp(roll, 0, 99);

  const [success, partial, cost] = TABLE[cls];
  const outcome: Outcome =
    roll < success ? "SUCCESS" : roll < partial ? "PARTIAL" : roll < cost ? "COST" : "FAIL";

  let harm = 0;
  let itemLost: string | null = null;

  if (outcome === "FAIL") {
    harm = cls === "risk" ? 2 + Math.floor(rng() * 3) : cls === "act" ? 1 + Math.floor(rng() * 2) : 0;
  }
  if (outcome === "COST") {
    itemLost = inventory.length ? inventory[Math.floor(rng() * inventory.length)] : null;
    if (!itemLost) harm = 1; // nothing to lose, so it costs blood
  }

  return { cls, outcome, harm, itemLost, costLine: costLine(itemLost, cls) };
}
