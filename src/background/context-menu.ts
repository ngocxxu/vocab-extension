import { apiClient } from "./api-client";
import { storage } from "../shared/utils/storage";
import type { VocabInput } from "../shared/types/vocab";

export function setupContextMenu() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "add-to-vocab",
      title: "Add to Vocabulary",
      contexts: ["selection"],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "add-to-vocab" && info.selectionText) {
      try {
        const selectedText = info.selectionText;
        const folderId = await storage.get("activeFolderId");
        const subjectId = await storage.get("activeSubjectId");

        if (!folderId || !subjectId) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Vocab Manager",
            message: "Please configure folder and subject in settings first",
          });
          return;
        }

        // For now, create vocab with minimal data
        // User can edit in the web app if needed
        const vocabData: VocabInput = {
          textSource: selectedText,
          sourceLanguageCode: "auto",
          targetLanguageCode: "auto",
          languageFolderId: folderId as string,
          textTargets: [
            {
              textTarget: "",
              grammar: "",
              explanationSource: "",
              explanationTarget: "",
              subjectIds: [subjectId as string],
            },
          ],
        };

        await apiClient.post("/vocabs", vocabData);

        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "Vocab Saved",
          message: `"${selectedText.substring(0, 50)}${
            selectedText.length > 50 ? "..." : ""
          }" added to vocabulary`,
        });
      } catch (error) {
        console.error("Error saving vocab:", error);
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to save vocabulary",
        });
      }
    }
  });
}
