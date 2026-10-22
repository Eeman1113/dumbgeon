/**
 * Thin wrapper over Chrome's built-in Prompt API (Gemini Nano).
 *
 * Everything here runs in the browser — there is no server in this app. The two
 * things worth knowing about the underlying API:
 *
 *  1. The global has been renamed across Chrome versions, so we resolve it at
 *     call time instead of caching a reference at module load.
 *  2. When the model is `downloadable`, `create()` must be called from a user
 *     gesture or Chrome rejects it. The Gate component owns that click.
 */

export type NanoStatus =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "needs-download" }
  | { kind: "downloading"; progress: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

function resolveNamespace(): NanoNamespace | null {
  if (typeof window === "undefined") return null;
  const w = window as Window;
  return w.LanguageModel ?? w.ai?.languageModel ?? w.ai?.assistant ?? null;
}

export function isSupported(): boolean {
  return resolveNamespace() !== null;
}

export type Platform = "chrome-desktop" | "chrome-mobile" | "ios" | "safari" | "other";

/**
 * Which browser is this, for the purposes of telling the user something true.
 *
 * Chrome's Prompt API is desktop-only, and Safari exposes no on-device model
 * to web pages at all, so showing everyone the same "enable these flags"
 * instructions sends most visitors on an errand that cannot succeed.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;

  // iPadOS reports as Macintosh, so check for touch as well.
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";

  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
  if (isChrome) return /Android/.test(ua) ? "chrome-mobile" : "chrome-desktop";

  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export async function checkAvailability(): Promise<NanoStatus> {
  const ns = resolveNamespace();
  if (!ns) return { kind: "missing" };
  try {
    const availability = await ns.availability();
    switch (availability) {
      case "available":
        return { kind: "ready" };
      case "downloadable":
        return { kind: "needs-download" };
      case "downloading":
        return { kind: "downloading", progress: 0 };
      default:
        return { kind: "missing" };
    }
  } catch (error) {
    return { kind: "error", message: describe(error) };
  }
}

/**
 * Create a session. Call this from a click handler the first time — if the
 * model still has to download, Chrome requires user activation.
 *
 * `examples` are prefilled into the session's context once, at creation, and
 * retained for every later prompt. A few-shot placed here costs one prefill
 * per session rather than one per turn — the difference between affordable
 * and not.
 */
export async function createSession(opts: {
  system: string;
  examples?: NanoPromptMessage[];
  temperature?: number;
  topK?: number;
  onProgress?: (fraction: number) => void;
}): Promise<NanoSession> {
  const ns = resolveNamespace();
  if (!ns) throw new Error("Chrome's built-in model is not available here.");

  let params: NanoParams | null = null;
  try {
    params = (await ns.params?.()) ?? null;
  } catch {
    // params() is absent in some builds; we probe instead, below.
  }

  const wantTemperature = opts.temperature ?? 0.8;
  const wantTopK = opts.topK ?? 3;

  // Chrome caps topK low (historically 8) and rejects anything above it. With
  // no params() to read, try descending settings rather than guessing — a
  // session on default sampling beats a failure screen.
  const ladder: Array<{ temperature?: number; topK?: number }> = params
    ? [
        {
          temperature: Math.min(wantTemperature, params.maxTemperature),
          topK: Math.min(wantTopK, params.maxTopK),
        },
      ]
    : [
        { temperature: wantTemperature, topK: wantTopK },
        { temperature: wantTemperature, topK: Math.min(wantTopK, 8) },
        { temperature: wantTemperature, topK: 3 },
        {},
      ];

  const initialPrompts: NanoPromptMessage[] = [
    { role: "system", content: opts.system },
    ...(opts.examples ?? []),
  ];

  let lastError: unknown;
  for (const sampling of ladder) {
    try {
      return await ns.create({
        initialPrompts,
        ...sampling,
        monitor(m) {
          m.addEventListener("downloadprogress", (event) => {
            opts.onProgress?.(event.loaded);
          });
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not create a session.");
}

/** Stream a prompt, invoking `onChunk` with the full text so far. */
export async function streamPrompt(
  session: NanoSession,
  input: string,
  onChunk: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = session.promptStreaming(input, { signal });
  const reader = stream.getReader();
  let full = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Chrome has shipped both delta chunks and cumulative chunks. Detect
      // which we're getting rather than assuming, or text arrives duplicated.
      if (typeof value === "string") {
        full = value.startsWith(full) && value.length >= full.length ? value : full + value;
        onChunk(full);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return full.trim();
}

/**
 * Ask for JSON matching a schema. Falls back to an unconstrained prompt plus
 * brace-matching when the build predates `responseConstraint`.
 */
export async function promptJSON<T>(
  session: NanoSession,
  input: string,
  schema: object,
  signal?: AbortSignal,
): Promise<T | null> {
  let raw: string;
  try {
    raw = await session.prompt(input, {
      responseConstraint: schema,
      omitResponseConstraintInput: true,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) return null;
    try {
      raw = await session.prompt(input, { signal });
    } catch {
      return null;
    }
  }
  return extractJSON<T>(raw);
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJSON<T>(raw: string): T | null {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
