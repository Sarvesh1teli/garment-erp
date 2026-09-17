const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalApi } = require('./local-api.cjs');

let mainWindow;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
  return;
}

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

  try {
    try { await win.webContents.emulateMediaType('print'); } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
      printHeaderFooter: false,
    });
    fs.writeFileSync(filePath, data);
    return { saved: true, filePath };
  } finally {
    try { await win.webContents.emulateMediaType(null); } catch {}
    if (win && !win.isDestroyed()) {
      win.focus();
    }
  }
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
      try {
        const response = await fetch('http://127.0.0.1:47831/api/health');
        const health = await response.json();
        if (response.ok && health?.status === 'ok' && health?.database === 'sqlite') {
          createWindow();
          return;
        }
      } catch { /* API not active */ }

      const isPortInUse = error?.code === 'EADDRINUSE';
      const isDiskIoErr = String(error?.message || error).toLowerCase().includes('disk i/o');
      const errorDetail = isPortInUse || isDiskIoErr
        ? 'Another instance of Teli ThreadFlow ERP is already running in the background.\n\nPlease open Task Manager (Ctrl + Shift + Esc), close any lingering ThreadFlow / electron.exe processes, and open ThreadFlow again.'
        : String(error?.message || error);

      dialog.showErrorBox('Teli ThreadFlow ERP could not start', errorDetail);
      app.quit();
    }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
