import {
  VOCAB_COOLDOWN_STORAGE_PREFIX,
  VOCAB_CREATE_COOLDOWN_MS,
} from '../shared/constants';

function storageKey(userId: string): string {
  return `${VOCAB_COOLDOWN_STORAGE_PREFIX}${userId}`;
}

export async function getRemainingCooldownMs(userId: string): Promise<number> {
  const key = storageKey(userId);
  const result = await chrome.storage.local.get(key);
  const lastCreate = result[key] as number | undefined;

  if (!lastCreate) return 0;

  const remaining = VOCAB_CREATE_COOLDOWN_MS - (Date.now() - lastCreate);
  return remaining > 0 ? remaining : 0;
}

export async function recordSuccessfulCreate(userId: string): Promise<void> {
  const key = storageKey(userId);
  await chrome.storage.local.set({ [key]: Date.now() });
}

export function formatCooldownRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${totalSeconds}s`;
}
