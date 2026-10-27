export interface Settings {
  maxFaces: number;
  recordSound: boolean;
  allowExport: boolean;
  quality: 'high' | 'saver';
  cpuOnly: boolean;
  pinHash: string | null;
  pinSalt: string | null;
}

const KEY = 'snaplens.settings';

const DEFAULTS: Settings = {
  maxFaces: 2,
  recordSound: true,
  allowExport: true,
  quality: 'high',
  cpuOnly: false,
  pinHash: null,
  pinSalt: null,
};

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function setPin(s: Settings, pin: string) {
  s.pinSalt = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  s.pinHash = await sha(s.pinSalt + pin);
  saveSettings(s);
}

export async function checkPin(s: Settings, pin: string) {
  if (!s.pinHash || !s.pinSalt) return false;
  return (await sha(s.pinSalt + pin)) === s.pinHash;
}
