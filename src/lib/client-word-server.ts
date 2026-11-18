import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { wordingFor, type Say } from "@/lib/client-word";

/** The stored word of one account (null = "לקוחות"). Once per request. */
export const getClientWord = cache(async (userId: string): Promise<string | null> => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { clientWord: true } });
  return user?.clientWord ?? null;
});

/** `say` for a known account: server actions, route handlers, exports. */
export async function sayFor(userId: string): Promise<Say> {
  return wordingFor(await getClientWord(userId));
}

/** One text in the account's word: `{ error: await sayTo(userId, "לקוח לא נמצא") }`. */
export async function sayTo(userId: string, text: string): Promise<string> {
  return (await sayFor(userId))(text);
}

/**
 * `say` for the signed-in account (src/lib/client-word.ts): pages, layouts and
 * `generateMetadata`. Signed out, texts stay as written.
 */
export async function getSay(): Promise<Say> {
  const session = await auth();
  return session?.user?.id ? sayFor(session.user.id) : wordingFor(null);
}
