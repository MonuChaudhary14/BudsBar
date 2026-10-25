// Initial State
let currentState = {
  connected: true,
  ancMode: localStorage.getItem('budsbar_anc') || 'off', // 'cancellation' | 'off' | 'transparency'
  gameMode: false,
  eqPreset: localStorage.getItem('budsbar_eq') || 'bass_boost', // 'balanced' | 'bass_boost' | 'clear_vocals' | 'bright'
  battery: {
    left: 100,
    right: 100,
    case: 100,
    chargingLeft: false,
    chargingRight: false,
    chargingCase: false
  },
  deviceInfo: {
    name: 'realme Buds T310',
    model: 'RMA2302',
    firmwareVersion: '1.1.0.89'
  },
  rssi: -52
};

// DOM Elements
const deviceNameEl = document.getElementById('deviceName');
const statusDotEl = document.getElementById('statusDot');
const statusTextEl = document.getElementById('statusText');
const btnRefresh = document.getElementById('btnRefresh');

const valLeftEl = document.getElementById('valLeft');
const valRightEl = document.getElementById('valRight');
const valCaseEl = document.getElementById('valCase');

const barLeftEl = document.getElementById('barLeft');
const barRightEl = document.getElementById('barRight');
const barCaseEl = document.getElementById('barCase');

const ancButtons = document.querySelectorAll('.segment-btn, .segmented-option');
const ancCaptionEl = document.getElementById('ancCaption');

const eqButtons = document.querySelectorAll('.eq-btn, .eq-chip');
const chkGameMode = document.getElementById('chkGameMode');

const fwInfoEl = document.getElementById('fwInfo');
const rssiInfoEl = document.getElementById('rssiInfo');

// Captions for ANC states
const ANC_CAPTIONS = {
  'cancellation': 'Active Noise Cancellation',
  'off': 'Normal mode (Noise control off)',
  'transparency': 'Transparent mode (Ambient pass-through)'
};

// Update Battery Bar Fill
function updateBatteryBar(barEl, pct) {
  if (!barEl) return;
  const clamped = Math.max(0, Math.min(100, pct));
  barEl.style.width = `${clamped}%`;

  if (clamped <= 20) {
    barEl.style.backgroundColor = 'var(--color-red)';
  } else if (clamped <= 35) {
    barEl.style.backgroundColor = 'var(--color-amber)';
  } else {
    barEl.style.backgroundColor = 'var(--color-green)';
  }
}

// Render Complete State to DOM
function updateUI(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };

  // Device Info
  if (state.deviceInfo) {
    if (deviceNameEl) deviceNameEl.textContent = state.deviceInfo.name || 'realme Buds T310';
    if (fwInfoEl) fwInfoEl.textContent = `FW ${state.deviceInfo.firmwareVersion || '1.1.0.89'}`;
  }

  // Connection Status
  if (state.connected !== undefined) {
    if (statusDotEl) {
      statusDotEl.className = state.connected ? 'status-dot' : 'status-dot disconnected';
    }
    if (statusTextEl) {
      statusTextEl.textContent = state.connected ? 'Connected' : 'Disconnected';
    }
  }

  // Battery
  if (state.battery) {
    if (valLeftEl) valLeftEl.textContent = `${state.battery.left}%`;
    if (valRightEl) valRightEl.textContent = `${state.battery.right}%`;
    if (valCaseEl) valCaseEl.textContent = `${state.battery.case}%`;

    updateBatteryBar(barLeftEl, state.battery.left);
    updateBatteryBar(barRightEl, state.battery.right);
    updateBatteryBar(barCaseEl, state.battery.case);
  }

  // ANC Mode
  if (state.ancMode) {
    try { localStorage.setItem('budsbar_anc', state.ancMode); } catch (e) {}

    ancButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === state.ancMode);
    });

    if (ancCaptionEl) {
      ancCaptionEl.textContent = ANC_CAPTIONS[state.ancMode] || '';
    }
  }

  // Game Mode
  if (chkGameMode && state.gameMode !== undefined) {
    chkGameMode.checked = Boolean(state.gameMode);
  }

  // EQ Preset
  if (state.eqPreset) {
    try { localStorage.setItem('budsbar_eq', state.eqPreset); } catch (e) {}

    eqButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-eq') === state.eqPreset);
    });
  }

  // RSSI Signal Strength
  if (state.rssi !== undefined && rssiInfoEl) {
    rssiInfoEl.textContent = `${state.rssi} dBm`;
  }
}

// ANC Mode Selection
ancButtons.forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const mode = btn.getAttribute('data-mode');
    console.log('[BudsBar UI] ANC clicked:', mode);

    // Optimistic UI update
    updateUI({ ancMode: mode });

    if (window.budsAPI && typeof window.budsAPI.setAncMode === 'function') {
      try {
        const newState = await window.budsAPI.setAncMode(mode);
        updateUI(newState);
      } catch (err) {
        console.error('Failed to set ANC mode:', err);
      }
    }
  });
});

// Game Mode Toggle
if (chkGameMode) {
  chkGameMode.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    console.log('[BudsBar UI] Game Mode toggled:', isEnabled);

    updateUI({ gameMode: isEnabled });

    if (window.budsAPI && typeof window.budsAPI.setGameMode === 'function') {
      try {
        const newState = await window.budsAPI.setGameMode(isEnabled);
        updateUI(newState);
      } catch (err) {
        console.error('Failed to set Game Mode:', err);
      }
    }
  });
}

// EQ Preset Selection
eqButtons.forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const preset = btn.getAttribute('data-eq');
    console.log('[BudsBar UI] EQ clicked:', preset);

    updateUI({ eqPreset: preset });

    if (window.budsAPI && typeof window.budsAPI.setEqPreset === 'function') {
      try {
        const newState = await window.budsAPI.setEqPreset(preset);
        updateUI(newState);
      } catch (err) {
        console.error('Failed to set EQ preset:', err);
      }
    }
  });
});

// Refresh Button
if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.style.transition = 'transform 0.4s ease';
    btnRefresh.style.transform = 'rotate(360deg)';

    if (window.budsAPI && typeof window.budsAPI.getState === 'function') {
      try {
        const state = await window.budsAPI.getState();
        updateUI(state);
      } catch (err) {
        console.error('Failed to refresh state:', err);
      }
    }

    setTimeout(() => {
      btnRefresh.style.transition = 'none';
      btnRefresh.style.transform = 'none';
    }, 450);
  });
}

// ⌘Q Shortcut to Quit
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
    if (window.budsAPI && typeof window.budsAPI.quitApp === 'function') {
      window.budsAPI.quitApp();
    } else {
      window.close();
    }
  }
});

// Initialize
async function init() {
  if (window.budsAPI) {
    if (typeof window.budsAPI.onStateChanged === 'function') {
      window.budsAPI.onStateChanged((state) => {
        updateUI(state);
      });
    }

    if (typeof window.budsAPI.getState === 'function') {
      try {
        const initialState = await window.budsAPI.getState();
        updateUI(initialState);
      } catch (err) {
        console.error('Failed to fetch initial state:', err);
        updateUI(currentState);
      }
    }
  } else {
    updateUI(currentState);
  }
}

document.addEventListener('DOMContentLoaded', init);
