const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('threadflow', {
  savePdf: () => ipcRenderer.invoke('save-pdf'),
});
