const CRED_KEY = "tempo-cred-id";
const PIN_KEY = "tempo-pin-hash";

function bufToB64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i);
  return buf;
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const PKC = (window as unknown as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential;
    if (!PKC?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric(): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Tempo" },
        user: { id: userId, name: "tempo-user", displayName: "Tempo" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          userVerification: "required",
          authenticatorAttachment: "platform",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, bufToB64(new Uint8Array(cred.rawId)));
    return true;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    const idB64 = localStorage.getItem(CRED_KEY);
    if (!idB64) return false;
    const id = b64ToBuf(idB64);
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}

async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin + "::tempo");
  const h = await crypto.subtle.digest("SHA-256", buf);
  return bufToB64(new Uint8Array(h));
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

export function clearAuth(): void {
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(PIN_KEY);
}

export function hasPin(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}

export function hasBiometricCredential(): boolean {
  return !!localStorage.getItem(CRED_KEY);
}
