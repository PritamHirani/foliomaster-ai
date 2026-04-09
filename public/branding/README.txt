Branding assets for web app.

Current behavior:
- Sidebar uses dark full logo only.
- Favicon symbol changes with theme (light/dark).
- PNG is preferred. SVG is used as fallback. Final fallback is `/logo.svg`.

Recommended files (PNG):
1. logo-full-dark.png
2. logo-symbol-light.png
3. logo-symbol-dark.png

Optional SVG fallbacks:
- logo-full-dark.svg
- logo-symbol-light.svg
- logo-symbol-dark.svg

Notes:
- Place all files in this `public/branding` folder.
- If `logo-symbol-light.*` is missing, dark symbol is used in light mode too.
