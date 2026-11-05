import { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, screen, shell } from 'electron';
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

  // If tray is at bottom (e.g. Windows taskbar or bottom panel)
  const isTrayNearBottom = trayBounds.y > display.bounds.y + (display.bounds.height / 2);
  if (isTrayNearBottom) {
    y = Math.round(trayBounds.y - windowBounds.height - 4);
  }

  // Prevent window from clipping horizontally
  if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
    x = display.bounds.x + display.bounds.width - windowBounds.width - 10;
  }
  if (x < display.bounds.x) {
    x = display.bounds.x + 10;
  }

  // Prevent window from clipping vertically
  if (y + windowBounds.height > display.bounds.y + display.bounds.height) {
    y = display.bounds.y + display.bounds.height - windowBounds.height - 10;
  }
  if (y < display.bounds.y) {
    y = display.bounds.y + 10;
  }

  return { x, y };
}

function toggleWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isVisible()) {
    window.hide();
  } else {
    // Immediate state sync whenever opened
    earbudsService.syncRealDevice((freshState) => {
      if (window && !window.isDestroyed() && window.webContents) {
        window.webContents.send('buds:state-update', freshState);
      }
    });
    const currentState = earbudsService.getState();
    if (window.webContents) {
      window.webContents.send('buds:state-update', currentState);
    }
    const { x, y } = getWindowPosition();
    window.setPosition(x, y, false);
    window.show();
    window.focus();
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 384,
    height: 585,
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

  // Dynamic polling rate: fast when UI is open, low-power idle when hidden
  window.on('show', () => {
    earbudsService.startHeartbeat(4000);
  });
  window.on('hide', () => {
    earbudsService.startHeartbeat(30000);
  });

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
    earbudsService.cycleAncMode();
    if (window && !window.isDestroyed() && window.webContents) {
      window.webContents.send('buds:state-update', earbudsService.getState());
    }
  });

  // Hotkey to toggle Game Mode
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    earbudsService.toggleGameMode();
    if (window && !window.isDestroyed() && window.webContents) {
      window.webContents.send('buds:state-update', earbudsService.getState());
    }
  });
}

// IPC Handlers
function setupIpc() {
  ipcMain.handle('buds:get-state', () => earbudsService.getState());
  ipcMain.handle('buds:refresh-state', () => {
    return new Promise((resolve) => {
      earbudsService.syncRealDevice((freshState) => {
        resolve(freshState);
      });
    });
  });
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
  ipcMain.on('buds:open-external', (_e, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });
  ipcMain.on('buds:quit', () => app.quit());

  earbudsService.on('state-changed', (state) => {
    if (tray) {
      let statusText = 'Disconnected';
      if (state.connected) {
        const parts = [];
        if (typeof state.battery?.left === 'number') parts.push(`L: ${state.battery.left}%`);
        if (typeof state.battery?.right === 'number') parts.push(`R: ${state.battery.right}%`);
        statusText = parts.length > 0 ? `Connected (${parts.join(', ')})` : 'Connected';
      }
      tray.setToolTip(`BudsBar - realme Buds T310 (${statusText})`);
    }
    if (window && !window.isDestroyed() && window.webContents) {
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

  const contextMenu = Menu.buildFromTemplate([
    { label: 'realme Buds T310', enabled: false },
    { type: 'separator' },
    { label: 'Show BudsBar', click: () => toggleWindow() },
    {
      label: 'Noise Control',
      submenu: [
        { label: 'Noise Cancellation', click: () => earbudsService.setAncMode('cancellation') },
        { label: 'Normal', click: () => earbudsService.setAncMode('off') },
        { label: 'Transparent', click: () => earbudsService.setAncMode('transparency') }
      ]
    },
    { type: 'separator' },
    { label: 'Quit BudsBar', click: () => app.quit() }
  ]);

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });

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
