# AGY Browser Relay

A high-performance Chrome Extension and local WebSocket relay server that connects your active desktop Chrome session to **AGY (Google Antigravity)** AI agents via the Chrome DevTools Protocol (CDP).

With this suite, AGY agents can automate, inspect, click, type, upload files (like Google Lens visual search), and capture screenshots in real Chrome tabs.

---

## Architecture

```
┌─────────────────────────────────┐
│        Google Chrome            │
│   ┌─────────────────────────┐   │
│   │   AGY Browser Relay     │   │
│   │   (Chrome Extension)    │   │
│   └────────────┬────────────┘   │
└────────────────┼────────────────┘
                 │ WebSocket (ws://127.0.0.1:9223)
                 ▼
┌─────────────────────────────────┐
│     AGY Browser Server          │
│   (Node.js CDP Controller)      │
│   • HTTP API (:9223/cmd)        │
│   • Status (:9223/status)       │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Antigravity (AGY)         │
│     Agent / AI Automations      │
└─────────────────────────────────┘
```

---

## Repository Structure

```
├── agy-browser-extension/       # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension declaration and permissions
│   ├── background.js            # Service worker handling relay & tabs
│   ├── popup.html / popup.js    # Extension popup interface
│   ├── options.html / options.js# Settings & pairing interface
│   ├── modules/                 # CDP debugger and tab management
│   └── icons/                   # Custom AGY pixel icons (16, 32, 48, 128)
├── agy-browser-server/          # Node.js WebSocket & HTTP relay daemon
│   ├── package.json
│   ├── server.js                # Core controller server
│   └── test-client.js           # Test mock client
├── skills/                      # AGY Skill definition
│   └── agy-browser/
│       └── SKILL.md             # Antigravity skill instructions
├── search-google.js             # Example text search script
└── README.md
```

---

## Quick Start & Installation

### 1. Start the Relay Server

```bash
cd agy-browser-server
npm install
npm start
```

*Or run in background:*
```bash
nohup node agy-browser-server/server.js > /tmp/agy_server.log 2>&1 &
```

Verify that the server is online:
```bash
curl http://127.0.0.1:9223/status
# Returns: {"status":"online","extensionConnected":false,"tabs":[]}
```

---

### 2. Install the Chrome Extension

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right.
3. Click **Load unpacked** (top left).
4. Select the `agy-browser-extension` directory from this repository.
5. Click the AGY extension icon or right-click ➔ **Options**.
6. Under **Server Pairing**, confirm `ws://127.0.0.1:9223` and click **Connect / Pair**.
7. The extension badge will turn green (**`ON`**).

---

### 3. Install the AGY Skill for Antigravity

To let any AGY agent use this browser capability automatically:

```bash
mkdir -p ~/.gemini/config/skills/agy-browser
cp skills/agy-browser/SKILL.md ~/.gemini/config/skills/agy-browser/
```

Antigravity will automatically discover the `agy-browser` skill.

---

## Automating via Scripts or API

### Opening a Tab & Searching Google
```javascript
// POST http://127.0.0.1:9223/cmd
const res = await fetch("http://127.0.0.1:9223/cmd", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "createTab",
    url: "https://www.google.com"
  })
});
const { result } = await res.json();
console.log("Opened Tab ID:", result.tabId);
```

### Sending CDP Commands
```javascript
// Attach debugger
await fetch("http://127.0.0.1:9223/cmd", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "attach", tabId: result.tabId })
});

// Capture Screenshot
const screenshotRes = await fetch("http://127.0.0.1:9223/cmd", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "cdp",
    tabId: result.tabId,
    method: "Page.captureScreenshot",
    params: { format: "png" }
  })
});
```

---

## License
MIT
