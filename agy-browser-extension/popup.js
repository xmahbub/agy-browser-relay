const statusLine = document.getElementById("status");
const statusPill = document.getElementById("statusPill");
const pairedDetails = document.getElementById("pairedDetails");
const accessMode = document.getElementById("accessMode");
const tabAction = document.getElementById("tabAction");
const settings = document.getElementById("settings");
const errorLine = document.getElementById("error");

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

function unpairedLabel(nativeBootstrap) {
  if (nativeBootstrap?.disabled) {
    return "Local setup disabled";
  }
  if (nativeBootstrap?.state === "manual_required") {
    return "Manual setup";
  }
  return "Waiting for server";
}

function updateStatusUI(state, text) {
  statusLine.textContent = text;
  if (!statusPill) return;
  statusPill.classList.remove("online", "connecting", "offline");
  statusPill.classList.add(state);
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "getStatus" });
  if (status?.ok === false) {
    updateStatusUI("offline", "Error reading status");
    return;
  }
  pairedDetails.classList.toggle("hidden", !status.paired);
  if (status.retiredCopilotCustodyBlocked === true) {
    updateStatusUI("offline", "Paused (Open Settings)");
    tabAction.classList.add("hidden");
    return;
  }
  if (!status.paired) {
    updateStatusUI("connecting", unpairedLabel(status.nativeBootstrap));
    tabAction.classList.add("hidden");
    return;
  }

  if (status.state === "on") {
    updateStatusUI("online", "Connected");
  } else if (status.state === "connecting") {
    updateStatusUI("connecting", "Connecting…");
  } else {
    updateStatusUI("offline", "Server offline");
  }

  accessMode.textContent = status.accessMode === "selected" ? "Selected tabs" : "All tabs";
  const tab = await activeTab();
  if (tab?.id === undefined) {
    tabAction.classList.add("hidden");
    return;
  }
  const access = await chrome.runtime.sendMessage({ type: "getTabAccess", tabId: tab.id });
  tabAction.classList.toggle("hidden", !access.eligible);
  tabAction.textContent = access.accessible ? "Pause relay on this tab" : "Enable relay on this tab";
  tabAction.dataset.tabId = String(tab.id);
  tabAction.dataset.mode = status.accessMode;
  tabAction.dataset.grant = String(!access.accessible);
}

async function toggleActiveTabAccess() {
  errorLine.classList.add("hidden");
  const result = await chrome.runtime.sendMessage({
    type: "toggleTabAccess",
    tabId: Number(tabAction.dataset.tabId),
    accessMode: tabAction.dataset.mode,
    grant: tabAction.dataset.grant === "true",
  });
  if (!result?.ok) {
    errorLine.textContent = result?.error ?? "Could not update tab access.";
    errorLine.classList.remove("hidden");
  }
  await refresh();
}

tabAction.addEventListener("click", () => {
  void toggleActiveTabAccess();
});

settings.addEventListener("click", () => chrome.runtime.openOptionsPage());
void refresh();
