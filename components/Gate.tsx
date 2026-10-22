"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
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
    const platforms: Platform[] = ["ios", "desktop-other", "chrome-mobile", "chrome-desktop"];
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
    // Installing Chrome only helps on a computer: every browser on iOS is
    // Safari's engine underneath, and Chrome for Android does not ship the
    // on-device model. Telling a phone user to "get Chrome" would send them
    // to install an app that still cannot run this.
    const chromeWouldHelp = platform === "desktop-other" || platform === "other";
    const onPhone = platform === "ios" || platform === "chrome-mobile";

    return (
      <div className="centered">
        <div className="panel">
          <h1 className="panel-title">
            {onPhone ? "NEEDS A COMPUTER" : chromeWouldHelp ? "NEEDS CHROME" : "NO MODEL FOUND"}
          </h1>

          {onPhone ? (
            <>
              <p className="panel-body">
                <Wordmark cursor={false} /> runs its AI <b>on your own device</b>, and the
                only browser that gives a web page an on-device model is{" "}
                <b>Chrome on a computer</b>.
              </p>
              <p className="panel-body">
                {platform === "ios"
                  ? "Installing Chrome on an iPhone will not help: every browser on iOS uses Safari's engine underneath, and it has no model to offer."
                  : "Chrome for Android does not include the on-device model yet — it is desktop only."}
              </p>
              <p className="panel-body">
                Open this on a Windows, macOS or Linux machine running Chrome and it
                works immediately.
              </p>

              <div className="panel-actions">
                <CopyFlag url={SITE.url} label="COPY LINK FOR YOUR COMPUTER" />
              </div>
            </>
          ) : chromeWouldHelp ? (
            <>
              <p className="panel-body">
                <Wordmark cursor={false} /> runs its AI <b>on your own device</b> — no
                account, no key, nothing sent anywhere. It does that through the model
                built into Chrome, which is the only browser exposing one to web pages.
              </p>
              <p className="panel-body">
                You are on a computer, so this is a short fix: install Chrome, open this
                page in it, and the game runs.
              </p>

              <div className="panel-actions">
                <a
                  className="block-button"
                  href="https://www.google.com/chrome/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="icon" aria-hidden="true" />
                  GET CHROME
                </a>
                <CopyFlag url={SITE.url} label="COPY THIS LINK" />
              </div>
            </>
          ) : (
            <>
              <p className="panel-body">
                <Wordmark cursor={false} /> runs entirely on your machine — no account,
                no key, nothing sent anywhere. That needs Gemini Nano, Chrome&apos;s
                built-in model.
              </p>
              <p className="panel-body">
                It ships turned on from <b>Chrome 148</b>, so the usual fix is simply to
                update. Check <code>chrome://settings/help</code> and restart.
              </p>

              <details className="fallback">
                <summary>On an older Chrome? Two flags turn it on.</summary>
                <p className="panel-body">
                  Chrome will not let a web page open its own settings, so these have to
                  be pasted into the address bar yourself.
                </p>
                <ol className="panel-steps">
                  <li>
                    Paste <code>{PROMPT_FLAG}</code> and set it to <b>Enabled</b>.
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
              </details>

              <p className="panel-body" style={{ marginTop: "1.25rem" }}>
                Needs about 22GB free disk and more than 4GB of video memory.
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
