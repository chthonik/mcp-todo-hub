const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const DEFAULT_SERVER_URL = 'http://144.144.1.127:3456';
const CONFIG_FILE = path.join(app.getPath('userData'), 'server-config.json');
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function getServerUrl() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            if (config.serverUrl) return config.serverUrl;
        }
    } catch (_) { }
    return DEFAULT_SERVER_URL;
}

const SERVER_URL = getServerUrl();

let mainWindow;

// ─── Window State Persistence ───
function loadWindowState() {
    try {
        if (fs.existsSync(WINDOW_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf-8'));
        }
    } catch (_) { }
    return { width: 1200, height: 800 };
}

function saveWindowState() {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    try {
        fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify({ ...bounds, isMaximized }));
    } catch (_) { }
}

// ─── Server Health Check ───
function checkServer() {
    return new Promise((resolve) => {
        const req = http.get(SERVER_URL, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// ─── Create Window ───
function createWindow() {
    const state = loadWindowState();

    mainWindow = new BrowserWindow({
        width: state.width,
        height: state.height,
        x: state.x,
        y: state.y,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#1a1a1a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (state.isMaximized) {
        mainWindow.maximize();
    }

    // Save state on resize/move
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('close', saveWindowState);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Show window once content is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open external links in the system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    loadApp();
}

// ─── Load App or Splash ───
async function loadApp() {
    const serverReady = await checkServer();

    if (serverReady) {
        mainWindow.loadURL(SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, 'splash.html'));
    }
}

// ─── IPC Handlers ───
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('retry-connection', async () => {
    if (mainWindow) {
        await loadApp();
    }
});

// ─── App Menu ───
function buildMenu() {
    const isMac = process.platform === 'darwin';

    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload App',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => loadApp(),
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                ] : [
                    { role: 'close' },
                ]),
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── App Lifecycle ───
app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
