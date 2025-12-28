import { setupContextMenu } from './context-menu';
import { storage } from '../shared/utils/storage';
import { apiClient } from './api-client';
import type { LanguageFolderDto } from '../shared/types/vocab';

setupContextMenu();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !message.type) {
    sendResponse({ success: false, error: 'Invalid message format' });
    return false;
  }

  if (message.type === 'GET_SELECTED_TEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_SELECTION' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }
            sendResponse(response);
          }
        );
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }

  if (message.type === 'SAVE_VOCAB') {
    if (
      !message.selectedText ||
      !message.folderId ||
      !message.subjectId ||
      typeof message.selectedText !== 'string' ||
      typeof message.folderId !== 'string' ||
      typeof message.subjectId !== 'string'
    ) {
      sendResponse({
        success: false,
        error:
          'Invalid message: selectedText, folderId, and subjectId are required',
      });
      return false;
    }

    const { selectedText, folderId, subjectId } = message;

    (async () => {
      try {
        const folders = await storage.get('cachedFolders');
        const activeFolder = folders?.find(
          (f: LanguageFolderDto) => f.id === folderId
        );

        const vocabData = {
          textSource: selectedText,
          sourceLanguageCode: activeFolder?.sourceLanguageCode || 'auto',
          targetLanguageCode: activeFolder?.targetLanguageCode || 'auto',
          languageFolderId: folderId,
          textTargets: [
            {
              textTarget: '',
              grammar: '',
              explanationSource: '',
              explanationTarget: '',
              subjectIds: [subjectId],
            },
          ],
        };

        await apiClient.post('/vocabs', vocabData);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();

    return true;
  }
});

// Sync storage across contexts
storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes, namespace);
});
