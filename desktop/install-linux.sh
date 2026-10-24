#!/bin/sh
set -eu
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET="$HOME/.local/opt/amerika-office"
mkdir -p "$TARGET" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/512x512/apps"
cp -R "$SOURCE"/. "$TARGET"/
chmod +x "$TARGET/amerika-office"
cp "$TARGET/resources/icon.png" "$HOME/.local/share/icons/hicolor/512x512/apps/amerika-office.png"
cat > "$HOME/.local/share/applications/amerika-office.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AltOffice
Comment=AltStack LLC collaborative office
Exec="$TARGET/amerika-office"
Icon=amerika-office
Terminal=false
Categories=Office;
StartupWMClass=amerika-office
EOF
printf '%s\n' 'AltOffice installed. Open it from your application launcher.'
