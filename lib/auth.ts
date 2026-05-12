const PIN_KEY = "tempo-pin-hash";

function bufToB64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

async function loadBiometric() {
  try {
    return await import("@aparajita/capacitor-biometric-auth");
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const mod = await loadBiometric();
    if (!mod) return false;
    const info = await mod.BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    const mod = await loadBiometric();
    if (!mod) return false;
    const info = await mod.BiometricAuth.checkBiometry();
    if (!info.isAvailable) return false;
    await mod.BiometricAuth.authenticate({
      reason: "Verify your identity to access solve history",
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      androidTitle: "Tempo",
      androidSubtitle: "Confirm fingerprint",
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false;
  }
}

// Native biometry has no app-side enrolment; success here just means
// "the user can authenticate", which is what the Settings flow needs.
export async function registerBiometric(): Promise<boolean> {
  return verifyBiometric();
}

export function hasBiometricCredential(): boolean {
  return true;
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
  localStorage.removeItem(PIN_KEY);
}

export function hasPin(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}
