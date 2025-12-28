declare global {
  interface Window {
    __vocabLastContextMenuTarget?: EventTarget | null;
  }
}

export {};
