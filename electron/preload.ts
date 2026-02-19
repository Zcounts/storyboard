import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onMenuAction: (callback: (action: string) => void) => {
    const events = [
      'menu:new-project',
      'menu:open-project',
      'menu:save',
      'menu:save-as',
      'menu:export-pdf',
      'menu:export-csv',
      'menu:export-fdx',
      'menu:print',
      'menu:preferences',
    ]
    const listeners = events.map(event => {
      const listener = () => callback(event)
      ipcRenderer.on(event, listener)
      return { event, listener }
    })
    // Return cleanup function
    return () => {
      listeners.forEach(({ event, listener }) => {
        ipcRenderer.removeListener(event, listener)
      })
    }
  },
})

export type ElectronAPI = {
  getAppVersion: () => Promise<string>
  onMenuAction: (callback: (action: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
