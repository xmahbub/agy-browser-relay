import { WebSocket } from "ws";

const WS_URL = "ws://127.0.0.1:9223";

console.log(`Connecting test client to ${WS_URL}...`);
const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Connected to AGY Server!");
  // 1. Send auth
  ws.send(JSON.stringify({ type: "auth.init", token: "agy-secret" }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(String(data));
  console.log("Received from server:", msg);

  if (msg.type === "auth.ok") {
    console.log("Authentication acknowledged! Sending simulated hello...");
    ws.send(
      JSON.stringify({
        type: "hello",
        browserVersion: "Chrome/125.0.0.0",
        tabs: [
          { id: 101, url: "https://example.com", title: "Example Domain" },
        ],
      })
    );
  }

  if (msg.type === "attach") {
    console.log(`Simulating debugger attach to tab ${msg.tabId}...`);
    ws.send(
      JSON.stringify({
        type: "result",
        seq: msg.seq,
        result: { targetId: "target-dummy-123" },
      })
    );
  }

  if (msg.type === "cdp") {
    console.log(`Simulating CDP command ${msg.method} on tab ${msg.tabId}...`);
    ws.send(
      JSON.stringify({
        type: "result",
        seq: msg.seq,
        result: {
          mocked: true,
          method: msg.method,
          data: msg.method === "Page.captureScreenshot" ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" : null,
        },
      })
    );
  }
});
