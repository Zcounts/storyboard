import { create } from 'zustand'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function generateShotId(index, sceneNumber) {
  const scene = sceneNumber || 1
  if (index < 26) return `${scene}${LETTERS[index]}`
  const first = Math.floor(index / 26) - 1
  const second = index % 26
  return `${scene}${LETTERS[first]}${LETTERS[second]}`
}

function createShot(index, settings) {
  return {
    id: crypto.randomUUID(),
    shotLabel: generateShotId(index, settings?.sceneNumber || 1),
    color: '#22c55e',
    cameraName: settings?.cameraName || 'Camera 1',
    focalLength: settings?.defaultFocalLength || '35mm',
    image: null,
    imageType: null,
    specs: {
      size: 'WIDE SHOT',
      type: 'EYE LVL',
      move: 'STATIC',
      equip: 'STICKS',
    },
    notes: '',
    order: index,
  }
}

const defaultSettings = {
  sceneName: 'Scene 1',
  sceneNumber: 1,
  location: 'LOCATION',
  intExt: 'INT',
  cameraName: 'Camera 1',
  cameraBody: 'fx30',
  defaultFocalLength: '35mm',
  columnCount: 4,
  theme: 'light',
  pageNotes: '',
  shootOrder: '',
  dropdownMode: true,
}

const useStore = create((set, get) => ({
  // Project state
  shots: [],
  currentProjectPath: null,
  isDirty: false,
  recentProjects: [],
  settings: { ...defaultSettings },

  // UI state
  showSettings: false,
  showNewProjectModal: false,
  showHomeScreen: true,
  lastAutoSaved: null,
  sizeWarning: false,

  // ---- Settings Actions ----
  updateSettings: (patch) => set((state) => ({
    settings: { ...state.settings, ...patch },
    isDirty: true,
  })),

  toggleTheme: () => set((state) => ({
    settings: {
      ...state.settings,
      theme: state.settings.theme === 'light' ? 'dark' : 'light',
    },
    isDirty: true,
  })),

  setShowSettings: (v) => set({ showSettings: v }),
  setShowHomeScreen: (v) => set({ showHomeScreen: v }),
  setShowNewProjectModal: (v) => set({ showNewProjectModal: v }),

  // ---- Shot Actions ----
  addShot: () => set((state) => {
    const newIndex = state.shots.length
    const newShot = createShot(newIndex, state.settings)
    return {
      shots: [...state.shots, newShot],
      isDirty: true,
    }
  }),

  deleteShot: (id) => set((state) => {
    const newShots = state.shots
      .filter(s => s.id !== id)
      .map((s, i) => ({
        ...s,
        shotLabel: generateShotId(i, state.settings.sceneNumber),
        order: i,
      }))
    return { shots: newShots, isDirty: true }
  }),

  duplicateShot: (id) => set((state) => {
    const idx = state.shots.findIndex(s => s.id === id)
    if (idx === -1) return {}
    const original = state.shots[idx]
    const copy = {
      ...original,
      id: crypto.randomUUID(),
    }
    const newShots = [
      ...state.shots.slice(0, idx + 1),
      copy,
      ...state.shots.slice(idx + 1),
    ].map((s, i) => ({
      ...s,
      shotLabel: generateShotId(i, state.settings.sceneNumber),
      order: i,
    }))
    return { shots: newShots, isDirty: true }
  }),

  reorderShots: (activeId, overId) => set((state) => {
    const oldIndex = state.shots.findIndex(s => s.id === activeId)
    const newIndex = state.shots.findIndex(s => s.id === overId)
    if (oldIndex === -1 || newIndex === -1) return {}

    const newShots = [...state.shots]
    const [moved] = newShots.splice(oldIndex, 1)
    newShots.splice(newIndex, 0, moved)

    const reindexed = newShots.map((s, i) => ({
      ...s,
      shotLabel: generateShotId(i, state.settings.sceneNumber),
      order: i,
    }))
    return { shots: reindexed, isDirty: true }
  }),

  updateShotField: (id, field, value) => set((state) => ({
    shots: state.shots.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ),
    isDirty: true,
  })),

  updateShotSpecs: (id, specField, value) => set((state) => ({
    shots: state.shots.map(s =>
      s.id === id ? { ...s, specs: { ...s.specs, [specField]: value } } : s
    ),
    isDirty: true,
  })),

  updateShotImage: (id, base64, mimeType) => set((state) => ({
    shots: state.shots.map(s =>
      s.id === id ? { ...s, image: base64, imageType: mimeType } : s
    ),
    isDirty: true,
  })),

  // ---- Project Actions ----
  newProject: (sceneName) => set((state) => {
    const sceneNum = parseInt(sceneName?.match(/\d+/)?.[0]) || 1
    const newSettings = {
      ...defaultSettings,
      sceneName: sceneName || 'Scene 1',
      sceneNumber: sceneNum,
      theme: state.settings.theme, // preserve theme
    }
    const firstShot = createShot(0, newSettings)
    return {
      shots: [firstShot],
      settings: newSettings,
      currentProjectPath: null,
      isDirty: false,
      showHomeScreen: false,
      showNewProjectModal: false,
    }
  }),

  loadProject: (filePath, data) => set(() => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      return {
        shots: parsed.shots || [],
        settings: { ...defaultSettings, ...(parsed.settings || {}) },
        currentProjectPath: filePath,
        isDirty: false,
        showHomeScreen: false,
      }
    } catch (e) {
      return {}
    }
  }),

  setCurrentProjectPath: (p) => set({ currentProjectPath: p }),
  setIsDirty: (v) => set({ isDirty: v }),
  markSaved: (filePath) => set({ currentProjectPath: filePath, isDirty: false }),

  setRecentProjects: (projects) => set({ recentProjects: projects }),
  setLastAutoSaved: (ts) => set({ lastAutoSaved: ts }),
  setSizeWarning: (v) => set({ sizeWarning: v }),

  // Serialize for save
  getProjectData: () => {
    const state = get()
    return JSON.stringify({
      version: 1,
      shots: state.shots,
      settings: state.settings,
      savedAt: new Date().toISOString(),
    })
  },
}))

export default useStore
