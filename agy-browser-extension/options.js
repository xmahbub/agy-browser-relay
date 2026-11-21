const connectionStatus = document.getElementById("connectionStatus");
const bootstrapStatus = document.getElementById("bootstrapStatus");
const automaticSetup = document.getElementById("automaticSetup");
const accessMode = document.getElementById("accessMode");
const pairingString = document.getElementById("pairingString");
const pair = document.getElementById("pair");
const useLocal = document.getElementById("useLocal");
const disconnect = document.getElementById("disconnect");
const message = document.getElementById("message");
const retiredCustody = document.getElementById("retiredCustody");

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "getStatus" });
  const custodyBlocked = status.retiredCopilotCustodyBlocked === true;
  retiredCustody.classList.toggle("hidden", !custodyBlocked);
  
  if (connectionStatus) {
    connectionStatus.classList.remove("online", "offline");
    if (status.paired) {
      if (custodyBlocked) {
        connectionStatus.textContent = "Session Paused";
        connectionStatus.classList.add("offline");
      } else if (status.state === "on") {
        connectionStatus.textContent = "● Connected to Relay Server";
        connectionStatus.classList.add("online");
      } else {
        connectionStatus.textContent = "● Paired (Relay Offline)";
        connectionStatus.classList.add("offline");
      }
    } else {
      connectionStatus.textContent = "● Not Paired";
      connectionStatus.classList.add("offline");
    }
  }

  automaticSetup.checked = !status.nativeBootstrap?.disabled && !custodyBlocked;
  bootstrapStatus.textContent = custodyBlocked
    ? "Reset required before reconnecting"
    : status.nativeBootstrap?.disabled
      ? "Auto-connect disabled"
      : status.nativeBootstrap?.state === "manual_required"
        ? `Manual connection required (${status.nativeBootstrap.failureCode ?? "port unavailable"})`
        : status.nativeBootstrap?.state === "retrying"
          ? "Waiting for AGY daemon on port 9223…"
          : "AGY local daemon connected";

  accessMode.value = status.accessMode === "selected" ? "selected" : "all";
  automaticSetup.disabled = custodyBlocked;
  useLocal.disabled = custodyBlocked;
  accessMode.disabled = !status.paired || custodyBlocked;
  pairingString.disabled = custodyBlocked;
  pair.disabled = custodyBlocked;
  disconnect.disabled = !status.paired && !custodyBlocked;
}

async function showResult(task, success) {
  try {
    const result = await task();
    if (result?.ok === false) {
      throw new Error(result.error ?? "Operation failed.");
    }
    message.textContent = success;
    setTimeout(() => { message.textContent = ""; }, 4000);
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : String(error);
  }
  await refresh();
}

automaticSetup.addEventListener("change", () => {
  void showResult(
    () =>
      chrome.runtime.sendMessage({
        type: "setNativeBootstrapEnabled",
        enabled: automaticSetup.checked,
      }),
    automaticSetup.checked ? "Enabled auto-connect." : "Disabled auto-connect.",
  );
});

accessMode.addEventListener("change", () => {
  void showResult(
    () =>
      chrome.runtime.sendMessage({
        type: "setAccessMode",
        mode: accessMode.value,
      }),
    `Switched access mode to ${accessMode.value}.`,
  );
});

pair.addEventListener("click", () => {
  void showResult(
    () =>
      chrome.runtime.sendMessage({
        type: "pair",
        pairingString: pairingString.value.trim(),
      }),
    "Saved and paired with relay server.",
  );
});

useLocal.addEventListener("click", () => {
  void showResult(
    () => chrome.runtime.sendMessage({ type: "connectLocal" }),
    "Connected to local AGY relay server.",
  );
});

disconnect.addEventListener("click", () => {
  void showResult(
    () => chrome.runtime.sendMessage({ type: "disconnect" }),
    "Disconnected and reset configuration.",
  );
});

void refresh();
