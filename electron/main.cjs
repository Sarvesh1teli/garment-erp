const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalApi } = require('./local-api.cjs');

let mainWindow;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

if (process.env.VITE_HTTPS === 'true') {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f4f7f5',
    title: 'Teli ThreadFlow Garment',
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    mainWindow.show();
    dialog.showErrorBox('Teli ThreadFlow ERP', `Unable to load the application (${code}): ${description}`);
  });
  const showFallback = setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 5000);
  mainWindow.once('show', () => clearTimeout(showFallback));
  const dev = !app.isPackaged;
  const devUrl = process.env.VITE_HTTPS === 'true' ? 'https://localhost:5173' : 'http://localhost:5173';
  dev ? mainWindow.loadURL(devUrl) : mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
};

ipcMain.handle('save-pdf', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error('Print window unavailable');
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save PDF',
    defaultPath: `ThreadFlow-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { saved: false };
  const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true, scale: 1, printHeaderFooter: false });
  fs.writeFileSync(filePath, data);
  return { saved: true, filePath };
});

if (hasLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    if (app.isPackaged) app.setAppUserModelId('in.teli.threadflow');
    try {
      await startLocalApi({ dataDirectory: app.getPath('userData') });
      createWindow();
    } catch (error) {
      if (error?.code === 'EADDRINUSE') {
        try {
          const response = await fetch('http://127.0.0.1:47831/api/health');
          const health = await response.json();
          if (response.ok && health?.status === 'ok' && health?.database === 'sqlite') {
            createWindow();
            return;
          }
        } catch { /* handled below */ }
      }
      dialog.showErrorBox('Teli ThreadFlow ERP could not start', error?.code === 'EADDRINUSE' ? 'Local port 47831 is being used by another program. Close the other program and open ThreadFlow again.' : String(error?.message || error));
      app.quit();
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
