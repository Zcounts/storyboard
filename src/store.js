import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'

export const CARD_COLORS = [
  '#4ade80', // green
  '#22d3ee', // cyan
  '#facc15', // yellow
  '#f87171', // red
  '#60a5fa', // blue
  '#fb923c', // orange
  '#c084fc', // purple
  '#f472b6', // pink
]

const DEFAULT_COLOR = '#4ade80'

let shotCounter = 0
let sceneCounter = 1

function createShot(overrides = {}) {
  shotCounter++
  return {
    id: `shot_${Date.now()}_${shotCounter}`,
    cameraName: 'Camera 1',
    focalLength: '85mm',
    color: DEFAULT_COLOR,
    image: null,
    specs: {
      size: 'WIDE SHOT',
      type: 'EYE LVL',
      move: 'STATIC',
      equip: 'STICKS',
    },
    notes: '',
    ...overrides,
  }
}

function createScene(overrides = {}) {
  const id = `scene_${Date.now()}_${sceneCounter}`
  const num = sceneCounter
  sceneCounter++
  return {
    id,
    sceneLabel: `SCENE ${num}`,
    location: 'LOCATION',
    intOrExt: 'INT',
    cameraName: 'Camera 1',
    cameraBody: 'fx30',
    pageNotes: '*NOTE: \n*SHOOT ORDER: ',
    shots: [],
    ...overrides,
  }
}

function getShotLetter(index) {
  if (index < 26) return String.fromCharCode(65 + index)
  const firstChar = String.fromCharCode(65 + Math.floor(index / 26) - 1)
  const secondChar = String.fromCharCode(65 + (index % 26))
  return firstChar + secondChar
}

function getSceneNumber(sceneLabel) {
  const match = sceneLabel.match(/\d+/)
  return match ? parseInt(match[0]) : 1
}

const initialScene = createScene({
  id: 'scene_1',
  sceneLabel: 'SCENE 1',
  location: 'CLUB',
  intOrExt: 'INT',
})

const useStore = create((set, get) => ({
  // Project metadata
  projectPath: null,
  projectName: 'Untitled Shotlist',
  lastSaved: null,

  // Scenes (multi-scene support)
  scenes: [initialScene],

  // Global settings
  columnCount: 4,
  defaultFocalLength: '85mm',
  theme: 'light',
  autoSave: true,
  useDropdowns: true,

  // Recent projects
  recentProjects: JSON.parse(localStorage.getItem('recentProjects') || '[]'),

  // UI state
  settingsOpen: false,
  contextMenu: null, // { shotId, sceneId, x, y }

  // ── Scene helpers ────────────────────────────────────────────────────

  getScene: (sceneId) => get().scenes.find(s => s.id === sceneId),

  // Returns shots for a scene with computed displayIds
  getShotsForScene: (sceneId) => {
    const scene = get().scenes.find(s => s.id === sceneId)
    if (!scene) return []
    const sceneNum = getSceneNumber(scene.sceneLabel)
    return scene.shots.map((shot, index) => ({
      ...shot,
      displayId: `${sceneNum}${getShotLetter(index)}`,
    }))
  },

  // Total shot count across all scenes (for toolbar)
  getTotalShots: () => get().scenes.reduce((acc, s) => acc + s.shots.length, 0),

  // ── Scene actions ────────────────────────────────────────────────────

  addScene: () => {
    const scene = createScene()
    set(state => ({ scenes: [...state.scenes, scene] }))
    get()._scheduleAutoSave()
    return scene.id
  },

  deleteScene: (sceneId) => {
    set(state => ({
      scenes: state.scenes.length > 1
        ? state.scenes.filter(s => s.id !== sceneId)
        : state.scenes, // never delete the last scene
    }))
    get()._scheduleAutoSave()
  },

  updateScene: (sceneId, updates) => {
    set(state => ({
      scenes: state.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s),
    }))
    get()._scheduleAutoSave()
  },

  // ── Shot actions (most work by shotId, searching across all scenes) ──

  addShot: (sceneId) => {
    const { scenes, defaultFocalLength } = get()
    const scene = scenes.find(s => s.id === sceneId)
    if (!scene) return
    const newShot = createShot({
      cameraName: scene.cameraName,
      focalLength: defaultFocalLength,
      color: DEFAULT_COLOR,
    })
    set(state => ({
      scenes: state.scenes.map(s =>
        s.id === sceneId ? { ...s, shots: [...s.shots, newShot] } : s
      ),
    }))
    get()._scheduleAutoSave()
  },

  deleteShot: (shotId) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.filter(sh => sh.id !== shotId),
      })),
    }))
    get()._scheduleAutoSave()
  },

  duplicateShot: (shotId) => {
    set(state => ({
      scenes: state.scenes.map(scene => {
        const idx = scene.shots.findIndex(s => s.id === shotId)
        if (idx === -1) return scene
        shotCounter++
        const original = scene.shots[idx]
        const duplicate = {
          ...original,
          id: `shot_${Date.now()}_${shotCounter}`,
          specs: { ...original.specs },
        }
        return {
          ...scene,
          shots: [
            ...scene.shots.slice(0, idx + 1),
            duplicate,
            ...scene.shots.slice(idx + 1),
          ],
        }
      }),
    }))
    get()._scheduleAutoSave()
  },

  reorderShots: (sceneId, activeId, overId) => {
    set(state => ({
      scenes: state.scenes.map(scene => {
        if (scene.id !== sceneId) return scene
        const oldIndex = scene.shots.findIndex(s => s.id === activeId)
        const newIndex = scene.shots.findIndex(s => s.id === overId)
        if (oldIndex === -1 || newIndex === -1) return scene
        return { ...scene, shots: arrayMove(scene.shots, oldIndex, newIndex) }
      }),
    }))
    get()._scheduleAutoSave()
  },

  updateShot: (shotId, updates) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.map(sh => sh.id === shotId ? { ...sh, ...updates } : sh),
      })),
    }))
    get()._scheduleAutoSave()
  },

  updateShotSpec: (shotId, specKey, value) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.map(sh =>
          sh.id === shotId ? { ...sh, specs: { ...sh.specs, [specKey]: value } } : sh
        ),
      })),
    }))
    get()._scheduleAutoSave()
  },

  updateShotNotes: (shotId, notes) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.map(sh => sh.id === shotId ? { ...sh, notes } : sh),
      })),
    }))
    get()._scheduleAutoSave()
  },

  updateShotColor: (shotId, color) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.map(sh => sh.id === shotId ? { ...sh, color } : sh),
      })),
    }))
    get()._scheduleAutoSave()
  },

  updateShotImage: (shotId, imageBase64) => {
    set(state => ({
      scenes: state.scenes.map(s => ({
        ...s,
        shots: s.shots.map(sh => sh.id === shotId ? { ...sh, image: imageBase64 } : sh),
      })),
    }))
    get()._scheduleAutoSave()
  },

  // ── Global settings ──────────────────────────────────────────────────

  setColumnCount: (count) => set({ columnCount: count }),
  setDefaultFocalLength: (fl) => set({ defaultFocalLength: fl }),
  setTheme: (theme) => set({ theme }),
  setAutoSave: (enabled) => set({ autoSave: enabled }),
  setUseDropdowns: (val) => set({ useDropdowns: val }),
  setProjectName: (name) => set({ projectName: name }),

  // ── UI actions ───────────────────────────────────────────────────────

  toggleSettings: () => set(state => ({ settingsOpen: !state.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),

  showContextMenu: (shotId, sceneId, x, y) => set({ contextMenu: { shotId, sceneId, x, y } }),
  hideContextMenu: () => set({ contextMenu: null }),

  // ── Save / Load ──────────────────────────────────────────────────────

  getProjectData: () => {
    const {
      projectName, columnCount, defaultFocalLength,
      theme, autoSave, useDropdowns, scenes,
    } = get()
    return {
      version: 2,
      projectName,
      columnCount,
      defaultFocalLength,
      theme,
      autoSave,
      useDropdowns,
      scenes: scenes.map(scene => ({
        ...scene,
        shots: scene.shots.map(s => ({ ...s })),
      })),
      exportedAt: new Date().toISOString(),
    }
  },

  saveProject: async () => {
    const data = get().getProjectData()
    const totalSize = JSON.stringify(data).length
    if (totalSize > 50 * 1024 * 1024) {
      alert('Warning: Project file exceeds 50MB due to embedded images. Consider removing some images.')
    }
    const json = JSON.stringify(data, null, 2)
    const defaultName = `${data.projectName.replace(/[^a-z0-9]/gi, '_')}.shotlist`

    if (window.electronAPI) {
      const result = await window.electronAPI.saveProject(defaultName, json)
      if (result.success) {
        set({ lastSaved: new Date().toISOString(), projectPath: result.filePath })
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      set({ lastSaved: new Date().toISOString() })
    }
  },

  loadProject: (data) => {
    const {
      projectName, columnCount, defaultFocalLength,
      theme, autoSave, useDropdowns,
    } = data

    let scenes
    if (data.scenes && Array.isArray(data.scenes)) {
      // New multi-scene format (v2)
      scenes = data.scenes.map(scene => ({
        id: scene.id || `scene_${Date.now()}_${++sceneCounter}`,
        sceneLabel: scene.sceneLabel || 'SCENE 1',
        location: scene.location || 'LOCATION',
        intOrExt: scene.intOrExt || 'INT',
        cameraName: scene.cameraName || 'Camera 1',
        cameraBody: scene.cameraBody || 'fx30',
        pageNotes: scene.pageNotes || '',
        shots: (scene.shots || []).map(s => ({
          id: s.id || `shot_${Date.now()}_${++shotCounter}`,
          cameraName: s.cameraName || 'Camera 1',
          focalLength: s.focalLength || '85mm',
          color: s.color || DEFAULT_COLOR,
          image: s.image || null,
          specs: s.specs || { size: '', type: '', move: '', equip: '' },
          notes: s.notes || '',
        })),
      }))
    } else {
      // Old single-scene format (v1) – migrate
      scenes = [createScene({
        id: 'scene_1',
        sceneLabel: data.sceneLabel || 'SCENE 1',
        location: data.location || 'LOCATION',
        intOrExt: data.intOrExt || 'INT',
        cameraName: data.cameraName || 'Camera 1',
        cameraBody: data.cameraBody || 'fx30',
        pageNotes: data.pageNotes || '',
        shots: (data.shots || []).map(s => ({
          id: s.id || `shot_${Date.now()}_${++shotCounter}`,
          cameraName: s.cameraName || 'Camera 1',
          focalLength: s.focalLength || '85mm',
          color: s.color || DEFAULT_COLOR,
          image: s.image || null,
          specs: s.specs || { size: '', type: '', move: '', equip: '' },
          notes: s.notes || '',
        })),
      })]
    }

    set({
      projectName: projectName || 'Untitled Shotlist',
      columnCount: columnCount || 4,
      defaultFocalLength: defaultFocalLength || '85mm',
      theme: theme || 'light',
      autoSave: autoSave !== undefined ? autoSave : true,
      useDropdowns: useDropdowns !== undefined ? useDropdowns : true,
      scenes,
      lastSaved: new Date().toISOString(),
    })
  },

  openProject: async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.openProject()
      if (!result.success) return
      try {
        const data = JSON.parse(result.data)
        get().loadProject(data)
        const fileName = result.filePath.split(/[\\/]/).pop()
        const recent = get().recentProjects.filter(r => r.path !== result.filePath)
        const totalShots = (data.scenes || [{ shots: data.shots || [] }])
          .reduce((a, s) => a + (s.shots || []).length, 0)
        const newRecent = [
          { name: fileName, path: result.filePath, date: new Date().toISOString(), shots: totalShots },
          ...recent,
        ].slice(0, 10)
        set({ recentProjects: newRecent, projectPath: result.filePath })
        localStorage.setItem('recentProjects', JSON.stringify(newRecent))
      } catch {
        alert('Failed to load project: Invalid file format')
      }
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.shotlist,.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result)
            get().loadProject(data)
            const recent = get().recentProjects.filter(r => r.name !== file.name)
            const totalShots = (data.scenes || [{ shots: data.shots || [] }])
              .reduce((a, s) => a + (s.shots || []).length, 0)
            const newRecent = [
              { name: file.name, path: file.name, date: new Date().toISOString(), shots: totalShots },
              ...recent,
            ].slice(0, 10)
            set({ recentProjects: newRecent })
            localStorage.setItem('recentProjects', JSON.stringify(newRecent))
          } catch {
            alert('Failed to load project: Invalid file format')
          }
        }
        reader.readAsText(file)
      }
      document.body.appendChild(input)
      input.click()
      document.body.removeChild(input)
    }
  },

  openProjectFromPath: async (filePath) => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.openProjectFromPath(filePath)
    if (!result.success) {
      alert(`Could not open file: ${result.error || 'File not found'}`)
      return
    }
    try {
      const data = JSON.parse(result.data)
      get().loadProject(data)
      const fileName = filePath.split(/[\\/]/).pop()
      const recent = get().recentProjects.filter(r => r.path !== filePath)
      const totalShots = (data.scenes || [{ shots: data.shots || [] }])
        .reduce((a, s) => a + (s.shots || []).length, 0)
      const newRecent = [
        { name: fileName, path: filePath, date: new Date().toISOString(), shots: totalShots },
        ...recent,
      ].slice(0, 10)
      set({ recentProjects: newRecent, projectPath: filePath })
      localStorage.setItem('recentProjects', JSON.stringify(newRecent))
    } catch {
      alert('Failed to load project: Invalid file format')
    }
  },

  newProject: () => {
    const name = prompt('Project name:', 'Untitled Shotlist')
    if (name === null) return
    const scene = createScene({ sceneLabel: 'SCENE 1', location: 'LOCATION' })
    set({
      projectName: name,
      scenes: [scene],
      projectPath: null,
      lastSaved: null,
    })
  },

  // ── Auto-save ────────────────────────────────────────────────────────

  _autoSaveTimeout: null,
  _scheduleAutoSave: () => {
    const state = get()
    if (!state.autoSave) return
    if (state._autoSaveTimeout) clearTimeout(state._autoSaveTimeout)
    const timeout = setTimeout(() => {
      const data = get().getProjectData()
      localStorage.setItem('autosave', JSON.stringify(data))
      localStorage.setItem('autosave_time', new Date().toISOString())
    }, 60000)
    set({ _autoSaveTimeout: timeout })
  },

  CARD_COLORS,
}))

export default useStore
