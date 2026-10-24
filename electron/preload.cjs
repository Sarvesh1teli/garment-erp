const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('threadflow', {
  garmentSmsRequest: (endpoint,options) => ipcRenderer.invoke('garment-sms-request',endpoint,options),
  savePdf: () => ipcRenderer.invoke('save-pdf'),
  garmentCloudRequest: (endpoint,options) => ipcRenderer.invoke('garment-cloud-request',endpoint,options),
  garmentCloudSnapshot: () => ipcRenderer.invoke('garment-cloud-snapshot'),
  publishGarmentTypes: types => ipcRenderer.invoke('garment-catalog-publish',types),
  syncGarmentBusinessName: name => ipcRenderer.invoke('garment-business-name',name),
  exportGarmentBusiness: () => ipcRenderer.invoke('garment-business-export'),
  importGarmentBusiness: () => ipcRenderer.invoke('garment-business-import'),
});
