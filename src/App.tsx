import React, { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainContent } from './components/MainContent'

function App() {
  useEffect(() => {
    // Listen for menu actions from main process (only in Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
      const cleanup = window.electronAPI.onMenuAction((action: string) => {
        console.log('Menu action:', action)
        // Future: dispatch to store or show modals
      })
      return cleanup
    }
  }, [])

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: '#1a1a1a' }}
    >
      <Sidebar />
      <MainContent />
    </div>
  )
}

export default App
