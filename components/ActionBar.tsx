"use client";

import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Dices, Square } from "lucide-react";

interface Props {
  disabled: boolean;
  busy: boolean;
  canUndo: boolean;
  canRetry: boolean;
  onSubmit: (action: string) => void;
  onUndo: () => void;
  onRetry: () => void;
  onStop: () => void;
}

export default function ActionBar({
  disabled,
  busy,
  canUndo,
  canRetry,
  onSubmit,
  onUndo,
  onRetry,
  onStop,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy && !disabled) inputRef.current?.focus();
  }, [busy, disabled]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const action = value.trim();
    if (!action || busy || disabled) return;
    setValue("");
    onSubmit(action);
  }

  return (
    <form className="action-bar" onSubmit={submit}>
      <div className="action-inner">
        <div className="action-field">
          <span className="action-caret" aria-hidden="true">
            &gt;
          </span>
          <input
            ref={inputRef}
            className="action-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={disabled ? "session ended" : "what do you do?"}
            disabled={busy || disabled}
            aria-label="Your action"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            enterKeyHint="go"
            inputMode="text"
          />
        </div>

        <div className="action-meta">
          {busy ? (
            <button type="button" className="key-button" onClick={onStop}>
              <Square className="icon" aria-hidden="true" />
              HALT
            </button>
          ) : (
            <>
              <button
                type="button"
                className="key-button"
                onClick={onUndo}
                disabled={!canUndo}
              >
                <CornerUpLeft className="icon" aria-hidden="true" />
                UNDO
              </button>
              <button
                type="button"
                className="key-button"
                onClick={onRetry}
                disabled={!canRetry}
              >
                <Dices className="icon" aria-hidden="true" />
                REROLL
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
