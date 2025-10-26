# Vocab Extension

A Chrome extension for saving vocabulary from any webpage with a right-click.

## Features

- **Context Menu Integration**: Highlight text on any webpage and right-click to add it to your vocabulary
- **Authentication**: Secure login with JWT tokens stored locally
- **Folder Management**: Organize vocabulary by language folders
- **Subject Management**: Categorize vocabulary by subjects
- **Auto-Configuration**: Creates default folder and subject on first setup

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Build the extension:

```bash
pnpm build
```

3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## Development

```bash
pnpm dev
```

This will start the Vite dev server and watch for changes.

## Configuration

1. Click the extension icon to open the popup
2. Click "Open Settings" to configure your folders and subjects
3. Login with your credentials
4. Create or select a folder and subject
5. Start saving vocabulary!

## Usage

1. Highlight any text on a webpage
2. Right-click and select "Add to Vocabulary"
3. The word is automatically saved to your configured folder and subject

## API Endpoints

The extension connects to a backend API. Configure the base URL in `src/shared/constants.ts`:

```typescript
export const API_BASE_URL = "http://localhost:3000";
```

### Required Backend Endpoints

- `POST /auth/signin` - Login
- `GET /auth/verify` - Verify token
- `POST /auth/refresh` - Refresh token
- `GET /language-folders/my` - Get user folders
- `POST /language-folders` - Create folder
- `GET /subjects` - Get subjects
- `POST /subjects` - Create subject
- `GET /word-types` - Get word types
- `POST /vocabs` - Create vocabulary

## Tech Stack

- React 18
- TypeScript
- CRXJS (Vite plugin for Chrome extensions)
- TailwindCSS
- pnpm

## Project Structure

```
src/
├── background/     # Service worker for API calls and context menu
├── content/        # Content script for text selection
├── popup/          # Popup UI
├── options/        # Settings page
├── shared/         # Shared utilities and types
└── components/     # Reusable UI components
```

## License

MIT
