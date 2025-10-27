# Extension Icons

## Current Status

The extension now includes proper icons with a blue-to-purple gradient design featuring a white "V" letter, matching the Vocabulary app branding.

## Icons

The extension uses PNG icons located in `public/icons/`:

- `public/icons/icon16.png` - 16x16 pixels
- `public/icons/icon32.png` - 32x32 pixels
- `public/icons/icon48.png` - 48x48 pixels
- `public/icons/icon128.png` - 128x128 pixels

3. Rebuild the extension:
   ```bash
   pnpm build
   ```

## Quick Icon Generation

You can use online tools like:

- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://favicon.io/

Or create them manually with image editing software like:

- GIMP (free)
- Photoshop
- Figma
- Canva

## Manual Creation

If you have ImageMagick installed:

```bash
# Create a simple colored square icon
convert -size 128x128 xc:#4CAF50 -gravity center -pointsize 72 -fill white \
  -annotate +0+0 "V" public/icons/icon128.png

# Resize to other sizes
convert public/icons/icon128.png -resize 48x48 public/icons/icon48.png
convert public/icons/icon128.png -resize 32x32 public/icons/icon32.png
convert public/icons/icon128.png -resize 16x16 public/icons/icon16.png
```

## Temporary Solution

The extension will work fine without custom icons. Chrome will use a default icon instead.
