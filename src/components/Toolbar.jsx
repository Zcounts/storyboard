import React, { useState } from 'react'
import useStore from '../store'

export default function Toolbar({ onExportPDF, onExportPNG }) {
  const projectName = useStore(s => s.projectName)
  const lastSaved = useStore(s => s.lastSaved)
  const autoSave = useStore(s => s.autoSave)
  const scenes = useStore(s => s.scenes)
  const shotCount = scenes.reduce((acc, s) => acc + s.shots.length, 0)
  const sceneCount = scenes.length
  const toggleSettings = useStore(s => s.toggleSettings)
  const saveProject = useStore(s => s.saveProject)
  const openProject = useStore(s => s.openProject)
  const newProject = useStore(s => s.newProject)
  const setProjectName = useStore(s => s.setProjectName)
  const [editingName, setEditingName] = useState(false)

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="toolbar">
      {/* Left: Project name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* App icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
          <rect x="2" y="2" width="16" height="16" rx="2" fill="#3b82f6" />
          <rect x="4" y="5" width="5" height="4" rx="1" fill="white" />
          <rect x="11" y="5" width="5" height="4" rx="1" fill="white" />
          <rect x="4" y="11" width="5" height="4" rx="1" fill="white" />
          <rect x="11" y="11" width="5" height="4" rx="1" fill="white" />
        </svg>

        {editingName ? (
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
            className="bg-gray-700 border border-gray-500 rounded px-2 py-0.5 text-sm text-white outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-semibold text-white hover:text-gray-300 transition-colors truncate"
          >
            {projectName}
          </button>
        )}

        {/* Shot / scene count */}
        <span className="text-xs text-gray-400 flex-shrink-0">
          {shotCount} shot{shotCount !== 1 ? 's' : ''} · {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
        </span>

        {/* Auto-save indicator */}
        {autoSave && lastSaved && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            Saved {formatTime(lastSaved)}
          </span>
        )}
      </div>

      {/* Center: File operations */}
      <div className="flex items-center gap-2">
        <button className="toolbar-btn" onClick={newProject} title="New project">
          New
        </button>
        <button className="toolbar-btn" onClick={openProject} title="Open .shotlist file">
          Open
        </button>
        <button className="toolbar-btn primary" onClick={saveProject} title="Save as .shotlist file">
          Save
        </button>
      </div>

      {/* Right: Export + Settings */}
      <div className="flex items-center gap-2">
        <button className="toolbar-btn" onClick={onExportPDF} title="Export to PDF">
          PDF
        </button>
        <button className="toolbar-btn" onClick={onExportPNG} title="Export to PNG">
          PNG
        </button>
        <button className="toolbar-btn" onClick={toggleSettings} title="Settings">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="10" cy="10" r="3" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
