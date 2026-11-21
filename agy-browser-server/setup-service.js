#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = 'ai.agy.browser.server';
const DISPLAY_NAME = 'AGY Browser Relay Server';
const SERVER_SCRIPT = path.join(__dirname, 'server.js');
const NODE_BIN = process.execPath;
const LOG_DIR = path.join(os.homedir(), '.gemini');
const STDOUT_LOG = path.join(LOG_DIR, 'agy-browser-server.log');
const STDERR_LOG = path.join(LOG_DIR, 'agy-browser-server.err.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function runCmd(cmd, ignoreError = false) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (err) {
    if (!ignoreError) throw err;
    return null;
  }
}

// -------------------------------------------------------------
// macOS (launchd LaunchAgent)
// -------------------------------------------------------------
const macos = {
  getPlistPath() {
    return path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_NAME}.plist`);
  },

  getDomain() {
    const uid = process.getuid ? process.getuid() : runCmd('id -u');
    return `gui/${uid}`;
  },

  generatePlist() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${SERVER_SCRIPT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${__dirname}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${STDOUT_LOG}</string>
    <key>StandardErrorPath</key>
    <string>${STDERR_LOG}</string>
</dict>
</plist>
`;
  },

  install() {
    ensureLogDir();
    const plistPath = this.getPlistPath();
    const targetDir = path.dirname(plistPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const domain = this.getDomain();

    // Stop and unregister existing service if currently registered
    runCmd(`launchctl bootout ${domain} "${plistPath}"`, true);
    runCmd(`launchctl bootout ${domain}/${SERVICE_NAME}`, true);

    fs.writeFileSync(plistPath, this.generatePlist(), 'utf-8');
    console.log(`[macOS] Wrote launchd plist to: ${plistPath}`);

    // Register with launchctl
    try {
      runCmd(`launchctl bootstrap ${domain} "${plistPath}"`);
      runCmd(`launchctl enable ${domain}/${SERVICE_NAME}`, true);
      console.log(`[macOS] Service registered and started via launchctl bootstrap (${domain})`);
    } catch (e) {
      runCmd(`launchctl load -w "${plistPath}"`, true);
      console.log(`[macOS] Service loaded via launchctl load`);
    }
  },

  uninstall() {
    const plistPath = this.getPlistPath();
    const domain = this.getDomain();

    runCmd(`launchctl bootout ${domain} "${plistPath}"`, true);
    runCmd(`launchctl bootout ${domain}/${SERVICE_NAME}`, true);
    runCmd(`launchctl unload -w "${plistPath}"`, true);

    if (fs.existsSync(plistPath)) {
      fs.unlinkSync(plistPath);
      console.log(`[macOS] Removed plist file: ${plistPath}`);
    }
    console.log(`[macOS] Service uninstalled successfully.`);
  },

  status() {
    const domain = this.getDomain();
    const out = runCmd(`launchctl print ${domain}/${SERVICE_NAME}`, true);
    if (out) {
      console.log(`[macOS] Service is registered:\n` + out.split('\n').slice(0, 15).join('\n'));
    } else {
      console.log(`[macOS] Service is NOT loaded in ${domain}.`);
    }
  }
};

// -------------------------------------------------------------
// Linux (systemd user service)
// -------------------------------------------------------------
const linux = {
  getServicePath() {
    return path.join(os.homedir(), '.config', 'systemd', 'user', `${SERVICE_NAME}.service`);
  },

  generateServiceFile() {
    return `[Unit]
Description=${DISPLAY_NAME}
After=network.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${SERVER_SCRIPT}
WorkingDirectory=${__dirname}
Restart=always
RestartSec=5
StandardOutput=append:${STDOUT_LOG}
StandardError=append:${STDERR_LOG}

[Install]
WantedBy=default.target
`;
  },

  install() {
    ensureLogDir();
    const servicePath = this.getServicePath();
    const targetDir = path.dirname(servicePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(servicePath, this.generateServiceFile(), 'utf-8');
    console.log(`[Linux] Wrote systemd unit file: ${servicePath}`);

    runCmd('systemctl --user daemon-reload');
    runCmd(`systemctl --user enable --now ${SERVICE_NAME}.service`);
    console.log(`[Linux] Service enabled and started via systemd user service.`);
    console.log(`[Linux] Note: To keep user services running when logged out, run: loginctl enable-linger`);
  },

  uninstall() {
    const servicePath = this.getServicePath();
    runCmd(`systemctl --user stop ${SERVICE_NAME}.service`, true);
    runCmd(`systemctl --user disable ${SERVICE_NAME}.service`, true);

    if (fs.existsSync(servicePath)) {
      fs.unlinkSync(servicePath);
      console.log(`[Linux] Removed service file: ${servicePath}`);
    }
    runCmd('systemctl --user daemon-reload', true);
    console.log(`[Linux] Service uninstalled successfully.`);
  },

  status() {
    const out = runCmd(`systemctl --user status ${SERVICE_NAME}.service`, true);
    if (out) {
      console.log(out);
    } else {
      console.log(`[Linux] Service ${SERVICE_NAME} not found or inactive.`);
    }
  }
};

// -------------------------------------------------------------
// Windows (Startup Folder VBS Launcher or Task Scheduler)
// -------------------------------------------------------------
const windows = {
  getStartupDir() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  },

  getVbsPath() {
    return path.join(this.getStartupDir(), `${SERVICE_NAME}.vbs`);
  },

  generateVbsScript() {
    // A VBScript launcher runs node invisibly in the background without opening a cmd window
    const normalizedNode = NODE_BIN.replace(/\\/g, '\\\\');
    const normalizedScript = SERVER_SCRIPT.replace(/\\/g, '\\\\');
    const normalizedDir = __dirname.replace(/\\/g, '\\\\');
    const normalizedOut = STDOUT_LOG.replace(/\\/g, '\\\\');
    const normalizedErr = STDERR_LOG.replace(/\\/g, '\\\\');

    return `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${normalizedDir}"
cmd = "cmd /c ""\"${normalizedNode}\" \"${normalizedScript}\" >> \"${normalizedOut}\" 2>> \"${normalizedErr}\""""
WshShell.Run cmd, 0, False
`;
  },

  install() {
    ensureLogDir();
    const startupDir = this.getStartupDir();
    if (!fs.existsSync(startupDir)) {
      fs.mkdirSync(startupDir, { recursive: true });
    }

    const vbsPath = this.getVbsPath();
    fs.writeFileSync(vbsPath, this.generateVbsScript(), 'utf-8');
    console.log(`[Windows] Created startup launcher: ${vbsPath}`);

    // Launch immediately in background
    runCmd(`wscript.exe "${vbsPath}"`, true);
    console.log(`[Windows] Service launched and configured to start on user login.`);
  },

  uninstall() {
    const vbsPath = this.getVbsPath();
    if (fs.existsSync(vbsPath)) {
      fs.unlinkSync(vbsPath);
      console.log(`[Windows] Removed startup script: ${vbsPath}`);
    }

    // Try killing any existing running node instance of server.js
    try {
      runCmd(`wmic process where "commandline like '%${path.basename(SERVER_SCRIPT)}%'" call terminate`, true);
    } catch {}
    console.log(`[Windows] Service uninstalled successfully.`);
  },

  status() {
    const vbsPath = this.getVbsPath();
    if (fs.existsSync(vbsPath)) {
      console.log(`[Windows] Auto-start launcher exists at: ${vbsPath}`);
    } else {
      console.log(`[Windows] Auto-start launcher is NOT installed.`);
    }
  }
};

// -------------------------------------------------------------
// CLI Dispatcher
// -------------------------------------------------------------
const platform = process.platform;
let handler = null;

if (platform === 'darwin') {
  handler = macos;
} else if (platform === 'linux') {
  handler = linux;
} else if (platform === 'win32') {
  handler = windows;
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const command = process.argv[2] || 'help';

switch (command) {
  case 'install':
    console.log(`Installing ${DISPLAY_NAME} auto-start service on ${platform}...`);
    handler.install();
    break;

  case 'uninstall':
    console.log(`Uninstalling ${DISPLAY_NAME} auto-start service on ${platform}...`);
    handler.uninstall();
    break;

  case 'status':
    console.log(`Checking ${DISPLAY_NAME} service status on ${platform}...`);
    handler.status();
    break;

  default:
    console.log(`
Usage: node setup-service.js [command]

Commands:
  install     Configure and start auto-start service for current OS (macOS, Linux, Windows)
  uninstall   Stop and remove auto-start service
  status      Check current service configuration status
`);
    break;
}
