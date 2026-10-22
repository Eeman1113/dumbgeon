import { classify, type RiskClass } from "./director";

/**
 * A running read on how this particular person plays.
 *
 * Built entirely from their own inputs, in plain TypeScript, so it costs no
 * model time. The point is that two people typing into the same scenario
 * should not get the same game: someone who talks to everyone should meet
 * people worth talking to, someone who kicks doors down should get doors.
 */
export interface PlayerProfile {
  counts: Record<RiskClass, number>;
  /** Rolling mean words per input — the narrator matches their register. */
  avgWords: number;
  turns: number;
  /** Proper nouns the player introduced. They invented them; keep them alive. */
  invented: string[];
}

export function newProfile(): PlayerProfile {
  return {
    counts: { declare: 0, observe: 0, talk: 0, act: 0, risk: 0 },
    avgWords: 0,
    turns: 0,
    invented: [],
  };
}

/** Capitalised words that aren't sentence-initial are names the player coined. */
function properNouns(action: string): string[] {
  const words = action.split(/\s+/);
  const found: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^A-Za-z'-]/g, "");
    if (word.length < 3 || word.length > 20) continue;
    if (i === 0) continue; // sentence-initial capital proves nothing
    if (!/^[A-Z][a-z]/.test(word)) continue;
    found.push(word);
  }
  return found;
}

export function observe(profile: PlayerProfile, action: string): PlayerProfile {
  const cls = classify(action);
  const words = action.trim().split(/\s+/).length;
  const turns = profile.turns + 1;

  return {
    counts: { ...profile.counts, [cls]: profile.counts[cls] + 1 },
    // Weighted toward recent play so a change of style is picked up quickly.
    avgWords: profile.turns === 0 ? words : profile.avgWords * 0.75 + words * 0.25,
    turns,
    invented: [...new Set([...properNouns(action), ...profile.invented])].slice(0, 6),
  };
}

const LEAN: Partial<Record<RiskClass, string>> = {
  talk: "This player talks to people. Give someone in the scene something to say.",
  risk: "This player acts decisively. Keep it physical and let them be competent.",
  observe:
    "This player examines things closely. Reward the attention with a specific detail worth finding.",
  declare:
    "This player is inventing the world as they go. Take what they add and build on it.",
};

/**
 * One line describing how to pitch this reply. Returns null early on, before
 * there is enough evidence to adapt to anything.
 */
export function styleLine(profile: PlayerProfile): string | null {
  if (profile.turns < 3) return null;

  const entries = (Object.entries(profile.counts) as [RiskClass, number][])
    .filter(([cls]) => cls in LEAN)
    .sort((a, b) => b[1] - a[1]);

  const [topClass, topCount] = entries[0] ?? ["act", 0];
  // Only adapt on a real preference, not a one-turn accident.
  if (topCount < Math.max(2, profile.turns * 0.34)) return null;

  return LEAN[topClass] ?? null;
}

/** Match the player's own register: terse players get terse replies. */
export function lengthLine(profile: PlayerProfile): string {
  if (profile.turns < 3) return "Write 2 to 4 sentences.";
  if (profile.avgWords >= 12) return "Write 3 to 4 sentences.";
  if (profile.avgWords <= 4) return "Write 2 to 3 sentences.";
  return "Write 2 to 4 sentences.";
}
