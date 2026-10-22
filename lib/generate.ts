import type { Scenario } from "./scenarios";

/**
 * Scenario generation.
 *
 * Two decisions here are about speed, because Nano is slow and the player is
 * staring at a loading screen:
 *
 *  1. No JSON schema. Constrained decoding costs several times the wall-clock
 *     of plain generation on this model. A line-prefixed format parses just as
 *     reliably and arrives far sooner.
 *  2. The premise is composed locally from the constraints we drew, not
 *     generated. We already know the setting, the wrongness and the tone — so
 *     the model only writes the parts that need invention.
 *
 * Variety comes from the drawn constraints rather than sampling temperature:
 * a small model asked for "a scenario" returns the same dark forest every time.
 */

const PLACES = [
  "a drained reservoir", "a night ferry", "a radio observatory", "a seed vault",
  "a funicular railway", "a salt mine", "a lighthouse keeper's cottage",
  "a municipal swimming baths", "a tram depot", "a customs house",
  "a sleeper berth on a mail train", "a botanical glasshouse", "a quarantine island",
  "a grain silo", "an abandoned ski station", "a telephone exchange",
  "a chalk quarry", "a cold-storage warehouse", "a canal lock keeper's hut",
  "a mountain weather station", "a dry dock", "a peat bog cutting",
  "a church crypt converted to an archive", "a ferry terminal waiting room",
  "a pumping station", "a disused observatory dome", "a border checkpoint",
  "a fish cannery", "a sanatorium solarium", "an ice house",
  "a cable car station", "a printing works", "a model village",
  "a reservoir valve tower", "a shipping office", "a glass eye factory",
];

const WRONGNESS = [
  "something is being counted that should not be countable",
  "time is running at the wrong rate in one room",
  "the building remembers a previous occupant too well",
  "a debt is being collected",
  "something is growing that was never planted",
  "the records disagree with the people",
  "an arrival is expected and long overdue",
  "the machinery is still running with nobody to run it",
  "someone has been quietly substituted",
  "the way out is not where it was",
  "a sound is coming from the wrong direction",
  "the weather indoors does not match the weather outside",
  "an instrument is reading something it cannot measure",
  "a door has been bricked up recently from the inside",
  "the water is warmer than it has any right to be",
  "the lights come on in rooms nobody has entered",
  "a name keeps appearing that belongs to no one here",
];

const TONES = [
  "quiet dread", "bureaucratic unease", "folk-horror", "cold industrial",
  "melancholy", "wrong-fairytale", "clinical", "maritime gloom",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * The old version banned "mysterious", "eerie" and "ancient" by name. On a
 * model this size a banned-word list in prose raises those words' odds rather
 * than lowering them — there is no negation circuit strong enough to invert it
 * at temperature. The ban now lives in code (FLAT, below) and the prompt
 * competes for the adjective slot positively instead.
 */
export const SCENARIO_SYSTEM = `You write openings for text adventure games.

Your prose is spare, physical and second-person: things that can be touched, heard, smelled, counted or weighed. You name objects and materials rather than moods.

You answer with the requested lines only. The reply starts with the first key and stops after the last line.`;

/** One worked example suppresses markdown drift better than any instruction. */
export const SCENARIO_EXAMPLES = [
  {
    role: "user" as const,
    content: `Setting: a chalk quarry
Tone: bureaucratic unease
What is really going on, which the player cannot know yet: something is being counted that should not be countable

The OPENING line shows one small physical symptom of that, and names no cause.

Reply with these four lines:
TITLE: <2 to 3 words>
OPENING: <two sentences, "you", present tense>
PLACE: <short noun phrase>
CARRYING: <two ordinary objects, comma separated>`,
  },
  {
    role: "assistant" as const,
    content: `TITLE: The Tally Hut
OPENING: The chalk dust has settled on everything in the hut except the ledger, which lies open at today's date. Four hundred and nine, says the last line, in handwriting that matches yours.
PLACE: tally hut
CARRYING: a carpenter's pencil, a tin of throat lozenges`,
  },
];

/** Dead atmosphere words. Enforced here, where enforcement actually works. */
export const FLAT =
  /\b(mysterious|mysteriously|eerie|eerily|ancient|unsettling|ominous|inexplicabl\w+|otherworldly)\b/i;

export interface Seed {
  place: string;
  wrongness: string;
  tone: string;
}

export function drawSeed(): Seed {
  return { place: pick(PLACES), wrongness: pick(WRONGNESS), tone: pick(TONES) };
}

export function buildScenarioPrompt(seed: Seed): string {
  // Framed generatively. Handing a small model a secret and asking it to
  // suppress it gets the secret paraphrased into the opening; asking for a
  // symptom gets a symptom. Duplicate titles are rejected in code instead of
  // being listed here, where they would act as a few-shot of what to avoid.
  return `Setting: ${seed.place}
Tone: ${seed.tone}
What is really going on, which the player cannot know yet: ${seed.wrongness}

The OPENING line shows one small physical symptom of that — something seen, heard or counted — and names no cause.

Reply with these four lines:
TITLE: <2 to 3 words>
OPENING: <two sentences, "you", present tense>
PLACE: <short noun phrase>
CARRYING: <two ordinary objects, comma separated>`;
}

/** Pull `KEY: value` out of a loosely formatted reply. */
function field(raw: string, key: string): string | null {
  // Nano tends to answer with "**TITLE:** ..." — strip markdown before matching.
  const plain = raw.replace(/\*+/g, "").replace(/^#+\s*/gm, "");
  const match = plain.match(new RegExp(`${key}\\s*:\\s*(.+?)(?:\\n|$)`, "i"));
  if (!match) return null;
  const value = match[1].trim().replace(/^["'<]+|["'>]+$/g, "").trim();
  return value.length >= 2 ? value : null;
}

function cap(value: string | null, max: number): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length >= 2 && clean.length <= max ? clean : null;
}

/**
 * Parse a reply into a world, or reject it. A partial world is worse than a
 * missing one, so anything incomplete is dropped rather than patched up.
 */
export function parseScenario(raw: string | null, seed: Seed, index: number): Scenario | null {
  if (!raw) return null;

  const name = cap(field(raw, "TITLE"), 60);
  const opening = cap(field(raw, "OPENING"), 400);
  const location = cap(field(raw, "PLACE"), 60);
  if (!name || !opening || !location) return null;

  const inventory = (field(raw, "CARRYING") ?? "")
    .split(/,| and /)
    .map((item) => cap(item, 50))
    .filter((item): item is string => item !== null)
    .slice(0, 2);

  return {
    id: `gen-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    opening,
    // Composed, not generated. The wrongness is deliberately NOT here: handed
    // to the narrator every turn it either leaks on turn one or is ignored.
    // It goes to the director, which releases it once, on the REVERSE beat.
    premise: `${seed.place.replace(/^an? /, "").replace(/^./, (c) => c.toUpperCase())}. Tone: ${seed.tone}.`,
    secret: seed.wrongness,
    location,
    inventory: inventory.length ? inventory : ["nothing in particular"],
  };
}
