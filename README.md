# BudsBar 🎧
### Desktop Menu-Bar & System Tray Controller for realme Buds T310

A sleek, cross-platform desktop menu-bar companion app for **realme Buds T310** (and compatible Airoha-based realme / OnePlus / Oppo earbuds).

Built using **Electron**, **Vanilla HTML5/CSS3/JavaScript**, and reverse-engineered **Airoha RACE protocol** Bluetooth Low Energy commands.

---

## 🍺 Installation via Homebrew (Recommended)

You can install **BudsBar** with a single command via Homebrew:

```bash
brew install --cask MonuChaudhary14/tap/budsbar
```

Or tap first:

```bash
brew tap MonuChaudhary14/tap
brew install --cask budsbar
```

---

## 📦 Direct Download

Download the latest Apple Silicon DMG from [Releases](https://github.com/MonuChaudhary14/BudsBar/releases):

- **[BudsBar-1.0.0-arm64.dmg](https://github.com/MonuChaudhary14/BudsBar/releases/download/v1.0.0/BudsBar-1.0.0-arm64.dmg)**

---

## ✨ Features

- 🔋 **Live Triple Battery Monitoring**: Real-time visual battery gauges for Left Earbud, Right Earbud, and Charging Case with charging indicators.
- 🔇 **Active Noise Cancellation (ANC)**: Apple-style sliding pill selector between **Noise Cancellation** (46dB), **Off** (passive isolation), and **Transparent** mode.
- ⌨️ **Global OS Hotkeys**:
  - `Cmd + Shift + N` to cycle ANC instantly from any app or full-screen game.
  - `Cmd + Shift + G` to toggle Low-Latency Game Mode.
  - `Cmd + Q` to cleanly quit the app.
- 🎮 **Game Mode (45ms)**: Ultra-low latency dual-channel audio sync.
- 🎵 **Hardware EQ Presets**: Switch between *Bass Boost+*, *Balanced*, *Clear Vocals*, and *Nature Bright* with live acoustic waveforms.
- 💎 **macOS Control Center Glassmorphism**: Translucent obsidian frosted acrylic with dynamic ambient aura.

---

## 🛠️ Local Development

```bash
git clone https://github.com/MonuChaudhary14/BudsBar.git
cd BudsBar
npm install
npm run dev
```

Build the native `.app` and `.dmg`:
```bash
npm run pack   # builds dist/mac-arm64/BudsBar.app
npm run dist   # builds dist/BudsBar-1.0.0-arm64.dmg
```

---

## 📄 License
MIT © Monu Chaudhary
