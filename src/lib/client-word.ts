// The therapist's word for the people they treat (the שאלון היכרות's seventh
// question, User.clientWord): לקוחות, מטופלים or נועצים.
//
// The app's texts are written with "לקוח" — לקוח, לקוחה, לקוח/ה, לקוחות, with
// any prefix (הלקוח/ה, ללקוחות, ולקוחות, כשללקוח/ה). All three words are
// regular masculine nouns, so every form maps one to one and the words around
// it (פעילים, חדש/ה, נמצא/ה, אליו/ה) already agree. `wordingFor(word)` returns
// the function that rewrites a text; by convention it is called `say` wherever
// it is used: `const say = await getSay()` on the server
// (client-word-server.ts), `const say = useSay()` in a client component
// (components/layout/client-word.tsx). client-word.test.ts fails when a screen
// keeps a "לקוח" that does not go through `say`.
//
// Left as "לקוח" on purpose: signed-out pages (no account to ask) and billing
// documents — where "לקוח" is the term of the document.
//
// A text that has to name the word "לקוחות" itself whatever the account chose
// (the help article that lists the three choices) writes AS_WRITTEN before it.
// Pure; tested.

export const CLIENT_WORDS = [
  { id: "clients", label: "לקוחות", one: "לקוח", oneF: "לקוחה", both: "לקוח/ה", many: "לקוחות" },
  { id: "patients", label: "מטופלים", one: "מטופל", oneF: "מטופלת", both: "מטופל/ת", many: "מטופלים" },
  { id: "counselees", label: "נועצים", one: "נועץ", oneF: "נועצת", both: "נועץ/ת", many: "נועצים" },
] as const;

export type ClientWord = (typeof CLIENT_WORDS)[number];
export type ClientWordId = ClientWord["id"];

export const DEFAULT_CLIENT_WORD: ClientWordId = "clients";

/** The stored value read back: a known word's id, or null (= "לקוחות"). */
export function cleanClientWord(v: unknown): ClientWordId | null {
  const found = CLIENT_WORDS.find((w) => w.id === v);
  return found && found.id !== DEFAULT_CLIENT_WORD ? found.id : null;
}

export function clientWord(v: unknown): ClientWord {
  return CLIENT_WORDS.find((w) => w.id === v) ?? CLIENT_WORDS[0];
}

/** Rewrites a text written with "לקוח" into the account's own word. */
export type Say = (text: string) => string;

/** Before a "לקוח…" that stays as written. An invisible character (word joiner), dropped from the text. */
export const AS_WRITTEN = "\u2060";

// לקוחות | לקוח/ה | לקוחה (a whole word, not the start of another) | לקוח
const FORMS = /(\u2060)?לקוח(ות|\/ה|ה(?![א-ת]))?/g;

const same: Say = (text) => (text.includes(AS_WRITTEN) ? text.replaceAll(AS_WRITTEN, "") : text);

export function wordingFor(v: unknown): Say {
  const w = clientWord(v);
  if (w.id === DEFAULT_CLIENT_WORD) return same;
  return (text) =>
    text.replace(FORMS, (all: string, kept?: string, ending?: string) =>
      kept
        ? all.slice(kept.length)
        : ending === "ות"
          ? w.many
          : ending === "/ה"
            ? w.both
            : ending === "ה"
              ? w.oneF
              : w.one,
    );
}

/** A form's field errors (zod's `flatten().fieldErrors`) in the account's word. */
export function sayErrors<T extends Record<string, string[] | undefined>>(say: Say, errors: T): T {
  const out: Record<string, string[] | undefined> = {};
  for (const [field, messages] of Object.entries(errors)) out[field] = messages?.map(say);
  return out as T;
}
