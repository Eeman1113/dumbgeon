"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import CopyFlag from "./CopyFlag";
import Wordmark from "./Wordmark";
import { detectPlatform, type NanoStatus, type Platform } from "@/lib/nano";
import { SITE } from "@/lib/site";

interface Props {
  status: NanoStatus;
  onDownload: () => void;
  onRecheck: () => void;
}

const PROMPT_FLAG = "chrome://flags/#prompt-api-for-gemini-nano";
const MODEL_FLAG = "chrome://flags/#optimization-guide-on-device-model";

export default function Gate({ status, onDownload, onRecheck }: Props) {
  // Detected after mount: the server has no user agent to read.
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => {
    // ?gate=ios etc. makes the per-browser branches testable from any machine.
    const forced = new URLSearchParams(location.search).get("gate");
    const platforms: Platform[] = ["ios", "safari", "chrome-mobile", "chrome-desktop"];
    const match = platforms.find((name) => name === forced);
    setPlatform(match ?? detectPlatform());
  }, []);

  if (status.kind === "checking") {
    return (
      <div className="centered">
        <div className="panel">
          <p className="panel-body cursor">probing for local model</p>
        </div>
      </div>
    );
  }

  if (status.kind === "missing" || status.kind === "error") {
    // On a browser that can never run this, flag instructions are a wild
    // goose chase. Say what is actually true instead.
    const unsupported = platform === "ios" || platform === "safari" || platform === "chrome-mobile";

    return (
      <div className="centered">
        <div className="panel">
          <h1 className="panel-title">
            {unsupported ? "WRONG BROWSER" : "NO MODEL FOUND"}
          </h1>

          {unsupported ? (
            <>
              <p className="panel-body">
                <Wordmark cursor={false} /> runs its AI on your own device, and the only
                browser that currently lets a web page do that is{" "}
                <b>Chrome on a desktop or laptop</b>.
              </p>
              <p className="panel-body">
                {platform === "ios" || platform === "safari"
                  ? "Safari has no on-device model available to web pages, so there is nothing to switch on here."
                  : "Chrome for Android does not include the on-device model yet."}{" "}
                Open this page on a computer running Chrome and it will work.
              </p>

              <div className="panel-actions">
                <CopyFlag url={SITE.url} label="COPY LINK FOR DESKTOP" />
              </div>
            </>
          ) : (
            <>
              <p className="panel-body">
                <Wordmark cursor={false} /> runs entirely on your machine — no account,
                no key, nothing sent anywhere. That needs Gemini Nano, which ships inside
                Chrome but stays switched off until you ask for it.
              </p>

              <p className="panel-body">
                Chrome will not let a web page open its own settings, so these have to be
                pasted into the address bar yourself.
              </p>

              <ol className="panel-steps">
                <li>
                  Paste <code>{PROMPT_FLAG}</code> into a new tab and set it to{" "}
                  <b>Enabled</b>.
                </li>
                <li>
                  Paste <code>{MODEL_FLAG}</code> and set it to{" "}
                  <b>Enabled BypassPerfRequirement</b>.
                </li>
                <li>Restart Chrome and come back here.</li>
              </ol>

              <div className="panel-actions">
                <CopyFlag url={PROMPT_FLAG} label="ENABLE THE MODEL" />
                <CopyFlag url={MODEL_FLAG} label="COPY STEP 2" />
              </div>

              <p className="panel-body" style={{ marginTop: "1.25rem" }}>
                Needs Chrome 138 or newer, about 22GB free disk and more than 4GB of video
                memory.
              </p>
            </>
          )}

          {status.kind === "error" ? (
            <p className="notice">chrome reported: {status.message}</p>
          ) : null}

          <div className="panel-actions">
            <button type="button" className="key-button" onClick={onRecheck}>
              <RefreshCw className="icon" aria-hidden="true" />
              CHECK AGAIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status.kind === "needs-download") {
    return (
      <div className="centered">
        <div className="panel">
          <h1 className="panel-title">MODEL NOT RESIDENT</h1>
          <p className="panel-body">
            Chrome will fetch Gemini Nano once — a couple of gigabytes. After that it
            runs offline and costs nothing, forever.
          </p>
          <div className="panel-actions">
            <button type="button" className="block-button" onClick={onDownload}>
              FETCH MODEL
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status.kind !== "downloading") return null;

  const percent = Math.round(status.progress * 100);

  return (
    <div className="centered">
      <div className="panel">
        <h1 className="panel-title">FETCHING</h1>
        <p className="panel-body">
          Downloading Gemini Nano. Leave this tab open; it only happens once.
        </p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="panel-body" style={{ marginTop: "0.75rem" }}>
          {percent}%
        </p>
      </div>
    </div>
  );
}
