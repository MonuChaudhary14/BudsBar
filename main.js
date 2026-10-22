import { app, BrowserWindow, Tray, ipcMain, globalShortcut, nativeImage, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { EarbudsService } from './ble-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let window = null;
const earbudsService = new EarbudsService();

// Create Menu Bar Tray Icon
function createTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true); // macOS template image adapts to dark/light menu bars
  return icon;
}

// Calculate precise window coordinates below or above tray icon
function getWindowPosition() {
  if (!tray) return { x: 0, y: 0 };
  const windowBounds = window.getBounds();
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  // If tray is at bottom (Windows taskbar)
  if (trayBounds.y > display.bounds.height / 2) {
    y = Math.round(trayBounds.y - windowBounds.height - 4);
  }

  // Prevent window from clipping off-screen
  if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
    x = display.bounds.x + display.bounds.width - windowBounds.width - 10;
  }
  if (x < display.bounds.x) {
    x = display.bounds.x + 10;
  }

  return { x, y };
}

function toggleWindow() {
  if (!window) return;
  if (window.isVisible()) {
    window.hide();
  } else {
    const { x, y } = getWindowPosition();
    window.setPosition(x, y, false);
    window.show();
    window.focus();
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 340,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  window.loadFile(path.join(__dirname, 'index.html'));

  // Auto-hide when user clicks anywhere outside
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) {
      window.hide();
    }
  });
}

function registerHotkeys() {
  // Hotkey to cycle ANC modes
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    const nextMode = earbudsService.cycleAncMode();
    if (window && window.webContents) {
      window.webContents.send('buds:state-update', earbudsService.getState());
    }
  });

  // Hotkey to toggle Game Mode
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    earbudsService.toggleGameMode();
    if (window && window.webContents) {
      window.webContents.send('buds:state-update', earbudsService.getState());
    }
  });
}

// IPC Handlers
function setupIpc() {
  ipcMain.handle('buds:get-state', () => earbudsService.getState());
  ipcMain.handle('buds:set-anc', (_e, mode) => {
    earbudsService.setAncMode(mode);
    return earbudsService.getState();
  });
  ipcMain.handle('buds:set-game-mode', (_e, enabled) => {
    earbudsService.setGameMode(enabled);
    return earbudsService.getState();
  });
  ipcMain.handle('buds:set-eq', (_e, preset) => {
    earbudsService.setEqPreset(preset);
    return earbudsService.getState();
  });
  ipcMain.handle('buds:toggle-connection', () => {
    earbudsService.setConnected(!earbudsService.state.connected);
    return earbudsService.getState();
  });
  ipcMain.on('buds:quit', () => app.quit());

  earbudsService.on('state-changed', (state) => {
    if (window && window.webContents) {
      window.webContents.send('buds:state-update', state);
    }
  });
}

// App Lifecycle
app.whenReady().then(() => {
  // Hide dock icon on macOS to behave purely as a Menu Bar accessory
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createWindow();

  tray = new Tray(createTrayIcon());
  tray.setToolTip('BudsBar - realme Buds T310');
  tray.on('click', () => toggleWindow());

  registerHotkeys();
  setupIpc();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  earbudsService.destroy();
});

app.on('window-all-closed', (e) => {
  // Keep alive in tray
  e.preventDefault();
});
