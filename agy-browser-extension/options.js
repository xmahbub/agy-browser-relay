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

function setStatusPill(state, text) {
  if (!connectionStatus) return;
  connectionStatus.classList.remove("online", "offline");
  connectionStatus.classList.add(state);
  const textSpan = connectionStatus.querySelector("span:last-child");
  if (textSpan) {
    textSpan.textContent = text;
  }
}

async function refresh() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "getStatus" });
    const custodyBlocked = status.retiredCopilotCustodyBlocked === true;
    retiredCustody.classList.toggle("hidden", !custodyBlocked);
    
    if (status.paired) {
      if (custodyBlocked) {
        setStatusPill("offline", "Locked");
      } else if (status.state === "on") {
        setStatusPill("online", "Connected");
      } else {
        setStatusPill("offline", "Offline");
      }
    } else {
      setStatusPill("offline", "Unpaired");
    }

    automaticSetup.checked = !status.nativeBootstrap?.disabled && !custodyBlocked;
    bootstrapStatus.textContent = custodyBlocked
      ? "Manual intervention required: session locked."
      : status.nativeBootstrap?.disabled
        ? "Automatic background detection is disabled."
        : status.nativeBootstrap?.state === "manual_required"
          ? `Port collision or manual connection required (${status.nativeBootstrap.failureCode ?? "port unavailable"}).`
          : status.nativeBootstrap?.state === "retrying"
            ? "Waiting for AGY daemon process on 127.0.0.1:9223…"
            : "Daemon connected and listening.";

    accessMode.value = status.accessMode === "selected" ? "selected" : "all";
    automaticSetup.disabled = custodyBlocked;
    useLocal.disabled = custodyBlocked;
    accessMode.disabled = !status.paired || custodyBlocked;
    pairingString.disabled = custodyBlocked;
    pair.disabled = custodyBlocked;
    disconnect.disabled = !status.paired && !custodyBlocked;
  } catch (err) {
    setStatusPill("offline", "Offline");
  }
}

async function showResult(task, success) {
  try {
    const result = await task();
    if (result?.ok === false) {
      throw new Error(result.error ?? "Action failed.");
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
    automaticSetup.checked ? "Auto-connect enabled." : "Auto-connect disabled.",
  );
});

accessMode.addEventListener("change", () => {
  void showResult(
    () =>
      chrome.runtime.sendMessage({
        type: "setAccessMode",
        accessMode: accessMode.value,
      }),
    `Access mode updated to ${accessMode.value}.`,
  );
});

pair.addEventListener("click", () => {
  void showResult(
    () =>
      chrome.runtime.sendMessage({
        type: "pair",
        pairingString: pairingString.value.trim(),
        accessMode: accessMode.value,
      }),
    "Endpoint saved and bridge reconnected.",
  );
});

useLocal.addEventListener("click", () => {
  void showResult(
    () => chrome.runtime.sendMessage({ type: "setNativeBootstrapEnabled", enabled: true }),
    "Connected to local AGY daemon.",
  );
});

disconnect.addEventListener("click", () => {
  void showResult(
    () => chrome.runtime.sendMessage({ type: "unpair" }),
    "Disconnected and configuration reset.",
  );
});

void refresh();
