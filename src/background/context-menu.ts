import { apiClient } from "./api-client";
import { storage } from "../shared/utils/storage";
import type { VocabInput } from "../shared/types/vocab";
import type { LanguageFolderDto } from "../shared/types/vocab";
import type { IResponse } from "../shared/types/vocab";

export function setupContextMenu() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "add-to-vocab",
      title: "Add to Vocabulary",
      contexts: ["selection"],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "add-to-vocab" && info.selectionText) {
      try {
        const selectedText = info.selectionText;
        const folderId = await storage.get("activeFolderId");
        const subjectIds = (await storage.get("activeSubjectIds")) as
          | string[]
          | undefined;

        if (!folderId || !subjectIds || subjectIds.length === 0) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "⚠️ Configuration Required",
            message: "Please configure folder and subject in settings first",
          });
          return;
        }

        // Fetch folders from API to avoid stale cache
        const foldersResponse = await apiClient.get<
          IResponse<LanguageFolderDto>
        >("/language-folders/my");
        const folders = foldersResponse.items || [];
        const activeFolder = folders.find((f) => f.id === folderId);

        if (!activeFolder) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "❌ Folder Not Found",
            message:
              "Selected folder not found. Please reconfigure in settings",
          });
          return;
        }

        // Update cache with fresh data
        await storage.set("cachedFolders", folders);

        // Use languages from the active folder
        const vocabData: VocabInput = {
          textSource: selectedText,
          sourceLanguageCode: activeFolder.sourceLanguageCode,
          targetLanguageCode: activeFolder.targetLanguageCode,
          languageFolderId: folderId as string,
          textTargets: [
            {
              textTarget: "",
              grammar: "",
              explanationSource: "",
              explanationTarget: "",
              subjectIds: subjectIds,
            },
          ],
        };

        await apiClient.post("/vocabs", vocabData);

        const notificationId = await chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "✅ Vocabulary Added",
          message: `"${selectedText.substring(0, 50)}${
            selectedText.length > 50 ? "..." : ""
          }" has been saved to your vocabulary list`,
          requireInteraction: false,
          silent: false,
        });

        // Auto-close after 3 seconds
        setTimeout(() => {
          chrome.notifications.clear(notificationId);
        }, 3000);
      } catch (error) {
        console.error("Error saving vocab:", error);
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "❌ Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to save vocabulary",
        });
      }
    }
  });
}
