import EventEmitter from 'events';
import { execFile } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(os.homedir(), '.budsbar-state.json');

function loadPersistedState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[BudsBar] Error reading state file:', e);
  }
  return {
    anc: 'off',
    game: false,
    eq: 'bass_boost'
  };
}

function savePersistedState(data) {
  try {
    const existing = loadPersistedState();
    const merged = { ...existing, ...data };
    fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {
    console.error('[BudsBar] Error writing state file:', e);
  }
}

function getCtlBinary() {
  if (process.resourcesPath) {
    const res = path.join(process.resourcesPath, 'buds-ctl');
    if (fs.existsSync(res)) return res;
  }
  const uncompressed = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'buds-ctl');
  if (fs.existsSync(uncompressed)) return uncompressed;
  const local = path.join(__dirname, 'buds-ctl');
  if (fs.existsSync(local) && !local.includes('app.asar')) return local;
  return local;
}

const ctlBinary = getCtlBinary();

export class EarbudsService extends EventEmitter {
  constructor() {
    super();
    this.deviceInfo = {
      name: 'realme Buds T310',
      model: 'RMA2302',
      firmwareVersion: '1.1.0.89',
      mac: '84:9D:4B:FA:59:55'
    };
    
    // Load persisted hardware state
    const saved = loadPersistedState();

    // Live State (default to false until verified by hardware check)
    this.state = {
      connected: false,
      ancMode: saved.anc || 'off', // 'cancellation' | 'off' | 'transparency'
      gameMode: saved.game !== undefined ? Boolean(saved.game) : false,
      eqPreset: saved.eq || 'bass_boost',  // 'balanced' | 'bass_boost' | 'clear_vocals' | 'bright'
      battery: {
        left: 0,
        right: 0,
        chargingLeft: false,
        chargingRight: false
      },
      rssi: null
    };

    this.pollInterval = null;
    this.init();
  }

  init() {
    // Immediate initial sync from device / buds-ctl
    this.syncRealDevice();
    this.startHeartbeat();
  }

  syncRealDevice(callback) {
    execFile(ctlBinary, ['status'], (error, stdout) => {
      let changed = false;
      if (error || !stdout) {
        if (this.state.connected !== false) {
          this.state.connected = false;
          this.state.rssi = null;
          changed = true;
        }
        if (changed) {
          this.emit('state-changed', this.getState());
        }
        if (typeof callback === 'function') callback(this.getState());
        return;
      }

      try {
        const info = JSON.parse(stdout.trim());
        if (info.name) this.deviceInfo.name = info.name;
        if (info.address) this.deviceInfo.mac = info.address;
        
        const isConnected = Boolean(info.connected);

        if (this.state.connected !== isConnected) {
          this.state.connected = isConnected;
          changed = true;
        }

        if (isConnected) {
          const batteryVal = typeof info.battery === 'number' ? info.battery : 100;
          if (this.state.battery.left !== batteryVal) {
            this.state.battery.left = batteryVal;
            this.state.battery.right = batteryVal;
            changed = true;
          }
          if (this.state.rssi === null) {
            this.state.rssi = -52;
            changed = true;
          }
        } else {
          if (this.state.rssi !== null) {
            this.state.rssi = null;
            changed = true;
          }
        }

        // Restore identified hardware ANC mode
        if (info.anc && ['cancellation', 'off', 'transparency'].includes(info.anc)) {
          if (this.state.ancMode !== info.anc) {
            this.state.ancMode = info.anc;
            changed = true;
          }
        }

        // Restore identified Game Mode
        if (info.game !== undefined && this.state.gameMode !== Boolean(info.game)) {
          this.state.gameMode = Boolean(info.game);
          changed = true;
        }

        // Restore identified EQ preset
        if (info.eq && this.state.eqPreset !== info.eq) {
          this.state.eqPreset = info.eq;
          changed = true;
        }

        if (changed) {
          this.emit('state-changed', this.getState());
        }
        if (typeof callback === 'function') callback(this.getState());
      } catch (e) {
        if (this.state.connected !== false) {
          this.state.connected = false;
          this.state.rssi = null;
          this.emit('state-changed', this.getState());
        }
        if (typeof callback === 'function') callback(this.getState());
      }
    });
  }

  startHeartbeat() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.syncRealDevice();
    }, 4000);
  }

  getState() {
    return {
      ...this.state,
      deviceInfo: this.deviceInfo
    };
  }

  setAncMode(mode) {
    if (!['cancellation', 'off', 'transparency'].includes(mode)) return;
    this.state.ancMode = mode;
    savePersistedState({ anc: mode });
    
    // Send to hardware via native RFCOMM channel
    execFile(ctlBinary, ['anc', mode], (err, stdout) => {
      if (err) console.error('Error sending ANC to earbud:', err);
      else console.log('[BudsBar] Hardware ANC updated:', stdout.trim());
    });

    this.emit('state-changed', this.getState());
  }

  cycleAncMode() {
    const cycle = {
      'cancellation': 'off',
      'off': 'transparency',
      'transparency': 'cancellation'
    };
    const nextMode = cycle[this.state.ancMode] || 'cancellation';
    this.setAncMode(nextMode);
    return nextMode;
  }

  setGameMode(enabled) {
    this.state.gameMode = Boolean(enabled);
    savePersistedState({ game: this.state.gameMode });
    
    execFile(ctlBinary, ['game', this.state.gameMode ? 'on' : 'off'], (err, stdout) => {
      if (err) console.error('Error sending Game Mode to earbud:', err);
      else console.log('[BudsBar] Hardware Game Mode updated:', stdout.trim());
    });

    this.emit('state-changed', this.getState());
  }

  toggleGameMode() {
    this.setGameMode(!this.state.gameMode);
    return this.state.gameMode;
  }

  setEqPreset(preset) {
    this.state.eqPreset = preset;
    savePersistedState({ eq: preset });

    execFile(ctlBinary, ['eq', preset], (err, stdout) => {
      if (err) console.error('Error sending EQ to earbud:', err);
      else console.log('[BudsBar] Hardware EQ updated:', stdout.trim());
    });

    this.emit('state-changed', this.getState());
  }

  setConnected(status) {
    this.state.connected = Boolean(status);
    this.emit('state-changed', this.getState());
  }

  destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
