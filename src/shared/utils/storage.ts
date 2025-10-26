import type { StorageData } from "../types/storage";

export const storage = {
  async get<T extends keyof StorageData>(
    key: T
  ): Promise<StorageData[T] | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key];
  },

  async set<T extends keyof StorageData>(
    key: T,
    value: StorageData[T]
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async getAll(): Promise<StorageData> {
    return (await chrome.storage.local.get(null)) as StorageData;
  },

  async remove(keys: (keyof StorageData)[]): Promise<void> {
    await chrome.storage.local.remove(keys);
  },

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },

  onChanged: chrome.storage.onChanged,
};
