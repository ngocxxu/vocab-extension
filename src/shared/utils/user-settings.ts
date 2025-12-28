import { StorageError } from './errors';

export function getUserSettingsKey(userId: string, key: string): string {
  return `${key}_${userId}`;
}

export async function loadUserSettings(userId: string): Promise<{
  folderId: string;
  subjectIds: string[];
}> {
  const folderKey = getUserSettingsKey(userId, 'activeFolderId');
  const subjectIdsKey = getUserSettingsKey(userId, 'activeSubjectIds');
  const legacySubjectIdKey = getUserSettingsKey(userId, 'activeSubjectId');

  try {
    const result = await chrome.storage.local.get([
      folderKey,
      subjectIdsKey,
      legacySubjectIdKey,
    ]);

    if (chrome.runtime.lastError) {
      throw new StorageError(
        `Failed to load user settings: ${chrome.runtime.lastError.message}`,
        chrome.runtime.lastError as Error
      );
    }

    const folderId = result[folderKey] || '';
    const subjectIds = result[subjectIdsKey];
    const legacySubjectId = result[legacySubjectIdKey];

    if (subjectIds && Array.isArray(subjectIds)) {
      return { folderId, subjectIds };
    } else if (legacySubjectId) {
      try {
        await chrome.storage.local.set({ [subjectIdsKey]: [legacySubjectId] });
        await chrome.storage.local.remove(legacySubjectIdKey);

        if (chrome.runtime.lastError) {
          console.error(
            'Error migrating legacy subject ID:',
            chrome.runtime.lastError
          );
        }
      } catch (err) {
        console.error('Error migrating legacy subject ID:', err);
      }
      return { folderId, subjectIds: [legacySubjectId] };
    } else {
      return { folderId, subjectIds: [] };
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      'Failed to load user settings',
      error instanceof Error ? error : undefined
    );
  }
}

export async function saveUserSettings(
  userId: string,
  folderId: string,
  subjectIds: string[]
): Promise<void> {
  const folderKey = getUserSettingsKey(userId, 'activeFolderId');
  const subjectIdsKey = getUserSettingsKey(userId, 'activeSubjectIds');

  try {
    await chrome.storage.local.set({
      [folderKey]: folderId,
      [subjectIdsKey]: subjectIds,
    });

    if (chrome.runtime.lastError) {
      const errorMessage = chrome.runtime.lastError.message;
      if (
        errorMessage?.includes('QUOTA_BYTES') ||
        errorMessage?.includes('quota')
      ) {
        await cleanupOldUserSettings(userId);

        try {
          await chrome.storage.local.set({
            [folderKey]: folderId,
            [subjectIdsKey]: subjectIds,
          });

          if (chrome.runtime.lastError) {
            throw new StorageError(
              'Storage quota exceeded. Unable to save settings.'
            );
          }
        } catch {
          throw new StorageError('Unable to save settings. Storage is full.');
        }
      } else {
        throw new StorageError(errorMessage || 'Failed to save settings');
      }
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      'Failed to save settings',
      error instanceof Error ? error : undefined
    );
  }
}

export async function cleanupOldUserSettings(
  currentUserId: string
): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null);
    if (chrome.runtime.lastError) {
      console.error(
        'Error getting all storage data:',
        chrome.runtime.lastError
      );
      return;
    }

    const userSettingsKeys: string[] = [];

    for (const key in allData) {
      if (
        key.startsWith('activeFolderId_') ||
        key.startsWith('activeSubjectIds_')
      ) {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const userId = parts.slice(1).join('_');
          if (userId && userId !== currentUserId) {
            userSettingsKeys.push(key);
          }
        }
      }
    }

    if (userSettingsKeys.length > 0) {
      await chrome.storage.local.remove(userSettingsKeys);
      if (chrome.runtime.lastError) {
        console.error(
          'Error cleaning up old user settings:',
          chrome.runtime.lastError
        );
      }
    }
  } catch (error) {
    console.error('Error cleaning up old user settings:', error);
  }
}
