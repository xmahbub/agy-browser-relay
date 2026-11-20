import { AGYBrowserServer } from "./agy-browser-server/server.js";

async function run() {
  console.log("Checking AGY Browser status...");
  const res = await fetch("http://127.0.0.1:9223/status");
  const data = await res.json();
  console.log("Server status:", data);

  if (!data.extensionConnected) {
    console.error("Extension is not connected!");
    process.exit(1);
  }

  // Send createTab command via the /cmd endpoint
  console.log("Creating new tab navigating to https://www.google.com ...");
  const createRes = await fetch("http://127.0.0.1:9223/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "createTab",
      url: "https://www.google.com"
    })
  });
  const createData = await createRes.json();
  console.log("Create tab response:", createData);

  const tabId = createData.result?.tabId || createData.result?.tab?.id;
  console.log(`Target tabId: ${tabId}`);

  // Wait 3 seconds for Google to load
  await new Promise(r => setTimeout(r, 3000));

  // Attach debugger
  console.log(`Attaching debugger to tab ${tabId}...`);
  const attachRes = await fetch("http://127.0.0.1:9223/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "attach",
      tabId
    })
  });
  console.log("Attach response:", await attachRes.json());

  // Type search query into Google and press Enter via evaluate
  console.log("Typing 'Antigravity AI' into Google search box...");
  const evalRes = await fetch("http://127.0.0.1:9223/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "cdp",
      tabId,
      method: "Runtime.evaluate",
      params: {
        expression: `
          (function() {
            const input = document.querySelector('textarea[name="q"], input[name="q"]');
            if (input) {
              input.value = "Antigravity AI";
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const form = input.closest('form');
              if (form) {
                form.submit();
                return "Searched and submitted form successfully!";
              }
              return "Set input value to Antigravity AI";
            }
            return "Search input not found: " + document.title;
          })()
        `,
        returnByValue: true
      }
    })
  });
  const evalData = await evalRes.json();
  console.log("Search evaluation response:", evalData);

  // Wait 3 seconds for search results to load
  await new Promise(r => setTimeout(r, 3000));

  // Get Page Title and first search result title
  const resultRes = await fetch("http://127.0.0.1:9223/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "cdp",
      tabId,
      method: "Runtime.evaluate",
      params: {
        expression: `
          ({
            title: document.title,
            firstResult: document.querySelector('h3')?.innerText || "No h3 found",
            url: window.location.href
          })
        `,
        returnByValue: true
      }
    })
  });
  console.log("Page details after search:", await resultRes.json());
}

run().catch(console.error);
