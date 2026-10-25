// ==========================================================================
// BudsBar - Renderer & State Synchronization
// ==========================================================================

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

// DOM References
const deviceNameEl = document.getElementById('deviceName');
const statusDotEl = document.getElementById('statusDot');
const statusTextEl = document.getElementById('statusText');
const btnRefresh = document.getElementById('btnRefresh');
const ambientGlowEl = document.getElementById('ambientGlow');
const ambientGlowSecEl = document.getElementById('ambientGlowSec');

// Battery Elements
const valLeftEl = document.getElementById('valLeft');
const valRightEl = document.getElementById('valRight');
const valCaseEl = document.getElementById('valCase');

const ringLeftEl = document.getElementById('ringLeft');
const ringRightEl = document.getElementById('ringRight');
const ringCaseEl = document.getElementById('ringCase');

const chargeLeftEl = document.getElementById('chargeLeft');
const chargeRightEl = document.getElementById('chargeRight');
const chargeCaseEl = document.getElementById('chargeCase');

// Control Groups
const ancButtons = document.querySelectorAll('.anc-pill, .segment-btn, .segmented-option');
const ancPillSlider = document.getElementById('ancPillSlider');
const ancCaptionEl = document.getElementById('ancCaption');

const eqButtons = document.querySelectorAll('.eq-card, .eq-btn, .eq-chip');
const eqStatusBadgeEl = document.getElementById('eqStatusBadge');
const chkGameMode = document.getElementById('chkGameMode');
const gameBannerEl = document.querySelector('.game-mode-banner');
const gameLatencyTag = document.getElementById('gameLatencyTag');

// Footer Actions
const signalGaugeEl = document.getElementById('signalGauge');
const btnQuit = document.getElementById('btnQuit');

// High-Fidelity Captions for ANC states
const ANC_CONFIG = {
  'cancellation': {
    caption: 'Active Noise Cancellation • 46dB Hybrid Cut',
    dotColor: 'var(--color-teal)',
    glowClass: '',
    sliderClass: 'cancellation'
  },
  'off': {
    caption: 'Normal mode • Noise control off',
    dotColor: '#94A3B8',
    glowClass: 'off',
    sliderClass: 'off'
  },
  'transparency': {
    caption: 'Transparency • Ambient sound pass-through',
    dotColor: 'var(--color-violet)',
    glowClass: 'transparency',
    sliderClass: 'transparency'
  }
};

const EQ_LABELS = {
  'bass_boost': 'Bass Boost+',
  'balanced': 'Balanced',
  'clear_vocals': 'Clear Vocals',
  'bright': 'Nature Bright'
};

// Update Circular Battery Ring Gauge
function updateBatteryRing(ringEl, pct) {
  if (!ringEl) return;
  const clamped = Math.max(0, Math.min(100, pct));
  ringEl.setAttribute('stroke-dasharray', `${clamped}, 100`);

  if (clamped <= 20) {
    ringEl.style.stroke = 'var(--color-red)';
    ringEl.style.filter = 'drop-shadow(0 0 6px var(--color-red-glow))';
  } else if (clamped <= 35) {
    ringEl.style.stroke = 'var(--color-amber)';
    ringEl.style.filter = 'drop-shadow(0 0 6px var(--color-amber-glow))';
  } else {
    ringEl.style.stroke = 'var(--color-teal)';
    ringEl.style.filter = 'drop-shadow(0 0 6px var(--color-teal-glow))';
  }
}

// Update Bluetooth RSSI Signal Bars & Link Health
function updateSignalBars(rssi) {
  if (!signalGaugeEl) return;
  const bars = signalGaugeEl.querySelectorAll('.sig-bar');
  if (!bars || bars.length < 4) return;

  let activeCount = 4;
  let healthText = 'Excellent';
  let healthColor = 'var(--color-teal)';

  if (rssi < -85) {
    activeCount = 1;
    healthText = 'Weak';
    healthColor = 'var(--color-red)';
  } else if (rssi < -75) {
    activeCount = 2;
    healthText = 'Fair';
    healthColor = 'var(--color-amber)';
  } else if (rssi < -65) {
    activeCount = 3;
    healthText = 'Good';
    healthColor = 'var(--color-teal)';
  }

  bars.forEach((bar, idx) => {
    if (idx < activeCount) {
      bar.style.background = healthColor;
      bar.style.opacity = '1';
    } else {
      bar.style.background = 'rgba(255, 255, 255, 0.16)';
      bar.style.opacity = '0.5';
    }
  });

  if (linkHealthEl) {
    linkHealthEl.textContent = healthText;
    linkHealthEl.style.color = healthColor;
  }
}

// Render Complete State to UI
function updateUI(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };

  // Device Info & Firmware
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
      statusTextEl.style.color = state.connected ? 'var(--text-secondary)' : 'var(--color-red)';
    }
  }

  // Battery Levels & Gauges
  if (state.battery) {
    if (valLeftEl) valLeftEl.textContent = `${state.battery.left}%`;
    if (valRightEl) valRightEl.textContent = `${state.battery.right}%`;
    if (valCaseEl) valCaseEl.textContent = `${state.battery.case}%`;

    updateBatteryRing(ringLeftEl, state.battery.left);
    updateBatteryRing(ringRightEl, state.battery.right);
    updateBatteryRing(ringCaseEl, state.battery.case);

    if (chargeLeftEl) chargeLeftEl.classList.toggle('active', Boolean(state.battery.chargingLeft));
    if (chargeRightEl) chargeRightEl.classList.toggle('active', Boolean(state.battery.chargingRight));
    if (chargeCaseEl) chargeCaseEl.classList.toggle('active', Boolean(state.battery.chargingCase));
  }

  // ANC Mode
  if (state.ancMode) {
    try { localStorage.setItem('budsbar_anc', state.ancMode); } catch (e) {}

    ancButtons.forEach((btn) => {
      const isSelected = btn.getAttribute('data-mode') === state.ancMode;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    const cfg = ANC_CONFIG[state.ancMode] || ANC_CONFIG['off'];

    // Update Sliding Indicator Pill
    if (ancPillSlider) {
      ancPillSlider.className = `anc-pill-slider ${cfg.sliderClass}`;
    }

    if (ancCaptionEl) {
      const dot = ancCaptionEl.querySelector('.badge-dot');
      const text = ancCaptionEl.querySelector('.badge-text') || ancCaptionEl;
      if (dot) dot.style.background = cfg.dotColor;
      if (text) text.textContent = cfg.caption;
    }

    if (ambientGlowEl) {
      if (state.gameMode) {
        ambientGlowEl.className = 'ambient-glow game';
      } else {
        ambientGlowEl.className = `ambient-glow ${cfg.glowClass}`;
      }
    }
  }

  // Game Mode
  if (state.gameMode !== undefined) {
    if (chkGameMode) chkGameMode.checked = Boolean(state.gameMode);
    if (gameBannerEl) gameBannerEl.classList.toggle('active', Boolean(state.gameMode));
    if (gameLatencyTag) {
      gameLatencyTag.textContent = state.gameMode ? '45ms Active' : 'Normal 180ms';
      gameLatencyTag.style.background = state.gameMode ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.08)';
      gameLatencyTag.style.color = state.gameMode ? 'var(--color-cyan)' : 'var(--text-muted)';
      gameLatencyTag.style.borderColor = state.gameMode ? 'rgba(6, 182, 212, 0.45)' : 'transparent';
    }
    if (ambientGlowSecEl) {
      ambientGlowSecEl.style.opacity = state.gameMode ? '1' : '0.4';
    }
  }

  // EQ Preset
  if (state.eqPreset) {
    try { localStorage.setItem('budsbar_eq', state.eqPreset); } catch (e) {}

    eqButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-eq') === state.eqPreset);
    });

    if (eqStatusBadgeEl) {
      eqStatusBadgeEl.textContent = EQ_LABELS[state.eqPreset] || state.eqPreset;
    }
  }

  // RSSI Signal Strength & Telemetry
  if (state.rssi !== undefined) {
    if (rssiInfoEl) rssiInfoEl.textContent = `${state.rssi} dBm`;
    updateSignalBars(state.rssi);
  }
}

// ==========================================================================
// User Interaction Handlers
// ==========================================================================

// ANC Mode Selection
ancButtons.forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const mode = btn.getAttribute('data-mode');
    if (!mode) return;

    // Immediate optimistic update
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
    if (!preset) return;

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

// Refresh Button with Animation
if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
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
    }, 480);
  });
}

// Dedicated Quit Button
if (btnQuit) {
  btnQuit.addEventListener('click', () => {
    if (window.budsAPI && typeof window.budsAPI.quitApp === 'function') {
      window.budsAPI.quitApp();
    } else {
      window.close();
    }
  });
}

// ⌘Q Shortcut to Quit App
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
    if (window.budsAPI && typeof window.budsAPI.quitApp === 'function') {
      window.budsAPI.quitApp();
    } else {
      window.close();
    }
  }
});

// Initialize State
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
