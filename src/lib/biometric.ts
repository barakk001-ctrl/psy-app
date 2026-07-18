// Client-side helpers for the Face ID / Touch ID app lock (WebAuthn platform
// authenticator). The lock is per-device: the credential id lives in
// localStorage and unlocking is required once per app session. Signing out
// clears the lock, so the account password is always the fallback.

export const BIO_ENABLED_KEY = "bioLock.enabled";
export const BIO_CREDENTIAL_KEY = "bioLock.credentialId";
export const BIO_UNLOCKED_KEY = "bioLock.unlocked";

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function isBioLockEnabled(): boolean {
  try {
    return (
      localStorage.getItem(BIO_ENABLED_KEY) === "1" &&
      !!localStorage.getItem(BIO_CREDENTIAL_KEY)
    );
  } catch {
    return false;
  }
}

export function isUnlockedThisSession(): boolean {
  try {
    return sessionStorage.getItem(BIO_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(BIO_UNLOCKED_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearBioLock(): void {
  try {
    localStorage.removeItem(BIO_ENABLED_KEY);
    localStorage.removeItem(BIO_CREDENTIAL_KEY);
    sessionStorage.removeItem(BIO_UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Registers a platform (Face ID / Touch ID) credential and stores its id. */
export async function registerBioLock(user: {
  email: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "מרפאה", id: window.location.hostname },
        user: {
          id: randomBytes(16),
          name: user.email,
          displayName: user.name,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return { ok: false, error: "הרישום בוטל" };

    localStorage.setItem(BIO_CREDENTIAL_KEY, toBase64Url(credential.rawId));
    localStorage.setItem(BIO_ENABLED_KEY, "1");
    markUnlocked();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "הרישום נכשל",
    };
  }
}

/** Prompts Face ID / Touch ID against the stored credential. */
export async function verifyBioLock(): Promise<boolean> {
  try {
    const storedId = localStorage.getItem(BIO_CREDENTIAL_KEY);
    if (!storedId) return false;

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: fromBase64Url(storedId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
