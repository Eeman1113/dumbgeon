import {
  advance,
  clockPhrase,
  directive,
  newDirector,
  outcomeLine,
  resolveAction,
  type Director,
  type Outcome,
  type Resolution,
  type Threat,
} from "./director";
import type { Scenario } from "./scenarios";

export const MAX_HEALTH = 20;

export interface WorldState {
  location: string;
  inventory: string[];
  health: number;
}

/**
 * What the story knows about itself. Built entirely from data we already have
 * — the delta reply and the director's own transitions — so it costs no model
 * call, stays bounded, and carries twenty turns of continuity in the space two
 * turns of verbatim prose used to occupy.
 */
export interface Memory {
  /** Newest last. Rendered as the FACTS block. */
  entries: string[];
  /** Folded summary of everything older than `entries`. */
  earlier: string | null;
  /** Proper nouns seen, newest first. Stops the model renaming characters. */
  names: string[];
}

export interface Turn {
  id: string;
  /** Null for the scenario's opening narration. */
  action: string | null;
  narration: string;
  /** Snapshots taken before this turn, so undo and retry are exact. */
  stateBefore: WorldState;
  directorBefore: Director;
  memoryBefore: Memory;
}

export interface Game {
  scenarioId: string;
  name: string;
  premise: string;
  turns: Turn[];
  state: WorldState;
  director: Director;
  memory: Memory;
}

export function newGame(scenario: Scenario, threat: Threat, clock: string): Game {
  const state: WorldState = {
    location: scenario.location,
    inventory: [...scenario.inventory],
    health: MAX_HEALTH,
  };
  const director = newDirector(threat, clock, scenario.secret);
  const memory: Memory = { entries: [], earlier: null, names: [] };

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    premise: scenario.premise,
    state,
    director,
    memory,
    turns: [
      {
        id: "opening",
        action: null,
        narration: scenario.opening,
        stateBefore: state,
        directorBefore: director,
        memoryBefore: memory,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The narrator
// ---------------------------------------------------------------------------

/**
 * Two buckets, flat bullets, every line imperative.
 *
 * The old prompt was all restraint — seven prohibitions and nothing that
 * caused an event — so the model did the only thing left to it and described
 * the room. These rules make something happen, and the banned list is limited
 * to exact phrases the model can match against its own output rather than
 * stylistic judgements it cannot make.
 */
export const NARRATOR_SYSTEM = `You narrate a second-person adventure. You write 2 to 4 sentences per turn. Never more.

EVERY REPLY MUST:
- Change one of these, and name the change: where the player is, what they hold, what they know, or what is about to hurt them.
- Contain one action by someone or something that is not the player. The world moves on its own.
- Obey the OUTCOME line. If it says the action fails or costs something, it fails and it costs.
- Obey the MUST line. That is the event this turn exists to deliver.
- End on a fact: an object, a position, a spoken line, a sound with a source. End with a period.

NEVER WRITE THESE WORDS:
- "you feel", "you sense", "a sense of", "unease", "a chill", "shiver", "the air grows", "something is wrong", "deafening silence".
- "seems", "appears to", "somehow", "almost", "as if". State what is true.
- Never speak as the player, offer choices, or mention rules.`;

/** One worked example teaches more than any rule. Prefilled once per session. */
export const NARRATOR_EXAMPLES = [
  {
    role: "user" as const,
    content: `A tram depot. Tone: cold industrial.

Where: inspection pit
Carrying: a torch, a punch-card
Condition: unhurt

Recently:
The pit smells of grease and cold iron. Above you the eighth tram idles on its rails, doors open, nobody aboard.

PLAYER ACTION: climb up and look in the driver's cab

OUTCOME: The action half-works. Show what the player got and exactly what they did not get.
MUST: Something the player relied on stops working or is taken away. Name exactly what, and make it final.

Write 2 to 4 sentences. Obey OUTCOME and MUST.`,
  },
  {
    role: "assistant" as const,
    content: `The rungs are slick and the handrail drops half an inch under your weight before it holds. You get your head into the cab: the controller notch is set to third and strapped there, and the dead-man's handle is weighted down with a canvas bag of ballast. Then the torch goes out in your hand, filament gone, and the compressor under the floor cycles once and settles.`,
  },
];

function condition(health: number): string {
  const fraction = health / MAX_HEALTH;
  if (fraction >= 1) return "unhurt";
  if (fraction > 0.6) return "scraped and winded";
  if (fraction > 0.3) return "bleeding and slow";
  return "barely standing";
}

/** Render the chronicle. Facts, not prose — a bullet list cannot be pastiched. */
function factLines(memory: Memory): string {
  const lines: string[] = [];
  if (memory.earlier) lines.push(`Earlier: ${memory.earlier}`);
  for (const entry of memory.entries) lines.push(`- ${entry}`);
  return lines.length ? lines.join("\n") : "- nothing yet";
}

/**
 * Verbatim prose is the least information-dense thing in the prompt, and it
 * teaches the model to pastiche whatever the last turns looked like. Two turns
 * for voice; the chronicle carries continuity.
 */
const HISTORY_TURNS = 2;

export function buildNarrationPrompt(game: Game, action: string, roll: Resolution): string {
  const director = game.director;
  const recent = game.turns
    .slice(-HISTORY_TURNS)
    .map((turn) => (turn.action ? `> ${turn.action}\n${turn.narration}` : turn.narration))
    .join("\n\n");

  // OUTCOME and MUST go last, immediately before the write instruction:
  // recency dominates instruction-following on a small model.
  return `${game.premise}

FACTS (never contradict these):
${factLines(game.memory)}
${game.memory.names.length ? `\nNAMES in play: ${game.memory.names.join(", ")}` : ""}

Where: ${game.state.location}
Carrying: ${game.state.inventory.join(", ") || "nothing"}
Condition: ${condition(game.state.health)}
Pressure: ${director.threat.name} wants ${director.threat.wants}. ${clockPhrase(director.clock)}

Recently:
${recent}

PLAYER ACTION: ${action}

OUTCOME: ${outcomeLine(roll.outcome)}${roll.costLine}
MUST: ${directive(director)}

Write 2 to 4 sentences. Obey OUTCOME and MUST.`;
}

export { resolveAction, advance };

// ---------------------------------------------------------------------------
// The bookkeeper
//
// Runs in its OWN session. It used to share the narrator's, under a system
// prompt forbidding inventory lists — which is exactly what it is asked to
// produce. It also inherited the narrator's sampling; an extraction task wants
// greedy decoding, not temperature 0.9.
//
// Harm and open questions are no longer asked for: the director decides both,
// deterministically. This form only reports what physically moved.
// ---------------------------------------------------------------------------

export const BOOKKEEPER_SYSTEM = `You fill in a four-line form about one beat of a story. You are not a narrator and you write no prose.

The four keys, always in this order: MOVED, GAINED, LOST, WHO.

A dash (-) means "this line does not apply". Most beats are four dashes, because most beats are a person looking, listening, talking or trying something. Only words that appear in "What happened" can fill a line. If the words are not there, the line is a dash.

Each line starts at the first character of the line: the key in capitals, a colon, the value. Four lines, then stop. Plain text only: no asterisks, no bullets, no numbering, no sentences before or after the four lines.`;

/**
 * Three examples, two of them entirely null. A small model's instinct is to
 * seem useful by inventing changes; the only thing that reliably installs the
 * null prior is demonstrating it.
 */
export const BOOKKEEPER_EXAMPLES = [
  {
    role: "user" as const,
    content: `Where: pump room
Carrying: a brass key, a wet rag

Player action: look at the gauges
What happened: The needles sit at zero, all four of them, though the pipes are warm under your palm. Somewhere below, water moves.

Form:`,
  },
  {
    role: "assistant" as const,
    content: `MOVED: -
GAINED: -
LOST: -
WHO: -`,
  },
  {
    role: "user" as const,
    content: `Where: pump room
Carrying: a brass key, a wet rag

Player action: ask the keeper about the noise
What happened: Halloran wipes his hands and does not look up. "Pipes settle," he says, and the word sits a moment too long before he turns back to the valve.

Form:`,
  },
  {
    role: "assistant" as const,
    content: `MOVED: -
GAINED: -
LOST: -
WHO: Halloran`,
  },
  {
    role: "user" as const,
    content: `Where: pump room
Carrying: a brass key, a wet rag

Player action: force the hatch with the key
What happened: The key snaps in the lock and the shard opens your thumb. The hatch gives anyway, onto a stair going down into standing water, and you take the first three steps.

Form:`,
  },
  {
    role: "assistant" as const,
    content: `MOVED: flooded stair
GAINED: -
LOST: a brass key
WHO: -`,
  },
];

export function buildDeltaPrompt(state: WorldState, action: string, narration: string): string {
  return `Where: ${state.location}
Carrying: ${state.inventory.join(", ") || "nothing"}

Player action: ${action}
What happened: ${narration}

Fill in the form. The dash is the usual answer.

MOVED: a dash, unless What happened names a place the player has ended up in.
GAINED: a dash, unless What happened says the player took, lifted, pocketed or was handed a thing.
LOST: a dash, unless What happened says a thing left the player's hands or broke.
WHO: a dash, unless What happened names a person or creature present.

Form:`;
}

export interface Delta {
  moved_to: string | null;
  gained: string[];
  lost: string[];
  who: string | null;
}

/**
 * Normalise the envelope before matching: bold, fences, bullets, unicode
 * dashes, CRLF. Without this a reply of "**MOVED:** the stair" fails to match
 * and silently reads as "nothing changed".
 */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*```[a-z]*\s*$/gim, "")
    .replace(/[*_`#]+/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/^\s*(?:[-•·>]|\(?\d+[.)])\s+(?=[A-Za-z][A-Za-z ]{1,16}\s*:)/gm, "");
}

const NULLISH =
  /^(?:-+|n\/?a|none|nothing|no|nil|null|undefined|unchanged|same|same as before|no changes?|nothing (?:new|gained|lost|changed|yet)|not applicable|empty)$/i;

const SYNONYMS: Record<string, string[]> = {
  MOVED: ["MOVED", "MOVED TO", "LOCATION", "NEW LOCATION", "PLACE", "WHERE"],
  GAINED: ["GAINED", "GAIN", "ACQUIRED", "GOT", "PICKED UP", "ITEMS GAINED"],
  LOST: ["LOST", "LOSE", "DROPPED", "REMOVED", "ITEMS LOST"],
  WHO: ["WHO", "PERSON", "PRESENT", "CHARACTER", "NAME"],
};

function deltaField(raw: string, key: string): string | null {
  const text = normalise(raw);
  const alternatives = (SYNONYMS[key] ?? [key]).map((k) => k.replace(/ /g, "\\s+")).join("|");
  const match = text.match(new RegExp(`^[ \\t]*(?:${alternatives})[ \\t]*:?[ \\t]*(.*)$`, "im"));
  if (!match) return null;

  const value = match[1]
    .trim()
    .replace(/^[<"'(\[]+|[>"')\]]+$/g, "")
    .replace(/[.;,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // The model echoed the spec text back instead of answering.
  if (/^(?:a dash|unless|new place|items?|short noun phrase|a person)\b/i.test(value)) return null;
  if (!value || NULLISH.test(value)) return null;
  return value;
}

function deltaList(raw: string, key: string): string[] {
  const value = deltaField(raw, key);
  if (!value) return [];
  return value
    .split(/,| and /)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseDelta(raw: string | null): Delta | null {
  if (!raw) return null;
  return {
    moved_to: deltaField(raw, "MOVED"),
    gained: deltaList(raw, "GAINED"),
    lost: deltaList(raw, "LOST"),
    who: deltaField(raw, "WHO"),
  };
}

// ---------------------------------------------------------------------------
// Applying changes
// ---------------------------------------------------------------------------

const MAX_INVENTORY = 10;

/** A direction is not a place; accepting one poisons every later prompt. */
const DIRECTION =
  /^(?:up|down|north|south|east|west|left|right|back|forward|inside|outside|onward|ahead|away|deeper|further|in|out)\b/i;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");
  if (trimmed.length < 3 || trimmed.length > 60) return null;
  // An object has a name. Bare numbers and punctuation are transcription
  // noise — the model reporting a gauge reading as a thing you now carry.
  if (!/[a-z]{3}/i.test(trimmed)) return null;
  return trimmed;
}

/** An item only enters the inventory if the narration actually mentions it. */
function groundedIn(item: string, narration: string): boolean {
  const text = narration.toLowerCase();
  const lower = item.toLowerCase();
  const heads = lower.split(/\s+/).filter((word) => word.length > 3);
  // With no distinctive word to match on, demand the whole phrase — never
  // wave the item through, which is how "34" became an inventory item.
  if (!heads.length) return text.includes(lower);
  return heads.some((word) => text.includes(word.replace(/s$/, "")));
}

/**
 * Apply the report defensively. Harm and the costed item come from the
 * director's resolution, not the model — so the health bar only ever moves for
 * a reason the game can account for.
 */
export function applyDelta(
  state: WorldState,
  delta: Delta | null,
  roll: Resolution,
  narration: string,
): WorldState {
  const lost = new Set(
    (delta?.lost ?? [])
      .map(clean)
      .filter((item): item is string => item !== null)
      .map((item) => item.toLowerCase()),
  );
  if (roll.itemLost) lost.add(roll.itemLost.toLowerCase());

  const inventory = state.inventory.filter((item) => !lost.has(item.toLowerCase()));

  for (const raw of delta?.gained ?? []) {
    const item = clean(raw);
    if (!item) continue;
    if (!groundedIn(item, narration)) continue;
    if (inventory.some((held) => held.toLowerCase() === item.toLowerCase())) continue;
    if (inventory.length >= MAX_INVENTORY) break;
    inventory.push(item);
  }

  const moved = clean(delta?.moved_to);
  const location = moved && !DIRECTION.test(moved) ? moved : state.location;

  return {
    location,
    inventory,
    health: Math.max(0, Math.min(MAX_HEALTH, state.health - roll.harm)),
  };
}

// ---------------------------------------------------------------------------
// The chronicle
// ---------------------------------------------------------------------------

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

const MAX_ENTRIES = 8;

/** Fold rather than truncate, so the first act stays alive at a fixed cost. */
export function remember(
  memory: Memory,
  director: Director,
  delta: Delta | null,
  roll: Resolution,
  previousLocation: string,
): Memory {
  const added: string[] = [];

  if (delta?.moved_to && delta.moved_to !== previousLocation) {
    added.push(`went to ${delta.moved_to}`);
  }
  for (const item of delta?.gained ?? []) added.push(`took the ${item}`);
  for (const item of delta?.lost ?? []) added.push(`lost the ${item}`);
  if (roll.itemLost) added.push(`lost the ${roll.itemLost}`);
  if (director.beat === "BITE") added.push(`${director.threat.name} found you once already`);
  if (director.beat === "REVERSE") added.push(`learned: ${director.secret}`);
  if (director.beat === "SQUEEZE") added.push(`${director.threat.name} got closer`);
  if (director.beat === "PAYOFF" && director.promises[0]) {
    added.push(`settled: ${director.promises[0].text}`);
  }
  if (roll.harm >= 3) added.push("were badly hurt");

  let entries = dedupe([...memory.entries, ...added]);
  let earlier = memory.earlier;

  if (entries.length > MAX_ENTRIES) {
    const old = entries.slice(0, 4);
    entries = entries.slice(4);
    earlier = [earlier, old.join("; ")].filter(Boolean).join("; ").slice(0, 200);
  }

  const names = dedupe([...(delta?.who ? [delta.who] : []), ...memory.names]).slice(0, 5);
  return { entries, earlier, names };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const SAVE_KEY = "dumbgeon.save.v2";

export function saveGame(game: Game | null): void {
  try {
    if (!game) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    // Private browsing or a full quota. Playing without a save is fine.
  }
}

export function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Game;
    if (!parsed?.turns?.length || !parsed.state || !parsed.director) return null;
    return parsed;
  } catch {
    return null;
  }
}
