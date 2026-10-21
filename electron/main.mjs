import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, shell, nativeTheme, protocol, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from '../src/engine.mjs';
import { handleApi, exportCsv } from '../src/api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
// Packaged: extraResources live next to app.asar; development: the repo folders
const RESOURCE_DIR = app.isPackaged ? process.resourcesPath : path.join(APP_DIR, 'resources');
const PROBE_PATH = app.isPackaged ? path.join(process.resourcesPath, 'dmprobe.exe') : path.join(APP_DIR, 'build', 'dmprobe.exe');
const ICON_ICO = path.join(PUBLIC_DIR, 'icon.ico');
const ICON_PNG = path.join(PUBLIC_DIR, 'icon.png');
const ORIGIN = 'app://darkmirror';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } }
]);

app.setAppUserModelId('com.darkmirror.app');
app.setName('DarkMirror');

const logFile = () => path.join(app.getPath('userData'), 'logs', 'main.log');
function log(msg) {
  try {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}
process.on('uncaughtException', (err) => log(`UNCAUGHT ${err?.stack || err}`));
process.on('unhandledRejection', (err) => log(`UNHANDLED ${err?.stack || err}`));

let mainWindow = null;
let notifyWindow = null;
let notifyTimer = null;
let tray = null;
let isQuitting = false;
let isMiniViewer = false;
let savedBounds = { width: 1360, height: 850 };

const windowGround = () => (nativeTheme.shouldUseDarkColors ? '#0e1526' : '#f3f4ef');

const secureWebPreferences = () => ({
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  spellcheck: false
});

// Serves public/ and the in-process API over app:// — no TCP port is opened
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'darkmirror') return new Response('Not found', { status: 404 });
    if (url.pathname.startsWith('/api/')) return handleApi(request);

    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (ext === '.html') headers['Content-Security-Policy'] = CSP;
      return new Response(data, { headers });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function hardenWebContents(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function buildTrayMenu() {
  if (!tray) return;
  const s = engine.getSettings();
  const toggle = (key) => (item) => {
    engine.updateSettings({ [key]: item.checked });
    buildTrayMenu();
  };
  tray.setToolTip('DarkMirror');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'DarkMirror', enabled: false, icon: nativeImage.createFromPath(ICON_PNG).resize({ width: 16, height: 16 }) },
      { type: 'separator' },
      { label: 'Pencereyi göster', click: () => showMain() },
      { label: 'Mini görüntüleyici', type: 'checkbox', checked: isMiniViewer, click: () => toggleMiniViewerMode(!isMiniViewer) },
      { type: 'separator' },
      { label: 'Grafik', click: () => showAndNavigate('graph') },
      { label: 'Güvenlik Duvarı', click: () => showAndNavigate('firewall') },
      { label: 'Kullanım', click: () => showAndNavigate('usage') },
      { label: 'Ağ', click: () => showAndNavigate('network') },
      { label: 'Uyarılar', click: () => showAndNavigate('alerts') },
      { type: 'separator' },
      { label: 'Gizli mod', type: 'checkbox', checked: s.incognito === 'true', click: toggle('incognito') },
      { label: 'Bildirimleri ertele', type: 'checkbox', checked: s.snooze === 'true', click: toggle('snooze') },
      { type: 'separator' },
      { label: 'Çıkış', click: () => { isQuitting = true; app.quit(); } }
    ])
  );
}

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function showAndNavigate(tab) {
  if (isMiniViewer) toggleMiniViewerMode(false);
  showMain();
  send('navigate:tab', tab);
}

function toggleMiniViewerMode(enable) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  isMiniViewer = Boolean(enable);
  if (isMiniViewer) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    savedBounds = mainWindow.getBounds();
    mainWindow.setMinimumSize(360, 250);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setBounds({
      width: 420,
      height: 290,
      x: savedBounds.x + Math.max(0, savedBounds.width - 440),
      y: savedBounds.y + Math.max(0, savedBounds.height - 320)
    });
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(1024, 660);
    mainWindow.setBounds(savedBounds);
  }
  send('window:mini-viewer-changed', isMiniViewer);
  buildTrayMenu();
  return isMiniViewer;
}

// Bottom-right desktop notification, shown only for alerts the engine marks as notify
async function ensureNotifyWindow() {
  if (notifyWindow && !notifyWindow.isDestroyed()) return notifyWindow;
  const { workArea } = screen.getPrimaryDisplay();
  const width = 392;
  const height = 182;
  notifyWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 14,
    y: workArea.y + workArea.height - height - 14,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    backgroundColor: windowGround(),
    webPreferences: secureWebPreferences()
  });
  hardenWebContents(notifyWindow.webContents);
  await notifyWindow.loadURL(`${ORIGIN}/notification.html`);
  return notifyWindow;
}

async function showNotification(alertItem) {
  // When the main window is in front the in-app card is enough
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused()) return;
  try {
    const win = await ensureNotifyWindow();
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(workArea.x + workArea.width - 406, workArea.y + workArea.height - 196);
    win.webContents.send('popup:data', alertItem);
    win.showInactive();
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => notifyWindow && !notifyWindow.isDestroyed() && notifyWindow.hide(), 10000);
  } catch (err) {
    log(`notification error: ${err.message}`);
  }
}

async function createMainWindow() {
  registerAppProtocol();
  await engine.init({
    dataDir: path.join(app.getPath('userData'), 'data'),
    resourceDir: RESOURCE_DIR,
    probePath: PROBE_PATH,
    protectedPaths: [process.execPath, PROBE_PATH],
    version: app.getVersion()
  });

  engine.events.on('tick', (t) => send('dm:tick', t));
  engine.events.on('alert', (a) => {
    send('dm:alert', a);
    showNotification(a);
  });
  engine.events.on('settings', (s) => {
    send('settings:updated', s);
    buildTrayMenu();
  });

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 1024,
    minHeight: 660,
    frame: false,
    backgroundColor: windowGround(),
    title: 'DarkMirror',
    icon: ICON_ICO,
    show: false,
    webPreferences: secureWebPreferences()
  });
  hardenWebContents(mainWindow.webContents);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  await mainWindow.loadURL(`${ORIGIN}/index.html`);

  ensureNotifyWindow().catch(() => {});
  try {
    tray = new Tray(nativeImage.createFromPath(ICON_ICO));
    tray.on('click', showMain);
    buildTrayMenu();
  } catch (err) {
    log(`tray error: ${err.message}`);
  }
}

// ---------------------------------------------------------------- IPC
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { isMaximized: false };
  if (isMiniViewer) {
    toggleMiniViewerMode(false);
  } else if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return { isMaximized: mainWindow.isMaximized(), isMiniViewer };
});
// The close button hides to the tray; "Çıkış" in the menu quits
ipcMain.handle('window:close', () => mainWindow?.hide());
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('window:mini-viewer', (_e, enable) => ({ isMiniViewer: toggleMiniViewerMode(typeof enable === 'boolean' ? enable : !isMiniViewer) }));
ipcMain.handle('window:state', () => ({ isMaximized: Boolean(mainWindow?.isMaximized()), isMiniViewer }));
ipcMain.handle('theme:set', (_e, pref) => {
  nativeTheme.themeSource = pref === 'light' || pref === 'dark' ? pref : 'system';
  return nativeTheme.themeSource;
});
ipcMain.handle('shell:open-location', (_e, target) => {
  if (typeof target === 'string' && fs.existsSync(target)) {
    shell.showItemInFolder(target);
    return { ok: true };
  }
  return { ok: false };
});
ipcMain.handle('shell:open-external', (_e, url) => {
  // Only the few links the app itself shows
  if (typeof url === 'string' && /^https:\/\/(www\.virustotal\.com|db-ip\.com|github\.com)\//.test(url)) shell.openExternal(url);
});
ipcMain.handle('dialog:pick-exe', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Engellenecek uygulamayı seçin',
    properties: ['openFile'],
    filters: [{ name: 'Uygulamalar', extensions: ['exe'] }]
  });
  return res.canceled ? null : res.filePaths[0];
});
ipcMain.handle('export:csv', async (_e, kind) => {
  const name = kind === 'network' ? 'darkmirror-ag-cihazlari.csv' : 'darkmirror-uygulama-kullanimi.csv';
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'CSV olarak kaydet',
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false };
  await fs.promises.writeFile(res.filePath, exportCsv(kind), 'utf8');
  return { ok: true, path: res.filePath };
});
ipcMain.handle('app:relaunch-admin', async () => {
  // Re-start elevated through the standard UAC prompt
  const { execFile } = await import('node:child_process');
  const args = app.isPackaged ? [] : [APP_DIR];
  const ps = `Start-Process -FilePath '${process.execPath.replace(/'/g, "''")}' ${args.length ? `-ArgumentList '"${args[0].replace(/'/g, "''")}"'` : ''} -Verb RunAs`;
  execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }, (err) => {
    if (!err) {
      isQuitting = true;
      app.quit();
    }
  });
});
ipcMain.handle('popup:close', () => notifyWindow?.hide());
ipcMain.handle('popup:open-alerts', () => {
  notifyWindow?.hide();
  showAndNavigate('alerts');
});
// ---------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (isMiniViewer) toggleMiniViewerMode(false);
    showMain();
  });
  app.whenReady().then(createMainWindow).catch((err) => log(`startup failed: ${err?.stack || err}`));
}

app.on('web-contents-created', (_e, contents) => hardenWebContents(contents));
app.on('before-quit', () => {
  isQuitting = true;
  engine.stop();
});
app.on('window-all-closed', () => app.quit());
