"use client";

import Wordmark from "./Wordmark";
import type { NanoStatus } from "@/lib/nano";

interface Props {
  status: NanoStatus;
  onDownload: () => void;
  onRecheck: () => void;
}

export default function Gate({ status, onDownload, onRecheck }: Props) {
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
    return (
      <div className="centered">
        <div className="panel">
          <h1 className="panel-title">NO MODEL FOUND</h1>
          <p className="panel-body">
            <Wordmark cursor={false} /> runs entirely on your machine &mdash; no account,
            no key, nothing sent anywhere. That needs Gemini Nano, which ships inside
            Chrome but stays switched off until you ask for it.
          </p>
          <ol className="panel-steps">
            <li>Desktop Chrome 138+, ~22GB free disk, &gt;4GB video memory.</li>
            <li>
              <code>chrome://flags/#prompt-api-for-gemini-nano</code> &rarr; Enabled
            </li>
            <li>
              <code>chrome://flags/#optimization-guide-on-device-model</code> &rarr;
              Enabled BypassPerfRequirement
            </li>
            <li>Restart Chrome, then retry.</li>
          </ol>
          {status.kind === "error" ? (
            <p className="notice">chrome reported: {status.message}</p>
          ) : null}
          <div className="panel-actions">
            <button type="button" className="block-button" onClick={onRecheck}>
              RETRY PROBE
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
            Chrome will fetch Gemini Nano once &mdash; a couple of gigabytes. After that
            it runs offline and costs nothing, forever.
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
