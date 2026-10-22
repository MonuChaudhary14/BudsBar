import EventEmitter from 'events';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCtlBinary() {
  const local = path.join(__dirname, 'buds-ctl');
  if (fs.existsSync(local)) return local;
  const uncompressed = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'buds-ctl');
  if (fs.existsSync(uncompressed)) return uncompressed;
  if (process.resourcesPath) {
    const res = path.join(process.resourcesPath, 'buds-ctl');
    if (fs.existsSync(res)) return res;
  }
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
    
    // Live State
    this.state = {
      connected: true,
      ancMode: 'cancellation', // 'cancellation' | 'off' | 'transparency'
      gameMode: false,
      eqPreset: 'bass_boost',  // 'balanced' | 'bass_boost' | 'clear_vocals' | 'bright'
      battery: {
        left: 100,
        right: 100,
        case: 100,
        chargingLeft: false,
        chargingRight: false,
        chargingCase: false
      },
      rssi: -52
    };

    this.pollInterval = null;
    this.init();
  }

  init() {
    // Immediate initial sync
    this.syncRealDevice();
    this.startHeartbeat();
  }

  syncRealDevice() {
    execFile(ctlBinary, ['status'], (error, stdout) => {
      if (error || !stdout) return;
      try {
        const info = JSON.parse(stdout.trim());
        if (info.name) this.deviceInfo.name = info.name;
        if (info.address) this.deviceInfo.mac = info.address;
        
        const isConnected = Boolean(info.connected);
        const batteryVal = typeof info.battery === 'number' ? info.battery : 100;

        let changed = false;
        if (this.state.connected !== isConnected) {
          this.state.connected = isConnected;
          changed = true;
        }

        if (this.state.battery.left !== batteryVal) {
          this.state.battery.left = batteryVal;
          this.state.battery.right = batteryVal;
          this.state.battery.case = batteryVal;
          changed = true;
        }

        if (changed) {
          this.emit('state-changed', this.getState());
        }
      } catch (e) {
        // Ignore parse error
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
