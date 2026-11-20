---
name: agy-browser
description: Automates and controls the user's live Google Chrome browser via the AGY Browser Relay extension and server. Allows opening tabs, navigating, clicking, typing, taking screenshots, and extracting text/DOM using the Chrome DevTools Protocol (CDP).
---

# AGY Browser Automation Skill

This skill allows Antigravity (AGY) agents to interact directly with the user's active desktop Google Chrome session.

## Pre-requisites
1. **AGY Browser Relay Extension** installed in Chrome (`chrome://extensions`) and set to `Connected` (`ws://127.0.0.1:9223`).
2. **AGY Browser Server** running locally:
   ```bash
   curl http://127.0.0.1:9223/status
   ```
   If offline, start it with:
   ```bash
   nohup node /Users/xmahbub/code/nodejs/test/agy-browser-server/server.js > /tmp/agy_server.log 2>&1 &
   ```

## Control API & Commands

Send POST requests to `http://127.0.0.1:9223/cmd` with JSON payloads:

### 1. Check Connected Status & Tabs
```bash
curl http://127.0.0.1:9223/status
```

### 2. Create a Tab
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{"type": "createTab", "url": "https://example.com"}'
```

### 3. Attach Debugger
Always attach before sending CDP commands to a tab:
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{"type": "attach", "tabId": <TAB_ID>}'
```

### 4. Execute JavaScript / Read Content (CDP `Runtime.evaluate`)
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cdp",
    "tabId": <TAB_ID>,
    "method": "Runtime.evaluate",
    "params": {
      "expression": "document.title",
      "returnByValue": true
    }
  }'
```

### 5. Take Screenshot (CDP `Page.captureScreenshot`)
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cdp",
    "tabId": <TAB_ID>,
    "method": "Page.captureScreenshot",
    "params": {"format": "png"}
  }'
```

### 6. Upload a Local File (e.g. for Google Lens image search)
Use CDP `DOM.setFileInputFiles` after finding the file input's `nodeId`:
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cdp",
    "tabId": <TAB_ID>,
    "method": "DOM.setFileInputFiles",
    "params": {
      "nodeId": <FILE_INPUT_NODE_ID>,
      "files": ["/path/to/image.jpg"]
    }
  }'
```

### 7. Close a Tab
```bash
curl -X POST http://127.0.0.1:9223/cmd \
  -H "Content-Type: application/json" \
  -d '{"type": "closeTab", "tabId": <TAB_ID>}'
```
