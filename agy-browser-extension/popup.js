const statusLine = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const pairedDetails = document.getElementById("pairedDetails");
const accessMode = document.getElementById("accessMode");
const tabAction = document.getElementById("tabAction");
const settings = document.getElementById("settings");
const errorLine = document.getElementById("error");
const refreshLink = document.getElementById("refreshLink");

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

function unpairedLabel(nativeBootstrap) {
  if (nativeBootstrap?.disabled) {
    return "Auto-daemon disabled";
  }
  if (nativeBootstrap?.state === "manual_required") {
    return "Manual port required";
  }
  return "Daemon offline";
}

function updateStatus(state, label) {
  statusLine.textContent = label;
  if (!statusDot) return;
  statusDot.classList.remove("online", "connecting", "offline");
  statusDot.classList.add(state);
}

async function refresh() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "getStatus" });
    if (status?.ok === false) {
      updateStatus("offline", "Status error");
      return;
    }
    
    pairedDetails.classList.toggle("hidden", !status.paired);
    
    if (status.retiredCopilotCustodyBlocked === true) {
      updateStatus("offline", "Session locked");
      tabAction.classList.add("hidden");
      return;
    }
    
    if (!status.paired) {
      updateStatus("connecting", unpairedLabel(status.nativeBootstrap));
      tabAction.classList.add("hidden");
      return;
    }

    if (status.state === "on") {
      updateStatus("online", "Relay active");
    } else if (status.state === "connecting") {
      updateStatus("connecting", "Connecting…");
    } else {
      updateStatus("offline", "Daemon unreachable");
    }

    accessMode.textContent = status.accessMode === "selected" ? "Selected Tabs" : "All Tabs";
    
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
  } catch (err) {
    updateStatus("offline", "Daemon offline");
  }
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

if (refreshLink) {
  refreshLink.addEventListener("click", () => refresh());
}

void refresh();
