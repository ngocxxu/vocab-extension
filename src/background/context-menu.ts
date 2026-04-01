import { apiClient } from './api-client';
import { storage } from '../shared/utils/storage';
import type { VocabInput } from '../shared/types/vocab';
import type { LanguageFolderDto } from '../shared/types/vocab';
import type { IResponse } from '../shared/types/vocab';
import {
  validateSelectedText,
  ValidationError,
} from '../shared/utils/validation';
import {
  formatCooldownRemaining,
  getRemainingCooldownMs,
  recordSuccessfulCreate,
} from './vocab-create-cooldown';

const ADD_TO_VOCAB_MENU_ID = 'add-to-vocab';

function syncAddToVocabMenuTitle(remainingMs: number): void {
  chrome.contextMenus.update(
    ADD_TO_VOCAB_MENU_ID,
    {
      title:
        remainingMs > 0
          ? `Add to Vocabulary (wait ${formatCooldownRemaining(remainingMs)})`
          : 'Add to Vocabulary',
    },
    () => {
      if (chrome.runtime.lastError) {
        console.warn(
          'syncAddToVocabMenuTitle:',
          chrome.runtime.lastError.message
        );
      }
    }
  );
}

export function setupContextMenu() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: ADD_TO_VOCAB_MENU_ID,
      title: 'Add to Vocabulary',
      contexts: ['selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === ADD_TO_VOCAB_MENU_ID && info.selectionText) {
      try {
        const selectedText = info.selectionText;
        validateSelectedText(selectedText);

        const user = await storage.get('user');

        if (!user) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⚠️ Login Required',
            message: 'Please login first to add vocabulary',
          });
          return;
        }

        const remainingMs = await getRemainingCooldownMs(user.id);
        syncAddToVocabMenuTitle(remainingMs);

        const folderKey = `activeFolderId_${user.id}`;
        const subjectIdsKey = `activeSubjectIds_${user.id}`;
        const result = await chrome.storage.local.get([
          folderKey,
          subjectIdsKey,
        ]);

        if (chrome.runtime.lastError) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⚠️ Storage Error',
            message: 'Unable to read settings. Please check storage space.',
          });
          return;
        }

        const folderId = result[folderKey];
        const subjectIds = result[subjectIdsKey] as string[] | undefined;

        if (!folderId || !subjectIds || subjectIds.length === 0) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⚠️ Configuration Required',
            message: 'Please configure folder and subject in settings first',
          });
          return;
        }

        if (remainingMs > 0) {
          chrome.notifications.create(`vocab-cooldown-${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⏳ Please wait',
            message: `You can add another word in ${formatCooldownRemaining(remainingMs)}.`,
          });
          return;
        }

        // Fetch folders from API to avoid stale cache
        const foldersResponse = await apiClient.get<
          IResponse<LanguageFolderDto>
        >('/language-folders/my');
        const folders = foldersResponse.items || [];
        const activeFolder = folders.find((f) => f.id === folderId);

        if (!activeFolder) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '❌ Folder Not Found',
            message:
              'Selected folder not found. Please reconfigure in settings',
          });
          return;
        }

        // Update cache with fresh data
        await storage.set('cachedFolders', folders);

        // Use languages from the active folder
        const vocabData: VocabInput = {
          textSource: selectedText,
          sourceLanguageCode: activeFolder.sourceLanguageCode,
          targetLanguageCode: activeFolder.targetLanguageCode,
          languageFolderId: folderId as string,
          textTargets: [
            {
              textTarget: '',
              grammar: '',
              explanationSource: '',
              explanationTarget: '',
              subjectIds: subjectIds,
            },
          ],
        };

        await apiClient.post('/vocabs', vocabData);
        await recordSuccessfulCreate(user.id);
        const remainingAfter = await getRemainingCooldownMs(user.id);
        syncAddToVocabMenuTitle(remainingAfter);

        try {
          const notificationId = await chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '✅ Vocabulary Added',
            message: `"${selectedText.substring(0, 50)}${
              selectedText.length > 50 ? '...' : ''
            }" has been saved to your vocabulary list`,
            requireInteraction: false,
            silent: false,
          });

          if (chrome.runtime.lastError) {
            console.error(
              'Error creating notification:',
              chrome.runtime.lastError
            );
          } else {
            setTimeout(() => {
              chrome.notifications.clear(notificationId).catch((err) => {
                console.error('Error clearing notification:', err);
              });
            }, 3000);
          }
        } catch (notificationError) {
          console.error('Failed to create notification:', notificationError);
        }
      } catch (error) {
        console.error('Error saving vocab:', error);

        let errorMessage = 'Failed to save vocabulary';
        if (error instanceof ValidationError) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          if (
            error.message.includes('Session expired') ||
            error.message.includes('401')
          ) {
            errorMessage = 'Session expired. Please login again.';
          } else if (
            error.message.includes('timeout') ||
            error.message.includes('Timeout')
          ) {
            errorMessage = 'Request timed out. Please try again.';
          } else if (
            error.message.includes('Network') ||
            error.message.includes('network')
          ) {
            errorMessage = 'Network error. Please check your connection.';
          } else {
            errorMessage = error.message;
          }
        }

        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '❌ Error',
            message: errorMessage,
          });
        } catch (notificationError) {
          console.error(
            'Failed to create error notification:',
            notificationError
          );
        }
      }
    }
  });
}
