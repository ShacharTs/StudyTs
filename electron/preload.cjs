'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The web app talks to the updater through these calls only; it never gets raw ipcRenderer access.
contextBridge.exposeInMainWorld('studytsDesktop', {
  isDesktop: true,
  platform: process.platform,
  update: {
    getState: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    installAndRestart: () => ipcRenderer.invoke('update:install'),
    openReleasePage: () => ipcRenderer.invoke('update:open-page'),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('update:state', listener);
      return () => ipcRenderer.removeListener('update:state', listener);
    },
  },
  mcp: {
    openFolder: () => ipcRenderer.invoke('mcp:open-folder'),
  },
});
