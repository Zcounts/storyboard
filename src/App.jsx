import React, { useRef, useEffect, useCallback, useState } from 'react'
import useStore from './store'
import Toolbar from './components/Toolbar'
import PageHeader from './components/PageHeader'
import ShotGrid from './components/ShotGrid'
import SettingsPanel from './components/SettingsPanel'
import ContextMenu from './components/ContextMenu'
import ExportModal, { exportToPDF, exportToPNG } from './components/ExportModal'
import RecentProjects from './components/RecentProjects'

export default function App() {
  const theme = useStore(s => s.theme)
  const shots = useStore(s => s.shots)
  const autoSave = useStore(s => s.autoSave)
  const getProjectData = useStore(s => s.getProjectData)
  const hideContextMenu = useStore(s => s.hideContextMenu)
  const pageRef = useRef(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Auto-save every 60 seconds
  useEffect(() => {
    if (!autoSave) return
    const interval = setInterval(() => {
      const data = getProjectData()
      localStorage.setItem('autosave', JSON.stringify(data))
      localStorage.setItem('autosave_time', new Date().toISOString())
    }, 60000)
    return () => clearInterval(interval)
  }, [autoSave, getProjectData])

  // Restore from autosave on first load if no shots
  useEffect(() => {
    if (shots.length === 0) {
      const saved = localStorage.getItem('autosave')
      if (saved) {
        try {
          const data = JSON.parse(saved)
          if (data.shots && data.shots.length > 0) {
            const savedTime = localStorage.getItem('autosave_time')
            const timeStr = savedTime ? new Date(savedTime).toLocaleString() : 'recently'
            if (confirm(`Restore auto-saved project from ${timeStr}? (${data.shots.length} shots)`)) {
              useStore.getState().loadProject(data)
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }, []) // eslint-disable-line

  const handleExportPDF = useCallback(async () => {
    await exportToPDF(pageRef.current)
  }, [])

  const handleExportPNG = useCallback(async () => {
    await exportToPNG(pageRef.current)
  }, [])

  const isDark = theme === 'dark'

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#e8e4db' }}
      onClick={() => hideContextMenu()}
    >
      {/* Toolbar */}
      <Toolbar
        onExportPDF={() => setExportModalOpen(true)}
        onExportPNG={handleExportPNG}
      />

      {/* Recent Projects bar */}
      <RecentProjects />

      {/* Main content */}
      <div className="flex-1 py-6 px-4 overflow-x-auto">
        {/* Page document */}
        <div
          ref={pageRef}
          className="page-document"
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            color: isDark ? '#e0e0e0' : '#1a1a1a',
          }}
        >
          {/* Page Header */}
          <PageHeader />

          {/* Shot Grid */}
          <ShotGrid />

          {/* Page footer */}
          <div className="text-center py-3 text-sm text-gray-400 border-t border-gray-200 mt-0">
            1
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel />

      {/* Context Menu */}
      <ContextMenu />

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportPNG={handleExportPNG}
      />
    </div>
  )
}
