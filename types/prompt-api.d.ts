// Chrome's built-in Prompt API (Gemini Nano). Not in lib.dom yet, so declared here.
// The global has moved around across Chrome versions: `window.ai.languageModel`
// in the early origin trial, `LanguageModel` from Chrome 138 onward. We declare
// both and feature-detect at runtime in lib/nano.ts.

type NanoAvailability = "unavailable" | "downloadable" | "downloading" | "available";

interface NanoPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NanoMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (event: { loaded: number }) => void,
  ): void;
}

interface NanoCreateOptions {
  initialPrompts?: NanoPromptMessage[];
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  monitor?: (m: NanoMonitor) => void;
}

interface NanoPromptOptions {
  signal?: AbortSignal;
  /** JSON Schema the response must conform to. */
  responseConstraint?: object;
  /** Keep the schema out of the model's own token budget. */
  omitResponseConstraintInput?: boolean;
}

interface NanoSession {
  prompt(input: string, options?: NanoPromptOptions): Promise<string>;
  promptStreaming(input: string, options?: NanoPromptOptions): ReadableStream<string>;
  clone(options?: { signal?: AbortSignal }): Promise<NanoSession>;
  destroy(): void;
  readonly inputUsage: number;
  readonly inputQuota: number;
}

interface NanoParams {
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
}

interface NanoNamespace {
  availability(options?: object): Promise<NanoAvailability>;
  params(): Promise<NanoParams | null>;
  create(options?: NanoCreateOptions): Promise<NanoSession>;
}

declare var LanguageModel: NanoNamespace | undefined;

interface Window {
  LanguageModel?: NanoNamespace;
  ai?: { languageModel?: NanoNamespace; assistant?: NanoNamespace };
}
