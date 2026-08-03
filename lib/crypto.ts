const KEY_STORAGE = "tempo-crypto-key";

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(KEY_STORAGE);
  if (existing) {
    const jwk = JSON.parse(existing) as JsonWebKey;
    return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(KEY_STORAGE, JSON.stringify(jwk));
  return key;
}

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

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function encryptJson(obj: unknown): Promise<{ iv: string; ct: string }> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: bufToB64(iv), ct: bufToB64(new Uint8Array(ctBuf)) };
}

export async function decryptJson<T>(payload: { iv: string; ct: string }): Promise<T> {
  const key = await getOrCreateKey();
  const iv = b64ToBuf(payload.iv);
  const ct = b64ToBuf(payload.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(plain)) as T;
}

export function hasStoredKey(): boolean {
  return !!localStorage.getItem(KEY_STORAGE);
}

/**
 * Round-trip a probe payload through the real encryption key. AES-GCM fails
 * loudly on any corruption, so this proves the stored key is intact and can
 * decrypt every record that exists on this device.
 */
export async function cryptoSelfTest(): Promise<boolean> {
  try {
    const probe = { tempo: true, probe: "self-test" };
    const { iv, ct } = await encryptJson(probe);
    const round = await decryptJson<typeof probe>({ iv, ct });
    return round?.tempo === true && round?.probe === "self-test";
  } catch {
    return false;
  }
}
