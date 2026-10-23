# AltOffice desktop

This is a desktop client for the self-hosted web application, not an offline copy of the Euro-Office engine. Editing, account registration and collaboration use AltStack LLC's Railway services.

Run `npm ci` and `npm run dist -- --linux --arm64` (or the appropriate OS and architecture). Electron 44.9.2 and electron-builder 26.15.3 are pinned by the lockfile. Web content runs with Node integration disabled, context isolation and the Chromium sandbox enabled. External links and account approval open in your system browser. Downloads use a native save dialog.

Windows packages are portable ZIPs; macOS uses DMGs; Linux packages are TAR.GZ archives. Linux includes `install-linux.sh` for installation to the current user's account. These development builds have no commercial signing/notarization identity. Files and sessions are stored according to the web app and browser profile behavior; no offline editing or automatic desktop updates are claimed.
