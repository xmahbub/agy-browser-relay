// AGY WebSocket connection handler.
// Connects directly to the AGY Relay Server.

export function openAuthenticatedRelaySocket({
  relayUrl,
  token,
  isCurrent,
  onAuthenticated,
  onApplicationMessage,
  onAuthenticationFailure,
  onClose,
}) {
  const ws = new WebSocket(relayUrl);
  let authenticated = false;

  ws.addEventListener("open", () => {
    void (async () => {
      try {
        if (!isCurrent(ws)) {
          ws.close();
          return;
        }
        // Send initial auth/hello handshake
        ws.send(JSON.stringify({ type: "auth.init", token: token || "agy-secret" }));
      } catch (error) {
        onAuthenticationFailure(ws, error);
      }
    })();
  });

  let messageChain = Promise.resolve();
  ws.addEventListener("message", (event) => {
    messageChain = messageChain.then(async () => {
      try {
        if (!isCurrent(ws)) {
          return;
        }
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (!authenticated) {
          if (message.type === "auth.ok") {
            authenticated = true;
            await onAuthenticated(ws);
            return;
          }
          if (message.type === "auth.error") {
            throw new Error(message.message || "Auth error");
          }
        }

        onApplicationMessage(ws, message);
      } catch (error) {
        onAuthenticationFailure(ws, error);
      }
    });
  });

  ws.addEventListener("close", () => onClose(ws, authenticated));
  return ws;
}
