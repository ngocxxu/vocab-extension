chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.type === 'GET_SELECTION') {
    const selection = globalThis.getSelection();
    const selectedText = selection?.toString().trim() || '';

    sendResponse({ selectedText });
  }
});

document.addEventListener(
  'contextmenu',
  (event) => {
    (globalThis as unknown as { __vocabLastContextMenuTarget: EventTarget | null }).__vocabLastContextMenuTarget = event.target;
  },
  true
);
