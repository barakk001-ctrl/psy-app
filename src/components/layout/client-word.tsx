"use client";

import { createContext, useContext, useMemo } from "react";
import { wordingFor, type Say } from "@/lib/client-word";

// The account's word for the people it treats (src/lib/client-word.ts), for
// client components. The signed-in layouts render the provider; outside it
// (signed-out pages) texts stay as written.

const ClientWordContext = createContext<string | null>(null);

export function ClientWordProvider({ word, children }: { word: string | null | undefined; children: React.ReactNode }) {
  return <ClientWordContext.Provider value={word ?? null}>{children}</ClientWordContext.Provider>;
}

/** `const say = useSay()`, then `say("לקוח/ה חדש/ה")`. */
export function useSay(): Say {
  const word = useContext(ClientWordContext);
  return useMemo(() => wordingFor(word), [word]);
}
