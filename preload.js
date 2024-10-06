const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (callback) => {
    ipcRenderer.on('evaluation-results', (event, ...args) => callback({channel: 'evaluation-results', data: args[0]}));
    // Add more channels here if needed
  }
});