const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (callback) => {
  ipcRenderer.on(channel, (_event, payload) => callback(payload));
};

contextBridge.exposeInMainWorld('darkMirrorDesktop', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('app:quit'),
  toggleMiniViewer: (enabled) => ipcRenderer.invoke('window:mini-viewer', enabled),
  getWindowState: () => ipcRenderer.invoke('window:state'),
  setTheme: (pref) => ipcRenderer.invoke('theme:set', pref),
  openFileLocation: (filePath) => ipcRenderer.invoke('shell:open-location', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  pickExecutable: () => ipcRenderer.invoke('dialog:pick-exe'),
  exportCsv: (kind) => ipcRenderer.invoke('export:csv', kind),
  relaunchAsAdmin: () => ipcRenderer.invoke('app:relaunch-admin'),
  closeNotification: () => ipcRenderer.invoke('popup:close'),
  openAlertsFromNotification: () => ipcRenderer.invoke('popup:open-alerts'),
  onNotificationData: on('popup:data'),
  onTick: on('dm:tick'),
  onAlert: on('dm:alert'),
  onNavigateTab: on('navigate:tab'),
  onSettingsUpdated: on('settings:updated'),
  onMiniViewerChanged: on('window:mini-viewer-changed')
});
