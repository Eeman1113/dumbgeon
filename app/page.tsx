"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ActionBar from "@/components/ActionBar";
import BootSequence from "@/components/BootSequence";
import Dreaming from "@/components/Dreaming";
import Gate from "@/components/Gate";
import ScenarioPicker from "@/components/ScenarioPicker";
import Transcript from "@/components/Transcript";
import Wordmark from "@/components/Wordmark";
import WorldPanel from "@/components/WorldPanel";
import {
  advance,
  applyDelta,
  BOOKKEEPER_EXAMPLES,
  BOOKKEEPER_SYSTEM,
  buildDeltaPrompt,
  buildNarrationPrompt,
  cleanNarration,
  loadGame,
  MAX_HEALTH,
  NARRATOR_EXAMPLES,
  NARRATOR_SYSTEM,
  newGame,
  observe,
  parseDelta,
  remember,
  resolveAction,
  saveGame,
  type Game,
  type Turn,
} from "@/lib/game";
import { drawClock, drawThreat } from "@/lib/director";
import { echoesHistory, echoesInput, REDIRECT, sameOpening } from "@/lib/echo";
import { RotateCcw } from "lucide-react";
import type { Scenario } from "@/lib/scenarios";
import {
  buildScenarioPrompt,
  drawSeed,
  FLAT,
  parseScenario,
  SCENARIO_EXAMPLES,
  SCENARIO_SYSTEM,
} from "@/lib/generate";
import {
  checkAvailability,
  createSession,
  describe,
  streamPrompt,
  type NanoStatus,
} from "@/lib/nano";

type View = "picker" | "playing";

/** How many worlds to dream up per visit. */
const WORLD_COUNT = 4;

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState<NanoStatus>({ kind: "checking" });
  const [view, setView] = useState<View>("picker");
  const [game, setGame] = useState<Game | null>(null);
  const [saved, setSaved] = useState<Game | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const sessionRef = useRef<NanoSession | null>(null);
  const bookkeeperRef = useRef<NanoSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);

  // --- startup ------------------------------------------------------------

  useEffect(() => {
    // The BIOS crawl is a cold-start flourish, not a reload tax.
    if (sessionStorage.getItem("dumbgeon.booted")) setBooting(false);

    // The gate screens are unreachable on a machine where the model works,
    // so ?gate=missing / ?gate=download make them testable.
    const forced = new URLSearchParams(location.search).get("gate");
    if (forced === "missing" ||
      forced === "ios" ||
      forced === "desktop-other" ||
      forced === "chrome-mobile") {
      setBooting(false);
      setStatus({ kind: "missing" });
      return;
    }
    if (forced === "download") {
      setBooting(false);
      setStatus({ kind: "needs-download" });
      return;
    }

    checkAvailability().then(setStatus);
    const existing = loadGame();
    if (existing) setSaved(existing);
  }, []);

  const finishBoot = useCallback(() => {
    sessionStorage.setItem("dumbgeon.booted", "1");
    setBooting(false);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      genAbortRef.current?.abort();
      sessionRef.current?.destroy();
      bookkeeperRef.current?.destroy();
    };
  }, []);

  /** One narration session per run, carrying the worked example. */
  const ensureSession = useCallback(async (): Promise<NanoSession> => {
    if (sessionRef.current) return sessionRef.current;
    const session = await createSession({
      system: NARRATOR_SYSTEM,
      examples: NARRATOR_EXAMPLES,
      temperature: 0.8,
      topK: 8,
    });
    sessionRef.current = session;
    return session;
  }, []);

  /**
   * The bookkeeper gets its own session. It used to share the narrator's,
   * under a system prompt that forbids inventory lists — which is exactly what
   * this call produces. Greedy decoding too: extraction wants no entropy.
   */
  const ensureBookkeeper = useCallback(async (): Promise<NanoSession> => {
    if (bookkeeperRef.current) return bookkeeperRef.current;
    const session = await createSession({
      system: BOOKKEEPER_SYSTEM,
      examples: BOOKKEEPER_EXAMPLES,
      temperature: 0,
      topK: 1,
    });
    bookkeeperRef.current = session;
    return session;
  }, []);

  /**
   * Dream up a fresh set of worlds. Runs on every visit — nothing is cached,
   * so no two sessions open on the same worlds.
   *
   * Generated one at a time, with each result shown on the loading screen as
   * it lands, so a long wait still reads as progress.
   */
  const generateWorlds = useCallback(async () => {
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;

    setGenerating(true);
    setGenerationFailed(false);
    setScenarios([]);

    let session: NanoSession | null = null;
    const made: Scenario[] = [];

    try {
      session = await createSession({
        system: SCENARIO_SYSTEM,
        examples: SCENARIO_EXAMPLES,
        // Variety comes from 36 places x 17 wrongnesses x 8 tones, not from
        // sampling. High temperature on a small model buys format drift —
        // and a drifted reply is a dropped world.
        temperature: 1.0,
        topK: 8,
      });

      const slug = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");
      let attempts = 0;

      while (made.length < WORLD_COUNT && attempts < WORLD_COUNT * 3) {
        if (controller.signal.aborted) return;
        attempts++;

        const seed = drawSeed();
        let raw: string | null = null;
        try {
          raw = await session.prompt(buildScenarioPrompt(seed), {
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) return;
        }

        if (controller.signal.aborted) return;

        // Reject rather than repair: a duplicate or a world built out of dead
        // atmosphere words is cheaper to redraw than to live with.
        const scenario = parseScenario(raw, seed, made.length);
        if (
          scenario &&
          !FLAT.test(scenario.opening) &&
          !FLAT.test(scenario.name) &&
          !made.some((existing) => slug(existing.name) === slug(scenario.name))
        ) {
          made.push(scenario);
          setScenarios([...made]);
        }
      }

      if (!made.length) setGenerationFailed(true);
    } catch {
      if (!controller.signal.aborted) setGenerationFailed(true);
    } finally {
      session?.destroy();
      if (genAbortRef.current === controller) {
        genAbortRef.current = null;
        setGenerating(false);
      }
    }
  }, []);

  // Dream a new set as soon as the model is up, and again on every return
  // to the menu.
  useEffect(() => {
    if (status.kind !== "ready" || booting) return;
    if (view !== "picker") return;
    if (scenarios.length || generating || generationFailed) return;
    void generateWorlds();
  }, [status.kind, booting, view, scenarios.length, generating, generationFailed, generateWorlds]);

  const startDownload = useCallback(async () => {
    setStatus({ kind: "downloading", progress: 0 });
    try {
      // Must run inside the click that triggered it — Chrome requires user
      // activation to begin the model download.
      const session = await createSession({
        system: NARRATOR_SYSTEM,
        onProgress: (progress) => setStatus({ kind: "downloading", progress }),
      });
      sessionRef.current = session;
      setStatus({ kind: "ready" });
    } catch (error) {
      setStatus({ kind: "error", message: describe(error) });
    }
  }, []);

  const recheck = useCallback(() => {
    setStatus({ kind: "checking" });
    checkAvailability().then(setStatus);
  }, []);

  // --- the turn loop ------------------------------------------------------

  /**
   * Resolve one action against a given starting point. Narration streams to the
   * reader first, then a second constrained call reports what changed — keeping
   * the two jobs apart is what stops a small model losing track of inventory.
   */
  const resolve = useCallback(
    async (initial: Game, action: string) => {
      let base = initial;
      setProblem(null);
      setPendingAction(action);
      setStreaming("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const session = await ensureSession();
        const turnIndex = base.turns.length;

        // The verdict is decided here, in TypeScript, before the model writes
        // a word. The narrator is told what happened and dramatises it; it is
        // never asked to judge whether an action should work.
        // Learn how this person plays before building the prompt, so the
        // adaptation applies to the turn they just took.
        base = { ...base, profile: observe(base.profile, action) };

        const roll = resolveAction(
          base.director,
          base.state.inventory,
          base.state.health / MAX_HEALTH,
          action,
          turnIndex,
        );

        const recent = base.turns.slice(-3).map((turn) => turn.narration);

        const tell = async (redirect?: string) =>
          cleanNarration(
            await streamPrompt(
              session,
              buildNarrationPrompt(base, action, roll, redirect),
              // Scrub while streaming too, so a leaked label never flashes up.
              (text) => setStreaming(cleanNarration(text)),
              controller.signal,
            ),
          );

        let narration = await tell();
        if (controller.signal.aborted) return;

        // One retry if the reply parrots the player or reuses recent phrasing.
        // Prompting alone does not fix restatement on a model this size.
        const repetitive =
          echoesInput(narration, action) ||
          echoesHistory(narration, recent) ||
          sameOpening(narration, recent);

        if (repetitive) {
          setStreaming("");
          const second = await tell(REDIRECT);
          if (controller.signal.aborted) return;
          // Keep the retry only if it is actually less repetitive.
          if (second && !echoesInput(second, action) && !echoesHistory(second, recent)) {
            narration = second;
          }
        }

        if (!narration) throw new Error("The narrator returned nothing.");

        const turn: Turn = {
          id: `${turnIndex}-${action.slice(0, 24)}-${Math.random().toString(36).slice(2, 7)}`,
          action,
          narration,
          stateBefore: base.state,
          directorBefore: base.director,
          memoryBefore: base.memory,
          profileBefore: base.profile,
        };

        // Show the finished prose immediately; bookkeeping catches up after.
        const withTurn: Game = { ...base, turns: [...base.turns, turn] };
        setGame(withTurn);
        setPendingAction(null);
        setStreaming("");

        const bookkeeper = await ensureBookkeeper();
        let deltaRaw: string | null = null;
        try {
          deltaRaw = await bookkeeper.prompt(
            buildDeltaPrompt(base.state, action, narration),
            { signal: controller.signal },
          );
        } catch {
          if (controller.signal.aborted) return;
        }

        if (controller.signal.aborted) return;

        const delta = parseDelta(deltaRaw);
        const state = applyDelta(base.state, delta, roll, narration);
        const director = advance(
          base.director,
          turnIndex,
          roll.outcome,
          state.health / MAX_HEALTH,
        );
        const memory = remember(base.memory, director, delta, roll, base.state.location);

        const next: Game = { ...withTurn, state, director, memory };
        setGame(next);
        saveGame(next);
      } catch (error) {
        if (!controller.signal.aborted) {
          setProblem(describe(error));
        }
        setPendingAction(null);
        setStreaming("");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [ensureSession, ensureBookkeeper],
  );

  // --- player controls ----------------------------------------------------

  const begin = useCallback(
    (scenario: Scenario) => {
      abortRef.current?.abort();
      genAbortRef.current?.abort();
      genAbortRef.current = null;
      setGenerating(false);
      sessionRef.current?.destroy();
      sessionRef.current = null;
      bookkeeperRef.current?.destroy();
      bookkeeperRef.current = null;

      // The threat and the deadline are drawn, not generated: a composed
      // antagonist is always coherent and costs no model time.
      const fresh = newGame(scenario, drawThreat(), drawClock());
      setGame(fresh);
      setSaved(null);
      setProblem(null);
      setPendingAction(null);
      setStreaming("");
      setView("playing");
      saveGame(fresh);
    },
    [],
  );

  const resume = useCallback(() => {
    if (!saved) return;
    setGame(saved);
    setView("playing");
  }, [saved]);

  const act = useCallback(
    (action: string) => {
      if (game) void resolve(game, action);
    },
    [game, resolve],
  );

  const undo = useCallback(() => {
    if (!game || game.turns.length < 2) return;
    const last = game.turns.at(-1)!;
    const next: Game = {
      ...game,
      turns: game.turns.slice(0, -1),
      state: last.stateBefore,
      director: last.directorBefore,
      memory: last.memoryBefore,
      profile: last.profileBefore,
    };
    setGame(next);
    saveGame(next);
    setProblem(null);
  }, [game]);

  /** Re-roll the last action from the exact state it was taken in. */
  const retry = useCallback(() => {
    if (!game || game.turns.length < 2) return;
    const last = game.turns.at(-1)!;
    if (!last.action) return;
    const rewound: Game = {
      ...game,
      turns: game.turns.slice(0, -1),
      state: last.stateBefore,
    };
    setGame(rewound);
    void resolve(rewound, last.action);
  }, [game, resolve]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setPendingAction(null);
    setStreaming("");
  }, []);

  const abandon = useCallback(() => {
    abortRef.current?.abort();
    sessionRef.current?.destroy();
    sessionRef.current = null;
    bookkeeperRef.current?.destroy();
    bookkeeperRef.current = null;
    setGame(null);
    setSaved(null);
    saveGame(null);
    setScenarios([]);
    setGenerationFailed(false);
    setPendingAction(null);
    setStreaming("");
    setProblem(null);
    setView("picker");
  }, []);

  // --- render -------------------------------------------------------------

  if (booting) {
    return <BootSequence onDone={finishBoot} />;
  }

  if (status.kind !== "ready") {
    return (
      <Gate status={status} onDownload={startDownload} onRecheck={recheck} />
    );
  }

  if (view === "picker" || !game) {
    // The half-built list is never shown — the wait gets its own screen.
    if (generating) {
      return (
        <Dreaming
          ready={scenarios.length}
          wanted={WORLD_COUNT}
          titles={scenarios.map((scenario) => scenario.name)}
          onResume={saved ? resume : undefined}
        />
      );
    }

    return (
      <ScenarioPicker
        scenarios={scenarios}
        failed={generationFailed}
        onChoose={begin}
        onRegenerate={generateWorlds}
        onResume={saved ? resume : undefined}
      />
    );
  }

  const busy = pendingAction !== null;
  const dead = game.state.health <= 0;
  const scenarioName = game.name ?? "Unknown country";

  return (
    <div className="shell">
      <header className="statusbar">
        <div className="statusbar-left">
          <Wordmark />
          <span className="optional">
            SCENARIO <b>{scenarioName}</b>
          </span>
          <span className="optional">
            TURN <b>{game.turns.length - 1}</b>
          </span>
        </div>
        <div className="statusbar-right">
          <span className="status">
            <span className={`status-dot ${busy ? "busy" : ""} ${dead ? "bad" : ""}`} />
            <span className={dead ? "amber" : undefined}>
              {dead ? "HALTED" : busy ? "GENERATING" : "NANO READY"}
            </span>
          </span>
          <button type="button" className="key-button" onClick={abandon}>
            <RotateCcw className="icon" aria-hidden="true" />
            RESET
          </button>
        </div>
      </header>

      <div className="stage">
        <div className="telling">
          <main className="reader">
            <Transcript
              turns={game.turns}
              pendingAction={pendingAction}
              streaming={streaming}
              dead={dead}
            />
            {problem ? <p className="notice">{problem}</p> : null}
          </main>

          <ActionBar
            disabled={dead}
            busy={busy}
            canUndo={game.turns.length > 1}
            canRetry={game.turns.length > 1 && game.turns.at(-1)?.action != null}
            onSubmit={act}
            onUndo={undo}
            onRetry={retry}
            onStop={stop}
          />
        </div>
        <WorldPanel state={game.state} director={game.director} />
      </div>
    </div>
  );
}
