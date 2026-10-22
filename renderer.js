// Fallback / Initial State
let currentState = {
  connected: true,
  ancMode: 'cancellation', // 'cancellation' | 'off' | 'transparency'
  gameMode: false,
  eqPreset: 'bass_boost',  // 'balanced' | 'bass_boost' | 'clear_vocals' | 'bright'
  battery: {
    left: 85,
    right: 80,
    case: 95,
    chargingLeft: false,
    chargingRight: false,
    chargingCase: false
  },
  deviceInfo: {
    name: 'realme Buds T310',
    model: 'RMA2302',
    firmwareVersion: '1.1.0.89'
  },
  rssi: -58
};

// DOM Elements
const deviceNameEl = document.getElementById('deviceName');
const statusDotEl = document.getElementById('statusDot');
const statusTextEl = document.getElementById('statusText');
const btnRefresh = document.getElementById('btnRefresh');

const valLeftEl = document.getElementById('valLeft');
const valRightEl = document.getElementById('valRight');
const valCaseEl = document.getElementById('valCase');

const ringLeftEl = document.getElementById('ringLeft');
const ringRightEl = document.getElementById('ringRight');
const ringCaseEl = document.getElementById('ringCase');

const chargeLeftEl = document.getElementById('chargeLeft');
const chargeRightEl = document.getElementById('chargeRight');
const chargeCaseEl = document.getElementById('chargeCase');

const ancSliderEl = document.getElementById('ancSlider');
const ancButtons = document.querySelectorAll('.segmented-option, .anc-btn');
const ancCaptionEl = document.getElementById('ancCaption');

const eqPills = document.querySelectorAll('.eq-chip, .eq-pill');
const chkGameMode = document.getElementById('chkGameMode');

const fwInfoEl = document.getElementById('fwInfo');
const rssiInfoEl = document.getElementById('rssiInfo');
const btnHeaderQuit = document.getElementById('btnHeaderQuit');
const btnQuit = document.getElementById('btnQuit');

// Captions for ANC states
const ANC_CAPTIONS = {
  'cancellation': '46 dB Hybrid Active Noise Cancellation',
  'off': 'Noise control off (Passive isolation)',
  'transparency': 'Ambient sound pass-through active'
};

// Update Battery Ring Stroke
function setRingLevel(ringEl, pct, isCase = false) {
  if (!ringEl) return;
  const clamped = Math.max(0, Math.min(100, pct));
  ringEl.setAttribute('stroke-dasharray', `${clamped}, 100`);

  if (!isCase) {
    if (clamped <= 20) {
      ringEl.style.stroke = '#ef4444'; // Red
    } else if (clamped <= 40) {
      ringEl.style.stroke = 'var(--accent-amber)'; // Amber
    } else {
      ringEl.style.stroke = 'var(--accent-cyan)'; // Cyan
    }
  }
}

// Render Complete State to DOM
function updateUI(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };

  // Device Info
  if (state.deviceInfo) {
    deviceNameEl.textContent = state.deviceInfo.name || 'realme Buds T310';
    fwInfoEl.textContent = `FW: ${state.deviceInfo.firmwareVersion || '1.1.0.89'}`;
  }

  // Connection Status
  if (state.connected) {
    statusDotEl.className = 'status-indicator';
    statusTextEl.textContent = 'Connected';
    btnToggleConnect.textContent = 'Simulate Disconnect';
  } else {
    statusDotEl.className = 'status-indicator disconnected';
    statusTextEl.textContent = 'Disconnected';
    btnToggleConnect.textContent = 'Reconnect';
  }

  // Battery
  if (state.battery) {
    valLeftEl.textContent = `${state.battery.left}%`;
    valRightEl.textContent = `${state.battery.right}%`;
    valCaseEl.textContent = `${state.battery.case}%`;

    setRingLevel(ringLeftEl, state.battery.left, false);
    setRingLevel(ringRightEl, state.battery.right, false);
    setRingLevel(ringCaseEl, state.battery.case, true);

    chargeLeftEl.classList.toggle('hidden', !state.battery.chargingLeft);
    chargeRightEl.classList.toggle('hidden', !state.battery.chargingRight);
    chargeCaseEl.classList.toggle('hidden', !state.battery.chargingCase);
  }

  // ANC Slider & Buttons
  const ancModes = ['cancellation', 'off', 'transparency'];
  const activeIndex = ancModes.indexOf(state.ancMode);
  if (activeIndex !== -1) {
    ancSliderEl.style.transform = `translateX(${activeIndex * 100}%)`;
    ancButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === activeIndex);
    });
    ancCaptionEl.textContent = ANC_CAPTIONS[state.ancMode] || '';
  }

  // Game Mode
  chkGameMode.checked = Boolean(state.gameMode);

  // EQ Presets
  eqPills.forEach(pill => {
    const isCurrent = pill.getAttribute('data-eq') === state.eqPreset;
    pill.classList.toggle('active', isCurrent);
  });

  // Signal
  if (state.rssi) {
    rssiInfoEl.textContent = `${state.rssi} dBm`;
  }
}

// Event Listeners with Optimistic Updates
ancButtons.forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const mode = btn.getAttribute('data-mode');
    console.log('[BudsBar UI] ANC clicked:', mode);
    
    // Optimistic UI update
    updateUI({ ancMode: mode });

    // Send to backend if available
    if (window.budsAPI && typeof window.budsAPI.setAncMode === 'function') {
      try {
        const newState = await window.budsAPI.setAncMode(mode);
        updateUI(newState);
      } catch (err) {
        console.error('Failed to set ANC:', err);
      }
    }
  });
});

chkGameMode.addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;
  console.log('[BudsBar UI] Game Mode toggled:', isEnabled);
  
  // Optimistic UI update
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

eqPills.forEach(pill => {
  pill.addEventListener('click', async (e) => {
    e.preventDefault();
    const preset = pill.getAttribute('data-eq');
    console.log('[BudsBar UI] EQ clicked:', preset);

    // Optimistic UI update
    updateUI({ eqPreset: preset });

    if (window.budsAPI && typeof window.budsAPI.setEqPreset === 'function') {
      try {
        const newState = await window.budsAPI.setEqPreset(preset);
        updateUI(newState);
      } catch (err) {
        console.error('Failed to set EQ:', err);
      }
    }
  });
});

btnRefresh.addEventListener('click', async () => {
  btnRefresh.style.transform = 'rotate(360deg)';
  
  if (window.budsAPI && typeof window.budsAPI.getState === 'function') {
    try {
      const state = await window.budsAPI.getState();
      updateUI(state);
    } catch (err) {
      console.error('Failed to refresh state:', err);
    }
  } else {
    // Minor battery simulation for offline preview
    const l = Math.max(10, currentState.battery.left - Math.floor(Math.random() * 2));
    updateUI({
      battery: { ...currentState.battery, left: l }
    });
  }

  setTimeout(() => {
    btnRefresh.style.transform = 'none';
  }, 400);
});

function handleQuit() {
  console.log('[BudsBar UI] Quitting app...');
  if (window.budsAPI && typeof window.budsAPI.quitApp === 'function') {
    window.budsAPI.quitApp();
  } else {
    window.close();
  }
}

if (btnHeaderQuit) {
  btnHeaderQuit.addEventListener('click', handleQuit);
}

if (btnQuit) {
  btnQuit.addEventListener('click', handleQuit);
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
    handleQuit();
  }
});

// Initialization
async function init() {
  console.log('[BudsBar UI] Initializing... budsAPI available:', Boolean(window.budsAPI));
  
  if (window.budsAPI) {
    if (typeof window.budsAPI.onStateChanged === 'function') {
      window.budsAPI.onStateChanged((state) => {
        console.log('[BudsBar UI] Received state-update:', state);
        updateUI(state);
      });
    }

    if (typeof window.budsAPI.getState === 'function') {
      try {
        const initialState = await window.budsAPI.getState();
        updateUI(initialState);
      } catch (err) {
        console.error('Failed to get initial state:', err);
      }
    }
  } else {
    // Render default state
    updateUI(currentState);
  }
}

document.addEventListener('DOMContentLoaded', init);
