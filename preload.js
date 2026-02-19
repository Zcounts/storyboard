const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (defaultName, data) => ipcRenderer.invoke('save-file', { defaultName, data }),
  saveFilePath: (filePath, data) => ipcRenderer.invoke('save-file-path', { filePath, data }),
  autoSave: (data) => ipcRenderer.invoke('auto-save', { data }),
  openFile: () => ipcRenderer.invoke('open-file'),
  openFilePath: (filePath) => ipcRenderer.invoke('open-file-path', { filePath }),

  // Recent projects
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  clearRecentProjects: () => ipcRenderer.invoke('clear-recent-projects'),

  // Auto-save
  getAutoSavePath: () => ipcRenderer.invoke('get-autosave-path'),
  checkAutoSave: () => ipcRenderer.invoke('check-autosave'),
})
