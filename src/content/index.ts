chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_SELECTION") {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";

    sendResponse({ selectedText });
  }
});

// Listen for context menu click (if needed)
document.addEventListener(
  "contextmenu",
  (event) => {
    // Store last clicked position for context menu
    (window as any).__vocabLastContextMenuTarget = event.target;
  },
  true
);
