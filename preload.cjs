const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('budsAPI', {
  getState: () => ipcRenderer.invoke('buds:get-state'),
  setAncMode: (mode) => ipcRenderer.invoke('buds:set-anc', mode),
  setGameMode: (enabled) => ipcRenderer.invoke('buds:set-game-mode', enabled),
  setEqPreset: (preset) => ipcRenderer.invoke('buds:set-eq', preset),
  toggleConnection: () => ipcRenderer.invoke('buds:toggle-connection'),
  onStateChanged: (callback) => {
    ipcRenderer.on('buds:state-update', (_event, state) => callback(state));
  },
  openExternal: (url) => ipcRenderer.send('buds:open-external', url),
  quitApp: () => ipcRenderer.send('buds:quit')
});
