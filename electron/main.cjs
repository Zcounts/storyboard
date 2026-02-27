'use strict'

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'ShotScribe',
    backgroundColor: '#e8e4db',
    show: false,
    // On macOS the first click on an unfocused window normally only focuses
    // the window without activating the clicked element (standard macOS
    // behaviour).  acceptFirstMouse: true passes that first click straight
    // through to the DOM so every input/button is immediately editable on
    // first click, even after the app has just opened.
    acceptFirstMouse: true,
  })

  // Show window once ready to avoid white flash
  win.once('ready-to-show', () => win.show())

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  // Remove default menu bar in production
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }

  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Save project ────────────────────────────────────────────────────────
ipcMain.handle('dialog:save-project', async (_event, { defaultName, data }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: defaultName,
    filters: [{ name: 'Shotlist Project', extensions: ['shotlist'] }],
  })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, data, 'utf8')
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Open project ────────────────────────────────────────────────────────
ipcMain.handle('dialog:open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Project',
    filters: [{ name: 'Shotlist Project', extensions: ['shotlist', 'json'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { success: false }
  try {
    const data = fs.readFileSync(filePaths[0], 'utf8')
    return { success: true, data, filePath: filePaths[0] }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Open project from known path ───────────────────────────────────────
ipcMain.handle('dialog:open-project-path', async (_event, { filePath }) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return { success: true, data, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Save PDF ────────────────────────────────────────────────────────────
ipcMain.handle('dialog:save-pdf', async (_event, { defaultName, buffer }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Save PNG ────────────────────────────────────────────────────────────
ipcMain.handle('dialog:save-png', async (_event, { defaultName, base64 }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export PNG',
    defaultPath: defaultName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Export PDF pages via hidden BrowserWindow ───────────────────────────
// Renders each page HTML in an off-screen BrowserWindow, captures a PNG
// screenshot, and returns the raw PNG bytes to the renderer.  The renderer
// then assembles the pages into a single PDF using jsPDF.
//
// pageData: Array<{ fullHtml: string, width: number, height: number }>
// Returns:  Array<{ pngData: number[], width, height } | { error: string }>
ipcMain.handle('dialog:export-pdf-pages', async (_event, pageData) => {
  const results = []

  for (let i = 0; i < pageData.length; i++) {
    const { fullHtml, width, height } = pageData[i]
    const PAGE_TIMEOUT_MS = 60000  // 60 second hard timeout per page
    let win = null
    let tempFile = null

    console.log(`[PDF Main] Rendering page ${i + 1}/${pageData.length} (${width}×${height}px)…`)

    try {
      // Write page HTML to a temp file so the hidden window can load it via
      // the file:// protocol (avoids data-URI size limits and encoding issues)
      tempFile = path.join(os.tmpdir(), `shotscribe_pdf_${Date.now()}_${i}.html`)
      fs.writeFileSync(tempFile, fullHtml, 'utf8')

      win = new BrowserWindow({
        width: Math.ceil(width),
        height: Math.ceil(height),
        show: false,
        frame: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          // Allow loading local images embedded as data URIs
          webSecurity: false,
        },
      })

      // Load temp file with hard timeout
      await Promise.race([
        win.loadFile(tempFile),
        new Promise((_res, rej) =>
          setTimeout(
            () => rej(new Error(`Page ${i + 1} load timeout after ${PAGE_TIMEOUT_MS / 1000}s`)),
            PAGE_TIMEOUT_MS
          )
        ),
      ])

      // Give the renderer a moment to finish layout, fonts, and image decoding
      await new Promise(resolve => setTimeout(resolve, 2500))

      // Capture the full window contents as a NativeImage
      const nativeImg = await Promise.race([
        win.webContents.capturePage({ x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height) }),
        new Promise((_res, rej) =>
          setTimeout(() => rej(new Error(`Page ${i + 1} capture timeout`)), 15000)
        ),
      ])

      const pngBuffer = nativeImg.toPNG()
      console.log(`[PDF Main] Page ${i + 1} captured — ${(pngBuffer.length / 1024).toFixed(0)}KB`)

      results.push({ pngData: Array.from(pngBuffer), width, height })
    } catch (err) {
      console.error(`[PDF Main] Page ${i + 1} failed:`, err.message)
      // Return an error record so the renderer can log it and skip this page
      results.push({ pngData: null, width, height, error: err.message })
    } finally {
      if (win && !win.isDestroyed()) {
        win.close()
        win = null
      }
      if (tempFile) {
        try { fs.unlinkSync(tempFile) } catch { /* ignore cleanup errors */ }
      }
    }
  }

  console.log(`[PDF Main] All pages processed (${results.filter(r => r.pngData).length}/${pageData.length} succeeded)`)
  return results
})
