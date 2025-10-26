import { setupContextMenu } from "./context-menu";
import { storage } from "../shared/utils/storage";
import { apiClient } from "./api-client";
import { STORAGE_KEYS } from "../shared/constants";

setupContextMenu();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTED_TEXT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "GET_SELECTION" },
          (response) => {
            sendResponse(response);
          }
        );
      }
    });
    return true;
  }

  if (message.type === "SAVE_VOCAB") {
    const { selectedText, folderId, subjectId } = message;

    (async () => {
      try {
        const vocabData = {
          textSource: selectedText,
          sourceLanguageCode: "auto",
          targetLanguageCode: "auto",
          languageFolderId: folderId,
          textTargets: [
            {
              textTarget: "",
              grammar: "",
              explanationSource: "",
              explanationTarget: "",
              subjectIds: [subjectId],
            },
          ],
        };

        await apiClient.post("/vocabs", vocabData);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    })();

    return true;
  }
});

// Sync storage across contexts
storage.onChanged.addListener((changes, namespace) => {
  console.log("Storage changed:", changes, namespace);
});
