"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_FIELD } from "@/lib/turnstile";

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadApi(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject()));
    script.addEventListener("error", () => reject());
  });
}

/**
 * The Turnstile check, placed inside a form: it writes its token into a hidden
 * field of that form. Renders nothing while `siteKey` is null (src/lib/turnstile.ts),
 * so the script is never loaded then. A token works once, so `resetKey` must
 * change after every answer from the server.
 */
export function TurnstileWidget({ siteKey, resetKey }: { siteKey?: string | null; resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let gone = false;
    loadApi()
      .then((api) => {
        if (gone || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          language: "he",
          theme: "light",
          "response-field-name": TURNSTILE_FIELD,
        });
      })
      .catch(() => {
        // Blocked or offline: the server's refusal is what the visitor sees
      });
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widget.current && resetKey) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px] flex justify-center" />;
}
