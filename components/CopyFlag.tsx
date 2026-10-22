"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies a chrome:// URL for the user to paste.
 *
 * A web page cannot navigate to chrome:// — Chrome blocks it outright, so a
 * link or a redirect would be a button that visibly does nothing. Putting the
 * address on the clipboard is the closest thing that actually works, and it
 * saves retyping a forty-character flag name by hand.
 */
export default function CopyFlag({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the address is printed below anyway.
      setCopied(false);
    }
  }

  return (
    <button type="button" className="block-button" onClick={copy}>
      {copied ? (
        <Check className="icon" aria-hidden="true" />
      ) : (
        <Copy className="icon" aria-hidden="true" />
      )}
      {copied ? "COPIED — PASTE IN A NEW TAB" : label}
    </button>
  );
}
