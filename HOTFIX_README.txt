DOTCO CARDS CRITICAL HOTFIX

Fixes:
- Design tab and editor controls not responding
- Templates not rendering or applying
- Preview/editor links appearing dead
- Agency upgrade button failing

Root cause:
A shared titleCase() helper was missing from js/common.js. The resulting JavaScript error stopped page initialization before event listeners were attached.

Upload all files and folders in this patch to the ROOT of the GitHub repository and replace existing files.
Commit message: Fix editor initialization and Agency upgrade
After GitHub Pages redeploys, press Ctrl+Shift+R.
