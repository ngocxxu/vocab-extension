import type { StorageData } from '../types/storage';
import { StorageError } from './errors';

function handleStorageError(
  operation: string,
  error?: chrome.runtime.LastError
): never {
  if (error) {
    const message = error.message || 'Unknown storage error';
    if (message.includes('QUOTA_BYTES') || message.includes('quota')) {
      throw new StorageError(
        `Storage quota exceeded. Please free up space and try again. Operation: ${operation}`
      );
    }
    throw new StorageError(
      `Storage operation failed: ${operation}. ${message}`
    );
  }
  throw new StorageError(`Storage operation failed: ${operation}`);
}

export const storage = {
  async get<T extends keyof StorageData>(
    key: T
  ): Promise<StorageData[T] | undefined> {
    try {
      const result = await chrome.storage.local.get([key]);
      if (chrome.runtime.lastError) {
        handleStorageError(`get(${String(key)})`, chrome.runtime.lastError);
      }
      return result[key];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to get storage key: ${String(key)}`,
        error instanceof Error ? error : undefined
      );
    }
  },

  async set<T extends keyof StorageData>(
    key: T,
    value: StorageData[T]
  ): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
      if (chrome.runtime.lastError) {
        handleStorageError(`set(${String(key)})`, chrome.runtime.lastError);
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to set storage key: ${String(key)}`,
        error instanceof Error ? error : undefined
      );
    }
  },

  async getAll(): Promise<StorageData> {
    try {
      const result = await chrome.storage.local.get(null);
      if (chrome.runtime.lastError) {
        handleStorageError('getAll()', chrome.runtime.lastError);
      }
      return result as StorageData;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        'Failed to get all storage data',
        error instanceof Error ? error : undefined
      );
    }
  },

  async remove(keys: (keyof StorageData)[]): Promise<void> {
    try {
      await chrome.storage.local.remove(keys);
      if (chrome.runtime.lastError) {
        handleStorageError(
          `remove(${keys.join(', ')})`,
          chrome.runtime.lastError
        );
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to remove storage keys: ${keys.join(', ')}`,
        error instanceof Error ? error : undefined
      );
    }
  },

  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      if (chrome.runtime.lastError) {
        handleStorageError('clear()', chrome.runtime.lastError);
      }
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        'Failed to clear storage',
        error instanceof Error ? error : undefined
      );
    }
  },

  onChanged: chrome.storage.onChanged,
};
