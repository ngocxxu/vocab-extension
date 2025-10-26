# Vocab Extension - Quick Start

## Installation

1. Build the extension:
   ```bash
   pnpm build
   ```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## First Time Setup

1. Click the extension icon
2. Click "Open Settings"
3. Login with your email and password
4. The extension will auto-create a default folder (en→vi) and subject
5. Save settings

## Usage

1. Browse any webpage
2. Highlight the text you want to save
3. Right-click → "Add to Vocabulary"
4. Done!

## Configuration

### Backend URL

Edit `src/shared/constants.ts` to change the API URL:

```typescript
export const API_BASE_URL = "http://localhost:3000";
```

### Managing Folders & Subjects

1. Click extension icon → "Open Settings"
2. Go to "Folders" or "Subjects" tab
3. Create new items or select existing ones
4. Click "Save Settings"

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Troubleshooting

### Extension Won't Load

- Make sure you're loading the `dist` folder, not the project root
- Check for errors in the browser console

### Icons Not Showing

The extension comes with basic green square icons. To replace them:

1. Create PNG images (16, 32, 48, 128px)
2. Place in `public/icons/`
3. Rebuild: `pnpm build`

See `ICONS.md` for more details.

### API Errors

- Verify backend is running
- Check CORS configuration on backend
- Verify API URL in `src/shared/constants.ts`
- Check browser console for errors
