#!/bin/bash
set -e

echo "=================================================="
echo "🚀 AGY Browser Relay - 1-Click Installer"
echo "=================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed. Please install Node.js (v18+) first."
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"

echo "📦 1/3: Installing Server Dependencies..."
cd "$PROJECT_DIR/agy-browser-server"
npm install --silent

echo "⚙️ 2/3: Configuring Antigravity Skill..."
SKILL_TARGET_DIR="$HOME/.gemini/config/skills/agy-browser"
mkdir -p "$SKILL_TARGET_DIR"
cp "$PROJECT_DIR/skills/agy-browser/SKILL.md" "$SKILL_TARGET_DIR/SKILL.md"

echo "🔄 3/3: Setting up macOS Auto-Start Service (launchd)..."
PLIST_FILE="$HOME/Library/LaunchAgents/ai.agy.browser.server.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat <<EOF > "$PLIST_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.agy.browser.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$PROJECT_DIR/agy-browser-server/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR/agy-browser-server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.gemini/agy-browser-server.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.gemini/agy-browser-server.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo ""
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo "Next steps in Google Chrome:"
echo "1. Go to chrome://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked' and select:"
echo "   $PROJECT_DIR/agy-browser-extension"
echo "4. Open the extension and click 'Connect / Pair'!"
echo ""
echo "Server status:"
curl -s http://127.0.0.1:9223/status || echo "Starting..."
echo ""
