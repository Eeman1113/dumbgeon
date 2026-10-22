/**
 * The shape of a world. There is no fixed list — every scenario is invented by
 * the model at runtime in lib/generate.ts, so no two visits open the same way.
 */
export interface Scenario {
  id: string;
  name: string;
  /** Shown to the player as the first line of the story. */
  opening: string;
  /** Private background the narrator keeps in view for the whole run. */
  premise: string;
  /** The hidden truth. Withheld until the director's REVERSE beat. */
  secret: string;
  location: string;
  inventory: string[];
}
