/**
 * Repetition detection.
 *
 * A small model's most visible tic is restatement: it answers "Marek owes you
 * money" with "Marek owes you money, a fact you are both aware of", and it
 * reaches for the same sentence shapes turn after turn. No amount of prompting
 * reliably stops either — listing phrases to avoid just few-shots them back.
 * Measuring the overlap and asking once more is what actually works.
 */

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function trigrams(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

function overlap(candidate: Set<string>, previous: Set<string>): number {
  if (candidate.size === 0) return 0;
  let shared = 0;
  for (const gram of candidate) if (previous.has(gram)) shared++;
  return shared / candidate.size;
}

/**
 * Does the reply parrot what the player just typed?
 *
 * Restatement is semantic rather than literal, so measuring whole-text
 * similarity misses it. The reliable tell is a verbatim run: "Marek is your
 * old partner and he owes you money" coming back as "...and Marek owes you
 * money" reproduces three of the player's words in order. Reusing a noun is
 * necessary and fine; reusing a phrase is the model stalling.
 */
export function echoesInput(narration: string, action: string): boolean {
  const source = words(action);
  if (source.length < 3) return false;

  const target = words(narration).join(" ");

  for (let i = 0; i + 2 < source.length; i++) {
    const run = source.slice(i, i + 3);
    // A run of nothing but short function words ("out of the") proves nothing.
    if (!run.some((word) => word.length > 3)) continue;
    if (target.includes(run.join(" "))) return true;
  }

  return false;
}

/** Does the reply reuse the phrasing of recent turns? */
export function echoesHistory(narration: string, previous: string[]): boolean {
  const candidate = trigrams(narration);
  if (candidate.size < 4) return false;
  return previous.some((prior) => overlap(candidate, trigrams(prior)) > 0.22);
}

/** Nano's other tic: every reply opening with the same few words. */
export function sameOpening(narration: string, previous: string[]): boolean {
  const head = (text: string) => words(text).slice(0, 3).join(" ");
  const candidate = head(narration);
  if (!candidate) return false;
  return previous.some((prior) => head(prior) === candidate);
}

export const REDIRECT =
  "Start somewhere else entirely. Open on what another person or the place does next, use none of the sentence shapes above, and add something that was not already said.";
