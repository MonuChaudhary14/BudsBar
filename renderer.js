// ==========================================================================
// BudsBar - Renderer & State Synchronization
// ==========================================================================

// Initial State (defaults to disconnected until hardware confirms)
let currentState = {
  connected: false,
  ancMode: 'off', // 'cancellation' | 'off' | 'transparency'
  gameMode: false,
  eqPreset: 'bass_boost', // 'balanced' | 'bass_boost' | 'clear_vocals' | 'bright'
  battery: {
    left: 0,
    right: 0,
    case: 0,
    chargingLeft: false,
    chargingRight: false,
    chargingCase: false
  },
  deviceInfo: {
    name: 'realme Buds T310',
    model: 'RMA2302',
    firmwareVersion: '1.1.0.89'
  },
  rssi: null
};

// DOM References
const deviceNameEl = document.getElementById('deviceName');
const statusIndicatorEl = document.getElementById('statusIndicator');
const statusDotEl = document.getElementById('statusDot');
const statusTextEl = document.getElementById('statusText');
const codecTagEl = document.getElementById('codecTag') || document.querySelector('.codec-tag');
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

// Update Bluetooth RSSI Signal Bars
function updateSignalBars(rssi) {
  if (!signalGaugeEl) return;
  const bars = signalGaugeEl.querySelectorAll('.sig-bar');
  if (!bars || bars.length < 4) return;

  if (rssi === null || rssi === undefined) {
    bars.forEach((bar) => {
      bar.style.background = 'rgba(255, 255, 255, 0.16)';
      bar.style.opacity = '0.3';
    });
    return;
  }

  let activeCount = 4;
  let healthColor = 'var(--color-teal)';

  if (rssi < -85) {
    activeCount = 1;
    healthColor = 'var(--color-red)';
  } else if (rssi < -75) {
    activeCount = 2;
    healthColor = 'var(--color-amber)';
  } else if (rssi < -65) {
    activeCount = 3;
    healthColor = 'var(--color-teal)';
  }

  bars.forEach((bar, idx) => {
    if (idx < activeCount) {
      bar.style.background = healthColor;
      bar.style.opacity = '1';
    } else {
      bar.style.background = 'rgba(255, 255, 255, 0.16)';
      bar.style.opacity = '0.3';
    }
  });
}

// Render Complete State to UI
function updateUI(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };

  // Device Info
  if (state.deviceInfo && deviceNameEl) {
    deviceNameEl.textContent = state.deviceInfo.name || 'realme Buds T310';
  }

  // Connection Status
  const isConn = Boolean(currentState.connected);
  if (statusIndicatorEl) {
    statusIndicatorEl.classList.toggle('disconnected', !isConn);
  }
  if (statusDotEl) {
    statusDotEl.className = isConn ? 'status-dot' : 'status-dot disconnected';
  }
  if (statusTextEl) {
    statusTextEl.textContent = isConn ? 'Connected' : 'Disconnected';
    statusTextEl.style.color = isConn ? 'var(--text-secondary)' : 'var(--color-red)';
  }
  if (codecTagEl) {
    codecTagEl.textContent = isConn ? 'AAC 48kHz' : 'Disconnected';
    codecTagEl.style.opacity = isConn ? '1' : '0.45';
  }

  // Battery Pods & Gauges
  const cardLeft = document.getElementById('cardLeft');
  const cardRight = document.getElementById('cardRight');
  const cardCase = document.getElementById('cardCase');

  if (cardLeft) cardLeft.classList.toggle('disconnected', !isConn);
  if (cardRight) cardRight.classList.toggle('disconnected', !isConn);
  if (cardCase) cardCase.classList.toggle('disconnected', !isConn);

  if (!isConn) {
    if (valLeftEl) valLeftEl.textContent = '--';
    if (valRightEl) valRightEl.textContent = '--';
    if (valCaseEl) valCaseEl.textContent = '--';
    if (ringLeftEl) ringLeftEl.setAttribute('stroke-dasharray', '0, 100');
    if (ringRightEl) ringRightEl.setAttribute('stroke-dasharray', '0, 100');
    if (ringCaseEl) ringCaseEl.setAttribute('stroke-dasharray', '0, 100');
    if (chargeLeftEl) chargeLeftEl.classList.remove('active');
    if (chargeRightEl) chargeRightEl.classList.remove('active');
    if (chargeCaseEl) chargeCaseEl.classList.remove('active');
    updateSignalBars(null);
  } else if (state.battery) {
    if (valLeftEl) valLeftEl.textContent = `${state.battery.left}%`;
    if (valRightEl) valRightEl.textContent = `${state.battery.right}%`;
    if (valCaseEl) valCaseEl.textContent = `${state.battery.case}%`;

    updateBatteryRing(ringLeftEl, state.battery.left);
    updateBatteryRing(ringRightEl, state.battery.right);
    updateBatteryRing(ringCaseEl, state.battery.case);

    if (chargeLeftEl) chargeLeftEl.classList.toggle('active', Boolean(state.battery.chargingLeft));
    if (chargeRightEl) chargeRightEl.classList.toggle('active', Boolean(state.battery.chargingRight));
    if (chargeCaseEl) chargeCaseEl.classList.toggle('active', Boolean(state.battery.chargingCase));
    updateSignalBars(state.rssi !== undefined && state.rssi !== null ? state.rssi : -52);
  }

  // ANC Mode
  if (state.ancMode) {
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
    eqButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-eq') === state.eqPreset);
    });

    if (eqStatusBadgeEl) {
      eqStatusBadgeEl.textContent = EQ_LABELS[state.eqPreset] || state.eqPreset;
    }
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
  try {
    localStorage.removeItem('budsbar_anc');
    localStorage.removeItem('budsbar_eq');
  } catch (e) {}

  // Apply default state immediately to keep slider aligned to Normal
  updateUI(currentState);

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
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
