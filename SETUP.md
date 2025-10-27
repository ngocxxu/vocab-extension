# Vocab Extension - Setup Guide

## Overview

This Chrome extension allows users to save vocabulary from any webpage by highlighting text and right-clicking to add it to their vocabulary collection.

## Features

✅ **Context Menu Integration**: Right-click on highlighted text to add to vocabulary  
✅ **Authentication**: Secure JWT-based login system  
✅ **Folder Management**: Organize vocabulary by language folders (source → target)  
✅ **Subject Management**: Categorize vocabulary by subjects  
✅ **Auto-Setup**: Automatically creates default folder (en→vi) and subject on first login  
✅ **Modern UI**: Built with React + TailwindCSS

## Project Structure

```
vocab-extension/
├── src/
│   ├── background/        # Service worker for API calls
│   │   ├── api-client.ts
│   │   ├── token-manager.ts
│   │   ├── context-menu.ts
│   │   └── index.ts
│   ├── content/           # Content script for text selection
│   │   └── index.ts
│   ├── popup/             # Extension popup UI
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── Popup.tsx
│   ├── options/           # Settings page
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── Options.tsx
│   ├── shared/            # Shared utilities
│   │   ├── constants.ts
│   │   ├── types/
│   │   │   ├── api.ts
│   │   │   ├── vocab.ts
│   │   │   └── storage.ts
│   │   └── utils/
│   │       ├── storage.ts
│   │       └── utils.ts
│   └── styles/
│       └── globals.css
├── public/
│   └── icons/             # Extension icons
├── manifest.config.ts      # Chrome extension manifest
├── vite.config.ts
├── package.json
└── README.md
```

## Installation

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the Extension

```bash
pnpm build
```

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Configuration

### Backend API URL

Edit `src/shared/constants.ts` to change the API base URL:

```typescript
export const API_BASE_URL = "http://localhost:3002";
```

### Development

Start dev server with hot reload:

```bash
pnpm dev
```

## Usage

### First Time Setup

1. Click the extension icon
2. Click "Open Settings"
3. Login with your email and password
4. The extension will auto-create:
   - Default folder (en → vi)
   - Default subject
5. Save settings

### Adding Vocabulary

1. Browse any webpage
2. Highlight the text you want to save
3. Right-click and select "Add to Vocabulary"
4. The word is saved to your active folder and subject

### Managing Settings

**Folders**: Language folders define source → target language pairs

- Example: English → Vietnamese
- Includes folder name and color

**Subjects**: Categories for organizing vocabulary

- Example: "Business", "Technology", "Default"

## API Endpoints Required

The extension connects to your backend API. Ensure these endpoints are available:

- `POST /auth/signin` - User login
- `GET /auth/verify` - Verify JWT token
- `POST /auth/refresh` - Refresh JWT token
- `GET /language-folders/my` - Get user's folders
- `POST /language-folders` - Create folder
- `GET /subjects` - Get subjects
- `POST /subjects` - Create subject
- `GET /word-types` - Get word types
- `POST /vocabs` - Create vocabulary entry

## Technical Details

### Authentication Flow

1. User logs in via `/auth/signin`
2. Backend returns `accessToken` and `refreshToken`
3. Tokens stored in `chrome.storage.local`
4. All API requests include Bearer token
5. On 401 error, refresh token automatically
6. User logout clears all stored data

### Token Management

- Tokens stored securely in `chrome.storage.local`
- Automatic refresh on expiration
- Cross-context synchronization

### Context Menu Flow

1. User highlights text
2. Right-click shows "Add to Vocabulary"
3. Background script:
   - Gets selected text from active tab
   - Retrieves active folder/subject from storage
   - Calls `POST /vocabs` with vocab data
   - Shows notification on success/failure

### Storage Schema

```typescript
{
  accessToken?: string
  refreshToken?: string
  user?: UserDto
  activeFolderId?: string
  activeSubjectId?: string
  activeWordTypeId?: string
  cachedFolders?: LanguageFolderDto[]
  cachedSubjects?: SubjectDto[]
  cachedWordTypes?: WordTypeDto[]
}
```

## Troubleshooting

### Build Issues

```bash
# Clean build
rm -rf dist node_modules
pnpm install
pnpm build
```

### Icon Issues

The extension includes placeholder icons. Replace files in `public/icons/` with proper PNG files:

- icon16.png (16x16)
- icon32.png (32x32)
- icon48.png (48x48)
- icon128.png (128x128)

### API Connection Issues

1. Verify backend is running
2. Check CORS configuration on backend
3. Update `API_BASE_URL` in `src/shared/constants.ts`
4. Check browser console for errors

## Development

### Hot Reload

```bash
pnpm dev
```

Changes will auto-reload in the extension when you:

1. Make changes to source files
2. Click the extension icon to reload
3. Or manually reload in `chrome://extensions/`

### Debugging

- Popup: Right-click icon → "Inspect popup"
- Background: Right-click in extension → "Service worker"
- Options page: Right-click icon → "Inspect"
- Content script: DevTools on webpage

## Production Build

```bash
pnpm build
```

The `dist` folder contains the production-ready extension. Zip this folder for distribution.

## License

MIT
