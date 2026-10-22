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

/**
 * Every world used to be a variation on dread, which made four scenarios feel
 * like one. These tables span genre and mood on purpose: a heist, a wizard, a
 * ferry crossing and a haunted exchange should not share a register.
 */
const PLACES = [
  // fantasy
  "a ruined city on the old road", "a wizard's tower let to students",
  "a border inn on a trade route", "a flooded temple in the marsh",
  "a dragon's abandoned terrace", "a market city at festival",
  // science fiction
  "a generation ship's farm deck", "a mining station above a gas giant",
  "a terraforming outpost", "a derelict freighter under salvage claim",
  // mundane and strange
  "a night ferry", "a radio observatory", "a seed vault",
  "a funicular railway", "a municipal swimming baths", "a tram depot",
  "a botanical glasshouse", "a telephone exchange", "a lighthouse cottage",
  "a grain silo", "an abandoned ski station", "a customs house",
  "a cold-storage warehouse", "a mountain weather station", "a dry dock",
  "a chalk quarry", "a printing works", "a border checkpoint",
  "a fish cannery", "a cable car station", "a drained reservoir",
];

/** What is actually going on. Not all of it is sinister. */
const HOOKS = [
  "a job is on offer that pays far too well",
  "someone here owes the player a favour and would rather not pay it",
  "a door has appeared that was not there yesterday",
  "a rumour is worth money to the right buyer",
  "something is being counted that should not be countable",
  "the records disagree with the people",
  "an arrival is expected and long overdue",
  "the machinery is still running with nobody to run it",
  "someone has been quietly substituted",
  "a debt is being collected",
  "two factions both think the player works for them",
  "there is treasure here and the map is wrong",
  "a festival is about to start and someone is missing",
  "the way out is not where it was",
  "something is growing that was never planted",
  "a contract was signed in the player's name by someone else",
  "the weather indoors does not match the weather outside",
  "a name keeps appearing that belongs to no one here",
];

const TONES = [
  "wry and adventurous", "warm but uneasy", "pulpy and fast",
  "quiet dread", "bureaucratic comedy", "folk-horror", "cold industrial",
  "melancholy", "swashbuckling", "deadpan and absurd", "clinical",
  "hopeful", "noir",
];

const ROLES = [
  "a wizard with more confidence than training", "a courier who reads the parcels",
  "a salvage diver", "a junior inspector", "a thief between jobs",
  "a ship's cook", "a cartographer", "a debt collector who has lost their nerve",
  "a lighthouse keeper's replacement", "a travelling physician",
  "a night watchman", "a translator", "a smuggler", "a retired soldier",
  "an apprentice who has been left in charge",
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
The player is: a junior inspector
Tone: bureaucratic comedy
Going on behind the scenes, which the player cannot know yet: something is being counted that should not be countable

Write the opening of an adventure. Tell the player who they are and drop them straight into the situation. Hint at the hidden thing with one concrete detail; never explain it.

Reply with these four lines:
TITLE: <2 to 3 words>
OPENING: <three sentences. Start "You are". Say who they are and where. Then one thing happening right now.>
PLACE: <short noun phrase>
CARRYING: <two ordinary objects, comma separated>`,
  },
  {
    role: "assistant" as const,
    content: `TITLE: The Tally Hut
OPENING: You are a junior inspector at the chalk quarry, two days into a count nobody wanted you to make. The dust has settled on everything in the tally hut except the ledger, which lies open at today's date. The foreman is outside now, waiting for you to come out and agree with him.
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
  role: string;
}

export function drawSeed(): Seed {
  return {
    place: pick(PLACES),
    wrongness: pick(HOOKS),
    tone: pick(TONES),
    role: pick(ROLES),
  };
}

export function buildScenarioPrompt(seed: Seed): string {
  // Framed generatively. Handing a small model a secret and asking it to
  // suppress it gets the secret paraphrased into the opening; asking for a
  // symptom gets a symptom. Duplicate titles are rejected in code instead of
  // being listed here, where they would act as a few-shot of what to avoid.
  return `Setting: ${seed.place}
The player is: ${seed.role}
Tone: ${seed.tone}
Going on behind the scenes, which the player cannot know yet: ${seed.wrongness}

Write the opening of an adventure. Tell the player who they are and drop them straight into the situation. Hint at the hidden thing with one concrete detail; never explain it.

Reply with these four lines:
TITLE: <2 to 3 words>
OPENING: <three sentences. Start "You are". Say who they are and where. Then one thing happening right now.>
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
  const opening = cap(field(raw, "OPENING"), 520);
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
    premise: `${seed.place.replace(/^an? /, "").replace(/^./, (c) => c.toUpperCase())}. The player is ${seed.role}. Tone: ${seed.tone}.`,
    secret: seed.wrongness,
    location,
    inventory: inventory.length ? inventory : ["nothing in particular"],
  };
}
