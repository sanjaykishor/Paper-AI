const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (callback) => {
    ipcRenderer.on('evaluation-results', (event, ...args) => callback({channel: 'evaluation-results', data: args[0]}));
    ipcRenderer.on('database-update-success', (event, ...args) => callback({channel: 'database-update-success', data: args[0]}));
    ipcRenderer.on('database-update-error', (event, ...args) => callback({channel: 'database-update-error', data: args[0]}));
    // Add more channels here if needed
  }
});