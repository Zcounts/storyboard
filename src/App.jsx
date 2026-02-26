import React, { useRef, useEffect, useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import useStore from './store'
import Toolbar from './components/Toolbar'
import PageHeader from './components/PageHeader'
import ShotGrid from './components/ShotGrid'
import ShotCard from './components/ShotCard'
import SettingsPanel from './components/SettingsPanel'
import ContextMenu from './components/ContextMenu'
import ExportModal from './components/ExportModal'
import RecentProjects from './components/RecentProjects'
import ShotlistTab from './components/ShotlistTab'

// Cards per page based on column count (2 rows)
const CARDS_PER_PAGE = { 4: 8, 3: 6, 2: 4 }

function chunkArray(arr, size) {
  if (arr.length === 0) return [[]] // always at least one (empty) page
  const pages = []
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size))
  }
  return pages
}

/** One scene rendered as one or more page-document divs inside a single DnD context */
function SceneSection({
  scene,
  columnCount,
  useDropdowns,
  pageIndexOffset,
  pageRefs,
}) {
  const getShotsForScene = useStore(s => s.getShotsForScene)
  const addShot = useStore(s => s.addShot)
  const reorderShots = useStore(s => s.reorderShots)

  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const shotsWithIds = getShotsForScene(scene.id)
  const cardsPerPage = CARDS_PER_PAGE[columnCount] || 8
  const pages = chunkArray(shotsWithIds, cardsPerPage)
  const allShotIds = shotsWithIds.map(s => s.id)

  const activeShot = activeId ? shotsWithIds.find(s => s.id === activeId) : null

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    reorderShots(scene.id, active.id, over.id)
  }, [reorderShots, scene.id])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allShotIds} strategy={rectSortingStrategy}>
        {pages.map((pageShots, pageIdx) => {
          const globalPageNum = pageIndexOffset + pageIdx + 1
          const isContinuation = pageIdx > 0
          const isLastPage = pageIdx === pages.length - 1

          return (
            <div
              key={`${scene.id}_page_${pageIdx}`}
              ref={el => { if (el) pageRefs.current[globalPageNum - 1] = el }}
              className="page-document"
            >
              <PageHeader
                scene={scene}
                isContinuation={isContinuation}
                pageNum={pageIdx + 1}
              />

              <ShotGrid
                sceneId={scene.id}
                shots={pageShots}
                columnCount={columnCount}
                useDropdowns={useDropdowns}
                showAddBtn={isLastPage}
                onAddShot={() => addShot(scene.id)}
              />

              <div className="page-footer">
                {globalPageNum}
              </div>
            </div>
          )
        })}
      </SortableContext>

      <DragOverlay>
        {activeShot ? (
          <div className="drag-overlay">
            <ShotCard
              shot={activeShot}
              displayId={activeShot.displayId}
              useDropdowns={useDropdowns}
              sceneId={scene.id}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default function App() {
  const theme = useStore(s => s.theme)
  const scenes = useStore(s => s.scenes)
  const columnCount = useStore(s => s.columnCount)
  const useDropdowns = useStore(s => s.useDropdowns)
  const autoSave = useStore(s => s.autoSave)
  const getProjectData = useStore(s => s.getProjectData)
  const hideContextMenu = useStore(s => s.hideContextMenu)
  const addScene = useStore(s => s.addScene)
  const activeTab = useStore(s => s.activeTab)
  const setActiveTab = useStore(s => s.setActiveTab)

  const [exportModalOpen, setExportModalOpen] = useState(false)
  // Non-blocking autosave restore banner — replaces confirm() which steals focus
  const [restoreData, setRestoreData] = useState(null)
  // pageRefs is a flat array of all page-document elements in render order
  const pageRefs = useRef([])
  // storyboardRef points to the storyboard scroll container (always in DOM)
  const storyboardRef = useRef(null)

  // Reset refs array size on render so stale refs don't linger
  const totalPages = scenes.reduce((acc, scene) => {
    const cardsPerPage = CARDS_PER_PAGE[columnCount] || 8
    return acc + Math.max(1, Math.ceil(scene.shots.length / cardsPerPage))
  }, 0)
  pageRefs.current = pageRefs.current.slice(0, totalPages)

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

  // Restore from autosave on first load if no shots.
  // Uses a non-blocking banner instead of confirm() — confirm() is a native dialog
  // that steals Electron window focus, making inputs non-editable until the user
  // clicks somewhere after dismissal.
  useEffect(() => {
    const hasShots = useStore.getState().scenes.some(s => s.shots.length > 0)
    if (!hasShots) {
      const saved = localStorage.getItem('autosave')
      if (saved) {
        try {
          const data = JSON.parse(saved)
          const totalShots = (data.scenes || [{ shots: data.shots || [] }])
            .reduce((a, s) => a + (s.shots || []).length, 0)
          if (totalShots > 0) {
            const savedTime = localStorage.getItem('autosave_time')
            setRestoreData({ data, totalShots, savedTime })
          }
        } catch {
          // ignore
        }
      }
    }
  }, []) // eslint-disable-line

  const isDark = theme === 'dark'

  // Compute page offset for each scene (for global page numbering)
  const scenePageOffsets = []
  let runningOffset = 0
  for (const scene of scenes) {
    scenePageOffsets.push(runningOffset)
    const cardsPerPage = CARDS_PER_PAGE[columnCount] || 8
    runningOffset += Math.max(1, Math.ceil(scene.shots.length / cardsPerPage))
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#e8e4db' }}
      onClick={() => hideContextMenu()}
    >
      {/* Toolbar */}
      <Toolbar
        onExportPDF={() => setExportModalOpen(true)}
        onExportPNG={() => setExportModalOpen(true)}
      />

      {/* Recent Projects bar */}
      <RecentProjects />

      {/* Top-level tab navigation */}
      <div className="tab-nav" style={{
        display: 'flex',
        borderBottom: isDark ? '1px solid #333' : '1px solid #ccc',
        backgroundColor: isDark ? '#111' : '#d4cfc6',
        paddingLeft: '16px',
      }}>
        {['storyboard', 'shotlist'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: 'none',
              borderBottom: activeTab === tab
                ? (isDark ? '2px solid #fff' : '2px solid #222')
                : '2px solid transparent',
              background: 'none',
              color: activeTab === tab
                ? (isDark ? '#fff' : '#222')
                : (isDark ? '#666' : '#888'),
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: '-1px',
            }}
          >
            {tab === 'storyboard' ? 'Storyboard' : 'Shotlist'}
          </button>
        ))}
      </div>

      {/* Autosave restore banner — non-blocking, doesn't steal focus */}
      {restoreData && (
        <div style={{
          background: '#2a2a2a',
          color: '#fff',
          padding: '7px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          fontFamily: 'monospace',
          flexShrink: 0,
          zIndex: 50,
          borderBottom: '1px solid #444',
        }}>
          <span style={{ opacity: 0.85 }}>
            Auto-saved project found ({restoreData.totalShots} shot{restoreData.totalShots !== 1 ? 's' : ''}
            {restoreData.savedTime ? `, saved ${new Date(restoreData.savedTime).toLocaleString()}` : ''})
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                useStore.getState().loadProject(restoreData.data)
                setRestoreData(null)
              }}
              style={{
                background: '#4ade80', color: '#000', border: 'none',
                borderRadius: 4, padding: '3px 14px', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
              }}
            >
              Restore
            </button>
            <button
              onClick={() => setRestoreData(null)}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#ccc', border: 'none',
                borderRadius: 4, padding: '3px 12px', cursor: 'pointer',
                fontSize: 11, fontFamily: 'monospace',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────────────
          Both tabs are always mounted (display:none hides the inactive one).
          This keeps pageRefs valid for PDF export regardless of active tab,
          and avoids re-mounting components on every tab switch.             */}

      {/* Storyboard tab */}
      <div
        ref={storyboardRef}
        className="flex-1 py-6 px-4 overflow-x-auto"
        style={{ display: activeTab === 'storyboard' ? undefined : 'none' }}
      >
        <div className="pages-container">
          {scenes.map((scene, sceneIdx) => (
            <React.Fragment key={scene.id}>
              {/* Scene separator (between scenes) */}
              {sceneIdx > 0 && (
                <div className="scene-separator">
                  <span className="scene-separator-label">NEW SCENE</span>
                </div>
              )}

              <SceneSection
                scene={scene}
                columnCount={columnCount}
                useDropdowns={useDropdowns}
                pageIndexOffset={scenePageOffsets[sceneIdx]}
                pageRefs={pageRefs}
              />
            </React.Fragment>
          ))}

          {/* Add Scene button */}
          <div className="add-scene-row">
            <button
              className="add-scene-btn"
              onClick={addScene}
              title="Add a new scene (new page)"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="10" cy="10" r="8" />
                <line x1="10" y1="6" x2="10" y2="14" />
                <line x1="6" y1="10" x2="14" y2="10" />
              </svg>
              Add Scene
            </button>
          </div>
        </div>
      </div>

      {/* Shotlist tab */}
      <div
        className="flex-1 flex flex-col overflow-auto"
        style={{ display: activeTab === 'shotlist' ? undefined : 'none' }}
      >
        <ShotlistTab />
      </div>

      {/* Settings Panel */}
      <SettingsPanel />

      {/* Context Menu */}
      <ContextMenu />

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        pageRefs={pageRefs}
        storyboardRef={storyboardRef}
      />
    </div>
  )
}
