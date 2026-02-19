const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV !== 'production'

// Path for storing recent projects
const userDataPath = app.getPath('userData')
const recentProjectsPath = path.join(userDataPath, 'recentProjects.json')
const autoSavePath = path.join(os.tmpdir(), 'storyboard-autosave.shotlist')

function loadRecentProjects() {
  try {
    if (fs.existsSync(recentProjectsPath)) {
      const data = fs.readFileSync(recentProjectsPath, 'utf8')
      return JSON.parse(data)
    }
  } catch (e) {
    // ignore
  }
  return []
}

function saveRecentProjects(projects) {
  try {
    fs.writeFileSync(recentProjectsPath, JSON.stringify(projects), 'utf8')
  } catch (e) {
    // ignore
  }
}

function addToRecentProjects(filePath, name) {
  let projects = loadRecentProjects()
  // Remove existing entry for this path
  projects = projects.filter(p => p.path !== filePath)
  // Add to front
  projects.unshift({ path: filePath, name, lastOpened: new Date().toISOString() })
  // Keep only last 5
  projects = projects.slice(0, 5)
  saveRecentProjects(projects)
  return projects
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    backgroundColor: '#faf9f7',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ---- IPC Handlers ----

// Save project file
ipcMain.handle('save-file', async (event, { defaultName, data }) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'untitled.shotlist',
    filters: [{ name: 'Shotlist Files', extensions: ['shotlist'] }],
  })
  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }
  const filePath = result.filePath
  fs.writeFileSync(filePath, data, 'utf8')

  // Check file size and warn if > 50MB
  const stats = fs.statSync(filePath)
  const sizeMB = stats.size / (1024 * 1024)
  const name = path.basename(filePath, '.shotlist')
  addToRecentProjects(filePath, name)

  return { filePath, sizeMB, canceled: false }
})

// Save to existing path (no dialog)
ipcMain.handle('save-file-path', async (event, { filePath, data }) => {
  fs.writeFileSync(filePath, data, 'utf8')
  const stats = fs.statSync(filePath)
  const sizeMB = stats.size / (1024 * 1024)
  return { filePath, sizeMB }
})

// Auto-save to temp file
ipcMain.handle('auto-save', async (event, { data }) => {
  try {
    fs.writeFileSync(autoSavePath, data, 'utf8')
    return { success: true, path: autoSavePath }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Open file dialog
ipcMain.handle('open-file', async (event) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Shotlist Files', extensions: ['shotlist'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }
  const filePath = result.filePaths[0]
  const data = fs.readFileSync(filePath, 'utf8')
  const name = path.basename(filePath, '.shotlist')
  addToRecentProjects(filePath, name)
  return { filePath, data, name, canceled: false }
})

// Open specific file
ipcMain.handle('open-file-path', async (event, { filePath }) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const name = path.basename(filePath, '.shotlist')
    addToRecentProjects(filePath, name)
    return { filePath, data, name, canceled: false }
  } catch (e) {
    return { canceled: false, error: e.message }
  }
})

// Get recent projects
ipcMain.handle('get-recent-projects', async () => {
  return loadRecentProjects()
})

// Clear recent projects
ipcMain.handle('clear-recent-projects', async () => {
  saveRecentProjects([])
  return []
})

// Get auto-save path
ipcMain.handle('get-autosave-path', async () => {
  return autoSavePath
})

// Check if autosave exists
ipcMain.handle('check-autosave', async () => {
  const exists = fs.existsSync(autoSavePath)
  return { exists, path: autoSavePath }
})
