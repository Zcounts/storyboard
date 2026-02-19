import { useEffect, useCallback, useRef } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import ShotGrid from './components/ShotGrid'
import HomeScreen from './components/HomeScreen'
import NewProjectModal from './components/NewProjectModal'

const isElectron = typeof window !== 'undefined' && window.electronAPI

// Size limit warning threshold in bytes (50MB)
const SIZE_WARN_BYTES = 50 * 1024 * 1024

export default function App() {
  const settings = useStore(s => s.settings)
  const showHomeScreen = useStore(s => s.showHomeScreen)
  const showNewProjectModal = useStore(s => s.showNewProjectModal)
  const isDirty = useStore(s => s.isDirty)
  const sizeWarning = useStore(s => s.sizeWarning)
  const lastAutoSaved = useStore(s => s.lastAutoSaved)
  const currentProjectPath = useStore(s => s.currentProjectPath)
  const setShowNewProjectModal = useStore(s => s.setShowNewProjectModal)
  const setShowHomeScreen = useStore(s => s.setShowHomeScreen)
  const setRecentProjects = useStore(s => s.setRecentProjects)
  const loadProject = useStore(s => s.loadProject)
  const getProjectData = useStore(s => s.getProjectData)
  const markSaved = useStore(s => s.markSaved)
  const setLastAutoSaved = useStore(s => s.setLastAutoSaved)
  const setSizeWarning = useStore(s => s.setSizeWarning)

  const autoSaveTimerRef = useRef(null)

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [settings.theme])

  // ---- Save ----
  const handleSave = useCallback(async () => {
    const data = getProjectData()

    // Check size
    const sizeBytes = new Blob([data]).size
    setSizeWarning(sizeBytes > SIZE_WARN_BYTES)

    if (isElectron) {
      if (currentProjectPath) {
        // Save to existing path
        const result = await window.electronAPI.saveFilePath(currentProjectPath, data)
        markSaved(currentProjectPath)
        if (result.sizeMB > 50) setSizeWarning(true)
      } else {
        // Show save dialog
        const projectName = settings.sceneName || 'untitled'
        const result = await window.electronAPI.saveFile(`${projectName}.shotlist`, data)
        if (!result.canceled) {
          markSaved(result.filePath)
          if (result.sizeMB > 50) setSizeWarning(true)
          const projects = await window.electronAPI.getRecentProjects()
          setRecentProjects(projects)
        }
      }
    } else {
      // Browser fallback: download as file
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${settings.sceneName || 'untitled'}.shotlist`
      a.click()
      URL.revokeObjectURL(url)
      markSaved(null)

      // Store recent in localStorage
      const recent = JSON.parse(localStorage.getItem('recentProjects') || '[]')
      const name = settings.sceneName || 'Untitled'
      const filtered = recent.filter(r => r.name !== name)
      filtered.unshift({ name, lastOpened: new Date().toISOString() })
      localStorage.setItem('recentProjects', JSON.stringify(filtered.slice(0, 5)))
    }
  }, [currentProjectPath, settings.sceneName, getProjectData, markSaved, setSizeWarning, setRecentProjects])

  // ---- Open File ----
  const handleOpenFile = useCallback(async () => {
    if (isElectron) {
      const result = await window.electronAPI.openFile()
      if (!result.canceled && result.data) {
        loadProject(result.filePath, result.data)
        const projects = await window.electronAPI.getRecentProjects()
        setRecentProjects(projects)
      }
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.shotlist'
      input.onchange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          loadProject(file.name, ev.target.result)
        }
        reader.readAsText(file)
      }
      input.click()
    }
  }, [loadProject, setRecentProjects])

  // ---- New Project ----
  const handleNewProject = useCallback(() => {
    setShowNewProjectModal(true)
  }, [setShowNewProjectModal])

  // ---- Auto-save (every 60 seconds) ----
  useEffect(() => {
    if (showHomeScreen) return

    const doAutoSave = async () => {
      if (!isDirty && lastAutoSaved) return
      const data = getProjectData()
      if (isElectron) {
        const result = await window.electronAPI.autoSave(data)
        if (result.success) {
          setLastAutoSaved(new Date().toISOString())
        }
      } else {
        try {
          localStorage.setItem('storyboard-autosave', data)
          setLastAutoSaved(new Date().toISOString())
        } catch {}
      }
    }

    autoSaveTimerRef.current = setInterval(doAutoSave, 60000)
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    }
  }, [showHomeScreen, isDirty, lastAutoSaved, getProjectData, setLastAutoSaved])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewProject()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleOpenFile, handleNewProject])

  // Show home screen
  if (showHomeScreen) {
    return (
      <div className={settings.theme === 'dark' ? 'dark' : ''}>
        <HomeScreen />
        {showNewProjectModal && <NewProjectModal />}
      </div>
    )
  }

  return (
    <div className={`flex h-screen overflow-hidden ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        onSave={handleSave}
        onOpenFile={handleOpenFile}
        onNewProject={handleNewProject}
        lastAutoSaved={lastAutoSaved}
        isDirty={isDirty}
        sizeWarning={sizeWarning}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg-page)] p-6">
        <ShotGrid />
      </main>

      {/* Modals */}
      {showNewProjectModal && <NewProjectModal />}
    </div>
  )
}
