import { WebSocketServer } from "ws";
import http from "node:http";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9223;

class AGYBrowserServer {
  constructor(port = PORT) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      // Basic HTTP status endpoint
      if (req.url === "/" || req.url === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "online",
            extensionConnected: Boolean(this.extensionSocket),
            tabs: this.tabs,
          })
        );
        return;
      }

      // HTTP Command Execution endpoint
      if (req.url === "/cmd" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            const result = await this.sendCommand(payload);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, result }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.extensionSocket = null;
    this.tabs = [];
    this.pendingCommands = new Map();
    this.seq = 1;

    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on("connection", (ws, req) => {
      console.log(`[AGY Server] Incoming connection from ${req.socket.remoteAddress}`);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(String(data));
          this.handleMessage(ws, message);
        } catch (err) {
          console.error("[AGY Server] Failed to parse message:", err);
        }
      });

      ws.on("close", () => {
        if (this.extensionSocket === ws) {
          console.log("[AGY Server] Extension disconnected");
          this.extensionSocket = null;
          this.tabs = [];
        }
      });

      ws.on("error", (err) => {
        console.error("[AGY Server] Socket error:", err);
      });
    });
  }

  handleMessage(ws, msg) {
    // 1. Initial auth from extension
    if (msg.type === "auth.init") {
      console.log("[AGY Server] Extension authenticated successfully");
      this.extensionSocket = ws;
      ws.send(JSON.stringify({ type: "auth.ok" }));
      return;
    }

    // 2. Hello packet from extension reporting version and accessible tabs
    if (msg.type === "hello") {
      console.log(`[AGY Server] Extension hello: ${msg.browserVersion}, tabs: ${msg.tabs?.length || 0}`);
      this.tabs = msg.tabs || [];
      return;
    }

    // 3. Tab inventory sync event from extension
    if (msg.type === "tabs") {
      this.tabs = msg.tabs || [];
      console.log(`[AGY Server] Tabs updated (${this.tabs.length} tabs)`);
      return;
    }

    // 4. Command replies (result / error) from extension
    if (msg.type === "result" || msg.type === "error") {
      const pending = this.pendingCommands.get(msg.seq);
      if (pending) {
        this.pendingCommands.delete(msg.seq);
        if (msg.type === "error") {
          pending.reject(new Error(msg.message || "Unknown extension error"));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    console.log("[AGY Server] Received message:", msg);
  }

  /**
   * Send a command to the connected Chrome extension.
   */
  sendCommand(payload) {
    return new Promise((resolve, reject) => {
      if (!this.extensionSocket || this.extensionSocket.readyState !== 1) {
        return reject(new Error("Chrome extension is not connected to AGY server."));
      }

      const seq = this.seq++;
      const message = { ...payload, seq };

      this.pendingCommands.set(seq, { resolve, reject });
      this.extensionSocket.send(JSON.stringify(message));

      // 30s timeout
      setTimeout(() => {
        if (this.pendingCommands.has(seq)) {
          this.pendingCommands.delete(seq);
          reject(new Error(`Command ${payload.type} (seq: ${seq}) timed out after 30s`));
        }
      }, 30000);
    });
  }

  // --- High-level Automation API ---

  async listTabs() {
    return this.tabs;
  }

  async attachTab(tabId) {
    console.log(`[AGY Server] Attaching debugger to tab ${tabId}...`);
    return await this.sendCommand({ type: "attach", tabId });
  }

  async detachTab(tabId) {
    console.log(`[AGY Server] Detaching debugger from tab ${tabId}...`);
    return await this.sendCommand({ type: "detach", tabId });
  }

  async createTab(url = "about:blank") {
    console.log(`[AGY Server] Creating new tab: ${url}...`);
    return await this.sendCommand({ type: "createTab", url });
  }

  async closeTab(tabId) {
    console.log(`[AGY Server] Closing tab ${tabId}...`);
    return await this.sendCommand({ type: "closeTab", tabId });
  }

  async activateTab(tabId) {
    console.log(`[AGY Server] Activating tab ${tabId}...`);
    return await this.sendCommand({ type: "activateTab", tabId });
  }

  /**
   * Send arbitrary Chrome DevTools Protocol (CDP) commands to an attached tab.
   * e.g. sendCDP(tabId, "Page.navigate", { url: "https://google.com" })
   */
  async sendCDP(tabId, method, params = {}) {
    return await this.sendCommand({
      type: "cdp",
      tabId,
      method,
      params,
    });
  }

  /**
   * Capture a screenshot of the specified tab.
   */
  async captureScreenshot(tabId, format = "png") {
    const result = await this.sendCDP(tabId, "Page.captureScreenshot", { format });
    return result.data; // Base64 encoded string
  }

  /**
   * Evaluate a JavaScript expression inside the tab.
   */
  async evaluate(tabId, expression) {
    const result = await this.sendCDP(tabId, "Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, "127.0.0.1", () => {
        console.log(`=======================================================`);
        console.log(`🚀 AGY Browser Server running on ws://127.0.0.1:${this.port}`);
        console.log(`🌐 HTTP status: http://127.0.0.1:${this.port}/status`);
        console.log(`=======================================================`);
        resolve();
      });
    });
  }
}

// Export server instance & class
export { AGYBrowserServer };

// If executed directly
if (process.argv[1].endsWith("server.js")) {
  const server = new AGYBrowserServer();
  await server.start();
}
