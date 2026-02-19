import { useEffect, useState } from 'react'
import useStore from '../store/useStore'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function HomeScreen() {
  const setShowNewProjectModal = useStore(s => s.setShowNewProjectModal)
  const setShowHomeScreen = useStore(s => s.setShowHomeScreen)
  const loadProject = useStore(s => s.loadProject)
  const setRecentProjects = useStore(s => s.setRecentProjects)
  const recentProjects = useStore(s => s.recentProjects)

  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadRecent() {
      if (isElectron) {
        const projects = await window.electronAPI.getRecentProjects()
        setRecentProjects(projects)
      } else {
        // Browser fallback: load from localStorage
        try {
          const stored = localStorage.getItem('recentProjects')
          if (stored) setRecentProjects(JSON.parse(stored))
        } catch {}
      }
    }
    loadRecent()
  }, [])

  const handleNewProject = () => {
    setShowNewProjectModal(true)
  }

  const handleOpenFile = async () => {
    setError(null)
    if (isElectron) {
      const result = await window.electronAPI.openFile()
      if (!result.canceled && result.data) {
        loadProject(result.filePath, result.data)
        const projects = await window.electronAPI.getRecentProjects()
        setRecentProjects(projects)
      }
    } else {
      // Browser: use file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.shotlist'
      input.onchange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            loadProject(file.name, ev.target.result)
          } catch {
            setError('Failed to load project file.')
          }
        }
        reader.readAsText(file)
      }
      input.click()
    }
  }

  const handleOpenRecent = async (project) => {
    setError(null)
    if (isElectron) {
      const result = await window.electronAPI.openFilePath(project.path)
      if (result.error) {
        setError(`Could not open file: ${result.error}`)
        return
      }
      if (!result.canceled && result.data) {
        loadProject(result.filePath, result.data)
        const projects = await window.electronAPI.getRecentProjects()
        setRecentProjects(projects)
      }
    }
  }

  const handleClearRecent = async () => {
    if (isElectron) {
      await window.electronAPI.clearRecentProjects()
    } else {
      localStorage.removeItem('recentProjects')
    }
    setRecentProjects([])
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    try {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-page)] px-4">
      <div className="w-full max-w-xl">
        {/* Logo / Title */}
        <div className="mb-12 text-center">
          <div className="text-5xl font-black tracking-widest dark:text-gray-100 mb-2">SHOTLIST</div>
          <div className="text-sm text-gray-400 dark:text-gray-500 font-medium tracking-widest uppercase">
            Film Storyboard & Shotlist App
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mb-10">
          <button
            className="w-full py-3.5 px-6 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors tracking-wide"
            onClick={handleNewProject}
          >
            NEW PROJECT
          </button>
          <button
            className="w-full py-3.5 px-6 bg-transparent border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-lg hover:border-gray-500 dark:hover:border-gray-400 transition-colors tracking-wide"
            onClick={handleOpenFile}
          >
            OPEN PROJECT
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-700">
            {error}
          </div>
        )}

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Recent Projects
              </div>
              <button
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400"
                onClick={handleClearRecent}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {recentProjects.map((proj, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                  onClick={() => handleOpenRecent(proj)}
                  disabled={!isElectron}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {proj.name || 'Untitled'}
                      </div>
                      {proj.path && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-600 truncate max-w-xs mt-0.5">
                          {proj.path}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 ml-2 shrink-0">
                      {formatDate(proj.lastOpened)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
